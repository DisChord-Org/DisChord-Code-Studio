import { Button } from "../../../../../components/ui";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { MenuPanel } from "./MenuPanel";
import { MenuDivider } from "./MenuDivider";
import { FileItem } from "../../sidebar/FileItem";
import { SidebarContext, type SidebarContextValue } from "../../sidebar/SidebarContext";
import type { FileNode } from "../../../types";

const emptyExpandedPaths = new Set<string>();

const noop = () => {};

const readOnlyContext = (onFileClick: (node: FileNode) => void): SidebarContextValue => ({
    selectedPath: null,
    onSelect: noop,
    expandedPaths: emptyExpandedPaths,
    onToggleExpand: noop,
    onFileClick,
    onContextMenu: (e) => e.preventDefault(),
    onCreateRequest: noop,
    creating: null,
    onCreateSubmit: async () => null,
    onCreateCancel: noop,
    renamingPath: null,
    onRenameSubmit: async () => null,
    onRenameCancel: noop,
    dragPath: null,
    dropTarget: null,
    onDragStart: noop,
    onDragEnd: noop,
    onDragOverItem: noop,
    onDropOnItem: noop,
});

const gitignoreNode: FileNode = {
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
            <Button variant="unstyled"
                onClick={onToggle}
                className="w-full px-3 py-1.5 text-[11px] flex items-center justify-between gap-3 text-gray-300 hover:bg-accent hover:text-white transition-colors"
            >
                <span className="flex items-center gap-3">
                    <i className="bi bi-eye-slash text-sm"></i>
                    Ficheros ocultos
                </span>
                <i className="bi bi-chevron-right text-[9px] opacity-50"></i>
            </Button>

            {isOpen && (
                <MenuPanel className="top-0 left-full ml-1 w-56 z-[210]">
                    <Button variant="unstyled"
                        onClick={() => onFileOpen(gitignoreNode)}
                        className="w-full text-left px-3 py-1.5 text-[11px] flex items-center gap-2 text-accent font-semibold hover:bg-accent hover:text-white transition-colors"
                    >
                        <i className="bi bi-eye-slash text-sm"></i>
                        .gitignore
                    </Button>

                    <MenuDivider />

                    <div className="custom-scrollbar max-h-56 overflow-y-auto">
                        {loading ? (
                            <div className="px-3 py-2 text-[11px] text-gray-500">Cargando...</div>
                        ) : hiddenFiles.length === 0 ? (
                            <div className="px-3 py-2 text-[11px] text-gray-500 italic">No hay ficheros ocultos.</div>
                        ) : (
                            <SidebarContext.Provider value={readOnlyContext(onFileOpen)}>
                                {hiddenFiles.map((file) => (
                                    <FileItem key={file.relative_path} node={file} level={0} />
                                ))}
                            </SidebarContext.Provider>
                        )}
                    </div>
                </MenuPanel>
            )}
        </div>
    );
};
