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
        scrollbarWidth: "none",
        msOverflowStyle: "none"
    },
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
    ".cm-activeLine": {
        backgroundColor: "color-mix(in srgb, var(--color-border), transparent 80%)"
    },
    ".cm-activeLineGutter": {
        backgroundColor: "var(--color-border)",
        color: "var(--color-accent)"
    },
    ".cm-scroller::-webkit-scrollbar": {
        display: "none"
    }
}, { dark: true });
