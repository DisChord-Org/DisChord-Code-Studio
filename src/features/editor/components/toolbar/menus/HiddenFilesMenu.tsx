import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileItem } from "../../sidebar/FileItem";
import type { FileNode } from "../../../types";

const GITIGNORE_NODE: FileNode = {
    name: ".gitignore",
    is_dir: false,
    relative_path: ".gitignore",
};

interface HiddenFilesMenuProps {
    isOpen: boolean;
    onHover: () => void;
    onToggle: () => void;
    projectName: string;
    onFileOpen: (node: FileNode) => void;
}

export const HiddenFilesMenu = ({ isOpen, onHover, onToggle, projectName, onFileOpen }: HiddenFilesMenuProps) => {
    const [hiddenFiles, setHiddenFiles] = useState<FileNode[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen) return;

        setLoading(true);
        invoke<FileNode[]>("read_hidden_files", { name: projectName })
            .then(setHiddenFiles)
            .catch((error) => console.error("No se pudieron cargar los ficheros ocultos:", error))
            .finally(() => setLoading(false));
    }, [isOpen, projectName]);

    return (
        <div className="relative" onMouseEnter={onHover}>
            <button
                onClick={onToggle}
                className="w-full px-3 py-1.5 text-[11px] flex items-center justify-between gap-3 text-gray-300 hover:bg-[#5865F2] hover:text-white transition-colors"
            >
                <span className="flex items-center gap-3">
                    <i className="bi bi-eye-slash text-sm"></i>
                    Ficheros ocultos
                </span>
                <i className="bi bi-chevron-right text-[9px] opacity-50"></i>
            </button>

            {isOpen && (
                <div className="absolute top-0 left-full ml-1 w-56 bg-[#1e1f22] border border-[#2b2d31] rounded-lg shadow-2xl py-1 z-[210] animate-in fade-in zoom-in-95 duration-100">
                    <button
                        onClick={() => onFileOpen(GITIGNORE_NODE)}
                        className="w-full text-left px-3 py-1.5 text-[11px] flex items-center gap-2 text-[#5865F2] font-semibold hover:bg-[#5865F2] hover:text-white transition-colors"
                    >
                        <i className="bi bi-eye-slash text-sm"></i>
                        .gitignore
                    </button>

                    <div className="h-[1px] bg-[#2b2d31] my-1 mx-2" />

                    <div className="max-h-56 overflow-y-auto">
                        {loading ? (
                            <div className="px-3 py-2 text-[11px] text-gray-500">Cargando...</div>
                        ) : hiddenFiles.length === 0 ? (
                            <div className="px-3 py-2 text-[11px] text-gray-500 italic">No hay ficheros ocultos.</div>
                        ) : (
                            hiddenFiles.map((file) => (
                                <FileItem
                                    key={file.relative_path}
                                    node={file}
                                    level={0}
                                    onFileClick={onFileOpen}
                                    onCreateRequest={() => {}}
                                    onContextMenu={(e) => e.preventDefault()}
                                    selectedPath={null}
                                    onSelect={() => {}}
                                />
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
