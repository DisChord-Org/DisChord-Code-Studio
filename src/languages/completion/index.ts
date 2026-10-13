import type { CorelibData } from "../chord-corelib";
import type { ChordSymbol } from "../chord-symbols";
import { buildRequest } from "./request";
import { blockFieldsSource, statementsSource } from "./sources/blocks";
import { eventNamesSource, scopeSource } from "./sources/events";
import { fieldValuesSource } from "./sources/fieldValues";
import { languageSource } from "./sources/language";
import { membersSource } from "./sources/members";
import { namesSource } from "./sources/names";
import { typesSource } from "./sources/types";
import type { AdditiveSource, ExclusiveSource, Suggestion, Suggestions } from "./types";

export type { Suggestion, Suggestions } from "./types";

/** Tried in order; the first one whose context the cursor is in gives the whole answer. */
const exclusiveSources: ExclusiveSource[] = [fieldValuesSource, membersSource, typesSource, eventNamesSource];

/** Everything else adds to the general list. To offer something new, add a source here. */
const additiveSources: AdditiveSource[] = [blockFieldsSource, statementsSource, scopeSource, namesSource, languageSource];

/**
 * Everything the autocompletion offers at `pos`. `libraryExports` are the names the project's libraries export.
 * `explicit` is true when the user asked for it (Ctrl+Space) rather than typing.
 */
export const computeSuggestions = (
    text: string,
    pos: number,
    explicit: boolean,
    corelib: CorelibData | null,
    libraryExports: ChordSymbol[],
): Suggestions | null => {
    const request = buildRequest(text, pos, explicit, corelib, libraryExports);
    if (!request) return null;

    for (const source of exclusiveSources) {
        const answer = source.run(request);
        if (answer) return answer;
    }

    // Inside a string nothing but a field's values makes sense.
    if (request.where.inString !== null) return null;

    // The same word can come from several places; the highest-ranked one wins.
    const best = new Map<string, Suggestion>();
    for (const source of additiveSources) {
        for (const option of source.run(request)) {
            const previous = best.get(option.label);
            if (!previous || (option.boost ?? 0) > (previous.boost ?? 0)) best.set(option.label, option);
        }
    }

    return { from: request.from, options: Array.from(best.values()) };
};
