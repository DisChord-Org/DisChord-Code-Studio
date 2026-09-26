export type ShortcutGroup = "file" | "run" | "tabs" | "editor" | "explorer" | "terminal" | "help";

/**
 * Where a shortcut is listened to. "app" ones are caught on the whole window; the others are read by the
 * widget that owns them (the explorer, the terminal) and only work while it has the focus.
 */
export type ShortcutScope = "app" | "explorer" | "terminal";

export interface ShortcutDefinition {
    /** Stable id, also the key under which a user override is stored. Never rename one. */
    id: string;
    label: string;
    description?: string;
    group: ShortcutGroup;
    scope: ShortcutScope;
    /** Accelerator ("Mod+S"), or one per platform when the conventions differ. */
    defaultAccelerator: string | { mac: string; other: string };
    /** "app" shortcuts are ignored while the interactive terminal has the focus, unless this is set. */
    allowInTerminal?: boolean;
    /** Only does something with "advanced mode" on; shown as such. */
    advancedOnly?: boolean;
}

/** A shortcut that belongs to a component we do not control (CodeMirror): listed, not configurable. */
export interface FixedShortcut {
    label: string;
    group: ShortcutGroup;
    accelerator: string;
}

/** What is saved in config.json: only what differs from the default. An empty string means "unassigned". */
export type KeybindingOverrides = Record<string, string>;
