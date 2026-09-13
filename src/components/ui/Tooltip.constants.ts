import type { TooltipAlign, TooltipPlacement } from "./Tooltip";

export const placementClasses: Record<TooltipPlacement, Record<TooltipAlign, string>> = {
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
