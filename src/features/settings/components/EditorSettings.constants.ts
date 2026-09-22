export const fontOptions: { value: string; label: string; description: string; installedDescription?: string }[] = [
    { value: "Monocraft", label: "Monocraft", description: "Tipografía pixelada inspirada en Minecraft. Va incluida en la app." },
    {
        value: "JetBrains Mono",
        label: "JetBrains Mono",
        description: "Se puede descargar desde la app si no la tienes instalada.",
        installedDescription: "Tipografía monoespaciada de JetBrains, diseñada para mejorar la legibilidad del código.",
    },
    {
        value: "Fira Code",
        label: "Fira Code",
        description: "Se puede descargar desde la app si no la tienes instalada.",
        installedDescription: "Tipografía monoespaciada con ligaduras para operadores y símbolos habituales en código.",
    },
    {
        value: "Cascadia Code",
        label: "Cascadia Code",
        description: "Se puede descargar desde la app si no la tienes instalada.",
        installedDescription: "Tipografía monoespaciada de Microsoft, la misma que usan Windows Terminal y VS Code por defecto.",
    },
    {
        value: "ui-monospace",
        label: "Monoespaciada del sistema",
        description: "Usa la fuente monoespaciada por defecto de tu sistema operativo." },
];
