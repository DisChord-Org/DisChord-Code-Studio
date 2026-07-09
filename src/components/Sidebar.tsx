import { useState } from "react";
import { FileNode } from "../types";
import { invoke } from "@tauri-apps/api/core";

import { Modal } from "./Modal";

const getFileIcon = (name: string): { icon: string; color: string } => {
    const ext = name.toLowerCase().split('.').pop() ?? '';
    switch (ext) {
        case 'json': return { icon: 'bi-filetype-json', color: '#cbcb41' };
        case 'mjs':
        case 'js': return { icon: 'bi-filetype-js', color: '#cbcb41' };
        case 'jsx': return { icon: 'bi-filetype-jsx', color: '#61dafb' };
        case 'ts': return { icon: 'bi-filetype-tsx', color: '#3178c6' };
        case 'tsx': return { icon: 'bi-filetype-tsx', color: '#3178c6' };
        case 'css': return { icon: 'bi-filetype-css', color: '#519aba' };
        case 'md': return { icon: 'bi-markdown', color: '#8c9491' };
        case 'yml':
        case 'yaml': return { icon: 'bi-filetype-yml', color: '#a0a0a0' };
        case 'gitignore': return { icon: 'bi-eye-slash', color: '#666666' };
        default: return { icon: 'bi-file-earmark-text', color: '#8c9491' };
    }
};

const FileItem = ({ node, level, onFileClick, onCreateRequest, onContextMenu, selectedPath, onSelect }: {
    node: FileNode,
    level: number,
    onFileClick: (node: FileNode) => void,
    onCreateRequest: (type: 'file' | 'folder', path: string) => void,
    onContextMenu: (e: React.MouseEvent, path: string) => void,
    selectedPath: string | null,
    onSelect: (path: string) => void
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const isChordFile = !node.is_dir && node.name.toLowerCase().endsWith('.chord');
    const isSelected = selectedPath === node.relative_path;

    const handleClick = () => {
        onSelect(node.relative_path);
        if (node.is_dir) setIsOpen(!isOpen);
        else onFileClick(node);
    };

    const fileIcon = !node.is_dir && !isChordFile ? getFileIcon(node.name) : null;

    return (
        <div>
            <div
                className={`group relative pr-2 py-0.5 text-[12px] cursor-pointer flex items-center justify-between gap-2 truncate transition-colors
                    ${isSelected ? "bg-[#5865F2]/10 text-white" : "text-gray-400 hover:bg-white/5 hover:text-gray-200"}
                `}
                style={{ paddingLeft: `${level * 10 + 8}px` }}
                onClick={handleClick}
                onContextMenu={(e) => onContextMenu(e, node.relative_path)}
            >
                {isSelected && (
                    <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#5865F2]" />
                )}

                <div className="flex items-center gap-1.5 truncate flex-1">
                    {node.is_dir ? (
                        <i className={`bi bi-chevron-right text-[8px] text-gray-600 transition-transform duration-150 shrink-0 ${isOpen ? "rotate-90" : ""}`} />
                    ) : (
                        <span className="w-[8px] shrink-0" />
                    )}

                    {node.is_dir
                        ? (isOpen
                            ? <i className="bi bi-folder2-open text-[#e8a87c] text-[12px]" />
                            : <i className="bi bi-folder-fill text-[#8f8f8f] text-[12px]" />)
                        : (isChordFile
                            ? <span className="text-[#5865F2] font-black text-[12px] w-[13px] text-center leading-none">D</span>
                            : <i className={`bi ${fileIcon!.icon} text-[12px]`} style={{ color: fileIcon!.color }} />)
                    }
                    <span className="truncate ml-1">{node.name}</span>
                </div>

                {node.is_dir && (
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                            onClick={(e) => { e.stopPropagation(); onCreateRequest('file', node.relative_path); }}
                            className="hover:text-[#5865F2] p-0.5 rounded transition-colors"
                            title="Nuevo archivo"
                        >
                            <i className="bi bi-file-earmark-plus text-[11px]"></i>
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onCreateRequest('folder', node.relative_path); }}
                            className="hover:text-[#5865F2] p-0.5 rounded transition-colors"
                            title="Nueva carpeta"
                        >
                            <i className="bi bi-folder-plus text-[11px]"></i>
                        </button>
                    </div>
                )}
            </div>

            {node.is_dir && isOpen && node.children && node.children.length > 0 && (
                <div className="ml-[13px] border-l border-white/[0.06]">
                    {node.children.map((child) => (
                        <FileItem
                            key={child.relative_path}
                            node={child}
                            level={level + 1}
                            onFileClick={onFileClick}
                            onCreateRequest={onCreateRequest}
                            onContextMenu={onContextMenu}
                            selectedPath={selectedPath}
                            onSelect={onSelect}
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
    const [selectedPath, setSelectedPath] = useState<string | null>(null);

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
            <div className="px-3 pt-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                Explorador
            </div>

            <div className="group px-2 py-1 flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wide text-gray-300 truncate px-1">
                    {projectName}
                </span>
                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                        onClick={() => openModal('file', '')}
                        className="text-gray-500 hover:text-[#5865F2] p-0.5 rounded transition-colors"
                        title="Nuevo archivo"
                    >
                        <i className="bi bi-file-earmark-plus text-[13px]"></i>
                    </button>
                    <button
                        onClick={() => openModal('folder', '')}
                        className="text-gray-500 hover:text-[#5865F2] p-0.5 rounded transition-colors"
                        title="Nueva carpeta"
                    >
                        <i className="bi bi-folder-plus text-[13px]"></i>
                    </button>
                    <button
                        onClick={onRefresh}
                        className="text-gray-500 hover:text-[#5865F2] p-0.5 rounded transition-colors"
                        title="Actualizar"
                    >
                        <i className="bi bi-arrow-clockwise text-[13px]"></i>
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto pb-2">
                {files.length === 0 ? (
                    <div className="text-[11px] text-gray-600 italic px-4 py-2">
                        No hay archivos todavía
                    </div>
                ) : (
                    files.map((file) => (
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
                            selectedPath={selectedPath}
                            onSelect={setSelectedPath}
                        />
                    ))
                )}
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
                        className="fixed z-50 bg-[#111214] border border-[#1e1f22] py-1 rounded shadow-xl min-w-[130px] animate-in fade-in zoom-in duration-75"
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