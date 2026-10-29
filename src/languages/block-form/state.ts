import { Facet, StateEffect } from "@codemirror/state";

export const dismissBlock = StateEffect.define<null>();
export const openBlockForm = StateEffect.define<number>();
export const neverShowHandler = Facet.define<() => void, (() => void) | null>({ combine: (handlers) => handlers[0] ?? null });
