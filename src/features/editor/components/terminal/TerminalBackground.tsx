import { backgroundDimRgb } from "./TerminalPanel.constants";

interface TerminalBackgroundProps {
    url: string;
    dim: number;
    fit: string;
}

export const TerminalBackground = ({ url, dim, fit }: TerminalBackgroundProps) => {
    const overlay = `rgba(${backgroundDimRgb}, ${dim / 100})`;

    return (
        <div
            className="absolute inset-0 pointer-events-none"
            style={{
                backgroundImage: `linear-gradient(${overlay}, ${overlay}), url("${url}")`,
                backgroundSize: `100% 100%, ${fit}`,
                backgroundPosition: `0 0, ${fit === "contain" ? "right center" : "center"}`,
                backgroundRepeat: "no-repeat",
                imageRendering: "pixelated",
            }}
        />
    );
};
