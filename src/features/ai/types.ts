export type AiAuth = "checking" | "signed_out" | "pending" | "signed_in";

export interface AiUser {
    id?: string;
    discordUsername?: string;
    plan?: string;
}

/** How much of an allowance has been used in the current period. */
export interface AiQuota {
    used?: number;
    limit?: number;
    resetsAt?: string;
    period?: string;
}

/** What the server says about the account right now. */
export interface AiAccount {
    discordUsername?: string;
    /** The avatar already downloaded by the backend, ready to show. */
    avatarDataUrl?: string;
    plan?: string;
    contextLimit?: number;
    usage?: { chat?: AiQuota; bridge?: AiQuota };
}

/** How full the conversation is, in estimated tokens. */
export interface AiContextUsage {
    tokens: number;
    /** The plan's context size. */
    limit: number;
    /** The size at which the conversation is compacted on its own (never above `limit`). */
    compactAt: number;
}

/** What the conversation has spent so far. */
export interface AiSessionUsage {
    promptTokens: number;
    cacheHitTokens: number;
    cacheMissTokens: number;
    completionTokens: number;
    costEur?: number;
}

export type ToolStatus = "running" | "success" | "error" | "rejected";

/** One line of the conversation: what the user wrote, what the assistant answered, or what it did to the project. */
export type AiItem =
    | { kind: "user"; id: number; content: string }
    | { kind: "assistant"; id: number; messageId: string | null; content: string; streaming: boolean; cancelled?: boolean; truncated?: boolean }
    | { kind: "tool"; id: number; commandId: string; summary: string; status: ToolStatus; output?: string }
    | { kind: "approval"; id: number; commandId: string; tool: string; summary: string; detail?: string; mutating: boolean }
    | { kind: "notice"; id: number; tone: "info" | "warning" | "error"; text: string };
