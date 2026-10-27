import type { Extension } from "@codemirror/state";
import { EditorView, ViewPlugin } from "@codemirror/view";

const inPanel = ".cm-panel.cm-search";
const iconButton = {
    width: "22px",
    height: "22px",
    padding: "0",
    flex: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
    background: "transparent",
    border: "none",
    borderRadius: "5px",
    color: "#9ca3af",
};

/** Restyles CodeMirror's Ctrl+F panel as a compact floating card, laid out like VS Code's. */
const theme = EditorView.theme({
    ".cm-panels": {
        position: "absolute",
        top: "8px",
        right: "20px",
        left: "auto",
        bottom: "auto",
        width: "min(420px, calc(100% - 40px))",
        height: "auto",
        background: "transparent !important",
        border: "none !important",
        boxShadow: "none",
        pointerEvents: "none",
        zIndex: "30",
    },
    [inPanel]: {
        position: "relative",
        pointerEvents: "auto",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        padding: "8px 31px 8px 8px",
        background: "var(--color-panel)",
        border: "1px solid var(--color-border-strong)",
        borderRadius: "10px",
        boxShadow: "0 10px 30px -8px rgba(0,0,0,0.6)",
        color: "#d1d5db",
        fontSize: "12px",
    },
    [`${inPanel} br, ${inPanel} button[name=select]`]: { display: "none" },

    [`${inPanel} .cm-row`]: { display: "flex", alignItems: "center", gap: "6px" },
    [`${inPanel} .cm-replace-row`]: { paddingLeft: "28px" },
    [`${inPanel}:not(.cm-replace-open) .cm-replace-row`]: { display: "none" },
    [`${inPanel} .cm-replace-row::after`]: { content: '""', width: "46px", flex: "none" },

    [`${inPanel} .cm-field`]: {
        position: "relative",
        flex: "1 1 auto",
        minWidth: "0",
        display: "flex",
        alignItems: "center",
    },
    [`${inPanel} .cm-field input.cm-textfield`]: {
        flex: "1",
        minWidth: "0",
        width: "100%",
        margin: "0",
        padding: "5px 8px",
        background: "var(--color-app-bg)",
        border: "1px solid var(--color-border-strong)",
        borderRadius: "6px",
        color: "#fff",
        outline: "none",
        fontSize: "12px",
        transition: "border-color 0.15s",
    },
    [`${inPanel} .cm-field-find input.cm-textfield`]: { paddingRight: "82px" },
    [`${inPanel} .cm-field-replace input.cm-textfield`]: { paddingRight: "54px" },
    [`${inPanel} .cm-field input.cm-textfield:focus`]: { borderColor: "var(--color-accent)" },
    [`${inPanel} input.cm-textfield::placeholder`]: { color: "#6b7280" },
    [`${inPanel} .cm-field-nav`]: { display: "flex", alignItems: "center", gap: "2px", flex: "none" },
    [`${inPanel} .cm-field-actions`]: {
        position: "absolute",
        right: "4px",
        display: "flex",
        alignItems: "center",
        gap: "2px",
    },

    [`${inPanel} button`]: {
        margin: "0",
        backgroundImage: "none",
        cursor: "pointer",
        transition: "background 0.15s, color 0.15s",
    },
    [`${inPanel} .cm-icon-button`]: iconButton,
    [`${inPanel} .cm-icon-button:hover`]: { background: "rgba(255,255,255,0.12)", color: "#fff" },
    [`${inPanel} .cm-icon-button:active`]: { background: "var(--color-accent)", color: "#fff" },
    [`${inPanel} .cm-replace-toggle`]: { ...iconButton, width: "22px", transition: "transform 0.15s, background 0.15s, color 0.15s" },
    [`${inPanel}.cm-replace-open .cm-replace-toggle`]: { transform: "rotate(90deg)" },
    [`${inPanel} button[name=close]`]: { position: "absolute", top: "11px", right: "7px", fontSize: "11px", lineHeight: "1" },
    [`${inPanel} button[name=close] i`]: { display: "block", lineHeight: "1" },

    [`${inPanel} label`]: {
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "22px",
        height: "22px",
        borderRadius: "5px",
        fontSize: "0",
        color: "#9ca3af",
        cursor: "pointer",
        userSelect: "none",
    },
    [`${inPanel} label::after`]: { fontSize: "11px", fontWeight: "600", fontFamily: "monospace" },
    [`${inPanel} label:has(input[name=case])::after`]: { content: '"Aa"' },
    [`${inPanel} label:has(input[name=word])::after`]: { content: '"ab"', textDecoration: "underline" },
    [`${inPanel} label:has(input[name=re])::after`]: { content: '".*"' },
    [`${inPanel} label:hover`]: { color: "#fff", background: "rgba(255,255,255,0.1)" },
    [`${inPanel} label:has(input:checked)`]: {
        color: "#fff",
        background: "color-mix(in srgb, var(--color-accent), transparent 65%)",
        outline: "1px solid color-mix(in srgb, var(--color-accent), transparent 30%)",
    },
    [`${inPanel} label input[type=checkbox]`]: { position: "absolute", opacity: "0", inset: "0", margin: "0", cursor: "pointer" },

    ".cm-searchMatch": {
        backgroundColor: "color-mix(in srgb, var(--color-accent), transparent 70%)",
        outline: "1px solid color-mix(in srgb, var(--color-accent), transparent 40%)",
        borderRadius: "2px",
    },
    ".cm-searchMatch.cm-searchMatch-selected": {
        backgroundColor: "color-mix(in srgb, var(--color-accent), transparent 35%)",
    },
});

const toggleLabel = "Mostrar u ocultar reemplazar";

const div = (className: string, ...children: Element[]) => {
    const element = document.createElement("div");
    element.className = className;
    element.append(...children);
    return element;
};

const icon = (name: string) => {
    const element = document.createElement("i");
    element.className = `bi bi-${name}`;
    element.setAttribute("aria-hidden", "true");
    return element;
};

/** Swaps a button's text for a Bootstrap icon, keeping its own title and name. */
const iconize = (button: HTMLButtonElement, name: string) => {
    const text = button.textContent?.trim() || button.name;
    button.setAttribute("aria-label", text);
    button.title = text;
    button.replaceChildren(icon(name));
    button.classList.add("cm-icon-button");
    return button;
};

/**
 * CodeMirror's panel is a flat list of controls. This regroups it, once per panel, into a find row (chevron, field with
 * its option toggles inside, arrows) and a replace row hidden until the chevron is clicked.
 */
const arrangePanel = (panel: HTMLElement) => {
    if (panel.dataset.arranged) return;

    const get = <T extends HTMLElement>(selector: string) => panel.querySelector<T>(selector);
    const search = get<HTMLInputElement>("input[name=search]");
    const replace = get<HTMLInputElement>("input[name=replace]");
    const next = get<HTMLButtonElement>("button[name=next]");
    const prev = get<HTMLButtonElement>("button[name=prev]");
    const replaceOne = get<HTMLButtonElement>("button[name=replace]");
    const replaceAll = get<HTMLButtonElement>("button[name=replaceAll]");
    const close = get<HTMLButtonElement>("button[name=close]");
    const options = Array.from(panel.querySelectorAll<HTMLLabelElement>("label"));
    if (!search || !replace || !next || !prev || !replaceOne || !replaceAll) return;
    panel.dataset.arranged = "true";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "cm-replace-toggle";
    toggle.title = toggleLabel;
    toggle.setAttribute("aria-label", toggleLabel);
    toggle.setAttribute("aria-expanded", "false");
    toggle.append(icon("chevron-right"));
    toggle.addEventListener("click", () => {
        const open = panel.classList.toggle("cm-replace-open");
        toggle.setAttribute("aria-expanded", String(open));
        if (open) replace.focus();
    });

    const findRow = div("cm-row",
        toggle,
        div("cm-field cm-field-find", search, div("cm-field-actions", ...options)),
        div("cm-field-nav", iconize(prev, "arrow-up"), iconize(next, "arrow-down")),
    );
    const replaceRow = div("cm-row cm-replace-row",
        div("cm-field cm-field-replace", replace, div("cm-field-actions", iconize(replaceOne, "check2"), iconize(replaceAll, "check2-all"))),
    );

    panel.prepend(findRow, replaceRow);
    if (close) {
        panel.append(iconize(close, "x-lg"));
        close.setAttribute("aria-label", "Cerrar búsqueda");
        close.title = "Cerrar búsqueda";
    }
};

/** Regroups every search panel as it appears; panels are rebuilt each time Ctrl+F opens one. */
const arrangePanels = ViewPlugin.fromClass(class {
    observer: MutationObserver;

    constructor(view: EditorView) {
        this.observer = new MutationObserver(() => this.arrange(view));
        this.observer.observe(view.dom, { childList: true, subtree: true });
        this.arrange(view);
    }

    arrange(view: EditorView) {
        view.dom.querySelectorAll<HTMLElement>(inPanel).forEach(arrangePanel);
    }

    destroy() {
        this.observer.disconnect();
    }
});

export const searchTheme: Extension = [theme, arrangePanels];
