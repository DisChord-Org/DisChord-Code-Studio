export const Title = ({ children }: { children: React.ReactNode }) => (
    <h1 className="text-2xl font-bold tracking-tight text-white mb-6">{children}</h1>
);

export const Label = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
    <span className={`text-[10px] font-bold uppercase tracking-widest text-gray-500 block ${className}`.trim()}>
        {children}
    </span>
);