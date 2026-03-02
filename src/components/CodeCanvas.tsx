interface CodeCanvasProps {
    fileName: string;
    content: string;
    onChange: (value: string) => void;
}

export const CodeCanvas = ({ fileName, content, onChange }: CodeCanvasProps) => {
    return (
        <div className="flex flex-col h-full bg-[#0B0E14]">
            {/* archivo actual */}
            <div className="flex items-center gap-2 bg-[#1e1f22]/40 px-4 py-2 text-[11px] border-b border-[#1e1f22] w-fit text-[#5865f2] font-medium italic">
                <span>📄</span>
                {fileName}
                <span className="ml-2 text-[8px] opacity-50 cursor-pointer hover:text-white">✕</span>
            </div>

            <textarea
                className="flex-1 bg-transparent p-6 outline-none font-mono text-sm leading-relaxed resize-none text-gray-300 custom-scrollbar selection:bg-[#5865f2]/30"
                value={content}
                onChange={(e) => onChange(e.target.value)}
                spellCheck={false}
                placeholder="Escribe tu lógica aquí..."
            />
            
            {/* barra inferior */}
            <div className="h-6 bg-[#0B0E14] border-t border-[#1e1f22] flex items-center px-4 justify-between text-[10px] text-gray-600 font-mono">
                <span>UTF-8</span>
                <span>{content.length} caracteres</span>
            </div>
        </div>
    );
};