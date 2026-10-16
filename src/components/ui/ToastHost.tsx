import { useState, useSyncExternalStore } from "react";
import { dismissToast, getToasts, subscribeToasts, type Toast, type ToastLevel } from "../../utils/Toasts";

const looks: Record<ToastLevel, { icon: string; color: string }> = {
    success: { icon: "bi-check-circle-fill", color: "text-emerald-400" },
    info: { icon: "bi-info-circle-fill", color: "text-sky-400" },
    warning: { icon: "bi-exclamation-triangle-fill", color: "text-amber-400" },
    error: { icon: "bi-x-circle-fill", color: "text-red-400" },
};

const ToastCard = ({ toast }: { toast: Toast }) => {
    const [expanded, setExpanded] = useState(false);
    const look = looks[toast.level];

    return (
        <div
            role={toast.level === "error" ? "alert" : "status"}
            className="pointer-events-auto w-[320px] flex items-start gap-2.5 px-3.5 py-3 bg-[#12151c] border border-white/[0.08] rounded-[10px] shadow-[0_10px_30px_-8px_rgba(0,0,0,0.65)] animate-in fade-in slide-in-from-right-2 duration-200"
        >
            <i className={`bi ${look.icon} ${look.color} text-[13px] mt-[1px] shrink-0`}></i>

            <div className="min-w-0 flex-1">
                <p className="text-[12px] leading-snug text-gray-200 break-words">{toast.message}</p>

                {toast.details.length > 0 && (
                    <>
                        <button
                            onClick={() => setExpanded((value) => !value)}
                            aria-expanded={expanded}
                            className="mt-1 text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
                        >
                            {expanded ? "Ocultar detalles" : "Ver detalles"}
                        </button>
                        {expanded && (
                            <div className="custom-scrollbar mt-1.5 max-h-28 overflow-y-auto text-[10px] leading-relaxed text-gray-500 font-mono whitespace-pre-wrap break-words">
                                {toast.details.join("\n")}
                            </div>
                        )}
                    </>
                )}
            </div>

            <button
                onClick={() => dismissToast(toast.id)}
                aria-label="Cerrar aviso"
                className="shrink-0 -mr-1 -mt-0.5 w-5 h-5 flex items-center justify-center text-gray-600 hover:text-white transition-colors"
            >
                <i className="bi bi-x text-sm"></i>
            </button>
        </div>
    );
};

/** Renders the messages sent with `notify`, stacked in the bottom-right corner. Mount it once, at the root. */
export const ToastHost = () => {
    const toasts = useSyncExternalStore(subscribeToasts, getToasts);
    if (toasts.length === 0) return null;

    return (
        <div className="fixed bottom-10 right-4 z-[150] flex flex-col gap-2 items-end pointer-events-none">
            {toasts.map((toast) => (
                <ToastCard key={toast.id} toast={toast} />
            ))}
        </div>
    );
};
