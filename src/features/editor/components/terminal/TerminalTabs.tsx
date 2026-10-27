import { Button } from "../../../../components/ui";
import { advancedTabs, basicTabs, tabLabels } from "./TerminalPanel.constants";
import type { TerminalTab } from "./types";

interface TerminalTabsProps {
    advanced: boolean;
    current: TerminalTab;
    onSelect: (tab: TerminalTab) => void;
    shells: readonly number[];
    activeShell: number;
    onSelectShell: (key: number) => void;
    onAddShell: () => void;
    onCloseShell: (key: number) => void;
}

const tabClass = (on: boolean) =>
    `px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest transition-colors ${on ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"}`;

export const TerminalTabs = ({ advanced, current, onSelect, shells, activeShell, onSelectShell, onAddShell, onCloseShell }: TerminalTabsProps) => (
    <div className="flex items-center gap-1">
        {(advanced ? advancedTabs : basicTabs).filter((key) => key !== "shell").map((key) => (
            <Button variant="unstyled" key={key} onClick={() => onSelect(key)} className={tabClass(current === key)}>
                {tabLabels[key]}
            </Button>
        ))}
        {advanced && shells.map((key, index) => {
            const on = current === "shell" && key === activeShell;
            return (
                <div key={key} className={`flex items-center rounded ${on ? "bg-white/10" : ""}`}>
                    <Button
                        variant="unstyled"
                        onClick={() => onSelectShell(key)}
                        className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${on ? "text-white" : "text-gray-500 hover:text-gray-300"}`}
                    >
                        {shells.length > 1 ? `${tabLabels.shell} ${index + 1}` : tabLabels.shell}
                    </Button>
                    {shells.length > 1 && (
                        <Button
                            variant="unstyled"
                            aria-label={`Cerrar ${tabLabels.shell} ${index + 1}`}
                            onClick={() => onCloseShell(key)}
                            className="mr-1 w-4 h-4 flex items-center justify-center rounded text-gray-500 hover:text-white hover:bg-white/15 transition-colors"
                        >
                            <i className="bi bi-x-lg text-[9px]" aria-hidden="true" />
                        </Button>
                    )}
                </div>
            );
        })}
        {advanced && (
            <Button variant="unstyled" aria-label="Nueva terminal" title="Nueva terminal" onClick={onAddShell} className="ml-1 w-5 h-5 flex items-center justify-center rounded text-gray-500 hover:text-white hover:bg-white/10 transition-colors">
                <i className="bi bi-plus-lg text-[11px]" aria-hidden="true" />
            </Button>
        )}
    </div>
);
