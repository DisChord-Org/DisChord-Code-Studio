import { Children, isValidElement, memo, type ReactElement, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { openUrl } from "@tauri-apps/plugin-opener";
import { notify } from "../../../utils/Toasts";
import { safeUrl } from "../safeUrl";
import { describeLanguage } from "../languages";
import { useCopy } from "../useCopy";
import { applyCode } from "../../editor/components/canvas/activeEditor";
import { FileIcon } from "../../editor/components/FileIcon";

const codeFont = { fontFamily: "var(--editor-font-family, monospace)" };

const flattenText = (node: ReactNode): string => {
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map(flattenText).join("");
    if (isValidElement<{ children?: ReactNode }>(node)) return flattenText(node.props.children);
    return "";
};

/** The text of a code block, without the line break the parser leaves at its end. */
const codeOf = (children: ReactNode) => flattenText(children).replace(/\n$/, "");

const actionClass = "flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors hover:bg-white/[0.06] hover:text-accent";

const openLink = (url: string) => {
    openUrl(url).catch((error) => notify("error", "No se pudo abrir el enlace.", [String(error)]));
};

const CodeBlock = ({ language, className, children }: { language: string; className?: string; children: ReactNode }) => {
    const { copied, copy } = useCopy(() => codeOf(children));

    const { label, fileName } = describeLanguage(language);

    return (
        <div className="my-2 overflow-hidden rounded-md border border-border bg-app-bg">
            <div className="flex items-center justify-between border-b border-border px-2.5 py-1 text-[11px] text-gray-500">
                <span className="flex items-center gap-1.5 font-medium text-gray-400">
                    <FileIcon name={fileName} size={14} />
                    {label}
                </span>
                <div className="flex items-center gap-1">
                    <button type="button" title="Insertar en el editor, después del cursor" onClick={() => applyCode(codeOf(children), "insert")} className={actionClass}>
                        <i className="bi bi-box-arrow-in-down" aria-hidden="true"></i>
                        Insertar
                    </button>
                    <button type="button" title="Reemplazar el texto seleccionado en el editor" onClick={() => applyCode(codeOf(children), "replace")} className={actionClass}>
                        <i className="bi bi-arrow-left-right" aria-hidden="true"></i>
                        Reemplazar
                    </button>
                    <button type="button" onClick={() => void copy()} className={actionClass}>
                        <i className={`bi ${copied ? "bi-check2 text-green-400" : "bi-clipboard"}`} aria-hidden="true"></i>
                        {copied ? "Copiado" : "Copiar"}
                    </button>
                </div>
            </div>
            <pre className="custom-scrollbar overflow-x-auto p-2.5 text-xs leading-relaxed" style={codeFont}>
                <code className={className}>{children}</code>
            </pre>
        </div>
    );
};

const components: Components = {
    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
    h1: ({ children }) => <h1 className="mb-2 mt-4 border-b border-border pb-1.5 text-base font-semibold text-white first:mt-0">{children}</h1>,
    h2: ({ children }) => <h2 className="mb-1.5 mt-3.5 text-sm font-semibold text-white first:mt-0">{children}</h2>,
    h3: ({ children }) => <h3 className="mb-1 mt-3 text-[13px] font-semibold text-white first:mt-0">{children}</h3>,
    h4: ({ children }) => <h4 className="mb-1 mt-3 text-[11px] font-bold uppercase tracking-widest text-gray-500 first:mt-0">{children}</h4>,
    ul: ({ children }) => <ul className="mb-2 list-disc space-y-0.5 pl-5 marker:text-accent last:mb-0">{children}</ul>,
    ol: ({ children }) => <ol className="mb-2 list-decimal space-y-0.5 pl-5 marker:text-accent last:mb-0">{children}</ol>,
    li: ({ children }) => <li className="pl-0.5">{children}</li>,
    blockquote: ({ children }) => <blockquote className="my-2 border-l-2 border-border-strong pl-3 text-gray-400 [&>p]:mb-1 last:[&>p]:mb-0">{children}</blockquote>,
    hr: () => <hr className="my-3 border-border" />,
    strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    del: ({ children }) => <del className="text-gray-500">{children}</del>,
    a: ({ href, children }) => {
        const safe = safeUrl(href);
        if (!safe) return <span>{children}</span>;
        return (
            <a
                href={safe}
                onClick={(e) => {
                    e.preventDefault();
                    openLink(safe);
                }}
                className="cursor-pointer text-accent-light underline decoration-accent/40 underline-offset-2 transition-colors hover:text-white"
            >
                {children}
            </a>
        );
    },

    img: ({ src, alt }) => {
        const safe = safeUrl(src);
        return safe ? (
            <a href={safe} onClick={(e) => { e.preventDefault(); openLink(safe); }} className="cursor-pointer text-accent-light underline underline-offset-2">
                {`[imagen: ${alt ?? ""}]`}
            </a>
        ) : <span>{`[imagen: ${alt ?? ""}]`}</span>;
    },
    table: ({ children }) => (
        <div className="custom-scrollbar my-2 overflow-x-auto rounded-md border border-border">
            <table className="w-full border-collapse text-left text-xs">{children}</table>
        </div>
    ),
    thead: ({ children }) => <thead className="bg-white/[0.04]">{children}</thead>,
    th: ({ children }) => <th className="px-2.5 py-1.5 text-[11px] font-medium text-gray-400">{children}</th>,
    td: ({ children }) => <td className="border-t border-border px-2.5 py-1.5 align-top">{children}</td>,
    input: ({ checked }) => <input type="checkbox" checked={checked} disabled readOnly className="mr-2 translate-y-px accent-[var(--color-accent)]" />,
    pre: ({ children }) => {
        const child = Children.only(children) as ReactElement<{ className?: string; children?: ReactNode }>;
        const className = child.props.className ?? "";
        return (
            <CodeBlock language={/language-([\w-]+)/.exec(className)?.[1] ?? ""} className={className}>
                {child.props.children}
            </CodeBlock>
        );
    },
    code: ({ className, children }) =>
        className ? (
            <code className={className}>{children}</code>
        ) : (
            <code className="rounded border border-border bg-white/[0.05] px-1 py-px text-[0.9em] text-accent-light" style={codeFont}>{children}</code>
        ),
};

const cleanUrl = (url: string) => safeUrl(url) ?? "";
const remarkPlugins = [remarkGfm];
const rehypePlugins: React.ComponentProps<typeof ReactMarkdown>["rehypePlugins"] = [[rehypeHighlight, { detect: false }]];

export const Markdown = memo(function Markdown({ children }: { children: string }) {
    return (
        <div className="min-w-0 select-text text-[13px] leading-relaxed text-gray-300 [overflow-wrap:anywhere]">
            <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={components} urlTransform={cleanUrl}>
                {children}
            </ReactMarkdown>
        </div>
    );
});
