import { memo } from "react";
import { OutputDetails } from "./OutputDetails";
import { OutputLineRow } from "./OutputLineRow";
import { statusStyle } from "./RunOutput.constants";
import { isError } from "./groupLines";
import { copyText, formatClock, formatDuration, stripAnsi } from "./outputText";
import { useNow } from "./useNow";
import { useRunLines } from "./useRunLines";
import type { OpenLocationHandler, OutputRun } from "./types";

const statusLabel = (run: OutputRun): string => {
    switch (run.status) {
        case "running": return "En ejecución";
        case "finished": return "Terminó";
        case "stopped": return "Detenida";
        case "failed": return run.exitCode !== null ? `Falló (código ${run.exitCode})` : "Falló";
    }
};

interface RunBlockProps {
    run: OutputRun;
    expanded: boolean;
    problemsOnly: boolean;
    query: string;
    onToggle: () => void;
    onOpenLocation: OpenLocationHandler;
}

export const RunBlock = memo(({ run, expanded, problemsOnly, query, onToggle, onOpenLocation }: RunBlockProps) => {
    const now = useNow(run.status === "running");
    const { visible, items } = useRunLines(run, problemsOnly, query);

    const style = statusStyle[run.status];
    const duration = formatDuration((run.endedAt ?? now) - run.startedAt);
    const errorCount = run.lines.filter((l) => isError(l.kind)).length;

    const copyRun = () => copyText(visible.map((l) => `${formatClock(l.ts)} ${stripAnsi(l.text)}`).join("\n"));

    return (
        <section className="mb-2 last:mb-0">
            <div className="flex items-center gap-1">
                <button
                    onClick={onToggle}
                    className="flex-1 min-w-0 flex items-center gap-2 px-2 py-1 rounded bg-white/[0.04] hover:bg-white/[0.07] transition-colors text-left"
                >
                    <i className={`bi bi-chevron-right text-[9px] text-gray-500 transition-transform ${expanded ? "rotate-90" : ""}`} />
                    <i className={`bi ${style.icon} text-[11px] ${style.text}`} />
                    <span className="text-[11px] font-semibold text-gray-200">Ejecución #{run.id}</span>
                    <span className="text-[10px] text-gray-500 tabular-nums">{formatClock(run.startedAt)}</span>
                    {errorCount > 0 && (
                        <span className="text-[10px] px-1.5 rounded bg-red-500/15 text-red-300">
                            {errorCount} {errorCount === 1 ? "error" : "errores"}
                        </span>
                    )}
                    <span className="flex-1" />
                    <span className={`text-[10px] ${style.text}`}>{statusLabel(run)}</span>
                    <span className="text-[10px] text-gray-500 tabular-nums">· {duration}</span>
                </button>
                <button
                    onClick={copyRun}
                    title="Copiar esta ejecución"
                    className="shrink-0 px-2 py-1 rounded text-gray-500 hover:text-white hover:bg-white/[0.07] transition-colors"
                >
                    <i className="bi bi-copy text-[11px]" />
                </button>
            </div>

            {expanded && (
                <div className="pt-1 leading-[1.6]">
                    {items.length === 0 ? (
                        <p className="px-2 text-gray-600 italic">{run.lines.length === 0 ? "Sin salida." : "Ninguna línea coincide con el filtro."}</p>
                    ) : (
                        items.map((item) =>
                            item.type === "line" ? (
                                <OutputLineRow key={item.line.id} line={item.line} query={query.trim()} onOpenLocation={onOpenLocation} />
                            ) : (
                                <OutputDetails key={item.id} lines={item.lines} />
                            ),
                        )
                    )}
                </div>
            )}
        </section>
    );
});
RunBlock.displayName = "RunBlock";
