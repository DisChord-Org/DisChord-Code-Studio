import { useSyncExternalStore } from "react";
import { answerDialog, currentDialog, subscribeDialogs } from "../../utils/Dialogs";
import { Modal } from "./Modal";

/** Renders the dialogs requested through `confirmAction` and `showError`. Mount it once, at the root. */
export const DialogHost = () => {
    const request = useSyncExternalStore(subscribeDialogs, currentDialog);
    if (!request) return null;

    const isError = request.kind === "error";

    return (
        <Modal
            key={request.id}
            isOpen
            title={isError ? "Algo ha fallado" : "¿Seguro?"}
            message={request.message}
            confirmLabel={request.confirmLabel}
            danger={!isError}
            hideCancel={isError}
            onSubmit={() => answerDialog(request.id, true)}
            onClose={() => answerDialog(request.id, false)}
        />
    );
};
