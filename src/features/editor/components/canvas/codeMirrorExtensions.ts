import { EditorView } from "codemirror";
import { EditorState, Compartment, StateEffect, StateField } from "@codemirror/state";
import { Decoration } from "@codemirror/view";
import { autocompletion } from "@codemirror/autocomplete";
import { indentUnit } from "@codemirror/language";
import { chordCompletionSource } from "../../../../languages/chord-completions";
import { chord } from "../../../../languages/chord-language";
import { loadedLanguageFor } from "../../../../languages/language-for-file";
import { copyFlashClass } from "./CodeCanvas.constants";

// Compartments are shared by every editor instance; each view keeps its own configuration for them.
export const languageConf = new Compartment();
export const wrapConf = new Compartment();
export const indentConf = new Compartment();
export const diagnosticsConf = new Compartment();

export const indentExtension = (size: number, useTabs: boolean) => [
    EditorState.tabSize.of(size),
    indentUnit.of(useTabs ? "\t" : " ".repeat(size)),
];

export const isChordFile = (fileName: string) => fileName.toLowerCase().endsWith(".chord");

/** Chord has its own synchronous grammar; other languages load lazily and may not be ready yet. */
export const languageExtensionFor = (fileName: string) =>
    isChordFile(fileName) ? chord() : (loadedLanguageFor(fileName) ?? []);

export const completionExtensionFor = (fileName: string) =>
    isChordFile(fileName) ? autocompletion({ override: [chordCompletionSource] }) : autocompletion();

interface FlashRange {
    from: number;
    to: number;
}

export const addFlash = StateEffect.define<FlashRange>();
export const clearFlash = StateEffect.define<null>();

/** Briefly highlights what was just copied. */
export const flashField = StateField.define({
    create() { return Decoration.none; },
    update(decorations, transaction) {
        let current = decorations.map(transaction.changes);
        for (const effect of transaction.effects) {
            if (effect.is(addFlash)) {
                current = current.update({
                    add: [Decoration.mark({ attributes: { class: copyFlashClass } }).range(effect.value.from, effect.value.to)],
                });
            }
            if (effect.is(clearFlash)) return Decoration.none;
        }
        return current;
    },
    provide: (field) => EditorView.decorations.from(field),
});
