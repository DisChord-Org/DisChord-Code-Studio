import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

import { Button } from "../components/Button";
import { Title } from "../components/Typography";
import { SystemMonitorRings } from "../components/SystemMonitorRings";

type Phase =
    | "idle"
    | "checking"
    | "downloading"
    | "installing"
    | "up_to_date"
    | "done"
    | "error";

type TargetKey = "ide" | "cli" | "compiler";

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

const TARGET_ORDER: TargetKey[] = ["ide", "cli", "compiler"];
const SETTLED_PHASES: Phase[] = ["up_to_date", "done", "error"];
const ACTIVE_PHASES: Phase[] = ["checking", "downloading", "installing"];

const TARGET_META: Record<TargetKey, { label: string; icon: string; desc: string }> = {
    ide: { label: "DisChord Code Studio", icon: "bi-window-stack", desc: "El propio editor de código" },
    cli: { label: "DisChord CLI", icon: "bi-terminal-fill", desc: "Herramienta de línea de comandos" },
    compiler: { label: "Compilador", icon: "bi-cpu-fill", desc: "DisChord en su nivel más bajo" },
};

const STATUS_TEXT: Record<Phase, string> = {
    idle: "En espera",
    checking: "Comprobando…",
    downloading: "Descargando…",
    installing: "Instalando…",
    up_to_date: "Al día",
    done: "Actualizado",
    error: "Error",
};

const initialState = (): Record<TargetKey, TargetState> => ({
    ide: { phase: "idle" },
    cli: { phase: "idle" },
    compiler: { phase: "idle" },
});

function formatBytes(bytes: number): string {
    if (!bytes || bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    const value = bytes / Math.pow(1024, i);
    return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

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

const UpdateRow = ({ target, state }: { target: TargetKey; state: TargetState }) => {
    const meta = TARGET_META[target];
    const isActive = ACTIVE_PHASES.includes(state.phase);
    const isDone = state.phase === "done" || state.phase === "up_to_date";
    const isError = state.phase === "error";

    const accent = isError
        ? "bg-red-500"
        : isDone
        ? "bg-emerald-500"
        : isActive
        ? "bg-[#5865F2]"
        : "bg-gray-700";

    const barWidth = state.phase === "checking"
        ? 35
        : Math.max(state.percent ?? (state.phase === "installing" ? 100 : 4), 4);

    return (
        <div className="relative bg-white/[0.02] border border-white/[0.06] rounded-lg p-4 pl-5 overflow-hidden transition-colors duration-300 hover:border-white/[0.1]">
            <span className={`absolute left-0 top-0 bottom-0 w-[3px] transition-colors duration-500 ${accent}`} />

            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div
                        className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 transition-colors duration-300 ${
                            isError
                                ? "bg-red-500/10 text-red-400"
                                : isDone
                                ? "bg-emerald-500/10 text-emerald-400"
                                : "bg-white/5 text-gray-400"
                        }`}
                    >
                        <i className={`bi ${meta.icon} text-sm`}></i>
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{meta.label}</p>
                        <p className="text-[11px] text-gray-500 truncate">{meta.desc}</p>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                    {isDone && (
                        <i className="bi bi-check-circle-fill text-emerald-400 text-sm animate-in zoom-in duration-300"></i>
                    )}
                    {isError && (
                        <i className="bi bi-exclamation-circle-fill text-red-400 text-sm animate-in zoom-in duration-300"></i>
                    )}
                    <span
                        className={`text-[11px] font-medium ${
                            isError
                                ? "text-red-400"
                                : isDone
                                ? "text-emerald-400"
                                : isActive
                                ? "text-[#8992f5]"
                                : "text-gray-500"
                        }`}
                    >
                        {STATUS_TEXT[state.phase]}
                    </span>
                </div>
            </div>

            {isActive && (
                <div className="mt-3 animate-in fade-in duration-300">
                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full bg-[#5865F2] transition-all duration-500 ease-out ${
                                state.phase === "checking" || state.phase === "installing" ? "animate-pulse" : ""
                            }`}
                            style={{ width: `${barWidth}%` }}
                        />
                    </div>
                    <div className="flex justify-between mt-1.5">
                        <span className="text-[10px] text-gray-600">
                            {state.version ? `v${state.version}` : ""}
                        </span>
                        <span className="text-[10px] text-gray-600 font-mono">
                            {state.phase === "downloading" && state.totalBytes
                                ? `${formatBytes(state.currentBytes ?? 0)} / ${formatBytes(state.totalBytes)}`
                                : state.percent !== undefined
                                ? `${Math.round(state.percent)}%`
                                : ""}
                        </span>
                    </div>
                </div>
            )}

            {isError && state.message && (
                <p className="mt-2 text-[11px] text-red-400/80 truncate" title={state.message}>
                    {state.message}
                </p>
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

    const allSettled = TARGET_ORDER.every((k) => SETTLED_PHASES.includes(states[k].phase));
    const hasError = TARGET_ORDER.some((k) => states[k].phase === "error");
    const ideInstalling = states.ide.phase === "installing";
    const ideNeedsRestart = states.ide.phase === "done";
    const nothingChanged =
        allSettled && !hasError && TARGET_ORDER.every((k) => states[k].phase !== "done");

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

    const handleMinimize = async () => {
        await getCurrentWindow().minimize();
    };

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
            className="relative min-h-screen bg-[#0B0E14] rounded-xl border border-[#1e1f22] p-10 overflow-hidden select-none flex flex-col"
        >
            <div className="absolute top-0 right-0 flex items-center h-10 z-50">
                <button
                    onClick={handleMinimize}
                    className="w-10 h-10 flex items-center justify-center hover:bg-white/5 text-gray-400 transition-colors"
                >
                    <i className="bi bi-dash-lg text-lg"></i>
                </button>
                <button
                    onClick={handleClose}
                    disabled={ideInstalling}
                    title={ideInstalling ? "Espera a que termine la instalación del IDE" : "Cerrar"}
                    className={`w-10 h-10 flex items-center justify-center transition-colors ${
                        ideInstalling
                            ? "text-gray-700 cursor-not-allowed"
                            : "hover:bg-red-500 hover:text-white text-gray-400"
                    }`}
                >
                    <i className="bi bi-x-lg"></i>
                </button>
            </div>

            <div className="mb-8 max-w-xl mx-auto w-full">
                <Title>Actualizando DisChord</Title>
                <p className="text-xs text-gray-500 -mt-4">
                    Comprobando el IDE, la CLI y el compilador. Esto puede tardar unos segundos.
                </p>
            </div>

            <div className="flex flex-col gap-3 max-w-xl mx-auto w-full">
                {TARGET_ORDER.map((key, i) => (
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

                <div className="absolute bottom-4 right-6 select-none">
                    <SystemMonitorRings size={40} />
                </div>
            </div>
        </div>
    );
}

export default Update;