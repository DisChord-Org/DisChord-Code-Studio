import { toolbarButtonVariants, type ToolbarButtonVariant } from "./ToolbarButton.constants";

interface ToolbarButtonProps {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    variant?: ToolbarButtonVariant;
}

export const ToolbarButton = ({ label, icon, onClick, variant = "default" }: ToolbarButtonProps) => (
    <button
        onClick={onClick}
        className={`px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-2 ${toolbarButtonVariants[variant]}`}
    >
        {icon && <span>{icon}</span>}
        {label}
    </button>
);
