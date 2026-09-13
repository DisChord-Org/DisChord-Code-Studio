import type { PkgProgressEvent } from "../types";
import { phaseLabel } from "./PackageManager.utils";
import { formatBytes } from "../../../utils/Bytes";

interface ProgressRowProps {
    progress: PkgProgressEvent;
}

export const ProgressRow = ({ progress }: ProgressRowProps) => {
    const isDownloading = progress.phase === "downloading" && typeof progress.percent === "number";
    return (
        <div className="mt-2">
            <div className="flex items-center justify-between text-[10px] text-gray-400">
                <span className="flex items-center gap-1.5">
                    <i className="bi bi-arrow-repeat animate-spin text-[10px]"></i>
                    {phaseLabel(progress.phase)}
                </span>
                {isDownloading && (
                    <span className="font-mono text-gray-500">
                        {progress.percent?.toFixed(0)}%{progress.total_bytes ? ` · ${formatBytes(progress.total_bytes)}` : ""}
                    </span>
                )}
            </div>
            {isDownloading && (
                <div className="w-full h-1 bg-white/5 rounded-full mt-1 overflow-hidden">
                    <div
                        className="h-full bg-accent transition-all duration-200 rounded-full"
                        style={{ width: `${Math.min(100, Math.max(0, progress.percent ?? 0))}%` }}
                    />
                </div>
            )}
        </div>
    );
};
