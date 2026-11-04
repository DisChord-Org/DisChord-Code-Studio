import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { FileNode } from "./types";

export const useProjectWatcher = (projectName: string, onChange?: () => void) => {
    const [fileTree, setFileTree] = useState<FileNode[]>([]);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

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

        let settle: ReturnType<typeof setTimeout> | undefined;
        const unlisten = listen<string>("project-files-changed", (event) => {
            if (event.payload !== projectName) return;
            refreshFiles();
            clearTimeout(settle);
            settle = setTimeout(() => onChangeRef.current?.(), 300);
        });

        return () => {
            clearTimeout(settle);
            unlisten.then((cleanup) => cleanup());
            invoke("unwatch_project").catch(console.error);
        };
    }, [projectName, refreshFiles]);

    return { fileTree, refreshFiles };
};
