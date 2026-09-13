import type { ReactNode } from "react";
import { placementClasses } from "./Tooltip.constants";

export type TooltipPlacement = "top" | "bottom" | "left" | "right";
export type TooltipAlign = "center" | "start" | "end";

interface TooltipProps {
    label: string;
    children: ReactNode;
    placement?: TooltipPlacement;
    align?: TooltipAlign;
    className?: string;
}

export const Tooltip = ({ label, children, placement = "top", align = "center", className = "" }: TooltipProps) => (
    <span className={`group/tip relative inline-flex ${className}`.trim()}>
        {children}
        <span
            className={`pointer-events-none absolute z-50 whitespace-nowrap rounded border border-white/5 bg-border px-2 py-1 text-[10px] text-white opacity-0 shadow-xl transition-opacity duration-150 group-hover/tip:opacity-100 ${placementClasses[placement][align]}`}
        >
            {label}
        </span>
    </span>
);
