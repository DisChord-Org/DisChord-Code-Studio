import { describe, expect, it, vi } from "vitest";
import { Text } from "@codemirror/state";

vi.mock("./api", () => ({ checkSource: vi.fn() }));

import { rangeOf, toEditorDiagnostics } from "./liveDiagnostics";

const doc = Text.of(["let foo = 1", "", "bar"]);

describe("diagnostics parsing", () => {
    it("covers the word at the column", () => {
        expect(rangeOf(doc, 1, 5)).toEqual({ from: 4, to: 7 });
    });
    it("clamps out-of-range lines and columns", () => {
        expect(rangeOf(doc, 99, 1)).toEqual({ from: 13, to: 16 });
        expect(rangeOf(doc, 0, 1).from).toBe(0);
        expect(rangeOf(doc, 1, 500)).toEqual({ from: 10, to: 11 });
        expect(rangeOf(doc, 2, 1)).toEqual({ from: 12, to: 12 });
    });
    it("maps diagnostics, skipping ones without line and defaulting severity", () => {
        const out = toEditorDiagnostics(doc, [
            { line: 0, message: "x", severity: "error" },
            { line: 3, column: 1, message: "m", severity: "weird", phase: "parse" },
            { line: 1, column: 1, message: "w", severity: "warning" },
        ] as never);
        expect(out).toHaveLength(2);
        expect(out[0]).toMatchObject({ severity: "error", source: "parse", message: "m" });
        expect(out[1].severity).toBe("warning");
    });
});
