import { EditorView } from "@codemirror/view";

/** Spanish names shown in the hover card for each kind of declaration. */
export const kindLabels: Record<string, string> = {
    variable: "variable",
    function: "función",
    method: "método",
    constructor: "constructor",
    class: "clase",
    property: "propiedad",
    parameter: "parámetro",
    import: "importado",
    command: "comando",
    event: "evento",
    button: "botón",
    embed: "embed",
};

/** Same card look as the lint tooltip, for the hover of declarations and members. */
export const intelTheme = EditorView.theme({
    ".cm-tooltip:has(> .cm-intel)": {
        backgroundColor: "#12151c !important",
        border: "1px solid rgba(255, 255, 255, 0.08) !important",
        borderRadius: "10px",
        boxShadow: "0 10px 30px -8px rgba(0, 0, 0, 0.65)",
        overflow: "hidden",
        maxWidth: "440px",
    },
    ".cm-intel": {
        padding: "9px 13px",
        fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
        fontSize: "12px",
        lineHeight: "1.5",
        color: "#e5e7eb",
    },
    ".cm-intel-title": {
        fontWeight: "600",
        color: "#f3f4f6"
    },
    ".cm-intel-meta": {
        fontSize: "10px",
        letterSpacing: "0.04em",
        color: "#6b7280",
        marginTop: "1px"
    },
    ".cm-intel-code": {
        marginTop: "6px",
        padding: "4px 8px",
        borderRadius: "5px",
        backgroundColor: "rgba(255, 255, 255, 0.05)",
        fontFamily: "var(--editor-font-family, monospace)",
        fontSize: "11px",
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
    },
    ".cm-intel-doc": {
        marginTop: "6px",
        color: "#9ca3af"
    },
}, { dark: true });
