import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Toolbar } from "../components/Toolbar";
import { Sidebar } from "../components/Sidebar";
import { CodeCanvas } from "../components/CodeCanvas";

export const Editor = ({ projectName, onBack }: { projectName: string, onBack: () => void }) => {
    const [fileTree, setFileTree] = useState<string[]>([]);
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [content, setContent] = useState<string>("");

    useEffect(() => {
        invoke<string[]>("read_project_files", { name: projectName })
            .then(setFileTree)
            .catch(console.error);
    }, [projectName]);

    const handleFileSelect = async (node: any) => {
        try {
            setSelectedFile(node.name);
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

    return (
        <div className="h-screen bg-[#0B0E14] flex flex-col text-white overflow-hidden">
            <Toolbar projectName={projectName} onBack={onBack} />

            <div className="flex flex-1 overflow-hidden">
                <Sidebar
                    files={fileTree}
                    onFileClick={handleFileSelect}
                />

                {/* CANVAS */}
                <main className="flex-1 flex flex-col bg-[#0B0E14]">
                    {selectedFile ? (
                        <CodeCanvas 
                            fileName={selectedFile} 
                            content={content} 
                            onChange={setContent} 
                        />
                    ) : (
                        /* pantalla de bienvenida */
                        <div className="flex-1 relative bg-[radial-gradient(#1e1f22_1px,transparent_1px)] [background-size:20px_20px]">
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <p className="text-[#1e1f22] font-black text-6xl uppercase tracking-tighter">
                                    DisChord
                                </p>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default Editor;