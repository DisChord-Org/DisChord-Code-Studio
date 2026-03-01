export const ToolbarButton = ({ label, icon, onClick, variant = "default" }: any) => (
    <button 
        onClick={onClick}
        className={
            `px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-2
                ${variant === "run" 
                    ? "bg-green-500/10 text-green-400 hover:bg-green-500/20" 
                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                }`}
    >
        {icon && <span>{icon}</span>}
        {label}
    </button>
);