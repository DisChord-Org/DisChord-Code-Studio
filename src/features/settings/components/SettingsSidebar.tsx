export const SettingsSidebar = () => (
    <aside className="w-52 bg-[#12151c] shadow-[1px_0_3px_0_rgba(0,0,0,0.35)] flex flex-col shrink-0 select-none relative z-10">
        <div className="px-3 pt-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">
            Configuración
        </div>

        <nav className="flex flex-col px-2 gap-0.5">
            <button className="flex items-center gap-2 px-2 py-1.5 rounded text-[12px] text-left bg-[#5865F2]/10 text-white transition-colors">
                <i className="bi bi-grid-3x3-gap-fill text-[11px]"></i>
                Dashboard
            </button>
        </nav>
    </aside>
);
