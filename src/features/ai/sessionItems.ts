import type { AiItem } from "./types";

export interface StoredMessage {
    id: string;
    role: string;
    content: string;
    commandId: string | null;
    toolName: string | null;
    toolArguments: string | null;
    compaction: boolean;
    pruned: boolean;
}

const attachedFiles = /\n\n\[Archivos?[^\]]*\]\s*$/;

const argumentsOf = (raw: string | null): Record<string, unknown> => {
    try {
        const parsed = JSON.parse(raw ?? "");
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
        return {};
    }
};

const summaryOf = (message: StoredMessage) => {
    const args = argumentsOf(message.toolArguments);
    if (message.toolName === "run_command" && typeof args.command === "string") return args.command;
    const target = [args.path, args.pattern].find((value) => typeof value === "string");
    return `${message.toolName ?? "herramienta"} ${target ?? ""}`.trim();
};

export const itemsOfSession = (messages: StoredMessage[], nextId: () => number): AiItem[] =>
    messages
        .filter((message) => !message.pruned)
        .map((message): AiItem => {
            if (message.compaction) return { kind: "notice", id: nextId(), tone: "info", text: "Conversación compactada" };
            if (message.role === "user") return { kind: "user", id: nextId(), content: message.content.replace(attachedFiles, "") };
            if (message.commandId) return { kind: "tool", id: nextId(), commandId: message.commandId, summary: summaryOf(message), status: "success" };
            return { kind: "assistant", id: nextId(), messageId: message.id, content: message.content, streaming: false };
        });
