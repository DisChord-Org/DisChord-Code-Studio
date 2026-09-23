import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow, LogicalSize, PhysicalPosition, PhysicalSize, currentMonitor } from "@tauri-apps/api/window";
import { emit, listen } from "@tauri-apps/api/event";
import type { CodeCanvasHandle, FileNode, MinimapViewport, OpenTab } from "./types";
import { PACKAGES_TAB_ID } from "./types";

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
        if (isRunning) {
            invoke("stop_chord_project").catch(console.error);
            setIsRunning(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectName]);

    useEffect(() => {
        const unlisten = listen<string>("terminal-data", (event) => {
            if (event.payload.includes("[!] Ejecución finalizada")) {
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
                if (document.activeElement?.closest(".cm-editor")) return;

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
        const maybeRefreshForGitignore = () => {
            if (activeTabPathRef.current !== ".gitignore") return;
            setTimeout(() => { refreshFiles(); }, 150);
        };

        const handleSaveEvent = () => maybeRefreshForGitignore();
        const handleKeydown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
                maybeRefreshForGitignore();
            }
        };

        window.addEventListener("dischord-save", handleSaveEvent);
        window.addEventListener("keydown", handleKeydown);
        return () => {
            window.removeEventListener("dischord-save", handleSaveEvent);
            window.removeEventListener("keydown", handleKeydown);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectName]);

    useEffect(() => {
        const handleCloseTab = (e: KeyboardEvent) => {
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
                return [...prev, {
                    kind: "file",
                    relative_path: node.relative_path,
                    name: node.name,
                    content: text,
                    isDirty: false,
                }];
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
            t.relative_path === activeTabPathRef.current ? { ...t, content: value, isDirty: true } : t
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

    const handleToggleRun = async () => {
        if (isRunning) {
            try {
                await invoke("stop_chord_project");
                setIsRunning(false);
            } catch (e) { console.error(e); }
            return;
        }

        setShowTerminal(true);
        setIsRunning(true);

        setTimeout(async () => {
            try {
                await invoke("run_chord_project", { projectName });
            } catch (e) {
                setIsRunning(false);
                console.error("Error al ejecutar:", e);
                emit("terminal-data", `\x1b[1;31m[!] No se pudo ejecutar: ${e}\x1b[0m\r\n`);
            }
        }, 300);
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
        codeCanvasRef,
        minimapViewport,
        setActiveTabPath,
        setShowTerminal,
        setMinimapViewport,
        handleFileSelect,
        openPackagesTab,
        closeTab,
        updateActiveTabContent,
        setActiveTabDirty,
        refreshFiles,
        handleToggleRun,
        handleBack,
        handleSwitchProject,
    };
};
