import { useEffect, useRef } from "react";
import { addTime } from "./timeStore";
import { countedTime, tickMs } from "./tracking";

const activityEvents = ["keydown", "pointerdown", "pointermove", "wheel"] as const;

export const useTimeTracker = (projectName: string | null, enabled: boolean) => {
    const projectRef = useRef(projectName);
    projectRef.current = projectName;

    useEffect(() => {
        if (!enabled) return;

        let lastActivity = Date.now();
        let lastTick = Date.now();
        const markActive = () => {
            lastActivity = Date.now();
        };
        activityEvents.forEach((name) => window.addEventListener(name, markActive, { passive: true }));

        const tick = () => {
            const now = Date.now();
            const focused = document.hasFocus() && document.visibilityState === "visible";
            addTime(countedTime({ lastTick, now, lastActivity, focused }), projectRef.current);
            lastTick = now;
        };
        const timer = setInterval(tick, tickMs);

        return () => {
            clearInterval(timer);
            tick();
            activityEvents.forEach((name) => window.removeEventListener(name, markActive));
        };
    }, [enabled]);
};
