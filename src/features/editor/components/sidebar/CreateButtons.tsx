import { Tooltip, Button } from "../../../../components/ui";

interface CreateButtonsProps {
    onCreateFile: () => void;
    onCreateFolder: () => void;
    iconSize: string;
    buttonClassName: string;
}

/** The "new file" / "new folder" icon buttons shared by the header and folder rows. */
export const CreateButtons = ({ onCreateFile, onCreateFolder, iconSize, buttonClassName }: CreateButtonsProps) => (
    <>
        <Tooltip label="Nuevo archivo">
            <Button variant="unstyled" onClick={(e) => { e.stopPropagation(); onCreateFile(); }} className={buttonClassName}>
                <i className={`bi bi-file-earmark-plus ${iconSize}`}></i>
            </Button>
        </Tooltip>
        <Tooltip label="Nueva carpeta">
            <Button variant="unstyled" onClick={(e) => { e.stopPropagation(); onCreateFolder(); }} className={buttonClassName}>
                <i className={`bi bi-folder-plus ${iconSize}`}></i>
            </Button>
        </Tooltip>
    </>
);
