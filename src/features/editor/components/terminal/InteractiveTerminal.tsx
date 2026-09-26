import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import "@xterm/xterm/css/xterm.css";
import { buildFontFamilyCss } from "../../../settings";

interface InteractiveTerminalProps {
    projectName: string;
    fontFamily: string;
    active: boolean;
    height: number;
}

interface PtyData {
    id: string;
    data: string;
}

export const InteractiveTerminal = ({ projectName, fontFamily, active, height }: InteractiveTerminalProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const termRef = useRef<Terminal | null>(null);
    const fitRef = useRef<FitAddon | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        const term = new Terminal({
            cursorBlink: true,
            fontSize: 12,
            fontFamily: buildFontFamilyCss(fontFamily),
            allowTransparency: true,
            theme: {
                background: "#00000000",
                foreground: "#abb2bf",
                cursor: "#5865f2",
                selectionBackground: "#5865f233",
            },
        });
        const fit = new FitAddon();
        term.loadAddon(fit);
        term.open(containerRef.current);

        let rounded = false;
        try {
            const webgl = new WebglAddon();
            webgl.onContextLoss(() => webgl.dispose());
            term.loadAddon(webgl);
            rounded = true;
        } catch (error) {
            console.warn("WebGL no disponible para la terminal, se usa el renderizador normal:", error);
        }

        fit.fit();
        termRef.current = term;
        fitRef.current = fit;

        // Ctrl+C must stay SIGINT, so copy/paste use Ctrl+Shift+C/V (Cmd+C/V on macOS).
        term.attachCustomKeyEventHandler((e) => {
            if (e.type !== "keydown") return true;
            const modifier = (e.ctrlKey && e.shiftKey) || e.metaKey;
            const key = e.key.toLowerCase();
            if (modifier && key === "c" && term.hasSelection()) {
                navigator.clipboard.writeText(term.getSelection()).catch(() => {});
                return false;
            }
            if (modifier && key === "v") {
                navigator.clipboard.readText().then((text) => term.paste(text)).catch(() => {});
                return false;
            }
            return true;
        });

        let disposed = false;
        let id: string | null = null;
        const pendingData: PtyData[] = [];
        const unlisten: Array<() => void> = [];

        const handleData = (payload: PtyData) => {
            if (payload.id === id) term.write(payload.data);
        };

        (async () => {
            // Listen before opening: the shell prints its prompt right away, before we know the id.
            unlisten.push(await listen<PtyData>("pty-data", (event) => {
                if (id === null) pendingData.push(event.payload);
                else handleData(event.payload);
            }));
            unlisten.push(await listen<{ id: string }>("pty-exit", (event) => {
                if (event.payload.id !== id) return;
                term.writeln("\r\n\x1b[90m[el proceso de la terminal ha terminado]\x1b[0m");
                id = null;
            }));

            try {
                const opened = await invoke<string>("terminal_open", { projectName, cols: term.cols, rows: term.rows, rounded });
                if (disposed) {
                    invoke("terminal_close", { id: opened }).catch(() => {});
                    return;
                }
                id = opened;
                pendingData.forEach(handleData);
                pendingData.length = 0;
            } catch (error) {
                term.writeln(`\x1b[1;31m[!] No se pudo abrir la terminal: ${error}\x1b[0m`);
            }
        })();

        term.onData((data) => {
            if (id) invoke("terminal_write", { id, data }).catch(() => {});
        });
        term.onResize(({ cols, rows }) => {
            if (id) invoke("terminal_resize", { id, cols, rows }).catch(() => {});
        });

        const handleWindowResize = () => fit.fit();
        window.addEventListener("resize", handleWindowResize);

        return () => {
            disposed = true;
            window.removeEventListener("resize", handleWindowResize);
            unlisten.forEach((cleanup) => cleanup());
            if (id) invoke("terminal_close", { id }).catch(() => {});
            term.dispose();
            termRef.current = null;
            fitRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectName]);

    useEffect(() => {
        if (!termRef.current) return;
        termRef.current.options.fontFamily = buildFontFamilyCss(fontFamily);
        fitRef.current?.fit();
    }, [fontFamily]);

    useEffect(() => {
        if (!active) return;
        fitRef.current?.fit();
        termRef.current?.focus();
    }, [active, height]);

    return <div ref={containerRef} className="h-full w-full" />;
};
