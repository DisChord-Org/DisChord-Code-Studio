import type { EditorState } from "@codemirror/state";
import { historyField } from "@codemirror/commands";

interface SavedState {
    doc: string;
    json: unknown;
}

const maxSaved = 30;
const saved = new Map<string, SavedState>();

const keyOf = (projectName: string, path: string) => `${projectName}:${path}`;

export const saveEditorState = (projectName: string, path: string, state: EditorState) => {
    const key = keyOf(projectName, path);
    saved.delete(key);
    saved.set(key, { doc: state.doc.toString(), json: state.toJSON({ history: historyField }) });
    if (saved.size > maxSaved) saved.delete(saved.keys().next().value as string);
};

export const takeEditorState = (projectName: string, path: string, content: string) => {
    const key = keyOf(projectName, path);
    const entry = saved.get(key);
    saved.delete(key);
    return entry && entry.doc === content ? entry.json : null;
};

export { historyField };
