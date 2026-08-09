import { ToolbarButton } from "../ToolbarButton";
import { MenuOption } from "./MenuOption";

interface FileMenuProps {
    isOpen: boolean;
    onToggle: () => void;
    onHover: () => void;
    onSave: () => void;
    onOpenExplorer: () => void;
    onExit: () => void;
}

export const FileMenu = ({ isOpen, onToggle, onHover, onSave, onOpenExplorer, onExit }: FileMenuProps) => (
    <div className="relative" onMouseEnter={onHover}>
        <ToolbarButton label="Archivo" onClick={onToggle} />

        {isOpen && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-[#1e1f22] border border-[#2b2d31] rounded-lg shadow-2xl py-1 z-[200] animate-in fade-in zoom-in-95 duration-100">
                <MenuOption
                    icon="bi bi-save"
                    label="Guardar"
                    shortcut="Ctrl+S"
                    onClick={onSave}
                />
                <MenuOption
                    icon="bi bi-folder2-open"
                    label="Abrir en explorador"
                    onClick={onOpenExplorer}
                />
                <div className="h-[1px] bg-[#2b2d31] my-1 mx-2" />
                <MenuOption
                    icon="bi bi-box-arrow-right"
                    label="Salir"
                    onClick={onExit}
                    variant="danger"
                />
            </div>
        )}
    </div>
);
