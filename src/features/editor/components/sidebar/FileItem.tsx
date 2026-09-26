import type { FileNode } from "../../types";
import { Tooltip } from "../../../../components/ui";
import { NameInput } from "./NameInput";
import { useEffect, useState } from "react";
import { useSidebar } from "./SidebarContext";

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

/** Icon of a file, picked from its name (so it can follow what is being typed). */
const FileIcon = ({ name }: { name: string }) => {
    if (name.toLowerCase().endsWith(".chord")) {
        return <span className="text-accent font-black text-[12px] w-[13px] text-center leading-none">D</span>;
    }

    const { icon, color } = getFileIcon(name);
    return <i className={`bi ${icon} text-[12px]`} style={{ color }} />;
};

const getFolderIcon = (isOpen: boolean) =>
    isOpen
        ? <i className="bi bi-folder2-open text-[#e8a87c] text-[12px]" />
        : <i className="bi bi-folder-fill text-[#8f8f8f] text-[12px]" />;

interface FileItemProps {
    node: FileNode;
    level: number;
}

/** The row shown while a new file or folder is being named. */
export const CreateRow = ({ level }: { level: number }) => {
    const { creating, onCreateSubmit, onCreateCancel } = useSidebar();
    const [typedName, setTypedName] = useState("");
    if (!creating) return null;

    return (
        <div className="pr-2 py-0.5 flex items-center gap-1.5" style={{ paddingLeft: `${level * 10 + 8}px` }}>
            <span className="w-[8px] shrink-0" />
            {creating.type === "folder"
                ? <i className="bi bi-folder-fill text-[#8f8f8f] text-[12px]" />
                : <FileIcon name={typedName.trim()} />}
            <NameInput onSubmit={onCreateSubmit} onCancel={onCreateCancel} onValueChange={setTypedName} />
        </div>
    );
};

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
        <div>
            <div
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
                        ? getFolderIcon(isOpen)
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
                        <Tooltip label="Nuevo archivo">
                            <button
                                onClick={(e) => { e.stopPropagation(); onCreateRequest('file', node.relative_path); }}
                                className="hover:text-accent p-0.5 rounded transition-colors"
                            >
                                <i className="bi bi-file-earmark-plus text-[11px]"></i>
                            </button>
                        </Tooltip>
                        <Tooltip label="Nueva carpeta">
                            <button
                                onClick={(e) => { e.stopPropagation(); onCreateRequest('folder', node.relative_path); }}
                                className="hover:text-accent p-0.5 rounded transition-colors"
                            >
                                <i className="bi bi-folder-plus text-[11px]"></i>
                            </button>
                        </Tooltip>
                    </div>
                )}
            </div>

            {node.is_dir && isOpen && (creatingHere || (node.children && node.children.length > 0)) && (
                <div className="ml-[13px] border-l border-white/[0.06]">
                    {creatingHere && <CreateRow level={level + 1} />}
                    {node.children?.map((child) => (
                        <FileItem key={child.relative_path} node={child} level={level + 1} />
                    ))}
                </div>
            )}
        </div>
    );
};
