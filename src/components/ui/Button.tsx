interface ButtonProps {
    children?: React.ReactNode;
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'unstyled';
    size?: 'sm' | 'md';
    onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
    className?: string;
    disabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
    title?: string;
    style?: React.CSSProperties;
}

const baseStyles = "rounded-md font-medium transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100";

export const Button = ({ children, variant = 'primary', size = 'md', onClick, className = "", disabled, type = 'button', title, style }: ButtonProps) => {
    const styles = {
        primary: "bg-accent hover:bg-accent-hover text-white",
        secondary: "bg-[#35393F] hover:bg-[#4F545C] text-gray-200",
        danger: "bg-transparent border border-red-500/50 text-red-400 hover:bg-red-500/10",
        ghost: "bg-transparent hover:bg-white/5 text-gray-400 hover:text-white",
        unstyled: ""
    };
    const sizes = {
        md: "px-4 py-2 text-sm",
        sm: "px-3 py-1.5 text-xs",
    };

    const classes = variant === 'unstyled'
        ? className
        : `${baseStyles} ${sizes[size]} ${styles[variant]} ${className}`;

    return (
        <button
            type={type}
            title={title}
            style={style}
            onClick={onClick}
            disabled={disabled}
            className={classes.trim()}
        >
        {children}
        </button>
    );
};
