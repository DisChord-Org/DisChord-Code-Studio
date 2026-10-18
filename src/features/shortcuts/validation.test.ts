import { describe, expect, it, vi } from "vitest";

vi.mock("../../utils/Platform", () => ({ isMac: false }));

import { findConflicts, problemWith, withBinding } from "./validation";
import { getDefinition } from "./definitions";

describe("shortcut validation", () => {
    it("detects conflicts between app shortcuts", () => {
        const conflicts = findConflicts("run.toggle", "Mod+S", { "file.save": "Mod+S" });
        expect(conflicts.map((c) => c.id)).toEqual(["file.save"]);
        expect(findConflicts("run.toggle", "Mod+S", {})).toEqual([]);
    });
    it("rejects unmodified global shortcuts only", () => {
        const save = getDefinition("file.save")!;
        expect(problemWith(save, "S")).toMatch(/Ctrl/);
        expect(problemWith(save, "F5")).toBeNull();
        expect(problemWith(getDefinition("explorer.rename")!, "S")).toBeNull();
    });
    it("drops overrides equal to the default", () => {
        expect(withBinding({ "file.save": "Mod+K" }, "file.save", "Mod+S")).toEqual({});
        expect(withBinding({}, "file.save", "Mod+K")).toEqual({ "file.save": "Mod+K" });
    });
});
