import type { TerminalTab } from "./types";

export const tabLabels: Record<TerminalTab, string> = {
    output: "Salida",
    shell: "Terminal",
};

export const basicTabs: readonly TerminalTab[] = ["output"];
export const advancedTabs: readonly TerminalTab[] = ["output", "shell"];

export const controlsArmDelayMs = 1000;

export const panelSize = { initial: 288, min: 120, max: 640 };

// Matches the terminal surface colour (#0B0E14) so the dim overlay blends with it.
export const backgroundDimRgb = "11, 14, 20";
