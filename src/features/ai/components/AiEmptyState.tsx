import { Label } from "../../../components/ui";
import { AmayaIcon } from "./AmayaIcon";

const suggestions = [
    { icon: "bi-file-earmark-code", text: "Explícame este archivo" },
    { icon: "bi-bug", text: "Revisa mi código en busca de errores" },
    { icon: "bi-plus-square", text: "Crea un comando /ping que responda con la latencia" },
    { icon: "bi-chat-square-text", text: "¿Cómo envío un mensaje con un embed?" },
];

interface AiEmptyStateProps {
    onPick: (text: string) => void;
}

export const AiEmptyState = ({ onPick }: AiEmptyStateProps) => (
    <div className="flex flex-1 flex-col justify-center gap-5 px-3 py-2">
        {/* Amaya's first message, written like any other of hers. */}
        <div className="flex gap-2.5">
            <AmayaIcon size={24} className="mt-0.5 self-start" />
            <p className="min-w-0 flex-1 pt-0.5 text-[13px] leading-relaxed text-gray-300">
                Pregúntame por tu código, o pídeme que escriba o corrija algo.
            </p>
        </div>

        <div className="pl-[34px]">
            <Label className="px-1 pb-1.5">Sugerencias</Label>
            <ul className="flex flex-col">
                {suggestions.map((suggestion) => (
                    <li key={suggestion.text}>
                        <button
                            type="button"
                            onClick={() => onPick(suggestion.text)}
                            className="flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-left text-xs text-gray-400 transition-colors hover:bg-white/[0.05] hover:text-white"
                        >
                            <i className={`bi ${suggestion.icon} text-[13px] text-gray-600`} aria-hidden="true"></i>
                            <span className="truncate">{suggestion.text}</span>
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    </div>
);
