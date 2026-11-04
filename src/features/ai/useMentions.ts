import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { filterPaths } from "../search/fuzzy";

const maxOptions = 8;
const mentionPattern = /@([\w./@-]+)/g;

export const mentionAt = (text: string, caret: number): { start: number; query: string } | null => {
    const match = /(^|\s)@([\w./@-]*)$/.exec(text.slice(0, caret));
    return match ? { start: caret - match[2].length - 1, query: match[2] } : null;
};

export const useMentions = (projectName: string) => {
    const [paths, setPaths] = useState<string[]>([]);
    const loaded = useRef(false);

    useEffect(() => {
        loaded.current = false;
        setPaths([]);
    }, [projectName]);

    const load = useCallback(() => {
        if (loaded.current) return;
        loaded.current = true;
        invoke<string[]>("list_project_paths", { projectName })
            .then(setPaths)
            .catch(() => {
                loaded.current = false;
            });
    }, [projectName]);

    const options = useCallback((query: string) => filterPaths(paths, query, maxOptions), [paths]);

    const mentioned = useCallback((text: string) => {
        const known = new Set(paths);
        return [...new Set(Array.from(text.matchAll(mentionPattern), (m) => m[1]).filter((p) => known.has(p)))];
    }, [paths]);

    return { load, options, mentioned };
};
