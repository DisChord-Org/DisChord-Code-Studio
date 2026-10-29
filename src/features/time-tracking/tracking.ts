const idleLimitMs = 2 * 60_000;
export const tickMs = 10_000;

const maxCountedGapMs = tickMs * 3;

interface TickInput {
    lastTick: number;
    now: number;
    lastActivity: number;
    focused: boolean;
}

export const countedTime = ({ lastTick, now, lastActivity, focused }: TickInput): number => {
    const elapsed = now - lastTick;
    if (!focused || elapsed <= 0 || elapsed > maxCountedGapMs) return 0;
    if (now - lastActivity > idleLimitMs) return 0;
    return elapsed;
};
