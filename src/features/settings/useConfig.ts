import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AppConfig } from "./types";

const DEFAULT_CONFIG: AppConfig = { view_mode: "list", log_rotation: "daily" };

export const useConfig = () => {
    const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        invoke<AppConfig>("get_config")
            .then(setConfig)
            .catch((error) => console.error("No se pudo cargar la configuración:", error))
            .finally(() => setLoaded(true));
    }, []);

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
