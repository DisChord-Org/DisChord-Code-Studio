interface TabPageProps {
    title: string;
    description: string;
    onClose: () => void;
    /** Rendered under the title, inside the fixed header (a search box, for instance). */
    headerExtra?: React.ReactNode;
    children: React.ReactNode;
}

/** Layout of a full-size editor tab that is not a file: a fixed header and a scrolling body. */
export const TabPage = ({ title, description, onClose, headerExtra, children }: TabPageProps) => (
    <div className="h-full flex flex-col bg-app-bg">
        <div className="px-6 pt-5 pb-4 shrink-0 flex justify-center">
            <div className="max-w-3xl w-full">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-white font-semibold text-base">{title}</h2>
                        <p className="text-[11px] text-gray-500 mt-0.5">{description}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-white transition-colors rounded hover:bg-white/5"
                    >
                        <i className="bi bi-x-lg text-sm"></i>
                    </button>
                </div>

                {headerExtra}
            </div>
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto overflow-x-hidden px-6 pb-6">
            <div className="max-w-3xl w-full mx-auto space-y-6">{children}</div>
        </div>
    </div>
);
