import { useEffect, useRef, useState } from "react";
import { Tooltip } from "../../../../components/ui";
import { useConfig } from "../../../settings";
import { useResizablePanel } from "../../useResizablePanel";
import { InteractiveTerminal } from "./InteractiveTerminal";
import { useTerminalBackground } from "./useTerminalBackground";
import { RunOutput } from "./RunOutput";
import { clearOutput } from "./outputStore";

interface TerminalPanelProps {
    projectName: string;
    initialTab?: TerminalTab;
    outputSignal?: number;
    isRunning: boolean;
    onStop: () => void;
    onRestart: () => void;
    onOpenLocation: (path: string, line: number, column: number) => void;
    onClose: () => void;
}

type TerminalTab = "output" | "shell";

export const TerminalPanel = ({ projectName, initialTab = "shell", outputSignal = 0, isRunning, onStop, onRestart, onOpenLocation, onClose }: TerminalPanelProps) => {
    const { config } = useConfig();
    const backgroundUrl = useTerminalBackground(config);
    const [tab, setTab] = useState<TerminalTab>(initialTab);
    const showShell = config.advanced_mode && tab === "shell";

    // The two window-style dots become "stop" / "restart" once the program has been running for a moment.
    const [controlsArmed, setControlsArmed] = useState(false);
    useEffect(() => {
        if (!isRunning) {
            setControlsArmed(false);
            return;
        }
        const timer = setTimeout(() => setControlsArmed(true), 1000);
        return () => clearTimeout(timer);
    }, [isRunning]);
    const { size: height, startDrag } = useResizablePanel({ initialSize: 288, min: 120, max: 640, axis: "y", invert: true });

    const lastOutputSignal = useRef(outputSignal);
    useEffect(() => {
        if (outputSignal !== lastOutputSignal.current) {
            lastOutputSignal.current = outputSignal;
            setTab("output");
        }
    }, [outputSignal]);


    return (
        <div className="flex flex-col bg-app-bg border-t border-white/5 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.5)] relative shrink-0" style={{ height }}>
            <div
                onMouseDown={startDrag}
                className="absolute top-0 left-0 right-0 h-1 -translate-y-1/2 cursor-row-resize hover:bg-accent/50 active:bg-accent transition-colors z-20"
            />

            <div className="flex items-center justify-between px-4 py-2 bg-[#0E1117]/50 backdrop-blur-sm border-b border-white/[0.02]">
                <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                        {controlsArmed ? (
                            <>
                                <Tooltip label="Detener" placement="bottom">
                                    <button onClick={onStop} className="w-2 h-2 rounded-full bg-red-500 hover:bg-red-400 transition-colors" />
                                </Tooltip>
                                <Tooltip label="Reiniciar" placement="bottom">
                                    <button onClick={onRestart} className="w-2 h-2 rounded-full bg-amber-500 hover:bg-amber-400 transition-colors" />
                                </Tooltip>
                            </>
                        ) : (
                            <>
                                <div className="w-2 h-2 rounded-full bg-white/10" />
                                <div className="w-2 h-2 rounded-full bg-white/10" />
                            </>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        {(config.advanced_mode ? (["output", "shell"] as const) : (["output"] as const)).map((key) => (
                            <button
                                key={key}
                                onClick={() => setTab(key)}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest transition-colors ${
                                    (showShell ? "shell" : "output") === key ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"
                                }`}
                            >
                                {key === "output" ? "Salida" : "Terminal"}
                            </button>
                        ))}
                    </div>
                </div>
                
                <div className="flex items-center gap-4">
                    {!showShell && <button 
                        onClick={clearOutput}
                        className="group flex items-center gap-1.5 text-[10px] font-medium text-gray-500 hover:text-accent transition-all"
                    >
                        <i className="bi bi-trash3 text-xs opacity-50 group-hover:opacity-100"></i>
                        <span>LIMPIAR</span>
                    </button>}

                    {!showShell && <div className="w-[1px] h-3 bg-white/10" />}

                    <Tooltip label="Cerrar panel" placement="bottom">
                        <button
                            onClick={onClose}
                            className="text-gray-500 hover:text-white transition-colors flex items-center justify-center"
                        >
                            <i className="bi bi-x-lg text-sm"></i>
                        </button>
                    </Tooltip>
                </div>
            </div>

            <div className="flex-1 p-3 overflow-hidden relative bg-[#0B0E14]">
                {backgroundUrl && (
                    <>
                    <div
                        className="absolute inset-0 bg-no-repeat pointer-events-none"
                        style={{
                            backgroundImage: `url("${backgroundUrl}")`,
                            backgroundSize: config.terminal_background_fit,
                            backgroundPosition: config.terminal_background_fit === "contain" ? "right center" : "center",
                            imageRendering: "pixelated",
                        }}
                    />
                    <div
                        className="absolute inset-0 bg-[#0B0E14] pointer-events-none"
                        style={{ opacity: config.terminal_background_dim / 100 }}
                    />
                    </>
                )}
                <RunOutput onOpenLocation={onOpenLocation} className={`relative h-full w-full ${showShell ? "hidden" : ""}`} />
                {config.advanced_mode && (
                    <div className={`h-full w-full ${showShell ? "" : "hidden"}`}>
                        <InteractiveTerminal
                            projectName={projectName}
                            fontFamily={config.editor_font_family}
                            active={showShell}
                            height={height}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};