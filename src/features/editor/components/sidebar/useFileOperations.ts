import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { FileNode } from "../../types";
import { isSameOrInside, joinPath, remapPath } from "../../pathUtils";
import { confirmAction } from "../../../../utils/Dialogs";

export interface CreatingState {
    type: "file" | "folder";
    parentPath: string;
}

interface UseFileOperationsOptions {
    projectName: string;
    onFileClick: (node: FileNode) => void;
    onRefresh: () => void;
    onPathMoved: (from: string, to: string) => void;
    onPathDeleted: (path: string) => void;
    expand: (path: string) => void;
    setExpandedPaths: React.Dispatch<React.SetStateAction<Set<string>>>;
    setSelectedPath: React.Dispatch<React.SetStateAction<string | null>>;
    setNotice: (message: string) => void;
}

/** Create / rename / move / delete of project items, plus the inline-input state they drive. */
export const useFileOperations = ({
    projectName, onFileClick, onRefresh, onPathMoved, onPathDeleted, expand, setExpandedPaths, setSelectedPath, setNotice,
}: UseFileOperationsOptions) => {
    const [creating, setCreating] = useState<CreatingState | null>(null);
    const [renamingPath, setRenamingPath] = useState<string | null>(null);

    const startCreate = (type: "file" | "folder", parentPath: string) => {
        setRenamingPath(null);
        if (parentPath) expand(parentPath);
        setCreating({ type, parentPath });
    };

    const startRename = (path: string) => {
        setCreating(null);
        setRenamingPath(path);
    };

    const submitCreate = async (name: string): Promise<string | null> => {
        if (!creating) return null;

        try {
            await invoke(creating.type === "file" ? "create_new_file" : "create_new_folder", {
                projectName,
                parentPath: creating.parentPath,
                name,
            });
        } catch (error) {
            return String(error);
        }

        const created = joinPath(creating.parentPath, name);
        const wasFile = creating.type === "file";
        setCreating(null);
        setSelectedPath(created);
        onRefresh();
        if (wasFile) onFileClick({ name, relative_path: created, is_dir: false });
        return null;
    };

    const relocated = (from: string, to: string) => {
        setSelectedPath(prev => (prev ? remapPath(prev, from, to) : prev));
        setExpandedPaths(prev => new Set(Array.from(prev, path => remapPath(path, from, to))));
        onPathMoved(from, to);
        onRefresh();
    };

    const submitRename = async (path: string, name: string): Promise<string | null> => {
        try {
            const moved = await invoke<string>("rename_item", { projectName, path, newName: name });
            setRenamingPath(null);
            relocated(path, moved);
            return null;
        } catch (error) {
            return String(error);
        }
    };

    const moveInto = async (path: string, targetDir: string) => {
        try {
            const moved = await invoke<string>("move_item", { projectName, path, targetDir });
            if (targetDir) expand(targetDir);
            relocated(path, moved);
        } catch (error) {
            setNotice(String(error));
        }
    };

    const deleteItem = async (path: string) => {
        if (await confirmAction(`¿Seguro que quieres borrar ${path}?`, "Borrar")) {
            try {
                await invoke("delete_item", { projectName, path });
                setSelectedPath(prev => (prev !== null && isSameOrInside(prev, path) ? null : prev));
                onPathDeleted(path);
                onRefresh();
            } catch (e) { setNotice(String(e)); }
        }
    };

    return {
        creating, setCreating, renamingPath, setRenamingPath,
        startCreate, startRename, submitCreate, submitRename, moveInto, deleteItem,
    };
};
