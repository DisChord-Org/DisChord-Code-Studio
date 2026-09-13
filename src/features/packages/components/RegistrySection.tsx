import { openUrl } from "@tauri-apps/plugin-opener";
import { Label } from "../../../components/ui/Typography";
import { Tooltip } from "../../../components/ui/Tooltip";
import { Button } from "../../../components/ui/Button";
import type { PackageEntry, PkgProgressEvent } from "../types";
import type { Feedback } from "../usePackageManager";
import { opKey } from "./PackageManager.utils";
import { ProgressRow } from "./ProgressRow";
import { TrustBadge } from "./TrustBadge";

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
                        const activeKey = busy === installKey ? installKey : busy === useKey ? useKey : busy === uninstallKey ? uninstallKey : null;
                        const selectedVersionInfo = pkg.versions.find((v) => v.tag === version);
                        const relativeDate = selectedVersionInfo ? formatRelativeDate(selectedVersionInfo.created_at) : null;

                        return (
                            <div key={pkg.name} className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-sm text-white font-semibold">{pkg.name}</span>
                                            <TrustBadge isAudited={pkg.is_audited} trustLevel={pkg.trust_level} />
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

                                    {isUsed && (
                                        <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1 shrink-0">
                                            <i className="bi bi-check-circle-fill"></i> En uso
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 mt-3 flex-wrap">
                                    <select
                                        value={version}
                                        onChange={(e) => onSelectVersion(pkg.name, e.target.value)}
                                        className="bg-border border border-border-strong rounded px-2 py-1 text-[11px] text-gray-300 outline-none focus:border-accent"
                                    >
                                        {pkg.versions.map((v) => (
                                            <option key={v.tag} value={v.tag}>
                                                {v.tag}
                                            </option>
                                        ))}
                                    </select>

                                    {relativeDate && <span className="text-[10px] text-gray-600">Publicado {relativeDate}</span>}

                                    {isUsed ? (
                                        <Button variant="danger" size="sm" onClick={() => onUnuse(pkg.name)} disabled={busy !== null}>
                                            Dejar de usar
                                        </Button>
                                    ) : isInstalled ? (
                                        <Button size="sm" onClick={() => onUse(pkg)} disabled={busy !== null}>
                                            {busy === useKey ? "Usando..." : "Usar en este proyecto"}
                                        </Button>
                                    ) : (
                                        <button
                                            onClick={() => onInstall(pkg)}
                                            disabled={busy !== null}
                                            className="px-3 py-1 text-[11px] rounded bg-white/5 hover:bg-white/10 text-gray-200 transition-colors disabled:opacity-50"
                                        >
                                            {busy === installKey ? "Instalando..." : "Instalar"}
                                        </button>
                                    )}

                                    {isInstalled && !isUsed && (
                                        <Tooltip label="Desinstalar globalmente">
                                            <button
                                                onClick={() => onUninstall(pkg.name, version)}
                                                disabled={busy !== null}
                                                className="ml-auto text-gray-600 hover:text-red-400 transition-colors p-1 disabled:opacity-40"
                                            >
                                                <i className={`bi ${busy === uninstallKey ? "bi-arrow-repeat animate-spin" : "bi-trash3"} text-xs`}></i>
                                            </button>
                                        </Tooltip>
                                    )}
                                </div>

                                {activeKey && progress[pkg.name] && <ProgressRow progress={progress[pkg.name]} />}

                                {(feedback[installKey] || feedback[useKey] || feedback[uninstallKey]) && (
                                    <div
                                        className={`mt-2 text-[10px] whitespace-pre-wrap ${
                                            (feedback[installKey] ?? feedback[useKey] ?? feedback[uninstallKey])!.ok
                                                ? "text-emerald-400"
                                                : "text-red-400"
                                        }`}
                                    >
                                        {(feedback[installKey] ?? feedback[useKey] ?? feedback[uninstallKey])!.message}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
};
