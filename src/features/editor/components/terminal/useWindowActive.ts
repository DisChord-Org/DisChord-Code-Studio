import { useEffect, useState } from "react";

/** Whether the user is looking at the window: focused and not minimized or behind another workspace. */
export const useWindowActive = () => {
    const read = () => document.hasFocus() && document.visibilityState === "visible";
    const [active, setActive] = useState(read);

    useEffect(() => {
        const update = () => setActive(read());
        window.addEventListener("focus", update);
        window.addEventListener("blur", update);
        document.addEventListener("visibilitychange", update);
        return () => {
            window.removeEventListener("focus", update);
            window.removeEventListener("blur", update);
            document.removeEventListener("visibilitychange", update);
        };
    }, []);

    return active;
};
