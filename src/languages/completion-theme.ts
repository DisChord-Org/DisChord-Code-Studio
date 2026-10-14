import { EditorView } from "@codemirror/view";

/** Colour of the small badge of each kind of suggestion. */
const kinds: Record<string, string> = {
    keyword: "#c678dd",
    function: "#61afef",
    method: "#61afef",
    variable: "#56b6c2",
    class: "#e5c07b",
    property: "#98c379",
    namespace: "#e06c75",
    type: "#2dd4bf",
    constant: "#d19a66",
    enum: "#d19a66",
    text: "#7f848e",
};

const badge = Object.fromEntries(
    Object.entries(kinds).flatMap(([kind, color]) => [
        [`.cm-completionIcon-${kind}`, { backgroundColor: `${color}26`, "&::after": { color } }],
    ]),
);

/** The autocompletion list and its documentation panel, in the look of the app's other cards. */
export const completionTheme = EditorView.theme({
    ".cm-tooltip.cm-tooltip-autocomplete": {
        backgroundColor: "#12151c",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: "10px",
        boxShadow: "0 10px 30px -8px rgba(0, 0, 0, 0.65)",
        overflow: "hidden",
        padding: "4px",
        "& > ul": {
            maxHeight: "260px",
            minWidth: "240px",
            fontFamily: "var(--editor-font-family, monospace)",
            fontSize: "12px",
            "& > li": {
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "3px 8px 3px 6px",
                borderRadius: "6px",
                lineHeight: "1.5",
                color: "#c9ced8",
            },
            "& > li[aria-selected]": {
                backgroundColor: "rgba(88, 101, 242, 0.22)",
                color: "#ffffff",
            },
        },
    },

    ".cm-completionIcon": {
        flex: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "18px",
        height: "18px",
        padding: "0",
        borderRadius: "5px",
        fontSize: "11px",
        opacity: "1",
        backgroundColor: "rgba(255, 255, 255, 0.06)",
        "&::after": { width: "auto", color: "#9ca3af", fontWeight: "700", opacity: "1" },
    },
    ...badge,

    ".cm-completionLabel": { flex: "1 1 auto", minWidth: "0", overflow: "hidden", textOverflow: "ellipsis" },
    ".cm-completionMatchedText": { textDecoration: "none", fontWeight: "700", color: "#8992f5" },
    ".cm-completionDetail": {
        flex: "none",
        marginLeft: "12px",
        fontStyle: "normal",
        fontSize: "10.5px",
        color: "#6b7280",
        maxWidth: "190px",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
    },
    "li[aria-selected] .cm-completionDetail": { color: "#a5adff" },

    // The panel with the documentation of the selected suggestion.
    ".cm-tooltip.cm-completionInfo": {
        backgroundColor: "#12151c",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: "10px",
        boxShadow: "0 10px 30px -8px rgba(0, 0, 0, 0.65)",
        padding: "9px 13px",
        maxWidth: "320px",
        fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
        fontSize: "12px",
        lineHeight: "1.5",
        color: "#9ca3af",
    },
}, { dark: true });
