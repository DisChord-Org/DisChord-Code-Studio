import { createContext, useContext } from "react";
import type { FileNode } from "../../types";

export interface SidebarContextValue {
    selectedPath: string | null;
    onSelect: (path: string) => void;
    expandedPaths: Set<string>;
    onToggleExpand: (path: string) => void;
    onFileClick: (node: FileNode) => void;
    onContextMenu: (e: React.MouseEvent, path: string) => void;
    onCreateRequest: (type: "file" | "folder", parentPath: string) => void;

    /** Where the inline "new file/folder" input is showing, if anywhere. */
    creating: { type: "file" | "folder"; parentPath: string } | null;
    onCreateSubmit: (name: string) => Promise<string | null>;
    onCreateCancel: () => void;

    renamingPath: string | null;
    onRenameSubmit: (path: string, name: string) => Promise<string | null>;
    onRenameCancel: () => void;

    dragPath: string | null;
    /** Folder ("" = project root) the dragged item would land in. */
    dropTarget: string | null;
    onDragStart: (path: string) => void;
    onDragEnd: () => void;
    onDragOverItem: (node: FileNode, e: React.DragEvent) => void;
    onDropOnItem: (node: FileNode, e: React.DragEvent) => void;
}

export const SidebarContext = createContext<SidebarContextValue | null>(null);

export const useSidebar = (): SidebarContextValue => {
    const value = useContext(SidebarContext);
    if (!value) throw new Error("useSidebar must be used inside <Sidebar>");
    return value;
};
