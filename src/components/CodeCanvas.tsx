import { useRef, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import { EditorView, basicSetup } from "codemirror";
import { EditorState, Compartment } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { autocompletion } from "@codemirror/autocomplete";
import { chordCompletionSource } from "../languages/chord-completions";

import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { chord } from "../languages/chord-language";


interface CodeCanvasProps {
    projectName: string;
    relative_path: string;
    fileName: string;
    content: string;
    onChange: (value: string) => void;
}

const languageConf = new Compartment();

export const CodeCanvas = ({ projectName, relative_path, fileName, content, onChange }: CodeCanvasProps) => {
    const [isDirty, setIsDirty] = useState(false);
    const editorRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);

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

    const handleSave = async (currentContent: string) => {
        try {
            await invoke("save_file_content", { 
                projectName,
                filePath: relative_path,
                content: currentContent
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
                    languageConf.of(getLanguage(fileName)),
                    autocompletion({ override: [ chordCompletionSource ] }),
                    keymap.of([
                        indentWithTab,
                        { key: "Ctrl-s", run: (v) => { handleSave(v.state.doc.toString()); return true; } }
                    ]),
                    EditorView.updateListener.of((update) => {
                        if (update.docChanged) {
                            setIsDirty(true);
                            onChange(update.state.doc.toString());
                        }
                    }),
                    EditorView.theme({
                        "&": {
                            height: "100%",
                            backgroundColor:
                            "#0B0E14 !important"
                        },
                        ".cm-scroller": {
                            overflow: "auto",
                            backgroundColor: "#0B0E14",
                            paddingTop: "10px"
                        },
                        ".cm-content": { 
                            fontFamily: "'JetBrains Mono', monospace", 
                            fontSize: "13px",
                            paddingTop: "0px"
                        },
                        ".cm-gutters": { 
                            backgroundColor: "#0B0E14 !important", 
                            borderRight: "1px solid #1e1f22", 
                            color: "#4b5563",
                            paddingTop: "0px",
                            minWidth: "40px"
                        },
                        ".cm-activeLine": { backgroundColor: "#1e1f2233" },
                        ".cm-activeLineGutter": { backgroundColor: "#1e1f22", color: "#5865f2" }
                    }, { dark: true })
                ]
            }),
            parent: editorRef.current
        });

        viewRef.current = view;
        setIsDirty(false);
        return () => {
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
        const triggerSave = () => {
            if (viewRef.current) {
                handleSave(viewRef.current.state.doc.toString());
            }
        };

        window.addEventListener("dischord-save", triggerSave);
        return () => window.removeEventListener("dischord-save", triggerSave);
    }, [relative_path, projectName]);

    return (
        <div className="flex flex-col h-full bg-[#0B0E14] overflow-hidden">
            <div className={`flex items-center gap-2 bg-[#0B0E14] px-4 py-2 text-[11px] border-b border-[#1e1f22] w-fit text-[#5865f2] font-medium shrink-0`}>
                <span className="opacity-70">📄</span>
                {fileName}
                {isDirty && <span className="w-1.5 h-1.5 bg-[#5865f2] rounded-full ml-1 animate-pulse" />}
            </div>

            <div className="flex-1 overflow-hidden selection:bg-[#5865f2]/30" ref={editorRef} />
            
            <div className="h-6 bg-[#0B0E14] border-t border-[#1e1f22] flex items-center px-4 justify-between text-[10px] text-gray-500 font-mono shrink-0">
                <div className="flex gap-4">
                    <span>UTF-8</span>
                    <span className="text-[#5865f2]">{fileName.split('.').pop()?.toUpperCase()}</span>
                </div>
                {isDirty && <span className="text-yellow-500/70 italic">Modificado</span>}
                <span>{content.length} caracteres</span>
            </div>
        </div>
    );
};