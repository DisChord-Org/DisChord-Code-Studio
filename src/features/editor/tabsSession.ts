import { invoke } from "@tauri-apps/api/core";
import { baseName } from "./pathUtils";
import { PACKAGES_TAB_ID, type OpenTab } from "./types";

interface SavedTab {
    path: string;
    isPinned: boolean;
}

interface SavedSession {
    tabs: SavedTab[];
    active: string | null;
}

const storageKey = (projectName: string) => `dischord:editor-tabs:${projectName}`;

/** Remembers which tabs are open (not their content: files are read again from disk on restore). */
export const saveTabsSession = (projectName: string, tabs: OpenTab[], active: string | null) => {
    const session: SavedSession = {
        tabs: tabs.map((t) => ({ path: t.relative_path, isPinned: t.isPinned })),
        active,
    };

    try {
        localStorage.setItem(storageKey(projectName), JSON.stringify(session));
    } catch {
        // Best-effort persistence; losing the open tabs isn't worth surfacing an error for.
    }
};

const readSession = (projectName: string): SavedSession | null => {
    try {
        const raw = localStorage.getItem(storageKey(projectName));
        if (!raw) return null;

        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed?.tabs)) return null;

        const tabs = parsed.tabs.filter((t: unknown): t is SavedTab => typeof (t as SavedTab)?.path === "string");
        return { tabs, active: typeof parsed.active === "string" ? parsed.active : null };
    } catch {
        return null;
    }
};

const packagesTab = (): OpenTab => ({
    kind: "packages",
    relative_path: PACKAGES_TAB_ID,
    name: "Dependencias",
    content: "",
    isDirty: false,
    isPinned: true,
});

/** Rebuilds the tabs saved for a project, silently skipping files that no longer exist. */
export const restoreTabsSession = async (projectName: string): Promise<{ tabs: OpenTab[]; active: string | null }> => {
    const session = readSession(projectName);
    if (!session) return { tabs: [], active: null };

    const load = async (saved: SavedTab): Promise<OpenTab | null> => {
        if (saved.path === PACKAGES_TAB_ID) return packagesTab();

        try {
            const content = await invoke<string>("read_file_content", { projectName, filePath: saved.path });
            return { kind: "file", relative_path: saved.path, name: baseName(saved.path), content, isDirty: false, isPinned: saved.isPinned };
        } catch {
            return null;
        }
    };

    // Reading a file also updates the Discord presence, so the active file goes last.
    const others = await Promise.all(session.tabs.filter((t) => t.path !== session.active).map(load));
    const activeSaved = session.tabs.find((t) => t.path === session.active);
    const activeTab = activeSaved ? await load(activeSaved) : null;

    const byPath = new Map<string, OpenTab>();
    [...others, activeTab].forEach((tab) => tab && byPath.set(tab.relative_path, tab));

    const tabs = session.tabs.map((t) => byPath.get(t.path)).filter((t): t is OpenTab => t !== undefined);
    const active = activeTab ? activeTab.relative_path : (tabs[tabs.length - 1]?.relative_path ?? null);

    return { tabs, active };
};
