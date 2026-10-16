import { useShortcutLabel } from "../../../shortcuts";

interface EmptyRunOutputProps {
    className?: string;
}

export const EmptyRunOutput = ({ className = "" }: EmptyRunOutputProps) => {
    const runShortcut = useShortcutLabel("run.toggle");

    return (
        <div className={`flex flex-col items-center justify-center gap-1 text-center ${className}`}>
            <i className="bi bi-terminal text-lg text-gray-600" />
            <p className="text-xs text-gray-500">Aún sin salida.</p>
            <p className="text-[11px] text-gray-600">Pulsa Ejecutar{runShortcut ? ` (${runShortcut})` : ""} para arrancar código.</p>
        </div>
    );
};
