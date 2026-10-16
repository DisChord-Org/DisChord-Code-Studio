import { useEffect, useRef } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Button, Logo } from "../../../components/ui";
import { showError } from "../../../utils/Dialogs";
import { supportServerUrl, websiteUrl } from "../../../utils/Links";

const open = async (url: string) => {
    try {
        await openUrl(url);
    } catch (error) {
        showError("No se pudo abrir el enlace: " + error);
    }
};

/** Visible around the middle and gone before the edges, so the dots frame the content instead of competing with it. */
const dotsFade = "radial-gradient(ellipse 55% 50% at 50% 46%, black, transparent 78%)";

/** How far around the pointer the dots show up. */
const pointerRadius = 150;
const pointerDotsMask = `radial-gradient(circle ${pointerRadius}px at var(--pointer-x) var(--pointer-y), rgba(0, 0, 0, 0.9), transparent)`;

const dotsImage = "[background-image:radial-gradient(#2a2e38_1px,transparent_1px)] [background-size:20px_20px]";

/**
 * Puts the pointer's position into CSS variables of `element` (so nothing in React re-renders) and shows or
 * hides the dots around it as the pointer enters and leaves.
 */
const usePointerPosition = (element: React.RefObject<HTMLDivElement | null>) => {
    useEffect(() => {
        const root = element.current;
        if (!root) return;

        const handleMove = (event: PointerEvent) => {
            const rect = root.getBoundingClientRect();
            root.style.setProperty("--pointer-x", `${event.clientX - rect.left}px`);
            root.style.setProperty("--pointer-y", `${event.clientY - rect.top}px`);
            root.style.setProperty("--pointer-opacity", "1");
        };
        const handleLeave = () => root.style.setProperty("--pointer-opacity", "0");

        root.addEventListener("pointermove", handleMove);
        root.addEventListener("pointerleave", handleLeave);
        return () => {
            root.removeEventListener("pointermove", handleMove);
            root.removeEventListener("pointerleave", handleLeave);
        };
    }, [element]);
};

/** What the editor shows when no tab is open: the mark, the name of the app and where to find the project. */
export const EmptyEditor = () => {
    const root = useRef<HTMLDivElement>(null);
    usePointerPosition(root);

    return (
        <div
            ref={root}
            className="relative h-full w-full flex flex-col items-center justify-center gap-5 select-none overflow-hidden"
            style={{ "--pointer-opacity": "0" } as React.CSSProperties}
        >
            <div
                aria-hidden="true"
                className={`absolute inset-0 pointer-events-none ${dotsImage}`}
                style={{ maskImage: dotsFade, WebkitMaskImage: dotsFade }}
            />

            {/* The same dots, very faint, around the pointer. */}
            <div
                aria-hidden="true"
                className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ${dotsImage}`}
                style={{ opacity: "calc(var(--pointer-opacity) * 0.6)", maskImage: pointerDotsMask, WebkitMaskImage: pointerDotsMask }}
            />

            <Logo size={72} className="relative opacity-90" />

            <p className="relative text-lg font-semibold tracking-tight text-gray-400">DisChord Code Studio</p>

            <div className="relative flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => open(supportServerUrl)} className="flex items-center gap-2">
                    <i className="bi bi-discord text-[13px]"></i>
                    Servidor de soporte
                </Button>
                <Button variant="secondary" size="sm" onClick={() => open(websiteUrl)} className="flex items-center gap-2">
                    <i className="bi bi-globe2 text-[13px]"></i>
                    Sitio web
                </Button>
            </div>
        </div>
    );
};
