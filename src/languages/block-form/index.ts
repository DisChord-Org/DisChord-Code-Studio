import { EditorState, StateField, type Extension } from "@codemirror/state";
import { indentUnit } from "@codemirror/language";
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import { getCorelib } from "../chord-corelib";
import { blockFormTheme } from "./theme";
import { dismissBlock, neverShowHandler, openBlockForm } from "./state";
import { findBlock, parseStatements, type BlockLocation, type Statement } from "./parse";
import { OpenFormLink } from "./link";
import { controlSelector } from "./block-form.constants";
import { BlockFormWidget, fieldViews } from "./widget";

interface FormState {
    shown: number | null;
    head: number;
    decorations: DecorationSet;
}

const hiddenRanges = (text: string, statements: Statement[]) =>
    statements
        .filter((s) => s.field)
        .map((s) => {
            const lineStart = text.lastIndexOf("\n", s.from - 1) + 1;
            const lineEnd = text.indexOf("\n", s.end);
            const rest = text.slice(s.end, lineEnd === -1 ? text.length : lineEnd);
            const alone = /^[ \t]*$/.test(text.slice(lineStart, s.from)) && /^\s*$/.test(rest);
            return alone && lineEnd !== -1 ? { from: lineStart, to: lineEnd + 1 } : { from: s.from, to: s.end };
        })
        .filter((r) => r.to > r.from);

const columnsOf = (whitespace: string, tabSize: number) =>
    Array.from(whitespace).reduce((columns, ch) => columns + (ch === "\t" ? tabSize : 1), 0);

const formDecorations = (state: EditorState, text: string, block: BlockLocation): DecorationSet => {
    const statements = parseStatements(text, block);
    const headLine = state.doc.lineAt(block.open);
    const indent = columnsOf(/^[ \t]*/.exec(headLine.text)?.[0] ?? "", state.tabSize) + columnsOf(state.facet(indentUnit), state.tabSize);
    const widget = new BlockFormWidget(block.open, block.definition.name, fieldViews(text, statements, block), indent);
    return Decoration.set([
        Decoration.widget({ widget, block: true, side: 1 }).range(headLine.to),
        ...hiddenRanges(text, statements).map((r) => Decoration.replace({}).range(r.from, r.to)),
    ], true);
};

const linkDecoration = (block: BlockLocation): DecorationSet =>
    Decoration.set(Decoration.widget({ widget: new OpenFormLink(block.open), side: 1 }).range(block.open + 1));

const formField = StateField.define<FormState>({
    create: (state) => ({ shown: null, head: state.selection.main.head, decorations: Decoration.none }),
    update(value, tr) {
        let shown = value.shown === null ? null : tr.changes.mapPos(value.shown, -1);
        let forced = false;
        for (const effect of tr.effects) {
            if (effect.is(dismissBlock)) {
                shown = null;
                forced = true;
            }
            if (effect.is(openBlockForm)) {
                shown = effect.value;
                forced = true;
            }
        }
        if (!tr.docChanged && !tr.selection && !forced) return value;

        const head = tr.state.selection.main.head;
        const corelib = getCorelib();
        const text = corelib ? tr.state.doc.toString() : "";
        const block = findBlock(text, head, corelib);
        if (!block) return { shown: null, head, decorations: Decoration.none };

        if (shown !== block.open) {
            const before = tr.changes.mapPos(value.head, -1);
            shown = before <= block.open ? block.open : null;
        }
        const decorations = shown === block.open ? formDecorations(tr.state, text, block) : linkDecoration(block);
        return { shown, head, decorations };
    },
    provide: (field) => [
        EditorView.decorations.from(field, (value) => value.decorations),
        EditorView.atomicRanges.of((view) => view.state.field(field, false)?.decorations ?? Decoration.none),
    ],
});

const focusOnOpen = ViewPlugin.fromClass(class {
    last: number | null = null;

    update(update: ViewUpdate) {
        const shown = update.state.field(formField, false)?.shown ?? null;
        const opened = shown !== null && shown !== this.last;
        this.last = shown;
        if (!opened) return;

        const fromLink = update.transactions.some((tr) => tr.effects.some((e) => e.is(openBlockForm)));
        const byMouse = update.transactions.some((tr) => tr.isUserEvent("select.pointer"));
        if (!fromLink && (byMouse || !update.view.hasFocus)) return;

        const view = update.view;
        requestAnimationFrame(() => {
            const first = view.dom.querySelector<HTMLElement>(controlSelector);
            first?.focus();
            if (first instanceof HTMLInputElement) first.select();
        });
    }
});

export const blockForm = (onNeverShow: () => void): Extension => [formField, focusOnOpen, blockFormTheme, neverShowHandler.of(onNeverShow)];
