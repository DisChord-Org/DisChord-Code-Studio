import type { ReactNode } from "react";

type TooltipPlacement = "top" | "bottom" | "left" | "right";
type TooltipAlign = "center" | "start" | "end";

interface TooltipProps {
    label: string;
    children: ReactNode;
    placement?: TooltipPlacement;
    align?: TooltipAlign;
    className?: string;
}

const PLACEMENT_CLASSES: Record<TooltipPlacement, Record<TooltipAlign, string>> = {
    top: {
        center: "bottom-full left-1/2 -translate-x-1/2 mb-1.5",
        start: "bottom-full left-0 mb-1.5",
        end: "bottom-full right-0 mb-1.5",
    },
    bottom: {
        center: "top-full left-1/2 -translate-x-1/2 mt-1.5",
        start: "top-full left-0 mt-1.5",
        end: "top-full right-0 mt-1.5",
    },
    left: {
        center: "right-full top-1/2 -translate-y-1/2 mr-1.5",
        start: "right-full top-1/2 -translate-y-1/2 mr-1.5",
        end: "right-full top-1/2 -translate-y-1/2 mr-1.5",
    },
    right: {
        center: "left-full top-1/2 -translate-y-1/2 ml-1.5",
        start: "left-full top-1/2 -translate-y-1/2 ml-1.5",
        end: "left-full top-1/2 -translate-y-1/2 ml-1.5",
    },
};

export const Tooltip = ({ label, children, placement = "top", align = "center", className = "" }: TooltipProps) => (
    <span className={`group/tip relative inline-flex ${className}`.trim()}>
        {children}
        <span
            className={`pointer-events-none absolute z-50 whitespace-nowrap rounded border border-white/5 bg-[#1e1f22] px-2 py-1 text-[10px] text-white opacity-0 shadow-xl transition-opacity duration-150 group-hover/tip:opacity-100 ${PLACEMENT_CLASSES[placement][align]}`}
        >
            {label}
        </span>
    </span>
);
