import { phaseLabels } from "./PackageManager.constants";
import type { PkgOp, PkgOpOutcome, PkgResult } from "../types";
import type { ToastLevel } from "../../../utils/Toasts";

export const opKey = (action: string, name: string, version?: string) =>
    version ? `${action}:${name}:${version}` : `${action}:${name}`;

/** The label of a phase, never the raw word of the CLI. */
export const phaseLabel = (phase: string) => phaseLabels[phase] ?? "Procesando...";

export const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

const maxMessageLength = 200;

/** The first line with something in it, without the noise of a prefix like "Error:". */
export const firstLine = (text: string): string => {
    const line = text.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0) ?? "";
    const clean = line.replace(/^error\s*:\s*/i, "");
    return clean.length > maxMessageLength ? `${clean.slice(0, maxMessageLength)}…` : clean;
};

const maxDetailLines = 12;

const detailLines = (text: string) =>
    text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0).slice(0, maxDetailLines);

/** A failure of the tool itself (not of a package) in words a person can act on, with the raw text apart. */
export const friendlyError = (error: unknown): { message: string; details: string[] } => {
    const raw = String(error);
    const details = detailLines(raw);

    const known: Array<[RegExp, string]> = [
        [/os error 2|ENOENT|No such file or directory|cannot find the (file|path)/i, "No se pudo ejecutar chord: falta el comando o la carpeta del proyecto. Si falta el comando, reinstálalo desde el actualizador."],
        [/EACCES|permission denied|permiso denegado|os error 13/i, "Sin permisos para completar la operación."],
        [/timed? ?out|ETIMEDOUT/i, "La operación tardó demasiado. Inténtalo de nuevo."],
        [/ENOTFOUND|ECONNREFUSED|ECONNRESET|EAI_AGAIN|getaddrinfo|\bnetwork\b|fetch failed|unable to connect|\bdns\b/i, "No se pudo conectar con el registro. Revisa tu conexión."],
    ];

    for (const [pattern, message] of known) {
        if (pattern.test(raw)) return { message, details };
    }

    return { message: firstLine(raw) || "Ocurrió un error inesperado.", details };
};

const infinitive: Record<PkgOp, string> = {
    install: "instalar",
    uninstall: "desinstalar",
    use: "usar",
    unuse: "dejar de usar",
    sync: "sincronizar",
};

/** Why a package failed when the CLI gave no text of its own. */
const failureReasons: Record<string, string> = {
    error: "ocurrió un error",
    not_found: "no se encontró",
    invalid_signature: "la firma no es válida",
    not_installed: "no está instalada",
};

const resultLine = (r: PkgResult) =>
    `${r.package}${r.version ? `@${r.version}` : ""}: ${r.message ? firstLine(r.message) : phaseLabel(r.phase)}`;

export interface DescribedOutcome {
    level: ToastLevel;
    message: string;
    /** One line per package; shown only when the user asks for it. */
    details: string[];
}

/**
 * What to tell the user about an operation. `name` is the package the user asked about (empty for a sync).
 * Dependencies are mentioned, but they never decide the colour on their own: a failed one fails the operation
 * and says so; one that was simply already there is not news.
 */
export const describeOutcome = (op: PkgOp, name: string, outcome: PkgOpOutcome): DescribedOutcome => {
    const details = outcome.results.map(resultLine);

    if (!outcome.success) {
        const failed = outcome.results.find((r) => r.package === name && r.severity === "error")
            ?? outcome.results.find((r) => r.severity === "error");

        if (!failed) {
            const what = name ? `${infinitive[op]} ${name}` : infinitive[op];
            return { level: "error", message: `No se pudo ${what}: la operación no terminó bien.`, details };
        }

        const reason = failed.message ? firstLine(failed.message) : (failureReasons[failed.phase] ?? "la operación falló");
        const message = !name || failed.package === name
            ? `No se pudo ${infinitive[op]} ${failed.package}: ${reason}`
            : `No se pudo ${infinitive[op]} ${name}: falló la dependencia ${failed.package} (${reason})`;

        return { level: "error", message, details };
    }

    const warned = outcome.results.some((r) => r.warned);
    const changedDependencies = outcome.results.filter((r) => r.package !== name && r.severity === "success").length;
    const detailsWorthShowing = outcome.results.length > 1 || warned ? details : [];
    let message: string;

    switch (op) {
        case "install":
            message = outcome.changed
                ? `${name} instalada.${changedDependencies > 0 ? ` Incluye ${plural(changedDependencies, "dependencia", "dependencias")}.` : ""}`
                : `${name} ya estaba instalada.`;
            break;
        case "uninstall":
            message = outcome.changed
                ? `${name} desinstalada.`
                : outcome.results.some((r) => r.phase === "version_not_installed")
                    ? `Esa versión de ${name} no estaba instalada.`
                    : `${name} no estaba instalada.`;
            break;
        case "use":
            message = `Ahora usas ${name} en este proyecto.`;
            break;
        case "unuse":
            message = outcome.changed ? `${name} ya no se usa en este proyecto.` : `${name} no estaba en uso en este proyecto.`;
            break;
        case "sync": {
            const count = outcome.results.filter((r) => r.severity === "success").length;
            message = outcome.changed && count > 0 ? `${plural(count, "librería sincronizada", "librerías sincronizadas")}.` : "El proyecto ya estaba sincronizado.";
            break;
        }
    }

    if (warned) return { level: "warning", message: `${message} Atención: el paquete no está firmado.`, details: detailsWorthShowing };
    return { level: outcome.changed ? "success" : "info", message, details: detailsWorthShowing };
};
