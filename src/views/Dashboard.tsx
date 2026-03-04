import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";

import { Button } from "../components/Button";
import { Card } from "../components/ProjectCard";
import { Title, Label } from "../components/Typography";
import { Modal } from "../components/Modal";

interface DashboardProps {
    onSelectProject: (name: string) => void;
}

const appWindow = getCurrentWindow();

function Dashboard({ onSelectProject }: DashboardProps) {
    const [projects, setProjects] = useState<{name: string, last_modified: string}[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [statusLogs, setStatusLogs] = useState<{ [key: string]: string }>({});

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

    useEffect(() => {
        const unlisten = listen<string>("update-status", (event) => {
            const msg = event.payload;
        
            setStatusLogs((prev) => {
                const next = { ...prev };
            
                if (msg.toLowerCase().includes("cli")) {
                    next["cli"] = msg;
                } else if (msg.toLowerCase().includes("compilador")) {
                    next["compiler"] = msg;
                } else if (msg.toLowerCase().includes("ide")) {
                    next["ide"] = msg;
                } else if (msg.includes("orden del día") && !msg.includes("Comprobando")) {
                    next["last_status"] = msg;
                } else {
                    next["general"] = msg;
                }

                return next;
            });
        });
        return () => { unlisten.then(f => f()); };
    }, []);

    useEffect(() => {
        const unlisten = listen("update-finished", () => {
            setTimeout(() => {
                setUpdating(false);
                setStatusLogs({});
                loadProjects();
            }, 1500);
        });
        return () => { unlisten.then(f => f()); };
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
        setStatusLogs({ "general": "Iniciando comprobación de sistema..." });
        try {
            await invoke("update_chord_system");
        } catch (error) {
            alert("Error: " + error);
            setUpdating(false);
        }
    };

    const formatRelativeTime = (dateStr: string): string => {
        const now = new Date();
        const then = new Date(dateStr);
        const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);
        const diffInMinutes = Math.floor(diffInSeconds / 60);
        const diffInHours = Math.floor(diffInMinutes / 60);

        if (diffInSeconds < 120) return "Ahora mismo";
        if (diffInMinutes < 5) return "Hace un momento";
        if (diffInMinutes < 30) return "Hace cinco minutos";
        if (diffInMinutes < 60) return `Hace ${diffInMinutes} minutos`;
    
        if (diffInHours >= 1 && diffInHours <= 5) {
            return diffInHours === 1 ? "Hace 1 hora" : `Hace ${diffInHours} horas`;
        }

        const isToday = now.toDateString() === then.toDateString();
        if (isToday && diffInHours > 5) return "Hoy";

        const yesterday = new Date();
        yesterday.setDate(now.getDate() - 1);
        if (yesterday.toDateString() === then.toDateString()) return "Ayer";

        return then.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    return (
        <div className="relative min-h-screen bg-[#0B0E14] rounded-xl border border-[#1e1f22] p-12 overflow-hidden">
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

            <Title>DisChord Studio Code</Title>

            <div className="max-w-2xl">
                {updating? (
                    <div className="mt-12 animate-in fade-in duration-500">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="relative flex items-center justify-center w-2 h-2 -mt-2"> 
                                <div className="absolute w-2 h-2 rounded-full bg-[#5865F2] animate-ping" />
                                <div className="relative w-2 h-2 rounded-full bg-[#5865F2]" />
                            </div>
    
                            <Label>Actualizando componentes de DisChord</Label>
                        </div>
                        
                        <div className="space-y-4 border-l-2 border-[#1e1f22] ml-1 pl-6">
                            {Object.values(statusLogs).map((log, i) => (
                                <p
                                    key={i}
                                    className="text-sm transition-all duration-300 text-white/80"
                                >
                                    {log.includes("orden del día") || log.includes("completada") ? (
                                        <span className="text-green-500 mr-2">✓</span>
                                    ) : (
                                        <span className="text-[#5865F2] mr-2 animate-pulse">→</span>
                                    )}
                                    {log}
                                </p>
                            ))}
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex justify-between items-end mb-4">
                            <Label>Tus Workflows</Label>
                            <Button
                                variant="ghost"
                                className="text-xs"
                                onClick={() => setIsModalOpen(true)}
                            >
                                + Nuevo proyecto
                            </Button>
                        </div>

                        {loading ? (
                            <p className="text-gray-500 animate-pulse">Buscando en Documentos...</p>
                        ) : projects.length > 0 ? (
                            <div className="grid gap-3">
                                {projects.map((project) => (
                                    <Card
                                        key={project.name}
                                        title={project.name}
                                        subtitle={`Última edición: ${formatRelativeTime(project.last_modified)}`}
                                        onDelete={() => handleDeleteProject(project.name)}
                                        onClick={() => onSelectProject(project.name)}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="p-8 border-2 border-dashed border-[#1e1f22] rounded-xl text-center">
                                <p className="text-gray-500 text-sm">No existen proyectos.</p>
                            </div>
                        )}
                    </>
                )}
            </div>
            
            <div className="absolute bottom-0 left-0 group z-50">
                <div className="absolute bottom-full left-2 mb-1 bg-[#1e1f22] text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-white/5 whitespace-nowrap shadow-xl">
                    {updating ? "Actualizando sistema..." : "Actualizar"}
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

        </div>
    );
}

export default Dashboard;