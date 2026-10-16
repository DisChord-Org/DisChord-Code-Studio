import { useEffect, useState } from "react";

const noticeDurationMs = 4000;

/** A message that clears itself after a few seconds. */
export const useTimedNotice = () => {
    const [notice, setNotice] = useState<string | null>(null);

    useEffect(() => {
        if (!notice) return;
        const timer = setTimeout(() => setNotice(null), noticeDurationMs);
        return () => clearTimeout(timer);
    }, [notice]);

    return { notice, setNotice };
};
