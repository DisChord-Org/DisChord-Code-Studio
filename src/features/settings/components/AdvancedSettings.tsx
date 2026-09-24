import type { AppConfig } from "../types";

interface AdvancedSettingsProps {
    config: AppConfig;
    updateConfig: (patch: Partial<AppConfig>) => void;
}

export const AdvancedSettings = ({ config, updateConfig }: AdvancedSettingsProps) => (
    <div className="max-w-xl flex flex-col">
        <div className="py-3 border-b border-white/5">
            <button
                onClick={() => updateConfig({ advanced_mode: !config.advanced_mode })}
                className="w-full flex items-center justify-between text-left"
            >
                <div>
                    <p className="text-sm text-gray-200 font-medium mb-0.5">
                        Modo usuario avanzado
                        <span className="ml-2 text-[9px] font-bold uppercase tracking-wide text-amber-400/80 bg-amber-400/10 px-1.5 py-0.5 rounded">Experimental</span>
                    </p>
                    <p className="text-xs text-gray-500">
                        El IDE deja de suponer que prefieres tocar botones antes que comandos. Desactivado, el IDE se comporta como siempre.
                    </p>
                </div>
                <span
                    className={`shrink-0 ml-3 w-9 h-5 rounded-full p-0.5 transition-colors ${config.advanced_mode ? "bg-accent" : "bg-white/10"}`}
                >
                    <span
                        className={`block w-4 h-4 rounded-full bg-white transition-transform ${config.advanced_mode ? "translate-x-4" : "translate-x-0"}`}
                    />
                </span>
            </button>
        </div>
    </div>
);
