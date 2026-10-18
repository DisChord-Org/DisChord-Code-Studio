import { describe, expect, it } from "vitest";
import { describeOutcome, firstLine, friendlyError, phaseLabel } from "./PackageManager.utils";
import type { PkgResult } from "../types";

const result = (over: Partial<PkgResult>): PkgResult => ({
    package: "foo", version: null, phase: "done", message: null, severity: "success", warned: false, ...over,
});

describe("phaseLabel", () => {
    it("maps known phases and falls back for unknown ones", () => {
        expect(phaseLabel("done")).toBe("Instalada");
        expect(phaseLabel("whatever")).toBe("Procesando...");
    });
});

describe("firstLine", () => {
    it("skips blank lines and the Error: prefix, and truncates", () => {
        expect(firstLine("\n  Error: boom\nmore")).toBe("boom");
        expect(firstLine("x".repeat(300))).toHaveLength(201);
    });
});

describe("friendlyError", () => {
    it("recognises known failures", () => {
        expect(friendlyError("os error 2").message).toMatch(/falta el comando/);
        expect(friendlyError("EACCES").message).toMatch(/permisos/);
        expect(friendlyError("ETIMEDOUT").message).toMatch(/tardó demasiado/);
        expect(friendlyError("getaddrinfo failed").message).toMatch(/conexión/);
    });
    it("falls back to the first line, with limited details", () => {
        const r = friendlyError(Array.from({ length: 30 }, (_, i) => `line ${i}`).join("\n"));
        expect(r.message).toBe("line 0");
        expect(r.details).toHaveLength(12);
    });
    it("handles empty input", () => {
        expect(friendlyError("").message).toBe("Ocurrió un error inesperado.");
    });
});

describe("describeOutcome", () => {
    it("reports a fresh install with dependencies", () => {
        const o = describeOutcome("install", "foo", {
            success: true, changed: true, output: "",
            results: [result({}), result({ package: "dep" })],
        });
        expect(o.level).toBe("success");
        expect(o.message).toBe("foo instalada. Incluye 1 dependencia.");
        expect(o.details).toHaveLength(2);
    });
    it("is info when nothing changed", () => {
        const o = describeOutcome("install", "foo", { success: true, changed: false, output: "", results: [result({ severity: "info" })] });
        expect(o).toMatchObject({ level: "info", message: "foo ya estaba instalada.", details: [] });
    });
    it("warns on unsigned packages", () => {
        const o = describeOutcome("use", "foo", { success: true, changed: true, output: "", results: [result({ warned: true })] });
        expect(o.level).toBe("warning");
    });
    it("blames the failing dependency", () => {
        const o = describeOutcome("install", "foo", {
            success: false, changed: false, output: "",
            results: [result({ package: "dep", severity: "error", phase: "not_found" })],
        });
        expect(o.level).toBe("error");
        expect(o.message).toBe("No se pudo instalar foo: falló la dependencia dep (no se encontró)");
    });
    it("handles failure without results", () => {
        const o = describeOutcome("sync", "", { success: false, changed: false, output: "", results: [] });
        expect(o.message).toBe("No se pudo sincronizar: la operación no terminó bien.");
    });
});
