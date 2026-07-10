import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getVersion } from "@tauri-apps/api/app";

import { Button } from "../components/Button";
import { Card } from "../components/ProjectCard";
import { Title, Label } from "../components/Typography";
import { Modal } from "../components/Modal";
import { formatRelativeTime } from "../utils/Time";

interface DashboardProps {
    onSelectProject: (name: string) => void;
}

type ViewMode = "list" | "grid";

const appWindow = getCurrentWindow();

function Dashboard({ onSelectProject }: DashboardProps) {
    const [projects, setProjects] = useState<{name: string, last_modified: string}[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [appVersion, setAppVersion] = useState<string>("");
    const [viewMode, setViewMode] = useState<ViewMode>("list");

    useEffect(() => {
        getVersion().then(setAppVersion);
    }, []);

    const loadProjects = async () => {
        try {
            await invoke("create_projects_folder");
            const list = await invoke<{name: string, last_modified: string}[]>("get_projects");
            setProjects(list);
        } catch (error) {
            console.error("Fallo al cargar proyectos:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadProjects();
    }, []);

    const handleCreateProject = async (name: string) => {
        if (!name) return;
        
        try {
            await invoke("create_new_project", { name });
            await loadProjects();
        } catch (error) {
            alert(error);
        }
    };

    const handleDeleteProject = async (name: string) => {
        const confirm = window.confirm(`¿Estás seguro de que quieres borrar el proyecto "${name}"? Esta acción es irreversible.`);

        if (confirm) {
            try {
                await invoke("delete_project", { name }); 
                await loadProjects();
            } catch (error) {
                alert("No se pudo borrar el proyecto: " + error);
            }
        }
    };

    const handleClose = async () => {
        await appWindow.close();
    };

    const handleUpdate = async () => {
        if (updating) return;
        setUpdating(true);
        try {
            // Abre la ventana de progreso y dispara la comprobación de
            // IDE + CLI + Compilador. La UI de progreso vive ahora en
            // esa ventana; el Dashboard solo dispara la acción.
            await invoke("start_full_update");
        } catch (error) {
            alert("Error: " + error);
        } finally {
            setUpdating(false);
        }
    };

    return (
        <div data-tauri-drag-region className="relative min-h-screen bg-[#0B0E14] rounded-xl border border-[#1e1f22] p-12 overflow-hidden select-none">
            <div className="absolute top-0 right-0 flex items-center h-10 z-50">
                <div className="flex items-center h-full ml-2">
                    <button 
                        onClick={handleClose}
                        className="w-10 h-10 flex items-center justify-center hover:bg-red-500 hover:text-white text-gray-400 transition-colors"
                    >
                        <i className="bi bi-x-lg"></i>
                    </button>
                </div>
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
                    <Label>Tus Workflows</Label>

                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-0.5 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-md p-0.5 transition-colors duration-200">
                            <button
                                onClick={() => setViewMode("list")}
                                title="Vista de lista"
                                className={`relative flex items-center justify-center w-5 h-5 rounded transition-all duration-200 ${
                                    viewMode === "list"
                                        ? "bg-[#5865F2] text-white shadow-sm"
                                        : "text-gray-600 hover:text-gray-300"
                                }`}
                            >
                                <i className="bi bi-list-ul text-[10px]"></i>
                            </button>
                            <button
                                onClick={() => setViewMode("grid")}
                                title="Vista de cuadrícula"
                                className={`relative flex items-center justify-center w-5 h-5 rounded transition-all duration-200 ${
                                    viewMode === "grid"
                                        ? "bg-[#5865F2] text-white shadow-sm"
                                        : "text-gray-600 hover:text-gray-300"
                                }`}
                            >
                                <i className="bi bi-grid-3x3-gap-fill text-[10px]"></i>
                            </button>
                        </div>

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
                ) : projects.length > 0 ? (
                    <div
                        key={viewMode}
                        className={`animate-in fade-in duration-300 ${
                            viewMode === "grid"
                                ? "grid grid-cols-2 gap-3"
                                : "grid gap-3"
                        }`}
                    >
                        {projects.map((project, i) => (
                            <div
                                key={project.name}
                                className="animate-in fade-in zoom-in-95 duration-300"
                                style={{ animationDelay: `${i * 30}ms`, animationFillMode: "backwards" }}
                            >
                                <Card
                                    title={project.name}
                                    subtitle={`Última edición: ${formatRelativeTime(project.last_modified)}`}
                                    onDelete={() => handleDeleteProject(project.name)}
                                    onClick={() => onSelectProject(project.name)}
                                />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-8 border-2 border-dashed border-[#1e1f22] rounded-xl text-center">
                        <p className="text-gray-500 text-sm">No existen proyectos.</p>
                    </div>
                )}
            </div>
            
            <div className="absolute bottom-0 left-0 group z-50">
                <div className="absolute bottom-full left-2 mb-1 bg-[#1e1f22] text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-white/5 whitespace-nowrap shadow-xl">
                    {updating ? "Abriendo actualizador..." : "Actualizar"}
                </div>
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
            </div>

            <div className="absolute bottom-4 right-6 pointer-events-none select-none">
                <span className="text-[10px] font-mono text-gray-600 tracking-widest uppercase opacity-50">
                    v{appVersion}
                </span>
            </div>

        </div>
    );
}

export default Dashboard;