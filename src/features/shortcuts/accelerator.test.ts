import { describe, expect, it } from "vitest";
import {
    acceleratorFromEvent, formatAccelerator, isRiskyWithoutModifier, matchesAccelerator,
    normalizeAccelerator, parseAccelerator, type KeyEventLike,
} from "./accelerator";

const ev = (over: Partial<KeyEventLike>): KeyEventLike => ({
    key: "s", code: "KeyS", ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...over,
});

describe("accelerator", () => {
    it("parses and normalizes", () => {
        expect(normalizeAccelerator("shift+mod+s")).toBe("Mod+Shift+S");
        expect(normalizeAccelerator("esc")).toBe("Escape");
        expect(normalizeAccelerator("Mod++")).toBe("Mod++");
        expect(parseAccelerator("")).toBeNull();
        expect(parseAccelerator("Mod+")).toBeNull();
        expect(parseAccelerator("A+B")).toBeNull();
    });
    it("resolves Mod per platform when matching", () => {
        expect(matchesAccelerator(ev({ ctrlKey: true }), "Mod+S", false)).toBe(true);
        expect(matchesAccelerator(ev({ metaKey: true }), "Mod+S", false)).toBe(false);
        expect(matchesAccelerator(ev({ metaKey: true }), "Mod+S", true)).toBe(true);
        expect(matchesAccelerator(ev({ ctrlKey: true, shiftKey: true }), "Mod+S", false)).toBe(false);
    });
    it("uses the physical key with Alt/Shift and ignores lone modifiers", () => {
        expect(acceleratorFromEvent(ev({ key: "¡", code: "Digit1", altKey: true }), true)).toBe("Alt+1");
        expect(acceleratorFromEvent(ev({ key: "Shift", code: "ShiftLeft", shiftKey: true }), false)).toBeNull();
        expect(acceleratorFromEvent(ev({ ctrlKey: true, shiftKey: true, key: "S" }), false)).toBe("Mod+Shift+S");
    });
    it("flags risky shortcuts", () => {
        expect(isRiskyWithoutModifier("S", false)).toBe(true);
        expect(isRiskyWithoutModifier("Shift+S", false)).toBe(true);
        expect(isRiskyWithoutModifier("F12", false)).toBe(false);
        expect(isRiskyWithoutModifier("Mod+S", false)).toBe(false);
    });
    it("formats per platform", () => {
        expect(formatAccelerator("Mod+Shift+S", false)).toBe("Ctrl+Shift+S");
        expect(formatAccelerator("Mod+Shift+S", true)).toBe("⇧⌘S");
    });
});
