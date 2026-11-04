import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Tooltip } from "../../../components/ui";
import { FileIcon } from "../../editor/components/FileIcon";
import { mentionAt, useMentions } from "../useMentions";

const maxHeightPx = 140;

/** Commands written in the box with a `/`. */
export type SlashCommand = "compact" | "context" | "usage";

const slashCommands: Array<{ id: SlashCommand; name: string; description: string; icon: string }> = [
    { id: "compact", name: "/compact", description: "Resume la conversación para liberar contexto", icon: "bi-arrows-collapse" },
    { id: "context", name: "/context", description: "Cuánto contexto usa la conversación", icon: "bi-bar-chart" },
    { id: "usage", name: "/usage", description: "El consumo de tu plan", icon: "bi-speedometer2" },
];

/** One line of the menu above the box: a file to mention, or a command. */
interface Choice {
    key: string;
    label: string;
    detail?: string;
    icon: ReactNode;
    apply: () => void;
}

interface AiComposerProps {
    projectName: string;
    /** The open file the question can be sent with. */
    fileName?: string;
    thinking: boolean;
    disabled?: boolean;
    /** Shown by the send button, e.g. the context bar. */
    meter?: ReactNode;
    /** Text to put in the box (a suggestion that was picked); the nonce lets the same text be picked twice. */
    draft?: { text: string; nonce: number };
    /** `files` are the project files the question names with `@`. */
    onSend: (text: string, withFile: boolean, files: string[]) => void;
    onStop: () => void;
    /** A command written in the box (`/compact`…) asks for this instead of being sent as a question. */
    onCommand: (command: SlashCommand) => void;
}

export const AiComposer = ({ projectName, fileName, thinking, disabled = false, meter, draft, onSend, onStop, onCommand }: AiComposerProps) => {
    const [text, setText] = useState("");
    const [withFile, setWithFile] = useState(true);
    const box = useRef<HTMLTextAreaElement>(null);
    const { load, options, mentioned } = useMentions(projectName);
    const [caret, setCaret] = useState(0);
    const [active, setActive] = useState(0);
    const [closed, setClosed] = useState<string | null>(null);
    const pendingCaret = useRef<number | null>(null);

    const mention = disabled ? null : mentionAt(text, caret);
    const slash = !disabled && /^\/[a-z]*$/i.test(text) ? text.toLowerCase() : null;
    useEffect(() => {
        if (mention) load();
    }, [mention?.start, load]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => setActive(0), [mention?.query, slash]);

    useLayoutEffect(() => {
        if (pendingCaret.current === null || !box.current) return;
        box.current.setSelectionRange(pendingCaret.current, pendingCaret.current);
        setCaret(pendingCaret.current);
        pendingCaret.current = null;
    }, [text]);

    const pick = (path: string) => {
        if (!mention) return;
        const end = mention.start + 1 + mention.query.length;
        const inserted = `@${path} `;
        setText(text.slice(0, mention.start) + inserted + text.slice(end));
        pendingCaret.current = mention.start + inserted.length;
    };

    useEffect(() => {
        if (!draft) return;
        setText(draft.text);
        box.current?.focus();
    }, [draft]);

    useEffect(() => {
        const element = box.current;
        if (!element) return;
        element.style.height = "auto";
        element.style.height = `${Math.min(element.scrollHeight, maxHeightPx)}px`;
    }, [text]);

    const runCommand = (command: SlashCommand) => {
        setText("");
        onCommand(command);
    };

    const trigger = slash !== null ? "/" : mention ? `@${mention.start}` : null;
    const choices: Choice[] = trigger === null || trigger === closed
        ? []
        : slash !== null
            ? slashCommands.filter((c) => c.name.startsWith(slash)).map((c) => ({
                key: c.name,
                label: c.name,
                detail: c.description,
                icon: <i className={`bi ${c.icon} text-[13px] text-gray-500`} aria-hidden="true"></i>,
                apply: () => runCommand(c.id),
            }))
            : options(mention?.query ?? "").map((path) => ({
                key: path,
                label: path,
                icon: <FileIcon name={path.slice(path.lastIndexOf("/") + 1)} size={13} />,
                apply: () => pick(path),
            }));

    const submit = () => {
        if (!text.trim() || thinking || disabled) return;
        const command = slashCommands.find((c) => c.name === text.trim().toLowerCase());
        if (command) {
            runCommand(command.id);
            return;
        }
        onSend(text, withFile && !!fileName, mentioned(text));
        setText("");
    };

    return (
        <div className="relative shrink-0 p-2">
            <div className="rounded-md border border-border bg-app-bg transition-colors focus-within:border-accent/60">
                {choices.length > 0 && (
                    <ul role="listbox" aria-label="Sugerencias" className="custom-scrollbar absolute inset-x-2 bottom-full z-30 mb-1 max-h-56 overflow-y-auto rounded-md border border-border bg-panel-alt py-1 shadow-lg">
                        {choices.map((choice, index) => (
                            <li key={choice.key} role="option" aria-selected={index === active}>
                                <button
                                    type="button"
                                    // The box keeps the focus: the choice is made without taking it away.
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={choice.apply}
                                    onMouseEnter={() => setActive(index)}
                                    className={`flex w-full items-center gap-2 px-2.5 py-1 text-left text-xs transition-colors ${index === active ? "bg-white/[0.08] text-white" : "text-gray-400"}`}
                                >
                                    {choice.icon}
                                    <span className="truncate">{choice.label}</span>
                                    {choice.detail && <span className="ml-auto truncate pl-3 text-[11px] text-gray-500">{choice.detail}</span>}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}

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
                    onChange={(e) => {
                        setText(e.target.value);
                        setCaret(e.target.selectionStart);
                        setClosed(null);
                    }}
                    onKeyUp={(e) => setCaret(e.currentTarget.selectionStart)}
                    onClick={(e) => setCaret(e.currentTarget.selectionStart)}
                    onKeyDown={(e) => {
                        if (choices.length > 0) {
                            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                                e.preventDefault();
                                setActive((i) => (i + (e.key === "ArrowDown" ? 1 : choices.length - 1)) % choices.length);
                                return;
                            }
                            if (e.key === "Enter" || e.key === "Tab") {
                                e.preventDefault();
                                choices[active].apply();
                                return;
                            }
                            if (e.key === "Escape") {
                                e.preventDefault();
                                e.stopPropagation();
                                setClosed(trigger);
                                return;
                            }
                        }
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
