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
        <div className="h-64 border-t border-[#1e1f22] bg-[#0B0E14] p-2 overflow-hidden">
            <div className="flex items-center justify-between mb-1 px-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Terminal</span>
                <button 
                    onClick={() => xtermRef.current?.clear()}
                    className="text-gray-500 hover:text-white text-[10px]"
                >
                    LIMPIAR
                </button>
            </div>
            <div ref={terminalRef} className="h-full w-full" />
        </div>
    );
};