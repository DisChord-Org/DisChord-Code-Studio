export interface CorelibParam {
    name: string;
    type: string;
    optional: boolean;
    rest: boolean;
}

export interface CorelibMember {
    name: string;
    returns: string;
    params: CorelibParam[] | null;
    doc?: string;
    static: boolean;
    async: boolean;
}

export interface CorelibClass {
    name: string;
    receiver: string | null;
    instantiable: boolean;
    injected: boolean;
    methods: CorelibMember[];
    properties: CorelibMember[];
}

export interface CorelibField {
    keys: string[];
    kind: string;
    required: boolean;
    values?: string[];
}

export interface CorelibBlock {
    name: string;
    fields: CorelibField[];
    nested: Array<{ key: string; block: string; shape: string }>;
}

export interface CorelibData {
    keywords: string[];
    classes: CorelibClass[];
    functions: Array<{ name: string; kind: string; async: boolean }>;
    types: Array<{ name: string; kind: string }>;
    decorators: string[];
    literals: Array<{ name: string; value: string }>;
    events: Array<{ name: string; params: string[] }>;
    blocks: CorelibBlock[];
    scopes: Array<{ construct: string; identifiers: string[] }>;
}

let current: CorelibData | null = null;

export const setCorelib = (raw: unknown) => {
    const data = raw as Partial<CorelibData> | null;
    const ok = !!data && Array.isArray(data.keywords) && Array.isArray(data.classes) && Array.isArray(data.blocks);

    current = ok
        ? {
            keywords: data.keywords!,
            classes: data.classes!,
            functions: data.functions ?? [],
            types: data.types ?? [],
            decorators: data.decorators ?? [],
            literals: data.literals ?? [],
            events: data.events ?? [],
            blocks: data.blocks!,
            scopes: data.scopes ?? [],
        }
        : null;
};

export const getCorelib = (): CorelibData | null => current;
