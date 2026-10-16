import type { ITheme } from "@xterm/xterm";

export const terminalFontSize = 12;

export const terminalTheme: ITheme = {
    background: "#00000000",
    foreground: "#abb2bf",
    cursor: "#5865f2",
    selectionBackground: "#5865f233",
    // Same thin scrollbar as the rest of the app, instead of the system's.
    scrollbarSliderBackground: "#1e1f22",
    scrollbarSliderHoverBackground: "#5865F2",
    scrollbarSliderActiveBackground: "#5865F2",
};
