import type { LineKind, RunStatus } from "./types";

export const kindStyle: Record<LineKind, string> = {
    stdout: "text-gray-300",
    stderr: "text-red-300 bg-red-500/[0.06] border-l-red-500/50",
    info: "text-sky-300",
    success: "text-emerald-400",
    warning: "text-amber-300",
    error: "text-red-400 font-semibold bg-red-500/[0.06] border-l-red-500/50",
};

export const kindIcon: Partial<Record<LineKind, string>> = {
    info: "bi-info-circle",
    success: "bi-check-circle",
    warning: "bi-exclamation-triangle",
    error: "bi-x-octagon",
};

export const statusStyle: Record<RunStatus, { icon: string; text: string }> = {
    running: { icon: "bi-arrow-repeat animate-spin", text: "text-accent" },
    finished: { icon: "bi-check-circle-fill", text: "text-emerald-400" },
    stopped: { icon: "bi-stop-circle-fill", text: "text-amber-400" },
    failed: { icon: "bi-x-circle-fill", text: "text-red-400" },
};

export const clockTickMs = 1000;

// Distance from the bottom (px) within which the view keeps following new output.
export const stickToBottomThreshold = 24;
