import { getCurrentWindow } from "@tauri-apps/api/window";

const appWindow = getCurrentWindow();

interface WindowControlsProps {
    showMaximize?: boolean;
    closeDisabled?: boolean;
    closeTitle?: string;
    className?: string;
}

export const WindowControls = ({
    showMaximize = false,
    closeDisabled = false,
    closeTitle,
    className = "",
}: WindowControlsProps) => {
    const handleMinimize = () => appWindow.minimize();
    const handleToggleMaximize = () => appWindow.toggleMaximize();
    const handleClose = () => appWindow.close();

    return (
        <div className={`flex items-center h-full ${className}`}>
            <button
                onClick={handleMinimize}
                className="w-10 h-10 flex items-center justify-center hover:bg-white/5 text-gray-400 transition-colors"
            >
                <i className="bi bi-dash-lg text-lg"></i>
            </button>

            {showMaximize && (
                <button
                    onClick={handleToggleMaximize}
                    className="w-10 h-10 flex items-center justify-center hover:bg-white/5 text-gray-400 transition-colors"
                >
                    <i className="bi bi-square text-[10px]"></i>
                </button>
            )}

            <button
                onClick={handleClose}
                disabled={closeDisabled}
                title={closeTitle}
                className={`w-10 h-10 flex items-center justify-center transition-colors ${
                    closeDisabled
                        ? "text-gray-700 cursor-not-allowed"
                        : "hover:bg-red-500 hover:text-white text-gray-400"
                }`}
            >
                <i className="bi bi-x-lg"></i>
            </button>
        </div>
    );
};
