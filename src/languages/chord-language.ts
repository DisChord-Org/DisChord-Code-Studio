import { StreamLanguage, LanguageSupport, HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { CHORD_THEME } from "./chord-theme";

export const CHORD_KEYWORDS = [
    "clase", "extiende", "prop", "fijar", "esta", "super", "nuevo", "devolver",
    "var", "es", "funcion", "importar", "exportar", "desde", "js", "tipo",
    "encender", "bot", "evento", "crear", "comando", "recolector"
];
export const CHORD_CONTROL_FLOW = ["si", "sino", "ademas", "para", "en", "pasar", "salir"];
export const CHORD_BUILTINS = [
    "mas", "menos", "por", "entre", "resto", "exp", "intro", "espacio", "mayor",
    "menor", "mayor_igual", "menor_igual", "no", "igual_tipado", "igual", "y", "o",
    "token", "prefijo", "intenciones", "descripcion", "embed", "boton",
    "etiqueta", "emoji", "estilo", "id", "alPulsarId", "imprimir", "mensaje",
    "usuario", "nombre"
];
export const CHORD_ATOMS = ["verdadero", "falso", "indefinido"];

export const chordLanguage = StreamLanguage.define({
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
            if (CHORD_KEYWORDS.includes(word)) return "keyword";
            if (CHORD_CONTROL_FLOW.includes(word)) return "controlKeyword";
            if (CHORD_BUILTINS.includes(word)) return "builtin";
            if (CHORD_ATOMS.includes(word)) return "atom";

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
    { tag: tags.keyword, color: CHORD_THEME.keyword },
    { tag: tags.controlKeyword, color: CHORD_THEME.controlKeyword, fontWeight: "600" },
    { tag: tags.comment, color: CHORD_THEME.comment, fontStyle: "italic" },
    { tag: tags.string, color: CHORD_THEME.string },
    { tag: tags.number, color: CHORD_THEME.number },
    { tag: tags.atom, color: CHORD_THEME.number },
    { tag: tags.standard(tags.variableName), color: CHORD_THEME.function }, // builtins
    { tag: tags.variableName, color: CHORD_THEME.default },
    { tag: tags.punctuation, color: CHORD_THEME.punctuation },
    { tag: tags.bracket, color: CHORD_THEME.punctuation },
    { tag: tags.meta, color: CHORD_THEME.meta, fontStyle: "italic" },
    { tag: tags.invalid, color: CHORD_THEME.invalid },
]);

export function chord() {
    return new LanguageSupport(chordLanguage, [
        syntaxHighlighting(chordHighlightStyle),
    ]);
}