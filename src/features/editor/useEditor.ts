import { useEffect, useRef, useState } from "react";
import type { CodeCanvasHandle, MinimapViewport } from "./types";
import { gotoTabId, useShortcuts } from "../shortcuts";
import { useWindowLayout } from "./useWindowLayout";
import { useOpenTabs } from "./useOpenTabs";
import { useRunControl } from "./useRunControl";
import { useProjectWatcher } from "./useProjectWatcher";
import { useProjectLeave } from "./useProjectLeave";

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

    const { handleBack, handleSwitchProject } = useProjectLeave({
        projectName,
        openTabs,
        isRunning: run.isRunning,
        stopRun: run.stopRun,
        onBack,
        onSwitchProject,
    });

    return {
        fileTree,
        refreshFiles,
        isMaximized,
        tabs,
        run,
        codeCanvasRef,
        minimapViewport,
        setMinimapViewport,
        handleBack,
        handleSwitchProject,
    };
};
