import { Button } from "../../../../components/ui";
interface OutputFiltersProps {
    problemsOnly: boolean;
    query: string;
    onToggleProblems: () => void;
    onQueryChange: (query: string) => void;
}

export const OutputFilters = ({ problemsOnly, query, onToggleProblems, onQueryChange }: OutputFiltersProps) => (
    <div className="shrink-0 flex items-center gap-2 pb-2">
        <Button variant="unstyled"
            onClick={onToggleProblems}
            className={`h-6 flex items-center px-2 rounded text-[10px] leading-none transition-colors ${problemsOnly ? "bg-red-500/20 text-red-300" : "bg-white/5 text-gray-500 hover:text-gray-300"}`}
        >
            <i className="bi bi-funnel mr-1" />
            Solo errores
        </Button>
        <div className="h-6 flex items-center gap-1.5 flex-1 max-w-[260px] px-2 rounded bg-white/5">
            <i className="bi bi-search text-[10px] leading-none text-gray-500" />
            <input
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder="Buscar en la salida"
                className="flex-1 min-w-0 h-full p-0 bg-transparent outline-none text-[11px] leading-none text-gray-200 placeholder:text-gray-600"
            />
            {query && (
                <Button variant="unstyled" onClick={() => onQueryChange("")} className="flex items-center text-gray-500 hover:text-white">
                    <i className="bi bi-x text-xs leading-none" />
                </Button>
            )}
        </div>
    </div>
);
