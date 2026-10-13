import { collectSymbols } from "../../chord-symbols";
import type { ExclusiveSource, Suggestion } from "../types";

/** After `tipo` or `->` (and after the `|` of a union): the types the language has and the classes of the file. */
const afterTypeKeyword = /(\btipo|->)\s*([\w[\]]+\s*\|\s*)*$/;

export const typesSource: ExclusiveSource = {
    kind: "exclusive",
    name: "types",
    run: ({ text, lineBefore, from, pos, corelib }) => {
        if (!afterTypeKeyword.test(lineBefore)) return null;

        const options: Suggestion[] = [];

        if (corelib) {
            for (const t of corelib.types) options.push({ label: t.name, type: "type", detail: "tipo", boost: 6 });
            for (const c of corelib.classes.filter((c) => c.instantiable)) {
                options.push({ label: c.name, type: "class", detail: "clase", boost: 5 });
            }
        }
        for (const s of collectSymbols(text, { from, to: pos }).filter((s) => s.kind === "class")) {
            options.push({ label: s.name, type: "class", detail: "clase", boost: 7 });
        }

        return { from, options };
    },
};
