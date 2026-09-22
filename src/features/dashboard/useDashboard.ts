import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
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

    // Recompute the ideal window size on focus (not just at startup/on leaving the editor):
    // unplugging a monitor while the Dashboard is already open never triggers those, so the
    // window can keep a size that no longer fits the current display until the user clicks
    // back into the app.
    useEffect(() => {
        const appWindow = getCurrentWindow();
        let cancelled = false;

        const resyncWindowSize = async () => {
            try {
                // Bail if this component already unmounted (e.g. the user opened a project
                // mid-check) or the window is maximized (the editor does that on purpose;
                // forcing our small target size here would immediately un-maximize it).
                if (cancelled || (await appWindow.isMaximized())) return;

                const { width, height } = await invoke<{ width: number; height: number }>("get_home_window_size");
                const current = await appWindow.innerSize();
                const scale = await appWindow.scaleFactor();
                const currentLogical = current.toLogical(scale);

                if (cancelled) return;

                if (Math.abs(currentLogical.width - width) > 4 || Math.abs(currentLogical.height - height) > 4) {
                    await appWindow.setSize(new LogicalSize(width, height));
                    if (!cancelled) await appWindow.center();
                }
            } catch (error) {
                console.error("No se pudo reajustar el tamaño de la ventana:", error);
            }
        };

        const unlisten = appWindow.onFocusChanged(({ payload: focused }) => {
            if (focused) resyncWindowSize();
        });

        return () => {
            cancelled = true;
            unlisten.then((fn) => fn());
        };
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
