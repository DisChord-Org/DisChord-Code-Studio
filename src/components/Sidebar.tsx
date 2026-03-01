import { useState } from "react";

interface FileNode {
    name: string;
    is_dir: boolean;
    children?: FileNode[];
}

const FileItem = ({ node, level, onFileClick }: { node: FileNode, level: number, onFileClick: (node: FileNode) => void }) => {
    const [isOpen, setIsOpen] = useState(false);

    const handleClick = () => {
        if (node.is_dir) setIsOpen(!isOpen);
        else onFileClick(node);
    };

    return (
        <div>
            {/* la fila donde se hace clic */}
            <div 
                className="px-4 py-1.5 text-sm text-gray-400 hover:bg-white/5 hover:text-gray-200 cursor-pointer flex items-center gap-2 truncate"
                style={{ paddingLeft: `${level * 12 + 16}px` }}
                onClick={() => handleClick()}
            >
                {/* icono dinamico */}
                <span className="text-gray-600 opacity-70">
                    {node.is_dir ? (isOpen ? "📂" : "📁") : "📄"}
                </span>
                {node.name}
            </div>

            {/* si es carpeta, si está abierta y si tiene hijos, se dibujarán */}
            {node.is_dir && isOpen && node.children && (
                <div>
                    {node.children.map((child) => (
                        <FileItem
                            key={child.name}
                            node={child}
                            level={level + 1}
                            onFileClick={onFileClick}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export const Sidebar = ({ files, onFileClick }: { files: any[], onFileClick: (node: FileNode) => void}) => {
    return (
        <aside className="w-60 border-r border-[#1e1f22] bg-[#0B0E14] flex flex-col shrink-0 select-none">
            <div className="p-3 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                Explorador
            </div>
            <div className="flex-1 overflow-y-auto">
                {files.map((file) => (
                    <FileItem
                        key={file.name}
                        node={file}
                        level={0}
                        onFileClick={onFileClick}
                    />
                ))}
            </div>
        </aside>
    );
};