import { useState } from "react";
import { FileNode } from "../types";
import { invoke } from "@tauri-apps/api/core";

import { Modal } from "./Modal";

const FileItem = ({ node, level, onFileClick, onCreateRequest, onContextMenu }: { node: FileNode, level: number, onFileClick: (node: FileNode) => void, onCreateRequest: (type: 'file' | 'folder', path: string) => void, onContextMenu: (e: React.MouseEvent, path: string) => void }) => {
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
                onContextMenu={(e) => onContextMenu(e, node.relative_path)}
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
                            onContextMenu={onContextMenu}
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
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, path: string } | null>(null);

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

    const handleDelete = async (path: string) => {
        if (window.confirm(`¿Seguro que quieres borrar ${path}?`)) {
            try {
                await invoke("delete_item", { projectName, path });
                onRefresh();
            } catch (e) { alert(e); }
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
                        onContextMenu={(e, path) => {
                            e.preventDefault();
                            setContextMenu({ x: e.clientX, y: e.clientY, path });
                        }}
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

            {contextMenu && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
                        <div 
                            className="fixed z-50 bg-[#111214] border border-[#1e1f22] py-1 rounded shadow-xl min-w-[120px] animate-in fade-in zoom-in duration-75"
                            style={{ top: contextMenu.y, left: contextMenu.x }}
                        >
                            <button 
                                className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                                onClick={() => {
                                    handleDelete(contextMenu.path);
                                    setContextMenu(null);
                                }}
                            >
                                <i className="bi bi-trash"></i>
                                Borrar
                            </button>
                        </div>
                </>
            )}
        </aside>
    );
};