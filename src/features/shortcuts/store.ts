import { useSyncExternalStore } from "react";
import { invoke } from "@tauri-apps/api/core";
import { isMac } from "../../utils/Platform";
import { formatAccelerator, matchesAccelerator, normalizeAccelerator, type KeyEventLike } from "./accelerator";
import { defaultAcceleratorFor, getDefinition, shortcutDefinitions } from "./definitions";
import type { KeybindingOverrides } from "./types";

let overrides: KeybindingOverrides = {};
let resolved: Readonly<Record<string, string>> = resolve(overrides);
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

/** Accelerator in force per shortcut id ("" = unassigned): the user's override, or the platform default. */
function resolve(saved: KeybindingOverrides): Readonly<Record<string, string>> {
    const bindings: Record<string, string> = {};

    for (const definition of shortcutDefinitions) {
        const custom = saved[definition.id];
        const own = custom === undefined ? null : custom === "" ? "" : normalizeAccelerator(custom);
        // A malformed override in config.json falls back to the default instead of killing the shortcut.
        bindings[definition.id] = own ?? defaultAcceleratorFor(definition, isMac);
    }

    return bindings;
}

/** Replaces the user's overrides (after loading them, or after the settings screen saved new ones). */
export const setKeybindingOverrides = (next: KeybindingOverrides) => {
    overrides = { ...next };
    resolved = resolve(overrides);
    listeners.forEach((listener) => listener());
};

/** Reads the overrides from config.json once; safe to call from several places. */
export const loadKeybindings = (): Promise<void> => {
    loading ??= invoke<{ keybindings?: KeybindingOverrides }>("get_config")
        .then((config) => setKeybindingOverrides(config.keybindings ?? {}))
        .catch((error) => {
            loading = null;
            console.error("No se pudieron cargar los atajos de teclado:", error);
        });

    return loading;
};

export const getKeybindingOverrides = (): KeybindingOverrides => overrides;

export const getBinding = (id: string): string => resolved[id] ?? "";

/** Whether the event is the shortcut `id`, with whatever is configured right now. */
export const matchesShortcut = (event: KeyEventLike, id: string): boolean => {
    const accelerator = getBinding(id);
    return accelerator !== "" && matchesAccelerator(event, accelerator, isMac);
};

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

/** All the bindings in force; re-renders when they change. */
export const useKeybindings = (): Readonly<Record<string, string>> => useSyncExternalStore(subscribe, () => resolved);

/** Display text of a shortcut for menus ("Ctrl+S", "⌘S"), or undefined when it is unassigned. */
export const useShortcutLabel = (id: string): string | undefined => {
    const bindings = useKeybindings();
    const accelerator = bindings[id];
    return accelerator ? formatAccelerator(accelerator, isMac) : undefined;
};

export const defaultFor = (id: string): string => {
    const definition = getDefinition(id);
    return definition ? defaultAcceleratorFor(definition, isMac) : "";
};
