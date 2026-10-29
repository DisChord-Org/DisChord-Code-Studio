import { EditorView, WidgetType } from "@codemirror/view";
import { openBlockForm } from "./state";

export class OpenFormLink extends WidgetType {
    constructor(readonly open: number) {
        super();
    }

    eq(other: OpenFormLink) {
        return other.open === this.open;
    }

    ignoreEvent() {
        return true;
    }

    toDOM(view: EditorView) {
        const link = document.createElement("a");
        link.className = "cm-block-form-link";
        link.href = "#";
        link.textContent = "abrir formulario";
        link.setAttribute("role", "button");
        link.addEventListener("mousedown", (event) => event.preventDefault());
        link.addEventListener("click", (event) => {
            event.preventDefault();
            view.dispatch({ effects: openBlockForm.of(this.open) });
        });
        return link;
    }
}
