import { noisePatterns, blockStart, blockEnd, minNoisyLines } from "./groupLines.constants";
import { stripAnsi } from "./outputText";
import type { LineKind, OutputItem, OutputLine } from "./types";

export const isProblem = (kind: LineKind) => kind === "stderr" || kind === "error" || kind === "warning";
export const isError = (kind: LineKind) => kind === "stderr" || kind === "error";

const isNoise = (line: OutputLine) => isError(line.kind) && noisePatterns.some((pattern) => pattern.test(stripAnsi(line.text)));

const hasContent = (line: OutputLine) => stripAnsi(line.text).trim() !== "";

/** Collapses runtime noise into expandable "details" items. */
export const groupLines = (lines: OutputLine[]): OutputItem[] => {
    const items: OutputItem[] = [];
    let pending: OutputLine[] = [];

    const flush = () => {
        const noisy = pending.filter(isNoise).length;
        if (noisy >= minNoisyLines) {
            const trimmed = pending.filter((l) => hasContent(l) || isNoise(l));
            items.push({ type: "details", id: trimmed[0].id, lines: trimmed });
        } else {
            pending.forEach((line) => items.push({ type: "line", line }));
        }
        pending = [];
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (isError(line.kind) && blockStart.test(stripAnsi(line.text))) {
            // Source excerpts right before the block belong to it.
            const block = [...pending, line];
            pending = [];
            while (i + 1 < lines.length && isError(lines[i + 1].kind)) {
                const next = lines[++i];
                block.push(next);
                if (blockEnd.test(stripAnsi(next.text))) break;
            }
            items.push({ type: "details", id: block[0].id, lines: block.filter(hasContent) });
            continue;
        }

        const blank = isError(line.kind) && !hasContent(line);
        if (isNoise(line) || (blank && pending.length > 0)) {
            pending.push(line);
        } else {
            flush();
            items.push({ type: "line", line });
        }
    }
    flush();

    return items;
};
