import { collectSymbols, type ChordSymbol } from "../../chord-symbols";
import { kindInfo } from "./names.constants";
import type { AdditiveSource, Suggestion } from "../types";

const libraryBoostPenalty = 3;

export const symbolSuggestions = (symbols: ChordSymbol[]): Suggestion[] =>
    symbols.map((s) => {
        const info = kindInfo[s.kind];
        return {
            label: s.name,
            type: info.type,
            detail: s.from ? `lib:${s.from}` : info.detail,
            boost: s.from ? info.boost - libraryBoostPenalty : info.boost,
        };
    });

/** The names the code defines and what the project's installed libraries export. */
export const namesSource: AdditiveSource = {
    kind: "additive",
    name: "names",
    run: ({ text, from, pos, libraryExports }) =>
        symbolSuggestions([...collectSymbols(text, { from, to: pos }), ...libraryExports]),
};
