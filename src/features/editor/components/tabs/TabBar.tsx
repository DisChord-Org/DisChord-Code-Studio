import type { OpenTab } from "../../types";
import { Tooltip } from "../../../../components/ui/Tooltip";

interface TabBarProps {
    tabs: OpenTab[];
    activePath: string | null;
    onSelect: (path: string) => void;
    onClose: (path: string) => void;
}

export const TabBar = ({ tabs, activePath, onSelect, onClose }: TabBarProps) => {
    if (tabs.length === 0) return null;

    return (
        <div className="flex items-stretch bg-[#12151c] shadow-[0_1px_3px_0_rgba(0,0,0,0.3)] overflow-x-auto shrink-0 select-none relative z-[5]">
            {tabs.map((tab) => {
                const isActive = tab.relative_path === activePath;

                return (
                    <div
                        key={tab.relative_path}
                        onClick={() => onSelect(tab.relative_path)}
                        title={tab.relative_path}
                        className={`group flex items-center gap-2 pl-3 pr-2 py-2 text-[12px] border-r border-white/[0.04] border-t-2 cursor-pointer shrink-0 max-w-[180px] transition-colors
                            ${isActive
                                ? "bg-[#0B0E14] text-white border-t-[#5865F2]"
                                : "text-gray-500 hover:bg-white/[0.03] hover:text-gray-300 border-t-transparent"
                            }`}
                    >
                        <span className="truncate flex-1">{tab.name}</span>

                        <Tooltip label="Cerrar (Ctrl+W)" placement="bottom">
                            <button
                                onClick={(e) => { e.stopPropagation(); onClose(tab.relative_path); }}
                                className="shrink-0 w-4 h-4 flex items-center justify-center rounded hover:bg-white/10 hover:text-white transition-colors"
                            >
                                <span className={`w-1.5 h-1.5 bg-[#5865F2] rounded-full ${tab.isDirty ? "block group-hover:hidden" : "hidden"}`} />
                                <i className="bi bi-x text-[13px] hidden group-hover:inline"></i>
                            </button>
                        </Tooltip>
                    </div>
                );
            })}
        </div>
    );
};
