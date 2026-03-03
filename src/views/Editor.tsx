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

const appWindow = getCurrentWindow();

export const Editor = ({ projectName, onBack }: { projectName: string, onBack: () => void }) => {    
    const [fileTree, setFileTree] = useState<FileNode[]>([]);
    const [selectedNode, setSelectedNode] = useState<FileNode | null>(null);
    const [content, setContent] = useState<string>("");
    const [isRunning, setIsRunning] = useState(false);
    const [showTerminal, setShowTerminal] = useState(false);

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

    const handleFileSelect = async (node: FileNode) => {
        if (node.is_dir) return;

        try {
            setSelectedNode(node);
            
            const text = await invoke<string>("read_file_content", { 
                projectName,
                filePath: node.relative_path
            });
            setContent(text);
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
        } else {
            setShowTerminal(true);
            setIsRunning(true);

            setTimeout(async () => {
                try {
                    await invoke("run_chord_project", { projectName });
                } catch (e) {
                    setIsRunning(false);
                    console.error(e);
                }
            }, 200);
        }
    };

    return (
        <div className="h-screen bg-[#0B0E14] flex flex-col text-white overflow-hidden">
            <Toolbar projectName={projectName} onBack={onBack} onRun={handleToggleRun} isRunning={isRunning} />

            <div className="flex flex-1 overflow-hidden relative">
                <Sidebar
                    files={fileTree}
                    onFileClick={handleFileSelect}
                    projectName={projectName}
                    onRefresh={refreshFiles}
                />

                <main className="flex-1 flex flex-col bg-[#0B0E14] overflow-hidden">
                    {selectedNode ? (
                        <div className="flex-1 min-h-0 relative">
                            <div className="flex h-full">
                                <div className="flex-1 overflow-hidden">
                                    <CodeCanvas
                                        key={selectedNode.relative_path}
                                        projectName={projectName}
                                        relative_path={selectedNode.relative_path}
                                        fileName={selectedNode.name}
                                        content={content}
                                        onChange={setContent}
                                    />
                                </div>
                                <CodeMinimap text={content} />
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 relative bg-[radial-gradient(#1e1f22_1px,transparent_1px)] [background-size:20px_20px]">
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <p className="text-[#1e1f22] font-black text-6xl uppercase tracking-tighter">
                                    DisChord
                                </p>
                            </div>
                        </div>
                    )}

                    {/* terminal */}
                    {showTerminal && (
                        <div className="h-72 flex flex-col">
                            {/* Cabecera para cerrar la terminal */}
                            <div className="flex justify-end bg-[#0B0E14] border-t border-[#1e1f22] px-2 py-1">
                                <button 
                                    onClick={() => setShowTerminal(false)}
                                    className="text-gray-500 hover:text-white"
                                >
                                    <i className="bi bi-x-lg text-xs"></i>
                                </button>
                            </div>
                            <TerminalPanel />
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default Editor;