import { useState } from "react";
import type { FileNode } from "../../types";
import { Tooltip } from "../../../../components/ui/Tooltip";

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

interface FileItemProps {
    node: FileNode;
    level: number;
    onFileClick: (node: FileNode) => void;
    onCreateRequest: (type: 'file' | 'folder', path: string) => void;
    onContextMenu: (e: React.MouseEvent, path: string) => void;
    selectedPath: string | null;
    onSelect: (path: string) => void;
    defaultOpen?: boolean;
}

export const FileItem = ({ node, level, onFileClick, onCreateRequest, onContextMenu, selectedPath, onSelect, defaultOpen = false }: FileItemProps) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
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
                        <Tooltip label="Nuevo archivo">
                            <button
                                onClick={(e) => { e.stopPropagation(); onCreateRequest('file', node.relative_path); }}
                                className="hover:text-[#5865F2] p-0.5 rounded transition-colors"
                            >
                                <i className="bi bi-file-earmark-plus text-[11px]"></i>
                            </button>
                        </Tooltip>
                        <Tooltip label="Nueva carpeta">
                            <button
                                onClick={(e) => { e.stopPropagation(); onCreateRequest('folder', node.relative_path); }}
                                className="hover:text-[#5865F2] p-0.5 rounded transition-colors"
                            >
                                <i className="bi bi-folder-plus text-[11px]"></i>
                            </button>
                        </Tooltip>
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
