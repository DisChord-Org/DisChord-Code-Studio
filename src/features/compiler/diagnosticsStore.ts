import { useSyncExternalStore } from "react";

export interface FileDiagnostics {
    errors: number;
    warnings: number;
    toolError: string | null;
    errorMessages: string[];
}

const empty: FileDiagnostics = { errors: 0, warnings: 0, toolError: null, errorMessages: [] };

let byFile = new Map<string, FileDiagnostics>();
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());

export const setFileDiagnostics = (path: string, value: FileDiagnostics) => {
    const previous = byFile.get(path);
    if (previous && previous.errors === value.errors && previous.warnings === value.warnings && previous.toolError === value.toolError && previous.errorMessages.join("\n") === value.errorMessages.join("\n")) return;

    byFile = new Map(byFile).set(path, value);
    notify();
};

export const clearFileDiagnostics = (path: string) => {
    if (!byFile.has(path)) return;
    byFile = new Map(byFile);
    byFile.delete(path);
    notify();
};

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

export const useFileDiagnostics = (path: string | undefined): FileDiagnostics =>
    useSyncExternalStore(subscribe, () => (path ? byFile.get(path) : undefined) ?? empty);
