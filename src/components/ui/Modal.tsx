import { useEffect, useState } from "react";
import { Button } from "./Button";

interface ModalProps {
    isOpen: boolean;
    title: string;
    /** With a placeholder the modal asks for a text; without it, it shows `message` and only asks to accept. */
    placeholder?: string;
    message?: string;
    confirmLabel?: string;
    /** Paints the confirm button as a destructive action. */
    danger?: boolean;
    /** For notices that only need to be acknowledged. */
    hideCancel?: boolean;
    onClose: () => void;
    onSubmit: (name: string) => void;
}

export const Modal = ({ isOpen, title, placeholder, message, onClose, onSubmit, confirmLabel, danger = false, hideCancel = false }: ModalProps) => {
    const [value, setValue] = useState("");
    const asksForText = placeholder !== undefined;

    const handleConfirm = () => {
        if (asksForText && !value.trim()) return;

        onSubmit(value);
        setValue("");
        onClose();
    };

    useEffect(() => {
        if (!isOpen) return;

        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                onClose();
            } else if (e.key === "Enter" && !asksForText) {
                e.preventDefault();
                e.stopPropagation();
                handleConfirm();
            }
        };

        window.addEventListener("keydown", handleKey, true);
        return () => window.removeEventListener("keydown", handleKey, true);
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]" onMouseDown={onClose}>
            <div
                className="bg-panel border border-border p-6 rounded-xl w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200"
                onMouseDown={(e) => e.stopPropagation()}
            >
                <h2 className={`text-white font-bold ${asksForText ? "mb-4" : "mb-2"}`}>{title}</h2>
                {message && <p className="text-sm text-gray-400 mb-5 break-words">{message}</p>}
                {asksForText && (
                    <input
                        autoFocus
                        className="w-full bg-border border border-border-strong rounded p-2 text-white outline-none focus:border-accent mb-4"
                        placeholder={placeholder}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                    />
                )}
                <div className="flex justify-end gap-2">
                    {!hideCancel && <Button variant="ghost" className="" onClick={onClose}>Cancelar</Button>}
                    <Button variant={danger ? "danger" : "primary"} className="" onClick={handleConfirm}>{confirmLabel ? confirmLabel : 'Confirmar'}</Button>
                </div>
            </div>
        </div>
    );
};
