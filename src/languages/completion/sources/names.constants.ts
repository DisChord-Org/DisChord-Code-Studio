import type { SymbolKind } from "../../chord-symbols";

/** How each kind of symbol is shown in the menu; project symbols rank above library ones. */
export const kindInfo: Record<SymbolKind, { type: string; detail: string; boost: number }> = {
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
