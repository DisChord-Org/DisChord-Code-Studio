import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { emit, listen } from "@tauri-apps/api/event";

import {
    Toolbar,
    Sidebar,
    CodeCanvas,
    CodeMinimap,
    TerminalPanel,
    StatusBar,
    EditorScrollbar,
    TabBar,
    type FileNode,
    type CodeCanvasHandle,
    type MinimapViewport,
    type OpenTab,
} from "../features/editor";
import { PackageManager } from "../features/packages";

const appWindow = getCurrentWindow();

export const Editor = ({ projectName, onBack, onSwitchProject }: {
    projectName: string,
    onBack: () => void,
    onSwitchProject?: (name: string) => void
}) => {
    const [fileTree, setFileTree] = useState<FileNode[]>([]);
    const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
    const [activeTabPath, setActiveTabPath] = useState<string | null>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [showTerminal, setShowTerminal] = useState(false);
    const [showPackages, setShowPackages] = useState(false);
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
        (async () => {
            await appWindow.setResizable(true);
            await appWindow.maximize();
        })();

        invoke<FileNode[]>("read_project_files", { name: projectName })
            .then(setFileTree)
            .catch(console.error);

        setOpenTabs([]);
        setActiveTabPath(null);
        setShowTerminal(false);

        return () => {
            (async () => {
                await appWindow.unmaximize();
                await appWindow.setSize(new LogicalSize(800, 600));
                await appWindow.center();
                await appWindow.setResizable(false);
            })();
        };
    }, [projectName]);

    useEffect(() => {
        if (isRunning) {
            invoke("stop_chord_project").catch(console.error);
            setIsRunning(false);
        }
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

    return (
        <div className="h-screen bg-[#0B0E14] flex flex-col text-white overflow-hidden">
            <Toolbar
                projectName={projectName}
                onBack={handleBack}
                onRun={handleToggleRun}
                isRunning={isRunning}
                onSwitchProject={handleSwitchProject}
                onOpenPackages={() => setShowPackages(true)}
            />

            <PackageManager
                isOpen={showPackages}
                onClose={() => setShowPackages(false)}
                projectName={projectName}
            />

            <div className="flex flex-1 overflow-hidden relative">
                <Sidebar
                    files={fileTree}
                    onFileClick={handleFileSelect}
                    projectName={projectName}
                    onRefresh={refreshFiles}
                />

                <main className="flex-1 flex flex-col bg-[#0B0E14] overflow-hidden">
                    <TabBar
                        tabs={openTabs}
                        activePath={activeTabPath}
                        onSelect={setActiveTabPath}
                        onClose={closeTab}
                    />

                    <div className="flex-1 min-h-0 relative overflow-hidden">
                        {activeTab ? (
                            <div className="flex h-full">
                                <div className="flex-1 overflow-hidden">
                                    <CodeCanvas
                                        ref={codeCanvasRef}
                                        key={`${projectName}:${activeTab.relative_path}`}
                                        projectName={projectName}
                                        relative_path={activeTab.relative_path}
                                        fileName={activeTab.name}
                                        content={activeTab.content}
                                        setIsDirty={setActiveTabDirty}
                                        onChange={updateActiveTabContent}
                                        onViewportChange={setMinimapViewport}
                                    />
                                </div>
                                <CodeMinimap
                                    text={activeTab.content}
                                    viewport={minimapViewport}
                                    onScrollTo={(scrollTop) => codeCanvasRef.current?.scrollTo(scrollTop)}
                                />
                                <EditorScrollbar
                                    viewport={minimapViewport}
                                    onScrollTo={(scrollTop) => codeCanvasRef.current?.scrollTo(scrollTop)}
                                />
                            </div>
                        ) : (
                            <div className="h-full w-full bg-[radial-gradient(#1e1f22_1px,transparent_1px)] [background-size:20px_20px] flex flex-col items-center justify-center pointer-events-none">
                                <p className="text-[#1e1f22] font-black text-6xl uppercase tracking-tighter">
                                    DisChord
                                </p>
                            </div>
                        )}
                    </div>

                    {showTerminal && (
                        <div className="h-72 shrink-0 flex flex-col relative">
                            <TerminalPanel onClose={() => setShowTerminal(false)} />
                        </div>
                    )}

                    <StatusBar
                        fileName={activeTab?.name}
                        isDirty={activeTab?.isDirty ?? false}
                        contentLength={activeTab?.content.length ?? 0}
                    />
                </main>
            </div>
        </div>
    );
};

export default Editor;
