import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import { EditorView, basicSetup } from "codemirror";
import { EditorState, Compartment } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { dischordEditorTheme } from "../../../languages/editor-theme";
import { languageFor, loadedLanguageFor } from "../../../languages/language-for-file";
import { ModifiedBadge } from "../../../components/ui";
import { useShortcut } from "../../shortcuts";

const language = new Compartment();

export const JsonFileEditor = () => {
    const editorRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isDirty, setIsDirty] = useState(false);
    const [shaking, setShaking] = useState(false);

    const triggerShake = () => {
        setShaking(false);
        requestAnimationFrame(() => setShaking(true));
    };

    const handleSave = async () => {
        const view = viewRef.current;
        if (!view) return;

        const content = view.state.doc.toString();

        try {
            JSON.parse(content);
        } catch {
            triggerShake();
            return;
        }

        try {
            await invoke("save_config_raw", { content });
            setIsDirty(false);
        } catch (error) {
            triggerShake();
            console.error("No se pudo guardar config.json:", error);
        }
    };

    useShortcut("file.save", handleSave);

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
                            language.of(loadedLanguageFor("config.json") ?? []),
                            keymap.of([indentWithTab]),
                            EditorView.updateListener.of((update) => {
                                if (update.docChanged) {
                                    setIsDirty(true);
                                }
                            }),
                            dischordEditorTheme,
                        ]
                    }),
                    parent: editorRef.current
                });

                viewRef.current = view;

                languageFor("config.json")
                    .then((support) => support && !cancelled && view.dispatch({ effects: language.reconfigure(support) }))
                    .catch(() => {});
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

    return (
        <div className="relative h-full overflow-hidden">
            {isDirty && <ModifiedBadge className="absolute top-3 right-4 pointer-events-none z-10" />}

            <div
                className={`h-full overflow-hidden ${shaking ? "shake" : ""}`}
                onAnimationEnd={() => setShaking(false)}
                ref={editorRef}
            />
        </div>
    );
};
