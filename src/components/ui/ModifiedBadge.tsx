interface ModifiedBadgeProps {
    className?: string;
}

export const ModifiedBadge = ({ className = "" }: ModifiedBadgeProps) => (
    <div className={`flex items-center gap-1.5 px-1.5 py-[1px] rounded bg-accent/10 text-[10px] text-accent-light ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-accent-light" />
        <span className="font-medium tracking-wide">Modificado</span>
    </div>
);
