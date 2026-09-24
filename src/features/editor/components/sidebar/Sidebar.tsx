import { useEffect, useState } from "react";
import type { FileNode } from "../../types";
import { invoke } from "@tauri-apps/api/core";

import { Modal, ContextMenu, Label, Tooltip } from "../../../../components/ui";
import { FileItem } from "./FileItem";
import { useResizablePanel } from "../../useResizablePanel";

interface SidebarProps {
    files: FileNode[];
    onFileClick: (node: FileNode) => void;
    projectName: string;
    onRefresh: () => void;
}

const expandedPathsStorageKey = (projectName: string) => `dischord:sidebar-expanded:${projectName}`;

const loadExpandedPaths = (projectName: string): Set<string> => {
    try {
        const raw = localStorage.getItem(expandedPathsStorageKey(projectName));
        if (raw) return new Set(JSON.parse(raw));
    } catch {
        // Ignore corrupt/inaccessible storage and fall back to the default below.
    }
    return new Set(["src"]);
};

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
    const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => loadExpandedPaths(projectName));
    const { size: width, startDrag } = useResizablePanel({ initialSize: 240, min: 160, max: 480, axis: "x" });

    useEffect(() => {
        setExpandedPaths(loadExpandedPaths(projectName));
    }, [projectName]);

    useEffect(() => {
        try {
            localStorage.setItem(expandedPathsStorageKey(projectName), JSON.stringify(Array.from(expandedPaths)));
        } catch {
            // Best-effort persistence; losing the expanded state isn't worth surfacing an error for.
        }
    }, [expandedPaths, projectName]);

    const toggleExpand = (path: string) => {
        setExpandedPaths(prev => {
            const next = new Set(prev);
            if (next.has(path)) next.delete(path);
            else next.add(path);
            return next;
        });
    };

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
        <aside className="bg-panel-alt shadow-[1px_0_3px_0_rgba(0,0,0,0.35)] flex flex-col shrink-0 select-none relative z-10" style={{ width }}>
            <div className="px-3 pt-3 pb-1.5">
                <Label>Explorador</Label>
            </div>

            <div className="group px-2 py-1 flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wide text-gray-300 truncate px-1">
                    {projectName}
                </span>
                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <Tooltip label="Nuevo archivo">
                        <button
                            onClick={() => openModal('file', '')}
                            className="text-gray-500 hover:text-accent p-0.5 rounded transition-colors"
                        >
                            <i className="bi bi-file-earmark-plus text-[13px]"></i>
                        </button>
                    </Tooltip>
                    <Tooltip label="Nueva carpeta">
                        <button
                            onClick={() => openModal('folder', '')}
                            className="text-gray-500 hover:text-accent p-0.5 rounded transition-colors"
                        >
                            <i className="bi bi-folder-plus text-[13px]"></i>
                        </button>
                    </Tooltip>
                    <Tooltip label="Actualizar">
                        <button
                            onClick={onRefresh}
                            className="text-gray-500 hover:text-accent p-0.5 rounded transition-colors"
                        >
                            <i className="bi bi-arrow-clockwise text-[13px]"></i>
                        </button>
                    </Tooltip>
                </div>
            </div>

            <div className="custom-scrollbar flex-1 overflow-y-auto pb-2">
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
                            expandedPaths={expandedPaths}
                            onToggleExpand={toggleExpand}
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

            <div
                onMouseDown={startDrag}
                className="absolute top-0 right-0 h-full w-1 cursor-col-resize hover:bg-accent/50 active:bg-accent transition-colors z-20"
            />
        </aside>
    );
};
