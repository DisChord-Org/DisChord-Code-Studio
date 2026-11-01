import { useState } from "react";
import { notify } from "../../utils/Toasts";

const copiedMs = 1500;

export const useCopy = (getText: () => string) => {
    const [copied, setCopied] = useState(false);

    const copy = () =>
        navigator.clipboard.writeText(getText()).then(
            () => {
                setCopied(true);
                setTimeout(() => setCopied(false), copiedMs);
            },
            (error) => notify("error", "No se pudo copiar al portapapeles.", [String(error)]),
        );

    return { copied, copy };
};
