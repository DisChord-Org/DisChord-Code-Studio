export const ToolbarButton = ({ label, icon, onClick, variant = "default" }: any) => {
    const variants: any = {
        run: "bg-green-500/10 text-green-400 hover:bg-green-500/20",
        stop: "bg-red-500/10 text-red-400 hover:bg-red-500/20",
        default: "text-gray-400 hover:bg-white/5 hover:text-white"
    };

    return (
        <button 
            onClick={onClick}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-2 ${variants[variant]}`}
        >
            {icon && <span>{icon}</span>}
            {label}
        </button>
    );
};