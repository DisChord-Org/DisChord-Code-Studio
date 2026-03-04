import { useState, useRef, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";

import { ToolbarButton } from "./ToolbarButton";
import { MenuOption } from "./MenuOption";

const appWindow = getCurrentWindow();

export const Toolbar = ({ projectName, onBack, onRun, isRunning }: { projectName: string, onBack: () => void, onRun: () => void, isRunning: boolean, onSave: () => void }) => {
    const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsFileMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);
    
    const handleMinimize = async () => await appWindow.minimize();
    const handleToggleMaximize = async () => await appWindow.toggleMaximize();
    const handleClose = async () => await appWindow.close();

    const handleOpenExplorer = async () => {
        try {
            await invoke("open_in_explorer", { projectName });
            setIsFileMenuOpen(false);
        } catch (error) {
            alert("No se pudo abrir el explorador: " + error);
        }
    };

    const handleSave = () => {
        window.dispatchEvent(new CustomEvent("dischord-save"));
        setIsFileMenuOpen(false);
    };

    return (
        <header
            data-tauri-drag-region
            className="h-10 border-b border-[#1e1f22] bg-[#0B0E14] flex items-center justify-between px-2 shrink-0 select-none"
        >
            <div className="flex items-center gap-1 flex-1">
                <span className="text-[#5865F2] font-black text-xl px-2">D</span>
                <div className="flex items-center">
                    <div className="relative" ref={menuRef}>
                        <ToolbarButton
                            label="Archivo"
                            onClick={() => setIsFileMenuOpen(!isFileMenuOpen)}
                        />
                        
                        {isFileMenuOpen && (
                            <div className="absolute top-full left-0 mt-1 w-48 bg-[#1e1f22] border border-[#2b2d31] rounded-lg shadow-2xl py-1 z-[200] animate-in fade-in zoom-in-95 duration-100">
                                <MenuOption
                                    icon="bi bi-save"
                                    label="Guardar"
                                    shortcut="Ctrl+S"
                                    onClick={handleSave}
                                />
                                <MenuOption
                                    icon="bi bi-folder2-open"
                                    label="Abrir en explorador"
                                    onClick={handleOpenExplorer}
                                />
                                <div className="h-[1px] bg-[#2b2d31] my-1 mx-2" />
                                <MenuOption
                                    icon="bi bi-box-arrow-right"
                                    label="Salir"
                                    onClick={handleClose}
                                    variant="danger"
                                />
                            </div>
                        )}
                    </div>

                    <ToolbarButton label="Editar" />
                    <ToolbarButton
                        label={isRunning ? "Detener" : "Ejecutar"}
                        variant={isRunning ? "stop" : "run"}
                        onClick={onRun}
                    />
                </div>
            </div>

            <div className="flex-none pointer-events-none">
                <span className="text-xs text-gray-600 flex-1 font-mono px-2 py-1 rounded">
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