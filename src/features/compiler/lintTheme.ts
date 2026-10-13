import { EditorView } from "@codemirror/view";

const colors = {
    error: "#f87171",
    warning: "#fbbf24",
    info: "#60a5fa",
    hint: "#9ca3af",
};

const wave = (color: string) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="6" height="3"><path d="M0 2.5 Q1.5 0 3 1.5 T6 1.5" fill="none" stroke="${color}" stroke-width="1"/></svg>`;
    return `url('data:image/svg+xml,${encodeURIComponent(svg)}')`;
};

export const lintTheme = EditorView.theme({
    // Margin: a thin coloured bar instead of an icon.
    ".cm-gutter-lint": {
        width: "8px",
        "& .cm-gutterElement": {
            padding: "0",
            display: "flex",
            justifyContent: "center",
        },
    },
    ".cm-lint-marker": {
        content: "none !important",
        width: "3px",
        height: "100%",
        minHeight: "1em",
        borderRadius: "2px",
    },
    ".cm-lint-marker-error": { backgroundColor: colors.error },
    ".cm-lint-marker-warning": { backgroundColor: colors.warning },
    ".cm-lint-marker-info": { backgroundColor: colors.info },
    ".cm-lint-marker-hint": { backgroundColor: colors.hint },

    // Underlines.
    ".cm-lintRange": { paddingBottom: "1px", backgroundPosition: "left bottom" },
    ".cm-lintRange-error": { backgroundImage: wave(colors.error) },
    ".cm-lintRange-warning": { backgroundImage: wave(colors.warning) },
    ".cm-lintRange-info": { backgroundImage: wave(colors.info) },
    ".cm-lintRange-hint": { backgroundImage: wave(colors.hint) },
    ".cm-lintRange-active": { backgroundColor: "rgba(255, 255, 255, 0.07)" },

    // The card that opens when hovering a problem.
    // The hover container wraps the lint section, so it is picked by what it holds.
    ".cm-tooltip:has(> .cm-tooltip-lint)": {
        backgroundColor: "#12151c !important",
        border: "1px solid rgba(255, 255, 255, 0.08) !important",
        borderRadius: "10px",
        boxShadow: "0 10px 30px -8px rgba(0, 0, 0, 0.65)",
        overflow: "hidden",
        maxWidth: "440px",
    },
    ".cm-diagnostic": {
        display: "flex",
        flexWrap: "wrap",
        alignItems: "baseline",
        gap: "2px 9px",
        margin: "0",
        padding: "9px 13px",
        border: "none",
        fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
        fontSize: "12px",
        lineHeight: "1.5",
        color: "#e5e7eb",
        "&:not(:first-child)": { borderTop: "1px solid rgba(255, 255, 255, 0.06)" },
        "&::before": {
            content: '""',
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            flex: "none",
            transform: "translateY(-1px)",
        },
    },
    ".cm-diagnostic-error": { borderLeft: "none", "&::before": { backgroundColor: colors.error } },
    ".cm-diagnostic-warning": { borderLeft: "none", "&::before": { backgroundColor: colors.warning } },
    ".cm-diagnostic-info": { borderLeft: "none", "&::before": { backgroundColor: colors.info } },
    ".cm-diagnostic-hint": { borderLeft: "none", "&::before": { backgroundColor: colors.hint } },
    ".cm-diagnosticText": { flex: "1 1 0", minWidth: "0", whiteSpace: "pre-wrap", overflowWrap: "anywhere" },
    ".cm-diagnosticSource": {
        flexBasis: "100%",
        paddingLeft: "15px",
        fontSize: "10px",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: "#6b7280",
        opacity: "1",
    },
}, { dark: true });
