export const CodeMinimap = ({ text }: { text: string }) => {
    const lines = text.split('\n').slice(0, 150);

    return (
        <div className="w-20 border-l border-[#1e1f22] bg-[#0B0E14] select-none overflow-hidden flex flex-col pt-2 opacity-40 hover:opacity-100 transition-opacity duration-300 h-full">
            <div className="flex-1 overflow-hidden pointer-events-none">
                {lines.map((line, i) => {
                    const width = Math.min(line.trim().length * 1.5, 60);
                    return (
                        <div key={i} className="h-[2px] mb-[1px] flex px-2">
                            <div 
                                className="bg-gray-600 rounded-sm" 
                                style={{ width: `${width}%` }}
                            />
                        </div>
                    );
                })}
            </div>

            <div className="absolute top-0 right-0 w-20 h-32 bg-white/5 border-b border-white/10 pointer-events-none" />
        </div>
    );
};