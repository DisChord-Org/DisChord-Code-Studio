import { memo, type ReactNode, useState } from "react";
import type { AiItem } from "../types";
import { useCopy } from "../useCopy";
import { AmayaIcon } from "./AmayaIcon";
import { Markdown } from "./Markdown";
import { useSmoothedText } from "../useSmoothedText";

type Item<K extends AiItem["kind"]> = Extract<AiItem, { kind: K }>;

const toolIcons = {
    running: "bi-arrow-repeat animate-spin text-accent",
    success: "bi-check2 text-green-400",
    error: "bi-x-lg text-red-400",
    rejected: "bi-slash-circle text-gray-500",
};

const noticeStyles = {
    info: "text-gray-500",
    warning: "text-amber-400",
    error: "text-red-400",
};

const noticeIcons = {
    info: "bi-info-circle",
    warning: "bi-exclamation-triangle",
    error: "bi-x-circle",
};

/** Puts something of Amaya's beside her avatar when it starts her turn, or in line with her text when it follows her words. */
export const AmayaSide = ({ avatar, className = "", children }: { avatar: boolean; className?: string; children: ReactNode }) => (
    <div className={`flex gap-2.5 ${className}`}>
        {avatar ? <AmayaIcon size={24} className="mt-0.5 self-start" /> : <span className="w-6 shrink-0" aria-hidden="true" />}
        <div className="min-w-0 flex-1">{children}</div>
    </div>
);

/** What the user wrote: a bubble on the right, as in a chat between two people. */
export const UserRow = memo(({ item }: { item: Item<"user"> }) => (
    <div className="ai-enter flex justify-end">
        <div className="max-w-[85%] select-text whitespace-pre-wrap break-words rounded-xl rounded-tr-sm border border-border-strong bg-white/[0.05] px-3 py-2 text-[13px] leading-relaxed text-gray-100">
            {item.content}
        </div>
    </div>
));

const CopyButton = ({ text }: { text: string }) => {
    const { copied, copy } = useCopy(() => text);

    return (
        <button
            type="button"
            title="Copiar respuesta"
            onClick={() => void copy()}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-gray-500 opacity-0 transition-all hover:bg-white/[0.06] hover:text-white focus-visible:opacity-100 group-hover:opacity-100"
        >
            <i className={`bi ${copied ? "bi-check2 text-green-400" : "bi-clipboard"}`} aria-hidden="true"></i>
            {copied ? "Copiado" : "Copiar"}
        </button>
    );
};

interface AssistantRowProps {
    item: Item<"assistant">;
    onContinue: () => void;
}

/** What Amaya answered: her avatar on the left and the text beside it, written as it arrives. */
export const AssistantRow = memo(({ item, onContinue }: AssistantRowProps) => {
    const { shown, typing } = useSmoothedText(item.content, item.streaming);
    const writing = item.streaming || typing;

    if (!item.content && !item.streaming) return null;

    return (
        <AmayaSide avatar className="ai-enter group">
            <div className="pt-0.5">
                {shown && <Markdown>{shown}</Markdown>}
                {item.streaming && !item.content && <span className="ai-thinking text-[13px] leading-relaxed" role="status">Pensando…</span>}
                {writing && shown && <span className="-mb-0.5 ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-gray-500" aria-hidden="true" />}
            </div>
            {item.cancelled && !writing && <p className="mt-1 text-xs italic text-gray-500">Generación cancelada</p>}
            {item.truncated && !writing && (
                <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                    <span>Respuesta cortada por límite de salida</span>
                    <button type="button" onClick={onContinue} className="rounded border border-border px-2 py-0.5 text-gray-400 transition-colors hover:bg-white/[0.06] hover:text-white">
                        Continuar
                    </button>
                </div>
            )}
            {!writing && /\S/.test(item.content) && (
                <div className="mt-1 flex h-5 items-center">
                    <CopyButton text={item.content} />
                </div>
            )}
        </AmayaSide>
    );
});

interface ToolRowProps {
    item: Item<"tool">;
    /** Whether this line starts Amaya's turn, and so carries her avatar. */
    avatar: boolean;
}

/** One thing Amaya did to the project; its output opens on click. */
export const ToolRow = memo(({ item, avatar }: ToolRowProps) => {
    const [open, setOpen] = useState(false);
    const canOpen = !!item.output && item.status !== "running";

    return (
        <AmayaSide avatar={avatar}>
            <button
                type="button"
                disabled={!canOpen}
                onClick={() => setOpen((v) => !v)}
                aria-expanded={canOpen ? open : undefined}
                className="flex w-full items-center gap-2 rounded-md bg-white/[0.04] px-2 py-1 text-left text-xs text-gray-500 transition-colors enabled:hover:bg-white/[0.07] enabled:hover:text-gray-300"
            >
                <i className={`bi ${toolIcons[item.status]} text-[11px]`} aria-hidden="true"></i>
                <span className="truncate" style={{ fontFamily: "var(--editor-font-family, monospace)" }}>{item.summary || "…"}</span>
                {canOpen && <i className={`bi ${open ? "bi-chevron-up" : "bi-chevron-down"} ml-auto text-[10px]`} aria-hidden="true"></i>}
            </button>
            {open && item.output && (
                <pre
                    className="custom-scrollbar mt-1.5 max-h-48 overflow-auto rounded-md border border-border bg-app-bg p-2 text-[11px] text-gray-400"
                    style={{ fontFamily: "var(--editor-font-family, monospace)" }}
                >{item.output}</pre>
            )}
        </AmayaSide>
    );
});

/** A note from the system, in the middle of the conversation. */
export const NoticeRow = memo(({ item }: { item: Item<"notice"> }) => (
    <p role={item.tone === "error" ? "alert" : "status"} className={`flex items-start justify-center gap-2 px-2 text-center text-xs ${noticeStyles[item.tone]}`}>
        <i className={`bi ${noticeIcons[item.tone]} mt-px`} aria-hidden="true"></i>
        <span className="min-w-0 break-words">{item.text}</span>
    </p>
));

export const ThinkingRow = () => (
    <AmayaSide avatar className="ai-enter">
        <span className="ai-thinking inline-block pt-0.5 text-[13px] leading-relaxed" role="status">Pensando…</span>
    </AmayaSide>
);
