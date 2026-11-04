import { useEffect, useState } from "react";
import type { DragEvent } from "react";
import { tabDragType } from "./components/tabs/TabBar";

export const useTabDrop = (isOnRight: (path: string) => boolean, movePane: (path: string) => void) => {
    const [draggingTab, setDraggingTab] = useState(false);

    useEffect(() => {
        const start = (event: globalThis.DragEvent) => setDraggingTab(!!event.dataTransfer?.types.includes(tabDragType));
        const stop = () => setDraggingTab(false);
        window.addEventListener("dragstart", start);
        window.addEventListener("dragend", stop);
        window.addEventListener("drop", stop);
        return () => {
            window.removeEventListener("dragstart", start);
            window.removeEventListener("dragend", stop);
            window.removeEventListener("drop", stop);
        };
    }, []);

    const dropOn = (side: "left" | "right") => ({
        onDragOver: (event: DragEvent) => {
            if (event.dataTransfer.types.includes(tabDragType)) event.preventDefault();
        },
        onDrop: (event: DragEvent) => {
            const path = event.dataTransfer.getData(tabDragType);
            if (!path) return;
            event.preventDefault();

            if ((side === "right") !== isOnRight(path)) movePane(path);
        },
    });

    return { draggingTab, dropOn };
};
