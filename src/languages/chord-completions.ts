import { completeFromList, snippetCompletion, type Completion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { getLibraryExports } from "./chord-libraries";
import { collectSymbols, type ChordSymbol, type SymbolKind } from "./chord-symbols";

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

const kindInfo: Record<SymbolKind, { type: string; detail: string; boost: number }> = {
    variable: { type: "variable", detail: "variable", boost: 10 },
    function: { type: "function", detail: "función", boost: 10 },
    class: { type: "class", detail: "clase", boost: 10 },
    property: { type: "property", detail: "propiedad", boost: 8 },
    parameter: { type: "variable", detail: "parámetro", boost: 9 },
    import: { type: "variable", detail: "importado", boost: 10 },
    module: { type: "namespace", detail: "módulo", boost: 10 },
    command: { type: "function", detail: "comando", boost: 6 },
    event: { type: "function", detail: "evento", boost: 6 },
    used: { type: "text", detail: "usado", boost: -5 },
};

const toCompletion = (symbol: ChordSymbol): Completion => {
    const info = kindInfo[symbol.kind];
    return {
        label: symbol.name,
        type: info.type,
        detail: symbol.from ? `lib:${symbol.from}` : info.detail,
        boost: symbol.from ? info.boost - 3 : info.boost,
    };
};

export const chordVariableCompletionSource = (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(/[A-Za-z_]\w*/);
    if (!word || (word.from === word.to && !context.explicit)) return null;

    const found = new Map<string, Completion>();
    for (const symbol of [...collectSymbols(context.state.doc.toString(), word), ...getLibraryExports()]) {
        const completion = toCompletion(symbol);
        const previous = found.get(symbol.name);
        if (!previous || (completion.boost ?? 0) > (previous.boost ?? 0)) found.set(symbol.name, completion);
    }

    return {
        from: word.from,
        options: Array.from(found.values()),
        validFor: /^\w*$/,
    };
};
