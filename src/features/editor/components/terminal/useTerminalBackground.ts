import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import bundledBackground from "../../../../assets/terminal-background.gif";
import type { AppConfig } from "../../../settings/types";

const mimeByExtension: Record<string, string> = {
    gif: "image/gif",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
};

/** Whether the user is looking at the window: focused and not minimized or behind another workspace. */
const useWindowActive = () => {
    const read = () => document.hasFocus() && document.visibilityState === "visible";
    const [active, setActive] = useState(read);

    useEffect(() => {
        const update = () => setActive(read());
        window.addEventListener("focus", update);
        window.addEventListener("blur", update);
        document.addEventListener("visibilitychange", update);
        return () => {
            window.removeEventListener("focus", update);
            window.removeEventListener("blur", update);
            document.removeEventListener("visibilitychange", update);
        };
    }, []);

    return active;
};

/** The first frame of an image as a still picture (an animated GIF keeps repainting the panel behind it). */
const useStillFrame = (url: string | null, needed: boolean): string | null => {
    const [still, setStill] = useState<string | null>(null);

    useEffect(() => {
        setStill(null);
        if (!url || !needed) return;

        let cancelled = false;
        let created: string | null = null;
        const image = new Image();
        image.src = url;

        image
            .decode()
            .then(() => {
                const canvas = document.createElement("canvas");
                canvas.width = image.naturalWidth;
                canvas.height = image.naturalHeight;
                canvas.getContext("2d")?.drawImage(image, 0, 0);
                canvas.toBlob((blob) => {
                    if (!blob) return;
                    created = URL.createObjectURL(blob);
                    if (cancelled) URL.revokeObjectURL(created);
                    else setStill(created);
                });
            })
            .catch(() => {});

        return () => {
            cancelled = true;
            if (created) URL.revokeObjectURL(created);
        };
    }, [url, needed]);

    return still;
};

/**
 * Resolves the terminal background to a URL: the bundled GIF, or the user's image loaded as a Blob.
 * A GIF only plays while the window is in use (and the user did not turn the animation off); otherwise
 * a still of its first frame is shown, which costs no repainting.
 */
export const useTerminalBackground = (config: AppConfig): string | null => {
    const [customUrl, setCustomUrl] = useState<string | null>(null);
    const source = config.terminal_background_source;
    const customPath = source === "custom" ? config.terminal_background_image : "";

    useEffect(() => {
        setCustomUrl(null);
        if (!customPath) return;

        let revoke: string | null = null;
        let cancelled = false;
        const extension = customPath.split(".").pop()?.toLowerCase() ?? "";

        invoke<number[]>("get_terminal_background_bytes", { path: customPath })
            .then((bytes) => {
                const blob = new Blob([new Uint8Array(bytes)], { type: mimeByExtension[extension] ?? "image/gif" });
                const url = URL.createObjectURL(blob);
                if (cancelled) {
                    URL.revokeObjectURL(url);
                    return;
                }
                revoke = url;
                setCustomUrl(url);
            })
            .catch((error) => console.error("No se pudo cargar la imagen de fondo de la terminal:", error));

        return () => {
            cancelled = true;
            if (revoke) URL.revokeObjectURL(revoke);
        };
    }, [customPath]);

    // A custom image that fails to load falls back to the bundled one.
    const imageUrl = source === "none" ? null : source === "custom" && customUrl ? customUrl : bundledBackground;

    const windowActive = useWindowActive();
    const mayAnimate = source === "bundled" || customPath.toLowerCase().endsWith(".gif");
    const playing = config.terminal_background_animated && windowActive;
    const still = useStillFrame(imageUrl, mayAnimate && !playing);

    return mayAnimate && !playing && still ? still : imageUrl;
};
