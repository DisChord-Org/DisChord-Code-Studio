import type { PkgProgressEvent } from "../types";

interface ProgressRowProps {
    progress: PkgProgressEvent;
}

/** Thin progress bar pinned to a row's bottom edge (same visual language as the Update view's rows). */
export const ProgressRow = ({ progress }: ProgressRowProps) => {
    const isDownloading = progress.phase === "downloading" && typeof progress.percent === "number";
    const barWidth = isDownloading ? Math.min(100, Math.max(0, progress.percent ?? 0)) : progress.phase === "checking" ? 35 : 60;

    return (
        <div className="absolute left-0 right-0 bottom-0 h-[2px] bg-white/5 overflow-hidden animate-in fade-in duration-300">
            <div
                className={`relative h-full bg-accent overflow-hidden transition-all duration-300 ease-out ${
                    progress.phase === "checking" || progress.phase === "installing" ? "animate-pulse" : ""
                }`}
                style={{ width: `${barWidth}%` }}
            >
                <span className="progress-shimmer" />
            </div>
        </div>
    );
};
