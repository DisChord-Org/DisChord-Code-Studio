import { useState, useRef, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";

import { FileMenu } from "./menus/FileMenu";
import { EditMenu } from "./menus/EditMenu";
import { RunMenu } from "./menus/RunMenu";
import { HelpMenu } from "./menus/HelpMenu";
import { ProjectSwitcher } from "./menus/ProjectSwitcher";
import { WindowControls, BackButton, Logo, controlsOnLeft } from "../../../../components/ui";
import type { ProjectSummary } from "../../../dashboard";
import type { FileNode, OpenHiddenFileDetail } from "../../types";
import { showError } from "../../../../utils/Dialogs";

const appWindow = getCurrentWindow();

type BarMenuKey = "file" | "edit" | "run" | "help";
type MenuKey = BarMenuKey | "project" | null;

interface ToolbarProps {
    projectName: string;
    onBack: () => void;
    onRun: () => void;
    isRunning: boolean;
    onSwitchProject?: (name: string) => void;
    onOpenPackages: () => void;
    onOpenShortcuts: () => void;
    onToggleTerminal?: () => void;
}

export const Toolbar = ({ projectName, onBack, onRun, isRunning, onSwitchProject, onOpenPackages, onOpenShortcuts, onToggleTerminal }: ToolbarProps) => {
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

    const hoverMenu = (key: BarMenuKey) => {
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
            showError("No se pudo abrir el explorador: " + error);
        }
    };

    const handleSave = () => {
        window.dispatchEvent(new CustomEvent("dischord-save"));
        setOpenMenu(null);
    };

    const handleOpenHiddenFile = (node: FileNode) => {
        window.dispatchEvent(new CustomEvent<OpenHiddenFileDetail>("open-hidden-file", {
            detail: {
                name: node.name,
                relative_path: node.relative_path
            }
        }));
        setOpenMenu(null);
    };

    const handleOpenPackages = () => {
        setOpenMenu(null);
        onOpenPackages();
    };

    return (
        <header
            data-tauri-drag-region
            className="h-10 bg-panel-alt shadow-[0_1px_3px_0_rgba(0,0,0,0.35)] flex items-center justify-between shrink-0 select-none relative z-20"
        >
            <div data-tauri-drag-region className="flex items-center gap-1 flex-1">
                {controlsOnLeft ? <WindowControls showMaximize /> : <span className="px-3 flex items-center"><Logo size={24} /></span>}
                <div className="flex items-center gap-0.5" ref={menuBarRef}>
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
                        onOpenPackages={handleOpenPackages}
                    />

                    <RunMenu
                        isOpen={openMenu === "run"}
                        onToggle={() => toggleMenu("run")}
                        onHover={() => hoverMenu("run")}
                        isRunning={isRunning}
                        onRun={() => { setOpenMenu(null); onRun(); }}
                        onToggleTerminal={onToggleTerminal && (() => { setOpenMenu(null); onToggleTerminal(); })}
                    />

                    <HelpMenu
                        isOpen={openMenu === "help"}
                        onToggle={() => toggleMenu("help")}
                        onHover={() => hoverMenu("help")}
                        onClose={() => setOpenMenu(null)}
                        onOpenShortcuts={onOpenShortcuts}
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

            <div data-tauri-drag-region className="flex items-center justify-end flex-1 h-full">
                <BackButton onClick={onBack} className="mr-4" />

                {/* On macOS the controls sit on the left, and the logo takes their place on the right. */}
                {controlsOnLeft
                    ? <span className="px-4 flex items-center"><Logo size={24} /></span>
                    : <WindowControls showMaximize className="ml-2" />}
            </div>
        </header>
    );
};
