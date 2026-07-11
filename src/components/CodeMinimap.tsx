import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import { CHORD_THEME } from "../languages/chord-theme";
import {
    CHORD_KEYWORDS,
    CHORD_CONTROL_FLOW,
    CHORD_BUILTINS,
    CHORD_ATOMS,
} from "../languages/chord-language";

// Palabras clave "genéricas" para cuando el archivo abierto es JS/TS/JSON,
// no .chord. Las del lenguaje Chord vienen de chord-language.ts: una sola
// fuente de verdad, nada duplicado entre el editor y el minimapa.
const GENERIC_KEYWORDS = [
    "export", "import", "from", "const", "let", "var", "if", "else", "return",
    "class", "function", "interface", "type", "new", "this", "extends",
    "implements", "async", "await", "try", "catch", "finally", "switch",
    "case", "break", "continue", "for", "while", "do", "default", "public",
    "private", "protected", "static", "readonly", "as", "in", "of", "void",
];
const GENERIC_LITERALS = ["true", "false", "null", "undefined"];

const KEYWORDS = new Set(
    [...GENERIC_KEYWORDS, ...CHORD_KEYWORDS, ...CHORD_CONTROL_FLOW].map((w) => w.toLowerCase())
);
const LITERALS = new Set(
    [...GENERIC_LITERALS, ...CHORD_ATOMS].map((w) => w.toLowerCase())
);
const BUILTINS = new Set(CHORD_BUILTINS.map((w) => w.toLowerCase()));

const TOKEN_RE = /(\/\/.*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|([\p{L}_$][\p{L}\p{N}_$]*)|([{}[\]().,;:=+\-*/%<>!&|^~?])|(\s+)/gu;

interface Token {
    start: number;
    text: string;
    color: string;
    isIdentifier?: boolean;
}

const tokenizeLine = (line: string): Token[] => {
    const tokens: Token[] = [];
    TOKEN_RE.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = TOKEN_RE.exec(line)) !== null) {
        const [, comment, string, number, identifier, punct, space] = match;
        const start = match.index;

        if (space) continue;
        if (comment) { tokens.push({ start, text: comment, color: CHORD_THEME.comment }); continue; }
        if (string) { tokens.push({ start, text: string, color: CHORD_THEME.string }); continue; }
        if (number) { tokens.push({ start, text: number, color: CHORD_THEME.number }); continue; }
        if (punct) { tokens.push({ start, text: punct, color: CHORD_THEME.punctuation }); continue; }
        if (identifier) {
            const lower = identifier.toLowerCase();
            let color: string = CHORD_THEME.default;
            let isIdentifier = true;
            if (KEYWORDS.has(lower)) { color = CHORD_THEME.keyword; isIdentifier = false; }
            else if (LITERALS.has(lower)) { color = CHORD_THEME.number; isIdentifier = false; }
            else if (BUILTINS.has(lower)) { color = CHORD_THEME.function; isIdentifier = false; }
            tokens.push({ start, text: identifier, color, isIdentifier });
        }
    }

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (!token.isIdentifier) continue;
        const next = tokens[i + 1];
        if (next?.text === "(") token.color = CHORD_THEME.function;
        else if (next?.text === ":") token.color = CHORD_THEME.property;
    }

    return tokens;
};

const FONT_SIZE = 4;
const CHAR_WIDTH = 2;
const LINE_HEIGHT = 4;
const MINIMAP_WIDTH = 80;
const MAX_LINES = 5000;
const MIN_RECT_HEIGHT = 18; // igual que VS Code: por debajo de esto, arrastrar se vuelve impreciso

export interface MinimapViewport {
    scrollTop: number;
    scrollHeight: number;
    clientHeight: number;
}

interface CodeMinimapProps {
    text: string;
    viewport?: MinimapViewport;
    onScrollTo?: (scrollTop: number) => void;
}

export const CodeMinimap = ({ text, viewport, onScrollTo }: CodeMinimapProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [containerHeight, setContainerHeight] = useState(0);
    const draggingRef = useRef<{ grabOffset: number } | null>(null);

    const lines = useMemo(() => text.split('\n').slice(0, MAX_LINES), [text]);
    const linesTokens = useMemo(
        () => lines.map((line) => tokenizeLine(line.replace(/\t/g, "    "))),
        [lines]
    );

    const canvasHeight = Math.max(lines.length * LINE_HEIGHT, 1);

    // Mide el alto real visible del panel (no el del canvas, que puede ser
    // mucho más alto que lo que cabe en pantalla).
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
        canvas.width = MINIMAP_WIDTH * dpr;
        canvas.height = canvasHeight * dpr;
        canvas.style.width = `${MINIMAP_WIDTH}px`;
        canvas.style.height = `${canvasHeight}px`;

        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, MINIMAP_WIDTH, canvasHeight);
        ctx.textBaseline = "top";
        ctx.font = `${FONT_SIZE}px ui-monospace, "JetBrains Mono", "Fira Code", monospace`;

        linesTokens.forEach((tokens, i) => {
            const y = i * LINE_HEIGHT;
            for (const t of tokens) {
                const x = t.start * CHAR_WIDTH;
                if (x > MINIMAP_WIDTH) break;
                ctx.fillStyle = t.color;
                ctx.fillText(t.text, x, y);
            }
        });
    }, [linesTokens, canvasHeight]);

    // --- Rectángulo de viewport + sincronía de scroll con el editor ---
    // Si el minimapa es más alto que el panel visible, VS Code desplaza el
    // propio minimapa para que el rectángulo (lo que estás viendo) nunca
    // quede fuera de la pantalla. offsetY reproduce eso.
    const scrollableMinimap = Math.max(canvasHeight - containerHeight, 0);
    const scrollableEditor = viewport ? Math.max(viewport.scrollHeight - viewport.clientHeight, 0) : 0;
    const scrollRatio = scrollableEditor > 0 && viewport ? viewport.scrollTop / scrollableEditor : 0;
    const offsetY = -scrollRatio * scrollableMinimap;

    const rectHeight = viewport && viewport.scrollHeight > 0
        ? Math.max((viewport.clientHeight / viewport.scrollHeight) * canvasHeight, MIN_RECT_HEIGHT)
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

        // Si hacés click dentro del rectángulo, se agarra donde clickeaste
        // (como arrastrar un scrollbar). Si clickeás fuera, salta centrando
        // el rectángulo en ese punto — igual que en VS Code.
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
            className={`border-l border-[#1e1f22] bg-[#0B0E14] select-none overflow-hidden opacity-60 hover:opacity-100 transition-opacity duration-300 h-full shrink-0 relative ${viewport && onScrollTo ? "cursor-ns-resize" : ""}`}
            style={{ width: MINIMAP_WIDTH }}
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