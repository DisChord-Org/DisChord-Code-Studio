import { isMac } from "../../../utils/Platform";
import { formatAcceleratorParts } from "../accelerator";

interface ShortcutKeysProps {
    accelerator: string;
    className?: string;
}

/** A shortcut drawn as key caps, in the notation of the current system. */
export const ShortcutKeys = ({ accelerator, className = "" }: ShortcutKeysProps) => {
    const parts = formatAcceleratorParts(accelerator, isMac);

    if (parts.length === 0) {
        return <span className={`text-[11px] text-gray-600 italic ${className}`}>Sin asignar</span>;
    }

    return (
        <span className={`inline-flex items-center gap-1 ${className}`}>
            {parts.map((part, i) => (
                <kbd
                    key={i}
                    className="min-w-[22px] px-1.5 py-0.5 text-center text-[11px] leading-none font-sans text-gray-200 bg-white/[0.06] border border-white/10 border-b-2 rounded"
                >
                    {part}
                </kbd>
            ))}
        </span>
    );
};
