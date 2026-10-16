import { Tooltip } from "../../../../components/ui";

interface CreateButtonsProps {
    onCreateFile: () => void;
    onCreateFolder: () => void;
    /** Icon size class, since the header and the tree rows use different sizes. */
    iconSize: string;
    buttonClassName: string;
}

/** The "new file" / "new folder" icon buttons shared by the header and folder rows. */
export const CreateButtons = ({ onCreateFile, onCreateFolder, iconSize, buttonClassName }: CreateButtonsProps) => (
    <>
        <Tooltip label="Nuevo archivo">
            <button onClick={(e) => { e.stopPropagation(); onCreateFile(); }} className={buttonClassName}>
                <i className={`bi bi-file-earmark-plus ${iconSize}`}></i>
            </button>
        </Tooltip>
        <Tooltip label="Nueva carpeta">
            <button onClick={(e) => { e.stopPropagation(); onCreateFolder(); }} className={buttonClassName}>
                <i className={`bi bi-folder-plus ${iconSize}`}></i>
            </button>
        </Tooltip>
    </>
);
