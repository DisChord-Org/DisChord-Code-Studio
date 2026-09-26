import { useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { invoke } from "@tauri-apps/api/core";

import { EditorView, basicSetup } from "codemirror";
import { EditorState, Compartment, StateEffect, StateField } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { Decoration, keymap, scrollPastEnd } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { autocompletion } from "@codemirror/autocomplete";
import { indentUnit } from "@codemirror/language";
import { chordCompletionSource, chordVariableCompletionSource } from "../../../../languages/chord-completions";
import type { MinimapViewport, CodeCanvasHandle, GotoTarget } from "../../types";

import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { chord } from "../../../../languages/chord-language";
import { dischordEditorTheme } from "../../../../languages/editor-theme";
import { useConfig } from "../../../settings";

interface CodeCanvasProps {
    projectName: string;
    relative_path: string;
    fileName: string;
    setIsDirty: (value: boolean) => void;
    content: string;
    onChange: (value: string) => void;
    onViewportChange?: (viewport: MinimapViewport) => void;
    goto?: GotoTarget | null;
}

const languageConf = new Compartment();
const wrapConf = new Compartment();
const indentConf = new Compartment();

const indentExtension = (size: number, useTabs: boolean) => [
    EditorState.tabSize.of(size),
    indentUnit.of(useTabs ? "\t" : " ".repeat(size)),
];

export const CodeCanvas = forwardRef<CodeCanvasHandle, CodeCanvasProps>(({
    projectName, relative_path, fileName, content, setIsDirty, onChange, onViewportChange, goto
}, ref) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const { config, updateConfig } = useConfig();

    const onViewportChangeRef = useRef(onViewportChange);
    onViewportChangeRef.current = onViewportChange;

    const wordWrapRef = useRef(config.editor_word_wrap);
    wordWrapRef.current = config.editor_word_wrap;

    const tabSizeRef = useRef(config.editor_tab_size);
    tabSizeRef.current = config.editor_tab_size;

    const useTabsRef = useRef(config.editor_use_tabs);
    useTabsRef.current = config.editor_use_tabs;

    const finalNewlineRef = useRef(config.editor_final_newline);
    finalNewlineRef.current = config.editor_final_newline;

    const updateConfigRef = useRef(updateConfig);
    updateConfigRef.current = updateConfig;

    useImperativeHandle(ref, () => ({
        scrollTo: (scrollTop: number) => {
            const scroller = viewRef.current?.scrollDOM;
            if (scroller) scroller.scrollTop = scrollTop;
        }
    }), []);

    const addFlash = StateEffect.define<{from: number, to: number}>();
    const clearFlash = StateEffect.define<null>();
    const flashField = StateField.define({
        create() { return Decoration.none },
        update(underlines, tr) {
            underlines = underlines.map(tr.changes);
            for (let e of tr.effects) {
                if (e.is(addFlash)) {
                    underlines = underlines.update({
                        add: [
                            Decoration.mark({
                                attributes: { class: "bg-red-500/40 transition-colors duration-300 rounded-sm" }
                            }).range(e.value.from, e.value.to)
                        ]
                    });
                }

                if (e.is(clearFlash)) {
                    return Decoration.none;
                }
            }
            return underlines;
        },
        provide: f => EditorView.decorations.from(f)
    });

    const getLanguage = (fname: string) => {
        const ext = fname.split('.').pop()?.toLowerCase();
        switch (ext) {
            case 'chord':
                return chord();
            case 'js':
            case 'jsx':
            case 'mjs':
            case 'ts':
            case 'tsx':
                return javascript({ jsx: true, typescript: ext.includes('t') });
            case 'html':
                return html();
            case 'css':
                return css();
            case 'json':
                return json();
            default:
                return [];
        }
    };

    const getCompletionExtension = (fname: string) => {
        const ext = fname.split('.').pop()?.toLowerCase();
        if (ext === 'chord') {
            return autocompletion({ override: [chordCompletionSource, chordVariableCompletionSource] });
        }
        return autocompletion();
    };

    const handleSave = async (view: EditorView) => {
        const doc = view.state.doc;
        if (finalNewlineRef.current && doc.length > 0 && doc.sliceString(doc.length - 1) !== "\n") {
            view.dispatch({ changes: { from: doc.length, insert: "\n" } });
        }

        try {
            await invoke("save_file_content", { 
                projectName,
                filePath: relative_path,
                content: view.state.doc.toString()
            });
            setIsDirty(false);
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        if (!editorRef.current) return;

        const view = new EditorView({
            state: EditorState.create({
                doc: content,
                extensions: [
                    basicSetup,
                    oneDark,
                    scrollPastEnd(),
                    flashField,
                    languageConf.of(getLanguage(fileName)),
                    wrapConf.of(wordWrapRef.current ? EditorView.lineWrapping : []),
                    indentConf.of(indentExtension(tabSizeRef.current, useTabsRef.current)),
                    getCompletionExtension(fileName),
                    keymap.of([
                        indentWithTab,
                        { key: "Ctrl-s", run: (v) => { handleSave(v); return true; } },
                        { key: "Ctrl-r", run: () => { window.dispatchEvent(new CustomEvent("dischord-run")); return true; } },
                        { key: "Alt-z", run: () => { updateConfigRef.current({ editor_word_wrap: !wordWrapRef.current }); return true; } }
                    ]),
                    EditorView.updateListener.of((update) => {
                        if (update.docChanged) {
                            setIsDirty(true);
                            onChange(update.state.doc.toString());
                            reportViewport();
                        }
                    }),
                    EditorView.domEventHandlers({
                        copy: (_event, view) => {
                            const { from, to } = view.state.selection.main;
                    
                            if (from !== to) {
                                view.dispatch({
                                    effects: addFlash.of({ from, to })
                                });
                                
                                setTimeout(() => {
                                    if (view && view.state) {
                                        view.dispatch({
                                            effects: clearFlash.of(null)
                                        });
                                    }
                                }, 300);
                            }
                        }
                    }),
                    dischordEditorTheme
                ]
            }),
            parent: editorRef.current
        });

        viewRef.current = view;
        setIsDirty(false);
        view.focus();

        const scroller = view.scrollDOM;
        const reportViewport = () => {
            onViewportChangeRef.current?.({
                scrollTop: scroller.scrollTop,
                scrollHeight: scroller.scrollHeight,
                clientHeight: scroller.clientHeight,
            });
        };

        requestAnimationFrame(() => requestAnimationFrame(reportViewport));

        scroller.addEventListener("scroll", reportViewport, { passive: true });
        const resizeObserver = new ResizeObserver(reportViewport);
        resizeObserver.observe(scroller);

        return () => {
            scroller.removeEventListener("scroll", reportViewport);
            resizeObserver.disconnect();
            view.destroy();
            viewRef.current = null;
        }
    }, [relative_path]);

    useEffect(() => {
        const view = viewRef.current;
        if (!view || !content) return;

        const currentContent = view.state.doc.toString();
        if (currentContent === content) return;

        view.dispatch({
            changes: {
                from: 0,
                to: currentContent.length,
                insert: content
            }
        });
        setIsDirty(false);
    }, [content]);

    useEffect(() => {
        viewRef.current?.dispatch({
            effects: wrapConf.reconfigure(config.editor_word_wrap ? EditorView.lineWrapping : [])
        });
    }, [config.editor_word_wrap]);

    useEffect(() => {
        viewRef.current?.dispatch({
            effects: indentConf.reconfigure(indentExtension(config.editor_tab_size, config.editor_use_tabs))
        });
    }, [config.editor_tab_size, config.editor_use_tabs]);

    useEffect(() => {
        const view = viewRef.current;
        if (!view || !goto || goto.path !== relative_path) return;

        const line = view.state.doc.line(Math.min(Math.max(goto.line, 1), view.state.doc.lines));
        const pos = line.from + Math.min(Math.max(goto.column - 1, 0), line.length);
        view.dispatch({ selection: { anchor: pos }, effects: EditorView.scrollIntoView(pos, { y: "center" }) });
        view.focus();
    }, [goto?.nonce]);

    useEffect(() => {
        const triggerSave = () => {
            if (viewRef.current) {
                handleSave(viewRef.current);
            }
        };

        window.addEventListener("dischord-save", triggerSave);
        return () => window.removeEventListener("dischord-save", triggerSave);
    }, [relative_path, projectName]);

    return (
        <div className="h-full w-full overflow-hidden">
            <div className="editor-zoom-wrapper selection:bg-accent/30" ref={editorRef} />
        </div>
    );
});

CodeCanvas.displayName = "CodeCanvas";