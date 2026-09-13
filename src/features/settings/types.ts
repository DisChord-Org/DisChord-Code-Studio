export type LogRotation = "daily" | "session" | "hourly";
export type SettingsSection = "dashboard" | "editor" | "logs";

export interface AppConfig {
    view_mode: "list" | "grid";
    log_rotation: LogRotation;
    editor_font_family: string;
    editor_font_size: number;
}
