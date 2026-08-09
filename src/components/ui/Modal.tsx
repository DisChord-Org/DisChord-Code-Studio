import { useState } from "react";

interface ModalProps {
    isOpen: boolean;
    title: string;
    placeholder: string;
    confirmLabel?: string;
    onClose: () => void;
    onSubmit: (name: string) => void;
}

export const Modal = ({ isOpen, title, placeholder, onClose, onSubmit, confirmLabel }: ModalProps) => {
    if (!isOpen) return null;
    const [value, setValue] = useState("");

    const handleConfirm = () => {
        if (value.trim()) {
            onSubmit(value);
            setValue("");
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
            <div className="bg-[#111214] border border-[#1e1f22] p-6 rounded-xl w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
                <h2 className="text-white font-bold mb-4">{title}</h2>
                <input 
                    autoFocus
                    className="w-full bg-[#1e1f22] border border-[#30363d] rounded p-2 text-white outline-none focus:border-[#5865F2] mb-4"
                    placeholder={placeholder}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                />
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white text-sm">Cancelar</button>
                    <button 
                        onClick={handleConfirm}
                        className="px-4 py-2 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded font-medium text-sm"
                    >
                        {confirmLabel? confirmLabel : 'Confirmar'}
                    </button>
                </div>
            </div>
        </div>
    );
};