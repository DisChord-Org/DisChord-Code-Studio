import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileIcon } from "../editor/components/FileIcon";
import { filterPaths } from "./fuzzy";

interface QuickOpenProps {
    projectName: string;
    onOpen: (path: string) => void;
    onClose: () => void;
}

const baseName = (path: string) => path.slice(path.lastIndexOf("/") + 1);

export const QuickOpen = ({ projectName, onOpen, onClose }: QuickOpenProps) => {
    const [paths, setPaths] = useState<string[]>([]);
    const [query, setQuery] = useState("");
    const [selected, setSelected] = useState(0);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let cancelled = false;
        invoke<string[]>("list_project_paths", { projectName })
            .then((list) => !cancelled && setPaths(list))
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [projectName]);

    const results = useMemo(() => filterPaths(paths, query), [paths, query]);

    useEffect(() => setSelected(0), [query]);

    useEffect(() => {
        listRef.current?.querySelector<HTMLElement>(`[data-index="${selected}"]`)?.scrollIntoView({ block: "nearest" });
    }, [selected]);

    const choose = (path: string | undefined) => {
        if (!path) return;
        onOpen(path);
        onClose();
    };

    const handleKey = (e: React.KeyboardEvent) => {
        if (e.key === "Escape") {
            e.preventDefault();
            onClose();
        } else if (e.key === "ArrowDown") {
            e.preventDefault();
            setSelected((i) => Math.min(i + 1, results.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setSelected((i) => Math.max(i - 1, 0));
        } else if (e.key === "Enter") {
            e.preventDefault();
            choose(results[selected]);
        }
    };

    return (
        <div className="fixed inset-0 z-[90] flex items-start justify-center pt-[12vh] bg-black/40" onMouseDown={onClose}>
            <div
                role="dialog"
                aria-label="Abrir archivo"
                className="w-full max-w-xl bg-panel border border-border rounded-xl shadow-2xl overflow-hidden"
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/10">
                    <i className="bi bi-search text-gray-500 text-sm" aria-hidden="true" />
                    <input
                        autoFocus
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKey}
                        placeholder="Buscar archivo por nombre…"
                        aria-label="Buscar archivo por nombre"
                        className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-600"
                    />
                </div>
                <div ref={listRef} role="listbox" className="max-h-[50vh] overflow-y-auto py-1">
                    {results.length === 0 ? (
                        <p className="px-4 py-6 text-center text-xs text-gray-500">No hay archivos que coincidan.</p>
                    ) : (
                        results.map((path, i) => {
                            const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
                            return (
                                <div
                                    key={path}
                                    data-index={i}
                                    role="option"
                                    aria-selected={i === selected}
                                    onMouseEnter={() => setSelected(i)}
                                    onClick={() => choose(path)}
                                    className={`flex items-center gap-2.5 px-4 py-1.5 cursor-pointer ${i === selected ? "bg-white/[0.08]" : ""}`}
                                >
                                    <FileIcon name={baseName(path)} />
                                    <span className="text-sm text-gray-200 truncate">{baseName(path)}</span>
                                    {dir && <span className="text-xs text-gray-500 truncate">{dir}</span>}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};
