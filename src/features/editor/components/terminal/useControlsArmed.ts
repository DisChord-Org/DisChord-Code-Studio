import { useEffect, useState } from "react";
import { controlsArmDelayMs } from "./TerminalPanel.constants";

/** True once the program has been running for a moment, so the stop/restart dots do not flash on quick runs. */
export const useControlsArmed = (isRunning: boolean) => {
    const [armed, setArmed] = useState(false);

    useEffect(() => {
        if (!isRunning) {
            setArmed(false);
            return;
        }
        const timer = setTimeout(() => setArmed(true), controlsArmDelayMs);
        return () => clearTimeout(timer);
    }, [isRunning]);

    return armed;
};
