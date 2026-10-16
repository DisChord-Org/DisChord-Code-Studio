import { useMemo, useState } from "react";
import { Label } from "../../../../components/ui";
import { outlineContainerKinds, outlineIcons } from "./Outline.constants";
import { useFileDeclarations, type Declaration } from "../../../compiler";

interface OutlineRow {
    item: Declaration;
    depth: number;
}

interface OutlineProps {
    path: string;
    onJump: (line: number, column: number) => void;
}

const storageKey = "dischord:outline-collapsed";

const readCollapsed = () => {
    try {
        return localStorage.getItem(storageKey) === "1";
    } catch {
        return false;
    }
};

const outlineItems = (items: Declaration[]): OutlineRow[] => {
    const containers = new Set(items.filter((d) => outlineContainerKinds.includes(d.kind)).map((d) => d.name));

    return items
        .filter((d) => d.kind !== "parameter" && d.kind !== "used")
        .filter((d) => !d.container || d.kind === "method" || d.kind === "property" || d.kind === "constructor")
        .sort((a, b) => a.start.line - b.start.line || a.start.column - b.start.column)
        .map((item) => ({ item, depth: item.container && containers.has(item.container) ? 1 : 0 }));
};

export const Outline = ({ path, onJump }: OutlineProps) => {
    const declarations = useFileDeclarations(path);
    const [collapsed, setCollapsed] = useState(readCollapsed);
    const rows = useMemo(() => outlineItems(declarations?.items ?? []), [declarations]);

    const toggle = () => {
        const next = !collapsed;
        setCollapsed(next);
        try {
            localStorage.setItem(storageKey, next ? "1" : "0");
        } catch {
            // Best-effort; the section just reopens next time.
        }
    };

    return (
        <section className="relative flex flex-col min-h-0 max-h-[40%] shadow-[0_-1px_3px_0_rgba(0,0,0,0.35)]">
            <button
                onClick={toggle}
                className="h-6 shrink-0 flex items-center gap-1.5 px-3 text-left hover:bg-white/[0.03] transition-colors"
            >
                <i className={`bi bi-chevron-right text-[8px] text-gray-600 transition-transform duration-150 ${collapsed ? "" : "rotate-90"}`} />
                <Label>Esquema</Label>
                <span className="flex-1" />
                {rows.length > 0 && <span className="text-[10px] text-gray-600 tabular-nums">{rows.length}</span>}
            </button>

            {!collapsed && (
                <div className="custom-scrollbar overflow-y-auto pb-2">
                    {rows.length === 0 ? (
                        <p className="px-4 py-2 text-[11px] text-gray-600 italic">Sin símbolos todavía.</p>
                    ) : (
                        rows.map(({ item, depth }) => (
                            <button
                                key={`${item.kind}:${item.name}:${item.start.line}:${item.start.column}`}
                                onClick={() => onJump(item.start.line, item.start.column)}
                                className="w-full flex items-center gap-1.5 pr-3 py-0.5 text-[12px] text-gray-400 hover:bg-white/5 hover:text-gray-200 transition-colors text-left"
                                style={{ paddingLeft: `${depth * 12 + 16}px` }}
                                title={`${item.kind} · línea ${item.start.line}`}
                            >
                                <i className={`bi ${outlineIcons[item.kind] ?? "bi-dot"} text-[11px] text-gray-500 shrink-0`} />
                                <span className="truncate flex-1">{item.name}</span>
                                <span className="text-[10px] text-gray-700 tabular-nums">{item.start.line}</span>
                            </button>
                        ))
                    )}
                </div>
            )}
        </section>
    );
};
