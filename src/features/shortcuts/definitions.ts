import type { FixedShortcut, ShortcutDefinition, ShortcutGroup } from "./types";

export const groupLabels: Record<ShortcutGroup, string> = {
    file: "Archivo",
    run: "Ejecución",
    tabs: "Pestañas",
    editor: "Editor",
    explorer: "Explorador",
    terminal: "Terminal",
    help: "Ayuda",
};

export const groupOrder: ShortcutGroup[] = ["file", "run", "tabs", "editor", "explorer", "terminal", "help"];

export const gotoTabId = (position: number) => `tab.goto.${position}`;

const gotoTabDefinitions: ShortcutDefinition[] = Array.from({ length: 9 }, (_, i) => ({
    id: gotoTabId(i + 1),
    label: `Ir a la pestaña ${i + 1}`,
    group: "tabs",
    scope: "app",
    defaultAccelerator: `Alt+${i + 1}`,
}));

export const shortcutDefinitions: ShortcutDefinition[] = [
    {
        id: "file.save",
        label: "Guardar",
        group: "file",
        scope: "app",
        defaultAccelerator: "Mod+S",
    },
    {
        id: "file.quickOpen",
        label: "Abrir archivo…",
        description: "Busca un archivo del proyecto por nombre.",
        group: "file",
        scope: "app",
        defaultAccelerator: "Mod+P",
    },
    {
        id: "run.toggle",
        label: "Ejecutar / detener",
        group: "run",
        scope: "app",
        defaultAccelerator: "Mod+R",
    },
    {
        id: "terminal.toggle",
        label: "Mostrar u ocultar la terminal",
        description: "Ctrl en todos los sistemas, para no chocar con los atajos de macOS.",
        group: "run",
        scope: "app",
        defaultAccelerator: "Ctrl+Ñ",
        allowInTerminal: true,
        advancedOnly: true,
    },
    {
        id: "tab.close",
        label: "Cerrar pestaña",
        group: "tabs",
        scope: "app",
        defaultAccelerator: "Mod+W",
    },
    ...gotoTabDefinitions,
    {
        id: "help.shortcuts",
        label: "Atajos de teclado",
        description: "Abre esta lista en una pestaña.",
        group: "help",
        scope: "app",
        defaultAccelerator: "Mod+Shift+P",
    },
    {
        id: "editor.goToDefinition",
        label: "Ir a la definición",
        description: "Con el cursor sobre un nombre. También Ctrl o Cmd + clic.",
        group: "editor",
        scope: "app",
        defaultAccelerator: "F12",
    },
    {
        id: "editor.renameSymbol",
        label: "Renombrar símbolo",
        description: "Cambia el nombre declarado bajo el cursor en todo el archivo.",
        group: "editor",
        scope: "app",
        defaultAccelerator: "Mod+F2",
    },
    {
        id: "editor.toggleWordWrap",
        label: "Ajuste de línea",
        group: "editor",
        scope: "app",
        defaultAccelerator: "Alt+Z",
    },
    {
        id: "explorer.rename",
        label: "Renombrar",
        description: "Con un archivo o carpeta seleccionado en el explorador.",
        group: "explorer",
        scope: "explorer",
        defaultAccelerator: "F2",
    },
    {
        id: "terminal.copy",
        label: "Copiar selección",
        description: "Ctrl+C se queda para interrumpir el proceso.",
        group: "terminal",
        scope: "terminal",
        defaultAccelerator: { mac: "Mod+C", other: "Ctrl+Shift+C" },
    },
    {
        id: "terminal.paste",
        label: "Pegar",
        group: "terminal",
        scope: "terminal",
        defaultAccelerator: { mac: "Mod+V", other: "Ctrl+Shift+V" },
    },
];

export const fixedShortcuts: FixedShortcut[] = [
    {
        label: "Deshacer",
        group: "editor",
        accelerator: "Mod+Z"
    },
    {
        label: "Rehacer",
        group: "editor",
        accelerator: "Mod+Shift+Z"
    },
    {
        label: "Seleccionar todo",
        group: "editor",
        accelerator: "Mod+A"
    },
    {
        label: "Buscar",
        group: "editor",
        accelerator: "Mod+F"
    },
    {
        label: "Comentar línea",
        group: "editor",
        accelerator: "Mod+/"
    },
    {
        label: "Mover línea",
        group: "editor",
        accelerator: "Alt+ArrowUp"
    },
    {
        label: "Copiar línea",
        group: "editor",
        accelerator: "Shift+Alt+ArrowDown"
    },
    {
        label: "Autocompletar",
        group: "editor",
        accelerator: "Ctrl+Space"
    },
    {
        label: "Indentar",
        group: "editor",
        accelerator: "Tab"
    },
];

const byId = new Map(shortcutDefinitions.map((d) => [d.id, d]));

export const getDefinition = (id: string): ShortcutDefinition | undefined => byId.get(id);

export const defaultAcceleratorFor = (definition: ShortcutDefinition, mac: boolean): string =>
    typeof definition.defaultAccelerator === "string"
        ? definition.defaultAccelerator
        : mac ? definition.defaultAccelerator.mac : definition.defaultAccelerator.other;
