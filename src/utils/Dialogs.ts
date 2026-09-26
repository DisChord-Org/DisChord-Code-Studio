export interface DialogRequest {
    id: number;
    kind: "confirm" | "error";
    message: string;
    confirmLabel: string;
    resolve: (accepted: boolean) => void;
}

let nextId = 1;
let queue: DialogRequest[] = [];
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());

const enqueue = (request: Omit<DialogRequest, "id" | "resolve">) =>
    new Promise<boolean>((resolve) => {
        queue = [...queue, { ...request, id: nextId++, resolve }];
        notify();
    });

/** Asks a yes/no question with the app's own dialog. Never use `window.confirm`: the dialog plugin makes it async. */
export const confirmAction = (message: string, confirmLabel = "Aceptar") =>
    enqueue({ kind: "confirm", message, confirmLabel });

/** Shows an error with the app's own dialog; fire and forget. */
export const showError = (error: unknown) => {
    void enqueue({ kind: "error", message: String(error), confirmLabel: "Entendido" });
};

export const answerDialog = (id: number, accepted: boolean) => {
    const request = queue.find((r) => r.id === id);
    if (!request) return;

    queue = queue.filter((r) => r.id !== id);
    request.resolve(accepted);
    notify();
};

export const subscribeDialogs = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

export const currentDialog = (): DialogRequest | undefined => queue[0];
