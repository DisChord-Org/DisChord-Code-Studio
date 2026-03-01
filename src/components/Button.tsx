interface ButtonProps {
    children: React.ReactNode;
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    onClick?: () => void;
    className?: string;
}

export const Button = ({ children, variant = 'primary', onClick, className }: ButtonProps) => {
    const styles = {
        primary: "bg-[#5865F2] hover:bg-[#4752C4] text-white",
        secondary: "bg-[#35393F] hover:bg-[#4F545C] text-gray-200",
        danger: "bg-transparent border border-red-500/50 text-red-400 hover:bg-red-500/10",
        ghost: "bg-transparent hover:bg-white/5 text-gray-400 hover:text-white"
    };

    return (
        <button 
            onClick={onClick}
            className={`px-4 py-2 rounded-md font-medium transition-all active:scale-95 text-sm ${styles[variant]} ${className}`}
        >
        {children}
        </button>
    );
};