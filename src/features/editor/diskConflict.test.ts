import { describe, expect, it } from "vitest";
import { decideDiskChange, decideSaveGuard } from "./diskConflict";

describe("decideSaveGuard", () => {
    const input = { saveContent: "mine", baseContent: "orig", diskContent: "orig" };

    it("saves when the disk still holds the known base", () => {
        expect(decideSaveGuard(input)).toBe("save");
    });

    it("saves when the disk already equals what is being saved", () => {
        expect(decideSaveGuard({ ...input, diskContent: "mine" })).toBe("save");
    });

    it("asks when the disk diverged from the base and from the save", () => {
        expect(decideSaveGuard({ ...input, diskContent: "theirs" })).toBe("confirm");
    });

    it("saves when the disk cannot be read", () => {
        expect(decideSaveGuard({ ...input, diskContent: undefined })).toBe("save");
    });

    it("saves when there is no known base", () => {
        expect(decideSaveGuard({ ...input, baseContent: undefined, diskContent: "theirs" })).toBe("save");
    });
});

const base = { isDirty: true, tabContent: "mine", baseContent: "orig", diskContent: "orig", askedContent: undefined };

describe("decideDiskChange", () => {
    it("reloads a clean tab whose disk content differs", () => {
        expect(decideDiskChange({ ...base, isDirty: false, tabContent: "orig", diskContent: "new" })).toBe("reload");
    });

    it("ignores a clean tab that already matches the disk", () => {
        expect(decideDiskChange({ ...base, isDirty: false, tabContent: "orig" })).toBe("ignore");
    });

    it("ignores a dirty tab when the disk still holds the known base", () => {
        expect(decideDiskChange(base)).toBe("ignore");
    });

    it("ignores a dirty tab when the disk already equals the editor (own save)", () => {
        expect(decideDiskChange({ ...base, diskContent: "mine" })).toBe("ignore");
    });

    it("reports a conflict when a dirty tab meets new disk content", () => {
        expect(decideDiskChange({ ...base, diskContent: "theirs" })).toBe("conflict");
    });

    it("does not ask twice about the same disk content", () => {
        expect(decideDiskChange({ ...base, diskContent: "theirs", askedContent: "theirs" })).toBe("ignore");
    });

    it("asks again when the disk changes to something else", () => {
        expect(decideDiskChange({ ...base, diskContent: "third", askedContent: "theirs" })).toBe("conflict");
    });

    it("treats an unknown base as a conflict only if disk differs from the editor", () => {
        expect(decideDiskChange({ ...base, baseContent: undefined, diskContent: "x" })).toBe("conflict");
    });
});
