import { getCurrentWindow } from "@tauri-apps/api/window";
import { ToolbarButton } from "./ToolbarButton";

const appWindow = getCurrentWindow();

export const Toolbar = ({ projectName, onBack }: { projectName: string, onBack: () => void }) => {
    const handleMinimize = async () => {
        await appWindow.minimize();
    };

    const handleToggleMaximize = async () => {
        await appWindow.toggleMaximize();
    };

    const handleClose = async () => {
        await appWindow.close();
    };
    return (
        <header
            data-tauri-drag-region
            className="h-10 border-b border-[#1e1f22] bg-[#0B0E14] flex items-center justify-between px-2 shrink-0 select-none"
        >
            <div className="flex items-center gap-1 flex-1">
                <span className="text-[#5865F2] font-black text-xl px-2">D</span>
                <div className="flex items-center">
                    <ToolbarButton label="Archivo" />
                    <ToolbarButton label="Editar" />
                    <ToolbarButton label="Ejecutar" variant="run" />
                </div>
            </div>

            <div className="flex-none pointer-events-none">
                <span className="ext-xs text-gray-600 flex-1 font-mono px-2 py-1 rounded">
                    <i className="bi bi-folder"></i> {projectName}
                </span>
            </div>

            <div className="flex items-center justify-end flex-1 h-full">
                <button 
                    onClick={onBack} 
                    className="text-[11px] text-gray-500 hover:text-white transition-colors mr-4 flex items-center gap-1"
                >
                    <i className="bi bi-arrow-left"></i> Volver
                </button>

                <div className="flex items-center h-full ml-2">
                    <button 
                        onClick={handleMinimize}
                        className="w-10 h-10 flex items-center justify-center hover:bg-white/5 text-gray-400 transition-colors"
                    >
                        <i className="bi bi-dash-lg text-lg"></i>
                    </button>
                    <button 
                        onClick={handleToggleMaximize}
                        className="w-10 h-10 flex items-center justify-center hover:bg-white/5 text-gray-400 transition-colors"
                    >
                        <i className="bi bi-square text-[10px]"></i>
                    </button>
                    <button 
                        onClick={handleClose}
                        className="w-10 h-10 flex items-center justify-center hover:bg-red-500 hover:text-white text-gray-400 transition-colors"
                    >
                        <i className="bi bi-x-lg"></i>
                    </button>
                </div>
            </div>
        </header>
    );
};