import { useEffect, useState } from "react";
import { clockTickMs } from "./RunOutput.constants";

/** Current time, refreshed every second while `ticking` (so a running duration advances). */
export const useNow = (ticking: boolean) => {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (!ticking) return;
        const timer = setInterval(() => setNow(Date.now()), clockTickMs);
        return () => clearInterval(timer);
    }, [ticking]);

    return now;
};
