import { openUrl } from "@tauri-apps/plugin-opener";
import { ToolbarButton } from "../ToolbarButton";
import { MenuOption } from "./MenuOption";
import { showError } from "../../../../../utils/Dialogs";

const supportServerUrl = "https://discord.gg/mG5CaDvKsk";

interface HelpMenuProps {
    isOpen: boolean;
    onToggle: () => void;
    onHover: () => void;
    onClose: () => void;
    onOpenShortcuts: () => void;
}

export const HelpMenu = ({ isOpen, onToggle, onHover, onClose, onOpenShortcuts }: HelpMenuProps) => {
    const openSupportServer = async () => {
        onClose();
        try {
            await openUrl(supportServerUrl);
        } catch (error) {
            showError("No se pudo abrir el servidor de soporte: " + error);
        }
    };

    return (
        <div className="relative" onMouseEnter={onHover}>
            <ToolbarButton label="Ayuda" onClick={onToggle} />

            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-52 bg-border border border-menu-border rounded-lg shadow-2xl py-1 z-[200] animate-in fade-in zoom-in-95 duration-100">
                    <MenuOption
                        icon="bi bi-discord"
                        label="Servidor de soporte"
                        onClick={openSupportServer}
                    />
                    <MenuOption
                        icon="bi bi-keyboard"
                        label="Atajos de teclado"
                        onClick={() => {
                            onClose();
                            onOpenShortcuts();
                        }}
                    />
                </div>
            )}
        </div>
    );
};
