/**
 * Pretend to be another system while developing, to see its interface from where you work:
 * `VITE_FORCE_PLATFORM=macos pnpm tauri dev`. Only the look changes (window controls, platform styles); what the
 * backend does by system (window sizing, paths) still follows the real one. Ignored in release builds.
 */
export const forcedPlatform: "macos" | "windows" | "linux" | null = import.meta.env.DEV
    ? ((import.meta.env.VITE_FORCE_PLATFORM as "macos" | "windows" | "linux" | undefined) ?? null)
    : null;

/** Whether the app is running on macOS. Synchronous on purpose: shortcuts are formatted while rendering. */
export const isMac = forcedPlatform ? forcedPlatform === "macos" : /Macintosh|Mac OS X/i.test(navigator.userAgent);
