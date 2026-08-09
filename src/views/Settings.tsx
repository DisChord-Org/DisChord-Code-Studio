import { WindowControls } from "../components/ui/WindowControls";
import { BackButton } from "../components/ui/BackButton";
import { Title } from "../components/ui/Typography";
import { SettingsSidebar, ViewModeToggle, useConfig } from "../features/settings";

interface SettingsProps {
    onBack: () => void;
}

function Settings({ onBack }: SettingsProps) {
    const { config, updateConfig } = useConfig();

    return (
        <div data-tauri-drag-region className="h-screen bg-[#0B0E14] flex flex-col text-white overflow-hidden select-none">
            <div className="h-10 bg-[#12151c] shadow-[0_1px_3px_0_rgba(0,0,0,0.35)] flex items-center justify-between shrink-0 relative z-20">
                <BackButton onClick={onBack} className="ml-4" />

                <WindowControls className="ml-2" />
            </div>

            <div className="flex flex-1 overflow-hidden">
                <SettingsSidebar />

                <main className="flex-1 overflow-y-auto p-10">
                    <Title>Configuración</Title>

                    <div className="max-w-xl flex items-center justify-between py-3 border-b border-white/5">
                        <div>
                            <p className="text-sm text-gray-200 font-medium">Vista de proyectos</p>
                            <p className="text-xs text-gray-500 mt-0.5">Cómo se muestran tus workflows en el Dashboard.</p>
                        </div>

                        <ViewModeToggle
                            value={config.view_mode}
                            onChange={(mode) => updateConfig({ view_mode: mode })}
                        />
                    </div>
                </main>
            </div>
        </div>
    );
}

export default Settings;
