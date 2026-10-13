import { chordAtoms, chordBuiltins, chordControlFlow, chordKeywords } from "./chord-language";
import { tokenize, type Token } from "./chord-lexer";

export type SymbolKind = "variable" | "function" | "class" | "property" | "parameter" | "import" | "module" | "command" | "event" | "used";

export interface ChordSymbol {
    name: string;
    kind: SymbolKind;
    from?: string;
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

const grammarWords = new Set([...chordKeywords, ...chordControlFlow, ...chordAtoms, "@asincrono"]);

const isDeclarable = (token: Token | undefined): token is Token =>
    !!token && token.type === "word" && !grammarWords.has(token.text);

const isName = (token: Token | undefined): token is Token =>
    !!token && token.type === "word" && !isReserved(token.text);

const startsArrow = (tokens: Token[], i: number) => tokens[i]?.text === "-" && tokens[i + 1]?.text === ">";

const typeEnders = new Set([",", ")", "{", "}", ";", "es"]);

const endOfType = (tokens: Token[], start: number, onType: (token: Token) => void): number => {
    let depth = 0;
    let j = start;

    for (; j < tokens.length; j++) {
        const t = tokens[j];

        if (t.text === "[") depth++;
        else if (t.text === "]") {
            if (depth === 0) break;
            depth--;
        } else if (depth === 0) {
            if (typeEnders.has(t.text) || startsArrow(tokens, j)) break;
            if (t.type === "word" && j > start && tokens[j - 1].type === "word") break;
        }

        onType(t);
    }

    return j;
};

export interface DeclaredName {
    name: string;
    kind: SymbolKind;
    from: number;
    to: number;
    container?: string;
}

class Scan {
    readonly symbols = new Map<string, ChordSymbol>();
    readonly claimed = new Set<number>();
    readonly names: DeclaredName[] = [];

    constructor(readonly tokens: Token[], private readonly ignore?: { from: number; to: number }) {}

    private touchesIgnored(token: Token) {
        return !!this.ignore && token.from <= this.ignore.to && token.to >= this.ignore.from;
    }

    declare(token: Token, kind: SymbolKind, container?: string) {
        this.claimed.add(token.from);
        if (this.touchesIgnored(token)) return;

        this.names.push({ name: token.text, kind, from: token.from, to: token.to, container });

        const known = this.symbols.get(token.text);
        if (!known || known.kind === "used") this.symbols.set(token.text, { name: token.text, kind });
    }

    declareParameters(open: number, owner: string) {
        let parens = 0;
        let brackets = 0;
        let expectName = true;

        for (let j = open; j < this.tokens.length; j++) {
            const t = this.tokens[j];

            if (t.text === "(") parens++;
            else if (t.text === ")" && --parens === 0) return;
            else if (t.text === "[") brackets++;
            else if (t.text === "]") brackets--;
            else if (t.text === "," && parens === 1 && brackets === 0) expectName = true;
            else if (expectName && parens === 1 && isDeclarable(t)) {
                this.declare(t, "parameter", owner);
                expectName = false;
            }
        }
    }

    declareImport(afterKeyword: number) {
        const next = this.tokens[afterKeyword];

        if (next?.text === "{") {
            for (let j = afterKeyword + 1; j < this.tokens.length && this.tokens[j].text !== "}"; j++) {
                if (isDeclarable(this.tokens[j])) this.declare(this.tokens[j], "import");
            }
        } else if (isDeclarable(next)) {
            this.declare(next, "module");
        }
    }

    visit(i: number): number {
        const token = this.tokens[i];

        if (startsArrow(this.tokens, i)) return endOfType(this.tokens, i + 2, (t) => this.claimed.add(t.from));
        if (token.type !== "word") return i + 1;
        if (token.text === "tipo") return endOfType(this.tokens, i + 1, (t) => this.claimed.add(t.from));

        const kind = declarations[token.text];
        const name = this.tokens[i + 1];

        if (kind && isDeclarable(name)) {
            this.declare(name, kind);
            if (kind === "function" && this.tokens[i + 2]?.text === "(") this.declareParameters(i + 2, name.text);
        } else if (token.text === "importar") {
            this.declareImport(i + 1);
        }

        return i + 1;
    }

    collectUses() {
        this.tokens.forEach((token, i) => {
            if (token.type !== "word" || this.claimed.has(token.from) || !isName(token)) return;
            if (this.tokens[i - 1]?.text === "." || this.touchesIgnored(token)) return;
            if (!this.symbols.has(token.text)) this.symbols.set(token.text, { name: token.text, kind: "used" });
        });
    }
}

export const collectSymbols = (text: string, ignore?: { from: number; to: number }): ChordSymbol[] => {
    const scan = new Scan(tokenize(text), ignore);

    for (let i = 0; i < scan.tokens.length; ) i = scan.visit(i);
    scan.collectUses();

    return Array.from(scan.symbols.values());
};

export const collectDeclarations = (text: string): DeclaredName[] => {
    const scan = new Scan(tokenize(text));
    for (let i = 0; i < scan.tokens.length; ) i = scan.visit(i);
    return scan.names;
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
