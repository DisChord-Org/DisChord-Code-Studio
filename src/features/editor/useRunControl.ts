import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { startOutputListener, beginRun, pushLine, endRun } from "./components/terminal/outputStore";

type TerminalTab = "output" | "shell";

// Gives the terminal time to show the output tab before the run starts.
const runStartDelayMs = 300;
// Gives the previous process time to exit before restarting.
const restartDelayMs = 400;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Run/stop/restart of the project plus the visibility state of the terminal panel. */
export const useRunControl = (projectName: string) => {
    const [isRunning, setIsRunning] = useState(false);
    const [showTerminal, setShowTerminal] = useState(false);
    const [terminalStartTab, setTerminalStartTab] = useState<TerminalTab>("shell");
    const [outputSignal, setOutputSignal] = useState(0);

    useEffect(() => {
        setShowTerminal(false);
    }, [projectName]);

    useEffect(() => {
        if (isRunning) {
            invoke("stop_chord_project").catch(console.error);
            setIsRunning(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectName]);

    useEffect(() => {
        startOutputListener();
        const unlisten = listen<{ type: string }>("terminal-output", (event) => {
            if (event.payload.type === "run_end") {
                setIsRunning(false);
            }
        });

        return () => {
            unlisten.then((cleanup) => cleanup());
        };
    }, []);

    const toggleShellTerminal = () => {
        if (!showTerminal) setTerminalStartTab("shell");
        setShowTerminal(!showTerminal);
    };

    const stopRun = async () => {
        try {
            await invoke("stop_chord_project");
            setIsRunning(false);
        } catch (e) { console.error(e); }
    };

    const startRun = () => {
        setTerminalStartTab("output");
        setOutputSignal((n) => n + 1);
        setShowTerminal(true);
        setIsRunning(true);
        beginRun();

        setTimeout(async () => {
            try {
                await invoke("run_chord_project", { projectName });
            } catch (e) {
                setIsRunning(false);
                console.error("Error al ejecutar:", e);
                pushLine("error", `No se pudo ejecutar: ${e}`);
                endRun("failed", null);
            }
        }, runStartDelayMs);
    };

    const toggleRun = async () => {
        if (isRunning) {
            await stopRun();
            return;
        }
        startRun();
    };

    const restartRun = async () => {
        await stopRun();
        await sleep(restartDelayMs);
        startRun();
    };

    return {
        isRunning,
        showTerminal,
        terminalStartTab,
        outputSignal,
        setShowTerminal,
        toggleShellTerminal,
        stopRun,
        toggleRun,
        restartRun,
    };
};
