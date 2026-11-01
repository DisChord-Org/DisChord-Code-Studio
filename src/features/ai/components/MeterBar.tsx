/** "context" turns amber when nearly full; "quota" goes from blue to amber to red as an allowance runs out. */
type MeterKind = "context" | "quota";

const fillFor = (value: number, kind: MeterKind) => {
    if (kind === "context") return value >= 90 ? "bg-amber-400" : "bg-accent";
    if (value >= 90) return "bg-red-400";
    return value >= 70 ? "bg-amber-400" : "bg-accent";
};

/** A thin bar. */
export const MeterBar = ({ value, kind = "context", className = "" }: { value: number; kind?: MeterKind; className?: string }) => (
    <div className={`h-1 overflow-hidden rounded-full bg-white/10 ${className}`}>
        <div className={`h-full rounded-full transition-[width] duration-300 ${fillFor(value, kind)}`} style={{ width: `${value}%` }} />
    </div>
);

interface MeterProps {
    label: string;
    value: number;
    kind?: MeterKind;
    /** Which edge the hover card lines up with, so it never leaves the panel. */
    align: "left" | "right";
    children: React.ReactNode;
}

/** A labelled bar under the input, with its details in a card on hover. */
export const Meter = ({ label, value, kind = "context", align, children }: MeterProps) => (
    <div
        className="group relative -my-3 flex min-w-0 flex-1 items-center gap-1.5 py-3"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value)}
    >
        <div className={`absolute bottom-full z-30 mb-1 hidden w-60 flex-col gap-2 rounded-md border border-border bg-panel-alt p-3 text-[11px] text-gray-400 shadow-lg group-hover:flex ${align === "left" ? "left-0" : "right-0"}`}>
            {children}
        </div>
        <span className="shrink-0 text-[10px] text-gray-500">{label}</span>
        <MeterBar value={value} kind={kind} className="min-w-0 flex-1 cursor-default" />
    </div>
);
