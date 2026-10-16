import { useEffect, useState } from "react";
import { toPosix } from "../../pathUtils";

const expandedPathsStorageKey = (projectName: string) => `dischord:sidebar-expanded:${projectName}`;

const loadExpandedPaths = (projectName: string): Set<string> => {
    try {
        const raw = localStorage.getItem(expandedPathsStorageKey(projectName));
        if (raw) return new Set((JSON.parse(raw) as string[]).map(toPosix));
    } catch {
        // Ignore corrupt/inaccessible storage and fall back to the default below.
    }
    return new Set(["src"]);
};

/** Expanded folders of the tree, remembered per project. */
export const useExpandedPaths = (projectName: string) => {
    const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => loadExpandedPaths(projectName));

    useEffect(() => {
        setExpandedPaths(loadExpandedPaths(projectName));
    }, [projectName]);

    useEffect(() => {
        try {
            localStorage.setItem(expandedPathsStorageKey(projectName), JSON.stringify(Array.from(expandedPaths)));
        } catch {
            // Best-effort persistence; losing the expanded state isn't worth surfacing an error for.
        }
    }, [expandedPaths, projectName]);

    const expand = (path: string) => setExpandedPaths(prev => (prev.has(path) ? prev : new Set(prev).add(path)));

    const toggleExpand = (path: string) => {
        setExpandedPaths(prev => {
            const next = new Set(prev);
            if (next.has(path)) next.delete(path);
            else next.add(path);
            return next;
        });
    };

    return { expandedPaths, setExpandedPaths, expand, toggleExpand };
};
