import type { OpenTab } from "../../types";

interface TabBarProps {
    tabs: OpenTab[];
    activePath: string | null;
    onSelect: (path: string) => void;
    onClose: (path: string) => void;
}

export const TabBar = ({ tabs, activePath, onSelect, onClose }: TabBarProps) => {
    if (tabs.length === 0) return null;

    return (
        <div className="custom-scrollbar flex items-stretch gap-1 bg-panel-alt px-2 pt-1.5 shadow-[0_1px_3px_0_rgba(0,0,0,0.3)] overflow-x-auto shrink-0 select-none relative z-[5]">
            {tabs.map((tab) => {
                const isActive = tab.relative_path === activePath;

                return (
                    <div
                        key={tab.relative_path}
                        onClick={() => onSelect(tab.relative_path)}
                        onMouseDown={(e) => {
                            if (e.button === 1) {
                                e.preventDefault();
                                onClose(tab.relative_path);
                            }
                        }}
                        className={`group relative flex items-center gap-2 pl-3 pr-2 py-2 text-[12px] rounded-t-md cursor-pointer min-w-[110px] max-w-[200px] transition-all duration-150
                            ${isActive
                                ? "bg-app-bg text-white shadow-[0_-2px_8px_-2px_rgba(0,0,0,0.5)]"
                                : "bg-white/[0.02] text-gray-500 hover:bg-white/[0.05] hover:text-gray-300"
                            }`}
                    >
                        {isActive && (
                            <span className="absolute top-1.5 left-1/2 -translate-x-1/2 w-5 h-[2px] rounded-full bg-accent" />
                        )}

                        {tab.kind === "packages" && <i className="bi bi-box-seam-fill text-[11px] shrink-0"></i>}
                        <span className="truncate flex-1">{tab.name}</span>

                        <button
                            onClick={(e) => { e.stopPropagation(); onClose(tab.relative_path); }}
                            className="shrink-0 w-4 h-4 flex items-center justify-center rounded hover:bg-white/10 hover:text-white transition-colors"
                        >
                            <span className={`w-1.5 h-1.5 bg-accent rounded-full ${tab.isDirty ? "block group-hover:hidden" : "hidden"}`} />
                            <i className="bi bi-x text-[13px] hidden group-hover:inline"></i>
                        </button>
                    </div>
                );
            })}
        </div>
    );
};
