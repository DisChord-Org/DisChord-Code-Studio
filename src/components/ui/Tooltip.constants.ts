import type { TooltipAlign, TooltipPlacement } from "./Tooltip";

export const tooltipGapPx = 6;

// Above every other layer (modals, toasts, menus), so no stacking context can cover it.
export const tooltipZIndex = 1000;

export interface TooltipAnchor {
    x: number;
    y: number;
}

/** Translation that places the tooltip box relative to its anchor point. */
export const placementTransforms: Record<TooltipPlacement, Record<TooltipAlign, string>> = {
    top: {
        center: "translate(-50%, -100%)",
        start: "translate(0, -100%)",
        end: "translate(-100%, -100%)",
    },
    bottom: {
        center: "translate(-50%, 0)",
        start: "translate(0, 0)",
        end: "translate(-100%, 0)",
    },
    left: {
        center: "translate(-100%, -50%)",
        start: "translate(-100%, -50%)",
        end: "translate(-100%, -50%)",
    },
    right: {
        center: "translate(0, -50%)",
        start: "translate(0, -50%)",
        end: "translate(0, -50%)",
    },
};
