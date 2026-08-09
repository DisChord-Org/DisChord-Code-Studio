export type LogRotation = "daily" | "session" | "hourly";
export type SettingsSection = "dashboard" | "logs";

export interface AppConfig {
    view_mode: "list" | "grid";
    log_rotation: LogRotation;
}
