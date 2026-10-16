interface LogoProps {
    /** Side in pixels; the mark is a rounded square. */
    size?: number;
    className?: string;
}

/** The DisChord mark, in the version drawn for small sizes (a thicker mark that fills its rounded square). */
export const Logo = ({ size = 22, className = "" }: LogoProps) => (
    <img
        src="/favicon.svg"
        alt=""
        aria-hidden="true"
        draggable={false}
        width={size}
        height={size}
        className={`shrink-0 select-none ${className}`}
    />
);
