import { enclosingBlocks, enclosingList, isExecutable, positionKind, type BlockInfo } from "./chord-context";
import type { CorelibClass, CorelibData, CorelibMember } from "./chord-corelib";
import { collectSymbols, type ChordSymbol, type SymbolKind } from "./chord-symbols";
import { chordAtoms, chordBuiltins, chordControlFlow, chordKeywords } from "./chord-language";

export interface Suggestion {
    label: string;
    type: string;
    detail?: string;
    info?: string;
    template?: string;
    boost?: number;
}

export interface Suggestions {
    from: number;
    options: Suggestion[];
}

const symbolInfo: Record<SymbolKind, { type: string; detail: string; boost: number }> = {
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

const signature = (member: CorelibMember): string => {
    const params = (member.params ?? [])
        .map((p) => `${p.rest ? "..." : ""}${p.name}${p.optional ? "?" : ""}: ${p.type}`)
        .join(", ");
    return member.params === null ? member.returns : `(${params}) → ${member.returns}`;
};

const memberSuggestion = (member: CorelibMember, owner: string, isMethod: boolean): Suggestion => ({
    label: member.name,
    type: isMethod ? "method" : "property",
    detail: isMethod ? signature(member) : member.returns,
    info: [member.doc, owner ? `(${owner})` : ""].filter(Boolean).join("  "),
    template: isMethod ? (member.params && member.params.length > 0 ? `${member.name}(\${})` : `${member.name}()`) : undefined,
    boost: 5,
});

/** the class a type annotation names (`texto` → Texto, `texto[]` → Lista), if the compiler has one. */
const classOfType = (corelib: CorelibData, type: string): CorelibClass | undefined => {
    const clean = type.trim();
    if (clean.endsWith("[]")) return corelib.classes.find((c) => c.receiver === "lista") ?? corelib.classes.find((c) => c.name === "Lista");
    return corelib.classes.find((c) => c.receiver === clean) ?? corelib.classes.find((c) => c.name.toLowerCase() === clean.toLowerCase());
};

/** what is known about the thing before a dot: a class, a typed variable, a literal, or nothing. */
const receiverClasses = (text: string, dotAt: number, corelib: CorelibData): CorelibClass[] | null => {
    const before = text.slice(0, dotAt);
    const trimmed = before.trimEnd();
    const last = trimmed[trimmed.length - 1];

    if (last === '"') return [classOfType(corelib, "texto")].filter((c): c is CorelibClass => !!c);
    if (last === "]") return [classOfType(corelib, "lista")].filter((c): c is CorelibClass => !!c);
    if (last && /[0-9]/.test(last)) return [classOfType(corelib, "numero")].filter((c): c is CorelibClass => !!c);

    const name = /([A-Za-z_][\w]*)\s*$/.exec(trimmed)?.[1];
    if (!name) return null;

    const direct = corelib.classes.find((c) => c.name === name || (c.injected && c.name.toLowerCase() === name.toLowerCase()));
    if (direct) return [direct];
    if (name === "usuario") return [corelib.classes.find((c) => c.name === "Usuario")].filter((c): c is CorelibClass => !!c);

    // a variable or parameter written with its type: `edad tipo numero`, `lista tipo texto[]`.
    const typed = new RegExp(`\\b${name}\\s+tipo\\s+([A-Za-z_]\\w*(?:\\[\\])?)`).exec(text);
    if (typed) {
        const klass = classOfType(corelib, typed[1]);
        if (klass) return [klass];
    }

    return null;
};

const symbolSuggestions = (symbols: ChordSymbol[]): Suggestion[] =>
    symbols.map((s) => {
        const info = symbolInfo[s.kind];
        return { label: s.name, type: info.type, detail: s.from ? `lib:${s.from}` : info.detail, boost: s.from ? info.boost - 3 : info.boost };
    });

/** words that open a statement or a declaration, shown at the start of a line. */
const statementSuggestions = (block: BlockInfo | undefined, corelib: CorelibData): Suggestion[] => {
    const out: Suggestion[] = [];
    const add = (label: string, template: string, detail: string, info?: string, boost = 4) =>
        out.push({ label, type: "keyword", detail, info, template, boost });

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
};

const blockSuggestions = (block: BlockInfo, corelib: CorelibData, indent = ""): Suggestion[] => {
    const definition = corelib.blocks.find((b) => b.name === block.kind);
    if (!definition) return [];

    const out: Suggestion[] = [];

    for (const field of definition.fields) {
        const listLike = field.kind.endsWith("List") || field.kind === "list";
        const template = listLike ? `${field.keys[0]} [ \${} ]` : `${field.keys[0]} \${}`;
        out.push({
            label: field.keys[0],
            type: "property",
            detail: field.required ? "obligatorio" : "campo",
            info: field.keys.length > 1 ? `También: ${field.keys.slice(1).join(", ")}` : undefined,
            template: indent + template,
            boost: field.required ? 9 : 6,
        });
        for (const alias of field.keys.slice(1)) {
            out.push({ label: alias, type: "property", detail: `alias de ${field.keys[0]}`, boost: 2 });
        }
    }

    for (const nested of definition.nested) {
        out.push({ label: nested.key, type: "namespace", detail: "bloque", template: `${nested.key} {\n\t\${}\n}`, boost: 6 });
    }

    // blocks that can sit inside a message.
    if (block.kind === "mensaje") {
        for (const name of ["embed", "boton"]) {
            out.push({ label: name, type: "namespace", detail: "bloque", template: `${name} {\n\t\${}\n}`, boost: 7 });
        }
    }

    return out;
};

export const computeSuggestions = (
    text: string,
    pos: number,
    explicit: boolean,
    corelib: CorelibData | null,
    libraryExports: ChordSymbol[],
): Suggestions | null => {
    const where = positionKind(text, pos);
    if (where.inComment) return null;

    if (where.inString !== null) {
        if (!corelib) return null;
        const blocks = enclosingBlocks(text, pos, corelib);
        const block = blocks[blocks.length - 1];
        const definition = corelib.blocks.find((b) => b.name === block?.kind);
        if (!definition) return null;

        const list = enclosingList(text, pos);
        const lineStart = text.lastIndexOf("\n", pos - 1) + 1;
        const key = list?.key ?? /^\s*([A-Za-z_]\w*)/.exec(text.slice(lineStart, pos))?.[1];
        const field = definition.fields.find((f) => f.keys.includes(key ?? ""));
        if (!field?.values) return null;

        const typed = text.slice(where.inString + 1, pos);
        return {
            from: where.inString + 1,
            options: field.values
                .filter((v) => v.toLowerCase().startsWith(typed.toLowerCase()))
                .map((v) => ({ label: v, type: "enum", detail: key, boost: 5 })),
        };
    }

    const word = /[A-Za-z_@À-ɏ][\w@À-ɏ]*$|$/.exec(text.slice(0, pos))![0];
    const from = pos - word.length;
    if (word === "" && !explicit) {
        const prev = text[from - 1];
        const asksForAType = /(\btipo|->|\bevento)\s+$/.test(text.slice(0, from));
        if (prev !== "." && !asksForAType) return null;
    }

    const before = text.slice(0, from);
    const beforeTrim = before.trimEnd();
    const blocks = enclosingBlocks(text, pos, corelib);
    const block = blocks[blocks.length - 1];
    const options: Suggestion[] = [];

    if (before.endsWith(".")) {
        if (!corelib) return null;
        const dotAt = before.length - 1;

        if (/\besta\s*$/.test(before.slice(0, dotAt))) {
            const own = collectSymbols(text, { from, to: pos }).filter((s) => s.kind === "property" || s.kind === "function");
            return { from, options: symbolSuggestions(own) };
        }

        const classes = receiverClasses(text, dotAt, corelib);
        const instance = (corelib.classes.filter((c) => c.instantiable || c.receiver));
        const pool = classes ?? instance;
        const seen = new Map<string, Suggestion>();

        for (const klass of pool) {
            for (const m of klass.methods) {
                const existing = seen.get(m.name);
                if (existing) existing.info = `${existing.info ?? ""} · ${klass.name}`;
                else seen.set(m.name, memberSuggestion(m, classes ? "" : klass.name, true));
            }
            for (const p of klass.properties) {
                if (!seen.has(p.name)) seen.set(p.name, memberSuggestion(p, classes ? "" : klass.name, false));
            }
        }

        return { from, options: Array.from(seen.values()) };
    }

    const lineBefore = text.slice(text.lastIndexOf("\n", from - 1) + 1, from);
    if (/(\btipo|->)\s*([\w[\]]+\s*\|\s*)*$/.test(lineBefore)) {
        if (corelib) {
            for (const t of corelib.types) options.push({ label: t.name, type: "type", detail: "tipo", boost: 6 });
            for (const c of corelib.classes.filter((c) => c.instantiable)) options.push({ label: c.name, type: "class", detail: "clase", boost: 5 });
        }
        for (const s of collectSymbols(text, { from, to: pos }).filter((s) => s.kind === "class")) {
            options.push({ label: s.name, type: "class", detail: "clase", boost: 7 });
        }
        return { from, options };
    }

    if (/\bevento\s*$/.test(beforeTrim) && corelib) {
        return {
            from,
            options: corelib.events.map((e) => ({ label: e.name, type: "function", detail: e.params.join(", "), info: `Disponible dentro: ${e.params.join(", ")}`, boost: 6 })),
        };
    }

    const lineStart = text.lastIndexOf("\n", from - 1) + 1;
    const startsStatement = text.slice(lineStart, from).trim() === "" || /[;{}]\s*$/.test(beforeTrim);

    if (startsStatement && corelib) {
        if (block) options.push(...blockSuggestions(block, corelib));
        options.push(...statementSuggestions(block, corelib));
    }

    if (corelib && block) {
        const eventName = [...blocks].reverse().find((b) => b.kind === "evento")?.name;
        const event = eventName ? corelib.events.find((e) => e.name === eventName) : undefined;
        for (const param of event?.params ?? []) options.push({ label: param, type: "variable", detail: "del evento", boost: 11 });

        if (blocks.some((b) => b.kind === "comando")) {
            const scope = corelib.scopes.find((s) => s.construct === "comando");
            for (const id of scope?.identifiers ?? []) options.push({ label: id, type: "variable", detail: "del comando", boost: 11 });
        }
    }

    options.push(...symbolSuggestions([...collectSymbols(text, { from, to: pos }), ...libraryExports]));

    if (corelib) {
        for (const c of corelib.classes) {
            if (c.instantiable || c.injected || c.methods.some((m) => m.static) || c.properties.some((p) => p.static)) {
                if (!c.receiver || c.injected) options.push({ label: c.name, type: "class", detail: "clase", boost: 3 });
            }
        }
        for (const l of corelib.literals) options.push({ label: l.name, type: "constant", detail: "texto fijo", boost: 2 });
        for (const k of corelib.keywords) options.push({ label: k, type: "keyword", boost: 0 });
        for (const d of corelib.decorators) options.push({ label: d, type: "keyword", detail: "decorador", boost: 0 });
    }

    if (!corelib) {
        const own = [...chordKeywords, ...chordControlFlow, ...chordAtoms, "@asincrono"];
        for (const word of own) options.push({ label: word, type: "keyword", boost: 0 });
        for (const word of chordBuiltins) options.push({ label: word, type: "function", boost: 0 });
    }

    const best = new Map<string, Suggestion>();
    for (const option of options) {
        const previous = best.get(option.label);
        if (!previous || (option.boost ?? 0) > (previous.boost ?? 0)) best.set(option.label, option);
    }

    return { from, options: Array.from(best.values()) };
};
