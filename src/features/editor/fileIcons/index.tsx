import { useSyncExternalStore } from "react";

/** What `scripts/generate-file-icons.mjs` produces from Material Icon Theme. */
interface IconMapping {
    file: string;
    folder: string;
    folderExpanded: string;
    fileNames: Record<string, string>;
    fileExtensions: Record<string, string>;
    folderNames: Record<string, string>;
    folderNamesExpanded: Record<string, string>;
}

interface IconData {
    mapping: IconMapping;
    drawings: Record<string, string>;
}

let data: IconData | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

const ensureLoaded = () => {
    loading ??= Promise.all([import("./mapping.json"), import("./icons.json")])
        .then(([mapping, drawings]) => {
            data = { mapping: mapping.default as IconMapping, drawings: drawings.default as Record<string, string> };
            listeners.forEach((listener) => listener());
        })
        .catch((error) => {
            loading = null;
            console.error("No se pudieron cargar los iconos de archivo:", error);
        });
};

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    ensureLoaded();
    return () => listeners.delete(listener);
};

const useIconData = () => useSyncExternalStore(subscribe, () => data);

export const iconNameForFile = (fileName: string, mapping: IconMapping): string => {
    const lower = fileName.toLowerCase();
    const byName = mapping.fileNames[lower];
    if (byName) return byName;

    const parts = lower.split(".");
    for (let i = 1; i < parts.length; i++) {
        const byExtension = mapping.fileExtensions[parts.slice(i).join(".")];
        if (byExtension) return byExtension;
    }

    return mapping.file;
};

export const iconNameForFolder = (folderName: string, open: boolean, mapping: IconMapping): string => {
    const lower = folderName.toLowerCase();
    if (open) return mapping.folderNamesExpanded[lower] ?? mapping.folderNames[lower] ?? mapping.folderExpanded;
    return mapping.folderNames[lower] ?? mapping.folder;
};

const drawingViewBox = 16;
const defaultIconSize = 14;

interface DrawingProps {
    drawing: string;
    size: number;
}

/** The drawings are 16x16 and trusted: they come from the package, not from the user. */
const Drawing = ({ drawing, size }: DrawingProps) => (
    <svg
        viewBox={`0 0 ${drawingViewBox} ${drawingViewBox}`}
        width={size}
        height={size}
        className="shrink-0"
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: drawing }}
    />
);

interface FileTypeIconProps {
    fileName: string;
    size?: number;
    fallback: React.ReactNode;
}

export const FileTypeIcon = ({ fileName, size = defaultIconSize, fallback }: FileTypeIconProps) => {
    const icons = useIconData();
    if (!icons) return <>{fallback}</>;

    const drawing = icons.drawings[iconNameForFile(fileName, icons.mapping)];
    return drawing ? <Drawing drawing={drawing} size={size} /> : <>{fallback}</>;
};

interface FolderTypeIconProps {
    folderName: string;
    open: boolean;
    size?: number;
    fallback: React.ReactNode;
}

export const FolderTypeIcon = ({ folderName, open, size = defaultIconSize, fallback }: FolderTypeIconProps) => {
    const icons = useIconData();
    if (!icons) return <>{fallback}</>;

    const drawing = icons.drawings[iconNameForFolder(folderName, open, icons.mapping)];
    return drawing ? <Drawing drawing={drawing} size={size} /> : <>{fallback}</>;
};
