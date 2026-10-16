import { Button } from "../../../../components/ui";
import { advancedTabs, basicTabs, tabLabels } from "./TerminalPanel.constants";
import type { TerminalTab } from "./types";

interface TerminalTabsProps {
    advanced: boolean;
    current: TerminalTab;
    onSelect: (tab: TerminalTab) => void;
}

export const TerminalTabs = ({ advanced, current, onSelect }: TerminalTabsProps) => (
    <div className="flex items-center gap-1">
        {(advanced ? advancedTabs : basicTabs).map((key) => (
            <Button variant="unstyled"
                key={key}
                onClick={() => onSelect(key)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest transition-colors ${
                    current === key ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"
                }`}
            >
                {tabLabels[key]}
            </Button>
        ))}
    </div>
);
