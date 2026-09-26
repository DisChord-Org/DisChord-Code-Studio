export interface AnsiSegment {
    text: string;
    color?: string;
    bold?: boolean;
    dim?: boolean;
}

const basicColors = ["#4b5263", "#e06c75", "#98c379", "#e5c07b", "#61afef", "#c678dd", "#56b6c2", "#abb2bf"];
const brightColors = ["#7f848e", "#f07178", "#b5e890", "#f0d090", "#82c4ff", "#dd8cf0", "#7fd4de", "#ffffff"];

const color256 = (n: number): string | undefined => {
    if (n < 8) return basicColors[n];
    if (n < 16) return brightColors[n - 8];
    if (n < 232) {
        const i = n - 16;
        const level = (v: number) => (v === 0 ? 0 : 55 + v * 40);
        return `rgb(${level(Math.floor(i / 36))}, ${level(Math.floor((i % 36) / 6))}, ${level(i % 6)})`;
    }
    if (n < 256) {
        const v = 8 + (n - 232) * 10;
        return `rgb(${v}, ${v}, ${v})`;
    }
    return undefined;
};

// eslint-disable-next-line no-control-regex
const escapeSequence = /\x1b\[([0-9;?]*)([A-Za-z])/g;

/** Splits text into styled segments, honouring SGR colours and dropping every other escape sequence. */
export const parseAnsi = (input: string): AnsiSegment[] => {
    if (!input.includes("\x1b")) return [{ text: input }];

    const segments: AnsiSegment[] = [];
    let style: Omit<AnsiSegment, "text"> = {};
    let last = 0;

    const push = (text: string) => {
        if (text) segments.push({ text, ...style });
    };

    for (const match of input.matchAll(escapeSequence)) {
        push(input.slice(last, match.index));
        last = match.index + match[0].length;
        if (match[2] !== "m") continue;

        const codes = match[1] === "" ? [0] : match[1].split(";").map((c) => Number(c) || 0);
        for (let i = 0; i < codes.length; i++) {
            const code = codes[i];
            if (code === 0) style = {};
            else if (code === 1) style = { ...style, bold: true };
            else if (code === 2) style = { ...style, dim: true };
            else if (code === 22) style = { ...style, bold: false, dim: false };
            else if (code >= 30 && code <= 37) style = { ...style, color: basicColors[code - 30] };
            else if (code >= 90 && code <= 97) style = { ...style, color: brightColors[code - 90] };
            else if (code === 39) style = { ...style, color: undefined };
            else if ((code === 38 || code === 48) && codes[i + 1] === 5) {
                if (code === 38) style = { ...style, color: color256(codes[i + 2]) };
                i += 2;
            } else if ((code === 38 || code === 48) && codes[i + 1] === 2) {
                if (code === 38) style = { ...style, color: `rgb(${codes[i + 2]}, ${codes[i + 3]}, ${codes[i + 4]})` };
                i += 4;
            }
        }
    }

    push(input.slice(last));
    return segments;
};
