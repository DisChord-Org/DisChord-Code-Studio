import { memo } from "react";
import { parseAnsi } from "./ansi";
import { HighlightedText } from "./HighlightedText";
import { kindIcon, kindStyle } from "./RunOutput.constants";
import { copyText, formatClock, stripAnsi } from "./outputText";
import type { OpenLocationHandler, OutputLine } from "./types";

interface OutputLineRowProps {
    line: OutputLine;
    query: string;
    onOpenLocation: OpenLocationHandler;
}

export const OutputLineRow = memo(({ line, query, onOpenLocation }: OutputLineRowProps) => {
    const icon = kindIcon[line.kind];
    const { location } = line;

    return (
        <div className={`group/line flex gap-3 px-2 border-l-2 border-l-transparent ${kindStyle[line.kind]}`}>
            <span className="shrink-0 text-gray-600 select-none tabular-nums">{formatClock(line.ts)}</span>
            {icon && <i className={`bi ${icon} shrink-0 leading-[1.6]`} />}
            <span className="whitespace-pre-wrap break-words min-w-0 flex-1">
                {parseAnsi(line.text).map((segment, i) => (
                    <span
                        key={i}
                        style={{ color: segment.color }}
                        className={`${segment.bold ? "font-bold" : ""} ${segment.dim ? "opacity-60" : ""}`}
                    >
                        <HighlightedText text={segment.text} query={query} />
                    </span>
                ))}
            </span>
            {location && (
                <button
                    onClick={() => onOpenLocation(location.path, location.line, location.column)}
                    className="shrink-0 select-none text-[10px] text-sky-300 underline decoration-dotted underline-offset-2 hover:text-sky-200"
                >
                    {location.path}:{location.line}:{location.column} <i className="bi bi-box-arrow-up-right" />
                </button>
            )}
            <button
                onClick={() => copyText(stripAnsi(line.text))}
                title="Copiar línea"
                className="shrink-0 select-none opacity-0 group-hover/line:opacity-100 text-gray-500 hover:text-white transition-opacity"
            >
                <i className="bi bi-copy text-[10px]" />
            </button>
        </div>
    );
});
OutputLineRow.displayName = "OutputLineRow";
