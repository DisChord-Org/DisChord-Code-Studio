const guardWindowMs = 600;

let lastRelease = 0;

/** Whether the mouse's middle button was released a moment ago (a paste right now probably comes from it). */
export const middleClickJustHappened = () => performance.now() - lastRelease < guardWindowMs;

/** Whether the middle button should keep working where `target` is: plain text fields and the terminal. */
const keepsPaste = (target: EventTarget | null) => {
    const element = target as HTMLElement | null;
    return !!(element?.closest("input, textarea, .xterm") || (element?.closest("[contenteditable]") && !element.closest(".cm-editor")));
};

export const installMiddleClickGuard = () => {
    const cancel = (event: MouseEvent) => {
        if (event.button !== 1) return;
        if (event.type === "mouseup") lastRelease = performance.now();
        if (!keepsPaste(event.target)) event.preventDefault();
    };

    // Capturing: this has to win over whatever the page does with the event.
    for (const type of ["mousedown", "mouseup", "auxclick"] as const) {
        document.addEventListener(type, cancel, true);
    }
};
