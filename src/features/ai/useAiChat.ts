import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { AiAccount, AiAuth, AiContextUsage, AiItem, AiSessionUsage, AiUser, ToolStatus } from "./types";

const notSignedIn = "not_signed_in";
const accountRefreshMs = 15_000;

const errorTexts: Record<string, string> = {
    session_not_found: "La conversación ya no existe en el servidor. Empieza una nueva.",
    upstream_unavailable: "El modelo no está disponible ahora mismo. Inténtalo de nuevo en un momento.",
    client_outdated: "Esta versión del IDE es demasiado antigua para Amaya. Actualiza el IDE.",
    too_many_connections: "Hay demasiados dispositivos conectados con tu cuenta.",
};

interface ServerEvent {
    type: string;
    [key: string]: unknown;
}

type Assistant = Extract<AiItem, { kind: "assistant" }>;
type Tool = Extract<AiItem, { kind: "tool" }>;

const text = (value: unknown) => (typeof value === "string" ? value : "");
const optionalText = (value: unknown) => (typeof value === "string" ? value : undefined);

const withoutApproval = (items: AiItem[], commandId: string) => items.filter((item) => !(item.kind === "approval" && item.commandId === commandId));

const indexOfAssistant = (items: AiItem[], messageId: string) => {
    for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        if (item.kind === "assistant" && item.messageId === messageId) return i;
    }
    return -1;
};

export const useAiChat = (projectName: string) => {
    const [items, setItems] = useState<AiItem[]>([]);
    const [thinking, setThinking] = useState(false);
    const [auth, setAuth] = useState<AiAuth>("checking");
    const [user, setUser] = useState<AiUser | null>(null);
    const [account, setAccount] = useState<AiAccount | null>(null);
    const [context, setContext] = useState<AiContextUsage | null>(null);
    const [usage, setUsage] = useState<AiSessionUsage | null>(null);
    const nextId = useRef(1);
    const sessionId = useRef<string | null>(null);
    const lastRefresh = useRef(0);
    const pendingText = useRef(new Map<string, string>());
    const flushFrame = useRef(0);

    const id = () => nextId.current++;
    const notice = useCallback((tone: "info" | "warning" | "error", message: string) => {
        setItems((prev) => [...prev, { kind: "notice", id: nextId.current++, tone, text: message }]);
    }, []);

    const updateAssistant = useCallback((messageId: string, change: (current: string) => Partial<Assistant>) => {
        setItems((prev) => {
            const index = indexOfAssistant(prev, messageId);
            if (index === -1) return [...prev, { kind: "assistant", id: nextId.current++, messageId, content: "", streaming: true, ...change("") }];
            const next = [...prev];
            const current = prev[index] as Assistant;
            next[index] = { ...current, ...change(current.content) };
            return next;
        });
    }, []);

    const flushText = useCallback(() => {
        cancelAnimationFrame(flushFrame.current);
        flushFrame.current = 0;
        if (pendingText.current.size === 0) return;

        const chunks = pendingText.current;
        pendingText.current = new Map();
        setItems((prev) => {
            let next = prev;
            for (const [messageId, added] of chunks) {
                const index = indexOfAssistant(next, messageId);
                if (next === prev) next = [...prev];
                if (index === -1) next.push({ kind: "assistant", id: nextId.current++, messageId, content: added, streaming: true });
                else next[index] = { ...(next[index] as Assistant), content: (next[index] as Assistant).content + added, streaming: true };
            }
            return next;
        });
    }, []);

    const setTool = useCallback((commandId: string, status: ToolStatus, summary: string, output?: string) => {
        setItems((prev) => {
            const without = withoutApproval(prev, commandId);
            const index = without.findIndex((item) => item.kind === "tool" && item.commandId === commandId);
            if (index === -1) return [...without, { kind: "tool", id: nextId.current++, commandId, summary, status, output }];
            const current = without[index] as Tool;
            const next = [...without];
            next[index] = { ...current, status, output: output ?? current.output, summary: summary || current.summary };
            return next;
        });
    }, []);

    const refreshAccount = useCallback((force = false) => {
        if (!force && Date.now() - lastRefresh.current < accountRefreshMs) return;
        lastRefresh.current = Date.now();
        invoke<AiAccount>("ai_me")
            // The avatar is downloaded apart; an answer that lacks it must not take away the one already shown.
            .then((next) => setAccount((prev) => ({ ...next, avatarDataUrl: next.avatarDataUrl ?? prev?.avatarDataUrl })))
            .catch((error) => console.warn("No se pudo leer la cuenta de Amaya:", error));
    }, []);

    const onEvent = useCallback((event: ServerEvent) => {
        if (event.type === "chat:token") {
            const messageId = text(event.messageId);
            pendingText.current.set(messageId, (pendingText.current.get(messageId) ?? "") + text(event.token));
            if (!flushFrame.current) flushFrame.current = requestAnimationFrame(flushText);
            return;
        }
        flushText();

        if (event.context && typeof event.context === "object") setContext(event.context as AiContextUsage);
        if (event.sessionUsage && typeof event.sessionUsage === "object") setUsage(event.sessionUsage as AiSessionUsage);

        switch (event.type) {
            case "ai:auth": {
                const status = text(event.status);
                if (status === "complete") {
                    setAuth("signed_in");
                    refreshAccount(true);
                    setUser((event.user as AiUser) ?? null);
                } else if (status === "pending") setAuth("pending");
                else {
                    setAuth("signed_out");
                    setUser(null);
                    setAccount(null);
                    if (status === "expired") notice("warning", text(event.message) || "No se completó el inicio de sesión.");
                    if (status === "error") notice("error", text(event.message) || "No se pudo iniciar sesión.");
                }
                break;
            }
            case "plan:changed":
                setAccount((prev) => ({ ...prev, plan: text(event.plan) }));
                refreshAccount(true);
                break;
            case "chat:start":
                sessionId.current = text(event.sessionId) || sessionId.current;
                updateAssistant(text(event.messageId), () => ({}));
                break;
            case "chat:done": {
                const toolOnly = text(event.commandId) !== "";
                updateAssistant(text(event.messageId), (current) => ({
                    content: toolOnly && !current ? "" : text(event.content) || current,
                    streaming: false,
                    cancelled: event.cancelled === true,
                    truncated: event.truncated === true,
                }));

                if (!toolOnly || event.cancelled) {
                    setThinking(false);
                    refreshAccount();
                }
                break;
            }
            case "chat:limit":
                notice("warning", text(event.message) || "Se alcanzó un límite de la conversación.");
                setThinking(false);
                break;
            case "chat:error": {
                const code = text(event.error);
                if (code === "session_not_found") sessionId.current = null;
                notice("error", errorTexts[code] ?? `Amaya no pudo responder (${code || "error"}).`);
                setThinking(false);
                break;
            }
            case "chat:cancel:ack":
                setThinking(false);
                break;
            case "error":
                notice("error", errorTexts[text(event.error)] ?? `Error del servidor: ${text(event.error)}.`);
                setThinking(false);
                break;
            case "ai:approval":
                setItems((prev) => [...prev, {
                    kind: "approval",
                    id: nextId.current++,
                    commandId: text(event.commandId),
                    tool: text(event.tool),
                    summary: text(event.summary),
                    detail: optionalText(event.detail),
                    mutating: event.mutating === true,
                }]);
                break;
            case "ai:command":
                setTool(text(event.commandId), text(event.status) as ToolStatus, text(event.summary), optionalText(event.output));
                break;
            case "command:expired":
                setItems((prev) => withoutApproval(prev, text(event.commandId)));
                break;
            case "ai:closed":
                setThinking((current) => {
                    if (current) notice("error", "Se perdió la conexión con Amaya.");
                    return false;
                });
                break;
        }
    }, [flushText, notice, refreshAccount, setTool, updateAssistant]);

    useEffect(() => {
        const unlisten = listen<ServerEvent>("ai-event", (e) => onEvent(e.payload));
        invoke<{ signedIn: boolean; user: AiUser | null }>("ai_status")
            .then((status) => {
                setAuth(status.signedIn ? "signed_in" : "signed_out");
                setUser(status.user);
                if (status.signedIn) refreshAccount(true);
            })
            .catch(() => setAuth("signed_out"));
        return () => {
            unlisten.then((cleanup) => cleanup());
            cancelAnimationFrame(flushFrame.current);
            flushFrame.current = 0;
        };
    }, [onEvent, refreshAccount]);

    const resetConversation = useCallback(() => {
        sessionId.current = null;
        pendingText.current = new Map();
        setItems([]);
        setContext(null);
        setUsage(null);
    }, []);

    useEffect(() => {
        resetConversation();
        setThinking(false);
    }, [projectName, resetConversation]);

    const send = async (question: string, filePath?: string) => {
        const content = question.trim();
        if (!content || thinking) return;

        setItems((prev) => [...prev, { kind: "user", id: id(), content }]);
        setThinking(true);
        const withFile = filePath ? `${content}\n\n[Archivo abierto en el editor: ${filePath}]` : content;
        try {
            await invoke("ai_send", { projectName, content: withFile, sessionId: sessionId.current });
        } catch (error) {
            setThinking(false);
            if (String(error) === notSignedIn) {
                setAuth("signed_out");
                notice("warning", "Inicia sesión para usar Amaya.");
            } else {
                notice("error", String(error));
            }
        }
    };

    const stop = () => {
        if (sessionId.current) invoke("ai_cancel", { sessionId: sessionId.current }).catch((error) => notice("error", String(error)));
        setThinking(false);
    };

    const clear = () => {
        if (thinking) stop();
        resetConversation();
    };

    const login = () => invoke("ai_login").catch((error) => {
        setAuth("signed_out");
        notice("error", String(error));
    });

    const logout = () => invoke("ai_logout").catch((error) => notice("error", String(error)));

    const respond = useCallback((commandId: string, approved: boolean) => {
        setItems((prev) => withoutApproval(prev, commandId));
        invoke("ai_command_respond", { commandId, approved }).catch((error) => notice("error", String(error)));
    }, [notice]);

    return { items, thinking, auth, user, account, context, usage, send, stop, clear, login, logout, respond };
};
