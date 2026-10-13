import { invoke } from "@tauri-apps/api/core";
import { collectExports, type ChordSymbol } from "./chord-symbols";

interface LibrarySource {
    name: string;
    source: string;
}

let exportsByProject = new Map<string, ChordSymbol[]>();
let currentProject: string | null = null;

export const loadLibraryExports = async (projectName: string) => {
    currentProject = projectName;

    try {
        const sources = await invoke<LibrarySource[]>("get_library_sources", { projectName });
        exportsByProject.set(projectName, sources.flatMap(({ name, source }) => collectExports(source, name)));
    } catch (error) {
        exportsByProject.delete(projectName);
        console.error("No se pudieron leer las librerías del proyecto:", error);
    }
};

export const getLibraryExports = (): ChordSymbol[] => (currentProject && exportsByProject.get(currentProject)) || [];
