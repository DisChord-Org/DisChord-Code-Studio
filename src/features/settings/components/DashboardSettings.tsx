import { invoke } from "@tauri-apps/api/core";
import { Button } from "../../../components/ui/Button";
import { ViewModeToggle } from "./ViewModeToggle";
import type { AppConfig } from "../types";

interface DashboardSettingsProps {
    config: AppConfig;
    updateConfig: (patch: Partial<AppConfig>) => void;
}

export const DashboardSettings = ({ config, updateConfig }: DashboardSettingsProps) => {
    const handleOpenIdeFolder = async () => {
        try {
            await invoke("open_ide_folder");
        } catch (error) {
            alert("No se pudo abrir la carpeta del IDE: " + error);
        }
    };

    return (
        <div className="max-w-xl flex flex-col">
            <div className="flex items-center justify-between py-3 border-b border-white/5">
                <div>
                    <p className="text-sm text-gray-200 font-medium">Vista de proyectos</p>
                    <p className="text-xs text-gray-500 mt-0.5">Cómo se muestran tus workflows en el Dashboard.</p>
                </div>

                <ViewModeToggle
                    value={config.view_mode}
                    onChange={(mode) => updateConfig({ view_mode: mode })}
                />
            </div>

            <div className="flex items-center justify-between py-3 border-b border-white/5">
                <div>
                    <p className="text-sm text-gray-200 font-medium">Ficheros del IDE</p>
                    <p className="text-xs text-gray-500 mt-0.5">Abre la carpeta donde está instalado DisChord Code Studio.</p>
                </div>

                <Button variant="ghost" className="text-xs" onClick={handleOpenIdeFolder}>
                    <i className="bi bi-folder2-open mr-1.5"></i>
                    Abrir carpeta
                </Button>
            </div>
        </div>
    );
};
