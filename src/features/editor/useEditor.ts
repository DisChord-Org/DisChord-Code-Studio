import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow, LogicalSize, PhysicalPosition, PhysicalSize, currentMonitor } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import type { CodeCanvasHandle, FileNode, GotoTarget, MinimapViewport, OpenTab } from "./types";
import { PACKAGES_TAB_ID } from "./types";
import { startOutputListener, beginRun, pushLine, endRun } from "./components/terminal/outputStore";

const appWindow = getCurrentWindow();

let cachedPlatform: string | null = null;
const getPlatform = async () => {
    if (!cachedPlatform) cachedPlatform = await invoke<string>("get_platform");
    return cachedPlatform;
};

let windowOpQueue: Promise<void> = Promise.resolve();
const enqueueWindowOp = (op: () => Promise<void>) => {
    windowOpQueue = windowOpQueue.then(op, op);
    return windowOpQueue;
};

const isTerminalFocused = () => !!document.activeElement?.closest(".xterm");

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const maximizeReliably = async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
        await appWindow.maximize();
        await sleep(50);
        if (await appWindow.isMaximized()) return;
    }
};

interface UseEditorArgs {
    projectName: string;
    onBack: () => void;
    onSwitchProject?: (name: string) => void;
}

export const useEditor = ({ projectName, onBack, onSwitchProject }: UseEditorArgs) => {
    const [fileTree, setFileTree] = useState<FileNode[]>([]);
    const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
    const [activeTabPath, setActiveTabPath] = useState<string | null>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [showTerminal, setShowTerminal] = useState(false);
    const [terminalStartTab, setTerminalStartTab] = useState<"output" | "shell">("shell");
    const [outputSignal, setOutputSignal] = useState(0);
    const [isMaximized, setIsMaximized] = useState(true);
    const codeCanvasRef = useRef<CodeCanvasHandle>(null);
    const [minimapViewport, setMinimapViewport] = useState<MinimapViewport | undefined>(undefined);

    const openTabsRef = useRef<OpenTab[]>([]);
    const activeTabPathRef = useRef<string | null>(null);

    useEffect(() => {
        openTabsRef.current = openTabs;
    }, [openTabs]);

    useEffect(() => {
        activeTabPathRef.current = activeTabPath;
    }, [activeTabPath]);

    useEffect(() => {
        enqueueWindowOp(async () => {
            await appWindow.setResizable(true);

            const platform = await getPlatform();
            if (platform === "macos") {
                const monitor = await currentMonitor();
                if (!monitor) return;
                await appWindow.setPosition(new PhysicalPosition(monitor.position.x, monitor.position.y));
                await appWindow.setSize(new PhysicalSize(monitor.size.width, monitor.size.height));
            } else {
                await maximizeReliably();
            }
        });

        invoke<FileNode[]>("read_project_files", { name: projectName })
            .then(setFileTree)
            .catch(console.error);

        setOpenTabs([]);
        setActiveTabPath(null);
        setShowTerminal(false);

        return () => {
            enqueueWindowOp(async () => {
                const platform = await getPlatform();
                if (platform !== "macos") {
                    await appWindow.unmaximize();
                }

                const { width, height } = await invoke<{ width: number; height: number }>("get_home_window_size");
                await appWindow.setSize(new LogicalSize(width, height));
                await appWindow.center();
                await appWindow.setResizable(false);
            });
        };
    }, [projectName]);

    useEffect(() => {
        invoke("watch_project", { projectName }).catch(console.error);

        const unlisten = listen<string>("project-files-changed", (event) => {
            if (event.payload === projectName) refreshFiles();
        });

        return () => {
            unlisten.then((cleanup) => cleanup());
            invoke("unwatch_project").catch(console.error);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectName]);

    useEffect(() => {
        const syncIsMaximized = () => appWindow.isMaximized().then(setIsMaximized).catch(console.error);
        syncIsMaximized();

        const unlisten = appWindow.onResized(syncIsMaximized);
        return () => {
            unlisten.then((cleanup) => cleanup());
        };
    }, []);

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

    useEffect(() => {
        const handleOpenHidden = (event: any) => {
            const fileData = event.detail;
            handleFileSelect({
                name: fileData.name,
                relative_path: fileData.relative_path,
                is_dir: false
            } as FileNode);
        };

        window.addEventListener("open-hidden-file", handleOpenHidden);
        return () => window.removeEventListener("open-hidden-file", handleOpenHidden);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectName]);

    useEffect(() => {
        const triggerRun = (e: KeyboardEvent | CustomEvent) => {
            if (e instanceof KeyboardEvent) {
                if (document.activeElement?.closest(".cm-editor") || isTerminalFocused()) return;

                if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
                    e.preventDefault();
                    handleToggleRun();
                }
            } else {
                handleToggleRun();
            }
        };

        window.addEventListener("keydown", triggerRun as EventListener);
        window.addEventListener("dischord-run", triggerRun as EventListener);

        return () => {
            window.removeEventListener("keydown", triggerRun as EventListener);
            window.removeEventListener("dischord-run", triggerRun as EventListener);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isRunning, projectName]);

    useEffect(() => {
        const handleCloseTab = (e: KeyboardEvent) => {
            if (isTerminalFocused()) return;
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "w") {
                e.preventDefault();
                if (activeTabPathRef.current) closeTab(activeTabPathRef.current);
            }
        };

        window.addEventListener("keydown", handleCloseTab);
        return () => window.removeEventListener("keydown", handleCloseTab);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const handleSwitchTab = (e: KeyboardEvent) => {
            if (isTerminalFocused()) return;
            if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
            if (e.key < "1" || e.key > "9") return;

            const tab = openTabsRef.current[Number(e.key) - 1];
            if (!tab) return;

            e.preventDefault();
            setActiveTabPath(tab.relative_path);
        };

        window.addEventListener("keydown", handleSwitchTab);
        return () => window.removeEventListener("keydown", handleSwitchTab);
    }, []);

    const [gotoTarget, setGotoTarget] = useState<GotoTarget | null>(null);

    useEffect(() => {
        setGotoTarget(null);
    }, [activeTabPath]);

    const openFileAt = async (path: string, line: number, column: number) => {
        await handleFileSelect({ name: path.split("/").pop() ?? path, relative_path: path, is_dir: false } as FileNode);
        setGotoTarget({ path, line, column, nonce: Date.now() });
    };

    const handleFileSelect = async (node: FileNode) => {
        if (node.is_dir) return;

        setActiveTabPath(node.relative_path);

        if (openTabsRef.current.some(t => t.relative_path === node.relative_path)) return;

        try {
            const text = await invoke<string>("read_file_content", {
                projectName,
                filePath: node.relative_path
            });

            setOpenTabs(prev => {
                if (prev.some(t => t.relative_path === node.relative_path)) return prev;

                const newTab: OpenTab = {
                    kind: "file",
                    relative_path: node.relative_path,
                    name: node.name,
                    content: text,
                    isDirty: false,
                    isPinned: false,
                };

                const previewIndex = prev.findIndex(t => t.kind === "file" && !t.isPinned);
                if (previewIndex === -1) return [...prev, newTab];

                const next = [...prev];
                next[previewIndex] = newTab;
                return next;
            });
        } catch (error) {
            console.error("Error al leer archivo:", error);
        }
    };

    const openPackagesTab = () => {
        setActiveTabPath(PACKAGES_TAB_ID);

        if (openTabsRef.current.some(t => t.relative_path === PACKAGES_TAB_ID)) return;

        setOpenTabs(prev => {
            if (prev.some(t => t.relative_path === PACKAGES_TAB_ID)) return prev;
            return [...prev, {
                kind: "packages",
                relative_path: PACKAGES_TAB_ID,
                name: "Dependencias",
                content: "",
                isDirty: false,
                isPinned: true,
            }];
        });
    };

    const closeTab = (path: string) => {
        const tab = openTabsRef.current.find(t => t.relative_path === path);
        if (tab?.isDirty) {
            const confirmed = window.confirm(
                `Tienes cambios sin guardar en "${tab.name}". ¿Quieres cerrarlo de todos modos? Se perderán.`
            );
            if (!confirmed) return;
        }

        setOpenTabs(prev => {
            const idx = prev.findIndex(t => t.relative_path === path);
            const next = prev.filter(t => t.relative_path !== path);

            if (activeTabPathRef.current === path) {
                const fallback = next[idx] ?? next[idx - 1] ?? null;
                setActiveTabPath(fallback?.relative_path ?? null);
            }

            return next;
        });
    };

    const updateActiveTabContent = (value: string) => {
        setOpenTabs(prev => prev.map(t =>
            t.relative_path === activeTabPathRef.current ? { ...t, content: value, isDirty: true, isPinned: true } : t
        ));
    };

    const setActiveTabDirty = (value: boolean) => {
        setOpenTabs(prev => prev.map(t =>
            t.relative_path === activeTabPathRef.current ? { ...t, isDirty: value } : t
        ));
    };

    const refreshFiles = async () => {
        try {
            const updatedFiles = await invoke("read_project_files", { name: projectName });
            setFileTree(updatedFiles as FileNode[]);
        } catch (error) {
            console.error("Error al refrescar explorador:", error);
        }
    };

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
        }, 300);
    };

    const handleToggleRun = async () => {
        if (isRunning) {
            await stopRun();
            return;
        }
        startRun();
    };

    const handleStopRun = stopRun;

    const handleRestartRun = async () => {
        await stopRun();
        await sleep(400);
        startRun();
    };

    const confirmLeaveProject = (): boolean => {
        const dirtyTabs = openTabs.filter(t => t.isDirty);
        if (dirtyTabs.length === 0) return true;
        return window.confirm(
            dirtyTabs.length === 1
                ? `Tienes cambios sin guardar en "${dirtyTabs[0].name}". ¿Quieres salir de todos modos? Se perderán.`
                : `Tienes cambios sin guardar en ${dirtyTabs.length} ficheros. ¿Quieres salir de todos modos? Se perderán.`
        );
    };

    const handleBack = async () => {
        if (!confirmLeaveProject()) return;

        if (isRunning) {
            try {
                await invoke("stop_chord_project");
                setIsRunning(false);
            } catch (e) { console.error(e); }
        }

        onBack();
    };

    const handleSwitchProject = (name: string) => {
        if (name === projectName) return;
        if (!confirmLeaveProject()) return;
        if (!onSwitchProject) return;

        onSwitchProject(name);
    };

    const activeTab = openTabs.find(t => t.relative_path === activeTabPath) ?? null;

    return {
        fileTree,
        openTabs,
        activeTabPath,
        activeTab,
        isRunning,
        showTerminal,
        terminalStartTab,
        outputSignal,
        toggleShellTerminal,
        isMaximized,
        codeCanvasRef,
        minimapViewport,
        setActiveTabPath,
        setShowTerminal,
        setMinimapViewport,
        handleFileSelect,
        openFileAt,
        gotoTarget,
        openPackagesTab,
        closeTab,
        updateActiveTabContent,
        setActiveTabDirty,
        refreshFiles,
        handleToggleRun,
        handleStopRun,
        handleRestartRun,
        handleBack,
        handleSwitchProject,
    };
};
