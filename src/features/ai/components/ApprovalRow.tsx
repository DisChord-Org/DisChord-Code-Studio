import { memo, useEffect, useRef } from "react";
import { Button } from "../../../components/ui";
import type { AiItem } from "../types";
import { AmayaSide } from "./AiMessageRow";

interface ApprovalRowProps {
    item: Extract<AiItem, { kind: "approval" }>;
    /** Whether this card starts Amaya's turn, and so carries her avatar. */
    avatar: boolean;
    onRespond: (commandId: string, approved: boolean) => void;
}

const titles: Record<string, string> = {
    run_command: "Ejecutar un comando",
    write_file: "Escribir un archivo",
    edit_file: "Editar un archivo",
};

/** A tool call the assistant wants to run, waiting for the user's yes or no. */
export const ApprovalRow = memo(({ item, avatar, onRespond }: ApprovalRowProps) => {
    // The safe answer is the one under the keyboard.
    const buttons = useRef<HTMLDivElement>(null);
    useEffect(() => {
        buttons.current?.querySelector("button")?.focus();
    }, []);

    return (
        <AmayaSide avatar={avatar}>
        <div className="rounded-md border border-border bg-app-bg" role="group" aria-label={titles[item.tool] ?? "Permiso de Amaya"}>
            <div className="flex flex-col gap-2 px-3 py-2">
                <p className="break-all text-xs text-gray-200" style={{ fontFamily: "var(--editor-font-family, monospace)" }}>{item.summary}</p>
                {item.detail && (
                    <pre
                        className="custom-scrollbar max-h-40 overflow-auto whitespace-pre-wrap break-all rounded bg-white/[0.03] p-2 text-[11px] text-gray-400"
                        style={{ fontFamily: "var(--editor-font-family, monospace)" }}
                    >{item.detail}</pre>
                )}
                <div ref={buttons} className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => onRespond(item.commandId, false)}>Rechazar</Button>
                    <button
                        type="button"
                        onClick={() => onRespond(item.commandId, true)}
                        className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-hover"
                    >
                        Aprobar
                    </button>
                </div>
            </div>
        </div>
        </AmayaSide>
    );
});
