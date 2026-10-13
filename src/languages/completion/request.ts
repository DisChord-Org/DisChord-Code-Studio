import { enclosingBlocks } from "../chord-context";
import type { CorelibData } from "../chord-corelib";
import { positionKind } from "../chord-lexer";
import type { ChordSymbol } from "../chord-symbols";
import type { Request } from "./types";

const wordBeforeCursor = /[A-Za-z_@À-ɏ][\w@À-ɏ]*$|$/;

/** Contexts where a menu is useful even before a letter is typed. */
const asksWithoutLetters = /(\btipo|->|\bevento)\s+$/;

/** Works out what is around the cursor. Null when no menu should open (a comment, or nothing typed). */
export const buildRequest = (
    text: string,
    pos: number,
    explicit: boolean,
    corelib: CorelibData | null,
    libraryExports: ChordSymbol[],
): Request | null => {
    const where = positionKind(text, pos);
    if (where.inComment) return null;

    const word = wordBeforeCursor.exec(text.slice(0, pos))![0];
    const from = pos - word.length;
    const before = text.slice(0, from);

    // Inside a string the word is not an identifier: the field-values source reads the raw text itself.
    if (where.inString === null && word === "" && !explicit) {
        if (!before.endsWith(".") && !asksWithoutLetters.test(before)) return null;
    }

    const beforeTrim = before.trimEnd();
    const lineStart = text.lastIndexOf("\n", from - 1) + 1;
    const blocks = enclosingBlocks(text, pos, corelib);

    return {
        text,
        pos,
        explicit,
        corelib,
        libraryExports,
        where,
        word,
        from,
        before,
        beforeTrim,
        lineBefore: text.slice(lineStart, from),
        blocks,
        block: blocks[blocks.length - 1],
        startsStatement: text.slice(lineStart, from).trim() === "" || /[;{}]\s*$/.test(beforeTrim),
    };
};
