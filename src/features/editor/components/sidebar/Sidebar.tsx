import { useState } from "react";
import type { FileNode } from "../../types";

import { ContextMenu, Label } from "../../../../components/ui";
import { FileItem } from "./FileItem";
import { CreateRow } from "./CreateRow";
import { Outline } from "./Outline";
import { SidebarHeader } from "./SidebarHeader";
import { SidebarContext } from "./SidebarContext";
import { useExpandedPaths } from "./useExpandedPaths";
import { useFileOperations } from "./useFileOperations";
import { useSidebarDrag } from "./useSidebarDrag";
import { useTimedNotice } from "./useTimedNotice";
import { useResizablePanel } from "../../useResizablePanel";
import { parentPath } from "../../pathUtils";
import { matchesShortcut } from "../../../shortcuts";

interface SidebarProps {
    files: FileNode[];
    onFileClick: (node: FileNode) => void;
    projectName: string;
    onRefresh: () => void;
    onPathMoved: (from: string, to: string) => void;
    onPathDeleted: (path: string) => void;
    activeFilePath?: string;
    onJumpTo: (path: string, line: number, column: number) => void;
}

interface ContextMenuState {
    x: number;
    y: number;
    path: string;
}

export const Sidebar = ({ files, onFileClick, projectName, onRefresh, onPathMoved, onPathDeleted, activeFilePath, onJumpTo }: SidebarProps) => {
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
    const [selectedPath, setSelectedPath] = useState<string | null>(null);
    const { notice, setNotice } = useTimedNotice();
    const { size: width, startDrag } = useResizablePanel({ initialSize: 240, min: 160, max: 480, axis: "x" });
    const { expandedPaths, setExpandedPaths, expand, toggleExpand } = useExpandedPaths(projectName);

    const {
        creating, setCreating, renamingPath, setRenamingPath,
        startCreate, startRename, submitCreate, submitRename, moveInto, deleteItem,
    } = useFileOperations({ projectName, onFileClick, onRefresh, onPathMoved, onPathDeleted, expand, setExpandedPaths, setSelectedPath, setNotice });

    const { dragPath, dropTarget, setDropTarget, setDragPath, clearDrag, hoverTarget, dropInto } = useSidebarDrag({ expandedPaths, expand, moveInto });

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

                <SidebarHeader projectName={projectName} onCreate={(type) => startCreate(type, "")} onRefresh={onRefresh} />

                {notice && (
                    <div className="mx-2 mb-1 px-2 py-1 text-[10px] leading-snug text-red-200 bg-red-950/70 border border-red-500/40 rounded">
                        {notice}
                    </div>
                )}

                <div
                    role="tree"
                    aria-label="Explorador de archivos"
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (matchesShortcut(e.nativeEvent, "explorer.rename") && selectedPath && !renamingPath) {
                            e.preventDefault();
                            startRename(selectedPath);
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

                {activeFilePath?.toLowerCase().endsWith(".chord") && (
                    <Outline path={activeFilePath} onJump={(line, column) => onJumpTo(activeFilePath, line, column)} />
                )}

                {contextMenu && (
                    <ContextMenu
                        x={contextMenu.x}
                        y={contextMenu.y}
                        onClose={() => setContextMenu(null)}
                        items={[
                            {
                                label: "Renombrar",
                                icon: "bi bi-pencil",
                                onClick: () => startRename(contextMenu.path),
                            },
                            {
                                label: "Borrar",
                                icon: "bi bi-trash",
                                variant: "danger",
                                onClick: () => deleteItem(contextMenu.path),
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
