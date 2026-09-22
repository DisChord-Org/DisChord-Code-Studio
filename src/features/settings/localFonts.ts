import { invoke } from "@tauri-apps/api/core";

/** Fonts this app can fetch on demand instead of requiring an OS-level install. */
export const downloadableFonts = new Set(["JetBrains Mono", "Fira Code", "Cascadia Code"]);

const registeredFaces = new Map<string, FontFace>();

/**
 * Loads a font already saved on disk and registers it with the WebView's FontFace set, from
 * raw bytes rather than a URL: loading a local file by URL through the asset protocol is
 * unreliable across WebViews for fonts specifically (WebKitGTK discards it at render time as
 * if it were cross-origin, even though the underlying fetch succeeds), so we sidestep that by
 * handing FontFace the bytes directly.
 */
export const registerLocalFont = async (name: string): Promise<void> => {
    if (registeredFaces.has(name)) return;

    const bytes = await invoke<number[]>("get_font_bytes", { name });
    const face = new FontFace(name, new Uint8Array(bytes).buffer);
    await face.load();
    document.fonts.add(face);
    registeredFaces.set(name, face);
};

/** Deletes a downloaded font from disk and unregisters it from the current session. */
export const removeDownloadedFont = async (name: string): Promise<void> => {
    await invoke("delete_font", { name });

    const face = registeredFaces.get(name);
    if (face) {
        document.fonts.delete(face);
        registeredFaces.delete(name);
    }
};

let loadedOnce = false;

/** Re-registers fonts downloaded in a previous session, so they work again without re-downloading. */
export const loadDownloadedFonts = async (): Promise<void> => {
    if (loadedOnce) return;
    loadedOnce = true;

    try {
        const fonts = await invoke<{ name: string }[]>("list_downloaded_fonts");
        await Promise.all(fonts.map((font) => registerLocalFont(font.name)));
    } catch (error) {
        console.error("No se pudieron cargar las tipografías descargadas:", error);
    }
};

/** Downloads a font (if not already on disk) and registers it for immediate use. */
export const downloadFont = async (name: string): Promise<void> => {
    await invoke<string>("download_font", { name });
    await registerLocalFont(name);
};
