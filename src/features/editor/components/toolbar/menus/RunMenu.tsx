import { ToolbarButton } from "../ToolbarButton";
import { MenuOption } from "./MenuOption";

interface RunMenuProps {
    isOpen: boolean;
    onToggle: () => void;
    onHover: () => void;
    isRunning: boolean;
    onRun: () => void;
    onToggleTerminal?: () => void;
}

export const RunMenu = ({ isOpen, onToggle, onHover, isRunning, onRun, onToggleTerminal }: RunMenuProps) => {
    const variant = isRunning ? "stop" : "run";
    const tint = isRunning
        ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
        : "bg-green-500/10 text-green-400 hover:bg-green-500/20";

    return (
        <div className="relative flex items-stretch" onMouseEnter={onHover}>
            <ToolbarButton
                label={isRunning ? "Detener" : "Ejecutar"}
                variant={variant}
                onClick={onRun}
            />

            {onToggleTerminal && (
                <>
                    <button
                        onClick={onToggle}
                        title="Más opciones"
                        className={`ml-0.5 px-1.5 rounded transition-colors flex items-center ${tint}`}
                    >
                        <i className={`bi bi-chevron-down text-[9px] transition-transform ${isOpen ? "rotate-180" : ""}`}></i>
                    </button>

                    {isOpen && (
                        <div className="absolute top-full left-0 mt-1 w-52 bg-border border border-menu-border rounded-lg shadow-2xl py-1 z-[200] animate-in fade-in zoom-in-95 duration-100">
                            <MenuOption
                                icon="bi bi-terminal"
                                label="Terminal"
                                shortcut="Ctrl+Ñ"
                                onClick={onToggleTerminal}
                            />
                        </div>
                    )}
                </>
            )}
        </div>
    );
};
