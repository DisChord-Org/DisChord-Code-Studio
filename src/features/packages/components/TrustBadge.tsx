interface TrustBadgeProps {
    isAudited: boolean;
    trustLevel: number;
}

export const TrustBadge = ({ isAudited, trustLevel }: TrustBadgeProps) => (
    <span
        className={`inline-flex items-center gap-1 text-[10px] font-medium shrink-0 ${
            isAudited ? "text-accent-light" : "text-gray-500"
        }`}
    >
        <i className={`bi ${isAudited ? "bi-patch-check-fill" : "bi-shield"} text-[11px]`}></i>
        {isAudited ? "Auditado" : `T${trustLevel}`}
    </span>
);
