import { useState } from "react";
import { Button } from "./Button";

interface ModalProps {
    isOpen: boolean;
    title: string;
    placeholder: string;
    confirmLabel?: string;
    onClose: () => void;
    onSubmit: (name: string) => void;
}

export const Modal = ({ isOpen, title, placeholder, onClose, onSubmit, confirmLabel }: ModalProps) => {
    const [value, setValue] = useState("");

    if (!isOpen) return null;

    const handleConfirm = () => {
        if (value.trim()) {
            onSubmit(value);
            setValue("");
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
            <div className="bg-panel border border-border p-6 rounded-xl w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
                <h2 className="text-white font-bold mb-4">{title}</h2>
                <input 
                    autoFocus
                    className="w-full bg-border border border-border-strong rounded p-2 text-white outline-none focus:border-accent mb-4"
                    placeholder={placeholder}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                />
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={onClose}>Cancelar</Button>
                    <Button onClick={handleConfirm}>{confirmLabel ? confirmLabel : 'Confirmar'}</Button>
                </div>
            </div>
        </div>
    );
};