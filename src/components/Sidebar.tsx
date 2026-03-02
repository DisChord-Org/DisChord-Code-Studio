import { useState } from "react";
import { FileNode } from "../types";

const FileItem = ({ node, level, onFileClick }: { node: FileNode, level: number, onFileClick: (node: FileNode) => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    const isChordFile = !node.is_dir && node.name.toLowerCase().endsWith('.chord');

    const handleClick = () => {
        if (node.is_dir) setIsOpen(!isOpen);
        else onFileClick(node);
    };

    const handleCreateFile = (e: React.MouseEvent) => {
        e.stopPropagation();
        console.log("Crear archivo en:", node.relative_path);
    };

    const handleCreateFolder = (e: React.MouseEvent) => {
        e.stopPropagation();
        console.log("Crear carpeta en:", node.relative_path);
    };

    return (
        <div>
            {/* la fila donde se hace clic */}
            <div 
                className="group px-4 py-1.5 text-sm text-gray-400 hover:bg-white/5 hover:text-gray-200 cursor-pointer flex items-center justify-between gap-2 truncate"
                style={{ paddingLeft: `${level * 12 + 16}px` }}
                onClick={handleClick}
            >
                {/* icono dinamico */}
                <div className="flex items-center gap-2 truncate">
                    {node.is_dir
                        ? (
                            isOpen
                            ? <i className="bi bi-folder2-open"></i>
                            : <i className="bi bi-folder"></i>
                        )
                        : (
                            isChordFile
                            ? <span className="text-[#5865F2] font-bold text-lg mr-4">D</span>
                            : <i className="bi bi-file-text"></i>
                        )
                    }
                    <span className="truncate">{node.name}</span>
                </div>

                {/* botones de acción */}
                {node.is_dir && (
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity pr-2">
                        <button 
                            onClick={handleCreateFile}
                            className="hover:text-[#5865F2] p-0.5 rounded transition-colors"
                            title="Nuevo Archivo"
                        >
                            <i className="bi bi-file-earmark-plus text-[15px]"></i>
                        </button>
                        <button 
                            onClick={handleCreateFolder}
                            className="hover:text-[#5865F2] p-0.5 rounded transition-colors"
                            title="Nueva Carpeta"
                        >
                            <i className="bi bi-folder-plus"></i>
                        </button>
                    </div>
                )}
            </div>

            {/* si es carpeta, si está abierta y si tiene hijos, se dibujarán */}
            {node.is_dir && isOpen && node.children && (
                <div>
                    {node.children.map((child) => (
                        <FileItem
                            key={child.relative_path}
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