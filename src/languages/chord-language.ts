import { StreamLanguage, LanguageSupport, HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { chordTheme } from "./chord-theme";

export const chordKeywords = [
    "clase", "extiende", "prop", "fijar", "esta", "super", "nuevo", "devolver",
    "var", "es", "funcion", "importar", "exportar", "desde", "js", "tipo",
    "encender", "bot", "evento", "crear", "comando", "recolector"
];
export const chordControlFlow = ["si", "sino", "ademas", "para", "en", "pasar", "salir"];
export const chordBuiltins = [
    "mas", "menos", "por", "entre", "resto", "exp", "intro", "espacio", "mayor",
    "menor", "mayor_igual", "menor_igual", "no", "igual_tipado", "igual", "y", "o",
    "token", "prefijo", "intenciones", "descripcion", "embed", "boton",
    "etiqueta", "emoji", "estilo", "id", "alPulsarId", "imprimir", "mensaje",
    "usuario", "nombre"
];
export const chordAtoms = ["verdadero", "falso", "indefinido"];

const chordLanguage = StreamLanguage.define({
    name: "chord",
    startState: () => ({ inBlockComment: false }),
    token(stream, state) {
        if (state.inBlockComment) {
            if (stream.match("*/")) state.inBlockComment = false;
            else stream.next();
            return "comment";
        }
        if (stream.match("/*")) {
            state.inBlockComment = true;
            return "comment";
        }

        if (stream.eatSpace()) return null;
        if (stream.match("//")) {
            stream.skipToEnd();
            return "comment";
        }

        if (stream.match("@asincrono")) return "meta";

        if (stream.match(/"/)) {
            let escaped = false;
            let ch: string | void;
            while ((ch = stream.next()) != null) {
                if (ch === '"' && !escaped) break;
                escaped = !escaped && ch === "\\";
            }
            return "string";
        }

        if (stream.match(/^[0-9]+(\.[0-9]+)?/)) return "number";

        if (stream.match(/^[\w@_]+/)) {
            const word = stream.current();
            if (chordKeywords.includes(word)) return "keyword";
            if (chordControlFlow.includes(word)) return "controlKeyword";
            if (chordBuiltins.includes(word)) return "builtin";
            if (chordAtoms.includes(word)) return "atom";

            return "variableName";
        }

        if (stream.match(/[{}()\[\].,;]/)) return "punctuation";
        stream.next();
        return null;
    },
    tokenTable: {
        controlKeyword: tags.controlKeyword,
        punctuation: tags.punctuation,
    },
});

const chordHighlightStyle = HighlightStyle.define([
    { tag: tags.keyword, color: chordTheme.keyword },
    { tag: tags.controlKeyword, color: chordTheme.controlKeyword, fontWeight: "600" },
    { tag: tags.comment, color: chordTheme.comment, fontStyle: "italic" },
    { tag: tags.string, color: chordTheme.string },
    { tag: tags.number, color: chordTheme.number },
    { tag: tags.atom, color: chordTheme.number },
    { tag: tags.standard(tags.variableName), color: chordTheme.function }, // builtins
    { tag: tags.variableName, color: chordTheme.default },
    { tag: tags.punctuation, color: chordTheme.punctuation },
    { tag: tags.bracket, color: chordTheme.punctuation },
    { tag: tags.meta, color: chordTheme.meta, fontStyle: "italic" },
    { tag: tags.invalid, color: chordTheme.invalid },
]);

export function chord() {
    return new LanguageSupport(chordLanguage, [
        syntaxHighlighting(chordHighlightStyle),
    ]);
}