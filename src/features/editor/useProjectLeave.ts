import { confirmAction } from "../../utils/Dialogs";
import type { OpenTab } from "./types";

interface UseProjectLeaveArgs {
    projectName: string;
    openTabs: OpenTab[];
    isRunning: boolean;
    stopRun: () => Promise<void>;
    onBack: () => void;
    onSwitchProject?: (name: string) => void;
}

/** Leaving or switching the project: asks before discarding unsaved files and stops a running bot first. */
export const useProjectLeave = ({ projectName, openTabs, isRunning, stopRun, onBack, onSwitchProject }: UseProjectLeaveArgs) => {
    const confirmLeaveProject = async (): Promise<boolean> => {
        const dirtyTabs = openTabs.filter(t => t.isDirty);
        if (dirtyTabs.length === 0) return true;
        return confirmAction(
            dirtyTabs.length === 1
                ? `Tienes cambios sin guardar en "${dirtyTabs[0].name}". ¿Quieres salir de todos modos? Se perderán.`
                : `Tienes cambios sin guardar en ${dirtyTabs.length} ficheros. ¿Quieres salir de todos modos? Se perderán.`,
            "Salir",
            { title: "Cambios sin guardar", detail: "Los cambios sin guardar se perderán." }
        );
    };

    const handleBack = async () => {
        if (!(await confirmLeaveProject())) return;

        if (isRunning) await stopRun();

        onBack();
    };

    const handleSwitchProject = async (name: string) => {
        if (name === projectName) return;
        if (!(await confirmLeaveProject())) return;
        if (!onSwitchProject) return;

        onSwitchProject(name);
    };

    return { handleBack, handleSwitchProject };
};
