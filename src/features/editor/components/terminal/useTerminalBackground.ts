import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import bundledBackground from "../../../../assets/terminal-background.gif";
import type { AppConfig } from "../../../settings/types";
import { defaultMimeType, mimeByExtension } from "./useTerminalBackground.constants";
import { useStillFrame } from "./useStillFrame";
import { useWindowActive } from "./useWindowActive";

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
                const blob = new Blob([new Uint8Array(bytes)], { type: mimeByExtension[extension] ?? defaultMimeType });
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
