import amaya from "../assets/amaya.png";

interface AmayaIconProps {
    /** Side in pixels. */
    size?: number;
    className?: string;
}

/** Amaya's avatar. */
export const AmayaIcon = ({ size = 16, className = "" }: AmayaIconProps) => (
    <img
        src={amaya}
        alt=""
        aria-hidden="true"
        draggable={false}
        width={size}
        height={size}
        // The size is set in style as well: the page's reset makes images `height: auto`, which a flex row then stretches.
        style={{ width: size, height: size }}
        className={`shrink-0 select-none rounded-md object-cover ${className}`}
    />
);
