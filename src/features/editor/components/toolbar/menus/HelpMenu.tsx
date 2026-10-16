import { openUrl } from "@tauri-apps/plugin-opener";
import { ToolbarButton } from "../ToolbarButton";
import { MenuOption } from "./MenuOption";
import { showError } from "../../../../../utils/Dialogs";
import { supportServerUrl, websiteUrl } from "../../../../../utils/Links";

interface HelpMenuProps {
    isOpen: boolean;
    onToggle: () => void;
    onHover: () => void;
    onClose: () => void;
    onOpenShortcuts: () => void;
}

export const HelpMenu = ({ isOpen, onToggle, onHover, onClose, onOpenShortcuts }: HelpMenuProps) => {
    const openLink = async (url: string, what: string) => {
        onClose();
        try {
            await openUrl(url);
        } catch (error) {
            showError(`No se pudo abrir ${what}: ${error}`);
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
                        onClick={() => openLink(supportServerUrl, "el servidor de soporte")}
                    />
                    <MenuOption
                        icon="bi bi-globe2"
                        label="Sitio web"
                        onClick={() => openLink(websiteUrl, "el sitio web")}
                    />

                    <div className="h-[1px] bg-menu-border my-1 mx-2" />

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
