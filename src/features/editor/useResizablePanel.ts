import { useCallback, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";

interface UseResizablePanelOptions {
    initialSize: number;
    min: number;
    max: number;
    /** "x" for a sidebar-style panel (drag its vertical edge), "y" for a terminal-style panel (drag its horizontal edge). */
    axis: "x" | "y";
    /** Set when growing the panel means dragging toward the start of the axis (e.g. a top handle on a bottom panel). */
    invert?: boolean;
}

export const useResizablePanel = ({ initialSize, min, max, axis, invert = false }: UseResizablePanelOptions) => {
    const [size, setSize] = useState(initialSize);
    const sizeRef = useRef(initialSize);
    sizeRef.current = size;

    const startDrag = useCallback((e: ReactMouseEvent) => {
        e.preventDefault();
        const startPos = axis === "x" ? e.clientX : e.clientY;
        const startSize = sizeRef.current;
        document.body.style.cursor = axis === "x" ? "col-resize" : "row-resize";
        document.body.style.userSelect = "none";

        const handleMouseMove = (moveEvent: globalThis.MouseEvent) => {
            const current = axis === "x" ? moveEvent.clientX : moveEvent.clientY;
            const delta = current - startPos;
            const next = Math.min(max, Math.max(min, startSize + (invert ? -delta : delta)));
            setSize(next);
        };

        const handleMouseUp = () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
    }, [axis, invert, min, max]);

    return { size, startDrag };
};
