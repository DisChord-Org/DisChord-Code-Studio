import { isExecutable } from "../../chord-context";
import type { CorelibData } from "../../chord-corelib";
import type { AdditiveSource, Suggestion } from "../types";

const blockTemplate = (name: string) => `${name} {\n\t\${}\n}`;

/** The fields and nested blocks the block around the cursor accepts, as the compiler describes them. */
const fieldsOf = (kind: string, corelib: CorelibData): Suggestion[] => {
    const definition = corelib.blocks.find((b) => b.name === kind);
    if (!definition) return [];

    const out: Suggestion[] = [];

    for (const field of definition.fields) {
        const isList = field.kind.endsWith("List") || field.kind === "list";
        out.push({
            label: field.keys[0],
            type: "property",
            detail: field.required ? "obligatorio" : "campo",
            info: field.keys.length > 1 ? `También: ${field.keys.slice(1).join(", ")}` : undefined,
            template: isList ? `${field.keys[0]} [ \${} ]` : `${field.keys[0]} \${}`,
            boost: field.required ? 9 : 6,
        });
        for (const alias of field.keys.slice(1)) {
            out.push({ label: alias, type: "property", detail: `alias de ${field.keys[0]}`, boost: 2 });
        }
    }

    for (const nested of definition.nested) {
        out.push({ label: nested.key, type: "namespace", detail: "bloque", template: blockTemplate(nested.key), boost: 6 });
    }

    // What can sit inside a message besides its own fields.
    if (kind === "mensaje") {
        for (const name of ["embed", "boton"]) {
            out.push({ label: name, type: "namespace", detail: "bloque", template: blockTemplate(name), boost: 7 });
        }
    }

    return out;
};

export const blockFieldsSource: AdditiveSource = {
    kind: "additive",
    name: "blockFields",
    run: ({ startsStatement, block, corelib }) => (startsStatement && block && corelib ? fieldsOf(block.kind, corelib) : []),
};

/** Words that open a statement or a declaration; what is valid depends on where the cursor is. */
export const statementsSource: AdditiveSource = {
    kind: "additive",
    name: "statements",
    run: ({ startsStatement, block, corelib }) => {
        if (!startsStatement || !corelib) return [];

        const out: Suggestion[] = [];
        const add = (label: string, template: string, detail: string, info?: string) =>
            out.push({ label, type: "keyword", detail, info, template, boost: 4 });

        if (!block) {
            add("encender bot", 'encender bot {\n\ttoken "${}"\n\tprefijo "!"\n\tintenciones [ "Servidores" ]\n}', "bloque", "Configuración e inicio del bot.");
            add("nuevo comando", 'nuevo comando ${Nombre} {\n\tdescripcion "${}";\n\t\n}', "bloque", "Un comando del bot.");
            add("evento", "evento ${nombre} {\n\t${}\n}", "bloque", "Manejador de un evento de Discord.");
            add("funcion", "funcion ${nombre}(${}) {\n\t\n}", "declaración");
            add("clase", "clase ${Nombre} {\n\t${}\n}", "declaración");
            add("importar", 'importar { ${} } desde "${}"', "módulo");
            add("exportar", "exportar ${}", "módulo");
        }

        if (!block || isExecutable(block.kind)) {
            add("var", "var ${nombre} es ${}", "variable");
            add("si", "si (${}) {\n\t\n}", "control");
            add("para", "para (${} en ${}) {\n\t\n}", "control");
            add("devolver", "devolver ${}", "control");
        }

        if (block && isExecutable(block.kind)) {
            add("enviar mensaje", 'enviar mensaje {\n\tcontenido "${}"\n}', "acción", "Envía un mensaje al canal actual.");
            add("nuevo recolector", "nuevo recolector ${mensaje} {\n\ttiempo ${60000};\n\t${}\n}", "bloque");
            for (const fn of corelib.functions) {
                if (fn.kind === "function") out.push({ label: fn.name, type: "function", detail: "función", template: `${fn.name}(\${})`, boost: 4 });
            }
        }

        return out;
    },
};
