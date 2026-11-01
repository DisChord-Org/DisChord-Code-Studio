import { useEffect, useRef, useState, type ReactNode } from "react";
import { Tooltip } from "../../../components/ui";

const maxHeightPx = 140;

interface AiComposerProps {
    /** The open file the question can be sent with. */
    fileName?: string;
    thinking: boolean;
    disabled?: boolean;
    /** Shown by the send button, e.g. the context bar. */
    meter?: ReactNode;
    /** Text to put in the box (a suggestion that was picked); the nonce lets the same text be picked twice. */
    draft?: { text: string; nonce: number };
    onSend: (text: string, withFile: boolean) => void;
    onStop: () => void;
}

export const AiComposer = ({ fileName, thinking, disabled = false, meter, draft, onSend, onStop }: AiComposerProps) => {
    const [text, setText] = useState("");
    const [withFile, setWithFile] = useState(true);
    const box = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (!draft) return;
        setText(draft.text);
        box.current?.focus();
    }, [draft]);

    // The box grows with what is typed, up to a limit.
    useEffect(() => {
        const element = box.current;
        if (!element) return;
        element.style.height = "auto";
        element.style.height = `${Math.min(element.scrollHeight, maxHeightPx)}px`;
    }, [text]);

    const submit = () => {
        if (!text.trim() || thinking || disabled) return;
        onSend(text, withFile && !!fileName);
        setText("");
    };

    return (
        <div className="shrink-0 p-2">
            <div className="rounded-md border border-border bg-app-bg transition-colors focus-within:border-accent/60">
                {fileName && (
                    <div className="flex items-center gap-1.5 px-2.5 pt-2">
                        <button
                            type="button"
                            aria-pressed={withFile}
                            onClick={() => setWithFile((on) => !on)}
                            title={withFile ? "Se enviará este archivo como contexto" : "El archivo no se enviará"}
                            className={`flex max-w-full items-center gap-1.5 rounded border px-1.5 py-0.5 text-[11px] transition-colors ${
                                withFile ? "border-accent/40 bg-accent/15 text-accent-light" : "border-border text-gray-500 line-through hover:text-gray-300"
                            }`}
                        >
                            <i className="bi bi-file-earmark-code" aria-hidden="true"></i>
                            <span className="truncate">{fileName}</span>
                        </button>
                    </div>
                )}

                <textarea
                    ref={box}
                    value={text}
                    rows={1}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                            e.preventDefault();
                            submit();
                        }
                    }}
                    placeholder={disabled ? "Inicia sesión para escribir…" : "Escribe tu pregunta…"}
                    disabled={disabled}
                    aria-label="Mensaje para Amaya"
                    className="custom-scrollbar block w-full resize-none bg-transparent px-2.5 py-2 text-[13px] text-white outline-none placeholder:text-gray-600"
                />

                <div className="flex items-center gap-3 px-2.5 pb-2">
                    <div className="flex min-w-0 flex-1 items-center gap-3">{meter}</div>
                    {thinking ? (
                        <Tooltip label="Detener" placement="top" align="end">
                            <button
                                type="button"
                                onClick={onStop}
                                aria-label="Detener"
                                className="flex h-6 w-6 items-center justify-center rounded bg-white/10 text-gray-200 transition-colors hover:bg-white/20"
                            >
                                <i className="bi bi-stop-fill text-xs" aria-hidden="true"></i>
                            </button>
                        </Tooltip>
                    ) : (
                        <Tooltip label="Enviar" placement="top" align="end">
                            <button
                                type="button"
                                onClick={submit}
                                disabled={!text.trim() || disabled}
                                aria-label="Enviar"
                                className="flex h-6 w-6 items-center justify-center rounded bg-accent text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                <i className="bi bi-arrow-up text-sm" aria-hidden="true"></i>
                            </button>
                        </Tooltip>
                    )}
                </div>
            </div>
        </div>
    );
};
