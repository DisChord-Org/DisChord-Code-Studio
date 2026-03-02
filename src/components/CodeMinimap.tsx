export const CodeMinimap = ({ text }: { text: string }) => {
    const lines = text.split('\n').slice(0, 150);

    const THEME = {
        red: "#e06c75",     // Claves JSON, Tags HTML, Variables
        orange: "#d19a66",  // Números, Atributos
        yellow: "#e5c07b",  // Clases
        green: "#98c379",   // Strings
        blue: "#61afef",    // Funciones
        purple: "#c678dd",  // Keywords (if, export, return)
        cyan: "#56b6c2",    // Operadores
        comment: "#5c6370", // Gris
        default: "#abb2bf"  // Texto normal
    };

    const getLineTokens = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return [];
        if (trimmed.startsWith("//") || trimmed.startsWith("/*")) return [{ color: THEME.comment, w: 100 }];

        const tokens: { color: string; w: number }[] = [];
        const words = line.split(/(\s+|[{}[\]().,;:"'])/);

        words.forEach(word => {
            if (!word || word.trim() === "") return;

            let color = THEME.default;
            const w = Math.max(word.length * 2, 5);

            if (/^["'].*["']?$/.test(word)) color = THEME.green;
            else if (/\b(export|import|from|const|let|var|if|return|class|function|interface|type)\b/.test(word)) color = THEME.purple;
            else if (/\b(true|false|null|undefined)\b/.test(word)) color = THEME.orange;
            else if (/^\d+$/.test(word)) color = THEME.orange;
            else if (/[{}[\]().,;]/.test(word)) color = THEME.cyan;
            else if (line.includes(`${word}":`)) color = THEME.red; 

            tokens.push({ color, w });
        });

        return tokens;
    };

    return (
        <div className="w-20 border-l border-[#1e1f22] bg-[#0B0E14] select-none overflow-hidden flex flex-col pt-8 opacity-50 hover:opacity-100 transition-opacity duration-300 h-full relative">
            <div className="flex-1 overflow-hidden pointer-events-none px-1">
                {lines.map((line, i) => {
                    const lineTokens = getLineTokens(line);
                    const indent = line.search(/\S/);

                    return (
                        <div key={i} className="h-[2px] mb-[1px] flex" style={{ paddingLeft: `${indent > 0 ? indent * 0.4 : 0}px` }}>
                            {lineTokens.length > 0 ? (
                                lineTokens.map((t, idx) => (
                                    <div 
                                        key={idx}
                                        className="h-full rounded-sm mx-[0.5px]" 
                                        style={{ backgroundColor: t.color, width: `${t.w}%`, maxWidth: '40px' }}
                                    />
                                ))
                            ) : (
                                <div className="h-full w-full" />
                            )}
                        </div>
                    );
                })}
            </div>
            
            <div className="absolute top-0 right-0 w-full h-24 bg-white/[0.03] border-y border-white/5 pointer-events-none shadow-xl" />
        </div>
    );
};