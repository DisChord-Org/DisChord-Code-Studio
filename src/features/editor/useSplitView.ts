import { useEffect, useRef, useState } from "react";
import { notify } from "../../utils/Toasts";
import type { OpenTab } from "./types";
import { neighbourOnLeft, partitionTabs, pruneRightPane } from "./splitLogic";

export const useSplitView = (openTabs: OpenTab[], activeTabPath: string | null, setActiveTabPath: (path: string | null) => void) => {
    const [rightPaths, setRightPaths] = useState<string[]>([]);
    const [rightActive, setRightActive] = useState<string | null>(null);
    const lastLeftActive = useRef<string | null>(null);

    const onRight = (path: string) => rightPaths.includes(path);
    const { leftTabs, rightTabs, rightActiveTab } = partitionTabs(openTabs, rightPaths, rightActive);

    useEffect(() => {
        const { paths, active } = pruneRightPane(rightPaths, rightActive, openTabs);
        if (paths.length !== rightPaths.length) setRightPaths(paths);
        if (active !== rightActive) setRightActive(active);
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
            setActiveTabPath(neighbourOnLeft(leftTabs, path));
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
