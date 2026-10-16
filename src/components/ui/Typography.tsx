export const Title = ({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) => {
    const heading = <h1 className="text-2xl font-bold tracking-tight text-white">{children}</h1>;

    return icon ? (
        <div className="flex items-center gap-3 mb-6">
            {icon}
            {heading}
        </div>
    ) : (
        <div className="mb-6">{heading}</div>
    );
};

export const Label = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
    <span className={`text-[10px] font-bold uppercase tracking-widest text-gray-500 block ${className}`.trim()}>
        {children}
    </span>
);