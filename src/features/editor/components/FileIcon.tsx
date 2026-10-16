import { FileTypeIcon, FolderTypeIcon } from "../fileIcons";

const defaultIconSize = 14;
const genericFile = <i className="bi bi-file-earmark-text text-[12px] text-[#8c9491]" />;

/** The icon of a file by its name, so it can follow what is being typed. `.chord` files have the project's own. */
interface FileIconProps {
    name: string;
    size?: number;
}

export const FileIcon = ({ name, size = defaultIconSize }: FileIconProps) => {
    if (name.toLowerCase().endsWith(".chord")) {
        return <img src="/chord-file.svg" alt="" aria-hidden="true" draggable={false} width={size} height={size} className="shrink-0 select-none" />;
    }

    return <FileTypeIcon fileName={name} size={size} fallback={genericFile} />;
};

interface FolderIconProps {
    name: string;
    open: boolean;
    size?: number;
}

export const FolderIcon = ({ name, open, size = defaultIconSize }: FolderIconProps) => (
    <FolderTypeIcon
        folderName={name}
        open={open}
        size={size}
        fallback={
            open
                ? <i className="bi bi-folder2-open text-[#e8a87c] text-[12px]" />
                : <i className="bi bi-folder-fill text-[#8f8f8f] text-[12px]" />
        }
    />
);
