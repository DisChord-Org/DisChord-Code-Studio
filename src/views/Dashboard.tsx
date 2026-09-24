import { useState } from "react";

import { Button, Title, Label, Modal, Tooltip, WindowControls } from "../components/ui";
import { ProjectCard, CreatingProjectCard, useDashboard } from "../features/dashboard";
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

    return (
        <div data-tauri-drag-region className="relative flex flex-col h-screen bg-app-bg overflow-hidden select-none">
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

            <div data-tauri-drag-region className="flex flex-col flex-1 min-h-0 px-12 pt-12">
            <Title>DisChord Code Studio</Title>

            <div className="flex flex-col flex-1 min-h-0 max-w-2xl w-full">
                <div className="flex justify-between items-end mb-4 shrink-0">
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
                    <div className="custom-scrollbar flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1">
                    <div
                        key={config.view_mode}
                        className={`animate-in fade-in duration-300 ${
                            config.view_mode === "grid"
                                ? "grid grid-cols-2 gap-3 content-start"
                                : "grid gap-3 content-start"
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
                    </div>
                ) : (
                    <div className="p-8 border-2 border-dashed border-border rounded-xl text-center">
                        <p className="text-gray-500 text-sm">No existen proyectos.</p>
                    </div>
                )}
            </div>
            </div>

            <div data-tauri-drag-region className="flex items-end justify-between shrink-0 pr-6 pt-3">
            <div className="flex items-center z-50">
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

            <div className="flex items-center gap-4 pb-3">
                <span className="text-[10px] font-mono text-gray-600 tracking-widest uppercase opacity-50 pointer-events-none">
                    v{appVersion}
                </span>
                <SystemMonitorRings size={40} />
            </div>
            </div>
        </div>
    );
}

export default Dashboard;