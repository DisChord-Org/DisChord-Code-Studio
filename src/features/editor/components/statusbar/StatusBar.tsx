import { SystemMonitorRings } from "../../../system-monitor";
import { ModifiedBadge, Tooltip, Button } from "../../../../components/ui";
import { useShortcutLabel } from "../../../shortcuts";
import { useFileDiagnostics } from "../../../compiler";

const monitorRingSize = 16;

interface StatusBarProps {
    fileName?: string;
    filePath?: string;
    isDirty: boolean;
    contentLength: number;
    wordWrap: boolean;
    onToggleWordWrap: () => void;
}

export const StatusBar = ({ fileName, filePath, isDirty, contentLength, wordWrap, onToggleWordWrap }: StatusBarProps) => {
    const diagnostics = useFileDiagnostics(filePath);
    const wrapShortcut = useShortcutLabel("editor.toggleWordWrap");

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

                {diagnostics.toolError ? (
                    <Tooltip label={`El compilador no pudo comprobar el archivo: ${diagnostics.toolError}`} placement="top" align="start">
                        <span className="flex items-center gap-1 text-gray-600">
                            <i className="bi bi-exclamation-triangle text-[11px]"></i>
                            Sin comprobar
                        </span>
                    </Tooltip>
                ) : (diagnostics.errors > 0 || diagnostics.warnings > 0) && (
                    <span className="flex items-center gap-3">
                        {diagnostics.errors > 0 && (
                            <span className="flex items-center gap-1 text-red-400">
                                <i className="bi bi-x-circle-fill text-[10px]"></i>
                                {diagnostics.errors}
                            </span>
                        )}
                        {diagnostics.warnings > 0 && (
                            <span className="flex items-center gap-1 text-amber-400">
                                <i className="bi bi-exclamation-triangle-fill text-[10px]"></i>
                                {diagnostics.warnings}
                            </span>
                        )}
                    </span>
                )}
            </div>

            <div className="flex items-center gap-4">
                {fileName && <span>{contentLength} caracteres</span>}
                <Tooltip label={wrapShortcut ? `Ajuste de línea (${wrapShortcut})` : "Ajuste de línea"} placement="top" align="end">
                    <Button variant="unstyled"
                        onClick={onToggleWordWrap}
                        className={`flex items-center gap-1 transition-colors ${wordWrap ? "text-accent" : "hover:text-gray-300"}`}
                    >
                        <i className="bi bi-text-wrap text-[11px]"></i>
                    </Button>
                </Tooltip>
                <SystemMonitorRings size={monitorRingSize} showNumbers={false} />
            </div>
        </div>
    );
};