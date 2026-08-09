import { ToolbarButton } from "../ToolbarButton";
import { MenuOption } from "./MenuOption";

interface EditMenuProps {
    isOpen: boolean;
    onToggle: () => void;
    onHover: () => void;
    onEditGitignore: () => void;
}

export const EditMenu = ({ isOpen, onToggle, onHover, onEditGitignore }: EditMenuProps) => (
    <div className="relative" onMouseEnter={onHover}>
        <ToolbarButton label="Editar" onClick={onToggle} />

        {isOpen && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-[#1e1f22] border border-[#2b2d31] rounded-lg shadow-2xl py-1 z-[200] animate-in fade-in zoom-in-95 duration-100">
                <MenuOption
                    icon="bi bi-gear"
                    label="Configurar .gitignore"
                    onClick={onEditGitignore}
                />
            </div>
        )}
    </div>
);
