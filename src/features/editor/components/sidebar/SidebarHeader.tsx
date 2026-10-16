import { Tooltip } from "../../../../components/ui";
import { CreateButtons } from "./CreateButtons";

interface SidebarHeaderProps {
    projectName: string;
    onCreate: (type: "file" | "folder") => void;
    onRefresh: () => void;
}

const buttonClassName = "text-gray-500 hover:text-accent p-0.5 rounded transition-colors";

export const SidebarHeader = ({ projectName, onCreate, onRefresh }: SidebarHeaderProps) => (
    <div className="group px-2 py-1 flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-gray-300 truncate px-1">
            {projectName}
        </span>
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <CreateButtons
                onCreateFile={() => onCreate("file")}
                onCreateFolder={() => onCreate("folder")}
                iconSize="text-[13px]"
                buttonClassName={buttonClassName}
            />
            <Tooltip label="Actualizar">
                <button onClick={onRefresh} className={buttonClassName}>
                    <i className="bi bi-arrow-clockwise text-[13px]"></i>
                </button>
            </Tooltip>
        </div>
    </div>
);
