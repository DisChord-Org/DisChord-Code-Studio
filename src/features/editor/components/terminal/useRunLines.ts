import { useMemo } from "react";
import { groupLines, isProblem } from "./groupLines";
import { stripAnsi } from "./outputText";
import type { OutputItem, OutputRun } from "./types";

/** Filters a run's lines by the errors toggle and the search, and groups them unless a filter is active. */
export const useRunLines = (run: OutputRun, problemsOnly: boolean, query: string) => {
    const visible = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return run.lines.filter((l) => (!problemsOnly || isProblem(l.kind)) && (!needle || stripAnsi(l.text).toLowerCase().includes(needle)));
    }, [run.lines, problemsOnly, query]);

    // Grouping hides lines, which would fight with a search or the errors filter.
    const items = useMemo<OutputItem[]>(
        () => (query.trim() || problemsOnly ? visible.map((line) => ({ type: "line", line })) : groupLines(visible)),
        [visible, query, problemsOnly],
    );

    return { visible, items };
};
