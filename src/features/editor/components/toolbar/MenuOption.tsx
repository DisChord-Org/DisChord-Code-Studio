export const MenuOption = ({ icon, label, shortcut, onClick, variant = "default" }: any) => (
    <button
        onClick={onClick}
        className={`w-full px-3 py-1.5 text-[11px] flex items-center gap-3 transition-colors
            ${variant === "danger" ? "hover:bg-red-500/10 text-red-400" : "hover:bg-[#5865F2] text-gray-300 hover:text-white"}
        `}
    >
        <i className={`${icon} text-sm`}></i>
        <span className="flex-1 text-left">{label}</span>
        {shortcut && (
            <span className="text-[9px] opacity-30 font-mono">{shortcut}</span>
        )}
    </button>
);