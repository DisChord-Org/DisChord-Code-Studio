import { invoke } from "@tauri-apps/api/core";
import { Button } from "../../../components/ui/Button";
import { ViewModeToggle } from "./ViewModeToggle";
import type { AppConfig } from "../types";

interface DashboardSettingsProps {
    config: AppConfig;
    updateConfig: (patch: Partial<AppConfig>) => void;
}

export const DashboardSettings = ({ config, updateConfig }: DashboardSettingsProps) => {
    const handleOpenAppDataFolder = async () => {
        try {
            await invoke("open_app_data_folder");
        } catch (error) {
            alert("No se pudo abrir la carpeta de datos del IDE: " + error);
        }
    };

    const handleOpenBinariesFolder = async () => {
        try {
            await invoke("open_binaries_folder");
        } catch (error) {
            alert("No se pudo abrir la carpeta de binarios: " + error);
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
                    <p className="text-sm text-gray-200 font-medium">Datos del IDE</p>
                    <p className="text-xs text-gray-500 mt-0.5">Abre la carpeta de AppData donde se guardan la configuración y los logs.</p>
                </div>

                <Button variant="ghost" className="text-xs" onClick={handleOpenAppDataFolder}>
                    <i className="bi bi-folder2-open mr-1.5"></i>
                    Abrir carpeta
                </Button>
            </div>

            <div className="flex items-center justify-between py-3 border-b border-white/5">
                <div>
                    <p className="text-sm text-gray-200 font-medium">Binarios</p>
                    <p className="text-xs text-gray-500 mt-0.5">Abre la carpeta donde el IDE instala chord, Node.js y pnpm.</p>
                </div>

                <Button variant="ghost" className="text-xs" onClick={handleOpenBinariesFolder}>
                    <i className="bi bi-folder2-open mr-1.5"></i>
                    Abrir carpeta
                </Button>
            </div>
        </div>
    );
};
