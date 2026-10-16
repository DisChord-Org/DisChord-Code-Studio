import { EditorView } from "@codemirror/view";
import type { Diagnostic } from "@codemirror/lint";

/** When several problems share a line, the most severe one is the one shown. */
export const severityRank: Record<Diagnostic["severity"], number> = { error: 3, warning: 2, info: 1, hint: 0 };

export const lensTheme = EditorView.baseTheme({
    ".cm-errorlens": {
        marginLeft: "2.5ch",
        padding: "0 0.7ch",
        borderRadius: "3px",
        fontSize: "0.9em",
        fontStyle: "normal",
        whiteSpace: "pre",
        userSelect: "none",
        pointerEvents: "none",
    },
    ".cm-errorlens-error": {
        color: "#f87171",
        backgroundColor: "rgba(248, 113, 113, 0.12)"
    },
    ".cm-errorlens-warning": {
        color: "#fbbf24",
        backgroundColor: "rgba(251, 191, 36, 0.12)"
    },
    ".cm-errorlens-info": {
        color: "#60a5fa",
        backgroundColor: "rgba(96, 165, 250, 0.12)"
    },
    ".cm-errorlens-hint": {
        color: "#9ca3af",
        backgroundColor: "rgba(156, 163, 175, 0.1)"
    },
    ".cm-errorlens-line-error": {
        backgroundColor: "rgba(248, 113, 113, 0.07)"
    },
    ".cm-errorlens-line-warning": {
        backgroundColor: "rgba(251, 191, 36, 0.06)"
    },
    ".cm-errorlens-line-info": {
        backgroundColor: "rgba(96, 165, 250, 0.06)"
    },
});
