import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { PackageEntry, PkgOpOutcome, PkgProgressEvent, ProjectLibrary } from "./types";
import { opKey, phaseLabel } from "./components/PackageManager.utils";

export type Feedback = { ok: boolean; message: string };

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
    const [busy, setBusy] = useState<string | null>(null);
    const [syncing, setSyncing] = useState(false);
    const [feedback, setFeedback] = useState<Record<string, Feedback>>({});
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
            setError(String(e));
        } finally {
            setLoading(false);
        }
    };

    const refreshInstalledAndLibs = async () => {
        try {
            const [installedResults, libs] = await Promise.all([
                invoke<PackageEntry[]>("pkg_search", { query: null, installedOnly: true }),
                invoke<ProjectLibrary[]>("list_project_libraries", { projectName }),
            ]);
            setInstalled(installedResults);
            setProjectLibs(libs);
        } catch (e) {
            setError(String(e));
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

    const runOp = async (key: string, packageNames: string[], action: () => Promise<PkgOpOutcome>, onSuccess?: () => void) => {
        setBusy(key);
        busyRef.current = key;
        setFeedback((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
        try {
            const outcome = await action();
            const message =
                outcome.results.length > 0
                    ? outcome.results.map((r) => `${r.package}${r.version ? `@${r.version}` : ""}: ${r.message ?? phaseLabel(r.phase)}`).join("\n")
                    : outcome.output || (outcome.success ? "Operación completada." : "La operación falló.");
            setFeedback((prev) => ({ ...prev, [key]: { ok: outcome.success, message } }));
            if (outcome.success) await onSuccess?.();
        } catch (e) {
            setFeedback((prev) => ({ ...prev, [key]: { ok: false, message: String(e) } }));
        } finally {
            setBusy(null);
            busyRef.current = null;
            setProgress((prev) => {
                const next = { ...prev };
                for (const name of packageNames) delete next[name];
                return next;
            });
        }
    };

    const handleSearch = () => {
        loadRegistry(query);
    };

    const handleInstall = (pkg: PackageEntry) => {
        const version = versionFor(pkg);
        runOp(opKey("install", pkg.name, version), [pkg.name], () =>
            invoke<PkgOpOutcome>("pkg_install", { name: pkg.name, version }), refreshInstalledAndLibs);
    };

    const handleUse = (pkg: PackageEntry) => {
        const version = versionFor(pkg);
        runOp(opKey("use", pkg.name, version), [pkg.name], () =>
            invoke<PkgOpOutcome>("pkg_use", { projectName, name: pkg.name, version }), refreshInstalledAndLibs);
    };

    const handleUnuse = (name: string) => {
        runOp(opKey("unuse", name), [name], () =>
            invoke<PkgOpOutcome>("pkg_unuse", { projectName, name }), refreshInstalledAndLibs);
    };

    const handleUninstall = (name: string, version: string) => {
        const confirmed = window.confirm(`¿Desinstalar ${name}@${version} de tu sistema? Esto afecta a todos tus proyectos, no solo a este.`);
        if (!confirmed) return;

        runOp(opKey("uninstall", name, version), [name], () =>
            invoke<PkgOpOutcome>("pkg_uninstall", { name, version }), refreshInstalledAndLibs);
    };

    const handleSync = async () => {
        setSyncing(true);
        setFeedback((prev) => {
            const next = { ...prev };
            delete next.sync;
            return next;
        });
        busyRef.current = "sync";
        try {
            const outcome = await invoke<PkgOpOutcome>("pkg_sync", { projectName });
            const message =
                outcome.results.length > 0
                    ? outcome.results.map((r) => `${r.package}${r.version ? `@${r.version}` : ""}: ${r.message ?? phaseLabel(r.phase)}`).join("\n")
                    : "El proyecto ya está sincronizado.";
            setFeedback((prev) => ({ ...prev, sync: { ok: outcome.success, message } }));
            if (outcome.success) await refreshInstalledAndLibs();
        } catch (e) {
            setFeedback((prev) => ({ ...prev, sync: { ok: false, message: String(e) } }));
        } finally {
            setSyncing(false);
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
        busy,
        syncing,
        feedback,
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
