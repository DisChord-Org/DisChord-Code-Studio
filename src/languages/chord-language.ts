import { StreamLanguage, LanguageSupport } from "@codemirror/language";

const keywords = [
    "clase", "extiende", "prop", "fijar", "esta", "super", "nuevo", "devolver",
    "var", "es", "funcion", "importar", "exportar", "desde", "js", "tipo",
    "encender", "bot", "evento", "crear", "comando", "recolector"
];
const controlFlow = ["si", "sino", "ademas", "para", "en", "pasar", "salir"];
const builtins = [
    "mas", "menos", "por", "entre", "resto", "exp", "intro", "espacio", "mayor",
    "menor", "mayor_igual", "menor_igual", "no", "igual_tipado", "igual", "y", "o",
    
    "token", "prefijo", "intenciones", "descripcion", "embed", "boton", 
    "etiqueta", "emoji", "estilo", "id", "alPulsarId", "imprimir", "mensaje",
    "usuario", "nombre"
];
const atoms = ["verdadero", "falso", "indefinido"];

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
            while (stream.next() && !stream.eat(/"/)) {}
            return "string";
        }

        if (stream.match(/^[0-9]+(\.[0-9]+)?/)) return "number";

        if (stream.match(/^[\w@_]+/)) {
            const word = stream.current();
            
            if (keywords.includes(word)) return "keyword";
            if (controlFlow.includes(word)) return "controlKeyword";
            if (builtins.includes(word)) return "builtin";
            if (atoms.includes(word)) return "atom";

            return "variableName";
        }

        if (stream.match(/[{}()\[\].,;]/)) return "punctuation";
    
        stream.next();
        return null;
    }
});

export function chord() {
    return new LanguageSupport(chordLanguage);
}