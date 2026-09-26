import { useEffect, useRef, useState } from "react";

interface NameInputProps {
    initial?: string;
    /** Resolves to an error message to keep the input open, or null when the name was accepted. */
    onSubmit: (name: string) => Promise<string | null>;
    onCancel: () => void;
    /** Called on every keystroke, so the row can react to what is being typed. */
    onValueChange?: (value: string) => void;
}

/** The text field of an explorer row that is being created or renamed. */
export const NameInput = ({ initial = "", onSubmit, onCancel, onValueChange }: NameInputProps) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [value, setValue] = useState(initial);
    const [error, setError] = useState<string | null>(null);
    const busy = useRef(false);
    const settled = useRef(false);

    useEffect(() => {
        const input = inputRef.current;
        if (!input) return;
        input.focus();
        // Renaming "index.chord" selects "index", like VS Code.
        const dot = initial.lastIndexOf(".");
        input.setSelectionRange(0, dot > 0 ? dot : initial.length);
    }, [initial]);

    const cancel = () => {
        if (settled.current) return;
        settled.current = true;
        onCancel();
    };

    const submit = async () => {
        if (busy.current || settled.current) return;

        const name = value.trim();
        if (!name || name === initial) {
            cancel();
            return;
        }

        busy.current = true;
        const problem = await onSubmit(name);
        busy.current = false;

        if (problem) setError(problem);
        else settled.current = true;
    };

    return (
        <div className="flex-1 min-w-0 relative">
            <input
                ref={inputRef}
                value={value}
                spellCheck={false}
                onChange={(e) => {
                    setValue(e.target.value);
                    onValueChange?.(e.target.value);
                    setError(null);
                }}
                onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") submit();
                    else if (e.key === "Escape") cancel();
                }}
                onBlur={() => (error ? cancel() : submit())}
                onClick={(e) => e.stopPropagation()}
                className={`w-full h-5 px-1 text-[12px] text-white bg-[#0B0E14] rounded-sm outline-none border ${error ? "border-red-500" : "border-accent"}`}
            />
            {error && (
                <div className="absolute left-0 right-0 top-full mt-px z-30 px-1.5 py-1 text-[10px] leading-tight text-red-200 bg-red-950 border border-red-500 rounded-sm whitespace-normal">
                    {error}
                </div>
            )}
        </div>
    );
};
