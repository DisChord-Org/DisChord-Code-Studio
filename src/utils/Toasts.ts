export type ToastLevel = "success" | "info" | "warning" | "error";

export interface Toast {
    id: number;
    level: ToastLevel;
    message: string;
    /** Extra lines (one per package, a technical message...) shown only when asked for. */
    details: string[];
}

/** How long each kind stays on screen. Errors stay until they are closed: they may need reading twice. */
const lifetimeMs: Record<ToastLevel, number | null> = {
    success: 4000,
    info: 4000,
    warning: 8000,
    error: null,
};

const maxVisible = 4;

let nextId = 1;
let toasts: readonly Toast[] = [];
const listeners = new Set<() => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();

const notifyListeners = () => listeners.forEach((listener) => listener());

export const dismissToast = (id: number) => {
    clearTimeout(timers.get(id));
    timers.delete(id);

    if (!toasts.some((t) => t.id === id)) return;
    toasts = toasts.filter((t) => t.id !== id);
    notifyListeners();
};

/** Shows a short message that goes away by itself (except errors), without interrupting what the user is doing. */
export const notify = (level: ToastLevel, message: string, details: string[] = []) => {
    const toast: Toast = { id: nextId++, level, message, details };
    toasts = [...toasts, toast];
    while (toasts.length > maxVisible) {
        // Make room by dropping the oldest notice that is not an error: errors are the ones that must be read.
        const evicted = toasts.find((t) => t.level !== "error") ?? toasts[0];
        toasts = toasts.filter((t) => t.id !== evicted.id);
    }
    notifyListeners();

    const lifetime = lifetimeMs[level];
    if (lifetime !== null) timers.set(toast.id, setTimeout(() => dismissToast(toast.id), lifetime));

    // A toast pushed out by newer ones loses its timer too.
    for (const id of timers.keys()) {
        if (!toasts.some((t) => t.id === id)) {
            clearTimeout(timers.get(id));
            timers.delete(id);
        }
    }
};

export const subscribeToasts = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

export const getToasts = () => toasts;
