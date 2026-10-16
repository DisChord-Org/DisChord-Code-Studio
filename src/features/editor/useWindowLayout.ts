import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow, LogicalSize, PhysicalPosition, PhysicalSize, currentMonitor } from "@tauri-apps/api/window";

const appWindow = getCurrentWindow();

const maximizeAttempts = 5;
const maximizeRetryDelayMs = 50;

let cachedPlatform: string | null = null;
const getPlatform = async () => {
    if (!cachedPlatform) cachedPlatform = await invoke<string>("get_platform");
    return cachedPlatform;
};

// Window operations run one after another so a fast project switch cannot interleave them.
let windowOpQueue: Promise<void> = Promise.resolve();
const enqueueWindowOp = (op: () => Promise<void>) => {
    windowOpQueue = windowOpQueue.then(op, op);
    return windowOpQueue;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const maximizeReliably = async () => {
    for (let attempt = 0; attempt < maximizeAttempts; attempt++) {
        await appWindow.maximize();
        await sleep(maximizeRetryDelayMs);
        if (await appWindow.isMaximized()) return;
    }
};

/** Maximizes the window while a project is open, restores the home size on leave, and tracks the maximized state. */
export const useWindowLayout = (projectName: string) => {
    const [isMaximized, setIsMaximized] = useState(true);

    useEffect(() => {
        enqueueWindowOp(async () => {
            await appWindow.setResizable(true);

            const platform = await getPlatform();
            if (platform === "macos") {
                const monitor = await currentMonitor();
                if (!monitor) return;
                const area = monitor.workArea;
                await appWindow.setPosition(new PhysicalPosition(area.position.x, area.position.y));
                await appWindow.setSize(new PhysicalSize(area.size.width, area.size.height));
            } else {
                await maximizeReliably();
            }
        });

        return () => {
            enqueueWindowOp(async () => {
                const platform = await getPlatform();
                if (platform !== "macos") {
                    await appWindow.unmaximize();
                }

                const { width, height } = await invoke<{ width: number; height: number }>("get_home_window_size");
                await appWindow.setSize(new LogicalSize(width, height));
                await appWindow.center();
                await appWindow.setResizable(false);
            });
        };
    }, [projectName]);

    useEffect(() => {
        const syncIsMaximized = () => appWindow.isMaximized().then(setIsMaximized).catch(console.error);
        syncIsMaximized();

        const unlisten = appWindow.onResized(syncIsMaximized);
        return () => {
            unlisten.then((cleanup) => cleanup());
        };
    }, []);

    return { isMaximized };
};
