import { useEffect, useRef } from "react";
import { isMac } from "../../utils/Platform";
import { isRiskyWithoutModifier, matchesAccelerator } from "./accelerator";
import { shortcutDefinitions } from "./definitions";
import { getBinding, loadKeybindings } from "./store";

type Handler = () => void;

/** Handlers per shortcut id; the latest registered one wins, so a screen can shadow the editor's. */
const handlers = new Map<string, Handler[]>();
let paused = 0;
let installed = false;

const isTerminalFocused = () => !!document.activeElement?.closest(".xterm");

const isTyping = (target: EventTarget | null) => {
    const element = target as HTMLElement | null;
    return !!element && (element.tagName === "INPUT" || element.tagName === "TEXTAREA" || element.isContentEditable);
};

const onKeyDown = (event: KeyboardEvent) => {
    if (paused > 0 || event.isComposing || event.repeat) return;

    for (const definition of shortcutDefinitions) {
        if (definition.scope !== "app") continue;

        const stack = handlers.get(definition.id);
        if (!stack || stack.length === 0) continue;

        const accelerator = getBinding(definition.id);
        if (!accelerator || !matchesAccelerator(event, accelerator, isMac)) continue;

        // xterm needs Ctrl+R, Ctrl+W... for the shell; and a bare key must not steal typing.
        if (isTerminalFocused() && !definition.allowInTerminal) continue;
        if (isTyping(event.target) && isRiskyWithoutModifier(accelerator, isMac)) continue;

        // Capture phase: this also keeps CodeMirror and friends from handling a key the user rebound.
        event.preventDefault();
        event.stopPropagation();
        stack[stack.length - 1]();
        return;
    }
};

/** Starts listening. Call once, when the app boots. */
export const startShortcuts = () => {
    if (installed) return;
    installed = true;

    window.addEventListener("keydown", onKeyDown, true);
    void loadKeybindings();
};

/** Makes the app ignore every shortcut until the returned function is called (used while recording a new one). */
export const pauseShortcuts = () => {
    paused++;
    let resumed = false;

    return () => {
        if (resumed) return;
        resumed = true;
        paused--;
    };
};

const register = (id: string, handler: Handler) => {
    handlers.set(id, [...(handlers.get(id) ?? []), handler]);

    return () => {
        const rest = (handlers.get(id) ?? []).filter((h) => h !== handler);
        if (rest.length > 0) handlers.set(id, rest);
        else handlers.delete(id);
    };
};

/** Runs `handler` when the shortcut `id` is pressed, for as long as the component is mounted. */
export const useShortcut = (id: string, handler: Handler, enabled = true) => {
    const latest = useRef(handler);
    latest.current = handler;

    useEffect(() => {
        if (!enabled) return;
        return register(id, () => latest.current());
    }, [id, enabled]);
};

/** Same as `useShortcut`, for a set of shortcuts at once (a list of hooks would break the rules of hooks). */
export const useShortcuts = (map: Record<string, Handler>, enabled = true) => {
    const latest = useRef(map);
    latest.current = map;
    const ids = Object.keys(map).join("|");

    useEffect(() => {
        if (!enabled) return;
        const unregister = ids.split("|").filter(Boolean).map((id) => register(id, () => latest.current[id]?.()));
        return () => unregister.forEach((off) => off());
    }, [ids, enabled]);
};
