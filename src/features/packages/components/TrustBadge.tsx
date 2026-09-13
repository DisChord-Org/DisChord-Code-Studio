import { Tooltip } from "../../../components/ui/Tooltip";

interface TrustBadgeProps {
    isAudited: boolean;
    trustLevel: number;
}

export const TrustBadge = ({ isAudited, trustLevel }: TrustBadgeProps) => (
    <Tooltip label={isAudited ? "Código auditado por DisChord" : `Nivel de confianza: ${trustLevel}`}>
        <span
            className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0 ${
                isAudited ? "bg-emerald-500/10 text-emerald-400" : "bg-white/5 text-gray-500"
            }`}
        >
            <i className={`bi ${isAudited ? "bi-patch-check-fill" : "bi-shield"} text-[10px]`}></i>
            {isAudited ? "Auditado" : `T${trustLevel}`}
        </span>
    </Tooltip>
);
