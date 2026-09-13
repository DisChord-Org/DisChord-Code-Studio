import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import { useConfig, buildFontFamilyCss } from "../../../settings";
import { chordTheme } from "../../../../languages/chord-theme";
import {
    chordKeywords,
    chordControlFlow,
    chordBuiltins,
    chordAtoms,
} from "../../../../languages/chord-language";
import type { MinimapViewport } from "../../types";

const genericKeywords = [
    "export", "import", "from", "const", "let", "var", "if", "else", "return",
    "class", "function", "interface", "type", "new", "this", "extends",
    "implements", "async", "await", "try", "catch", "finally", "switch",
    "case", "break", "continue", "for", "while", "do", "default", "public",
    "private", "protected", "static", "readonly", "as", "in", "of", "void",
];
const genericLiterals = ["true", "false", "null", "undefined"];

const keywordSet = new Set(
    [...genericKeywords, ...chordKeywords, ...chordControlFlow].map((w) => w.toLowerCase())
);
const literalSet = new Set(
    [...genericLiterals, ...chordAtoms].map((w) => w.toLowerCase())
);
const builtinSet = new Set(chordBuiltins.map((w) => w.toLowerCase()));

const tokenRe = /(\/\/.*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|([\p{L}_$][\p{L}\p{N}_$]*)|([{}[\]().,;:=+\-*/%<>!&|^~?])|(\s+)/gu;

interface Token {
    start: number;
    text: string;
    color: string;
    isIdentifier?: boolean;
}

const tokenizeLine = (line: string): Token[] => {
    const tokens: Token[] = [];
    tokenRe.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = tokenRe.exec(line)) !== null) {
        const [, comment, string, number, identifier, punct, space] = match;
        const start = match.index;

        if (space) continue;
        if (comment) { tokens.push({ start, text: comment, color: chordTheme.comment }); continue; }
        if (string) { tokens.push({ start, text: string, color: chordTheme.string }); continue; }
        if (number) { tokens.push({ start, text: number, color: chordTheme.number }); continue; }
        if (punct) { tokens.push({ start, text: punct, color: chordTheme.punctuation }); continue; }
        if (identifier) {
            const lower = identifier.toLowerCase();
            let color: string = chordTheme.default;
            let isIdentifier = true;
            if (keywordSet.has(lower)) { color = chordTheme.keyword; isIdentifier = false; }
            else if (literalSet.has(lower)) { color = chordTheme.number; isIdentifier = false; }
            else if (builtinSet.has(lower)) { color = chordTheme.function; isIdentifier = false; }
            tokens.push({ start, text: identifier, color, isIdentifier });
        }
    }

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (!token.isIdentifier) continue;
        const next = tokens[i + 1];
        if (next?.text === "(") token.color = chordTheme.function;
        else if (next?.text === ":") token.color = chordTheme.property;
    }

    return tokens;
};

const fontSize = 4;
const charWidth = 2;
const lineHeight = 4;
const minimapWidth = 80;
const maxLines = 5000;
const minRectHeight = 18;

interface CodeMinimapProps {
    text: string;
    viewport?: MinimapViewport;
    onScrollTo?: (scrollTop: number) => void;
}

export const CodeMinimap = ({ text, viewport, onScrollTo }: CodeMinimapProps) => {
    const { config } = useConfig();
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [containerHeight, setContainerHeight] = useState(0);
    const draggingRef = useRef<{ grabOffset: number } | null>(null);

    const lines = useMemo(() => text.split('\n').slice(0, maxLines), [text]);
    const linesTokens = useMemo(
        () => lines.map((line) => tokenizeLine(line.replace(/\t/g, "    "))),
        [lines]
    );

    const canvasHeight = Math.max(lines.length * lineHeight, 1);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const observer = new ResizeObserver((entries) => {
            setContainerHeight(entries[0].contentRect.height);
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = minimapWidth * dpr;
        canvas.height = canvasHeight * dpr;
        canvas.style.width = `${minimapWidth}px`;
        canvas.style.height = `${canvasHeight}px`;

        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, minimapWidth, canvasHeight);
        ctx.textBaseline = "top";
        ctx.font = `${fontSize}px ${buildFontFamilyCss(config.editor_font_family)}`;

        linesTokens.forEach((tokens, i) => {
            const y = i * lineHeight;
            for (const t of tokens) {
                const x = t.start * charWidth;
                if (x > minimapWidth) break;
                ctx.fillStyle = t.color;
                ctx.fillText(t.text, x, y);
            }
        });
    }, [linesTokens, canvasHeight, config.editor_font_family]);

    const scrollableMinimap = Math.max(canvasHeight - containerHeight, 0);
    const scrollableEditor = viewport ? Math.max(viewport.scrollHeight - viewport.clientHeight, 0) : 0;
    const scrollRatio = scrollableEditor > 0 && viewport ? viewport.scrollTop / scrollableEditor : 0;
    const offsetY = -scrollRatio * scrollableMinimap;

    const rectHeight = viewport && viewport.scrollHeight > 0
        ? Math.max((viewport.clientHeight / viewport.scrollHeight) * canvasHeight, minRectHeight)
        : canvasHeight;

    const maxRectTop = Math.max(canvasHeight - rectHeight, 0);
    const rawRectTop = viewport && viewport.scrollHeight > 0
        ? (viewport.scrollTop / viewport.scrollHeight) * canvasHeight
        : 0;
    const rectTop = Math.min(Math.max(rawRectTop, 0), maxRectTop);

    const updateScrollFromCanvasY = useCallback((canvasY: number, grabOffset: number) => {
        if (!viewport || !onScrollTo || scrollableEditor <= 0) return;
        const desiredRectTop = canvasY - grabOffset;
        const draggableRange = Math.max(canvasHeight - rectHeight, 1);
        const fraction = Math.min(Math.max(desiredRectTop / draggableRange, 0), 1);
        onScrollTo(fraction * scrollableEditor);
    }, [viewport, onScrollTo, scrollableEditor, canvasHeight, rectHeight]);

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0 || !viewport || !onScrollTo) return;
        const bounds = containerRef.current?.getBoundingClientRect();
        if (!bounds) return;

        const pointerY = e.clientY - bounds.top;
        const canvasY = pointerY - offsetY;
        const clickedInsideRect = canvasY >= rectTop && canvasY <= rectTop + rectHeight;

        const grabOffset = clickedInsideRect ? canvasY - rectTop : rectHeight / 2;

        draggingRef.current = { grabOffset };
        e.currentTarget.setPointerCapture(e.pointerId);
        updateScrollFromCanvasY(canvasY, grabOffset);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!draggingRef.current) return;
        const bounds = containerRef.current?.getBoundingClientRect();
        if (!bounds) return;

        const pointerY = e.clientY - bounds.top;
        const canvasY = pointerY - offsetY;
        updateScrollFromCanvasY(canvasY, draggingRef.current.grabOffset);
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        draggingRef.current = null;
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
        }
    };

    return (
        <div
            ref={containerRef}
            className={`shadow-[-1px_0_3px_0_rgba(0,0,0,0.25)] bg-app-bg select-none overflow-hidden opacity-60 hover:opacity-100 transition-opacity duration-300 h-full shrink-0 relative ${viewport && onScrollTo ? "cursor-ns-resize" : ""}`}
            style={{ width: minimapWidth }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
        >
            <div style={{ transform: `translateY(${offsetY}px)` }}>
                <canvas ref={canvasRef} className="block" />

                {viewport && (
                    <div
                        className="absolute left-0 right-0 bg-white/10 hover:bg-white/[0.15] border-y border-white/20 pointer-events-none transition-colors"
                        style={{ top: rectTop, height: rectHeight }}
                    />
                )}
            </div>
        </div>
    );
};