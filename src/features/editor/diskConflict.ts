/**
 * - "ignore": nothing to do (disk is what we already know, or the editor already matches it).
 * - "reload": the tab is clean, so it is silently replaced with the disk version.
 * - "conflict": the tab has unsaved changes and the disk changed to something new: ask.
 */
export type DiskChangeAction = "ignore" | "reload" | "conflict";

export interface DiskChangeInput {
    isDirty: boolean;
    tabContent: string;
    baseContent: string | undefined;
    diskContent: string;
    askedContent: string | undefined;
}

export interface SaveGuardInput {
    saveContent: string;
    baseContent: string | undefined;
    diskContent: string | undefined;
}

export const decideSaveGuard = ({ saveContent, baseContent, diskContent }: SaveGuardInput): "save" | "confirm" => {
    if (diskContent === undefined || baseContent === undefined) return "save";
    if (diskContent === baseContent || diskContent === saveContent) return "save";
    return "confirm";
};

export const decideDiskChange =({ isDirty, tabContent, baseContent, diskContent, askedContent }: DiskChangeInput): DiskChangeAction => {
    if (!isDirty) return diskContent === tabContent ? "ignore" : "reload";
    if (diskContent === baseContent || diskContent === tabContent) return "ignore";
    if (diskContent === askedContent) return "ignore";

    return "conflict";
};
