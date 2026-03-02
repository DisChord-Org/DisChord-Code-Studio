export interface FileNode {
    name: string;
    is_dir: boolean;
    relative_path: string;
    children?: FileNode[];
}