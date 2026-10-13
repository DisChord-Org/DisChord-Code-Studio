import { RangeSetBuilder, StateField, type EditorState, type Extension } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, type DecorationSet } from "@codemirror/view";
import { forEachDiagnostic, setDiagnosticsEffect, type Diagnostic } from "@codemirror/lint";

type Severity = Diagnostic["severity"];

const rank: Record<Severity, number> = { error: 3, warning: 2, info: 1, hint: 0 };

/** The message written after the code of a line, in the colour of its severity (like VS Code's Error Lens). */
class LensWidget extends WidgetType {
    constructor(readonly message: string, readonly severity: Severity, readonly extra: number) {
        super();
    }

    eq(other: LensWidget) {
        return other.message === this.message && other.severity === this.severity && other.extra === this.extra;
    }

    toDOM() {
        const element = document.createElement("span");
        element.className = `cm-errorlens cm-errorlens-${this.severity}`;
        element.textContent = this.extra > 0 ? `${this.message} (+${this.extra})` : this.message;
        element.setAttribute("aria-hidden", "true");
        return element;
    }

    ignoreEvent() {
        return true;
    }
}

const build = (state: EditorState): DecorationSet => {
    const byLine = new Map<number, { diagnostic: Diagnostic; count: number }>();

    forEachDiagnostic(state, (diagnostic, from) => {
        const line = state.doc.lineAt(Math.min(from, state.doc.length)).number;
        const current = byLine.get(line);

        if (!current) byLine.set(line, { diagnostic, count: 1 });
        else {
            current.count++;
            if (rank[diagnostic.severity] > rank[current.diagnostic.severity]) current.diagnostic = diagnostic;
        }
    });

    const builder = new RangeSetBuilder<Decoration>();
    for (const number of Array.from(byLine.keys()).sort((a, b) => a - b)) {
        const { diagnostic, count } = byLine.get(number)!;
        const line = state.doc.line(number);
        const message = diagnostic.message.replace(/\s+/g, " ").trim();

        builder.add(line.from, line.from, Decoration.line({ class: `cm-errorlens-line cm-errorlens-line-${diagnostic.severity}` }));
        builder.add(line.to, line.to, Decoration.widget({ widget: new LensWidget(message, diagnostic.severity, count - 1), side: 1 }));
    }

    return builder.finish();
};

const lensField = StateField.define<DecorationSet>({
    create: () => Decoration.none,
    update(value, transaction) {
        const diagnosticsChanged = transaction.effects.some((effect) => effect.is(setDiagnosticsEffect));
        return diagnosticsChanged || transaction.docChanged ? build(transaction.state) : value;
    },
    provide: (field) => EditorView.decorations.from(field),
});

const lensTheme = EditorView.baseTheme({
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

/** Shows the compiler's message at the end of each line that has a problem. Needs the `linter` extension. */
export const errorLens = (): Extension => [lensField, lensTheme];
