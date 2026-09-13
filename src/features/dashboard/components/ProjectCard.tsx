import { Tooltip } from "../../../components/ui/Tooltip";

interface ProjectCardProps {
    title: string;
    subtitle?: string;
    onClick?: () => void;
    onDelete?: () => void;
}

export const ProjectCard = ({ title, subtitle, onClick, onDelete }: ProjectCardProps) => {
    return (
        <div 
            onClick={onClick}
            className="group flex items-center justify-between p-4 bg-panel border border-border rounded-lg hover:border-accent/50 transition-colors cursor-pointer"
        >
            <div>
                <h3 className="text-sm font-semibold text-gray-200 group-hover:text-white">{title}</h3>
                {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
            </div>

            {onDelete && (
                <Tooltip label="Borrar proyecto" className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete();
                        }}
                        className="p-2 hover:bg-red-500/10 rounded text-red-400"
                    >
                    ✕
                    </button>
                </Tooltip>
            )}
        </div>
    );
};

export const CreatingProjectCard = ({ name }: { name: string }) => (
    <div className="relative overflow-hidden flex items-center gap-3 p-4 bg-panel border border-accent/30 rounded-lg">
        <div className="card-shimmer" />

        <div className="w-8 h-8 rounded-md bg-accent/10 flex items-center justify-center shrink-0">
            <i className="bi bi-arrow-repeat text-accent text-sm animate-spin"></i>
        </div>

        <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-200 truncate">{name}</h3>
            <p className="text-xs text-accent/80 mt-1">Creando proyecto...</p>
        </div>
    </div>
);