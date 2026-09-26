import { invoke } from "@tauri-apps/api/core";
import { Button } from "../../../components/ui";
import type { AppConfig } from "../types";
import { rotationOptions } from "./LogsSettings.constants";
import { showError } from "../../../utils/Dialogs";

interface LogsSettingsProps {
    config: AppConfig;
    updateConfig: (patch: Partial<AppConfig>) => void;
}

export const LogsSettings = ({ config, updateConfig }: LogsSettingsProps) => {
    const handleOpenLogsFolder = async () => {
        try {
            await invoke("open_logs_folder");
        } catch (error) {
            showError("No se pudo abrir la carpeta de logs: " + error);
        }
    };

    return (
        <div className="max-w-xl flex flex-col">
            <div className="py-3 border-b border-white/5">
                <p className="text-sm text-gray-200 font-medium mb-0.5">Rotación de logs</p>
                <p className="text-xs text-gray-500 mb-3">
                    Cada cuánto se crea un fichero de log nuevo. Se aplica la próxima vez que abras el IDE.
                </p>

                <div className="flex flex-col gap-1.5">
                    {rotationOptions.map((option) => (
                        <button
                            key={option.value}
                            onClick={() => updateConfig({ log_rotation: option.value })}
                            className={`flex items-center justify-between text-left px-3 py-2 rounded-md border transition-colors
                                ${config.log_rotation === option.value
                                    ? "bg-accent/10 border-accent/40"
                                    : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]"
                                }`}
                        >
                            <div>
                                <p className="text-[12px] text-gray-200">{option.label}</p>
                                <p className="text-[10px] text-gray-500">{option.description}</p>
                            </div>
                            {config.log_rotation === option.value && (
                                <i className="bi bi-check2 text-accent text-[13px]"></i>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex items-center justify-between py-3 border-b border-white/5">
                <div>
                    <p className="text-sm text-gray-200 font-medium">Carpeta de logs</p>
                    <p className="text-xs text-gray-500 mt-0.5">Abre la carpeta donde se guardan los ficheros de log.</p>
                </div>

                <Button variant="ghost" className="text-xs" onClick={handleOpenLogsFolder}>
                    <i className="bi bi-folder2-open mr-1.5"></i>
                    Abrir carpeta
                </Button>
            </div>
        </div>
    );
};
