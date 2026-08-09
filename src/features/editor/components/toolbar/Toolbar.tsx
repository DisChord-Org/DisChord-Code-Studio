import { useState, useRef, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";

import { ToolbarButton } from "./ToolbarButton";
import { FileMenu } from "./menus/FileMenu";
import { EditMenu } from "./menus/EditMenu";
import { ProjectSwitcher } from "./menus/ProjectSwitcher";
import { WindowControls } from "../../../../components/ui/WindowControls";
import type { ProjectSummary } from "../../../../types";
import type { FileNode } from "../../types";

const appWindow = getCurrentWindow();

type MenuKey = "file" | "edit" | "project" | null;

export const Toolbar = ({ projectName, onBack, onRun, isRunning, onSwitchProject }: {
    projectName: string,
    onBack: () => void,
    onRun: () => void,
    isRunning: boolean,
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

    const handleOpenHiddenFile = (node: FileNode) => {
        window.dispatchEvent(new CustomEvent("open-hidden-file", {
            detail: {
                name: node.name,
                relative_path: node.relative_path
            }
        }));
        setOpenMenu(null);
    };

    return (
        <header
            data-tauri-drag-region
            className="h-10 bg-[#12151c] shadow-[0_1px_3px_0_rgba(0,0,0,0.35)] flex items-center justify-between shrink-0 select-none relative z-10"
        >
            <div className="flex items-center gap-1 flex-1">
                <span className="text-[#5865F2] font-black text-xl px-2">D</span>
                <div className="flex items-center" ref={menuBarRef}>
                    <FileMenu
                        isOpen={openMenu === "file"}
                        onToggle={() => toggleMenu("file")}
                        onHover={() => hoverMenu("file")}
                        onSave={handleSave}
                        onOpenExplorer={handleOpenExplorer}
                        onExit={handleClose}
                    />

                    <EditMenu
                        isOpen={openMenu === "edit"}
                        onToggle={() => toggleMenu("edit")}
                        onHover={() => hoverMenu("edit")}
                        projectName={projectName}
                        onOpenHiddenFile={handleOpenHiddenFile}
                    />

                    <ToolbarButton
                        label={isRunning ? "Detener" : "Ejecutar"}
                        variant={isRunning ? "stop" : "run"}
                        onClick={onRun}
                    />
                </div>
            </div>

            <div className="flex-none relative" ref={projectMenuRef}>
                <ProjectSwitcher
                    isOpen={openMenu === "project"}
                    onToggle={toggleProjectMenu}
                    projectName={projectName}
                    projects={projects}
                    loading={loadingProjects}
                    onSwitchProject={handleSwitchProject}
                    onBackToDashboard={() => { setOpenMenu(null); onBack(); }}
                />
            </div>

            <div className="flex items-center justify-end flex-1 h-full">
                <button
                    onClick={onBack}
                    className="text-[11px] text-gray-500 hover:text-white transition-colors mr-4 flex items-center gap-1"
                >
                    <i className="bi bi-arrow-left"></i> Volver
                </button>

                <WindowControls showMaximize className="ml-2" />
            </div>
        </header>
    );
};
