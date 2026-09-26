import { Label, Tooltip, EmptyState, ListGroup, ListRow } from "../../../components/ui";
import type { Feedback, PkgProgressEvent, ProjectLibrary } from "../types";
import { opKey, phaseLabel } from "./PackageManager.utils";
import { ProgressRow } from "./ProgressRow";
import { formatBytes } from "../../../utils/Bytes";

interface InUseSectionProps {
    projectLibs: ProjectLibrary[];
    busy: string | null;
    syncing: boolean;
    feedback: Record<string, Feedback>;
    progress: Record<string, PkgProgressEvent>;
    onSync: () => void;
    onUnuse: (name: string) => void;
}

export const InUseSection = ({ projectLibs, busy, syncing, feedback, progress, onSync, onUnuse }: InUseSectionProps) => (
    <section>
        <div className="flex items-center justify-between">
            <Label>En uso en este proyecto</Label>
            {projectLibs.length > 0 && (
                <Tooltip label="Reinstala y enlaza las librerías declaradas en dischord.lock.conf">
                    <button
                        onClick={onSync}
                        disabled={busy !== null || syncing}
                        className="flex items-center gap-1 text-[10px] font-medium text-gray-400 hover:text-white transition-colors disabled:opacity-40"
                    >
                        <i className={`bi ${syncing ? "bi-arrow-repeat animate-spin" : "bi-arrow-repeat"} text-[11px]`}></i>
                        {syncing ? "Sincronizando..." : "Sincronizar"}
                    </button>
                </Tooltip>
            )}
        </div>

        {feedback.sync && (
            <div
                className={`custom-scrollbar mt-2 px-3 py-2 rounded text-[11px] whitespace-pre-wrap max-h-24 overflow-y-auto ${
                    feedback.sync.ok
                        ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                        : "bg-red-500/10 text-red-300 border border-red-500/20"
                }`}
            >
                {feedback.sync.message}
            </div>
        )}

        {projectLibs.length === 0 ? (
            <EmptyState icon="bi-box2">Este proyecto no usa ninguna librería todavía.</EmptyState>
        ) : (
            <ListGroup className="mt-1">
                {projectLibs.map((lib) => {
                    const key = opKey("unuse", lib.name);
                    const isBusy = busy === key;
                    const rowProgress = isBusy ? progress[lib.name] : undefined;

                    return (
                        <ListRow key={lib.name}>
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <i className="bi bi-box-seam-fill text-accent-light text-[12px] shrink-0"></i>
                                <span className="text-sm text-gray-100">{lib.name}</span>
                                <span className="text-[11px] text-gray-600 font-mono shrink-0">{lib.version}</span>

                                <div className="flex-1 min-w-[1rem]" />

                                {rowProgress && (
                                    <span className="text-[10px] text-gray-500 font-mono shrink-0">
                                        {phaseLabel(rowProgress.phase)}
                                        {rowProgress.phase === "downloading" && typeof rowProgress.percent === "number"
                                            ? ` ${rowProgress.percent.toFixed(0)}%${rowProgress.total_bytes ? ` · ${formatBytes(rowProgress.total_bytes)}` : ""}`
                                            : ""}
                                    </span>
                                )}

                                <button
                                    onClick={() => onUnuse(lib.name)}
                                    disabled={busy !== null}
                                    className="text-[11px] font-medium text-gray-500 hover:text-red-400 transition-colors disabled:opacity-40 shrink-0 flex items-center gap-1"
                                >
                                    <i className={`bi ${isBusy ? "bi-arrow-repeat animate-spin" : "bi-x-circle"} text-[13px]`}></i>
                                    Dejar de usar
                                </button>
                            </div>

                            {feedback[key] && (
                                <div className={`mt-1.5 text-[10px] whitespace-pre-wrap ${feedback[key].ok ? "text-emerald-400" : "text-red-400"}`}>
                                    {feedback[key].message}
                                </div>
                            )}

                            {rowProgress && <ProgressRow progress={rowProgress} />}
                        </ListRow>
                    );
                })}
            </ListGroup>
        )}
    </section>
);
