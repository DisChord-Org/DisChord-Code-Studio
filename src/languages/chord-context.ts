import type { CorelibData } from "./chord-corelib";
import { tokenize, type Token } from "./chord-lexer";

export interface BlockInfo {
    kind: string;
    name?: string;
}

const executableKinds = new Set(["comando", "evento", "funcion", "control", "metodo"]);

export const isExecutable = (kind: string) => executableKinds.has(kind);

interface Head {
    words: string[];
    last: string | undefined;
    before: string | undefined;
}

type Rule = (head: Head, parent: BlockInfo | undefined, corelib: CorelibData | null) => BlockInfo | null;

const maxHeadWords = 40;

const headBefore = (tokens: Token[], brace: number): Head => {
    const words: string[] = [];

    for (let j = brace - 1; j >= 0 && words.length < maxHeadWords; j--) {
        const t = tokens[j];
        if (t.text === ";" || t.text === "{" || t.text === "}") break;
        words.unshift(t.text);
    }

    return { words, last: words[words.length - 1], before: words[words.length - 2] };
};

const rules: Rule[] = [
    ({ words, last }) =>
        last === ")" || words.join("").includes("->") ? { kind: words.includes("funcion") ? "funcion" : "control" } : null,

    ({ before, last }) => (before === "comando" && last ? { kind: "comando", name: last } : null),
    ({ before, last }) => (before === "evento" && last ? { kind: "evento", name: last } : null),
    ({ words, before }) => (before === "clase" || words.includes("extiende") ? { kind: "clase" } : null),
    ({ before, last }) => (last === "bot" && before === "encender" ? { kind: "encender bot" } : null),

    ({ words }, _parent, corelib) => {
        const block = corelib?.blocks.find((b) => {
            const parts = b.name.split(" ");
            return words.length >= parts.length && words.slice(-parts.length).join(" ") === b.name;
        });
        return block ? { kind: block.name } : null;
    },

    ({ last }, parent, corelib) => {
        if (!last || !parent || !corelib) return null;

        const nested = corelib.blocks.find((b) => b.name === parent.kind)?.nested.find((n) => n.key === last);
        if (nested) return { kind: nested.shape === "single" ? nested.block : nested.key };

        const container = corelib.blocks.flatMap((b) => b.nested).find((n) => n.key === parent.kind);
        return container ? { kind: container.block, name: last } : null;
    },

    ({ last }, parent) => (last && parent?.kind === "clase" ? { kind: "metodo", name: last } : null),
    ({ last }, parent) => (last && parent && (last === "sino" || last === "ademas") ? { kind: "control" } : null),
];

const classify = (head: Head, parent: BlockInfo | undefined, corelib: CorelibData | null): BlockInfo => {
    for (const rule of rules) {
        const info = rule(head, parent, corelib);
        if (info) return info;
    }
    return { kind: "otro" };
};

export const enclosingBlocks = (text: string, pos: number, corelib: CorelibData | null): BlockInfo[] => {
    const tokens = tokenize(text.slice(0, pos));
    const stack: BlockInfo[] = [];

    tokens.forEach((token, i) => {
        if (token.text === "}") stack.pop();
        else if (token.text === "{") stack.push(classify(headBefore(tokens, i), stack[stack.length - 1], corelib));
    });

    return stack;
};

export const enclosingList = (text: string, pos: number): { key: string } | null => {
    const tokens = tokenize(text.slice(0, pos));
    let depth = 0;

    for (let i = tokens.length - 1; i >= 0; i--) {
        const t = tokens[i];
        if (t.text === "]") depth++;
        else if (t.text === "[") {
            if (depth === 0) {
                const key = tokens[i - 1];
                return key && key.type === "word" ? { key: key.text } : null;
            }
            depth--;
        } else if (t.text === ";" || t.text === "{" || t.text === "}") break;
    }

    return null;
};
