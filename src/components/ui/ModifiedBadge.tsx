interface ModifiedBadgeProps {
    className?: string;
}

export const ModifiedBadge = ({ className = "" }: ModifiedBadgeProps) => (
    <div className={`flex items-center gap-1.5 px-1.5 py-[1px] rounded bg-[#5865F2]/10 text-[10px] text-[#8992f5] ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-[#8992f5]" />
        <span className="font-medium tracking-wide">Modificado</span>
    </div>
);
