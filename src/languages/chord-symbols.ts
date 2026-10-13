import { chordAtoms, chordBuiltins, chordControlFlow, chordKeywords } from "./chord-language";

export type SymbolKind = "variable" | "function" | "class" | "property" | "parameter" | "import" | "module" | "command" | "event" | "used";

export interface ChordSymbol {
    name: string;
    kind: SymbolKind;
    from?: string;
}

interface Token {
    text: string;
    from: number;
    to: number;
    type: "word" | "punct";
}

const reservedWords = new Set([
    ...chordKeywords, ...chordControlFlow, ...chordBuiltins, ...chordAtoms, "@asincrono",
]);

export const isReserved = (word: string) => reservedWords.has(word);

const declarations: Record<string, SymbolKind> = {
    var: "variable",
    funcion: "function",
    clase: "class",
    prop: "property",
    comando: "command",
    evento: "event",
};
export const tokenize = (text: string): Token[] => {
    const tokens: Token[] = [];
    const length = text.length;
    let i = 0;

    while (i < length) {
        const ch = text[i];

        if (ch === "/" && text[i + 1] === "/") {
            while (i < length && text[i] !== "\n") i++;
        } else if (ch === "/" && text[i + 1] === "*") {
            const end = text.indexOf("*/", i + 2);
            i = end === -1 ? length : end + 2;
        } else if (ch === '"') {
            i++;
            while (i < length && text[i] !== '"') i += text[i] === "\\" ? 2 : 1;
            i++;
        } else if (/[A-Za-z_@À-ɏ]/.test(ch)) {
            const from = i;
            while (i < length && /[\w@À-ɏ]/.test(text[i])) i++;
            tokens.push({ text: text.slice(from, i), from, to: i, type: "word" });
        } else if (/\s/.test(ch) || /[0-9]/.test(ch)) {
            i++;
        } else {
            tokens.push({ text: ch, from: i, to: i + 1, type: "punct" });
            i++;
        }
    }

    return tokens;
};

const isName = (token: Token | undefined): token is Token =>
    !!token && token.type === "word" && !isReserved(token.text);

export const collectSymbols = (text: string, ignore?: { from: number; to: number }): ChordSymbol[] => {
    const tokens = tokenize(text);
    const symbols = new Map<string, ChordSymbol>();
    const declared = new Set<number>();

    const declare = (token: Token, kind: SymbolKind) => {
        declared.add(token.from);
        if (ignore && token.from <= ignore.to && token.to >= ignore.from) return;
        if (!symbols.has(token.text) || symbols.get(token.text)!.kind === "used") {
            symbols.set(token.text, { name: token.text, kind });
        }
    };

    const skipType = (start: number): number => {
        let depth = 0;
        let j = start;
        for (; j < tokens.length; j++) {
            const t = tokens[j];
            if (t.text === "[") depth++;
            else if (t.text === "]") {
                if (depth === 0) break;
                depth--;
            } else if (depth === 0 && (t.text === "," || t.text === ")" || t.text === "{" || t.text === "}" || t.text === ";" || t.text === "es")) break;
            else if (depth === 0 && t.text === "-" && tokens[j + 1]?.text === ">") break;
            else if (depth === 0 && t.type === "word" && j > start && tokens[j - 1].type === "word") break;
            declared.add(t.from);
        }
        return j;
    };

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (token.text === "-" && tokens[i + 1]?.text === ">") {
            i = skipType(i + 2) - 1;
            continue;
        }
        if (token.type !== "word") continue;
        if (token.text === "tipo") {
            i = skipType(i + 1) - 1;
            continue;
        }

        const kind = declarations[token.text];
        if (kind && isName(tokens[i + 1])) {
            const name = tokens[i + 1];
            declare(name, kind);

            if (kind === "function" && tokens[i + 2]?.text === "(") {
                let depth = 0;
                let brackets = 0;
                let expectName = true;
                for (let j = i + 2; j < tokens.length; j++) {
                    const t = tokens[j];
                    if (t.text === "(") depth++;
                    else if (t.text === ")" && --depth === 0) break;
                    else if (t.text === "[") brackets++;
                    else if (t.text === "]") brackets--;
                    else if (t.text === "," && depth === 1 && brackets === 0) expectName = true;
                    else if (expectName && depth === 1 && isName(t)) {
                        declare(t, "parameter");
                        expectName = false;
                    }
                }
            }
        } else if (token.text === "importar") {
            if (tokens[i + 1]?.text === "{") {
                for (let j = i + 2; j < tokens.length && tokens[j].text !== "}"; j++) {
                    if (isName(tokens[j])) declare(tokens[j], "import");
                }
            } else if (isName(tokens[i + 1])) {
                declare(tokens[i + 1], "module");
            }
        }
    }

    tokens.forEach((token, i) => {
        if (token.type !== "word" || declared.has(token.from) || !isName(token)) return;
        if (tokens[i - 1]?.text === ".") return;
        if (ignore && token.from <= ignore.to && token.to >= ignore.from) return;
        if (!symbols.has(token.text)) symbols.set(token.text, { name: token.text, kind: "used" });
    });

    return Array.from(symbols.values());
};

export const collectExports = (text: string, library: string): ChordSymbol[] => {
    const tokens = tokenize(text);
    const known = new Map(collectSymbols(text).map((s) => [s.name, s.kind]));
    const exports = new Map<string, ChordSymbol>();

    tokens.forEach((token, i) => {
        if (token.text !== "exportar") return;

        let next = tokens[i + 1];
        let kind: SymbolKind | undefined;
        if (next && declarations[next.text]) {
            kind = declarations[next.text];
            next = tokens[i + 2];
        }

        if (isName(next)) {
            exports.set(next.text, { name: next.text, kind: kind ?? known.get(next.text) ?? "variable", from: library });
        }
    });

    return Array.from(exports.values());
};
