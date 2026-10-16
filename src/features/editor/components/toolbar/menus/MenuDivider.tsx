interface MenuDividerProps {
    className?: string;
}

export const MenuDivider = ({ className = "mx-2" }: MenuDividerProps) => (
    <div className={`h-[1px] bg-menu-border my-1 ${className}`} />
);
