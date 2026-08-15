import { useState, useEffect } from "react";
import { ToolbarButton } from "../ToolbarButton";
import { MenuOption } from "./MenuOption";
import { HiddenFilesMenu } from "./HiddenFilesMenu";
import type { FileNode } from "../../../types";

interface EditMenuProps {
    isOpen: boolean;
    onToggle: () => void;
    onHover: () => void;
    projectName: string;
    onOpenHiddenFile: (node: FileNode) => void;
    onOpenPackages: () => void;
}

export const EditMenu = ({ isOpen, onToggle, onHover, projectName, onOpenHiddenFile, onOpenPackages }: EditMenuProps) => {
    const [hiddenFilesOpen, setHiddenFilesOpen] = useState(false);

    useEffect(() => {
        if (!isOpen) setHiddenFilesOpen(false);
    }, [isOpen]);

    return (
        <div className="relative" onMouseEnter={onHover}>
            <ToolbarButton label="Editar" onClick={onToggle} />

            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-52 bg-[#1e1f22] border border-[#2b2d31] rounded-lg shadow-2xl py-1 z-[200] animate-in fade-in zoom-in-95 duration-100">
                    <MenuOption
                        icon="bi bi-boxes"
                        label="Dependencias..."
                        onClick={onOpenPackages}
                    />

                    <div className="h-[1px] bg-[#2b2d31] my-1 mx-2" />

                    <HiddenFilesMenu
                        isOpen={hiddenFilesOpen}
                        onHover={() => setHiddenFilesOpen(true)}
                        onToggle={() => setHiddenFilesOpen((v) => !v)}
                        projectName={projectName}
                        onFileOpen={onOpenHiddenFile}
                    />
                </div>
            )}
        </div>
    );
};
