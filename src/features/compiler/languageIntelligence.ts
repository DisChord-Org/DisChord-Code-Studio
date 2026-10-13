import { EditorSelection, type Extension, type Text } from "@codemirror/state";
import { EditorView, ViewPlugin, hoverTooltip, type Tooltip, type ViewUpdate } from "@codemirror/view";
import { getCorelib } from "../../languages/chord-corelib";
import { memberSuggestion, receiverClasses } from "../../languages/completion/sources/members";
import {
    clearFileDeclarations,
    fetchDeclarations,
    getFileDeclarations,
    localDeclarations,
    setFileDeclarations,
    type Declaration,
} from "./declarations";

const offsetOf = (doc: Text, position: { line: number; column: number }) => {
    const line = doc.line(Math.min(Math.max(position.line, 1), doc.lines));
    return line.from + Math.min(position.column - 1, line.length);
};

const declarationsPlugin = (projectName: string, filePath: string) =>
    ViewPlugin.fromClass(class {
        local: ReturnType<typeof setTimeout> | undefined;
        compiler: ReturnType<typeof setTimeout> | undefined;

        constructor(view: EditorView) {
            this.refresh(view, 0);
        }

        update(update: ViewUpdate) {
            if (update.docChanged) this.refresh(update.view, 150);
        }

        refresh(view: EditorView, delay: number) {
            clearTimeout(this.local);
            clearTimeout(this.compiler);

            this.local = setTimeout(() => {
                setFileDeclarations(filePath, { items: localDeclarations(view.state.doc.toString()), source: "local" });
            }, delay);

            this.compiler = setTimeout(async () => {
                const text = view.state.doc.toString();
                const items = await fetchDeclarations(projectName, filePath, text);

                if (items && view.state.doc.toString() === text) setFileDeclarations(filePath, { items, source: "compiler" });
            }, Math.max(delay, 700));
        }

        destroy() {
            clearTimeout(this.local);
            clearTimeout(this.compiler);
            clearFileDeclarations(filePath);
        }
    });

const wordAt = (view: EditorView, pos: number): { from: number; to: number; text: string } | null => {
    const range = view.state.wordAt(pos);
    if (!range) return null;

    const text = view.state.sliceDoc(range.from, range.to);
    return /[\w@À-ɏ]+/.test(text) ? { from: range.from, to: range.to, text } : null;
};

export const definitionOf = (view: EditorView, filePath: string, word: { from: number; to: number; text: string }): Declaration | null => {
    const items = getFileDeclarations(filePath)?.items ?? [];
    const doc = view.state.doc;

    const candidates = items
        .filter((d) => d.name === word.text)
        .map((d) => ({ d, at: offsetOf(doc, d.start) }))
        .filter(({ at }) => at !== word.from);

    if (candidates.length === 0) return null;

    const before = candidates.filter(({ at }) => at < word.from).sort((a, b) => b.at - a.at);
    return (before[0] ?? candidates[0]).d;
};

export const goToDefinition = (view: EditorView, filePath: string, pos = view.state.selection.main.head): boolean => {
    const word = wordAt(view, pos);
    if (!word) return false;

    const target = definitionOf(view, filePath, word);
    if (!target) return false;

    const at = offsetOf(view.state.doc, target.start);
    view.dispatch({
        selection: EditorSelection.single(at, offsetOf(view.state.doc, target.end)),
        effects: EditorView.scrollIntoView(at, { y: "center" }),
    });
    view.focus();
    return true;
};

const kindLabels: Record<string, string> = {
    variable: "variable",
    function: "función",
    method: "método",
    constructor: "constructor",
    class: "clase",
    property: "propiedad",
    parameter: "parámetro",
    import: "importado",
    command: "comando",
    event: "evento",
    button: "botón",
    embed: "embed",
};

const card = (build: (root: HTMLElement) => void): { dom: HTMLElement } => {
    const dom = document.createElement("div");
    dom.className = "cm-intel";
    build(dom);
    return { dom };
};

const line = (root: HTMLElement, className: string, text: string) => {
    const element = document.createElement("div");
    element.className = className;
    element.textContent = text;
    root.appendChild(element);
};

const describeDeclaration = (view: EditorView, filePath: string, declaration: Declaration) => card((root) => {
    line(root, "cm-intel-title", `${kindLabels[declaration.kind] ?? declaration.kind} ${declaration.name}`);

    const where = [`línea ${declaration.start.line}`, declaration.container ? `en ${declaration.container}` : ""].filter(Boolean);
    line(root, "cm-intel-meta", where.join(" · "));

    const source = view.state.doc.line(Math.min(declaration.start.line, view.state.doc.lines)).text.trim();
    if (source) line(root, "cm-intel-code", source);

    void filePath;
});

const hover = (filePath: string) => hoverTooltip((view, pos): Tooltip | null => {
    const word = wordAt(view, pos);
    if (!word) return null;

    const text = view.state.doc.toString();
    const corelib = getCorelib();

    if (text[word.from - 1] === "." && corelib) {
        const classes = receiverClasses(text, word.from - 1, corelib);
        for (const klass of classes ?? []) {
            const method = klass.methods.find((m) => m.name === word.text);
            const property = klass.properties.find((p) => p.name === word.text);
            const member = method ?? property;
            if (!member) continue;

            const suggestion = memberSuggestion(member, klass.name, !!method);
            return {
                pos: word.from,
                end: word.to,
                above: true,
                create: () => card((root) => {
                    line(root, "cm-intel-title", `${klass.name}.${member.name}`);
                    line(root, "cm-intel-code", `${suggestion.detail ?? ""}`);
                    if (member.doc) line(root, "cm-intel-doc", member.doc);
                }),
            };
        }
    }

    const items = getFileDeclarations(filePath)?.items ?? [];
    const here = items.find((d) => d.name === word.text && offsetOf(view.state.doc, d.start) === word.from);
    const declaration = here ?? definitionOf(view, filePath, word);
    if (declaration) {
        return {
            pos: word.from,
            end: word.to,
            above: true,
            create: () => describeDeclaration(view, filePath, declaration)
        };
    }

    const klass = corelib?.classes.find((c) => c.name === word.text);

    if (klass) {
        return {
            pos: word.from,
            end: word.to,
            above: true,
            create: () => card((root) => {
                line(root, "cm-intel-title", `clase ${klass.name}`);
                line(root, "cm-intel-meta", `${klass.methods.length} métodos · ${klass.properties.length} propiedades`);
            }),
        };
    }

    return null;
});

const intelTheme = EditorView.theme({
    ".cm-tooltip:has(> .cm-intel)": {
        backgroundColor: "#12151c !important",
        border: "1px solid rgba(255, 255, 255, 0.08) !important",
        borderRadius: "10px",
        boxShadow: "0 10px 30px -8px rgba(0, 0, 0, 0.65)",
        overflow: "hidden",
        maxWidth: "440px",
    },
    ".cm-intel": {
        padding: "9px 13px",
        fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
        fontSize: "12px",
        lineHeight: "1.5",
        color: "#e5e7eb",
    },
    ".cm-intel-title": {
        fontWeight: "600",
        color: "#f3f4f6"
    },
    ".cm-intel-meta": {
        fontSize: "10px",
        letterSpacing: "0.04em",
        color: "#6b7280",
        marginTop: "1px"
    },
    ".cm-intel-code": {
        marginTop: "6px",
        padding: "4px 8px",
        borderRadius: "5px",
        backgroundColor: "rgba(255, 255, 255, 0.05)",
        fontFamily: "var(--editor-font-family, monospace)",
        fontSize: "11px",
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
    },
    ".cm-intel-doc": {
        marginTop: "6px",
        color: "#9ca3af"
    },
}, { dark: true });

export const languageIntelligence = (projectName: string, filePath: string): Extension => [
    declarationsPlugin(projectName, filePath),
    hover(filePath),
    intelTheme,
    EditorView.domEventHandlers({
        mousedown: (event, view) => {
            if (!(event.ctrlKey || event.metaKey) || event.button !== 0) return false;

            const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
            if (pos === null || !goToDefinition(view, filePath, pos)) return false;

            event.preventDefault();
            return true;
        },
    }),
];
