import type { SettingsSection } from "../types";

export const navItems: { key: SettingsSection; label: string; icon: string }[] = [
    { key: "dashboard", label: "Dashboard", icon: "bi-grid-3x3-gap-fill" },
    { key: "editor", label: "Editor", icon: "bi-fonts" },
    { key: "logs", label: "Logs", icon: "bi-file-earmark-text" },
    { key: "advanced", label: "Avanzado", icon: "bi-terminal" },
];
