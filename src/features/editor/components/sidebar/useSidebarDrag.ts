import { useRef, useState } from "react";
import type { FileNode } from "../../types";
import { canMoveInto } from "../../pathUtils";

const autoExpandDelayMs = 600;

interface UseSidebarDragOptions {
    expandedPaths: Set<string>;
    expand: (path: string) => void;
    moveInto: (path: string, targetDir: string) => Promise<void>;
}

/** Drag-and-drop state of the tree: what is dragged, where it would land, and hover auto-expand. */
export const useSidebarDrag = ({ expandedPaths, expand, moveInto }: UseSidebarDragOptions) => {
    const [dragPath, setDragPath] = useState<string | null>(null);
    const [dropTarget, setDropTarget] = useState<string | null>(null);
    const expandTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearExpandTimer = () => {
        if (expandTimer.current) clearTimeout(expandTimer.current);
        expandTimer.current = null;
    };

    const clearDrag = () => {
        clearExpandTimer();
        setDragPath(null);
        setDropTarget(null);
    };

    const hoverTarget = (targetDir: string, openable: FileNode | null, e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (dragPath === null || !canMoveInto(dragPath, targetDir)) {
            e.dataTransfer.dropEffect = "none";
            setDropTarget(null);
            return;
        }

        e.dataTransfer.dropEffect = "move";
        if (dropTarget !== targetDir) {
            setDropTarget(targetDir);
            clearExpandTimer();
            if (openable && !expandedPaths.has(openable.relative_path)) {
                expandTimer.current = setTimeout(() => expand(openable.relative_path), autoExpandDelayMs);
            }
        }
    };

    const dropInto = async (targetDir: string, e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const path = dragPath;
        clearDrag();
        if (path !== null && canMoveInto(path, targetDir)) await moveInto(path, targetDir);
    };

    return { dragPath, dropTarget, setDropTarget, setDragPath, clearDrag, hoverTarget, dropInto };
};
