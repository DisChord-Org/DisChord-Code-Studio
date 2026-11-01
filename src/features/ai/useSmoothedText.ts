import { useEffect, useRef, useState } from "react";

const catchUpMs = 260;
const minCharsPerMs = 0.05;
const frameMs = 32;

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The server sends the answer in bursts; written as it comes, it jumps. This hands it out at an even pace, faster
 * when more is waiting, so it looks typed. A message that is already finished when it appears is shown whole.
 */
export const useSmoothedText = (target: string, streaming: boolean) => {
    const [shown, setShown] = useState(streaming ? "" : target);
    const position = useRef(streaming ? 0 : target.length);
    const latest = useRef(target);
    const frame = useRef(0);
    latest.current = target;

    useEffect(() => {
        if (prefersReducedMotion() || position.current > target.length) {
            position.current = target.length;
            setShown(target);
            return;
        }
        if (frame.current || position.current === target.length) return;

        let last = performance.now();
        let lastDraw = last;

        const step = (now: number) => {
            const text = latest.current;
            const backlog = text.length - position.current;
            position.current = Math.min(text.length, position.current + Math.max(backlog / catchUpMs, minCharsPerMs) * (now - last));
            last = now;

            if (now - lastDraw >= frameMs || position.current >= text.length) {
                lastDraw = now;
                let end = Math.floor(position.current);
                const code = text.charCodeAt(end - 1);
                if (end < text.length && code >= 0xd800 && code <= 0xdbff) end -= 1;
                setShown(text.slice(0, end));
            }
            frame.current = position.current < text.length ? requestAnimationFrame(step) : 0;
        };
        frame.current = requestAnimationFrame(step);
    }, [target]);

    useEffect(() => () => {
        cancelAnimationFrame(frame.current);
        frame.current = 0;
    }, []);

    return { shown, typing: shown.length < target.length };
};
