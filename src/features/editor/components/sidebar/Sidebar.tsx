import { useState } from "react";
import type { FileNode } from "../../types";
import { invoke } from "@tauri-apps/api/core";

import { Modal } from "../../../../components/ui/Modal";
import { ContextMenu } from "../../../../components/ui/ContextMenu";
import { FileItem } from "./FileItem";

interface SidebarProps {
    files: FileNode[];
    onFileClick: (node: FileNode) => void;
    projectName: string;
    onRefresh: () => void;
}

export const Sidebar = ({ files, onFileClick, projectName, onRefresh }: SidebarProps) => {
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
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={() => setContextMenu(null)}
                    items={[
                        {
                            label: "Borrar",
                            icon: "bi bi-trash",
                            variant: "danger",
                            onClick: () => handleDelete(contextMenu.path),
                        },
                    ]}
                />
            )}
        </aside>
    );
};
