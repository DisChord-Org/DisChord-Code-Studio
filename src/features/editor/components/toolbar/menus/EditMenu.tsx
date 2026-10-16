import { useState, useEffect } from "react";
import { ToolbarButton } from "../ToolbarButton";
import { MenuOption } from "./MenuOption";
import { MenuPanel } from "./MenuPanel";
import { MenuDivider } from "./MenuDivider";
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
                <MenuPanel className="top-full left-0 mt-1 w-52 z-[200]">
                    <MenuOption
                        icon="bi bi-boxes"
                        label="Dependencias..."
                        onClick={onOpenPackages}
                    />

                    <MenuDivider />

                    <HiddenFilesMenu
                        isOpen={hiddenFilesOpen}
                        onHover={() => setHiddenFilesOpen(true)}
                        onToggle={() => setHiddenFilesOpen((v) => !v)}
                        projectName={projectName}
                        onFileOpen={onOpenHiddenFile}
                    />
                </MenuPanel>
            )}
        </div>
    );
};
