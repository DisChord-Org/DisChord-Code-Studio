interface CardProps {
    title: string;
    subtitle?: string;
    onClick?: () => void;
    onDelete?: () => void;
}

export const Card = ({ title, subtitle, onClick, onDelete }: CardProps) => {
    return (
        <div 
            onClick={onClick}
            className="group flex items-center justify-between p-4 bg-[#111214] border border-[#1e1f22] rounded-lg hover:border-[#5865F2]/50 transition-colors cursor-pointer"
        >
            <div>
                <h3 className="text-sm font-semibold text-gray-200 group-hover:text-white">{title}</h3>
                {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
            </div>

            {onDelete && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                    }}
                    className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-500/10 rounded text-red-400 transition-opacity"
                >
                ✕
                </button>
            )}
        </div>
    );
};