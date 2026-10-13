import type { AdditiveSource, ExclusiveSource } from "../types";

/** After `evento `: the events Discord can send, with what each one gives to its handler. */
export const eventNamesSource: ExclusiveSource = {
    kind: "exclusive",
    name: "eventNames",
    run: ({ beforeTrim, from, corelib }) => {
        if (!corelib || !/\bevento\s*$/.test(beforeTrim)) return null;

        return {
            from,
            options: corelib.events.map((e) => ({
                label: e.name,
                type: "function",
                detail: e.params.join(", "),
                info: `Disponible dentro: ${e.params.join(", ")}`,
                boost: 6,
            })),
        };
    },
};

/** Inside an event or a command: the names its handler receives without declaring them. */
export const scopeSource: AdditiveSource = {
    kind: "additive",
    name: "scope",
    run: ({ blocks, corelib }) => {
        if (!corelib || blocks.length === 0) return [];

        const out: Array<{ label: string; type: string; detail: string; boost: number }> = [];
        const eventName = [...blocks].reverse().find((b) => b.kind === "evento")?.name;
        const event = eventName ? corelib.events.find((e) => e.name === eventName) : undefined;

        for (const param of event?.params ?? []) out.push({ label: param, type: "variable", detail: "del evento", boost: 11 });

        if (blocks.some((b) => b.kind === "comando")) {
            const scope = corelib.scopes.find((s) => s.construct === "comando");
            for (const id of scope?.identifiers ?? []) out.push({ label: id, type: "variable", detail: "del comando", boost: 11 });
        }

        return out;
    },
};
