import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

import { Button } from "../components/Button";
import { Card } from "../components/ProjectCard";
import { Title, Label } from "../components/Typography";
import { Modal } from "../components/Modal";

interface DashboardProps {
    onSelectProject: (name: string) => void;
}

const appWindow = getCurrentWindow();

function Dashboard({ onSelectProject }: DashboardProps) {
    const [projects, setProjects] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const loadProjects = async () => {
        try {
            await invoke("create_projects_folder");
            const list = await invoke<string[]>("get_projects");
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
                        {projects.map((name) => (
                            <Card
                                key={name}
                                title={name}
                                subtitle="Última edición: ahora"
                                onDelete={() => handleDeleteProject(name)}
                                onClick={() => onSelectProject(name)}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="p-8 border-2 border-dashed border-[#1e1f22] rounded-xl text-center">
                        <p className="text-gray-500 text-sm">No existen proyectos.</p>
                    </div>
                )}
            </div>

        </div>
    );
}

export default Dashboard;