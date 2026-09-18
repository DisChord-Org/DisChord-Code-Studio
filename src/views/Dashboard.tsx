import { useState } from "react";

import { Button } from "../components/ui/Button";
import { ProjectCard, CreatingProjectCard, useDashboard } from "../features/dashboard";
import { Title, Label } from "../components/ui/Typography";
import { Modal } from "../components/ui/Modal";
import { Tooltip } from "../components/ui/Tooltip";
import { WindowControls } from "../components/ui/WindowControls";
import { formatRelativeTime } from "../utils/Time";
import { SystemMonitorRings } from "../features/system-monitor";
import { ViewModeToggle, useConfig } from "../features/settings";

interface DashboardProps {
    onSelectProject: (name: string) => void;
    onOpenSettings: () => void;
}

function Dashboard({ onSelectProject, onOpenSettings }: DashboardProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { config, updateConfig } = useConfig();
    const {
        projects,
        loading,
        creatingProjectName,
        updating,
        appVersion,
        handleCreateProject,
        handleDeleteProject,
        handleUpdate,
    } = useDashboard();

    const totalProjectCount = projects.length + (creatingProjectName ? 1 : 0);

    return (
        <div data-tauri-drag-region className="relative min-h-screen bg-app-bg p-12 overflow-hidden select-none">
            <div className="absolute top-0 right-0 flex items-center h-10 z-50">
                <WindowControls className="ml-2" />
            </div>
            
            <Modal 
                isOpen={isModalOpen}
                title="Nuevo Proyecto"
                placeholder="Mi proyecto"
                confirmLabel="Crear"
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleCreateProject}
            />

            <Title>DisChord Code Studio</Title>

            <div className="max-w-2xl">
                <div className="flex justify-between items-end mb-4">
                    <Label className="mb-2">Tus Workflows</Label>

                    <div className="flex items-center gap-2">
                        <ViewModeToggle
                            value={config.view_mode}
                            onChange={(mode) => updateConfig({ view_mode: mode })}
                        />

                        <Button
                            variant="ghost"
                            className="text-xs"
                            onClick={() => setIsModalOpen(true)}
                        >
                            + Nuevo proyecto
                        </Button>
                    </div>
                </div>

                {loading ? (
                    <p className="text-gray-500 animate-pulse">Buscando en Documentos...</p>
                ) : projects.length > 0 || creatingProjectName ? (
                    <div
                        key={config.view_mode}
                        className={`animate-in fade-in duration-300 ${
                            config.view_mode === "grid"
                                ? `grid grid-cols-2 gap-3 ${totalProjectCount > 4 ? "custom-scrollbar max-h-[164px] overflow-y-auto pr-1" : ""}`
                                : `grid gap-3 ${totalProjectCount > 3 ? "custom-scrollbar max-h-[258px] overflow-y-auto pr-1" : ""}`
                        }`}
                    >
                        {creatingProjectName && (
                            <div className="animate-in fade-in zoom-in-95 duration-300">
                                <CreatingProjectCard name={creatingProjectName} />
                            </div>
                        )}

                        {projects.map((project, i) => (
                            <div
                                key={project.name}
                                className="animate-in fade-in zoom-in-95 duration-300"
                                style={{ animationDelay: `${i * 30}ms`, animationFillMode: "backwards" }}
                            >
                                <ProjectCard
                                    title={project.name}
                                    subtitle={`Última edición: ${formatRelativeTime(project.last_modified)}`}
                                    onDelete={() => handleDeleteProject(project.name)}
                                    onClick={() => onSelectProject(project.name)}
                                />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-8 border-2 border-dashed border-border rounded-xl text-center">
                        <p className="text-gray-500 text-sm">No existen proyectos.</p>
                    </div>
                )}
            </div>
            
            <div className="absolute bottom-0 left-0 flex items-center z-50">
                <Tooltip label="Configuración" placement="top" align="start">
                    <button
                        onClick={onOpenSettings}
                        className="w-10 h-10 flex items-center justify-center hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
                    >
                        <i className="bi bi-gear text-lg"></i>
                    </button>
                </Tooltip>

                <Tooltip label={updating ? "Abriendo actualizador..." : "Actualizar"} placement="top" align="start">
                    <button
                        onClick={handleUpdate}
                        disabled={loading || updating}
                        className={`
                            w-10 h-10 flex items-center justify-center
                            hover:bg-white/5 text-gray-400 hover:text-white
                            transition-colors
                            ${(loading || updating) ? 'opacity-50 cursor-not-allowed' : ''}
                        `}
                    >
                        <i className={`bi bi-arrow-clockwise text-lg ${(loading || updating) ? 'animate-spin' : ''}`}></i>
                    </button>
                </Tooltip>
            </div>

            <div className="absolute bottom-4 right-6 flex flex-col items-center gap-2 select-none">
                <SystemMonitorRings size={40} />
                <span className="text-[10px] font-mono text-gray-600 tracking-widest uppercase opacity-50 pointer-events-none">
                    v{appVersion}
                </span>
            </div>

        </div>
    );
}

export default Dashboard;