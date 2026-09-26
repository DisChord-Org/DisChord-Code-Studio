import type { SettingsSection } from "../types";

export interface NavItem {
    key: SettingsSection;
    label: string;
    icon: string;
}

export const navItems: NavItem[] = [
    { key: "dashboard", label: "Dashboard", icon: "bi-grid-3x3-gap-fill" },
    { key: "editor", label: "Editor", icon: "bi-fonts" },
    { key: "terminal", label: "Terminal", icon: "bi-window-desktop" },
    { key: "logs", label: "Logs", icon: "bi-file-earmark-text" },
    { key: "advanced", label: "Avanzado", icon: "bi-terminal" },
];
