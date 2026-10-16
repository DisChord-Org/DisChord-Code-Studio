import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { placementTransforms, tooltipGapPx, tooltipZIndex } from "./Tooltip.constants";
import type { TooltipAnchor } from "./Tooltip.constants";

export type TooltipPlacement = "top" | "bottom" | "left" | "right";
export type TooltipAlign = "center" | "start" | "end";

interface TooltipProps {
    label: string;
    children: ReactNode;
    placement?: TooltipPlacement;
    align?: TooltipAlign;
    className?: string;
}

const anchorFor = (rect: DOMRect, placement: TooltipPlacement, align: TooltipAlign): TooltipAnchor => {
    if (placement === "left" || placement === "right") {
        return {
            x: placement === "left" ? rect.left - tooltipGapPx : rect.right + tooltipGapPx,
            y: rect.top + rect.height / 2,
        };
    }

    const x = align === "start" ? rect.left : align === "end" ? rect.right : rect.left + rect.width / 2;
    return { x, y: placement === "top" ? rect.top - tooltipGapPx : rect.bottom + tooltipGapPx };
};

export const Tooltip = ({ label, children, placement = "top", align = "center", className = "" }: TooltipProps) => {
    const triggerRef = useRef<HTMLSpanElement>(null);
    const [anchor, setAnchor] = useState<TooltipAnchor | null>(null);

    const show = () => {
        if (triggerRef.current) setAnchor(anchorFor(triggerRef.current.getBoundingClientRect(), placement, align));
    };
    const hide = () => setAnchor(null);

    return (
        <span
            ref={triggerRef}
            onMouseEnter={show}
            onMouseLeave={hide}
            onMouseDown={hide}
            className={`relative inline-flex ${className}`.trim()}
        >
            {children}
            {anchor && createPortal(
                <span
                    role="tooltip"
                    style={{
                        left: anchor.x,
                        top: anchor.y,
                        transform: placementTransforms[placement][align],
                        zIndex: tooltipZIndex,
                    }}
                    className="pointer-events-none fixed whitespace-nowrap rounded border border-white/5 bg-border px-2 py-1 text-[10px] text-white shadow-xl"
                >
                    {label}
                </span>,
                document.body,
            )}
        </span>
    );
};
