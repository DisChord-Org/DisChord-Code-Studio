import { enclosingBlocks } from "../chord-context";
import { getCorelib, type CorelibBlock, type CorelibData, type CorelibField } from "../chord-corelib";
import { tokenize } from "../chord-lexer";

export interface BlockLocation {
    open: number;
    close: number | null;
    definition: CorelibBlock;
}

export interface Statement {
    field: CorelibField | null;
    from: number;
    keyTo: number;
    valueFrom: number;
    valueTo: number;
    end: number;
    terminated: boolean;
}

const wordStart = /[A-Za-z_@À-ɏ]/;
const wordChar = /[\w@À-ɏ]/;

export const findBlock = (text: string, pos: number, corelib: CorelibData | null): BlockLocation | null => {
    if (!corelib) return null;

    const stack: number[] = [];
    let found: { open: number; close: number | null } | null = null;

    for (const token of tokenize(text)) {
        if (token.text === "{") {
            stack.push(token.to - 1);
        } else if (token.text === "}") {
            const open = stack.pop();
            if (!found && open !== undefined && open < pos && pos <= token.from) found = { open, close: token.from };
        }
    }
    if (!found) {
        const open = stack.filter((o) => o < pos).pop();
        if (open !== undefined) found = { open, close: null };
    }
    if (!found) return null;

    const kind = enclosingBlocks(text, found.open + 1, corelib).pop()?.kind;
    const definition = corelib.blocks.find((b) => b.name === kind);
    return definition ? { ...found, definition } : null;
};

const skipTrivia = (text: string, from: number, to: number): number => {
    let i = from;
    while (i < to) {
        if (/\s/.test(text[i])) i++;
        else if (text.startsWith("//", i)) i = lineEnd(text, i);
        else if (text.startsWith("/*", i)) {
            const end = text.indexOf("*/", i + 2);
            i = end === -1 ? to : end + 2;
        } else break;
    }
    return i;
};

const lineEnd = (text: string, from: number) => {
    const end = text.indexOf("\n", from);
    return end === -1 ? text.length : end;
};

const wordAt = (text: string, from: number, to: number): string => {
    if (from >= to || !wordStart.test(text[from])) return "";
    let i = from + 1;
    while (i < to && wordChar.test(text[i])) i++;
    return text.slice(from, i);
};

const closers: Record<string, string> = { "(": ")", "[": "]", "{": "}" };

const statementEnd = (text: string, from: number, to: number, keys: Set<string>): { end: number; terminated: boolean } => {
    const open: string[] = [];
    let i = from;

    while (i < to) {
        const ch = text[i];
        if (ch === '"') {
            i++;
            while (i < to && text[i] !== '"') i += text[i] === "\\" ? 2 : 1;
            i++;
            continue;
        }
        if (text.startsWith("//", i)) {
            i = lineEnd(text, i);
            continue;
        }
        if (text.startsWith("/*", i)) {
            const end = text.indexOf("*/", i + 2);
            i = end === -1 ? to : end + 2;
            continue;
        }
        if (closers[ch]) open.push(closers[ch]);
        else if (open.length > 0 && ch === open[open.length - 1]) open.pop();
        else if (open.length === 0 && ch === ";") return { end: i + 1, terminated: true };
        else if (open.length === 0 && ch === "\n") {
            const next = skipTrivia(text, i, to);
            if (next >= to || text[next] === "}" || keys.has(wordAt(text, next, to))) return { end: i, terminated: false };
        }
        i++;
    }
    return { end: Math.min(i, to), terminated: false };
};

export const parseStatements = (text: string, block: BlockLocation): Statement[] => {
    const to = block.close ?? text.length;
    const byKey = new Map<string, CorelibField>();
    for (const field of block.definition.fields) field.keys.forEach((key) => byKey.set(key, field));
    const keys = new Set([...byKey.keys(), ...block.definition.nested.map((n) => n.key)]);

    const statements: Statement[] = [];
    let i = block.open + 1;

    while (i < to) {
        i = skipTrivia(text, i, to);
        if (i >= to) break;
        if (text[i] === ";") {
            i++;
            continue;
        }

        const key = wordAt(text, i, to);
        const { end, terminated } = statementEnd(text, i + key.length, to, keys);
        if (key) {
            const keyTo = i + key.length;
            const valueFrom = skipTrivia(text, keyTo, end);
            const body = text.slice(valueFrom, terminated ? end - 1 : end).trimEnd();
            statements.push({
                field: byKey.get(key) ?? null,
                from: i,
                keyTo,
                valueFrom,
                valueTo: valueFrom + body.length,
                end,
                terminated,
            });
        }
        i = Math.max(end, i + Math.max(key.length, 1));
    }

    return statements;
};

const unquote = (value: string) => (/^"(?:[^"\\]|\\.)*"$/.test(value) ? value.slice(1, -1) : null);

export const valueOf = (text: string, statement: Statement | undefined): string =>
    statement ? text.slice(statement.valueFrom, statement.valueTo) : "";

export const literalOf = (raw: string): string | null => unquote(raw.trim());

export const listOf = (raw: string): string[] => Array.from(raw.matchAll(/"((?:[^"\\]|\\.)*)"/g), (m) => m[1]);

export const quote = (value: string) => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
export const listToText = (values: string[]) => (values.length > 0 ? `[ ${values.map(quote).join(", ")} ]` : "");

const looksLikeExpression = (raw: string) => {
    if (/^["'[(\-\d]/.test(raw) || raw.includes('"')) return true;
    if (/^[\w@À-ɏ]+$/.test(raw)) {
        const corelib = getCorelib();
        return !!corelib && (corelib.literals.some((l) => l.name === raw) || corelib.keywords.includes(raw));
    }
    return /^[\w@À-ɏ.]+(\(.*\))?$/.test(raw) && (raw.includes(".") || raw.includes("("));
};

export const toExpression = (raw: string): string => {
    const trimmed = raw.trim();
    return !trimmed || looksLikeExpression(trimmed) ? trimmed : quote(trimmed);
};

interface Edit {
    from: number;
    to: number;
    insert: string;
}

const leadingWhitespace = (text: string, pos: number) => /^[ \t]*/.exec(text.slice(text.lastIndexOf("\n", pos - 1) + 1))?.[0] ?? "";

export const editField = (text: string, block: BlockLocation, field: CorelibField, value: string, unit: string): Edit | null => {
    const statements = parseStatements(text, block);
    const current = statements.find((s) => s.field === field);

    if (current) {
        if (!value) {
            const lineStart = text.lastIndexOf("\n", current.from - 1) + 1;
            const alone = /^[ \t]*$/.test(text.slice(lineStart, current.from));
            const lineBreak = text[current.end] === "\n" ? 1 : 0;
            return alone ? { from: lineStart, to: current.end + lineBreak, insert: "" } : { from: current.from, to: current.end, insert: "" };
        }
        return { from: current.keyTo, to: current.valueTo, insert: ` ${value}` };
    }
    if (!value) return null;

    const baseIndent = leadingWhitespace(text, block.open);
    const last = statements[statements.length - 1];
    const indent = statements[0] ? leadingWhitespace(text, statements[0].from) : baseIndent + unit;
    const line = `${field.keys[0]} ${value}${last?.terminated ? ";" : ""}`;

    if (last) return { from: last.end, to: last.end, insert: `\n${indent}${line}` };

    const bodyEnd = block.close ?? text.length;
    const emptyBody = /^\s*$/.test(text.slice(block.open + 1, bodyEnd));
    if (emptyBody && !text.slice(block.open + 1, bodyEnd).includes("\n")) {
        return { from: block.open + 1, to: bodyEnd, insert: `\n${indent}${line}\n${baseIndent}` };
    }
    return { from: block.open + 1, to: block.open + 1, insert: `\n${indent}${line}` };
};
