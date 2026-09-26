import { useMemo, useState } from "react";
import { Label, TabPage } from "../../../components/ui";
import { fixedShortcuts, groupLabels, groupOrder, shortcutDefinitions } from "../definitions";
import { useKeybindings } from "../store";
import type { ShortcutGroup } from "../types";
import { ShortcutKeys } from "./ShortcutKeys";

interface ShortcutsReferenceProps {
    onClose: () => void;
}

interface Row {
    key: string;
    label: string;
    accelerator: string;
    note?: string;
}

/** The "Atajos de teclado" tab: every shortcut in force, as configured now. */
export const ShortcutsReference = ({ onClose }: ShortcutsReferenceProps) => {
    const bindings = useKeybindings();
    const [query, setQuery] = useState("");

    const groups = useMemo(() => {
        const needle = query.trim().toLowerCase();
        const byGroup = new Map<ShortcutGroup, Row[]>();

        const add = (group: ShortcutGroup, row: Row) => {
            if (needle && !row.label.toLowerCase().includes(needle)) return;
            byGroup.set(group, [...(byGroup.get(group) ?? []), row]);
        };

        for (const definition of shortcutDefinitions) {
            add(definition.group, {
                key: definition.id,
                label: definition.label,
                accelerator: bindings[definition.id] ?? "",
                note: definition.advancedOnly ? "Modo avanzado" : undefined,
            });
        }
        for (const fixed of fixedShortcuts) {
            add(fixed.group, { key: `fixed:${fixed.label}`, label: fixed.label, accelerator: fixed.accelerator });
        }

        return groupOrder.filter((g) => byGroup.has(g)).map((g) => ({ group: g, rows: byGroup.get(g)! }));
    }, [bindings, query]);

    return (
        <TabPage
            title="Atajos de teclado"
            description="Los atajos activos ahora mismo. Puedes cambiarlos en Ajustes → Atajos."
            onClose={onClose}
            headerExtra={
                <div className="mt-4 flex items-center gap-2.5 border-b border-white/10 focus-within:border-accent/60 pb-2 transition-colors">
                    <i className="bi bi-search text-gray-600 text-xs"></i>
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Buscar un atajo..."
                        className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-600"
                    />
                </div>
            }
        >
            {groups.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                    <i className="bi bi-keyboard text-xl text-gray-700"></i>
                    <p className="text-xs text-gray-500">Ningún atajo coincide con la búsqueda.</p>
                </div>
            )}

            {groups.map(({ group, rows }) => (
                <section key={group}>
                    <Label>{groupLabels[group]}</Label>
                    <div className="mt-1 divide-y divide-white/[0.05]">
                        {rows.map((row) => (
                            <div key={row.key} className="-mx-2 px-2 py-2 flex items-center justify-between gap-4 rounded-md hover:bg-white/[0.03] transition-colors">
                                <span className="text-xs text-gray-300">
                                    {row.label}
                                    {row.note && (
                                        <span className="ml-2 text-[9px] font-bold uppercase tracking-wide text-amber-400/80 bg-amber-400/10 px-1.5 py-0.5 rounded">{row.note}</span>
                                    )}
                                </span>
                                <ShortcutKeys accelerator={row.accelerator} />
                            </div>
                        ))}
                    </div>
                </section>
            ))}
        </TabPage>
    );
};
