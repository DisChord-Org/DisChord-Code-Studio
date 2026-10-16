export type LineKind = "stdout" | "stderr" | "info" | "success" | "warning" | "error";

export type RunStatus = "running" | "finished" | "failed" | "stopped";

export type TerminalTab = "output" | "shell";

export type OpenLocationHandler = (path: string, line: number, column: number) => void;

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
    currentFile: string;
    lines: OutputLine[];
}

export type RunEndStatus = { state: "finished" | "stopped" } | { state: "failed"; code: number | null };

export type OutputEvent =
    | { type: "line"; kind: LineKind; text: string; ts: number; location?: OutputLocation }
    | { type: "run_end"; status: RunEndStatus; ts: number };

export type OutputItem = { type: "line"; line: OutputLine } | { type: "details"; id: number; lines: OutputLine[] };

export interface PtyData {
    id: string;
    data: string;
}

export interface PtyExit {
    id: string;
}
