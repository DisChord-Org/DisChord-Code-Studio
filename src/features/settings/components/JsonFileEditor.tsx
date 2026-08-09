import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { json } from "@codemirror/lang-json";
import { dischordEditorTheme } from "../../../languages/editor-theme";

export const JsonFileEditor = () => {
    const editorRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSave = async () => {
        const view = viewRef.current;
        if (!view) return;

        try {
            await invoke("save_config_raw", { content: view.state.doc.toString() });
        } catch (error) {
            alert("No se pudo guardar config.json: " + error);
        }
    };

    useEffect(() => {
        if (!editorRef.current) return;
        let cancelled = false;

        invoke<string>("get_config_raw")
            .then((content) => {
                if (cancelled || !editorRef.current) return;

                const view = new EditorView({
                    state: EditorState.create({
                        doc: content,
                        extensions: [
                            basicSetup,
                            oneDark,
                            json(),
                            keymap.of([
                                indentWithTab,
                                { key: "Ctrl-s", run: () => { handleSave(); return true; } },
                            ]),
                            dischordEditorTheme,
                        ]
                    }),
                    parent: editorRef.current
                });

                viewRef.current = view;
            })
            .catch((error) => setError(String(error)));

        return () => {
            cancelled = true;
            viewRef.current?.destroy();
            viewRef.current = null;
        };
    }, []);

    if (error) {
        return (
            <div className="h-full flex items-center justify-center text-sm text-red-400">
                No se pudo cargar config.json: {error}
            </div>
        );
    }

    return <div className="h-full overflow-hidden" ref={editorRef} />;
};
