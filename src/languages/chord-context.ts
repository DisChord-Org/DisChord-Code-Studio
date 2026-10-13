import { tokenize } from "./chord-symbols";
import type { CorelibData } from "./chord-corelib";

export interface BlockInfo {
    kind: string;
    name?: string;
}

export interface Position {
    inComment: boolean;
    inString: number | null;
}

export const positionKind = (text: string, pos: number): Position => {
    let i = 0;

    while (i < pos) {
        const ch = text[i];

        if (ch === "/" && text[i + 1] === "/") {
            const end = text.indexOf("\n", i);
            if (end === -1 || end >= pos) return { inComment: true, inString: null };
            i = end;
        } else if (ch === "/" && text[i + 1] === "*") {
            const end = text.indexOf("*/", i + 2);
            if (end === -1 || end + 2 > pos) return { inComment: true, inString: null };
            i = end + 2;
        } else if (ch === '"') {
            const start = i;
            i++;
            while (i < text.length && text[i] !== '"') {
                if (text[i] === "\n") break;
                i += text[i] === "\\" ? 2 : 1;
            }
            if (i >= pos) return { inComment: false, inString: start };
            i++;
        } else {
            i++;
        }
    }

    return { inComment: false, inString: null };
};

const executableKinds = new Set(["comando", "evento", "funcion", "control", "metodo"]);

export const isExecutable = (kind: string) => executableKinds.has(kind);

export const enclosingBlocks = (text: string, pos: number, corelib: CorelibData | null): BlockInfo[] => {
    const tokens = tokenize(text.slice(0, pos));
    const blockNames = new Set((corelib?.blocks ?? []).map((b) => b.name));
    const stack: BlockInfo[] = [];

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (token.text === "}") {
            stack.pop();
            continue;
        }
        if (token.text !== "{") continue;

        const head: string[] = [];
        for (let j = i - 1; j >= 0 && head.length < 40; j--) {
            const t = tokens[j];
            if (t.text === ";" || t.text === "{" || t.text === "}") break;
            head.unshift(t.text);
        }

        const last = head[head.length - 1];
        const before = head[head.length - 2];
        const parent = stack[stack.length - 1];
        let info: BlockInfo = { kind: "otro" };

        if (last === ")" || head.join("").includes("->")) {
            info = { kind: head.includes("funcion") ? "funcion" : "control" };
        } else if (before === "comando" && last) {
            info = { kind: "comando", name: last };
        } else if (before === "evento" && last) {
            info = { kind: "evento", name: last };
        } else if (before === "clase" || head.includes("extiende")) {
            info = { kind: "clase" };
        } else if (last === "bot" && before === "encender") {
            info = { kind: "encender bot" };
        } else if (last && blockNames.has(last)) {
            info = { kind: last };
        } else if (last && parent) {
            const parentBlock = corelib?.blocks.find((b) => b.name === parent.kind);
            const nestedHere = parentBlock?.nested.find((n) => n.key === last);
            const container = corelib?.blocks.flatMap((b) => b.nested).find((n) => n.key === parent.kind);

            if (nestedHere) info = { kind: nestedHere.shape === "single" ? nestedHere.block : nestedHere.key };
            else if (container) info = { kind: container.block, name: last };
            else if (parent.kind === "clase") info = { kind: "metodo", name: last };
            else if (last === "sino" || last === "ademas") info = { kind: "control" };
        }

        stack.push(info);
    }

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
