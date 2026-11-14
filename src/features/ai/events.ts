import type { AiContextUsage, AiSessionUsage, AiUser, ToolStatus } from "./types";

/** Fields any `ai-event` may carry besides its own payload. */
interface EventExtras {
    context?: AiContextUsage;
    sessionUsage?: AiSessionUsage;
}

export type AiServerEvent = EventExtras & (
    | { type: "chat:token"; messageId: string; token: string }
    | { type: "ai:auth"; status: string; message: string; user: AiUser | null }
    | { type: "plan:changed"; plan: string }
    | { type: "compact:start" }
    | { type: "compact:done" }
    | { type: "compact:error" }
    | { type: "chat:start"; sessionId: string; messageId: string }
    | { type: "chat:done"; messageId: string; commandId: string; content: string; cancelled: boolean; truncated: boolean }
    | { type: "chat:limit"; message: string }
    | { type: "chat:error"; error: string }
    | { type: "chat:cancel:ack" }
    | { type: "error"; error: string }
    | { type: "ai:approval"; commandId: string; tool: string; summary: string; detail?: string }
    | { type: "ai:command"; commandId: string; status: ToolStatus; summary: string; output?: string }
    | { type: "command:expired"; commandId: string }
    | { type: "ai:closed" }
);

const toolStatuses: readonly string[] = ["running", "success", "error", "rejected"];

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const text = (value: unknown) => (typeof value === "string" ? value : "");
const optionalText = (value: unknown) => (typeof value === "string" ? value : undefined);

/** Narrows a raw `ai-event` payload; returns null when it is malformed or of an unknown type. */
export const parseAiEvent = (raw: unknown): AiServerEvent | null => {
    if (!isRecord(raw) || typeof raw.type !== "string") return null;

    const extras: EventExtras = {};
    if (isRecord(raw.context)) extras.context = raw.context as unknown as AiContextUsage;
    if (isRecord(raw.sessionUsage)) extras.sessionUsage = raw.sessionUsage as unknown as AiSessionUsage;

    switch (raw.type) {
        case "chat:token":
            return { ...extras, type: raw.type, messageId: text(raw.messageId), token: text(raw.token) };
        case "ai:auth":
            return { ...extras, type: raw.type, status: text(raw.status), message: text(raw.message), user: isRecord(raw.user) ? (raw.user as AiUser) : null };
        case "plan:changed":
            return { ...extras, type: raw.type, plan: text(raw.plan) };
        case "compact:start":
        case "compact:done":
        case "compact:error":
        case "chat:cancel:ack":
        case "ai:closed":
            return { ...extras, type: raw.type };
        case "chat:start":
            return { ...extras, type: raw.type, sessionId: text(raw.sessionId), messageId: text(raw.messageId) };
        case "chat:done":
            return {
                ...extras, type: raw.type, messageId: text(raw.messageId), commandId: text(raw.commandId), content: text(raw.content),
                cancelled: raw.cancelled === true, truncated: raw.truncated === true,
            };
        case "chat:limit":
            return { ...extras, type: raw.type, message: text(raw.message) };
        case "chat:error":
        case "error":
            return { ...extras, type: raw.type, error: text(raw.error) };
        case "ai:approval":
            return { ...extras, type: raw.type, commandId: text(raw.commandId), tool: text(raw.tool), summary: text(raw.summary), detail: optionalText(raw.detail) };
        case "ai:command":
            if (!toolStatuses.includes(text(raw.status))) return null;
            return { ...extras, type: raw.type, commandId: text(raw.commandId), status: raw.status as ToolStatus, summary: text(raw.summary), output: optionalText(raw.output) };
        case "command:expired":
            return { ...extras, type: raw.type, commandId: text(raw.commandId) };
        default:
            return null;
    }
};
