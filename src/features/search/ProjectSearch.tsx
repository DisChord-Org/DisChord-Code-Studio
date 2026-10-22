import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileIcon } from "../editor/components/FileIcon";
import { Button } from "../../components/ui";
import { confirmAction, showError } from "../../utils/Dialogs";
import type { ReplaceSummary, SearchResults } from "./types";

interface ProjectSearchProps {
    projectName: string;
    onOpenAt: (path: string, line: number, column: number) => void;
    onClose: () => void;
    /** Files changed on disk by a replace, so open tabs can be refreshed. */
    onReplaced?: () => void;
    /** Open files with unsaved edits: a replace on them would be lost or clash with the editor. */
    dirtyPaths?: string[];
}

const baseName = (path: string) => path.slice(path.lastIndexOf("/") + 1);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const toggleClass = (on: boolean) =>
    `px-1.5 py-0.5 rounded text-[11px] font-mono border transition-colors ${on ? "bg-accent/30 border-accent/60 text-white" : "border-white/10 text-gray-400 hover:text-white"}`;

export const ProjectSearch = ({ projectName, onOpenAt, onClose, onReplaced, dirtyPaths = [] }: ProjectSearchProps) => {
    const [query, setQuery] = useState("");
    const [replacement, setReplacement] = useState("");
    const [caseSensitive, setCaseSensitive] = useState(false);
    const [useRegex, setUseRegex] = useState(false);
    const [results, setResults] = useState<SearchResults | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const requestId = useRef(0);

    const search = async () => {
        const id = ++requestId.current;
        if (!query) {
            setResults(null);
            setError(null);
            return;
        }
        setBusy(true);
        try {
            const found = await invoke<SearchResults>("search_project", { projectName, query, caseSensitive, useRegex });
            if (id !== requestId.current) return;
            setResults(found);
            setError(null);
        } catch (e) {
            if (id !== requestId.current) return;
            setResults(null);
            setError(String(e));
        } finally {
            if (id === requestId.current) setBusy(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(search, 250);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query, caseSensitive, useRegex, projectName]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.stopPropagation();
                onClose();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    const replace = async (filePath: string | null) => {
        if (!results || results.total_matches === 0) return;

        const target = filePath ? results.files.find((f) => f.path === filePath) : null;
        const blocked = dirtyPaths.filter((p) => (target ? p === target.path : results.truncated || results.files.some((f) => f.path === p)));
        if (blocked.length > 0) {
            showError(`Hay cambios sin guardar en ${blocked.map((p) => `"${p}"`).join(", ")}. Guárdalos o ciérralos antes de reemplazar.`);
            return;
        }

        const count = target ? target.matches.length : results.total_matches;
        const where = target ? `en ${target.path}` : `en ${plural(results.files.length, "archivo", "archivos")}`;
        const note = !filePath && results.truncated ? " Hay más coincidencias que las mostradas; también se reemplazarán." : "";
        const ok = await confirmAction(
            `¿Reemplazar ${plural(count, "coincidencia", "coincidencias")} ${where} por "${replacement}"? Los cambios se guardan directamente en disco.${note}`,
            "Reemplazar",
            { title: "Reemplazar en el proyecto", detail: "Esta acción modifica archivos en disco y no se puede deshacer." },
        );
        if (!ok) return;

        try {
            await invoke<ReplaceSummary>("replace_in_project", { projectName, query, replacement, caseSensitive, useRegex, filePath });
            onReplaced?.();
            await search();
        } catch (e) {
            showError(e);
        }
    };

    const summary = busy && !results
        ? "Buscando…"
        : results
            ? results.total_matches === 0
                ? "Sin resultados."
                : `${plural(results.total_matches, "resultado", "resultados")}${results.truncated ? " (límite alcanzado)" : ""} en ${plural(results.files.length, "archivo", "archivos")}`
            : "";

    return (
        <div className="fixed inset-0 z-[90] flex items-start justify-center pt-[8vh] bg-black/40" onMouseDown={onClose}>
            <div
                role="dialog"
                aria-label="Buscar en el proyecto"
                className="w-full max-w-2xl bg-panel border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div className="p-4 border-b border-white/10 flex flex-col gap-2.5">
                    <div className="flex items-center gap-2.5 border-b border-white/10 focus-within:border-accent/60 pb-2 transition-colors">
                        <i className="bi bi-search text-gray-500 text-sm" aria-hidden="true" />
                        <input
                            autoFocus
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && void search()}
                            placeholder="Buscar en el proyecto…"
                            aria-label="Texto a buscar"
                            className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-600"
                        />
                        <button type="button" title="Distinguir mayúsculas" aria-label="Distinguir mayúsculas" aria-pressed={caseSensitive} className={toggleClass(caseSensitive)} onClick={() => setCaseSensitive((v) => !v)}>Aa</button>
                        <button type="button" title="Expresión regular" aria-label="Expresión regular" aria-pressed={useRegex} className={toggleClass(useRegex)} onClick={() => setUseRegex((v) => !v)}>.*</button>
                    </div>
                    <div className="flex items-center gap-2.5">
                        <i className="bi bi-arrow-repeat text-gray-500 text-sm" aria-hidden="true" />
                        <input
                            value={replacement}
                            onChange={(e) => setReplacement(e.target.value)}
                            placeholder={useRegex ? "Reemplazar por (admite $1)…" : "Reemplazar por…"}
                            aria-label="Texto de reemplazo"
                            className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-600"
                        />
                        <Button size="sm" variant="secondary" disabled={!results || results.total_matches === 0} onClick={() => void replace(null)}>
                            Reemplazar todo
                        </Button>
                    </div>
                    <p className={`text-xs ${error ? "text-red-400" : "text-gray-500"}`} role="status">{error ?? summary}</p>
                </div>

                <div className="overflow-y-auto py-1">
                    {results?.files.map((file) => (
                        <div key={file.path} className="mb-1">
                            <div className="flex items-center gap-2 px-4 py-1 group">
                                <FileIcon name={baseName(file.path)} />
                                <span className="text-sm text-gray-200 truncate">{baseName(file.path)}</span>
                                <span className="text-xs text-gray-500 truncate flex-1">{file.path}</span>
                                <span className="text-[11px] text-gray-400 bg-white/[0.06] rounded px-1.5">{file.matches.length}</span>
                                <button
                                    type="button"
                                    title="Reemplazar en este archivo"
                                    aria-label={`Reemplazar en ${file.path}`}
                                    className="text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 focus:opacity-100"
                                    onClick={() => void replace(file.path)}
                                >
                                    <i className="bi bi-arrow-left-right text-xs" aria-hidden="true" />
                                </button>
                            </div>
                            {file.matches.map((m, i) => {
                                const start = m.column - 1 - m.preview_offset;
                                const chars = Array.from(m.preview);
                                return (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={() => {
                                            onOpenAt(file.path, m.line, m.column);
                                            onClose();
                                        }}
                                        className="w-full flex items-baseline gap-3 pl-10 pr-4 py-0.5 text-left hover:bg-white/[0.06]"
                                    >
                                        <span className="w-8 shrink-0 text-right text-[11px] text-gray-600 tabular-nums">{m.line}</span>
                                        <span className="text-xs font-mono text-gray-400 truncate whitespace-pre">
                                            {chars.slice(0, start).join("")}
                                            <mark className="bg-accent/40 text-white rounded-sm">{chars.slice(start, start + m.length).join("")}</mark>
                                            {chars.slice(start + m.length).join("")}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
