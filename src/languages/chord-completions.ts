import { snippetCompletion, type Completion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { computeSuggestions, type Suggestion } from "./chord-complete-core";
import { getCorelib } from "./chord-corelib";
import { getLibraryExports } from "./chord-libraries";

const toCompletion = (s: Suggestion): Completion => {
    const base = { label: s.label, type: s.type, detail: s.detail, info: s.info, boost: s.boost };
    return s.template ? snippetCompletion(s.template, base) : base;
};

export const chordCompletionSource = (context: CompletionContext): CompletionResult | null => {
    const text = context.state.doc.toString();
    const result = computeSuggestions(text, context.pos, context.explicit, getCorelib(), getLibraryExports());
    if (!result || result.options.length === 0) return null;

    return {
        from: result.from,
        options: result.options.map(toCompletion),
        validFor: /^[\w@\u00C0-\u024F]*$/,
    };
};
