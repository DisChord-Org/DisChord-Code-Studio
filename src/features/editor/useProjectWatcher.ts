import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { FileNode } from "./types";

/** Keeps the project file tree loaded and in sync with changes on disk. */
export const useProjectWatcher = (projectName: string) => {
    const [fileTree, setFileTree] = useState<FileNode[]>([]);

    const refreshFiles = useCallback(async () => {
        try {
            setFileTree(await invoke<FileNode[]>("read_project_files", { name: projectName }));
        } catch (error) {
            console.error("Error al refrescar explorador:", error);
        }
    }, [projectName]);

    useEffect(() => {
        invoke<FileNode[]>("read_project_files", { name: projectName })
            .then(setFileTree)
            .catch(console.error);
    }, [projectName]);

    useEffect(() => {
        invoke("watch_project", { projectName }).catch(console.error);

        const unlisten = listen<string>("project-files-changed", (event) => {
            if (event.payload === projectName) refreshFiles();
        });

        return () => {
            unlisten.then((cleanup) => cleanup());
            invoke("unwatch_project").catch(console.error);
        };
    }, [projectName, refreshFiles]);

    return { fileTree, refreshFiles };
};
