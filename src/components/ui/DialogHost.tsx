import { useSyncExternalStore } from "react";
import { answerChoice, answerDialog, currentDialog, subscribeDialogs } from "../../utils/Dialogs";
import { Button } from "./Button";
import { Modal } from "./Modal";

/** Renders the dialogs requested through `confirmAction` and `showError`. Mount it once, at the root. */
export const DialogHost = () => {
    const request = useSyncExternalStore(subscribeDialogs, currentDialog);
    if (!request) return null;

    if (request.kind === "choice") {
        const choices = request.choices ?? [];
        const dismiss = () => answerChoice(request.id, null);

        return (
            <div
                key={request.id}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]"
                onMouseDown={dismiss}
                onKeyDown={(e) => e.key === "Escape" && dismiss()}
            >
                <div
                    role="alertdialog"
                    aria-modal="true"
                    aria-label={request.title}
                    className="bg-panel border border-border p-6 rounded-xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200"
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <h2 className="text-white font-bold mb-2">{request.title}</h2>
                    <p className={`text-sm text-gray-400 break-words ${request.detail ? "mb-2" : "mb-5"}`}>{request.message}</p>
                    {request.detail && <p className="text-xs text-gray-500 mb-5 break-words">{request.detail}</p>}
                    <div className="flex flex-col gap-2">
                        {choices.map((label, index) => (
                            <Button
                                key={label}
                                variant={index === 0 ? "primary" : index === choices.length - 1 ? "ghost" : "secondary"}
                                autoFocus={index === choices.length - 1}
                                onClick={() => answerChoice(request.id, index)}
                            >
                                {label}
                            </Button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    const isError = request.kind === "error";

    return (
        <Modal
            key={request.id}
            isOpen
            title={request.title ?? (isError ? "Algo ha fallado" : "¿Seguro?")}
            message={request.message}
            detail={request.detail}
            confirmLabel={request.confirmLabel}
            danger={!isError}
            hideCancel={isError}
            onSubmit={() => answerDialog(request.id, true)}
            onClose={() => answerDialog(request.id, false)}
        />
    );
};
