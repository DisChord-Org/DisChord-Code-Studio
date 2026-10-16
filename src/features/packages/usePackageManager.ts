import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { PackageEntry, PkgOp, PkgOpOutcome, PkgProgressEvent, ProjectLibrary } from "./types";
import { describeOutcome, friendlyError, opKey } from "./components/PackageManager.utils";
import { confirmAction } from "../../utils/Dialogs";
import { notify } from "../../utils/Toasts";

interface UsePackageManagerArgs {
    projectName: string;
}

export const usePackageManager = ({ projectName }: UsePackageManagerArgs) => {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<PackageEntry[]>([]);
    const [installed, setInstalled] = useState<PackageEntry[]>([]);
    const [projectLibs, setProjectLibs] = useState<ProjectLibrary[]>([]);
    const [selectedVersion, setSelectedVersion] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    /** The search the list on screen belongs to, to say what was not found. */
    const [searchedQuery, setSearchedQuery] = useState("");
    const [busy, setBusy] = useState<string | null>(null);
    const [syncing, setSyncing] = useState(false);
    const [progress, setProgress] = useState<Record<string, PkgProgressEvent>>({});
    const busyRef = useRef<string | null>(null);

    useEffect(() => {
        const unlisten = listen<PkgProgressEvent>("pkg-progress", (event) => {
            if (!busyRef.current) return;
            setProgress((prev) => ({ ...prev, [event.payload.package]: event.payload }));
        });
        return () => {
            unlisten.then((fn) => fn());
        };
    }, []);

    const loadRegistry = async (searchQuery: string) => {
        setLoading(true);
        setError(null);
        setSearchedQuery(searchQuery.trim());
        try {
            const [searchResults, installedResults, libs] = await Promise.all([
                invoke<PackageEntry[]>("pkg_search", { query: searchQuery || null, installedOnly: false }),
                invoke<PackageEntry[]>("pkg_search", { query: null, installedOnly: true }),
                invoke<ProjectLibrary[]>("list_project_libraries", { projectName }),
            ]);
            setResults(searchResults);
            setInstalled(installedResults);
            setProjectLibs(libs);
        } catch (e) {
            setError(friendlyError(e).message);
        } finally {
            setLoading(false);
        }
    };

    /** Reads again what is installed and in use. Resolves to false when it could not, without touching the list. */
    const refreshInstalledAndLibs = async (): Promise<boolean> => {
        try {
            const [installedResults, libs] = await Promise.all([
                invoke<PackageEntry[]>("pkg_search", { query: null, installedOnly: true }),
                invoke<ProjectLibrary[]>("list_project_libraries", { projectName }),
            ]);
            setInstalled(installedResults);
            setProjectLibs(libs);
            return true;
        } catch {
            return false;
        }
    };

    useEffect(() => {
        loadRegistry("");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectName]);

    const installedVersions = useMemo(() => {
        const map = new Map<string, Set<string>>();
        for (const pkg of installed) map.set(pkg.name, new Set(pkg.versions.map((v) => v.tag)));
        return map;
    }, [installed]);

    const usedVersion = (name: string) => projectLibs.find((lib) => lib.name === name)?.version ?? null;
    const versionFor = (pkg: PackageEntry) => selectedVersion[pkg.name] ?? usedVersion(pkg.name) ?? pkg.latest_version;

    /** Runs one operation, tells the user how it went (a notice, not text inside the row) and refreshes the lists. */
    const runOp = async (
        op: PkgOp,
        name: string,
        key: string,
        action: () => Promise<PkgOpOutcome>,
        onSuccess?: () => Promise<boolean>,
    ) => {
        // One operation at a time, even if a second click gets in before the buttons are disabled.
        if (busyRef.current) return;

        setBusy(key);
        busyRef.current = key;
        try {
            const outcome = await action();
            const described = describeOutcome(op, name, outcome);
            notify(described.level, described.message, described.details);

            if (outcome.success && onSuccess && !(await onSuccess())) {
                notify("warning", "Hecho, pero no se pudo actualizar la lista. Vuelve a buscar para refrescarla.");
            }
        } catch (e) {
            const failure = friendlyError(e);
            notify("error", failure.message, failure.details);
        } finally {
            setBusy(null);
            busyRef.current = null;
            // Dependencies report progress under their own names, so everything goes.
            setProgress({});
        }
    };

    const handleSearch = () => {
        loadRegistry(query);
    };

    const handleInstall = (pkg: PackageEntry) => {
        const version = versionFor(pkg);
        runOp("install", pkg.name, opKey("install", pkg.name, version), () =>
            invoke<PkgOpOutcome>("pkg_install", { name: pkg.name, version }), refreshInstalledAndLibs);
    };

    const handleUse = (pkg: PackageEntry) => {
        const version = versionFor(pkg);
        runOp("use", pkg.name, opKey("use", pkg.name, version), () =>
            invoke<PkgOpOutcome>("pkg_use", { projectName, name: pkg.name, version }), refreshInstalledAndLibs);
    };

    const handleUnuse = (name: string) => {
        runOp("unuse", name, opKey("unuse", name), () =>
            invoke<PkgOpOutcome>("pkg_unuse", { projectName, name }), refreshInstalledAndLibs);
    };

    const handleUninstall = async (name: string, version: string) => {
        if (busyRef.current) return;

        const confirmed = await confirmAction(`¿Desinstalar ${name}@${version} de tu sistema? Esto afecta a todos tus proyectos, no solo a este.`, "Desinstalar");
        // Something else may have started while the question was open; runOp checks that again.
        if (!confirmed) return;

        runOp("uninstall", name, opKey("uninstall", name, version), () =>
            invoke<PkgOpOutcome>("pkg_uninstall", { name, version }), refreshInstalledAndLibs);
    };

    const handleSync = async () => {
        if (busyRef.current) return;

        setSyncing(true);
        // Busy as well, so no other operation starts while the libraries are being linked.
        setBusy("sync");
        busyRef.current = "sync";
        try {
            const outcome = await invoke<PkgOpOutcome>("pkg_sync", { projectName });
            const described = describeOutcome("sync", "", outcome);
            notify(described.level, described.message, described.details);

            if (outcome.success && !(await refreshInstalledAndLibs())) {
                notify("warning", "Hecho, pero no se pudo actualizar la lista. Vuelve a buscar para refrescarla.");
            }
        } catch (e) {
            const failure = friendlyError(e);
            notify("error", failure.message, failure.details);
        } finally {
            setSyncing(false);
            setBusy(null);
            busyRef.current = null;
            setProgress({});
        }
    };

    return {
        query,
        setQuery,
        results,
        projectLibs,
        selectedVersion,
        setSelectedVersion,
        loading,
        error,
        searchedQuery,
        busy,
        syncing,
        progress,
        installedVersions,
        usedVersion,
        versionFor,
        handleSearch,
        handleInstall,
        handleUse,
        handleUnuse,
        handleUninstall,
        handleSync,
    };
};
