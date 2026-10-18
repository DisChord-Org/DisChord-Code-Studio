import { Button } from "../../../../../components/ui";
import { ToolbarButton } from "../ToolbarButton";
import { MenuOption } from "./MenuOption";
import { MenuPanel } from "./MenuPanel";
import { toolbarButtonVariants } from "../ToolbarButton.constants";
import { useShortcutLabel } from "../../../../shortcuts";

interface RunMenuProps {
    isOpen: boolean;
    onToggle: () => void;
    onHover: () => void;
    isRunning: boolean;
    onRun: () => void;
    onToggleTerminal?: () => void;
}

export const RunMenu = ({ isOpen, onToggle, onHover, isRunning, onRun, onToggleTerminal }: RunMenuProps) => {
    const terminalShortcut = useShortcutLabel("terminal.toggle");
    const variant = isRunning ? "stop" : "run";
    const tint = toolbarButtonVariants[variant];

    return (
        <div className="relative flex items-stretch" onMouseEnter={onHover}>
            <ToolbarButton
                label={isRunning ? "Detener" : "Ejecutar"}
                variant={variant}
                onClick={onRun}
            />

            {onToggleTerminal && (
                <>
                    <Button variant="unstyled"
                        onClick={onToggle}
                        title="Más opciones"
                        aria-label="Más opciones"
                        aria-haspopup="true"
                        aria-expanded={isOpen}
                        className={`ml-0.5 px-1.5 rounded transition-colors flex items-center ${tint}`}
                    >
                        <i className={`bi bi-chevron-down text-[9px] transition-transform ${isOpen ? "rotate-180" : ""}`}></i>
                    </Button>

                    {isOpen && (
                        <MenuPanel className="top-full left-0 mt-1 w-52 z-[200]">
                            <MenuOption
                                icon="bi bi-terminal"
                                label="Terminal"
                                shortcut={terminalShortcut}
                                onClick={onToggleTerminal}
                            />
                        </MenuPanel>
                    )}
                </>
            )}
        </div>
    );
};
