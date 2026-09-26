export interface FileNode {
    name: string;
    is_dir: boolean;
    relative_path: string;
    children?: FileNode[];
}

export interface MinimapViewport {
    scrollTop: number;
    scrollHeight: number;
    clientHeight: number;
}

/** Ask the editor to put the cursor somewhere; `nonce` makes repeated requests to the same spot count. */
export interface GotoTarget {
    path: string;
    line: number;
    column: number;
    nonce: number;
}

export interface CodeCanvasHandle {
    scrollTo: (scrollTop: number) => void;
}

/** Sentinel id for the "Dependencias" pseudo-tab, reusing `relative_path` as the generic tab id. */
export const PACKAGES_TAB_ID = "__packages__";

export interface OpenTab {
    kind: "file" | "packages";
    relative_path: string;
    name: string;
    content: string;
    isDirty: boolean;
    /** False for a "preview" tab: opening another file replaces it. Becomes true once it is edited. */
    isPinned: boolean;
}
