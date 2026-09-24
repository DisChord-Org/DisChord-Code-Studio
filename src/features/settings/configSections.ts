import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export type ConfigFieldValue = boolean | number | string;

export interface ConfigField {
    key: string;
    type: "boolean" | "number" | "text" | "select";
    label: string;
    description: string;
    default: ConfigFieldValue;
    options: { value: string; label: string }[];
    min: number | null;
    max: number | null;
    step: number | null;
}

export interface ConfigSchema {
    id: string;
    title: string;
    icon: string;
    requires: string | null;
    fields: ConfigField[];
}

export interface ConfigSection {
    schema: ConfigSchema;
    values: Record<string, ConfigFieldValue>;
}

export const sectionNavKey = (id: string) => `section:${id}` as const;

/**
 * Sections declared through the backend's config-section loader (see
 * src-tauri/src/commands/config_sections.rs). Sections gated behind a flag (e.g. the terminal
 * behind advanced mode) only come back while that flag is on, so pass the flags they may depend
 * on as `refreshKey` to reload the list when they change.
 */
export const useConfigSections = (refreshKey: unknown) => {
    const [sections, setSections] = useState<ConfigSection[]>([]);

    useEffect(() => {
        let cancelled = false;

        invoke<ConfigSection[]>("get_config_sections")
            .then((loaded) => {
                if (!cancelled) setSections(loaded);
            })
            .catch((error) => console.error("No se pudieron cargar las secciones de configuración:", error));

        return () => {
            cancelled = true;
        };
    }, [refreshKey]);

    const saveSection = useCallback(async (id: string, values: Record<string, ConfigFieldValue>) => {
        setSections((prev) => prev.map((s) => (s.schema.id === id ? { ...s, values } : s)));

        try {
            const saved = await invoke<Record<string, ConfigFieldValue>>("save_config_section", { id, values });
            setSections((prev) => prev.map((s) => (s.schema.id === id ? { ...s, values: saved } : s)));
        } catch (error) {
            console.error(`No se pudo guardar la sección '${id}':`, error);
        }
    }, []);

    return { sections, saveSection };
};
