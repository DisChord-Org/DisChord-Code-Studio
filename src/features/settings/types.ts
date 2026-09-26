export type LogRotation = "daily" | "session" | "hourly";
export type BuiltinSettingsSection = "dashboard" | "editor" | "advanced" | "logs";
/** Built-in sections plus the ones declared through the config-section loader (`section:<id>`). */
export type SettingsSection = BuiltinSettingsSection | `section:${string}`;

export interface AppConfig {
    view_mode: "list" | "grid";
    log_rotation: LogRotation;
    editor_font_family: string;
    editor_font_size: number;
    editor_word_wrap: boolean;
    editor_tab_size: number;
    editor_use_tabs: boolean;
    advanced_mode: boolean;
    editor_keep_minimap: boolean;
    editor_keep_statusbar: boolean;
    editor_final_newline: boolean;
}
