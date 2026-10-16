interface MenuPanelProps {
    // Position, width and z-index differ per menu; the visual shell is shared.
    className: string;
    children: React.ReactNode;
}

export const MenuPanel = ({ className, children }: MenuPanelProps) => (
    <div className={`absolute bg-border border border-menu-border rounded-lg shadow-2xl py-1 animate-in fade-in zoom-in-95 duration-100 ${className}`}>
        {children}
    </div>
);
