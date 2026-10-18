import { EditorView } from "@codemirror/view";

export const dischordEditorTheme = EditorView.theme({
    "&": {
        height: "100%",
        backgroundColor: "var(--color-app-bg) !important"
    },
    ".cm-scroller": {
        overflow: "auto",
        backgroundColor: "var(--color-app-bg)",
        paddingTop: "10px",
        scrollbarWidth: "auto"
    },
    ".cm-scroller::-webkit-scrollbar": { width: "4px", height: "4px", background: "transparent" },
    ".cm-scroller::-webkit-scrollbar-corner": { background: "transparent" },
    ".cm-scroller::-webkit-scrollbar-thumb": { background: "#1e1f22", borderRadius: "10px" },
    ".cm-scroller::-webkit-scrollbar-thumb:hover, .cm-scroller::-webkit-scrollbar-thumb:active": { background: "#5865F2" },
    ".cm-content": {
        fontFamily: "var(--editor-font-family, 'Monocraft', monospace)",
        fontSize: "var(--editor-font-size, 14px)",
        lineHeight: "calc(var(--editor-font-size, 14px) * 1.35)",
        paddingTop: "0px"
    },
    ".cm-gutters": {
        backgroundColor: "var(--color-app-bg) !important",
        borderRight: "1px solid var(--color-border)",
        color: "#4b5563",
        fontFamily: "var(--editor-font-family, 'Monocraft', monospace)",
        fontSize: "var(--editor-font-size, 14px)",
        lineHeight: "calc(var(--editor-font-size, 14px) * 1.35)",
        paddingTop: "0px",
        minWidth: "40px"
    },
    ".cm-lineNumbers .cm-gutterElement": {
        minWidth: "calc(3ch + 8px)"
    },
    ".cm-activeLine": {
        backgroundColor: "color-mix(in srgb, var(--color-border), transparent 80%)"
    },
    ".cm-activeLineGutter": {
        backgroundColor: "var(--color-border)",
        color: "var(--color-accent)"
    }
}, { dark: true });
