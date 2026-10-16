import { openUrl } from "@tauri-apps/plugin-opener";
import { ToolbarButton } from "../ToolbarButton";
import { MenuOption } from "./MenuOption";
import { showError } from "../../../../../utils/Dialogs";
import { MenuPanel } from "./MenuPanel";
import { MenuDivider } from "./MenuDivider";
import { helpLinks } from "./HelpMenu.constants";

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
                <MenuPanel className="top-full left-0 mt-1 w-52 z-[200]">
                    {helpLinks.map(({ icon, label, url, what }) => (
                        <MenuOption key={url} icon={icon} label={label} onClick={() => openLink(url, what)} />
                    ))}

                    <MenuDivider />

                    <MenuOption
                        icon="bi bi-keyboard"
                        label="Atajos de teclado"
                        onClick={() => {
                            onClose();
                            onOpenShortcuts();
                        }}
                    />
                </MenuPanel>
            )}
        </div>
    );
};
