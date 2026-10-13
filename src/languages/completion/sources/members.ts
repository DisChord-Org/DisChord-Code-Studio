import type { CorelibClass, CorelibData, CorelibMember } from "../../chord-corelib";
import { collectSymbols } from "../../chord-symbols";
import type { ExclusiveSource, Suggestion } from "../types";
import { symbolSuggestions } from "./names";

const signature = (member: CorelibMember): string => {
    if (member.params === null) return member.returns;

    const params = member.params
        .map((p) => `${p.rest ? "..." : ""}${p.name}${p.optional ? "?" : ""}: ${p.type}`)
        .join(", ");
    return `(${params}) → ${member.returns}`;
};

export const memberSuggestion = (member: CorelibMember, owner: string, isMethod: boolean): Suggestion => ({
    label: member.name,
    type: isMethod ? "method" : "property",
    detail: isMethod ? signature(member) : member.returns,
    info: [member.doc, owner ? `(${owner})` : ""].filter(Boolean).join("  "),
    template: isMethod ? (member.params && member.params.length > 0 ? `${member.name}(\${})` : `${member.name}()`) : undefined,
    boost: 5,
});

const classOfType = (corelib: CorelibData, type: string): CorelibClass | undefined => {
    const clean = type.trim();
    const wanted = clean.endsWith("[]") ? "lista" : clean;

    return corelib.classes.find((c) => c.receiver === wanted)
        ?? corelib.classes.find((c) => c.name.toLowerCase() === wanted.toLowerCase());
};

const only = (klass: CorelibClass | undefined): CorelibClass[] | null => (klass ? [klass] : null);

export const receiverClasses = (text: string, dotAt: number, corelib: CorelibData): CorelibClass[] | null => {
    const trimmed = text.slice(0, dotAt).trimEnd();
    const last = trimmed[trimmed.length - 1];

    if (last === '"') return only(classOfType(corelib, "texto"));
    if (last === "]") return only(classOfType(corelib, "lista"));
    if (last && /[0-9]/.test(last)) return only(classOfType(corelib, "numero"));

    const name = /([A-Za-z_]\w*)\s*$/.exec(trimmed)?.[1];
    if (!name) return null;

    const direct = corelib.classes.find((c) => c.name === name || (c.injected && c.name.toLowerCase() === name.toLowerCase()));
    if (direct) return [direct];
    if (name === "usuario") return only(corelib.classes.find((c) => c.name === "Usuario"));

    const typed = new RegExp(`\\b${name}\\s+tipo\\s+([A-Za-z_]\\w*(?:\\[\\])?)`).exec(text);
    return typed ? only(classOfType(corelib, typed[1])) : null;
};

export const membersSource: ExclusiveSource = {
    kind: "exclusive",
    name: "members",
    run: ({ text, before, from, pos, corelib }) => {
        if (!before.endsWith(".") || !corelib) return null;

        const dotAt = before.length - 1;

        if (/\besta\s*$/.test(before.slice(0, dotAt))) {
            const own = collectSymbols(text, { from, to: pos }).filter((s) => s.kind === "property" || s.kind === "function");
            return { from, options: symbolSuggestions(own) };
        }

        const known = receiverClasses(text, dotAt, corelib);
        const pool = known ?? corelib.classes.filter((c) => c.instantiable || c.receiver);
        const seen = new Map<string, Suggestion>();

        for (const klass of pool) {
            const owner = known ? "" : klass.name;

            for (const method of klass.methods) {
                const existing = seen.get(method.name);
                if (existing) existing.info = `${existing.info ?? ""} · ${klass.name}`;
                else seen.set(method.name, memberSuggestion(method, owner, true));
            }
            for (const property of klass.properties) {
                if (!seen.has(property.name)) seen.set(property.name, memberSuggestion(property, owner, false));
            }
        }

        return { from, options: Array.from(seen.values()) };
    },
};
