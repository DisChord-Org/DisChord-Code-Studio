import { useRef, UIEvent, useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

interface CodeCanvasProps {
    projectName: string;
    relative_path: string;
    fileName: string;
    content: string;
    onChange: (value: string) => void;
}

export const CodeCanvas = ({ projectName, relative_path, fileName, content, onChange }: CodeCanvasProps) => {
    const [isDirty, setIsDirty] = useState(false);
    const lines = content.split("\n");
    const textAreaRef = useRef<HTMLTextAreaElement>(null);
    const lineNumbersRef = useRef<HTMLDivElement>(null);

    const handleScroll = (e: UIEvent<HTMLTextAreaElement>) => {
        if (lineNumbersRef.current) {
            lineNumbersRef.current.scrollTop = e.currentTarget.scrollTop;
        }
    };

    const handleSave = async () => {
        try {
            await invoke("save_file_content", { 
                projectName,
                filePath: relative_path,
                content
            });
            setIsDirty(false);
        } catch (error) {
            alert(error);
        }
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "s") {
                e.preventDefault();
                handleSave();
            }

            if (e.key === 'Tab') {
                e.preventDefault();

                const textarea = textAreaRef.current;
                if (!textarea) return;

                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;

                const tab = "    "; 
                const newContent = content.substring(0, start) + tab + content.substring(end);

                handleChange(newContent);

                setTimeout(() => {
                    textarea.selectionStart = textarea.selectionEnd = start + tab.length;
                }, 0);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [content, relative_path]);

    useEffect(() => {
        setIsDirty(false);
    }, [fileName]);

    const handleChange = (val: string) => {
        setIsDirty(true);
        onChange(val);
    };

    return (
        <div className="flex flex-col h-full bg-[#0B0E14] overflow-hidden">
            {/* archivo actual */}
            <div className={`flex items-center gap-2 bg-[#1e1f22]/40 px-4 py-2 text-[11px] border-b border-[#1e1f22] w-fit text-[#5865f2] font-medium shrink-0 transition-all ${isDirty ? 'italic' : ''}`}>
                <span>📄</span>
                {fileName}
                {isDirty && <span className="w-1.5 h-1.5 bg-white rounded-full ml-1 animate-pulse" title="Sin guardar" />}
                <span className="ml-2 text-[8px] opacity-50 cursor-pointer hover:text-white">✕</span>
            </div>

            <div className="flex flex-1 overflow-hidden bg-[#0B0E14] relative">
                {/* numeros */}
                <div
                    ref={lineNumbersRef}
                    className="w-12 bg-[#0B0E14] border-r border-[#1e1f22] flex flex-col pt-4 overflow-hidden select-none"
                >
                    {lines.map((_, i) => (
                        <div 
                            key={i} 
                            className="font-mono text-sm leading-6 h-6 text-right pr-3 text-gray-600"
                        >
                            {i + 1}
                        </div>
                    ))}
                    <div className="h-20 shrink-0" />
                </div>

                <textarea
                    ref={textAreaRef}
                    onScroll={handleScroll}
                    className="flex-1 bg-transparent pt-4 pl-3 pr-6 pb-20 outline-none font-mono text-sm leading-6 resize-none text-gray-300 custom-scrollbar selection:bg-[#5865f2]/30 overflow-auto whitespace-pre border-none"
                    value={content}
                    onChange={(e) => handleChange(e.target.value)}
                    spellCheck={false}
                    wrap="off"
                    placeholder="Escribe tu lógica aquí..."
                />
            </div>
            
            {/* barra inferior */}
            <div className="h-6 bg-[#0B0E14] border-t border-[#1e1f22] flex items-center px-4 justify-between text-[10px] text-gray-600 font-mono shrink-0">
                <div className="flex gap-4">
                    <span>UTF-8</span>
                    <span>Líneas: {lines.length}</span>
                </div>
                {isDirty ? <span className="text-yellow-500/70 italic">Modificado</span> : ''}
                <span>{content.length} caracteres</span>
            </div>
        </div>
    );
};