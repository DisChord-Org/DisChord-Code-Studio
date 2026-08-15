import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { invoke } from "@tauri-apps/api/core";

import { Label } from "../../../components/ui/Typography";
import { Tooltip } from "../../../components/ui/Tooltip";
import type { PackageEntry, ProjectLibrary, PkgOpOutcome } from "../../../types";

interface PackageManagerProps {
    isOpen: boolean;
    onClose: () => void;
    projectName: string;
}

type Feedback = { ok: boolean; message: string };

const opKey = (action: string, name: string, version?: string) =>
    version ? `${action}:${name}:${version}` : `${action}:${name}`;

export const PackageManager = ({ isOpen, onClose, projectName }: PackageManagerProps) => {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<PackageEntry[]>([]);
    const [installed, setInstalled] = useState<PackageEntry[]>([]);
    const [projectLibs, setProjectLibs] = useState<ProjectLibrary[]>([]);
    const [selectedVersion, setSelectedVersion] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<Feedback | null>(null);

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
        if (!isOpen) return;
        setQuery("");
        setFeedback(null);
        setSelectedVersion({});
        loadRegistry("");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, projectName]);

    const installedVersions = useMemo(() => {
        const map = new Map<string, Set<string>>();
        for (const pkg of installed) map.set(pkg.name, new Set(pkg.versions));
        return map;
    }, [installed]);

    const usedVersion = (name: string) => projectLibs.find((lib) => lib.name === name)?.version ?? null;
    const versionFor = (pkg: PackageEntry) => selectedVersion[pkg.name] ?? usedVersion(pkg.name) ?? pkg.latest_version;

    const runOp = async (key: string, action: () => Promise<PkgOpOutcome>, onSuccess?: () => void) => {
        setBusy(key);
        setFeedback(null);
        try {
            const outcome = await action();
            setFeedback({
                ok: outcome.success,
                message: outcome.output || (outcome.success ? "Operación completada." : "La operación falló."),
            });
            if (outcome.success) await onSuccess?.();
        } catch (e) {
            setFeedback({ ok: false, message: String(e) });
        } finally {
            setBusy(null);
        }
    };

    const handleSearch = (e: FormEvent) => {
        e.preventDefault();
        loadRegistry(query);
    };

    const handleInstall = (pkg: PackageEntry) => {
        const version = versionFor(pkg);
        runOp(opKey("install", pkg.name, version), () =>
            invoke<PkgOpOutcome>("pkg_install", { name: pkg.name, version }), refreshInstalledAndLibs);
    };

    const handleUse = (pkg: PackageEntry) => {
        const version = versionFor(pkg);
        runOp(opKey("use", pkg.name, version), () =>
            invoke<PkgOpOutcome>("pkg_use", { projectName, name: pkg.name, version }), refreshInstalledAndLibs);
    };

    const handleUnuse = (name: string) => {
        runOp(opKey("unuse", name), () =>
            invoke<PkgOpOutcome>("pkg_unuse", { projectName, name }), refreshInstalledAndLibs);
    };

    const handleUninstall = (name: string, version: string) => {
        const confirmed = window.confirm(`¿Desinstalar ${name}@${version} de tu sistema? Esto afecta a todos tus proyectos, no solo a este.`);
        if (!confirmed) return;

        runOp(opKey("uninstall", name, version), () =>
            invoke<PkgOpOutcome>("pkg_uninstall", { name, version }), refreshInstalledAndLibs);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
            <div className="bg-[#111214] border border-[#1e1f22] rounded-xl w-full max-w-2xl max-h-[85vh] shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 shrink-0">
                    <div>
                        <h2 className="text-white font-bold text-sm">Dependencias del proyecto</h2>
                        <p className="text-[11px] text-gray-500 mt-0.5">Busca, instala y gestiona librerías DisChord (chord pkg).</p>
                    </div>
                    <Tooltip label="Cerrar">
                        <button
                            onClick={onClose}
                            className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-white transition-colors rounded hover:bg-white/5"
                        >
                            <i className="bi bi-x-lg text-sm"></i>
                        </button>
                    </Tooltip>
                </div>

                <form onSubmit={handleSearch} className="px-5 py-3 border-b border-white/5 shrink-0 flex gap-2">
                    <div className="relative flex-1">
                        <i className="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 text-xs"></i>
                        <input
                            autoFocus
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Buscar en el registro..."
                            className="w-full bg-[#1e1f22] border border-[#30363d] rounded pl-8 pr-3 py-1.5 text-xs text-white outline-none focus:border-[#5865F2]"
                        />
                    </div>
                    <button
                        type="submit"
                        className="px-3 py-1.5 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded text-xs font-medium transition-colors"
                    >
                        Buscar
                    </button>
                </form>

                {feedback && (
                    <div
                        className={`mx-5 mt-3 px-3 py-2 rounded text-[11px] whitespace-pre-wrap shrink-0 max-h-24 overflow-y-auto ${
                            feedback.ok
                                ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                                : "bg-red-500/10 text-red-300 border border-red-500/20"
                        }`}
                    >
                        {feedback.message}
                    </div>
                )}

                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                    {projectLibs.length > 0 && (
                        <section>
                            <Label>En uso en este proyecto</Label>
                            <div className="flex flex-col gap-1.5 mt-2">
                                {projectLibs.map((lib) => {
                                    const key = opKey("unuse", lib.name);
                                    return (
                                        <div
                                            key={lib.name}
                                            className="flex items-center justify-between bg-white/[0.02] border border-white/[0.06] rounded-lg px-3 py-2"
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <i className="bi bi-box-seam-fill text-[#5865F2] text-sm shrink-0"></i>
                                                <span className="text-xs text-white font-medium truncate">{lib.name}</span>
                                                <span className="text-[10px] text-gray-500 font-mono shrink-0">{lib.version}</span>
                                            </div>
                                            <Tooltip label="Dejar de usar">
                                                <button
                                                    onClick={() => handleUnuse(lib.name)}
                                                    disabled={busy !== null}
                                                    className="text-gray-500 hover:text-red-400 transition-colors p-1 disabled:opacity-40"
                                                >
                                                    <i className={`bi ${busy === key ? "bi-arrow-repeat animate-spin" : "bi-x-circle"} text-sm`}></i>
                                                </button>
                                            </Tooltip>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    <section>
                        <Label>Registro</Label>

                        {loading ? (
                            <p className="text-xs text-gray-500 animate-pulse mt-2">Buscando...</p>
                        ) : error ? (
                            <p className="text-xs text-red-400 mt-2">{error}</p>
                        ) : results.length === 0 ? (
                            <p className="text-xs text-gray-500 mt-2">No se encontraron librerías.</p>
                        ) : (
                            <div className="flex flex-col gap-2 mt-2">
                                {results.map((pkg) => {
                                    const version = versionFor(pkg);
                                    const isUsed = usedVersion(pkg.name) === version;
                                    const isInstalled = installedVersions.get(pkg.name)?.has(version) ?? false;
                                    const installKey = opKey("install", pkg.name, version);
                                    const useKey = opKey("use", pkg.name, version);
                                    const uninstallKey = opKey("uninstall", pkg.name, version);

                                    return (
                                        <div key={pkg.name} className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-3">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="text-sm text-white font-semibold">{pkg.name}</span>
                                                        {pkg.tags.map((tag) => (
                                                            <span
                                                                key={tag}
                                                                className="text-[9px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded bg-white/5 text-gray-400"
                                                            >
                                                                {tag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                    {pkg.description && (
                                                        <p className="text-[11px] text-gray-500 mt-1">{pkg.description}</p>
                                                    )}
                                                    {pkg.repo && (
                                                        <p className="text-[10px] text-gray-600 font-mono mt-1">{pkg.repo}</p>
                                                    )}
                                                </div>

                                                {isUsed && (
                                                    <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1 shrink-0">
                                                        <i className="bi bi-check-circle-fill"></i> En uso
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2 mt-3">
                                                <select
                                                    value={version}
                                                    onChange={(e) =>
                                                        setSelectedVersion((prev) => ({ ...prev, [pkg.name]: e.target.value }))
                                                    }
                                                    className="bg-[#1e1f22] border border-[#30363d] rounded px-2 py-1 text-[11px] text-gray-300 outline-none focus:border-[#5865F2]"
                                                >
                                                    {pkg.versions.map((v) => (
                                                        <option key={v} value={v}>{v}</option>
                                                    ))}
                                                </select>

                                                {isUsed ? (
                                                    <button
                                                        onClick={() => handleUnuse(pkg.name)}
                                                        disabled={busy !== null}
                                                        className="px-3 py-1 text-[11px] rounded bg-transparent border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                                                    >
                                                        Dejar de usar
                                                    </button>
                                                ) : isInstalled ? (
                                                    <button
                                                        onClick={() => handleUse(pkg)}
                                                        disabled={busy !== null}
                                                        className="px-3 py-1 text-[11px] rounded bg-[#5865F2] hover:bg-[#4752C4] text-white transition-colors disabled:opacity-50"
                                                    >
                                                        {busy === useKey ? "Usando..." : "Usar en este proyecto"}
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handleInstall(pkg)}
                                                        disabled={busy !== null}
                                                        className="px-3 py-1 text-[11px] rounded bg-white/5 hover:bg-white/10 text-gray-200 transition-colors disabled:opacity-50"
                                                    >
                                                        {busy === installKey ? "Instalando..." : "Instalar"}
                                                    </button>
                                                )}

                                                {isInstalled && !isUsed && (
                                                    <Tooltip label="Desinstalar globalmente">
                                                        <button
                                                            onClick={() => handleUninstall(pkg.name, version)}
                                                            disabled={busy !== null}
                                                            className="ml-auto text-gray-600 hover:text-red-400 transition-colors p-1 disabled:opacity-40"
                                                        >
                                                            <i className={`bi ${busy === uninstallKey ? "bi-arrow-repeat animate-spin" : "bi-trash3"} text-xs`}></i>
                                                        </button>
                                                    </Tooltip>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
};
