import { completeFromList, snippetCompletion } from "@codemirror/autocomplete";

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