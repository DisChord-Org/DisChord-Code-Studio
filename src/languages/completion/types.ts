import type { BlockInfo } from "../chord-context";
import type { CorelibData } from "../chord-corelib";
import type { Position } from "../chord-lexer";
import type { ChordSymbol } from "../chord-symbols";

/** A suggestion, independent of CodeMirror so that the logic can be tested on its own. */
export interface Suggestion {
    label: string;
    type: string;
    detail?: string;
    info?: string;
    /** Text to insert when it differs from the label; `${}` marks where the cursor ends up. */
    template?: string;
    boost?: number;
}

export interface Suggestions {
    from: number;
    options: Suggestion[];
}

/** Everything about the cursor position that the sources need, worked out once. */
export interface Request {
    text: string;
    pos: number;
    explicit: boolean;
    corelib: CorelibData | null;
    libraryExports: ChordSymbol[];

    where: Position;
    /** The word being typed, and where it starts. */
    word: string;
    from: number;
    /** Text before the word, and the same without trailing whitespace. */
    before: string;
    beforeTrim: string;
    /** The current line up to the word. */
    lineBefore: string;
    /** Blocks that contain the position, outermost first. */
    blocks: BlockInfo[];
    block: BlockInfo | undefined;
    /** Whether the word is the first thing of a statement (line start, or right after `;`, `{`, `}`). */
    startsStatement: boolean;
}

/**
 * One kind of suggestion. An *exclusive* source answers on its own when the position is its context (after a dot,
 * after `tipo`...); an *additive* one contributes to the general list.
 */
export interface ExclusiveSource {
    kind: "exclusive";
    name: string;
    run: (request: Request) => Suggestions | null;
}

export interface AdditiveSource {
    kind: "additive";
    name: string;
    run: (request: Request) => Suggestion[];
}
