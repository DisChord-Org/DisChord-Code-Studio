import { useEffect, useRef, useState } from "react";
import { notify } from "../../utils/Toasts";
import type { OpenTab } from "./types";

export const useSplitView = (openTabs: OpenTab[], activeTabPath: string | null, setActiveTabPath: (path: string | null) => void) => {
    const [rightPaths, setRightPaths] = useState<string[]>([]);
    const [rightActive, setRightActive] = useState<string | null>(null);
    const lastLeftActive = useRef<string | null>(null);

    const onRight = (path: string) => rightPaths.includes(path);
    const rightTabs = rightPaths.flatMap(path => openTabs.filter(t => t.relative_path === path));
    const leftTabs = openTabs.filter(t => !onRight(t.relative_path));
    const rightActiveTab = rightTabs.find(t => t.relative_path === rightActive) ?? null;

    useEffect(() => {
        const alive = rightPaths.filter(path => openTabs.some(t => t.relative_path === path));
        if (alive.length !== rightPaths.length) setRightPaths(alive);
        if (rightActive !== null && !alive.includes(rightActive)) setRightActive(alive[alive.length - 1] ?? null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [openTabs]);

    useEffect(() => {
        if (activeTabPath !== null && rightPaths.includes(activeTabPath)) {
            setRightActive(activeTabPath);
            const fallback = leftTabs.find(t => t.relative_path === lastLeftActive.current) ?? leftTabs[leftTabs.length - 1] ?? null;
            setActiveTabPath(fallback?.relative_path ?? null);
        } else {
            lastLeftActive.current = activeTabPath;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTabPath, rightPaths]);

    const moveToRight = (path: string) => {
        const tab = leftTabs.find(t => t.relative_path === path);
        if (!tab || tab.kind !== "file") return;
        if (leftTabs.length < 2) {
            notify("info", "Abre otro archivo para dividir el editor.");
            return;
        }
        if (path === activeTabPath) {
            const index = leftTabs.indexOf(tab);
            setActiveTabPath((leftTabs[index + 1] ?? leftTabs[index - 1]).relative_path);
        }
        setRightPaths([...rightPaths, path]);
        setRightActive(path);
    };

    const moveToLeft = (path: string) => {
        const remaining = rightPaths.filter(p => p !== path);
        setRightPaths(remaining);
        if (rightActive === path) setRightActive(remaining[remaining.length - 1] ?? null);
        setActiveTabPath(path);
    };

    const movePane = (path: string) => (onRight(path) ? moveToLeft(path) : moveToRight(path));

    const toggleSplit = () => {
        if (rightPaths.length > 0) {
            setRightPaths([]);
            setRightActive(null);
        } else if (activeTabPath) {
            moveToRight(activeTabPath);
        }
    };

    return { leftTabs, rightTabs, rightActiveTab, setRightActive, isSplit: rightActiveTab !== null, movePane, toggleSplit };
};
