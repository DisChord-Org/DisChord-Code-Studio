import { useState } from "react";
import { NameInput } from "./NameInput";
import { useSidebar } from "./SidebarContext";
import { FileIcon, FolderIcon } from "../FileIcon";

interface CreateRowProps {
    level: number;
}

/** The row shown while a new file or folder is being named. */
export const CreateRow = ({ level }: CreateRowProps) => {
    const { creating, onCreateSubmit, onCreateCancel } = useSidebar();
    const [typedName, setTypedName] = useState("");
    if (!creating) return null;

    return (
        <div className="pr-2 py-0.5 flex items-center gap-1.5" style={{ paddingLeft: `${level * 10 + 8}px` }}>
            <span className="w-[8px] shrink-0" />
            {creating.type === "folder"
                ? <FolderIcon name={typedName.trim()} open={false} />
                : <FileIcon name={typedName.trim()} />}
            <NameInput onSubmit={onCreateSubmit} onCancel={onCreateCancel} onValueChange={setTypedName} />
        </div>
    );
};
