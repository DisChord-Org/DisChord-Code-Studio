import { useState } from "react";

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (name: string) => void;
}

export const Modal = ({ isOpen, onClose, onSubmit }: ModalProps) => {
    if (!isOpen) return null;

    const [value, setValue] = useState("");

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-[#111214] border border-[#1e1f22] p-6 rounded-xl w-full max-w-sm shadow-2xl">
                <h2 className="text-white font-bold mb-4">Nuevo Proyecto</h2>
                <input 
                    autoFocus
                    className="w-full bg-[#1e1f22] border border-[#30363d] rounded p-2 text-white outline-none focus:border-[#5865F2] mb-4"
                    placeholder="Nombre del workflow..."
                    onChange={(e) => setValue(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white text-sm">Cancelar</button>
                    <button 
                        onClick={() => { onSubmit(value); onClose(); }}
                        className="px-4 py-2 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded font-medium text-sm"
                    >
                        Crear Proyecto
                    </button>
                </div>
            </div>
        </div>
    );
};