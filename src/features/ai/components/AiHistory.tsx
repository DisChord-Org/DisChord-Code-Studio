import { useEffect, useState } from "react";
import { EmptyState } from "../../../components/ui";
import { formatRelativeTime } from "../../../utils/Time";
import type { AiSessionSummary } from "../types";

interface AiHistoryProps {
    load: () => Promise<AiSessionSummary[]>;
    onOpen: (id: string) => Promise<void>;
}

export const AiHistory = ({ load, onOpen }: AiHistoryProps) => {
    const [sessions, setSessions] = useState<AiSessionSummary[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [opening, setOpening] = useState<string | null>(null);

    useEffect(() => {
        load().then(setSessions).catch((e) => setError(String(e)));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const open = (id: string) => {
        setOpening(id);
        onOpen(id).catch((e) => {
            setOpening(null);
            setError(String(e));
        });
    };

    if (error) return <EmptyState icon="bi-exclamation-triangle" tone="danger">{error}</EmptyState>;
    if (!sessions) return <p className="px-3 py-6 text-center text-xs text-gray-500" role="status">Cargando conversaciones…</p>;
    if (sessions.length === 0) return <EmptyState icon="bi-clock-history">Aún no hay conversaciones sobre este proyecto.</EmptyState>;

    return (
        <ul className="flex flex-col px-2 py-1">
            {sessions.map((session) => (
                <li key={session.id}>
                    <button
                        type="button"
                        disabled={opening !== null}
                        onClick={() => open(session.id)}
                        className="flex w-full flex-col gap-0.5 rounded px-2 py-1.5 text-left transition-colors hover:bg-white/[0.05] disabled:opacity-50"
                    >
                        <span className="truncate text-xs text-gray-200">{session.title || "Sin título"}</span>
                        <span className="text-[11px] text-gray-500">
                            {formatRelativeTime(session.updatedAt)} · {session.messageCount} {session.messageCount === 1 ? "mensaje" : "mensajes"}
                        </span>
                    </button>
                </li>
            ))}
        </ul>
    );
};
