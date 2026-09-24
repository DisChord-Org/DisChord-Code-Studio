import { openUrl } from "@tauri-apps/plugin-opener";
import { Label, Tooltip } from "../../../components/ui";
import type { Feedback, PackageEntry, PkgProgressEvent } from "../types";
import { opKey, phaseLabel } from "./PackageManager.utils";
import { ProgressRow } from "./ProgressRow";
import { TrustBadge } from "./TrustBadge";
import { formatBytes } from "../../../utils/Bytes";

const formatRelativeDate = (createdAt: number) => {
    if (!createdAt) return null;
    const diffMs = Date.now() - createdAt;
    const days = Math.round(diffMs / 86_400_000);
    const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
    if (Math.abs(days) < 1) return "hoy";
    if (Math.abs(days) < 30) return rtf.format(-days, "day");
    const months = Math.round(days / 30);
    if (Math.abs(months) < 12) return rtf.format(-months, "month");
    return rtf.format(-Math.round(months / 12), "year");
};

interface RegistrySectionProps {
    results: PackageEntry[];
    loading: boolean;
    error: string | null;
    busy: string | null;
    feedback: Record<string, Feedback>;
    progress: Record<string, PkgProgressEvent>;
    installedVersions: Map<string, Set<string>>;
    usedVersion: (name: string) => string | null;
    versionFor: (pkg: PackageEntry) => string;
    onSelectVersion: (name: string, version: string) => void;
    onInstall: (pkg: PackageEntry) => void;
    onUse: (pkg: PackageEntry) => void;
    onUnuse: (name: string) => void;
    onUninstall: (name: string, version: string) => void;
}

export const RegistrySection = ({
    results,
    loading,
    error,
    busy,
    feedback,
    progress,
    installedVersions,
    usedVersion,
    versionFor,
    onSelectVersion,
    onInstall,
    onUse,
    onUnuse,
    onUninstall,
}: RegistrySectionProps) => {
    const openRepo = (repository: string) => {
        openUrl(`https://github.com/${repository}`).catch(() => {});
    };

    return (
        <section>
            <Label>Registro</Label>

            {loading ? (
                <p className="text-xs text-gray-500 animate-pulse mt-3">Buscando...</p>
            ) : error ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                    <i className="bi bi-exclamation-triangle text-xl text-red-400/60"></i>
                    <p className="text-xs text-red-400">{error}</p>
                </div>
            ) : results.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                    <i className="bi bi-search text-xl text-gray-700"></i>
                    <p className="text-xs text-gray-500">No se encontraron librerías.</p>
                </div>
            ) : (
                <div className="mt-1 divide-y divide-white/[0.05]">
                    {results.map((pkg) => {
                        const version = versionFor(pkg);
                        const isUsed = usedVersion(pkg.name) === version;
                        const isInstalled = installedVersions.get(pkg.name)?.has(version) ?? false;
                        const installKey = opKey("install", pkg.name, version);
                        const useKey = opKey("use", pkg.name, version);
                        const uninstallKey = opKey("uninstall", pkg.name, version);
                        const activeKey = busy === installKey ? installKey : busy === useKey ? useKey : busy === uninstallKey ? uninstallKey : null;
                        const rowProgress = activeKey ? progress[pkg.name] : undefined;
                        const selectedVersionInfo = pkg.versions.find((v) => v.tag === version);
                        const relativeDate = selectedVersionInfo ? formatRelativeDate(selectedVersionInfo.created_at) : null;
                        const feedbackEntry = feedback[installKey] ?? feedback[useKey] ?? feedback[uninstallKey];

                        return (
                            <div
                                key={pkg.name}
                                className="group relative -mx-2 px-2 py-3 rounded-md hover:bg-white/[0.03] transition-colors"
                            >
                                <div className="flex items-start justify-between gap-4 flex-wrap sm:flex-nowrap">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2.5 flex-wrap">
                                            <span className="text-sm text-gray-100">{pkg.name}</span>
                                            <TrustBadge isAudited={pkg.is_audited} trustLevel={pkg.trust_level} />
                                            {isUsed && (
                                                <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                                                    <i className="bi bi-check-circle-fill"></i> En uso
                                                </span>
                                            )}
                                        </div>
                                        {pkg.description && (
                                            <p className="text-[11px] text-gray-500 mt-1">{pkg.description}</p>
                                        )}
                                        {pkg.repository && (
                                            <button
                                                onClick={() => openRepo(pkg.repository)}
                                                className="flex items-center gap-1 text-[10px] text-gray-600 hover:text-accent font-mono mt-1 transition-colors"
                                            >
                                                <i className="bi bi-github"></i>
                                                {pkg.repository}
                                            </button>
                                        )}
                                    </div>

                                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                                        <div className="flex items-center gap-3">
                                            {rowProgress ? (
                                                <span className="text-[10px] text-gray-500 font-mono shrink-0">
                                                    {phaseLabel(rowProgress.phase)}
                                                    {rowProgress.phase === "downloading" && typeof rowProgress.percent === "number"
                                                        ? ` ${rowProgress.percent.toFixed(0)}%${rowProgress.total_bytes ? ` · ${formatBytes(rowProgress.total_bytes)}` : ""}`
                                                        : ""}
                                                </span>
                                            ) : (
                                                relativeDate && <span className="text-[10px] text-gray-600 shrink-0">{relativeDate}</span>
                                            )}

                                            {isUsed ? (
                                                <button
                                                    onClick={() => onUnuse(pkg.name)}
                                                    disabled={busy !== null}
                                                    className="text-[11px] font-medium text-gray-400 hover:text-red-400 transition-colors disabled:opacity-40"
                                                >
                                                    Dejar de usar
                                                </button>
                                            ) : isInstalled ? (
                                                <button
                                                    onClick={() => onUse(pkg)}
                                                    disabled={busy !== null}
                                                    className="text-[11px] font-medium text-gray-300 hover:text-white transition-colors disabled:opacity-40"
                                                >
                                                    {busy === useKey ? "Usando..." : "Usar"}
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => onInstall(pkg)}
                                                    disabled={busy !== null}
                                                    className="text-[11px] font-medium text-accent-light hover:text-accent transition-colors disabled:opacity-40"
                                                >
                                                    {busy === installKey ? "Instalando..." : "Instalar"}
                                                </button>
                                            )}

                                            {isInstalled && !isUsed && (
                                                <Tooltip label="Desinstalar globalmente">
                                                    <button
                                                        onClick={() => onUninstall(pkg.name, version)}
                                                        disabled={busy !== null}
                                                        className="text-gray-500 hover:text-red-400 transition-colors p-1 disabled:opacity-40"
                                                    >
                                                        <i className={`bi ${busy === uninstallKey ? "bi-arrow-repeat animate-spin" : "bi-trash3"} text-xs`}></i>
                                                    </button>
                                                </Tooltip>
                                            )}
                                        </div>

                                        <div className="relative shrink-0">
                                            <select
                                                value={version}
                                                onChange={(e) => onSelectVersion(pkg.name, e.target.value)}
                                                className="appearance-none bg-white/[0.04] hover:bg-white/[0.08] rounded pl-2 pr-5 py-0.5 text-[11px] font-mono text-gray-400 hover:text-gray-200 outline-none cursor-pointer transition-colors"
                                            >
                                                {pkg.versions.map((v) => (
                                                    <option key={v.tag} value={v.tag} className="bg-panel text-gray-200">
                                                        {v.tag}
                                                    </option>
                                                ))}
                                            </select>
                                            <i className="bi bi-chevron-down absolute right-1.5 top-1/2 -translate-y-1/2 text-[8px] text-gray-500 pointer-events-none"></i>
                                        </div>
                                    </div>
                                </div>

                                {feedbackEntry && (
                                    <div className={`mt-1.5 text-[10px] whitespace-pre-wrap ${feedbackEntry.ok ? "text-emerald-400" : "text-red-400"}`}>
                                        {feedbackEntry.message}
                                    </div>
                                )}

                                {rowProgress && <ProgressRow progress={rowProgress} />}
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
};
