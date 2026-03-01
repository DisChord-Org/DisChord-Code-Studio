export const Title = ({ children }: { children: React.ReactNode }) => (
    <h1 className="text-2xl font-bold tracking-tight text-white mb-6">{children}</h1>
);

export const Label = ({ children }: { children: React.ReactNode }) => (
    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2 block">
        {children}
    </span>
);