import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import type { ProjectSummary } from "./types";

export const useDashboard = () => {
    const [projects, setProjects] = useState<ProjectSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [creatingProjectName, setCreatingProjectName] = useState<string | null>(null);
    const [updating, setUpdating] = useState(false);
    const [appVersion, setAppVersion] = useState<string>("");

    useEffect(() => {
        getVersion().then(setAppVersion);
    }, []);

    const loadProjects = async () => {
        try {
            await invoke("create_projects_folder");
            const list = await invoke<ProjectSummary[]>("get_projects");
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

        setCreatingProjectName(name);
        try {
            await invoke("create_new_project", { name });
            await loadProjects();
        } catch (error) {
            alert(error);
        } finally {
            setCreatingProjectName(null);
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

    const handleUpdate = async () => {
        if (updating) return;
        setUpdating(true);
        try {
            await invoke("start_full_update");
        } catch (error) {
            alert("Error: " + error);
        } finally {
            setUpdating(false);
        }
    };

    return {
        projects,
        loading,
        creatingProjectName,
        updating,
        appVersion,
        handleCreateProject,
        handleDeleteProject,
        handleUpdate,
    };
};
