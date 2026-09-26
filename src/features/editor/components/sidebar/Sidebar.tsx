import { useEffect, useRef, useState } from "react";
import type { FileNode } from "../../types";
import { invoke } from "@tauri-apps/api/core";

import { ContextMenu, Label, Tooltip } from "../../../../components/ui";
import { FileItem, CreateRow } from "./FileItem";
import { SidebarContext } from "./SidebarContext";
import { useResizablePanel } from "../../useResizablePanel";
import { canMoveInto, isSameOrInside, joinPath, parentPath, remapPath } from "../../pathUtils";
import { confirmAction } from "../../../../utils/Dialogs";

interface SidebarProps {
    files: FileNode[];
    onFileClick: (node: FileNode) => void;
    projectName: string;
    onRefresh: () => void;
    /** Called after an item was renamed or moved, so open tabs can follow it. */
    onPathMoved: (from: string, to: string) => void;
    /** Called after an item was deleted, so its open tabs can be closed. */
    onPathDeleted: (path: string) => void;
}

// How long a dragged item must rest on a closed folder before it opens.
const autoExpandDelayMs = 600;

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

export const Sidebar = ({ files, onFileClick, projectName, onRefresh, onPathMoved, onPathDeleted }: SidebarProps) => {
    const [creating, setCreating] = useState<{ type: "file" | "folder"; parentPath: string } | null>(null);
    const [renamingPath, setRenamingPath] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, path: string } | null>(null);
    const [selectedPath, setSelectedPath] = useState<string | null>(null);
    const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => loadExpandedPaths(projectName));
    const [dragPath, setDragPath] = useState<string | null>(null);
    const [dropTarget, setDropTarget] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const expandTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

    useEffect(() => {
        if (!notice) return;
        const timer = setTimeout(() => setNotice(null), 4000);
        return () => clearTimeout(timer);
    }, [notice]);

    const expand = (path: string) => setExpandedPaths(prev => (prev.has(path) ? prev : new Set(prev).add(path)));

    const toggleExpand = (path: string) => {
        setExpandedPaths(prev => {
            const next = new Set(prev);
            if (next.has(path)) next.delete(path);
            else next.add(path);
            return next;
        });
    };

    const startCreate = (type: "file" | "folder", parentPath: string) => {
        setRenamingPath(null);
        if (parentPath) expand(parentPath);
        setCreating({ type, parentPath });
    };

    /** Resolves to an error message, or null when it worked. */
    const submitCreate = async (name: string): Promise<string | null> => {
        if (!creating) return null;

        try {
            await invoke(creating.type === "file" ? "create_new_file" : "create_new_folder", {
                projectName,
                parentPath: creating.parentPath,
                name,
            });
        } catch (error) {
            return String(error);
        }

        const created = joinPath(creating.parentPath, name);
        const wasFile = creating.type === "file";
        setCreating(null);
        setSelectedPath(created);
        onRefresh();
        if (wasFile) onFileClick({ name, relative_path: created, is_dir: false });
        return null;
    };

    const relocated = (from: string, to: string) => {
        setSelectedPath(prev => (prev ? remapPath(prev, from, to) : prev));
        setExpandedPaths(prev => new Set(Array.from(prev, path => remapPath(path, from, to))));
        onPathMoved(from, to);
        onRefresh();
    };

    const submitRename = async (path: string, name: string): Promise<string | null> => {
        try {
            const moved = await invoke<string>("rename_item", { projectName, path, newName: name });
            setRenamingPath(null);
            relocated(path, moved);
            return null;
        } catch (error) {
            return String(error);
        }
    };

    const moveInto = async (path: string, targetDir: string) => {
        try {
            const moved = await invoke<string>("move_item", { projectName, path, targetDir });
            if (targetDir) expand(targetDir);
            relocated(path, moved);
        } catch (error) {
            setNotice(String(error));
        }
    };

    const clearDrag = () => {
        if (expandTimer.current) clearTimeout(expandTimer.current);
        expandTimer.current = null;
        setDragPath(null);
        setDropTarget(null);
    };

    const hoverTarget = (targetDir: string, openable: FileNode | null, e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (dragPath === null || !canMoveInto(dragPath, targetDir)) {
            e.dataTransfer.dropEffect = "none";
            setDropTarget(null);
            return;
        }

        e.dataTransfer.dropEffect = "move";
        if (dropTarget !== targetDir) {
            setDropTarget(targetDir);
            if (expandTimer.current) clearTimeout(expandTimer.current);
            expandTimer.current = null;
            if (openable && !expandedPaths.has(openable.relative_path)) {
                expandTimer.current = setTimeout(() => expand(openable.relative_path), autoExpandDelayMs);
            }
        }
    };

    const dropInto = async (targetDir: string, e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const path = dragPath;
        clearDrag();
        if (path !== null && canMoveInto(path, targetDir)) await moveInto(path, targetDir);
    };

    const handleDelete = async (path: string) => {
        if (await confirmAction(`¿Seguro que quieres borrar ${path}?`, "Borrar")) {
            try {
                await invoke("delete_item", { projectName, path });
                setSelectedPath(prev => (prev !== null && isSameOrInside(prev, path) ? null : prev));
                onPathDeleted(path);
                onRefresh();
            } catch (e) { setNotice(String(e)); }
        }
    };

    return (
        <SidebarContext.Provider
            value={{
                selectedPath,
                onSelect: setSelectedPath,
                expandedPaths,
                onToggleExpand: toggleExpand,
                onFileClick,
                onContextMenu: (e, path) => {
                    e.preventDefault();
                    setSelectedPath(path);
                    setContextMenu({ x: e.clientX, y: e.clientY, path });
                },
                onCreateRequest: startCreate,
                creating,
                onCreateSubmit: submitCreate,
                onCreateCancel: () => setCreating(null),
                renamingPath,
                onRenameSubmit: submitRename,
                onRenameCancel: () => setRenamingPath(null),
                dragPath,
                dropTarget,
                onDragStart: (path) => { setCreating(null); setDragPath(path); },
                onDragEnd: clearDrag,
                onDragOverItem: (node, e) => hoverTarget(node.is_dir ? node.relative_path : parentPath(node.relative_path), node.is_dir ? node : null, e),
                onDropOnItem: (node, e) => dropInto(node.is_dir ? node.relative_path : parentPath(node.relative_path), e),
            }}
        >
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
                                onClick={() => startCreate('file', '')}
                                className="text-gray-500 hover:text-accent p-0.5 rounded transition-colors"
                            >
                                <i className="bi bi-file-earmark-plus text-[13px]"></i>
                            </button>
                        </Tooltip>
                        <Tooltip label="Nueva carpeta">
                            <button
                                onClick={() => startCreate('folder', '')}
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

                {notice && (
                    <div className="mx-2 mb-1 px-2 py-1 text-[10px] leading-snug text-red-200 bg-red-950/70 border border-red-500/40 rounded">
                        {notice}
                    </div>
                )}

                <div
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === "F2" && selectedPath && !renamingPath) {
                            e.preventDefault();
                            setCreating(null);
                            setRenamingPath(selectedPath);
                        }
                    }}
                    onDragOver={(e) => hoverTarget("", null, e)}
                    onDrop={(e) => dropInto("", e)}
                    onDragLeave={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropTarget(null);
                    }}
                    className={`custom-scrollbar flex-1 overflow-y-auto pb-2 outline-none transition-colors ${dropTarget === "" ? "bg-accent/10" : ""}`}
                >
                    {creating?.parentPath === "" && <CreateRow level={0} />}

                    {files.length === 0 && !creating ? (
                        <div className="text-[11px] text-gray-600 italic px-4 py-2">
                            No hay archivos todavía
                        </div>
                    ) : (
                        files.map((file) => <FileItem key={file.relative_path} node={file} level={0} />)
                    )}
                </div>

                {contextMenu && (
                    <ContextMenu
                        x={contextMenu.x}
                        y={contextMenu.y}
                        onClose={() => setContextMenu(null)}
                        items={[
                            {
                                label: "Renombrar",
                                icon: "bi bi-pencil",
                                onClick: () => {
                                    setCreating(null);
                                    setRenamingPath(contextMenu.path);
                                },
                            },
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
        </SidebarContext.Provider>
    );
};
