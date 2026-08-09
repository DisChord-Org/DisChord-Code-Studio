import { completeFromList, snippetCompletion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { CHORD_KEYWORDS, CHORD_CONTROL_FLOW, CHORD_BUILTINS, CHORD_ATOMS } from "./chord-language";

const completions = [
    "clase", "extiende", "prop", "fijar", "esta", "super", "nuevo", "devolver",
    "var", "es", "funcion", "si", "sino", "para", "en", "importar", "exportar",
    "verdadero", "falso", "imprimir", "@asincrono"
].map(word => ({ label: word, type: "keyword" }));

const snippets = [
    snippetCompletion('encender bot {\n\ttoken: "${token}",\n\tprefijo: "!",\n\tintenciones: [ "Servidores" ]\n}', {
        label: "encender bot",
        detail: "Configuración inicial"
    }),
    snippetCompletion('crear comando ${nombre} {\n\tdescripcion "${descripcion}"\n\t${}\n}', {
        label: "crear comando",
        detail: "Nuevo comando de bot"
    }),
    snippetCompletion('evento ${nombre} {\n\timprimir("${}")\n}', {
        label: "evento",
        detail: "Manejador de eventos"
    }),
    snippetCompletion('crear mensaje {\n\tembed {\n\t\tdescripcion "${}"\n\t}\n}', {
        label: "crear mensaje",
        detail: "Bloque de mensaje con embed"
    })
];

export const chordCompletionSource = completeFromList([...completions, ...snippets]);

const RESERVED_WORDS = new Set([
    ...CHORD_KEYWORDS, ...CHORD_CONTROL_FLOW, ...CHORD_BUILTINS, ...CHORD_ATOMS, "@asincrono"
]);

const IDENTIFIER_RE = /[A-Za-z_]\w*/g;

/** Autocompleta con los identificadores (variables, nombres) ya escritos en el documento. */
export const chordVariableCompletionSource = (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(/[A-Za-z_]\w*/);
    if (!word || (word.from === word.to && !context.explicit)) return null;

    const identifiers = new Set<string>();
    const text = context.state.doc.toString();

    IDENTIFIER_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = IDENTIFIER_RE.exec(text)) !== null) {
        const name = match[0];
        if (name !== word.text && !RESERVED_WORDS.has(name)) {
            identifiers.add(name);
        }
    }

    return {
        from: word.from,
        options: Array.from(identifiers, name => ({ label: name, type: "variable" })),
        validFor: /^\w*$/,
    };
};