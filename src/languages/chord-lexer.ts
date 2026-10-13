export interface Token {
    text: string;
    from: number;
    to: number;
    type: "word" | "punct";
}

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

