import { ToolbarButton } from "../ToolbarButton";
import { MenuOption } from "./MenuOption";
import { MenuPanel } from "./MenuPanel";
import { MenuDivider } from "./MenuDivider";
import { useShortcutLabel } from "../../../../shortcuts";

interface FileMenuProps {
    isOpen: boolean;
    onToggle: () => void;
    onHover: () => void;
    onSave: () => void;
    onOpenExplorer: () => void;
    onExit: () => void;
}

export const FileMenu = ({ isOpen, onToggle, onHover, onSave, onOpenExplorer, onExit }: FileMenuProps) => {
    const saveShortcut = useShortcutLabel("file.save");

    return (
        <div className="relative" onMouseEnter={onHover}>
            <ToolbarButton label="Archivo" onClick={onToggle} />

            {isOpen && (
                <MenuPanel className="top-full left-0 mt-1 w-48 z-[200]">
                    <MenuOption
                        icon="bi bi-save"
                        label="Guardar"
                        shortcut={saveShortcut}
                        onClick={onSave}
                    />
                    <MenuOption
                        icon="bi bi-folder2-open"
                        label="Abrir en explorador"
                        onClick={onOpenExplorer}
                    />
                    <MenuDivider />
                    <MenuOption
                        icon="bi bi-box-arrow-right"
                        label="Salir"
                        onClick={onExit}
                        variant="danger"
                    />
                </MenuPanel>
            )}
        </div>
    );
};
