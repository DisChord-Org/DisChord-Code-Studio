import { collectSymbols, type ChordSymbol, type SymbolKind } from "../../chord-symbols";
import type { AdditiveSource, Suggestion } from "../types";

const kindInfo: Record<SymbolKind, { type: string; detail: string; boost: number }> = {
    variable: { type: "variable", detail: "variable", boost: 10 },
    function: { type: "function", detail: "función", boost: 10 },
    class: { type: "class", detail: "clase", boost: 10 },
    property: { type: "property", detail: "propiedad", boost: 8 },
    parameter: { type: "variable", detail: "parámetro", boost: 9 },
    import: { type: "variable", detail: "importado", boost: 10 },
    module: { type: "namespace", detail: "módulo", boost: 10 },
    command: { type: "function", detail: "comando", boost: 6 },
    event: { type: "function", detail: "evento", boost: 6 },
    used: { type: "text", detail: "usado", boost: -5 },
};

export const symbolSuggestions = (symbols: ChordSymbol[]): Suggestion[] =>
    symbols.map((s) => {
        const info = kindInfo[s.kind];
        return {
            label: s.name,
            type: info.type,
            detail: s.from ? `lib:${s.from}` : info.detail,
            boost: s.from ? info.boost - 3 : info.boost,
        };
    });

/** The names the code defines and what the project's installed libraries export. */
export const namesSource: AdditiveSource = {
    kind: "additive",
    name: "names",
    run: ({ text, from, pos, libraryExports }) =>
        symbolSuggestions([...collectSymbols(text, { from, to: pos }), ...libraryExports]),
};
