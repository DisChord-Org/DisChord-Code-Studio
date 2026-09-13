import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AppConfig } from "./types";
import { buildFontFamilyCss } from "./font";

const DEFAULT_CONFIG: AppConfig = {
    view_mode: "list",
    log_rotation: "daily",
    editor_font_family: "Monocraft",
    editor_font_size: 14,
};

export const useConfig = () => {
    const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        invoke<AppConfig>("get_config")
            .then(setConfig)
            .catch((error) => console.error("No se pudo cargar la configuración:", error))
            .finally(() => setLoaded(true));
    }, []);

    useEffect(() => {
        document.documentElement.style.setProperty("--editor-font-family", buildFontFamilyCss(config.editor_font_family));
    }, [config.editor_font_family]);

    useEffect(() => {
        document.documentElement.style.setProperty("--editor-font-size", `${config.editor_font_size}px`);
    }, [config.editor_font_size]);

    const updateConfig = async (patch: Partial<AppConfig>) => {
        const next = { ...config, ...patch };
        setConfig(next);

        try {
            await invoke("save_config", { config: next });
        } catch (error) {
            console.error("No se pudo guardar la configuración:", error);
        }
    };

    return { config, loaded, updateConfig };
};
