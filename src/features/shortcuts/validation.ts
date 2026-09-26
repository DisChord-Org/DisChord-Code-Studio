import { isMac } from "../../utils/Platform";
import { isRiskyWithoutModifier, normalizeAccelerator } from "./accelerator";
import { defaultAcceleratorFor, shortcutDefinitions } from "./definitions";
import type { KeybindingOverrides, ShortcutDefinition } from "./types";

/** Whether two shortcuts can be pressed in the same place, so binding both to one key would be ambiguous. */
const overlap = (a: ShortcutDefinition, b: ShortcutDefinition): boolean => {
    if (a.scope === b.scope) return true;

    const [app, other] = a.scope === "app" ? [a, b] : b.scope === "app" ? [b, a] : [null, null];
    if (!app || !other) return false;

    // "app" shortcuts do not fire inside the interactive terminal, so they cannot clash with its own keys.
    return other.scope !== "terminal" || !!app.allowInTerminal;
};

export const findConflicts = (
    id: string,
    accelerator: string,
    bindings: Readonly<Record<string, string>>,
): ShortcutDefinition[] => {
    const own = shortcutDefinitions.find((d) => d.id === id);
    const normalized = normalizeAccelerator(accelerator);
    if (!own || !normalized) return [];

    return shortcutDefinitions.filter(
        (other) => other.id !== id && bindings[other.id] === normalized && overlap(own, other),
    );
};

/** A problem that stops this accelerator from being used for `definition`, or null when it is fine. */
export const problemWith = (definition: ShortcutDefinition, accelerator: string): string | null => {
    if (definition.scope === "app" && isRiskyWithoutModifier(accelerator, isMac)) {
        return `Un atajo global necesita ${isMac ? "⌃, ⌥ o ⌘" : "Ctrl o Alt"} (o una tecla F), o interferiría al escribir.`;
    }
    return null;
};

/** The overrides that remain once `id` is set to `accelerator` (dropping it when it equals the default). */
export const withBinding = (overrides: KeybindingOverrides, id: string, accelerator: string): KeybindingOverrides => {
    const definition = shortcutDefinitions.find((d) => d.id === id);
    const next = { ...overrides };

    if (definition && accelerator === defaultAcceleratorFor(definition, isMac)) delete next[id];
    else next[id] = accelerator;

    return next;
};
