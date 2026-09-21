import type { Phase, TargetKey } from "./Update";

type TargetMeta = Record<TargetKey, { label: string; icon: string; desc: string }>;
type StatusText = Record<Phase, string>;

export const targetMeta: TargetMeta = {
    ide: { label: "DisChord Code Studio", icon: "bi-window-stack", desc: "El propio editor de código" },
    cli: { label: "DisChord CLI", icon: "bi-terminal-fill", desc: "Herramienta de línea de comandos" },
    compiler: { label: "Compilador", icon: "bi-cpu-fill", desc: "DisChord en su nivel más bajo" },
    node: { label: "Node.js", icon: "bi-hexagon-fill", desc: "Entorno de ejecución (embebido)" },
    pnpm: { label: "pnpm", icon: "bi-box-seam-fill", desc: "Gestor de paquetes de tus proyectos (embebido)" },
};

export const statusText: StatusText = {
    idle: "En espera",
    checking: "Comprobando…",
    downloading: "Descargando…",
    installing: "Instalando…",
    up_to_date: "Al día",
    done: "Actualizado",
    error: "Error",
};
