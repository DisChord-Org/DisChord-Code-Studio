import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileNode } from "../types";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";

import { Toolbar } from "../components/Toolbar";
import { Sidebar } from "../components/Sidebar";
import { CodeCanvas } from "../components/CodeCanvas";
import { CodeMinimap } from "../components/CodeMinimap";
import { TerminalPanel } from "../components/Terminal";
import { StatusBar } from "../components/StatusBar";

const appWindow = getCurrentWindow();

export const Editor = ({ projectName, onBack }: { projectName: string, onBack: () => void }) => {    
    const [fileTree, setFileTree] = useState<FileNode[]>([]);
    const [selectedNode, setSelectedNode] = useState<FileNode | null>(null);
    const [content, setContent] = useState<string>("");
    const [isRunning, setIsRunning] = useState(false);
    const [showTerminal, setShowTerminal] = useState(false);
    const [isDirty, setIsDirty] = useState(false);

    useEffect(() => {
        appWindow.setResizable(true);
        appWindow.maximize();

        invoke<FileNode[]>("read_project_files", { name: projectName })
            .then(setFileTree)
            .catch(console.error);
        
        return () => {
            appWindow.unmaximize();
            appWindow.setSize(new LogicalSize(800, 600));
            appWindow.center();
            appWindow.setResizable(false);
        };
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

    const handleFileSelect = async (node: FileNode) => {
        if (node.is_dir) return;

        try {
            setSelectedNode(node);
            
            const text = await invoke<string>("read_file_content", { 
                projectName,
                filePath: node.relative_path
            });
            setContent(text);
            setIsDirty(false);
        } catch (error) {
            console.error("Error al leer archivo:", error);
            setContent("Error al cargar el contenido del archivo.");
        }
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
            }
        }, 300);
    };

    return (
        <div className="h-screen bg-[#0B0E14] flex flex-col text-white overflow-hidden">
            <Toolbar
                projectName={projectName}
                onBack={onBack}
                onRun={handleToggleRun}
                isRunning={isRunning}
                onSave={() => {
                    window.dispatchEvent(new CustomEvent("dischord-save"));
                    setIsDirty(false);
                }}
            />

            <div className="flex flex-1 overflow-hidden relative">
                <Sidebar
                    files={fileTree}
                    onFileClick={handleFileSelect}
                    projectName={projectName}
                    onRefresh={refreshFiles}
                />

                <main className="flex-1 flex flex-col bg-[#0B0E14] overflow-hidden">
                    <div className="flex-1 min-h-0 relative overflow-hidden">
                        {selectedNode ? (
                            <div className="flex h-full">
                                <div className="flex-1 overflow-hidden">
                                    <CodeCanvas
                                        key={selectedNode.relative_path}
                                        projectName={projectName}
                                        relative_path={selectedNode.relative_path}
                                        fileName={selectedNode.name}
                                        content={content}
                                        isDirty={isDirty}
                                        setIsDirty={setIsDirty}
                                        onChange={(val) => {
                                            setContent(val);
                                            if (!isDirty) setIsDirty(true);
                                        }}
                                    />
                                </div>
                                <CodeMinimap text={content} />
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
                        <div className="h-72 shrink-0 flex flex-col border-t border-[#1e1f22] relative">
                            <TerminalPanel onClose={() => setShowTerminal(false)} />
                        </div>
                    )}

                    <div className="border-t border-[#1e1f22] shrink-0">
                        <StatusBar 
                            fileName={selectedNode?.name}
                            isDirty={isDirty}
                            contentLength={content.length}
                        />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default Editor;