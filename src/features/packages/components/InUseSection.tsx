import { Label } from "../../../components/ui/Typography";
import { Tooltip } from "../../../components/ui/Tooltip";
import type { PkgProgressEvent, ProjectLibrary } from "../types";
import type { Feedback } from "../usePackageManager";
import { opKey } from "./PackageManager.utils";
import { ProgressRow } from "./ProgressRow";

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
            <p className="text-xs text-gray-500 mt-2">Este proyecto no usa ninguna librería todavía.</p>
        ) : (
            <div className="flex flex-col gap-1.5 mt-2">
                {projectLibs.map((lib) => {
                    const key = opKey("unuse", lib.name);
                    return (
                        <div
                            key={lib.name}
                            className="flex flex-col bg-white/[0.02] border border-white/[0.06] rounded-lg px-3 py-2"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 min-w-0">
                                    <i className="bi bi-box-seam-fill text-accent text-sm shrink-0"></i>
                                    <span className="text-xs text-white font-medium truncate">{lib.name}</span>
                                    <span className="text-[10px] text-gray-500 font-mono shrink-0">{lib.version}</span>
                                </div>
                                <Tooltip label="Dejar de usar">
                                    <button
                                        onClick={() => onUnuse(lib.name)}
                                        disabled={busy !== null}
                                        className="text-gray-500 hover:text-red-400 transition-colors p-1 disabled:opacity-40"
                                    >
                                        <i className={`bi ${busy === key ? "bi-arrow-repeat animate-spin" : "bi-x-circle"} text-sm`}></i>
                                    </button>
                                </Tooltip>
                            </div>
                            {busy === key && progress[lib.name] && <ProgressRow progress={progress[lib.name]} />}
                            {feedback[key] && (
                                <div className={`mt-2 text-[10px] whitespace-pre-wrap ${feedback[key].ok ? "text-emerald-400" : "text-red-400"}`}>
                                    {feedback[key].message}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        )}
    </section>
);
