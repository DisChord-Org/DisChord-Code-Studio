import { getCurrentWindow } from "@tauri-apps/api/window";
import { Tooltip } from "./Tooltip";
import { isMac } from "../../utils/Platform";

const appWindow = getCurrentWindow();

interface WindowControlsProps {
    showMaximize?: boolean;
    closeDisabled?: boolean;
    closeTitle?: string;
    className?: string;
}

/** macOS puts the window controls on the left; everywhere else they are on the right. */
export const controlsOnLeft = isMac;

interface TrafficLightProps {
    label: string;
    color: string;
    glyph: string;
    disabled?: boolean;
    onClick: () => void;
}

/** One of the three round macOS buttons; its symbol only shows while the pointer is over the group. */
const TrafficLight = ({ label, color, glyph, disabled = false, onClick }: TrafficLightProps) => (
    <button
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        title={disabled ? undefined : label}
        className={`w-3 h-3 rounded-full flex items-center justify-center border border-black/[0.12] transition-colors ${
            disabled ? "bg-[#4d4d52] cursor-default" : "hover:brightness-90 active:brightness-75"
        }`}
        style={disabled ? undefined : { backgroundColor: color }}
    >
        {!disabled && <i className={`bi ${glyph} text-[8px] leading-none text-black/60 opacity-0 group-hover/traffic:opacity-100`}></i>}
    </button>
);

export const WindowControls = ({
    showMaximize = false,
    closeDisabled = false,
    closeTitle,
    className = "",
}: WindowControlsProps) => {
    const handleMinimize = () => appWindow.minimize();
    const handleToggleMaximize = () => appWindow.toggleMaximize();
    const handleClose = () => appWindow.close();

    if (isMac) {
        return (
            <div className={`group/traffic flex items-center gap-2 h-full px-4 ${className}`} title={closeDisabled ? closeTitle : undefined}>
                <TrafficLight label="Cerrar" color="#ff5f57" glyph="bi-x-lg" disabled={closeDisabled} onClick={handleClose} />
                <TrafficLight label="Minimizar" color="#febc2e" glyph="bi-dash-lg" onClick={handleMinimize} />
                <TrafficLight label="Maximizar" color="#28c840" glyph="bi-plus-lg" disabled={!showMaximize} onClick={handleToggleMaximize} />
            </div>
        );
    }

    return (
        <div className={`flex items-center h-full ${className}`}>
            <Tooltip label="Minimizar" placement="bottom">
                <button
                    onClick={handleMinimize}
                    className="w-10 h-10 flex items-center justify-center hover:bg-white/5 text-gray-400 transition-colors"
                >
                    <i className="bi bi-dash-lg text-lg"></i>
                </button>
            </Tooltip>

            {showMaximize && (
                <Tooltip label="Maximizar" placement="bottom">
                    <button
                        onClick={handleToggleMaximize}
                        className="w-10 h-10 flex items-center justify-center hover:bg-white/5 text-gray-400 transition-colors"
                    >
                        <i className="bi bi-square text-[10px]"></i>
                    </button>
                </Tooltip>
            )}

            <Tooltip label={closeTitle ?? "Cerrar"} placement="bottom" align="end">
                <button
                    onClick={handleClose}
                    disabled={closeDisabled}
                    className={`w-10 h-10 flex items-center justify-center transition-colors ${
                        closeDisabled
                            ? "text-gray-700 cursor-not-allowed"
                            : "hover:bg-red-500 hover:text-white text-gray-400"
                    }`}
                >
                    <i className="bi bi-x-lg"></i>
                </button>
            </Tooltip>
        </div>
    );
};
