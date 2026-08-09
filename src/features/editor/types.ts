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

export interface CodeCanvasHandle {
    scrollTo: (scrollTop: number) => void;
}
