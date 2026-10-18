import { describe, expect, it } from "vitest";
import { baseName, canMoveInto, isSameOrInside, joinPath, parentPath, remapPath, toPosix } from "./pathUtils";

describe("pathUtils", () => {
    it("converts backslashes and joins", () => {
        expect(toPosix("a\\b\\c.ch")).toBe("a/b/c.ch");
        expect(joinPath("", "x")).toBe("x");
        expect(joinPath("a/b", "x")).toBe("a/b/x");
    });
    it("handles both separators in parent and base name", () => {
        expect(parentPath("a\\b\\c")).toBe("a\\b");
        expect(parentPath("a/b/c")).toBe("a/b");
        expect(parentPath("c")).toBe("");
        expect(baseName("a\\b\\c.ch")).toBe("c.ch");
        expect(baseName("c.ch")).toBe("c.ch");
    });
    it("does not treat sibling prefixes as inside", () => {
        expect(isSameOrInside("src/a", "src")).toBe(true);
        expect(isSameOrInside("src", "src")).toBe(true);
        expect(isSameOrInside("srcs/a", "src")).toBe(false);
        expect(isSameOrInside("src\\a", "src")).toBe(true);
    });
    it("remaps moved paths", () => {
        expect(remapPath("a", "a", "b/a")).toBe("b/a");
        expect(remapPath("a/x.ch", "a", "b/a")).toBe("b/a/x.ch");
        expect(remapPath("ab/x", "a", "b/a")).toBe("ab/x");
    });
    it("validates drops", () => {
        expect(canMoveInto("a/x", "a")).toBe(false);
        expect(canMoveInto("a", "a/sub")).toBe(false);
        expect(canMoveInto("a", "a")).toBe(false);
        expect(canMoveInto("a/x", "")).toBe(true);
        expect(canMoveInto("x", "a")).toBe(true);
    });
});
