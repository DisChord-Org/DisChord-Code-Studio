import { useEffect, useState } from "react";
import { Badge, ListGroup } from "../../../components/ui";
import { isMac } from "../../../utils/Platform";
import { acceleratorFromEvent, normalizeAccelerator } from "../accelerator";
import { pauseShortcuts } from "../dispatcher";
import { defaultFor, getKeybindingOverrides, setKeybindingOverrides, useKeybindings } from "../store";
import { groupLabels, groupOrder, shortcutDefinitions } from "../definitions";
import { findConflicts, problemWith, withBinding } from "../validation";
import type { KeybindingOverrides, ShortcutDefinition } from "../types";
import { ShortcutKeys } from "./ShortcutKeys";

interface ShortcutSettingsProps {
    /** Persists the overrides (into config.json). */
    onSave: (overrides: KeybindingOverrides) => void;
}

interface Pending {
    definition: ShortcutDefinition;
    accelerator: string;
    conflicts: ShortcutDefinition[];
}

export const ShortcutSettings = ({ onSave }: ShortcutSettingsProps) => {
    const bindings = useKeybindings();
    const [recording, setRecording] = useState<string | null>(null);
    const [problem, setProblem] = useState<{ id: string; message: string } | null>(null);
    const [pending, setPending] = useState<Pending | null>(null);

    const commit = (next: KeybindingOverrides) => {
        setKeybindingOverrides(next);
        onSave(next);
    };

    const assign = (definition: ShortcutDefinition, accelerator: string, clearing: ShortcutDefinition[] = []) => {
        let next = withBinding(getKeybindingOverrides(), definition.id, accelerator);
        for (const other of clearing) next = { ...next, [other.id]: "" };
        commit(next);
        setPending(null);
        setProblem(null);
    };

    const tryAssign = (definition: ShortcutDefinition, accelerator: string) => {
        const issue = problemWith(definition, accelerator);
        if (issue) {
            setProblem({ id: definition.id, message: issue });
            return;
        }

        const conflicts = findConflicts(definition.id, accelerator, bindings);
        if (conflicts.length > 0) {
            setPending({ definition, accelerator, conflicts });
            setProblem(null);
            return;
        }

        assign(definition, accelerator);
    };

    // While recording, the whole window listens for the next key press and nothing else reacts to it.
    useEffect(() => {
        if (!recording) return;

        const resume = pauseShortcuts();
        const definition = shortcutDefinitions.find((d) => d.id === recording);

        const handleKey = (event: KeyboardEvent) => {
            event.preventDefault();
            event.stopPropagation();

            if (event.key === "Escape") {
                setRecording(null);
                return;
            }

            const accelerator = acceleratorFromEvent(event, isMac);
            if (!accelerator || !definition) return;

            setRecording(null);
            tryAssign(definition, accelerator);
        };

        window.addEventListener("keydown", handleKey, true);
        return () => {
            window.removeEventListener("keydown", handleKey, true);
            resume();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [recording]);

    const isCustom = (id: string) => getKeybindingOverrides()[id] !== undefined;
    const anyCustom = Object.keys(getKeybindingOverrides()).length > 0;

    return (
        <div className="max-w-2xl">
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-white/5">
                <p className="text-xs text-gray-500">
                    Haz clic en un atajo y pulsa la nueva combinación (Esc cancela).
                    {" "}Lo guardado con {isMac ? "⌘" : "Ctrl"} se adapta solo a cada sistema.
                </p>
                <button
                    onClick={() => commit({})}
                    disabled={!anyCustom}
                    className="shrink-0 text-[11px] font-medium text-gray-400 hover:text-white transition-colors disabled:opacity-30 disabled:hover:text-gray-400"
                >
                    <i className="bi bi-arrow-counterclockwise mr-1" />
                    Restaurar todos
                </button>
            </div>

            {groupOrder.map((group) => {
                const definitions = shortcutDefinitions.filter((d) => d.group === group);
                if (definitions.length === 0) return null;

                return (
                    <section key={group} className="pt-4">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1">{groupLabels[group]}</p>
                        <ListGroup>
                            {definitions.map((definition) => {
                                const isRecording = recording === definition.id;
                                const rowProblem = problem?.id === definition.id ? problem.message : null;
                                const rowPending = pending?.definition.id === definition.id ? pending : null;

                                return (
                                    <div key={definition.id} className="py-2">
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="min-w-0">
                                                <p className="text-xs text-gray-200">
                                                    {definition.label}
                                                    {definition.advancedOnly && (
                                                        <Badge>Modo avanzado</Badge>
                                                    )}
                                                </p>
                                                {definition.description && <p className="text-[10px] text-gray-600">{definition.description}</p>}
                                            </div>

                                            <div className="shrink-0 flex items-center gap-2">
                                                {isCustom(definition.id) && (
                                                    <button
                                                        onClick={() => assign(definition, defaultFor(definition.id))}
                                                        title="Restaurar el atajo por defecto"
                                                        className="text-gray-600 hover:text-white transition-colors"
                                                    >
                                                        <i className="bi bi-arrow-counterclockwise text-xs" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => { setPending(null); setProblem(null); setRecording(isRecording ? null : definition.id); }}
                                                    className={`min-w-[120px] px-2 py-1 rounded border transition-colors ${
                                                        isRecording
                                                            ? "border-accent bg-accent/10 text-accent text-[11px]"
                                                            : "border-transparent hover:border-white/10 hover:bg-white/[0.04]"
                                                    }`}
                                                >
                                                    {isRecording ? "Pulsa las teclas…" : <ShortcutKeys accelerator={bindings[definition.id] ?? ""} />}
                                                </button>
                                                {bindings[definition.id] && !isRecording && (
                                                    <button
                                                        onClick={() => assign(definition, "")}
                                                        title="Quitar el atajo"
                                                        className="text-gray-600 hover:text-red-400 transition-colors"
                                                    >
                                                        <i className="bi bi-x-lg text-[10px]" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {rowProblem && <p className="mt-1.5 text-[11px] text-red-300">{rowProblem}</p>}

                                        {rowPending && (
                                            <div className="mt-1.5 flex items-center justify-between gap-3 px-2.5 py-1.5 rounded bg-amber-500/10 border border-amber-500/20">
                                                <p className="text-[11px] text-amber-200">
                                                    {normalizeAccelerator(rowPending.accelerator)} ya lo usa «{rowPending.conflicts.map((c) => c.label).join("», «")}».
                                                </p>
                                                <div className="shrink-0 flex gap-2">
                                                    <button onClick={() => setPending(null)} className="text-[11px] text-gray-400 hover:text-white">Cancelar</button>
                                                    <button
                                                        onClick={() => assign(rowPending.definition, rowPending.accelerator, rowPending.conflicts)}
                                                        className="text-[11px] font-medium text-amber-300 hover:text-amber-100"
                                                    >
                                                        Reasignar aquí
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </ListGroup>
                    </section>
                );
            })}
        </div>
    );
};
