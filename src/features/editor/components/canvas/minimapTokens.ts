import { chordTheme } from "../../../../languages/chord-theme";
import {
    chordKeywords,
    chordControlFlow,
    chordBuiltins,
    chordAtoms,
} from "../../../../languages/chord-language";
import { genericKeywords, genericLiterals } from "./CodeMinimap.constants";

const keywordSet = new Set(
    [...genericKeywords, ...chordKeywords, ...chordControlFlow].map((w) => w.toLowerCase())
);
const literalSet = new Set(
    [...genericLiterals, ...chordAtoms].map((w) => w.toLowerCase())
);
const builtinSet = new Set(chordBuiltins.map((w) => w.toLowerCase()));

const tokenRe = /(\/\/.*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|([\p{L}_$][\p{L}\p{N}_$]*)|([{}[\]().,;:=+\-*/%<>!&|^~?])|(\s+)/gu;

export interface Token {
    start: number;
    text: string;
    color: string;
    isIdentifier?: boolean;
}

export const tokenizeLine = (line: string): Token[] => {
    const tokens: Token[] = [];
    tokenRe.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = tokenRe.exec(line)) !== null) {
        const [, comment, string, number, identifier, punct, space] = match;
        const start = match.index;

        if (space) continue;
        if (comment) { tokens.push({ start, text: comment, color: chordTheme.comment }); continue; }
        if (string) { tokens.push({ start, text: string, color: chordTheme.string }); continue; }
        if (number) { tokens.push({ start, text: number, color: chordTheme.number }); continue; }
        if (punct) { tokens.push({ start, text: punct, color: chordTheme.punctuation }); continue; }
        if (identifier) {
            const lower = identifier.toLowerCase();
            let color: string = chordTheme.default;
            let isIdentifier = true;
            if (keywordSet.has(lower)) { color = chordTheme.keyword; isIdentifier = false; }
            else if (literalSet.has(lower)) { color = chordTheme.number; isIdentifier = false; }
            else if (builtinSet.has(lower)) { color = chordTheme.function; isIdentifier = false; }
            tokens.push({ start, text: identifier, color, isIdentifier });
        }
    }

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (!token.isIdentifier) continue;
        const next = tokens[i + 1];
        if (next?.text === "(") token.color = chordTheme.function;
        else if (next?.text === ":") token.color = chordTheme.property;
    }

    return tokens;
};
