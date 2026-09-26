/** A small uppercase tag next to a title ("Experimental", "Modo avanzado"). */
export const Badge = ({ children }: { children: React.ReactNode }) => (
    <span className="ml-2 text-[9px] font-bold uppercase tracking-wide text-amber-400/80 bg-amber-400/10 px-1.5 py-0.5 rounded">
        {children}
    </span>
);
