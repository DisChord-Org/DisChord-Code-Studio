import { useSyncExternalStore } from "react";
import { listen } from "@tauri-apps/api/event";

export type LineKind = "stdout" | "stderr" | "info" | "success" | "warning" | "error";

export type RunStatus = "running" | "finished" | "failed" | "stopped";

/** A place in a project file that a line points at (1-based line and column). */
export interface OutputLocation {
    path: string;
    line: number;
    column: number;
}

export interface OutputLine {
    id: number;
    kind: LineKind;
    text: string;
    ts: number;
    location?: OutputLocation;
}

export interface OutputRun {
    id: number;
    startedAt: number;
    endedAt: number | null;
    status: RunStatus;
    exitCode: number | null;
    /** File the compiler reported working on last; compiler errors only carry "[line:col]". */
    currentFile: string;
    lines: OutputLine[];
}

type OutputEvent =
    | { type: "line"; kind: LineKind; text: string; ts: number }
    | { type: "run_end"; status: { state: "finished" | "stopped" } | { state: "failed"; code: number | null }; ts: number };

const defaultFile = "src/index.chord";
const compilingLine = /^Compilando: (.+)$/;
const chordPosition = /\[(\d+):(\d+)\]/;
const filePosition = /((?:\.\/)?[\w\-./]+\.(?:chord|js|mjs|cjs|ts|tsx|json)):(\d+)(?::(\d+))?/;

const isProjectRelative = (path: string) => !path.startsWith("/") && !/^[A-Za-z]:/.test(path) && !path.includes("..") && !path.includes("node_modules");

const findLocation = (text: string, currentFile: string): OutputLocation | undefined => {
    const fileMatch = text.match(filePosition);
    if (fileMatch && isProjectRelative(fileMatch[1])) {
        return { path: fileMatch[1].replace(/^\.\//, ""), line: Number(fileMatch[2]), column: Number(fileMatch[3] ?? 1) };
    }

    const chordMatch = text.match(chordPosition);
    if (chordMatch && /error/i.test(text)) {
        return { path: currentFile, line: Number(chordMatch[1]), column: Number(chordMatch[2]) };
    }

    return undefined;
};

const maxRuns = 20;
const maxLinesPerRun = 5000;

let runs: OutputRun[] = [];
let snapshot: readonly OutputRun[] = [];
let dirty = new Set<number>();
let nextRunId = 1;
let nextLineId = 1;
let flushScheduled = false;
let listening = false;
const subscribers = new Set<() => void>();

// Lines arrive in bursts; React only sees the state once per animation frame.
const scheduleFlush = () => {
    if (flushScheduled) return;
    flushScheduled = true;
    requestAnimationFrame(() => {
        flushScheduled = false;
        snapshot = runs.map((run) => (dirty.has(run.id) ? { ...run, lines: run.lines.slice() } : run));
        runs = snapshot.slice();
        dirty = new Set();
        subscribers.forEach((notify) => notify());
    });
};

const activeRun = (): OutputRun | undefined => {
    const last = runs[runs.length - 1];
    return last && last.status === "running" ? last : undefined;
};

export const beginRun = () => {
    const previous = activeRun();
    if (previous) endRun("stopped", null, Date.now());

    runs.push({ id: nextRunId++, startedAt: Date.now(), endedAt: null, status: "running", exitCode: null, currentFile: defaultFile, lines: [] });
    if (runs.length > maxRuns) runs = runs.slice(runs.length - maxRuns);
    dirty.add(runs[runs.length - 1].id);
    scheduleFlush();
};

export const pushLine = (kind: LineKind, text: string, ts = Date.now()) => {
    let run = activeRun();
    if (!run) {
        beginRun();
        run = activeRun()!;
    }

    const compiling = kind === "stdout" ? text.match(compilingLine) : null;
    if (compiling && isProjectRelative(compiling[1].trim())) run.currentFile = compiling[1].trim();

    const location = kind === "stderr" || kind === "error" ? findLocation(text, run.currentFile) : undefined;
    run.lines.push({ id: nextLineId++, kind, text, ts, location });
    if (run.lines.length > maxLinesPerRun) run.lines.splice(0, run.lines.length - maxLinesPerRun);
    dirty.add(run.id);
    scheduleFlush();
};

export const endRun = (status: Exclude<RunStatus, "running">, exitCode: number | null, ts = Date.now()) => {
    const run = activeRun();
    if (!run) return;

    run.status = status;
    run.exitCode = exitCode;
    run.endedAt = ts;
    dirty.add(run.id);
    scheduleFlush();
};

/** Wipes the finished runs and the lines of the one in progress. */
export const clearOutput = () => {
    runs = runs.filter((run) => run.status === "running").map((run) => ({ ...run, lines: [] }));
    runs.forEach((run) => dirty.add(run.id));
    scheduleFlush();
};

/** Starts listening to the backend once; safe to call from several places. */
export const startOutputListener = () => {
    if (listening) return;
    listening = true;

    listen<OutputEvent>("terminal-output", ({ payload }) => {
        if (payload.type === "line") {
            pushLine(payload.kind, payload.text, payload.ts);
        } else if (payload.status.state === "failed") {
            endRun("failed", payload.status.code, payload.ts);
        } else {
            endRun(payload.status.state, null, payload.ts);
        }
    }).catch((error) => {
        listening = false;
        console.error("No se pudo escuchar la salida de la terminal:", error);
    });
};

const subscribe = (notify: () => void) => {
    subscribers.add(notify);
    return () => subscribers.delete(notify);
};

export const useOutputRuns = (): readonly OutputRun[] => useSyncExternalStore(subscribe, () => snapshot);
