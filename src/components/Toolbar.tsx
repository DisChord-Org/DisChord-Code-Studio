import { useState, useRef, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";

import { ToolbarButton } from "./ToolbarButton";
import { MenuOption } from "./MenuOption";
import { formatRelativeTime } from "../utils/Time";

const appWindow = getCurrentWindow();

type MenuKey = "file" | "edit" | "project" | null;

interface ProjectSummary {
    name: string;
    last_modified: string;
}

export const Toolbar = ({ projectName, onBack, onRun, isRunning, onSwitchProject }: {
    projectName: string,
    onBack: () => void,
    onRun: () => void,
    isRunning: boolean,
    onSave: () => void,
    onSwitchProject?: (name: string) => void
}) => {
    const [openMenu, setOpenMenu] = useState<MenuKey>(null);
    const menuBarRef = useRef<HTMLDivElement>(null);
    const projectMenuRef = useRef<HTMLDivElement>(null);

    const [projects, setProjects] = useState<ProjectSummary[]>([]);
    const [loadingProjects, setLoadingProjects] = useState(false);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            const insideMenuBar = menuBarRef.current?.contains(target);
            const insideProjectMenu = projectMenuRef.current?.contains(target);
            if (!insideMenuBar && !insideProjectMenu) setOpenMenu(null);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const toggleMenu = (key: MenuKey) => {
        setOpenMenu((current) => (current === key ? null : key));
    };

    const hoverMenu = (key: "file" | "edit") => {
        if (openMenu !== null && openMenu !== "project" && openMenu !== key) setOpenMenu(key);
    };

    const toggleProjectMenu = async () => {
        const next: MenuKey = openMenu === "project" ? null : "project";
        setOpenMenu(next);

        if (next === "project" && projects.length === 0) {
            setLoadingProjects(true);
            try {
                const list = await invoke<ProjectSummary[]>("get_projects");
                setProjects(list);
            } catch (error) {
                console.error("No se pudieron cargar los proyectos:", error);
            } finally {
                setLoadingProjects(false);
            }
        }
    };

    const handleSwitchProject = (name: string) => {
        setOpenMenu(null);
        if (name !== projectName) onSwitchProject?.(name);
    };

    const handleMinimize = async () => await appWindow.minimize();
    const handleToggleMaximize = async () => await appWindow.toggleMaximize();
    const handleClose = async () => await appWindow.close();

    const handleOpenExplorer = async () => {
        try {
            await invoke("open_in_explorer", { projectName });
            setOpenMenu(null);
        } catch (error) {
            alert("No se pudo abrir el explorador: " + error);
        }
    };

    const handleSave = () => {
        window.dispatchEvent(new CustomEvent("dischord-save"));
        setOpenMenu(null);
    };

    const handleEditGitignore = () => {
        window.dispatchEvent(new CustomEvent("open-hidden-file", { 
            detail: {
                name: ".gitignore",
                relative_path: ".gitignore"
            }
        }));
        setOpenMenu(null);
    };

    return (
        <header
            data-tauri-drag-region
            className="h-10 border-b border-[#1e1f22] bg-[#0B0E14] flex items-center justify-between shrink-0 select-none"
        >
            <div className="flex items-center gap-1 flex-1">
                <span className="text-[#5865F2] font-black text-xl px-2">D</span>
                <div className="flex items-center" ref={menuBarRef}>
                    <div className="relative" onMouseEnter={() => hoverMenu("file")}>
                        <ToolbarButton
                            label="Archivo"
                            onClick={() => toggleMenu("file")}
                        />

                        {openMenu === "file" && (
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

                    <div className="relative" onMouseEnter={() => hoverMenu("edit")}>
                        <ToolbarButton
                            label="Editar"
                            onClick={() => toggleMenu("edit")}
                        />

                        {openMenu === "edit" && (
                            <div className="absolute top-full left-0 mt-1 w-48 bg-[#1e1f22] border border-[#2b2d31] rounded-lg shadow-2xl py-1 z-[200] animate-in fade-in zoom-in-95 duration-100">
                                <MenuOption
                                    icon="bi bi-gear"
                                    label="Configurar .gitignore"
                                    onClick={handleEditGitignore}
                                />
                            </div>
                        )}
                    </div>

                    <ToolbarButton
                        label={isRunning ? "Detener" : "Ejecutar"}
                        variant={isRunning ? "stop" : "run"}
                        onClick={onRun}
                    />
                </div>
            </div>

            <div className="flex-none relative" ref={projectMenuRef}>
                <button
                    onClick={toggleProjectMenu}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-colors
                        ${openMenu === "project"
                            ? "bg-white/[0.06] border-white/[0.08] text-gray-200"
                            : "bg-white/[0.02] border-transparent hover:bg-white/[0.05] hover:border-white/[0.06] text-gray-500 hover:text-gray-300"
                        }`}
                >
                    <i className="bi bi-folder-fill text-[#5865F2] text-[11px]"></i>
                    <span className="text-[12px] font-medium truncate max-w-[220px]">{projectName}</span>
                    <i className={`bi bi-chevron-down text-[9px] transition-transform duration-150 ${openMenu === "project" ? "rotate-180" : ""}`}></i>
                </button>

                {openMenu === "project" && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-64 bg-[#1e1f22] border border-[#2b2d31] rounded-lg shadow-2xl py-1 z-[200] animate-in fade-in zoom-in-95 duration-100">
                        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-600">
                            Cambiar de proyecto
                        </div>

                        <div className="max-h-56 overflow-y-auto">
                            {loadingProjects ? (
                                <div className="px-3 py-2 text-[12px] text-gray-500">Cargando...</div>
                            ) : projects.length === 0 ? (
                                <div className="px-3 py-2 text-[12px] text-gray-500">No hay otros proyectos.</div>
                            ) : (
                                projects.map((project) => {
                                    const isCurrent = project.name === projectName;
                                    return (
                                        <button
                                            key={project.name}
                                            onClick={() => handleSwitchProject(project.name)}
                                            disabled={isCurrent}
                                            className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors
                                                ${isCurrent ? "bg-[#5865F2]/10 cursor-default" : "hover:bg-[#5865F2] group"}
                                            `}
                                        >
                                            <i className={`bi bi-folder-fill text-[13px] ${isCurrent ? "text-[#5865F2]" : "text-gray-500 group-hover:text-white"}`}></i>
                                            <div className="flex-1 min-w-0">
                                                <div className={`text-[12px] truncate ${isCurrent ? "text-white font-medium" : "text-gray-300 group-hover:text-white"}`}>
                                                    {project.name}
                                                </div>
                                                <div className={`text-[10px] truncate ${isCurrent ? "text-gray-400" : "text-gray-500 group-hover:text-white/70"}`}>
                                                    {formatRelativeTime(project.last_modified)}
                                                </div>
                                            </div>
                                            {isCurrent && <i className="bi bi-check2 text-[#5865F2] text-[13px]"></i>}
                                        </button>
                                    );
                                })
                            )}
                        </div>

                        <div className="h-[1px] bg-[#2b2d31] my-1 mx-0" />
                        <MenuOption
                            icon="bi bi-grid-3x3-gap-fill"
                            label="Volver al Dashboard"
                            onClick={() => { setOpenMenu(null); onBack(); }}
                        />
                    </div>
                )}
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