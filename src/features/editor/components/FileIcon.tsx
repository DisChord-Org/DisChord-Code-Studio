import { FileTypeIcon, FolderTypeIcon } from "../fileIcons";

const genericFile = <i className="bi bi-file-earmark-text text-[12px] text-[#8c9491]" />;

/** The icon of a file by its name, so it can follow what is being typed. `.chord` keeps the project's own "D". */
export const FileIcon = ({ name, size = 14 }: { name: string; size?: number }) => {
    if (name.toLowerCase().endsWith(".chord")) {
        return <span className="text-accent font-black text-[12px] w-[13px] text-center leading-none shrink-0">D</span>;
    }

    return <FileTypeIcon fileName={name} size={size} fallback={genericFile} />;
};

export const FolderIcon = ({ name, open, size = 14 }: { name: string; open: boolean; size?: number }) => (
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
