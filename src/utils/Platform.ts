/** Whether the app is running on macOS. Synchronous on purpose: shortcuts are formatted while rendering. */
export const isMac = /Macintosh|Mac OS X/i.test(navigator.userAgent);
