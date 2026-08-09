import { MenuOption } from "./MenuOption";
import { formatRelativeTime } from "../../../../../utils/Time";
import type { ProjectSummary } from "../../../../../types";

interface ProjectSwitcherProps {
    isOpen: boolean;
    onToggle: () => void;
    projectName: string;
    projects: ProjectSummary[];
    loading: boolean;
    onSwitchProject: (name: string) => void;
    onBackToDashboard: () => void;
}

export const ProjectSwitcher = ({
    isOpen,
    onToggle,
    projectName,
    projects,
    loading,
    onSwitchProject,
    onBackToDashboard,
}: ProjectSwitcherProps) => (
    <>
        <button
            onClick={onToggle}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-colors
                ${isOpen
                    ? "bg-white/[0.06] border-white/[0.08] text-gray-200"
                    : "bg-white/[0.02] border-transparent hover:bg-white/[0.05] hover:border-white/[0.06] text-gray-500 hover:text-gray-300"
                }`}
        >
            <i className="bi bi-folder-fill text-[#5865F2] text-[11px]"></i>
            <span className="text-[12px] font-medium truncate max-w-[220px]">{projectName}</span>
            <i className={`bi bi-chevron-down text-[9px] transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`}></i>
        </button>

        {isOpen && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-64 bg-[#1e1f22] border border-[#2b2d31] rounded-lg shadow-2xl py-1 z-[200] animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-600">
                    Cambiar de proyecto
                </div>

                <div className="max-h-56 overflow-y-auto">
                    {loading ? (
                        <div className="px-3 py-2 text-[12px] text-gray-500">Cargando...</div>
                    ) : projects.length === 0 ? (
                        <div className="px-3 py-2 text-[12px] text-gray-500">No hay otros proyectos.</div>
                    ) : (
                        projects.map((project) => {
                            const isCurrent = project.name === projectName;
                            return (
                                <button
                                    key={project.name}
                                    onClick={() => onSwitchProject(project.name)}
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
                    onClick={onBackToDashboard}
                />
            </div>
        )}
    </>
);
