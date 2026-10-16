import { useState } from "react";
import { EmptyRunOutput } from "./EmptyRunOutput";
import { OutputFilters } from "./OutputFilters";
import { RunBlock } from "./RunBlock";
import { useOutputRuns } from "./outputStore";
import { useStickToBottom } from "./useStickToBottom";
import type { OpenLocationHandler } from "./types";

interface RunOutputProps {
    className?: string;
    onOpenLocation: OpenLocationHandler;
}

export const RunOutput = ({ className = "", onOpenLocation }: RunOutputProps) => {
    const runs = useOutputRuns();
    const { scrollRef, handleScroll } = useStickToBottom(runs);
    // Only the latest run is open unless the user toggled one by hand.
    const [toggled, setToggled] = useState<Record<number, boolean>>({});
    const [problemsOnly, setProblemsOnly] = useState(false);
    const [query, setQuery] = useState("");
    const lastRunId = runs[runs.length - 1]?.id;

    if (runs.length === 0) return <EmptyRunOutput className={className} />;

    return (
        <div className={`flex flex-col ${className}`}>
            <OutputFilters
                problemsOnly={problemsOnly}
                query={query}
                onToggleProblems={() => setProblemsOnly((v) => !v)}
                onQueryChange={setQuery}
            />

            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="custom-scrollbar flex-1 min-h-0 overflow-y-auto select-text text-xs font-[family-name:var(--editor-font-family)]"
            >
                {runs.map((run) => (
                    <RunBlock
                        key={run.id}
                        run={run}
                        expanded={toggled[run.id] ?? run.id === lastRunId}
                        problemsOnly={problemsOnly}
                        query={query}
                        onOpenLocation={onOpenLocation}
                        onToggle={() => setToggled((prev) => ({ ...prev, [run.id]: !(prev[run.id] ?? run.id === lastRunId) }))}
                    />
                ))}
            </div>
        </div>
    );
};
