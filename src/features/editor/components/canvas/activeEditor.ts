import type { EditorView } from "codemirror";
import { notify } from "../../../../utils/Toasts";

let active: EditorView | null = null;

export const setActiveEditor = (view: EditorView) => {
    active = view;
};

export const clearActiveEditor = (view: EditorView) => {
    if (active === view) active = null;
};

type ApplyMode = "insert" | "replace";

export const applyCode = (code: string, mode: ApplyMode): boolean => {
    const view = active;
    if (!view) {
        notify("warning", "Abre un archivo en el editor para aplicar el código.");
        return false;
    }

    const { from, to } = view.state.selection.main;
    if (mode === "replace" && from === to) {
        notify("warning", "Selecciona en el editor el texto que quieres reemplazar.");
        return false;
    }

    const at = mode === "insert" ? { from: to, to } : { from, to };
    view.dispatch({
        changes: { ...at, insert: code },
        selection: { anchor: at.from + code.length },
        scrollIntoView: true,
        userEvent: "input.paste",
    });
    view.focus();
    return true;
};
