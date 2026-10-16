import { useLayoutEffect, useRef } from "react";
import { stickToBottomThreshold } from "./RunOutput.constants";

/** Keeps a scroll container pinned to the bottom on new content, until the user scrolls away from it. */
export const useStickToBottom = (content: unknown) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const stickToBottom = useRef(true);

    useLayoutEffect(() => {
        const el = scrollRef.current;
        if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
    }, [content]);

    const handleScroll = () => {
        const el = scrollRef.current;
        if (!el) return;
        stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < stickToBottomThreshold;
    };

    return { scrollRef, handleScroll };
};
