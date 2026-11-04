export type AiAuth = "checking" | "signed_out" | "pending" | "signed_in";

export interface AiUser {
    id?: string;
    discordUsername?: string;
    plan?: string;
}

export interface AiQuota {
    used?: number;
    limit?: number;
    resetsAt?: string;
    period?: string;
}

export interface AiAccount {
    discordUsername?: string;
    avatarDataUrl?: string;
    plan?: string;
    contextLimit?: number;
    usage?: { chat?: AiQuota; bridge?: AiQuota };
}

export interface AiContextUsage {
    tokens: number;
    limit: number;
    compactAt: number;
}

export interface AiSessionUsage {
    promptTokens: number;
    cacheHitTokens: number;
    cacheMissTokens: number;
    completionTokens: number;
    costEur?: number;
}

export interface AiSessionSummary {
    id: string;
    title: string | null;
    updatedAt: string;
    messageCount: number;
}

export type ToolStatus = "running" | "success" | "error" | "rejected";

export type AiItem =
    | { kind: "user"; id: number; content: string }
    | { kind: "assistant"; id: number; messageId: string | null; content: string; streaming: boolean; cancelled?: boolean; truncated?: boolean }
    | { kind: "tool"; id: number; commandId: string; summary: string; status: ToolStatus; output?: string }
    | { kind: "approval"; id: number; commandId: string; tool: string; summary: string; detail?: string }
    | { kind: "notice"; id: number; tone: "info" | "warning" | "error"; text: string }
    | { kind: "report"; id: number; report: "context" | "usage"; context: AiContextUsage | null; usage: AiSessionUsage | null; account: AiAccount | null };
