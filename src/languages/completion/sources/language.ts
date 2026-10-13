import { chordAtoms, chordBuiltins, chordControlFlow, chordKeywords } from "../../chord-language";
import type { AdditiveSource, Suggestion } from "../types";

/** The language itself: core classes, fixed texts, keywords and decorators, from the compiler when it is there. */
export const languageSource: AdditiveSource = {
    kind: "additive",
    name: "language",
    run: ({ corelib }) => {
        const out: Suggestion[] = [];

        if (!corelib) {
            // Without the compiler's vocabulary, what the IDE knows by itself.
            for (const word of [...chordKeywords, ...chordControlFlow, ...chordAtoms, "@asincrono"]) {
                out.push({ label: word, type: "keyword", boost: 0 });
            }
            for (const word of chordBuiltins) out.push({ label: word, type: "function", boost: 0 });
            return out;
        }

        for (const c of corelib.classes) {
            const usable = c.instantiable || c.injected || c.methods.some((m) => m.static) || c.properties.some((p) => p.static);
            if (usable && (!c.receiver || c.injected)) out.push({ label: c.name, type: "class", detail: "clase", boost: 3 });
        }
        for (const l of corelib.literals) out.push({ label: l.name, type: "constant", detail: "texto fijo", boost: 2 });
        for (const k of corelib.keywords) out.push({ label: k, type: "keyword", boost: 0 });
        for (const d of corelib.decorators) out.push({ label: d, type: "keyword", detail: "decorador", boost: 0 });

        return out;
    },
};
