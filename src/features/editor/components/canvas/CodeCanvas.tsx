import { useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { invoke } from "@tauri-apps/api/core";

import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { keymap, scrollPastEnd } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import type { MinimapViewport, CodeCanvasHandle, GotoTarget } from "../../types";

import { languageFor, loadedLanguageFor } from "../../../../languages/language-for-file";
import { loadLibraryExports } from "../../../../languages/chord-libraries";
import { dischordEditorTheme } from "../../../../languages/editor-theme";
import { completionTheme } from "../../../../languages/completion-theme";
import { searchTheme } from "../../../../languages/search-theme";
import {
    languageConf, wrapConf, indentConf, diagnosticsConf, indentExtension, isChordFile,
    languageExtensionFor, completionExtensionFor, addFlash, clearFlash, flashField,
} from "./codeMirrorExtensions";
import { rememberTabView, restoreTabView } from "../../tabsSession";
import { copyFlashMs } from "./CodeCanvas.constants";
import { useConfig } from "../../../settings";
import { useShortcut } from "../../../shortcuts";
import { middleClickJustHappened } from "../../../../utils/MiddleClick";
import { forgetDiagnostics, goToDefinition, languageIntelligence, liveDiagnostics } from "../../../compiler";

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

    const diagnosticsOn = config.editor_live_diagnostics && isChordFile(fileName);
    const diagnosticsOnRef = useRef(diagnosticsOn);
    diagnosticsOnRef.current = diagnosticsOn;

    const finalNewlineRef = useRef(config.editor_final_newline);
    finalNewlineRef.current = config.editor_final_newline;

    const updateConfigRef = useRef(updateConfig);
    updateConfigRef.current = updateConfig;

    useShortcut("editor.goToDefinition", () => {
        if (viewRef.current) goToDefinition(viewRef.current, relative_path);
    });

    useShortcut("editor.toggleWordWrap", () => updateConfigRef.current({ editor_word_wrap: !wordWrapRef.current }));

    useImperativeHandle(ref, () => ({
        scrollTo: (scrollTop: number) => {
            const scroller = viewRef.current?.scrollDOM;
            if (scroller) scroller.scrollTop = scrollTop;
        }
    }), []);

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

        loadLibraryExports(projectName);

        const view = new EditorView({
            state: EditorState.create({
                doc: content,
                extensions: [
                    basicSetup,
                    oneDark,
                    scrollPastEnd(),
                    flashField,
                    languageConf.of(languageExtensionFor(fileName)),
                    wrapConf.of(wordWrapRef.current ? EditorView.lineWrapping : []),
                    indentConf.of(indentExtension(tabSizeRef.current, useTabsRef.current)),
                    ...(isChordFile(fileName) ? [languageIntelligence(projectName, relative_path)] : []),
                    diagnosticsConf.of(diagnosticsOnRef.current ? liveDiagnostics(projectName, relative_path) : []),
                    completionExtensionFor(fileName),
                    keymap.of([indentWithTab]),
                    EditorView.updateListener.of((update) => {
                        if (update.selectionSet) rememberTabView(projectName, relative_path, update.view);
                        if (update.docChanged) {
                            setIsDirty(true);
                            onChange(update.state.doc.toString());
                            reportViewport();
                        }
                    }),
                    EditorView.domEventHandlers({
                        paste: () => middleClickJustHappened(),
                        copy: (_event, copyView) => {
                            const { from, to } = copyView.state.selection.main;
                            if (from === to) return;

                            copyView.dispatch({ effects: addFlash.of({ from, to }) });
                            setTimeout(() => copyView.dispatch({ effects: clearFlash.of(null) }), copyFlashMs);
                        }
                    }),
                    dischordEditorTheme,
                    completionTheme,
                    searchTheme
                ]
            }),
            parent: editorRef.current
        });

        viewRef.current = view;

        if (!isChordFile(fileName) && !loadedLanguageFor(fileName)) {
            languageFor(fileName)
                .then((support) => {
                    if (support && viewRef.current === view) view.dispatch({ effects: languageConf.reconfigure(support) });
                })
                .catch((error) => console.error(`No se pudo cargar la sintaxis de ${fileName}:`, error));
        }

        restoreTabView(projectName, relative_path, view);
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

        // Two frames: the first lays the document out, the second has the final scroll metrics.
        requestAnimationFrame(() => requestAnimationFrame(reportViewport));

        const rememberScroll = () => rememberTabView(projectName, relative_path, view);
        scroller.addEventListener("scroll", rememberScroll, { passive: true });
        scroller.addEventListener("scroll", reportViewport, { passive: true });
        const resizeObserver = new ResizeObserver(reportViewport);
        resizeObserver.observe(scroller);

        return () => {
            scroller.removeEventListener("scroll", rememberScroll);
            scroller.removeEventListener("scroll", reportViewport);
            resizeObserver.disconnect();
            view.destroy();
            viewRef.current = null;
            forgetDiagnostics(relative_path);
        }
        // Rebuilding the editor on every prop change would lose undo history; only a file switch recreates it.
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [content]);

    useEffect(() => {
        viewRef.current?.dispatch({
            effects: wrapConf.reconfigure(config.editor_word_wrap ? EditorView.lineWrapping : [])
        });
    }, [config.editor_word_wrap]);

    useEffect(() => {
        viewRef.current?.dispatch({
            effects: diagnosticsConf.reconfigure(diagnosticsOn ? liveDiagnostics(projectName, relative_path) : []),
        });
        if (!diagnosticsOn) forgetDiagnostics(relative_path);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [diagnosticsOn]);

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
        // The nonce, not the target, signals a new request, so jumping twice to the same spot works.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [goto?.nonce]);

    useEffect(() => {
        const triggerSave = () => {
            if (viewRef.current) {
                handleSave(viewRef.current);
            }
        };

        window.addEventListener("dischord-save", triggerSave);
        return () => window.removeEventListener("dischord-save", triggerSave);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [relative_path, projectName]);

    return (
        <div className="h-full w-full overflow-hidden">
            <div className="editor-zoom-wrapper selection:bg-accent/30" ref={editorRef} />
        </div>
    );
});

CodeCanvas.displayName = "CodeCanvas";