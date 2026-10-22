import { useEffect, useRef, useState } from "react";
import type { CodeCanvasHandle, MinimapViewport } from "./types";
import { gotoTabId, useShortcuts } from "../shortcuts";
import { useWindowLayout } from "./useWindowLayout";
import { useOpenTabs } from "./useOpenTabs";
import { useRunControl } from "./useRunControl";
import { useProjectWatcher } from "./useProjectWatcher";
import { confirmAction } from "../../utils/Dialogs";

const maxTabShortcuts = 9;

interface UseEditorArgs {
    projectName: string;
    onBack: () => void;
    onSwitchProject?: (name: string) => void;
}

export const useEditor = ({ projectName, onBack, onSwitchProject }: UseEditorArgs) => {
    const codeCanvasRef = useRef<CodeCanvasHandle>(null);
    const [minimapViewport, setMinimapViewport] = useState<MinimapViewport | undefined>(undefined);

    const { isMaximized } = useWindowLayout(projectName);
    const { fileTree, refreshFiles } = useProjectWatcher(projectName);
    const tabs = useOpenTabs(projectName);
    const run = useRunControl(projectName);

    const { handleFileSelect, openTabs, closeActiveTab, activateTabAt, openShortcutsTab } = tabs;

    useEffect(() => {
        const handleOpenHidden = (event: WindowEventMap["open-hidden-file"]) => {
            const { name, relative_path } = event.detail;
            handleFileSelect({ name, relative_path, is_dir: false });
        };

        window.addEventListener("open-hidden-file", handleOpenHidden);
        return () => window.removeEventListener("open-hidden-file", handleOpenHidden);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectName]);

    useShortcuts({
        "file.save": () => window.dispatchEvent(new CustomEvent("dischord-save")),
        "run.toggle": () => run.toggleRun(),
        "help.shortcuts": () => openShortcutsTab(),
        "tab.close": closeActiveTab,
        ...Object.fromEntries(
            Array.from({ length: maxTabShortcuts }, (_, i) => [gotoTabId(i + 1), () => activateTabAt(i + 1)]),
        ),
    });

    const confirmLeaveProject = async (): Promise<boolean> => {
        const dirtyTabs = openTabs.filter(t => t.isDirty);
        if (dirtyTabs.length === 0) return true;
        return confirmAction(
            dirtyTabs.length === 1
                ? `Tienes cambios sin guardar en "${dirtyTabs[0].name}". ¿Quieres salir de todos modos? Se perderán.`
                : `Tienes cambios sin guardar en ${dirtyTabs.length} ficheros. ¿Quieres salir de todos modos? Se perderán.`,
            "Salir"
        );
    };

    const handleBack = async () => {
        if (!(await confirmLeaveProject())) return;

        if (run.isRunning) await run.stopRun();

        onBack();
    };

    const handleSwitchProject = async (name: string) => {
        if (name === projectName) return;
        if (!(await confirmLeaveProject())) return;
        if (!onSwitchProject) return;

        onSwitchProject(name);
    };

    return {
        fileTree,
        openTabs,
        activeTabPath: tabs.activeTabPath,
        activeTab: tabs.activeTab,
        isRunning: run.isRunning,
        showTerminal: run.showTerminal,
        terminalStartTab: run.terminalStartTab,
        outputSignal: run.outputSignal,
        toggleShellTerminal: run.toggleShellTerminal,
        isMaximized,
        codeCanvasRef,
        minimapViewport,
        setActiveTabPath: tabs.setActiveTabPath,
        setShowTerminal: run.setShowTerminal,
        setMinimapViewport,
        handleFileSelect,
        openFileAt: tabs.openFileAt,
        reloadCleanTabs: tabs.reloadCleanTabs,
        handlePathMoved: tabs.handlePathMoved,
        handlePathDeleted: tabs.handlePathDeleted,
        gotoTarget: tabs.gotoTarget,
        openPackagesTab: tabs.openPackagesTab,
        openShortcutsTab,
        closeTab: tabs.closeTab,
        updateActiveTabContent: tabs.updateActiveTabContent,
        setActiveTabDirty: tabs.setActiveTabDirty,
        refreshFiles,
        handleToggleRun: run.toggleRun,
        handleStopRun: run.stopRun,
        handleRestartRun: run.restartRun,
        handleBack,
        handleSwitchProject,
    };
};
