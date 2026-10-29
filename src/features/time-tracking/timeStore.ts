import { useSyncExternalStore } from "react";

const totalKey = "dischord:time:total";
const projectKey = (name: string) => `dischord:time:project:${name}`;
const msPerMinute = 60_000;

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

const cache = new Map<string, number>();

const read = (key: string): number => {
    const cached = cache.get(key);
    if (cached !== undefined) return cached;

    let value = 0;
    try {
        const stored = Number(localStorage.getItem(key));
        if (Number.isFinite(stored) && stored > 0) value = stored;
    } catch {
        // Unreadable storage counts as an empty counter.
    }
    cache.set(key, value);
    return value;
};

const write = (key: string, value: number) => {
    cache.set(key, value);
    try {
        localStorage.setItem(key, String(Math.round(value)));
    } catch {
        // Best-effort: losing a few seconds of the counter isn't worth an error.
    }
};

export const addTime = (ms: number, projectName: string | null) => {
    if (ms <= 0) return;
    write(totalKey, read(totalKey) + ms);
    if (projectName) write(projectKey(projectName), read(projectKey(projectName)) + ms);
    notify();
};

export const forgetProjectTime = (name: string) => {
    cache.set(projectKey(name), 0);
    try {
        localStorage.removeItem(projectKey(name));
    } catch {
        // Nothing stored, nothing to forget.
    }
    notify();
};

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

const wholeMinutes = (ms: number) => Math.floor(ms / msPerMinute) * msPerMinute;

export const useTotalTime = () => useSyncExternalStore(subscribe, () => wholeMinutes(read(totalKey)));
export const useProjectTime = (name: string) => useSyncExternalStore(subscribe, () => wholeMinutes(read(projectKey(name))));
