import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm"
import { FitAddon } from "@xterm/addon-fit";
import { listen } from "@tauri-apps/api/event";
import "@xterm/xterm/css/xterm.css";
import { Tooltip } from "../../../../components/ui";
import { useConfig, buildFontFamilyCss } from "../../../settings";
import { useResizablePanel } from "../../useResizablePanel";
import { InteractiveTerminal } from "./InteractiveTerminal";

interface TerminalPanelProps {
    projectName: string;
    initialTab?: TerminalTab;
    outputSignal?: number;
    isRunning: boolean;
    onStop: () => void;
    onRestart: () => void;
    onClose: () => void;
}

type TerminalTab = "output" | "shell";

export const TerminalPanel = ({ projectName, initialTab = "shell", outputSignal = 0, isRunning, onStop, onRestart, onClose }: TerminalPanelProps) => {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const { config } = useConfig();
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

    useEffect(() => {
        if (!terminalRef.current) return;

        const term = new Terminal({
            cursorBlink: true,
            fontSize: 12,
            fontFamily: buildFontFamilyCss(config.editor_font_family),
            theme: {
                background: "#0B0E14",
                foreground: "#abb2bf",
                cursor: "#5865f2",
                selectionBackground: "#5865f233",
            },
            convertEol: true,
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(terminalRef.current);
        fitAddon.fit();

        term.writeln("\x1b[1;34m[*] Terminal DisChord lista...\x1b[0m");
        xtermRef.current = term;
        fitAddonRef.current = fitAddon;

        const unlisten = listen<string>("terminal-data", (event) => {
            term.write(event.payload);
        });

        const handleResize = () => fitAddon.fit();
        window.addEventListener("resize", handleResize);

        return () => {
            window.removeEventListener("resize", handleResize);
            unlisten.then(f => f());
            term.dispose();
            xtermRef.current = null;
            fitAddonRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!xtermRef.current) return;
        xtermRef.current.options.fontFamily = buildFontFamilyCss(config.editor_font_family);
        fitAddonRef.current?.fit();
    }, [config.editor_font_family]);

    useEffect(() => {
        fitAddonRef.current?.fit();
    }, [height, showShell]);

    // "Ejecutar" should always reveal its output, even if the panel is already open on the shell tab.
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
                        onClick={() => xtermRef.current?.clear()}
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

            <div className="flex-1 p-3 overflow-hidden group relative">
                <div
                    ref={terminalRef}
                    className={`h-full w-full opacity-90 group-hover:opacity-100 transition-opacity ${showShell ? "hidden" : ""}`}
                />
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