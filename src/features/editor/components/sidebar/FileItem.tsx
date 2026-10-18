import type { FileNode } from "../../types";
import { NameInput } from "./NameInput";
import { CreateRow } from "./CreateRow";
import { CreateButtons } from "./CreateButtons";
import { useEffect, useState } from "react";
import { useSidebar } from "./SidebarContext";
import { FileIcon, FolderIcon } from "../FileIcon";

interface FileItemProps {
    node: FileNode;
    level: number;
}

export const FileItem = ({ node, level }: FileItemProps) => {
    const {
        selectedPath, onSelect, expandedPaths, onToggleExpand, onFileClick, onContextMenu, onCreateRequest,
        creating, renamingPath, onRenameSubmit, onRenameCancel,
        dragPath, dropTarget, onDragStart, onDragEnd, onDragOverItem, onDropOnItem,
    } = useSidebar();

    const isOpen = expandedPaths.has(node.relative_path);
    const isSelected = selectedPath === node.relative_path;
    const isRenaming = renamingPath === node.relative_path;
    const isDropTarget = node.is_dir && dropTarget === node.relative_path;
    const isDragged = dragPath === node.relative_path;
    const creatingHere = creating?.parentPath === node.relative_path;
    const [draftName, setDraftName] = useState(node.name);
    useEffect(() => {
        if (isRenaming) setDraftName(node.name);
    }, [isRenaming, node.name]);

    const handleClick = () => {
        onSelect(node.relative_path);
        if (node.is_dir) onToggleExpand(node.relative_path);
        else onFileClick(node);
    };

    const iconName = isRenaming ? draftName.trim() : node.name;

    return (
        <div role="none">
            <div
                role="treeitem"
                aria-level={level + 1}
                aria-selected={isSelected}
                aria-expanded={node.is_dir ? isOpen : undefined}
                draggable={!isRenaming}
                onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    // A private type, so dropping onto the code editor does not paste the path as text.
                    e.dataTransfer.setData("application/x-dischord-path", node.relative_path);
                    onDragStart(node.relative_path);
                }}
                onDragEnd={onDragEnd}
                onDragOver={(e) => onDragOverItem(node, e)}
                onDrop={(e) => onDropOnItem(node, e)}
                className={`group relative pr-2 py-0.5 text-[12px] cursor-pointer flex items-center justify-between gap-2 truncate transition-colors
                    ${isDropTarget ? "bg-accent/25 outline outline-1 -outline-offset-1 outline-accent" : isSelected ? "bg-accent/10 text-white" : "text-gray-400 hover:bg-white/5 hover:text-gray-200"}
                    ${isDragged ? "opacity-40" : ""}
                `}
                style={{ paddingLeft: `${level * 10 + 8}px` }}
                onClick={isRenaming ? undefined : handleClick}
                onContextMenu={(e) => onContextMenu(e, node.relative_path)}
            >
                {isSelected && (
                    <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-accent" />
                )}

                <div className="flex items-center gap-1.5 truncate flex-1">
                    {node.is_dir ? (
                        <i className={`bi bi-chevron-right text-[8px] text-gray-600 transition-transform duration-150 shrink-0 ${isOpen ? "rotate-90" : ""}`} />
                    ) : (
                        <span className="w-[8px] shrink-0" />
                    )}

                    {node.is_dir
                        ? <FolderIcon name={node.name} open={isOpen} />
                        : <FileIcon name={iconName} />}

                    {isRenaming ? (
                        <NameInput
                            initial={node.name}
                            onSubmit={(name) => onRenameSubmit(node.relative_path, name)}
                            onCancel={onRenameCancel}
                            onValueChange={setDraftName}
                        />
                    ) : (
                        <span className="truncate ml-1">{node.name}</span>
                    )}
                </div>

                {node.is_dir && !isRenaming && (
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <CreateButtons
                            onCreateFile={() => onCreateRequest("file", node.relative_path)}
                            onCreateFolder={() => onCreateRequest("folder", node.relative_path)}
                            iconSize="text-[11px]"
                            buttonClassName="hover:text-accent p-0.5 rounded transition-colors"
                        />
                    </div>
                )}
            </div>

            {node.is_dir && isOpen && (creatingHere || (node.children && node.children.length > 0)) && (
                <div role="group" className="ml-[13px] border-l border-white/[0.06]">
                    {creatingHere && <CreateRow level={level + 1} />}
                    {node.children?.map((child) => (
                        <FileItem key={child.relative_path} node={child} level={level + 1} />
                    ))}
                </div>
            )}
        </div>
    );
};
