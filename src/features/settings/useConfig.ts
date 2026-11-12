import { useEffect, useSyncExternalStore } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AppConfig } from "./types";
import { buildFontFamilyCss } from "./font";
import { loadDownloadedFonts } from "./localFonts";

const defaultConfig: AppConfig = {
    view_mode: "list",
    log_rotation: "daily",
    editor_font_family: "Monocraft",
    editor_font_size: 14,
    editor_word_wrap: false,
    editor_tab_size: 4,
    editor_use_tabs: true,
    advanced_mode: false,
    editor_keep_minimap: false,
    editor_keep_statusbar: false,
    editor_final_newline: true,
    editor_live_diagnostics: true,
    editor_block_form: true,
    terminal_background_source: "bundled",
    terminal_background_image: "",
    terminal_background_dim: 96,
    terminal_background_fit: "cover",
    terminal_background_animated: true,
    keybindings: {},
};

let current: AppConfig = defaultConfig;
let loaded = false;
let started = false;
let earlyPatch: Partial<AppConfig> = {};
let saveChain: Promise<void> = Promise.resolve();
const subscribers = new Set<() => void>();

const emit = () => subscribers.forEach((notifyChange) => notifyChange());

const applyCss = (config: AppConfig) => {
    document.documentElement.style.setProperty("--editor-font-family", buildFontFamilyCss(config.editor_font_family));
    document.documentElement.style.setProperty("--editor-font-size", `${config.editor_font_size}px`);
};

const start = () => {
    if (started) return;
    started = true;
    applyCss(current);

    invoke<AppConfig>("get_config")
        .then((fromDisk) => {
            current = { ...fromDisk, ...earlyPatch };
            earlyPatch = {};
        })
        .catch((error) => console.error("No se pudo cargar la configuración:", error))
        .finally(() => {
            loaded = true;
            applyCss(current);
            emit();
        });

    loadDownloadedFonts();
};

const updateConfig = async (patch: Partial<AppConfig>) => {
    current = { ...current, ...patch };
    if (!loaded) earlyPatch = { ...earlyPatch, ...patch };
    applyCss(current);
    emit();

    saveChain = saveChain.then(async () => {
        try {
            await invoke("save_config", { config: current });
        } catch (error) {
            console.error("No se pudo guardar la configuración:", error);
        }
    });
    await saveChain;
};

const subscribe = (notifyChange: () => void) => {
    subscribers.add(notifyChange);
    return () => subscribers.delete(notifyChange);
};

const getConfig = () => current;
const getLoaded = () => loaded;

export const useConfig = () => {
    const config = useSyncExternalStore(subscribe, getConfig);
    const isLoaded = useSyncExternalStore(subscribe, getLoaded);

    useEffect(start, []);

    return { config, loaded: isLoaded, updateConfig };
};
