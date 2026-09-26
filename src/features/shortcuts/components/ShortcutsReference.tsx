import { useMemo, useState } from "react";
import { Badge, EmptyState, Label, ListGroup, ListRow, TabPage } from "../../../components/ui";
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
                <EmptyState icon="bi-keyboard">Ningún atajo coincide con la búsqueda.</EmptyState>
            )}

            {groups.map(({ group, rows }) => (
                <section key={group}>
                    <Label>{groupLabels[group]}</Label>
                    <ListGroup className="mt-1">
                        {rows.map((row) => (
                            <ListRow key={row.key} padding="sm" className="flex items-center justify-between gap-4">
                                <span className="text-xs text-gray-300">
                                    {row.label}
                                    {row.note && <Badge>{row.note}</Badge>}
                                </span>
                                <ShortcutKeys accelerator={row.accelerator} />
                            </ListRow>
                        ))}
                    </ListGroup>
                </section>
            ))}
        </TabPage>
    );
};
