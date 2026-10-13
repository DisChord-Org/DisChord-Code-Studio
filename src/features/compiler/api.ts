import { invoke } from "@tauri-apps/api/core";
import { setCorelib } from "../../languages/chord-corelib";
import type { CheckResult, Corelib } from "./types";

export const checkSource = (projectName: string, filePath: string, source: string) =>
    invoke<CheckResult>("compiler_check", { projectName, filePath, source });

let corelibRequest: Promise<Corelib | null> | null = null;

export const loadCorelib = (): Promise<Corelib | null> => {
    corelibRequest ??= invoke<Corelib>("compiler_corelib")
        .then((corelib) => {
            const valid = corelib && typeof corelib === "object" && "schema" in corelib ? corelib : null;
            setCorelib(valid);
            return valid;
        })
        .catch((error) => {
            console.error("No se pudo leer el vocabulario del compilador:", error);
            corelibRequest = null;
            return null;
        });

    return corelibRequest;
};
