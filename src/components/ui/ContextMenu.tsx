interface ContextMenuItem {
    label: string;
    icon?: string;
    variant?: "default" | "danger";
    onClick: () => void;
}

interface ContextMenuProps {
    x: number;
    y: number;
    items: ContextMenuItem[];
    onClose: () => void;
}

export const ContextMenu = ({ x, y, items, onClose }: ContextMenuProps) => (
    <>
        <div className="fixed inset-0 z-40" onClick={onClose} />
        <div
            className="fixed z-50 bg-[#111214] border border-[#1e1f22] py-1 rounded shadow-xl min-w-[130px] animate-in fade-in zoom-in duration-75"
            style={{ top: y, left: x }}
        >
            {items.map((item) => (
                <button
                    key={item.label}
                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors
                        ${item.variant === "danger" ? "text-red-400 hover:bg-red-500/10" : "text-gray-300 hover:bg-white/5"}
                    `}
                    onClick={() => {
                        item.onClick();
                        onClose();
                    }}
                >
                    {item.icon && <i className={item.icon}></i>}
                    {item.label}
                </button>
            ))}
        </div>
    </>
);
