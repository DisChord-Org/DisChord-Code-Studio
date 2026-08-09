interface BackButtonProps {
    onClick: () => void;
    className?: string;
}

export const BackButton = ({ onClick, className = "" }: BackButtonProps) => (
    <button
        onClick={onClick}
        className={`text-[11px] text-gray-500 hover:text-white transition-colors flex items-center gap-1 ${className}`}
    >
        <i className="bi bi-arrow-left"></i> Volver
    </button>
);
