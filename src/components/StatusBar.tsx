interface StatusBarProps {
    fileName?: string;
    isDirty: boolean;
    contentLength: number;
}

export const StatusBar = ({ fileName, isDirty, contentLength }: StatusBarProps) => {
    if (!fileName) return null;

    return (
        <div className="h-6 bg-[#0B0E14] border-t border-[#1e1f22] flex items-center px-4 justify-between text-[10px] text-gray-500 font-mono shrink-0">
            <div className="flex gap-4">
                <span>UTF-8</span>
                <span className="text-[#5865f2]">
                    {fileName.split('.').pop()?.toUpperCase()}
                </span>
            </div>
            
            {isDirty && (
                <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse" />
                    <span className="text-yellow-500/70 italic">Modificado</span>
                </div>
            )}
            
            <span>{contentLength} caracteres</span>
        </div>
    );
};