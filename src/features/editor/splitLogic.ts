import type { OpenTab } from "./types";

/** Splits the open tabs between the two panes. The right pane keeps the order in which tabs were moved there. */
export const partitionTabs = (openTabs: OpenTab[], rightPaths: string[], rightActive: string | null) => {
    const rightTabs = rightPaths.flatMap(path => openTabs.filter(t => t.relative_path === path));
    const leftTabs = openTabs.filter(t => !rightPaths.includes(t.relative_path));
    const rightActiveTab = rightTabs.find(t => t.relative_path === rightActive) ?? null;

    return { leftTabs, rightTabs, rightActiveTab };
};

/** Right-pane state once some tabs were closed: only still-open tabs stay, and the active one falls back to the last. */
export const pruneRightPane = (rightPaths: string[], rightActive: string | null, openTabs: OpenTab[]) => {
    const paths = rightPaths.filter(path => openTabs.some(t => t.relative_path === path));
    const active = rightActive !== null && !paths.includes(rightActive) ? (paths[paths.length - 1] ?? null) : rightActive;

    return { paths, active };
};

/** Tab the left pane focuses when `path` leaves it: the next one, else the previous one. */
export const neighbourOnLeft = (leftTabs: OpenTab[], path: string): string | null => {
    const index = leftTabs.findIndex(t => t.relative_path === path);
    if (index === -1) return null;

    return (leftTabs[index + 1] ?? leftTabs[index - 1])?.relative_path ?? null;
};
