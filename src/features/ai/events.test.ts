import { describe, expect, it } from "vitest";
import { parseAiEvent } from "./events";

describe("parseAiEvent", () => {
    it("rejects payloads that are not objects with a string type", () => {
        for (const raw of [null, undefined, 42, "chat:token", [], {}, { type: 1 }]) {
            expect(parseAiEvent(raw)).toBeNull();
        }
    });

    it("ignores unknown event types", () => {
        expect(parseAiEvent({ type: "nope" })).toBeNull();
    });

    it("fills missing text fields with empty strings", () => {
        expect(parseAiEvent({ type: "chat:token" })).toEqual({ type: "chat:token", messageId: "", token: "" });
    });

    it("parses a finished chat turn", () => {
        const event = parseAiEvent({ type: "chat:done", messageId: "m", commandId: "c", content: "hi", cancelled: true });
        expect(event).toEqual({ type: "chat:done", messageId: "m", commandId: "c", content: "hi", cancelled: true, truncated: false });
    });

    it("only accepts known tool statuses on ai:command", () => {
        expect(parseAiEvent({ type: "ai:command", commandId: "c", status: "bogus", summary: "x" })).toBeNull();
        expect(parseAiEvent({ type: "ai:command", commandId: "c", status: "running", summary: "x" })).toMatchObject({ status: "running" });
    });

    it("keeps context and session usage when they are objects", () => {
        const context = { used: 1 };
        const event = parseAiEvent({ type: "compact:done", context, sessionUsage: "nope" });
        expect(event).toEqual({ type: "compact:done", context });
    });
});
