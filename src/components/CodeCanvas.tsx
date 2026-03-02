import { useRef, UIEvent } from "react";

interface CodeCanvasProps {
    fileName: string;
    content: string;
    onChange: (value: string) => void;
}

export const CodeCanvas = ({ fileName, content, onChange }: CodeCanvasProps) => {
    const lines = content.split("\n");
    const textAreaRef = useRef<HTMLTextAreaElement>(null);
    const lineNumbersRef = useRef<HTMLDivElement>(null);

    const handleScroll = (e: UIEvent<HTMLTextAreaElement>) => {
        if (lineNumbersRef.current) {
            lineNumbersRef.current.scrollTop = e.currentTarget.scrollTop;
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#0B0E14] overflow-hidden">
            {/* archivo actual */}
            <div className="flex items-center gap-2 bg-[#1e1f22]/40 px-4 py-2 text-[11px] border-b border-[#1e1f22] w-fit text-[#5865f2] font-medium italic shrink-0">
                <span>📄</span>
                {fileName}
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
                    onChange={(e) => onChange(e.target.value)}
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
                <span>{content.length} caracteres</span>
            </div>
        </div>
    );
};