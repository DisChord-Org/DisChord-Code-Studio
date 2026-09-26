/**
 * Keyboard shortcuts are stored as portable accelerator strings such as "Mod+Shift+S".
 *
 * `Mod` is the platform's main modifier: Command on macOS, Ctrl everywhere else. `Ctrl`, `Meta`, `Alt` and
 * `Shift` are literal. Everything here is pure (no DOM, no globals) so it can be reasoned about and tested
 * in isolation; the platform is always passed in.
 */

export type Modifier = "Mod" | "Ctrl" | "Meta" | "Alt" | "Shift";

/** The bits of a keyboard event this module needs. A real `KeyboardEvent` satisfies it. */
export interface KeyEventLike {
    key: string;
    code: string;
    ctrlKey: boolean;
    metaKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
}

export interface ParsedAccelerator {
    modifiers: Modifier[];
    key: string;
}

const modifierOrder: Modifier[] = ["Mod", "Ctrl", "Meta", "Alt", "Shift"];
const modifierKeys = new Set(["Control", "Shift", "Alt", "Meta", "AltGraph", "OS", "CapsLock", "Dead"]);

const keyAliases: Record<string, string> = {
    esc: "Escape",
    escape: "Escape",
    return: "Enter",
    enter: "Enter",
    del: "Delete",
    delete: "Delete",
    space: "Space",
    " ": "Space",
    up: "ArrowUp",
    down: "ArrowDown",
    left: "ArrowLeft",
    right: "ArrowRight",
};

const normalizeKeyName = (key: string): string => {
    const alias = keyAliases[key.toLowerCase()];
    if (alias) return alias;
    return key.length === 1 ? key.toUpperCase() : key;
};

/** Splits "Mod+Shift+S" into its parts; null when it is empty or malformed. */
export const parseAccelerator = (accelerator: string): ParsedAccelerator | null => {
    if (!accelerator.trim()) return null;

    // The "+" key itself is written "Mod++" (or just "+"), so peel it off before splitting on the separator.
    const plusKey = accelerator.trim() === "+" || accelerator.trim().endsWith("++");
    const head = plusKey ? accelerator.trim().slice(0, -1).replace(/\+$/, "") : accelerator.trim();
    const tokens = head === "" ? [] : head.split("+");

    const modifiers: Modifier[] = [];
    let key: string | null = plusKey ? "+" : null;

    for (const raw of tokens) {
        const token = raw.trim();
        const asModifier = modifierOrder.find((m) => m.toLowerCase() === token.toLowerCase());
        if (asModifier) {
            if (!modifiers.includes(asModifier)) modifiers.push(asModifier);
        } else if (key === null && token) {
            key = normalizeKeyName(token);
        } else {
            return null;
        }
    }

    if (key === null) return null;
    return { modifiers: modifierOrder.filter((m) => modifiers.includes(m)), key };
};

/** Canonical spelling of an accelerator (modifier order, key casing). */
export const normalizeAccelerator = (accelerator: string): string | null => {
    const parsed = parseAccelerator(accelerator);
    return parsed ? [...parsed.modifiers, parsed.key].join("+") : null;
};

/** The modifiers that must be held, once `Mod` is resolved for the platform. */
const resolveModifiers = (modifiers: Modifier[], mac: boolean) => ({
    ctrl: modifiers.includes("Ctrl") || (!mac && modifiers.includes("Mod")),
    meta: modifiers.includes("Meta") || (mac && modifiers.includes("Mod")),
    alt: modifiers.includes("Alt"),
    shift: modifiers.includes("Shift"),
});

/**
 * The key an event stands for. Layouts and modifiers change `event.key` (Option+1 types "¡" on a Mac,
 * Shift+1 types "!"), so for letters and digits typed with Alt or Shift the physical key wins.
 */
export const keyOfEvent = (event: KeyEventLike): string | null => {
    if (modifierKeys.has(event.key)) return null;

    if (event.altKey || event.shiftKey) {
        const physical = /^(?:Key([A-Z])|Digit(\d))$/.exec(event.code);
        if (physical) return physical[1] ?? physical[2];
    }

    return normalizeKeyName(event.key);
};

/** Whether the event is exactly this accelerator (no extra modifiers held). */
export const matchesAccelerator = (event: KeyEventLike, accelerator: string, mac: boolean): boolean => {
    const parsed = parseAccelerator(accelerator);
    if (!parsed) return false;

    const wanted = resolveModifiers(parsed.modifiers, mac);
    return (
        event.ctrlKey === wanted.ctrl &&
        event.metaKey === wanted.meta &&
        event.altKey === wanted.alt &&
        event.shiftKey === wanted.shift &&
        keyOfEvent(event) === parsed.key
    );
};

/** Turns a key press into a portable accelerator, for the "record a shortcut" flow. Null for a lone modifier. */
export const acceleratorFromEvent = (event: KeyEventLike, mac: boolean): string | null => {
    const key = keyOfEvent(event);
    if (key === null) return null;

    const modifiers: Modifier[] = [];
    if (mac) {
        if (event.metaKey) modifiers.push("Mod");
        if (event.ctrlKey) modifiers.push("Ctrl");
    } else {
        if (event.ctrlKey) modifiers.push("Mod");
        if (event.metaKey) modifiers.push("Meta");
    }
    if (event.altKey) modifiers.push("Alt");
    if (event.shiftKey) modifiers.push("Shift");

    return [...modifierOrder.filter((m) => modifiers.includes(m)), key].join("+");
};

/** Whether firing this shortcut could clash with typing: it has no Ctrl/Cmd/Alt and is not a function key. */
export const isRiskyWithoutModifier = (accelerator: string, mac: boolean): boolean => {
    const parsed = parseAccelerator(accelerator);
    if (!parsed) return false;

    const held = resolveModifiers(parsed.modifiers, mac);
    return !(held.ctrl || held.meta || held.alt) && !/^F\d{1,2}$/.test(parsed.key);
};

const macSymbols: Record<Modifier, string> = { Mod: "⌘", Meta: "⌘", Ctrl: "⌃", Alt: "⌥", Shift: "⇧" };
// Mac order is Control, Option, Shift, Command.
const macOrder: Modifier[] = ["Ctrl", "Alt", "Shift", "Mod", "Meta"];

const keyLabels = (mac: boolean): Record<string, string> => ({
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
    Escape: "Esc",
    Enter: mac ? "↵" : "Enter",
    Backspace: mac ? "⌫" : "Backspace",
    Delete: mac ? "⌦" : "Del",
    Tab: mac ? "⇥" : "Tab",
    Space: "Space",
});

/** The pieces of an accelerator as shown to the user: ["Ctrl", "Shift", "S"] or ["⇧", "⌘", "S"]. */
export const formatAcceleratorParts = (accelerator: string, mac: boolean): string[] => {
    const parsed = parseAccelerator(accelerator);
    if (!parsed) return [];

    const key = keyLabels(mac)[parsed.key] ?? parsed.key;

    if (mac) {
        const ordered = macOrder.filter((m) => parsed.modifiers.includes(m));
        return [...ordered.map((m) => macSymbols[m]), key];
    }

    const names = parsed.modifiers.map((m) => (m === "Mod" ? "Ctrl" : m));
    return [...names, key];
};

/** One-line form for menus: "⌘S" on macOS, "Ctrl+S" elsewhere. */
export const formatAccelerator = (accelerator: string, mac: boolean): string =>
    formatAcceleratorParts(accelerator, mac).join(mac ? "" : "+");
