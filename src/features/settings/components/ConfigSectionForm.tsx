import type { ConfigField, ConfigFieldValue, ConfigSection } from "../configSections";

interface ConfigSectionFormProps {
    section: ConfigSection;
    onChange: (values: Record<string, ConfigFieldValue>) => void;
}

const optionButton = (active: boolean) =>
    `px-3 py-1.5 rounded-md border text-[12px] transition-colors ${
        active
            ? "bg-accent/10 border-accent/40 text-white"
            : "bg-white/[0.02] border-white/[0.06] text-gray-400 hover:bg-white/[0.04] hover:text-gray-200"
    }`;

const FieldControl = ({ field, value, onChange }: { field: ConfigField; value: ConfigFieldValue; onChange: (value: ConfigFieldValue) => void }) => {
    switch (field.type) {
        case "boolean":
            return (
                <span className={`shrink-0 w-9 h-5 rounded-full p-0.5 transition-colors ${value ? "bg-accent" : "bg-white/10"}`}>
                    <span className={`block w-4 h-4 rounded-full bg-white transition-transform ${value ? "translate-x-4" : "translate-x-0"}`} />
                </span>
            );
        case "select":
            return (
                <div className="flex items-center gap-1.5 flex-wrap">
                    {field.options.map((option) => (
                        <button key={option.value} onClick={() => onChange(option.value)} className={optionButton(value === option.value)}>
                            {option.label}
                        </button>
                    ))}
                </div>
            );
        case "number":
            return (
                <input
                    type="number"
                    value={Number(value)}
                    min={field.min ?? undefined}
                    max={field.max ?? undefined}
                    step={field.step ?? undefined}
                    onChange={(e) => onChange(Number(e.target.value))}
                    className="w-28 bg-border border border-border-strong rounded px-2 py-1.5 text-[12px] text-white outline-none focus:border-accent"
                />
            );
        case "text":
            return (
                <input
                    defaultValue={String(value)}
                    onBlur={(e) => onChange(e.target.value)}
                    className="w-full bg-border border border-border-strong rounded px-2 py-1.5 text-[12px] text-white outline-none focus:border-accent"
                />
            );
    }
};

export const ConfigSectionForm = ({ section, onChange }: ConfigSectionFormProps) => (
    <div className="max-w-xl flex flex-col">
        {section.schema.fields.map((field) => {
            const value = section.values[field.key] ?? field.default;
            const setValue = (next: ConfigFieldValue) => onChange({ ...section.values, [field.key]: next });

            if (field.type === "boolean") {
                return (
                    <div key={field.key} className="py-3 border-b border-white/5">
                        <button onClick={() => setValue(!value)} className="w-full flex items-center justify-between text-left">
                            <div>
                                <p className="text-sm text-gray-200 font-medium mb-0.5">{field.label}</p>
                                {field.description && <p className="text-xs text-gray-500">{field.description}</p>}
                            </div>
                            <span className="ml-3"><FieldControl field={field} value={value} onChange={setValue} /></span>
                        </button>
                    </div>
                );
            }

            return (
                <div key={field.key} className="py-3 border-b border-white/5">
                    <p className="text-sm text-gray-200 font-medium mb-0.5">{field.label}</p>
                    {field.description && <p className="text-xs text-gray-500 mb-3">{field.description}</p>}
                    <FieldControl field={field} value={value} onChange={setValue} />
                </div>
            );
        })}
    </div>
);
