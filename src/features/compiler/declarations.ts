import { invoke } from "@tauri-apps/api/core";
import { useSyncExternalStore } from "react";
import { collectDeclarations } from "../../languages/chord-symbols";

export interface SourcePosition {
    line: number;
    column: number;
}

export interface Declaration {
    kind: string;
    name: string;
    container?: string | null;
    start: SourcePosition;
    end: SourcePosition;
}

export interface FileDeclarations {
    items: Declaration[];
    source: "compiler" | "local";
}

interface DeclarationsResult {
    ok: boolean;
    declarations: Declaration[];
    tool_error?: string | null;
}

export const fetchDeclarations = async (projectName: string, filePath: string, source: string): Promise<Declaration[] | null> => {
    try {
        const result = await invoke<DeclarationsResult>("compiler_declarations", { projectName, filePath, source });
        return result.ok && !result.tool_error ? result.declarations : null;
    } catch {
        return null;
    }
};

const positionOf = (lineStarts: number[], offset: number): SourcePosition => {
    let low = 0;
    let high = lineStarts.length - 1;

    while (low < high) {
        const mid = (low + high + 1) >> 1;
        if (lineStarts[mid] <= offset) low = mid;
        else high = mid - 1;
    }

    return { line: low + 1, column: offset - lineStarts[low] + 1 };
};

const kindMap: Record<string, string> = { import: "import", module: "import", used: "used" };

export const localDeclarations = (text: string): Declaration[] => {
    const lineStarts = [0];
    for (let i = 0; i < text.length; i++) if (text[i] === "\n") lineStarts.push(i + 1);

    return collectDeclarations(text)
        .filter((d) => d.kind !== "used")
        .map((d) => ({
            kind: kindMap[d.kind] ?? d.kind,
            name: d.name,
            container: d.container ?? null,
            start: positionOf(lineStarts, d.from),
            end: positionOf(lineStarts, d.to),
        }));
};

let byFile = new Map<string, FileDeclarations>();
const listeners = new Set<() => void>();

export const setFileDeclarations = (path: string, value: FileDeclarations) => {
    byFile = new Map(byFile).set(path, value);
    listeners.forEach((listener) => listener());
};

export const clearFileDeclarations = (path: string) => {
    if (!byFile.has(path)) return;
    byFile = new Map(byFile);
    byFile.delete(path);
    listeners.forEach((listener) => listener());
};

export const getFileDeclarations = (path: string): FileDeclarations | undefined => byFile.get(path);

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

export const useFileDeclarations = (path: string | undefined): FileDeclarations | undefined =>
    useSyncExternalStore(subscribe, () => (path ? byFile.get(path) : undefined));
