const safeProtocols = ["http:", "https:", "mailto:"];

const isUnsafeChar = (char: string) => {
    const code = char.charCodeAt(0);
    return code <= 0x20 || (code >= 0x7f && code <= 0x9f) || code === 0x2028 || code === 0x2029;
};

export const safeUrl = (url: string | null | undefined): string | null => {
    const trimmed = url?.trim();
    if (!trimmed || Array.from(trimmed).some(isUnsafeChar)) return null;
    try {
        const parsed = new URL(trimmed);
        return safeProtocols.includes(parsed.protocol.toLowerCase()) ? parsed.href : null;
    } catch {
        return null;
    }
};
