import { useRef, useState, useEffect } from "react";
import type { MinimapViewport } from "./CodeCanvas";

const TRACK_WIDTH = 14;
const THUMB_WIDTH = 10;
const MIN_THUMB_HEIGHT = 20;

interface EditorScrollbarProps {
    viewport?: MinimapViewport;
    onScrollTo?: (scrollTop: number) => void;
}

export const EditorScrollbar = ({ viewport, onScrollTo }: EditorScrollbarProps) => {
    const trackRef = useRef<HTMLDivElement>(null);
    const [trackHeight, setTrackHeight] = useState(0);
    const draggingRef = useRef<{ grabOffset: number } | null>(null);

    useEffect(() => {
        const el = trackRef.current;
        if (!el) return;
        const observer = new ResizeObserver((entries) => setTrackHeight(entries[0].contentRect.height));
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    if (!viewport || viewport.scrollHeight <= viewport.clientHeight) {
        return <div ref={trackRef} style={{ width: TRACK_WIDTH }} className="h-full shrink-0 bg-[#0B0E14]" />;
    }

    const scrollableEditor = viewport.scrollHeight - viewport.clientHeight;
    const thumbHeight = Math.max((viewport.clientHeight / viewport.scrollHeight) * trackHeight, MIN_THUMB_HEIGHT);
    const maxThumbTop = Math.max(trackHeight - thumbHeight, 0);
    const thumbTop = scrollableEditor > 0 ? (viewport.scrollTop / scrollableEditor) * maxThumbTop : 0;

    const updateFromClientY = (clientY: number, grabOffset: number) => {
        const bounds = trackRef.current?.getBoundingClientRect();
        if (!bounds || !onScrollTo) return;
        const y = clientY - bounds.top - grabOffset;
        const fraction = maxThumbTop > 0 ? Math.min(Math.max(y / maxThumbTop, 0), 1) : 0;
        onScrollTo(fraction * scrollableEditor);
    };

    const beginDrag = (e: React.PointerEvent, grabbedThumb: boolean) => {
        if (e.button !== 0 || !onScrollTo) return;
        const bounds = trackRef.current?.getBoundingClientRect();
        if (!bounds) return;
        const pointerY = e.clientY - bounds.top;
        const grabOffset = grabbedThumb ? pointerY - thumbTop : thumbHeight / 2;
        draggingRef.current = { grabOffset };
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
        updateFromClientY(e.clientY, grabOffset);
    };

    const handleMove = (e: React.PointerEvent) => {
        if (!draggingRef.current) return;
        updateFromClientY(e.clientY, draggingRef.current.grabOffset);
    };

    const endDrag = (e: React.PointerEvent) => {
        draggingRef.current = null;
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
        }
    };

    return (
        <div
            ref={trackRef}
            className="h-full shrink-0 bg-[#0B0E14] relative"
            style={{ width: TRACK_WIDTH }}
            onPointerDown={(e) => beginDrag(e, false)}
            onPointerMove={handleMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
        >
            <div
                className="absolute bg-white/10 hover:bg-white/20 active:bg-white/25 transition-colors"
                style={{
                    top: thumbTop,
                    height: thumbHeight,
                    width: THUMB_WIDTH,
                    left: (TRACK_WIDTH - THUMB_WIDTH) / 2,
                }}
                onPointerDown={(e) => { e.stopPropagation(); beginDrag(e, true); }}
                onPointerMove={handleMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
            />
        </div>
    );
};