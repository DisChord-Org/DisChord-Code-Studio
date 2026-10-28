import type { OpenTab } from "./types";
import { baseName, isSameOrInside, remapPath } from "./pathUtils";

/** Adds a freshly opened file: it takes the place of the unpinned "preview" file tab if there is one. */
export const addFileTab = (tabs: OpenTab[], newTab: OpenTab): OpenTab[] => {
    if (tabs.some(t => t.relative_path === newTab.relative_path)) return tabs;

    const previewIndex = tabs.findIndex(t => t.kind === "file" && !t.isPinned);
    if (previewIndex === -1) return [...tabs, newTab];

    const next = [...tabs];
    next[previewIndex] = newTab;
    return next;
};

/** Open tabs after `from` (a file or a folder) was renamed or moved to `to`. */
export const remapTabs = (tabs: OpenTab[], from: string, to: string): OpenTab[] =>
    tabs.map(t => {
        const path = remapPath(t.relative_path, from, to);
        return path === t.relative_path || t.kind !== "file" ? t : { ...t, relative_path: path, name: baseName(path) };
    });

/** Tab to focus once the tab at `index` is gone from `remaining`: the one that took its place, else the one before. */
export const fallbackAfterClose = (remaining: OpenTab[], index: number): string | null =>
    (remaining[index] ?? remaining[index - 1] ?? null)?.relative_path ?? null;

/**
 * Tabs left after `deleted` (a file or a folder) was removed from disk, and the tab to focus if the active one went with it.
 * Returns null when no open tab was affected.
 */
export const removeDeletedTabs = (tabs: OpenTab[], activePath: string | null, deleted: string) => {
    const isGone = (t: OpenTab) => t.kind === "file" && isSameOrInside(t.relative_path, deleted);
    if (!tabs.some(isGone)) return null;

    const remaining = tabs.filter(t => !isGone(t));
    const activeIndex = tabs.findIndex(t => t.relative_path === activePath);
    const activeGone = activeIndex !== -1 && isGone(tabs[activeIndex]);
    const fallback = activeGone
        ? (tabs.slice(activeIndex + 1).find(t => !isGone(t)) ?? remaining[remaining.length - 1] ?? null)
        : null;

    return { remaining, activeGone, nextActive: fallback?.relative_path ?? null };
};
