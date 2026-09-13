import { SystemMonitorRings } from "../../../system-monitor";
import { ModifiedBadge } from "../../../../components/ui/ModifiedBadge";

interface StatusBarProps {
    fileName?: string;
    isDirty: boolean;
    contentLength: number;
}

export const StatusBar = ({ fileName, isDirty, contentLength }: StatusBarProps) => {
    return (
        <div className="h-6 bg-panel-alt shadow-[0_-1px_3px_0_rgba(0,0,0,0.35)] flex items-center px-4 justify-between text-[10px] text-gray-500 font-mono shrink-0 relative z-10">
            <div className="flex items-center gap-4">
                {fileName && (
                    <>
                        <span>UTF-8</span>
                        <span className="text-accent">
                            {fileName.split('.').pop()?.toUpperCase()}
                        </span>
                    </>
                )}

                {isDirty && <ModifiedBadge />}
            </div>

            <div className="flex items-center gap-4">
                {fileName && <span>{contentLength} caracteres</span>}
                <SystemMonitorRings size={16} showNumbers={false} />
            </div>
        </div>
    );
};