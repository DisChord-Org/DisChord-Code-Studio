import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { FileNode, GotoTarget, OpenTab } from "./types";
import { packagesTabId, shortcutsTabId } from "./types";
import { remapPath } from "./pathUtils";
import { addFileTab, fallbackAfterClose, remapTabs, removeDeletedTabs } from "./tabsLogic";
import { restoreTabsSession, saveTabsSession } from "./tabsSession";
import { confirmAction } from "../../utils/Dialogs";

/** Open tabs of a project: opening, closing, editing, path changes and session persistence. */
export const useOpenTabs = (projectName: string) => {
    const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
    const [activeTabPath, setActiveTabPath] = useState<string | null>(null);
    const [restoredProject, setRestoredProject] = useState<string | null>(null);
    const [gotoTarget, setGotoTarget] = useState<GotoTarget | null>(null);

    // Mirrors of the state so handlers called from stale closures (shortcuts, listeners) read current values.
    const openTabsRef = useRef<OpenTab[]>([]);
    const activeTabPathRef = useRef<string | null>(null);

    useEffect(() => {
        openTabsRef.current = openTabs;
    }, [openTabs]);

    useEffect(() => {
        activeTabPathRef.current = activeTabPath;
    }, [activeTabPath]);

    useEffect(() => {
        setOpenTabs([]);
        setActiveTabPath(null);

        // Saving is held back until the saved tabs are back, or the empty list would overwrite them.
        setRestoredProject(null);
        let cancelled = false;
        restoreTabsSession(projectName).then(({ tabs, active }) => {
            if (cancelled) return;
            setOpenTabs(tabs);
            setActiveTabPath(active);
            setRestoredProject(projectName);
        });

        return () => {
            cancelled = true;
        };
    }, [projectName]);

    useEffect(() => {
        // Compared by name so a render right after a project switch never files the old tabs under the new project.
        if (restoredProject === projectName) saveTabsSession(projectName, openTabs, activeTabPath);
    }, [restoredProject, openTabs, activeTabPath, projectName]);

    // Closing the window with unsaved files asks first; the Rust side exits once the window is really gone.
    useEffect(() => {
        let closing = false;
        const unlisten = getCurrentWindow().onCloseRequested(async (event) => {
            if (closing) return;
            const dirty = openTabsRef.current.filter(t => t.isDirty);
            if (dirty.length === 0) return;

            event.preventDefault();
            const confirmed = await confirmAction(
                `Tienes cambios sin guardar en ${dirty.map(t => `"${t.name}"`).join(", ")}. ¿Quieres cerrar la aplicación de todos modos? Se perderán.`,
                "Cerrar",
                { title: "Cambios sin guardar", detail: "Los cambios sin guardar se perderán." }
            );
            if (!confirmed) return;

            closing = true;
            await getCurrentWindow().close();
        });

        return () => {
            unlisten.then(fn => fn());
        };
    }, []);

    useEffect(() => {
        setGotoTarget(null);
    }, [activeTabPath]);

    const handleFileSelect = async (node: FileNode) => {
        if (node.is_dir) return;

        setActiveTabPath(node.relative_path);

        if (openTabsRef.current.some(t => t.relative_path === node.relative_path)) return;

        try {
            const text = await invoke<string>("read_file_content", {
                projectName,
                filePath: node.relative_path
            });

            setOpenTabs(prev => addFileTab(prev, {
                kind: "file",
                relative_path: node.relative_path,
                name: node.name,
                content: text,
                isDirty: false,
                isPinned: false,
            }));
        } catch (error) {
            console.error("Error al leer archivo:", error);
        }
    };

    const openFileAt = async (path: string, line: number, column: number) => {
        await handleFileSelect({ name: path.split("/").pop() ?? path, relative_path: path, is_dir: false } as FileNode);
        setGotoTarget({ path, line, column, nonce: Date.now() });
    };

    /** An item was renamed or moved: keep its open tabs (and everything under a moved folder) pointing at it. */
    const handlePathMoved = (from: string, to: string) => {
        setOpenTabs(prev => remapTabs(prev, from, to));
        setActiveTabPath(prev => (prev ? remapPath(prev, from, to) : prev));
    };

    /** An item was deleted: close its tabs (and those of everything under a deleted folder) without asking. */
    const handlePathDeleted = (path: string) => {
        const result = removeDeletedTabs(openTabsRef.current, activeTabPathRef.current, path);
        if (!result) return;

        setOpenTabs(result.remaining);
        if (result.activeGone) setActiveTabPath(result.nextActive);
    };

    /** Opens (or focuses) one of the tabs that are not files. */
    const openSpecialTab = (tab: OpenTab) => {
        setActiveTabPath(tab.relative_path);

        setOpenTabs(prev => (prev.some(t => t.relative_path === tab.relative_path) ? prev : [...prev, tab]));
    };

    const openPackagesTab = () => openSpecialTab({
        kind: "packages",
        relative_path: packagesTabId,
        name: "Dependencias",
        content: "",
        isDirty: false,
        isPinned: true,
    });

    const openShortcutsTab = () => openSpecialTab({
        kind: "shortcuts",
        relative_path: shortcutsTabId,
        name: "Atajos de teclado",
        content: "",
        isDirty: false,
        isPinned: true,
    });

    const closeTab = async (path: string) => {
        const tab = openTabsRef.current.find(t => t.relative_path === path);
        if (tab?.isDirty) {
            const confirmed = await confirmAction(
                `Tienes cambios sin guardar en "${tab.name}". ¿Quieres cerrarlo de todos modos? Se perderán.`,
                "Cerrar",
                { title: "Cambios sin guardar", detail: "Los cambios sin guardar se perderán." }
            );
            if (!confirmed) return;
        }

        setOpenTabs(prev => {
            const idx = prev.findIndex(t => t.relative_path === path);
            const next = prev.filter(t => t.relative_path !== path);

            if (activeTabPathRef.current === path) setActiveTabPath(fallbackAfterClose(next, idx));

            return next;
        });
    };

    const closeActiveTab = () => {
        if (activeTabPathRef.current) closeTab(activeTabPathRef.current);
    };

    /** Focuses the nth open tab (1-based); does nothing if there is none. */
    const activateTabAt = (position: number) => {
        const tab = openTabsRef.current[position - 1];
        if (tab) setActiveTabPath(tab.relative_path);
    };

    const updateTabContent = (path: string, value: string) => {
        setOpenTabs(prev => prev.map(t =>
            t.relative_path === path ? { ...t, content: value, isDirty: true, isPinned: true } : t
        ));
    };

    const setTabDirty = (path: string, value: boolean) => {
        setOpenTabs(prev => prev.map(t =>
            t.relative_path === path ? { ...t, isDirty: value } : t
        ));
    };

    const activeTab = openTabs.find(t => t.relative_path === activeTabPath) ?? null;

    return {
        openTabs,
        activeTabPath,
        activeTab,
        gotoTarget,
        setActiveTabPath,
        handleFileSelect,
        openFileAt,
        handlePathMoved,
        handlePathDeleted,
        openPackagesTab,
        openShortcutsTab,
        closeTab,
        closeActiveTab,
        activateTabAt,
        updateTabContent,
        setTabDirty,
    };
};
