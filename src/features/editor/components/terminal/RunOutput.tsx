import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { parseAnsi } from "./ansi";
import {
    useOutputRuns,
    type LineKind,
    type OutputLine,
    type OutputRun,
    type RunStatus,
} from "./outputStore";

const pad = (n: number) => String(n).padStart(2, "0");

const formatClock = (ts: number) => {
    const d = new Date(ts);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const formatDuration = (ms: number) => {
    const total = Math.max(0, Math.floor(ms / 1000));
    if (total < 60) return `${total}s`;
    const minutes = Math.floor(total / 60);
    if (minutes < 60) return `${minutes}m ${pad(total % 60)}s`;
    return `${Math.floor(minutes / 60)}h ${pad(minutes % 60)}m`;
};

// eslint-disable-next-line no-control-regex
const stripAnsi = (text: string) => text.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "");

const isProblem = (kind: LineKind) => kind === "stderr" || kind === "error" || kind === "warning";
const isError = (kind: LineKind) => kind === "stderr" || kind === "error";

const noisePatterns = [
    /^\s*\d+ \| /,
    /^\s*\^+\s*$/,
    /^\s*at .*(\$bunfs|node:|node_modules)/,
    /^error: Command failed/,
    /^\s*(pid|status|signal|output|stdout|stderr):/,
];
const isNoise = (line: OutputLine) => isError(line.kind) && noisePatterns.some((pattern) => pattern.test(stripAnsi(line.text)));

type Item = { type: "line"; line: OutputLine } | { type: "details"; id: number; lines: OutputLine[] };

const blockStart = /^error: Command failed/;
const blockEnd = /^Bun v\d/;

/** Collapses runtime noise into expandable "details" items. */
const groupLines = (lines: OutputLine[]): Item[] => {
    const items: Item[] = [];
    let pending: OutputLine[] = [];

    const flush = () => {
        const noisy = pending.filter(isNoise).length;
        if (noisy >= 3) {
            const trimmed = pending.filter((l) => stripAnsi(l.text).trim() !== "" || isNoise(l));
            items.push({ type: "details", id: trimmed[0].id, lines: trimmed });
        } else {
            pending.forEach((line) => items.push({ type: "line", line }));
        }
        pending = [];
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (isError(line.kind) && blockStart.test(stripAnsi(line.text))) {
            // Source excerpts right before the block belong to it.
            const block = [...pending, line];
            pending = [];
            while (i + 1 < lines.length && isError(lines[i + 1].kind)) {
                const next = lines[++i];
                block.push(next);
                if (blockEnd.test(stripAnsi(next.text))) break;
            }
            items.push({ type: "details", id: block[0].id, lines: block.filter((l) => stripAnsi(l.text).trim() !== "") });
            continue;
        }

        const blank = isError(line.kind) && stripAnsi(line.text).trim() === "";
        if (isNoise(line) || (blank && pending.length > 0)) {
            pending.push(line);
        } else {
            flush();
            items.push({ type: "line", line });
        }
    }
    flush();

    return items;
};

const kindStyle: Record<LineKind, string> = {
    stdout: "text-gray-300",
    stderr: "text-red-300 bg-red-500/[0.06] border-l-red-500/50",
    info: "text-sky-300",
    success: "text-emerald-400",
    warning: "text-amber-300",
    error: "text-red-400 font-semibold bg-red-500/[0.06] border-l-red-500/50",
};

const kindIcon: Partial<Record<LineKind, string>> = {
    info: "bi-info-circle",
    success: "bi-check-circle",
    warning: "bi-exclamation-triangle",
    error: "bi-x-octagon",
};

const statusLabel = (run: OutputRun): string => {
    switch (run.status) {
        case "running": return "En ejecución";
        case "finished": return "Terminó";
        case "stopped": return "Detenida";
        case "failed": return run.exitCode !== null ? `Falló (código ${run.exitCode})` : "Falló";
    }
};

const statusStyle: Record<RunStatus, { icon: string; text: string }> = {
    running: { icon: "bi-arrow-repeat animate-spin", text: "text-accent" },
    finished: { icon: "bi-check-circle-fill", text: "text-emerald-400" },
    stopped: { icon: "bi-stop-circle-fill", text: "text-amber-400" },
    failed: { icon: "bi-x-circle-fill", text: "text-red-400" },
};

const copyText = (text: string) => navigator.clipboard.writeText(text).catch(() => {});

/** Wraps every case-insensitive occurrence of `query` in a highlight. */
const highlight = (text: string, query: string) => {
    if (!query) return text;
    const lower = text.toLowerCase();
    const needle = query.toLowerCase();
    const parts: React.ReactNode[] = [];
    let from = 0;
    for (let at = lower.indexOf(needle); at !== -1; at = lower.indexOf(needle, from)) {
        if (at > from) parts.push(text.slice(from, at));
        parts.push(<mark key={at} className="bg-accent/40 text-white rounded-sm">{text.slice(at, at + needle.length)}</mark>);
        from = at + needle.length;
    }
    parts.push(text.slice(from));
    return parts;
};

interface LineProps {
    line: OutputLine;
    query: string;
    onOpenLocation: (path: string, line: number, column: number) => void;
}

const Line = memo(({ line, query, onOpenLocation }: LineProps) => {
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
                        {highlight(segment.text, query)}
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
Line.displayName = "Line";

const Details = ({ lines }: { lines: OutputLine[] }) => {
    const [open, setOpen] = useState(false);

    return (
        <div>
            <button
                onClick={() => setOpen((v) => !v)}
                className="flex items-center gap-2 px-2 py-0.5 text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
            >
                <i className={`bi bi-chevron-right text-[8px] transition-transform ${open ? "rotate-90" : ""}`} />
                Detalles técnicos ({lines.length} líneas)
            </button>
            {open && (
                <div className="pl-5 text-gray-500 opacity-80">
                    {lines.map((line) => (
                        <div key={line.id} className="px-2 whitespace-pre-wrap break-words">{stripAnsi(line.text)}</div>
                    ))}
                </div>
            )}
        </div>
    );
};

interface RunBlockProps {
    run: OutputRun;
    expanded: boolean;
    problemsOnly: boolean;
    query: string;
    onToggle: () => void;
    onOpenLocation: (path: string, line: number, column: number) => void;
}

const RunBlock = memo(({ run, expanded, problemsOnly, query, onToggle, onOpenLocation }: RunBlockProps) => {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (run.status !== "running") return;
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [run.status]);

    const style = statusStyle[run.status];
    const duration = formatDuration((run.endedAt ?? now) - run.startedAt);
    const errorCount = run.lines.filter((l) => isError(l.kind)).length;

    const visible = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return run.lines.filter((l) => (!problemsOnly || isProblem(l.kind)) && (!needle || stripAnsi(l.text).toLowerCase().includes(needle)));
    }, [run.lines, problemsOnly, query]);

    // Grouping hides lines, which would fight with a search or the errors filter.
    const items = useMemo<Item[]>(
        () => (query.trim() || problemsOnly ? visible.map((line) => ({ type: "line", line })) : groupLines(visible)),
        [visible, query, problemsOnly],
    );

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
                                <Line key={item.line.id} line={item.line} query={query.trim()} onOpenLocation={onOpenLocation} />
                            ) : (
                                <Details key={item.id} lines={item.lines} />
                            ),
                        )
                    )}
                </div>
            )}
        </section>
    );
});
RunBlock.displayName = "RunBlock";

interface RunOutputProps {
    className?: string;
    onOpenLocation: (path: string, line: number, column: number) => void;
}

export const RunOutput = ({ className = "", onOpenLocation }: RunOutputProps) => {
    const runs = useOutputRuns();
    const scrollRef = useRef<HTMLDivElement>(null);
    const stickToBottom = useRef(true);
    // Only the latest run is open unless the user toggled one by hand.
    const [toggled, setToggled] = useState<Record<number, boolean>>({});
    const [problemsOnly, setProblemsOnly] = useState(false);
    const [query, setQuery] = useState("");
    const lastRunId = runs[runs.length - 1]?.id;

    useLayoutEffect(() => {
        const el = scrollRef.current;
        if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
    }, [runs]);

    const handleScroll = () => {
        const el = scrollRef.current;
        if (!el) return;
        stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    };

    if (runs.length === 0) {
        return (
            <div className={`flex flex-col items-center justify-center gap-1 text-center ${className}`}>
                <i className="bi bi-terminal text-lg text-gray-600" />
                <p className="text-xs text-gray-500">Sin salida todavía.</p>
                <p className="text-[11px] text-gray-600">Pulsa Ejecutar (Ctrl+R) para arrancar tu bot.</p>
            </div>
        );
    }

    return (
        <div className={`flex flex-col ${className}`}>
            <div className="shrink-0 flex items-center gap-2 pb-2">
                <button
                    onClick={() => setProblemsOnly((v) => !v)}
                    className={`h-6 flex items-center px-2 rounded text-[10px] leading-none transition-colors ${problemsOnly ? "bg-red-500/20 text-red-300" : "bg-white/5 text-gray-500 hover:text-gray-300"}`}
                >
                    <i className="bi bi-funnel mr-1" />
                    Solo errores
                </button>
                <div className="h-6 flex items-center gap-1.5 flex-1 max-w-[260px] px-2 rounded bg-white/5">
                    <i className="bi bi-search text-[10px] leading-none text-gray-500" />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Buscar en la salida"
                        className="flex-1 min-w-0 h-full p-0 bg-transparent outline-none text-[11px] leading-none text-gray-200 placeholder:text-gray-600"
                    />
                    {query && (
                        <button onClick={() => setQuery("")} className="flex items-center text-gray-500 hover:text-white">
                            <i className="bi bi-x text-xs leading-none" />
                        </button>
                    )}
                </div>
            </div>

            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="custom-scrollbar flex-1 min-h-0 overflow-y-auto select-text text-xs font-[family-name:var(--editor-font-family)]"
            >
                {runs.map((run) => (
                    <RunBlock
                        key={run.id}
                        run={run}
                        expanded={toggled[run.id] ?? run.id === lastRunId}
                        problemsOnly={problemsOnly}
                        query={query}
                        onOpenLocation={onOpenLocation}
                        onToggle={() => setToggled((prev) => ({ ...prev, [run.id]: !(prev[run.id] ?? run.id === lastRunId) }))}
                    />
                ))}
            </div>
        </div>
    );
};
