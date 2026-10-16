import { useState } from "react";
import { stripAnsi } from "./outputText";
import type { OutputLine } from "./types";

interface OutputDetailsProps {
    lines: OutputLine[];
}

export const OutputDetails = ({ lines }: OutputDetailsProps) => {
    const [open, setOpen] = useState(false);

    return (
        <div>
            <button
                onClick={() => setOpen((v) => !v)}
                className="flex items-center gap-2 px-2 py-0.5 text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
            >
                <i className={`bi bi-chevron-right text-[8px] transition-transform ${open ? "rotate-90" : ""}`} />
                Detalles técnicos ({lines.length} líneas)
            </button>
            {open && (
                <div className="pl-5 text-gray-500 opacity-80">
                    {lines.map((line) => (
                        <div key={line.id} className="px-2 whitespace-pre-wrap break-words">{stripAnsi(line.text)}</div>
                    ))}
                </div>
            )}
        </div>
    );
};
