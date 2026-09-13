import { EditorView } from "@codemirror/view";

export const dischordEditorTheme = EditorView.theme({
    "&": {
        height: "100%",
        backgroundColor: "#0B0E14 !important"
    },
    ".cm-scroller": {
        overflow: "auto",
        backgroundColor: "#0B0E14",
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
        backgroundColor: "#0B0E14 !important",
        borderRight: "1px solid #1e1f22",
        color: "#4b5563",
        fontFamily: "var(--editor-font-family, 'Monocraft', monospace)",
        fontSize: "var(--editor-font-size, 14px)",
        lineHeight: "calc(var(--editor-font-size, 14px) * 1.35)",
        paddingTop: "0px",
        minWidth: "40px"
    },
    ".cm-activeLine": {
        backgroundColor: "#1e1f2233"
    },
    ".cm-activeLineGutter": {
        backgroundColor: "#1e1f22",
        color: "#5865f2"
    },
    ".cm-scroller::-webkit-scrollbar": {
        display: "none"
    }
}, { dark: true });
