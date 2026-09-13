interface ButtonProps {
    children: React.ReactNode;
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    size?: 'sm' | 'md';
    onClick?: () => void;
    className?: string;
    disabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
    title?: string;
}

export const Button = ({ children, variant = 'primary', size = 'md', onClick, className, disabled, type = 'button', title }: ButtonProps) => {
    const styles = {
        primary: "bg-accent hover:bg-accent-hover text-white",
        secondary: "bg-[#35393F] hover:bg-[#4F545C] text-gray-200",
        danger: "bg-transparent border border-red-500/50 text-red-400 hover:bg-red-500/10",
        ghost: "bg-transparent hover:bg-white/5 text-gray-400 hover:text-white"
    };
    const sizes = {
        md: "px-4 py-2 text-sm",
        sm: "px-3 py-1.5 text-xs",
    };

    return (
        <button
            type={type}
            title={title}
            onClick={onClick}
            disabled={disabled}
            className={`rounded-md font-medium transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 ${sizes[size]} ${styles[variant]} ${className}`}
        >
        {children}
        </button>
    );
};