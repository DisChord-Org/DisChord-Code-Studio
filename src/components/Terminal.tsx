import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm"
import { FitAddon } from "@xterm/addon-fit";
import { listen } from "@tauri-apps/api/event";
import "@xterm/xterm/css/xterm.css";

export const TerminalPanel = () => {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<Terminal | null>(null);

    useEffect(() => {
        if (!terminalRef.current) return;

        const term = new Terminal({
            cursorBlink: true,
            fontSize: 12,
            fontFamily: "'JetBrains Mono', monospace",
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

        const unlisten = listen<string>("terminal-data", (event) => {
            term.write(event.payload);
        });

        const handleResize = () => fitAddon.fit();
        window.addEventListener("resize", handleResize);

        return () => {
            window.removeEventListener("resize", handleResize);
            unlisten.then(f => f());
            term.dispose();
        };
    }, []);

    return (
        <div className="h-72 flex flex-col bg-[#0B0E14] border-t border-white/5 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between px-4 py-2 bg-[#0E1117]/50 backdrop-blur-sm border-b border-white/[0.02]">
                <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-white/10" />
                        <div className="w-2 h-2 rounded-full bg-white/10" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 select-none">
                        Terminal
                    </span>
                </div>
                
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => xtermRef.current?.clear()}
                        className="group flex items-center gap-1.5 text-[10px] font-medium text-gray-500 hover:text-[#5865F2] transition-all"
                    >
                        <i className="bi bi-trash3 text-xs opacity-50 group-hover:opacity-100"></i>
                        <span>LIMPIAR</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 p-3 overflow-hidden group">
                <div 
                    ref={terminalRef} 
                    className="h-full w-full opacity-90 group-hover:opacity-100 transition-opacity" 
                />
            </div>
        </div>
    );
};