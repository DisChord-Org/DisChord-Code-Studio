import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

import { Button, Title, WindowControls } from "../components/ui";
import { SystemMonitorRings } from "../features/system-monitor";
import { targetMeta, statusText } from "./Update.constants";
import { formatBytes } from "../utils/Bytes";

export type Phase =
    | "idle"
    | "checking"
    | "downloading"
    | "installing"
    | "up_to_date"
    | "done"
    | "error";

export type TargetKey = "ide" | "cli" | "compiler" | "node" | "pnpm";

interface UpdateProgressPayload {
    target: TargetKey;
    phase: Phase;
    percent?: number;
    current_bytes?: number;
    total_bytes?: number;
    version?: string;
    message?: string;
}

interface TargetState {
    phase: Phase;
    percent?: number;
    currentBytes?: number;
    totalBytes?: number;
    version?: string;
    message?: string;
}

interface UpdateRow {
    target: TargetKey;
    state: TargetState;
};

const targetOrder: TargetKey[] = ["ide", "cli", "compiler", "node", "pnpm"];
const settledPhases: Phase[] = ["up_to_date", "done", "error"];
const activePhases: Phase[] = ["checking", "downloading", "installing"];

const initialState = (): Record<TargetKey, TargetState> => ({
    ide: { phase: "idle" },
    cli: { phase: "idle" },
    compiler: { phase: "idle" },
    node: { phase: "idle" },
    pnpm: { phase: "idle" },
});

function toTargetState(p: UpdateProgressPayload): TargetState {
    return {
        phase: p.phase,
        percent: p.percent,
        currentBytes: p.current_bytes,
        totalBytes: p.total_bytes,
        version: p.version,
        message: p.message,
    };
}

const UpdateRow = ({ target, state }: UpdateRow) => {
    const meta = targetMeta[target];
    const isActive = activePhases.includes(state.phase);
    const isDone = state.phase === "done" || state.phase === "up_to_date";
    const isError = state.phase === "error";

    const barWidth = state.phase === "checking"
        ? 35
        : Math.max(state.percent ?? (state.phase === "installing" ? 100 : 4), 4);

    const statusColor = isError
        ? "text-red-400"
        : isDone
        ? "text-emerald-400"
        : isActive
        ? "text-accent-light"
        : "text-gray-500";

    const progressLabel = state.phase === "downloading" && state.totalBytes
        ? `${formatBytes(state.currentBytes ?? 0)} / ${formatBytes(state.totalBytes)}`
        : state.percent !== undefined
        ? `${Math.round(state.percent)}%`
        : "";

    return (
        <div className="group relative -mx-5 px-5 py-2.5 rounded-md hover:bg-white/[0.03] transition-colors overflow-hidden">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0 ml-1">
                    <i className={`bi ${meta.icon} text-sm shrink-0 transition-colors duration-300 ${statusColor}`}></i>
                    <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{meta.label}</p>
                        <p className="text-[11px] text-gray-600 truncate">{meta.desc}</p>
                    </div>
                    {state.version && (
                        <span className="text-[10px] text-gray-600 font-mono shrink-0">v{state.version}</span>
                    )}
                </div>

                <div className="flex items-center gap-3.5 shrink-0 mr-1">
                    {isActive && progressLabel && (
                        <span className="text-[10px] text-gray-600 font-mono">{progressLabel}</span>
                    )}
                    <span className={`text-[11px] font-medium ${statusColor}`}>
                        {statusText[state.phase]}
                    </span>
                    {isDone && (
                        <i className="bi bi-check-circle-fill text-emerald-400 text-sm animate-in zoom-in duration-300"></i>
                    )}
                    {isError && (
                        <i className="bi bi-exclamation-circle-fill text-red-400 text-sm animate-in zoom-in duration-300"></i>
                    )}
                </div>
            </div>

            {isError && state.message && (
                <p className="mt-1.5 text-[11px] text-red-400/80 truncate" title={state.message}>
                    {state.message}
                </p>
            )}

            {isActive && (
                <div className="absolute left-0 right-0 bottom-0 h-[2px] bg-white/5 animate-in fade-in duration-300">
                    <div
                        className={`relative h-full bg-accent overflow-hidden transition-all duration-500 ease-out ${
                            state.phase === "checking" || state.phase === "installing" ? "animate-pulse" : ""
                        }`}
                        style={{ width: `${barWidth}%` }}
                    >
                        <span className="progress-shimmer" />
                    </div>
                </div>
            )}
        </div>
    );
};

function Update() {
    const [states, setStates] = useState<Record<TargetKey, TargetState>>(initialState());
    const receivedLive = useRef<Set<TargetKey>>(new Set());

    useEffect(() => {
        invoke("mark_update_window_ready").catch((e) => console.error(e));
    }, []);

    useEffect(() => {
        let cancelled = false;
        let unlisten: (() => void) | undefined;

        (async () => {
            unlisten = await listen<UpdateProgressPayload>("update-progress", (event) => {
                const p = event.payload;
                receivedLive.current.add(p.target);
                setStates((prev) => ({ ...prev, [p.target]: toTargetState(p) }));
            });

            try {
                const snapshot = await invoke<UpdateProgressPayload[]>("get_update_state");
                if (cancelled) return;
                setStates((prev) => {
                    const next = { ...prev };
                    for (const p of snapshot) {
                        if (receivedLive.current.has(p.target)) continue;
                        next[p.target] = toTargetState(p);
                    }
                    return next;
                });
            } catch {
            }
        })();

        return () => {
            cancelled = true;
            unlisten?.();
        };
    }, []);

    const allSettled = targetOrder.every((k) => settledPhases.includes(states[k].phase));
    const hasError = targetOrder.some((k) => states[k].phase === "error");
    const ideInstalling = states.ide.phase === "installing";
    const ideNeedsRestart = states.ide.phase === "done";
    const nothingChanged =
        allSettled && !hasError && targetOrder.every((k) => states[k].phase !== "done");

    useEffect(() => {
        if (!nothingChanged) return;
        const timer = setTimeout(() => {
            getCurrentWindow().close();
        }, 1600);
        return () => clearTimeout(timer);
    }, [nothingChanged]);

    const [autoRestartSeconds, setAutoRestartSeconds] = useState<number | null>(null);

    const handleRelaunch = async () => {
        try {
            const { relaunch } = await import("@tauri-apps/plugin-process");
            await relaunch();
        } catch (e) {
            console.error("No se pudo reiniciar automáticamente:", e);
        }
    };

    useEffect(() => {
        if (ideNeedsRestart) {
            setAutoRestartSeconds(6);
        } else {
            setAutoRestartSeconds(null);
        }
    }, [ideNeedsRestart]);

    useEffect(() => {
        if (autoRestartSeconds === null) return;
        if (autoRestartSeconds <= 0) {
            handleRelaunch();
            return;
        }
        const timer = setTimeout(() => {
            setAutoRestartSeconds((s) => (s === null ? null : s - 1));
        }, 1000);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoRestartSeconds]);

    const handleClose = () => {
        getCurrentWindow().close();
    };

    const handleRetry = () => {
        setStates(initialState());
        receivedLive.current.clear();
        invoke("start_full_update").catch((e) => console.error(e));
    };

    const cancelAutoRestart = () => setAutoRestartSeconds(null);

    return (
        <div
            data-tauri-drag-region
            className="relative h-screen bg-app-bg p-10 overflow-hidden select-none flex flex-col"
        >
            <div className="absolute top-0 right-0 flex items-center h-10 z-50">
                <WindowControls
                    closeDisabled={ideInstalling}
                    closeTitle={ideInstalling ? "Espera a que termine la instalación del IDE" : "Cerrar"}
                />
            </div>

            <div className="mb-8 max-w-xl mx-auto w-full flex items-end justify-between gap-6">
                <div>
                    <Title>Actualizando DisChord</Title>
                    <p className="text-xs text-gray-500 -mt-4">
                        Comprobando el IDE, la CLI, el compilador y el entorno de ejecución. Esto puede tardar unos segundos.
                    </p>
                </div>

                <div className="shrink-0 pb-1">
                    <SystemMonitorRings size={52} />
                </div>
            </div>

            <div className="custom-scrollbar divide-y divide-white/[0.05] max-w-xl mx-auto w-full overflow-y-auto overflow-x-hidden">
                {targetOrder.map((key, i) => (
                    <div
                        key={key}
                        className="animate-in fade-in slide-in-from-bottom-1 duration-300"
                        style={{ animationDelay: `${i * 60}ms`, animationFillMode: "backwards" }}
                    >
                        <UpdateRow target={key} state={states[key]} />
                    </div>
                ))}
            </div>

            <div className="mt-auto pt-8 flex items-center justify-between max-w-xl mx-auto w-full">
                <span className="text-[10px] text-gray-600">
                    {hasError
                        ? "Hubo un problema con alguna actualización."
                        : autoRestartSeconds !== null
                        ? `El IDE se ha actualizado. Reiniciando en ${autoRestartSeconds}s…`
                        : allSettled
                        ? "Comprobación completada."
                        : "No cierres esta ventana todavía…"}
                </span>

                <div className="flex gap-2">
                    {hasError && (
                        <Button variant="ghost" className="text-xs" onClick={handleRetry}>
                            Reintentar
                        </Button>
                    )}
                    {ideNeedsRestart ? (
                        <>
                            {autoRestartSeconds !== null && (
                                <Button
                                    variant="ghost"
                                    className="text-xs animate-in fade-in duration-300"
                                    onClick={cancelAutoRestart}
                                >
                                    Más tarde
                                </Button>
                            )}
                            <Button
                                variant="primary"
                                className="text-xs animate-in fade-in duration-300"
                                onClick={handleRelaunch}
                            >
                                {autoRestartSeconds !== null
                                    ? `Reiniciar ahora (${autoRestartSeconds})`
                                    : "Reiniciar ahora"}
                            </Button>
                        </>
                    ) : allSettled ? (
                        <Button variant="secondary" className="text-xs" onClick={handleClose}>
                            Cerrar
                        </Button>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

export default Update;