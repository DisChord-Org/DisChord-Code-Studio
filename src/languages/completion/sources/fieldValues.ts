import { enclosingList } from "../../chord-context";
import type { ExclusiveSource } from "../types";

/** Inside a string: the values the field of that line (or the list it is in) accepts. */
export const fieldValuesSource: ExclusiveSource = {
    kind: "exclusive",
    name: "fieldValues",
    run: ({ text, pos, where, corelib, block }) => {
        if (where.inString === null || !corelib) return null;

        const definition = corelib.blocks.find((b) => b.name === block?.kind);
        if (!definition) return null;

        const lineStart = text.lastIndexOf("\n", pos - 1) + 1;
        const key = enclosingList(text, pos)?.key ?? /^\s*([A-Za-z_]\w*)/.exec(text.slice(lineStart, pos))?.[1];
        const field = definition.fields.find((f) => f.keys.includes(key ?? ""));
        if (!field?.values) return null;

        const start = where.inString + 1;
        const typed = text.slice(start, pos).toLowerCase();

        return {
            from: start,
            options: field.values
                .filter((value) => value.toLowerCase().startsWith(typed))
                .map((value) => ({ label: value, type: "enum", detail: key, boost: 5 })),
        };
    },
};
