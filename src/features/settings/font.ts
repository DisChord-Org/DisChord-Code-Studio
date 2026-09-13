const genericFamilies = new Set(["monospace", "sans-serif", "serif", "ui-monospace", "system-ui", "cursive", "fantasy"]);

/** Turns a font name (e.g. "Monocraft") into a valid CSS font-family value with a fallback. */
export const buildFontFamilyCss = (name: string): string => {
    const trimmed = name.trim();
    if (!trimmed) return "monospace";
    if (genericFamilies.has(trimmed.toLowerCase())) {
        return trimmed.toLowerCase() === "ui-monospace" ? "ui-monospace, monospace" : trimmed;
    }
    return `'${trimmed.replace(/'/g, "\\'")}', monospace`;
};

/**
 * Best-effort check for whether a font with this name is actually available: either bundled
 * in the app via @font-face, or installed on the OS. Browsers don't expose a reliable API for
 * this (to prevent fingerprinting), so we measure the width of a test string instead: if it
 * matches every generic family's width exactly, the browser almost certainly fell back silently
 * because the font doesn't exist.
 */
export const isFontAvailable = async (name: string): Promise<boolean> => {
    const trimmed = name.trim();
    if (!trimmed || genericFamilies.has(trimmed.toLowerCase())) return true;
    if (typeof document === "undefined" || !("fonts" in document)) return true;

    try {
        await document.fonts.load(`72px "${trimmed}"`);
    } catch {
        // Can fail if the browser doesn't recognize the name as a loadable font; not
        // conclusive on its own, so we still fall through to the measurement below.
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return true;

    const testString = "mmmmmmmmmmlli";
    const fallbacks = ["monospace", "sans-serif", "serif"];

    return fallbacks.some((fallback) => {
        ctx.font = `72px ${fallback}`;
        const baselineWidth = ctx.measureText(testString).width;

        ctx.font = `72px "${trimmed}", ${fallback}`;
        const targetWidth = ctx.measureText(testString).width;

        return targetWidth !== baselineWidth;
    });
};
