import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { FileNode, GotoTarget, OpenTab } from "./types";
import { packagesTabId, shortcutsTabId } from "./types";
import { remapPath } from "./pathUtils";
import { addFileTab, fallbackAfterClose, remapTabs, removeDeletedTabs } from "./tabsLogic";
import { restoreTabsSession, saveTabsSession } from "./tabsSession";
import { chooseAction, confirmAction } from "../../utils/Dialogs";
import { decideDiskChange, decideSaveGuard } from "./diskConflict";
import { notify } from "../../utils/Toasts";

export const useOpenTabs = (projectName: string) => {
    const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
    const [activeTabPath, setActiveTabPath] = useState<string | null>(null);
    const [restoredProject, setRestoredProject] = useState<string | null>(null);
    const [gotoTarget, setGotoTarget] = useState<GotoTarget | null>(null);

    const openTabsRef = useRef<OpenTab[]>([]);
    const activeTabPathRef = useRef<string | null>(null);

    openTabsRef.current = openTabs;
    activeTabPathRef.current = activeTabPath;

    useEffect(() => {
        setOpenTabs([]);
        setActiveTabPath(null);

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
        if (restoredProject === projectName) saveTabsSession(projectName, openTabs, activeTabPath);
    }, [restoredProject, openTabs, activeTabPath, projectName]);

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

        const previousActive = activeTabPathRef.current;
        setActiveTabPath(node.relative_path);

        if (openTabsRef.current.some(t => t.relative_path === node.relative_path)) return;

        try {
            const text = await invoke<string>("read_file_content", {
                projectName,
                filePath: node.relative_path
            });

            diskBase.current.set(node.relative_path, text);
            askedDisk.current.delete(node.relative_path);
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
            notify("error", `No se pudo abrir "${node.name}".`, [String(error)]);

            setActiveTabPath(prev => (prev === node.relative_path ? previousActive : prev));
        }
    };

    const openFileAt = async (path: string, line: number, column: number) => {
        await handleFileSelect({ name: path.split("/").pop() ?? path, relative_path: path, is_dir: false } as FileNode);
        setGotoTarget({ path, line, column, nonce: Date.now() });
    };

    const handlePathMoved = (from: string, to: string) => {
        setOpenTabs(prev => remapTabs(prev, from, to));
        setActiveTabPath(prev => (prev ? remapPath(prev, from, to) : prev));
    };

    const handlePathDeleted = (path: string) => {
        const result = removeDeletedTabs(openTabsRef.current, activeTabPathRef.current, path);
        if (!result) return;

        setOpenTabs(result.remaining);
        if (result.activeGone) setActiveTabPath(result.nextActive);
    };

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
        if (!value) {
            const saved = openTabsRef.current.find(t => t.relative_path === path);
            if (saved) diskBase.current.set(path, saved.content);
            askedDisk.current.delete(path);
        }
        setOpenTabs(prev => prev.map(t =>
            t.relative_path === path ? { ...t, isDirty: value } : t
        ));
    };

    const diskBase = useRef(new Map<string, string>());
    const askedDisk = useRef(new Map<string, string>());
    const asking = useRef(new Set<string>());

    useEffect(() => {
        diskBase.current.clear();
        askedDisk.current.clear();
    }, [projectName]);

    const resolveConflict = async (tab: OpenTab, diskContent: string) => {
        asking.current.add(tab.relative_path);
        try {
            const choice = await chooseAction(
                `"${tab.name}" ha cambiado en el disco y tú tienes cambios sin guardar en el editor.`,
                ["Conservar mis cambios", "Cargar la versión del disco", "Decidir luego"],
                { title: "Conflicto con el disco", detail: "Si conservas tus cambios, el próximo guardado sobrescribirá la versión del disco." }
            );

            const current = openTabsRef.current.find(t => t.relative_path === tab.relative_path);
            if (!current) return;

            askedDisk.current.set(tab.relative_path, diskContent);
            if (choice === 0) {
                diskBase.current.set(tab.relative_path, diskContent);
            } else if (choice === 1) {
                diskBase.current.set(tab.relative_path, diskContent);
                setOpenTabs(prev => prev.map(t =>
                    t.relative_path === tab.relative_path ? { ...t, content: diskContent, isDirty: false } : t
                ));
            }
        } finally {
            asking.current.delete(tab.relative_path);
        }
    };

    const guardSave = async (path: string, content: string): Promise<"save" | "cancel" | "reloaded"> => {
        if (asking.current.has(path)) return "cancel";

        let diskContent: string | undefined;
        try {
            diskContent = await invoke<string>("read_file_content", { projectName, filePath: path });
        } catch {
            return "save";
        }
        if (decideSaveGuard({ saveContent: content, baseContent: diskBase.current.get(path), diskContent }) === "save") return "save";

        asking.current.add(path);
        try {
            const name = openTabsRef.current.find(t => t.relative_path === path)?.name ?? path;
            const choice = await chooseAction(
                `"${name}" ha cambiado en el disco desde que lo abriste o lo revisaste.`,
                ["Sobrescribir el disco", "Cargar la versión del disco", "Cancelar"],
                { title: "Conflicto con el disco", detail: "Si sobrescribes, se perderá la versión que hay en el disco." }
            );
            if (choice === 0) return "save";
            if (choice === 1) {
                diskBase.current.set(path, diskContent);
                askedDisk.current.set(path, diskContent);
                setOpenTabs(prev => prev.map(t => t.relative_path === path ? { ...t, content: diskContent, isDirty: false } : t));
                return "reloaded";
            }
            return "cancel";
        } finally {
            asking.current.delete(path);
        }
    };

    const reloadCleanTabs = async () => {
        const files = openTabsRef.current.filter(t => t.kind === "file");
        const fresh = await Promise.all(files.map(async t => {
            try {
                return [t.relative_path, await invoke<string>("read_file_content", { projectName, filePath: t.relative_path })] as const;
            } catch {
                return null;
            }
        }));
        const contents = new Map(fresh.filter((f): f is readonly [string, string] => f !== null));

        const conflicts: [OpenTab, string][] = [];
        for (const tab of openTabsRef.current) {
            const disk = contents.get(tab.relative_path);
            if (disk === undefined || asking.current.has(tab.relative_path)) continue;

            const action = decideDiskChange({
                isDirty: tab.isDirty,
                tabContent: tab.content,
                baseContent: diskBase.current.get(tab.relative_path),
                diskContent: disk,
                askedContent: askedDisk.current.get(tab.relative_path),
            });
            if (action === "conflict") conflicts.push([tab, disk]);
            else if (action === "ignore" && tab.isDirty && disk === tab.content) diskBase.current.set(tab.relative_path, disk);
            if (action === "reload") diskBase.current.set(tab.relative_path, disk);
            if (!tab.isDirty) diskBase.current.set(tab.relative_path, disk);
        }

        setOpenTabs(prev => prev.map(t => {
            const content = contents.get(t.relative_path);
            return content !== undefined && !t.isDirty && content !== t.content ? { ...t, content } : t;
        }));

        for (const [tab, disk] of conflicts) await resolveConflict(tab, disk);
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
        guardSave,
        reloadCleanTabs,
    };
};
