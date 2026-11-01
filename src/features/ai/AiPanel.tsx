import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Tooltip } from "../../components/ui";
import { useResizablePanel } from "../editor/useResizablePanel";
import { AiComposer } from "./components/AiComposer";
import { AiEmptyState } from "./components/AiEmptyState";
import { AmayaIcon } from "./components/AmayaIcon";
import { ContextMeter } from "./components/ContextMeter";
import { PlanMeter } from "./components/PlanMeter";
import { UserBadge } from "./components/UserBadge";
import { AiSignIn } from "./components/AiSignIn";
import { ApprovalRow } from "./components/ApprovalRow";
import { AssistantRow, NoticeRow, ThinkingRow, ToolRow, UserRow } from "./components/AiMessageRow";
import { useAiChat } from "./useAiChat";
import type { AiItem } from "./types";

const panelSize = { initial: 380, min: 300, max: 640 };
const nearBottomPx = 80;

interface AiPanelProps {
    projectName: string;
    file?: {
        name: string;
        path: string
    };
    onClose: () => void;
}

const isHidden = (item: AiItem) => item.kind === "assistant" && !item.content && !item.streaming;

const startsTurn = (previous: AiItem | undefined) => !previous || previous.kind === "user" || previous.kind === "notice";

const renderItem = (item: AiItem, avatar: boolean, respond: (commandId: string, approved: boolean) => void, onContinue: () => void) => {
    switch (item.kind) {
        case "user": return <UserRow key={item.id} item={item} />;
        case "assistant": return <AssistantRow key={item.id} item={item} onContinue={onContinue} />;
        case "tool": return <ToolRow key={item.id} item={item} avatar={avatar} />;
        case "notice": return <NoticeRow key={item.id} item={item} />;
        case "approval": return <ApprovalRow key={item.id} item={item} avatar={avatar} onRespond={respond} />;
    }
};

const headerButton = "flex h-5 w-5 items-center justify-center rounded text-gray-500 transition-colors hover:text-accent disabled:opacity-30 disabled:hover:text-gray-500";

export const AiPanel = ({ projectName, file, onClose }: AiPanelProps) => {
    const { items, thinking, auth, user, account, context, usage, send, stop, clear, login, logout, respond } = useAiChat(projectName);
    const sendRef = useRef(send);
    sendRef.current = send;
    const onContinue = useCallback(() => void sendRef.current("continúa"), []);
    const { size: width, startDrag } = useResizablePanel({ initialSize: panelSize.initial, min: panelSize.min, max: panelSize.max, axis: "x", invert: true });
    const [draft, setDraft] = useState<{ text: string; nonce: number }>();
    const list = useRef<HTMLDivElement>(null);
    const followsEnd = useRef(true);

    const content = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const outer = list.current;
        const inner = content.current;
        if (!outer || !inner) return;

        const observer = new ResizeObserver(() => {
            if (followsEnd.current) outer.scrollTop = outer.scrollHeight;
        });
        observer.observe(inner);
        return () => observer.disconnect();
    }, []);

    const onScroll = () => {
        const element = list.current;
        if (element) followsEnd.current = element.scrollHeight - element.scrollTop - element.clientHeight < nearBottomPx;
    };

    const signedIn = auth === "signed_in";
    const answering = items.some((item) => item.kind === "assistant" && item.streaming);
    const busyWithTool = items.some((item) => item.kind === "approval" || (item.kind === "tool" && item.status === "running"));
    const shown = useMemo(() => {
        const visible = items.filter((item) => !isHidden(item));
        return visible.map((item, index) => ({ item, avatar: startsTurn(visible[index - 1]) }));
    }, [items]);
    const empty = items.length === 0;

    return (
        <aside
            aria-label="Amaya"
            className="relative z-10 flex shrink-0 flex-col bg-panel-alt shadow-[-1px_0_3px_0_rgba(0,0,0,0.35)]"
            style={{ width }}
            onKeyDown={(e) => {
                if (e.key === "Escape") {
                    e.stopPropagation();
                    onClose();
                }
            }}
        >
            <div
                onMouseDown={startDrag}
                className="absolute left-0 top-0 z-20 h-full w-1 -translate-x-1/2 cursor-col-resize transition-colors hover:bg-accent/50 active:bg-accent"
            />

            <header className="flex shrink-0 items-center gap-1 px-3 pt-3 pb-1.5 select-none">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                    {signedIn ? (
                        <UserBadge user={user} account={account} />
                    ) : (
                        <>
                            <AmayaIcon size={16} />
                            <span className="text-xs font-semibold text-gray-200">Amaya</span>
                        </>
                    )}
                </div>
                {signedIn && (
                    <Tooltip label={user?.discordUsername ? `Cerrar sesión (${user.discordUsername})` : "Cerrar sesión"} placement="bottom" align="end">
                        <button type="button" onClick={() => void logout()} aria-label="Cerrar sesión" className={headerButton}>
                            <i className="bi bi-box-arrow-right text-[13px]" aria-hidden="true"></i>
                        </button>
                    </Tooltip>
                )}
                <Tooltip label="Nueva conversación" placement="bottom" align="end">
                    <button type="button" onClick={clear} disabled={empty && !thinking} aria-label="Nueva conversación" className={headerButton}>
                        <i className="bi bi-plus-lg text-[13px]" aria-hidden="true"></i>
                    </button>
                </Tooltip>
                <Tooltip label="Cerrar (Esc)" placement="bottom" align="end">
                    <button type="button" onClick={onClose} aria-label="Cerrar Amaya" className={`${headerButton} hover:text-white`}>
                        <i className="bi bi-x-lg text-[11px]" aria-hidden="true"></i>
                    </button>
                </Tooltip>
            </header>

            <div ref={list} onScroll={onScroll} className="custom-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto">
                <div ref={content} className="flex flex-1 flex-col">
                    {!signedIn ? (
                        <AiSignIn auth={auth} onLogin={() => void login()} />
                    ) : empty ? (
                        <AiEmptyState onPick={(text) => setDraft({ text, nonce: Date.now() })} />
                    ) : (
                        <div className="flex flex-col gap-4 px-3 py-2">
                            {shown.map(({ item, avatar }) => renderItem(item, avatar, respond, onContinue))}
                            {thinking && !busyWithTool && !answering && <ThinkingRow />}
                        </div>
                    )}
                </div>
            </div>

            <AiComposer
                fileName={file?.name}
                thinking={thinking}
                disabled={!signedIn}
                meter={signedIn && (
                    <>
                        <ContextMeter context={context} usage={usage} account={account} />
                        <PlanMeter account={account} />
                    </>
                )}
                draft={draft}
                onSend={(text, withFile) => {
                    followsEnd.current = true;
                    void send(text, withFile ? file?.path : undefined);
                }}
                onStop={stop}
            />
        </aside>
    );
};
