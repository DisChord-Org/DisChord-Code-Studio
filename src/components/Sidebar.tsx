import { useState } from "react";
import { FileNode } from "../types";
import { invoke } from "@tauri-apps/api/core";

import { Modal } from "./Modal";

const FileItem = ({ node, level, onFileClick, onCreateRequest }: { node: FileNode, level: number, onFileClick: (node: FileNode) => void, onCreateRequest: (type: 'file' | 'folder', path: string) => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    const isChordFile = !node.is_dir && node.name.toLowerCase().endsWith('.chord');

    const handleClick = () => {
        if (node.is_dir) setIsOpen(!isOpen);
        else onFileClick(node);
    };

    return (
        <div>
            <div 
                className="group px-4 py-1.5 text-sm text-gray-400 hover:bg-white/5 hover:text-gray-200 cursor-pointer flex items-center justify-between gap-2 truncate"
                style={{ paddingLeft: `${level * 12 + 16}px` }}
                onClick={handleClick}
            >
                <div className="flex items-center gap-2 truncate">
                    {node.is_dir
                        ? (isOpen ? <i className="bi bi-folder2-open"></i> : <i className="bi bi-folder"></i>)
                        : (isChordFile ? <span className="text-[#5865F2] font-bold text-lg mr-4">D</span> : <i className="bi bi-file-text"></i>)
                    }
                    <span className="truncate">{node.name}</span>
                </div>

                {node.is_dir && (
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity pr-2">
                        <button 
                            onClick={(e) => { e.stopPropagation(); onCreateRequest('file', node.relative_path); }}
                            className="hover:text-[#5865F2] p-0.5 rounded transition-colors"
                        >
                            <i className="bi bi-file-earmark-plus text-[15px]"></i>
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); onCreateRequest('folder', node.relative_path); }}
                            className="hover:text-[#5865F2] p-0.5 rounded transition-colors"
                        >
                            <i className="bi bi-folder-plus"></i>
                        </button>
                    </div>
                )}
            </div>

            {node.is_dir && isOpen && node.children && (
                <div>
                    {node.children.map((child) => (
                        <FileItem
                            key={child.relative_path}
                            node={child}
                            level={level + 1}
                            onFileClick={onFileClick}
                            onCreateRequest={onCreateRequest}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export const Sidebar = ({ files, onFileClick, projectName, onRefresh }: { files: any[], onFileClick: (node: FileNode) => void, projectName: string, onRefresh: () => void }) => {
    const [modalState, setModalState] = useState<{
        isOpen: boolean,
        type: 'file' | 'folder',
        parentPath: string
    }>({
        isOpen: false,
        type: 'file',
        parentPath: ''
    });

    const openModal = (type: 'file' | 'folder', path: string) => {
        setModalState({ isOpen: true, type, parentPath: path });
    };

    const handleModalSubmit = async (name: string) => {
        const command = modalState.type === 'file' ? "create_new_file" : "create_new_folder";
        
        try {
            await invoke(command, {
                projectName: projectName,
                parentPath: modalState.parentPath,
                name: name
            });

            onRefresh();
            setModalState(prev => ({ ...prev, isOpen: false }));
        } catch (error) {
            alert("Error: " + error);
        }
    };

    return (
        <aside className="w-60 border-r border-[#1e1f22] bg-[#0B0E14] flex flex-col shrink-0 select-none">
            <div className="p-3 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                Explorador
            </div>
            <div className="flex-1 overflow-y-auto">
                {files.map((file) => (
                    <FileItem
                        key={file.relative_path}
                        node={file}
                        level={0}
                        onFileClick={onFileClick}
                        onCreateRequest={openModal}
                    />
                ))}
            </div>

            <Modal 
                isOpen={modalState.isOpen}
                title={modalState.type === 'file' ? "Nuevo Archivo" : "Nueva Carpeta"}
                placeholder={modalState.type === 'file' ? "index.chord" : "MiCarpeta"}
                confirmLabel="Crear"
                onClose={() => setModalState(prev => ({ ...prev, isOpen: false }))}
                onSubmit={handleModalSubmit}
            />
        </aside>
    );
};