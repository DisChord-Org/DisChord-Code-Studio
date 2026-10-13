import { invoke } from "@tauri-apps/api/core";
import type { CheckResult, Corelib } from "./types";

/** Checks the code of a buffer (saved or not) as the file `filePath` of the project. */
export const checkSource = (projectName: string, filePath: string, source: string) =>
    invoke<CheckResult>("compiler_check", { projectName, filePath, source });

let corelibRequest: Promise<Corelib | null> | null = null;

/**
 * The vocabulary of the language, read once from the compiler. Resolves to null (instead of throwing) when the
 * compiler cannot give it, so that features built on it can fall back to what the IDE knows by itself.
 */
export const loadCorelib = (): Promise<Corelib | null> => {
    corelibRequest ??= invoke<Corelib>("compiler_corelib")
        .then((corelib) => (corelib && typeof corelib === "object" && "schema" in corelib ? corelib : null))
        .catch((error) => {
            console.error("No se pudo leer el vocabulario del compilador:", error);
            corelibRequest = null;
            return null;
        });

    return corelibRequest;
};
