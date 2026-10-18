import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dismissToast, getToasts, notify } from "./Toasts";

describe("Toasts", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => {
        getToasts().forEach((t) => dismissToast(t.id));
        vi.useRealTimers();
    });

    it("auto-dismisses success after 4s and warning after 8s", () => {
        notify("success", "ok");
        notify("warning", "careful");
        vi.advanceTimersByTime(4000);
        expect(getToasts().map((t) => t.message)).toEqual(["careful"]);
        vi.advanceTimersByTime(4000);
        expect(getToasts()).toHaveLength(0);
    });
    it("keeps errors until dismissed", () => {
        notify("error", "bad");
        vi.advanceTimersByTime(60_000);
        expect(getToasts()).toHaveLength(1);
        dismissToast(getToasts()[0].id);
        expect(getToasts()).toHaveLength(0);
    });
    it("evicts the oldest non-error when over the limit", () => {
        notify("error", "e");
        for (const m of ["a", "b", "c", "d"]) notify("info", m);
        expect(getToasts().map((t) => t.message)).toEqual(["e", "b", "c", "d"]);
    });
});
