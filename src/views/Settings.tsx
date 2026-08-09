import { useState } from "react";
import { WindowControls } from "../components/ui/WindowControls";
import { BackButton } from "../components/ui/BackButton";
import { Title } from "../components/ui/Typography";
import {
    SettingsSidebar,
    DashboardSettings,
    LogsSettings,
    useConfig,
    type SettingsSection,
} from "../features/settings";

interface SettingsProps {
    onBack: () => void;
}

const SECTION_TITLES: Record<SettingsSection, string> = {
    dashboard: "Dashboard",
    logs: "Logs",
};

function Settings({ onBack }: SettingsProps) {
    const { config, updateConfig } = useConfig();
    const [section, setSection] = useState<SettingsSection>("dashboard");

    return (
        <div data-tauri-drag-region className="h-screen bg-[#0B0E14] flex flex-col text-white overflow-hidden select-none">
            <div className="h-10 bg-[#12151c] shadow-[0_1px_3px_0_rgba(0,0,0,0.35)] flex items-center justify-between shrink-0 relative z-20">
                <BackButton onClick={onBack} className="ml-4" />

                <WindowControls className="ml-2" />
            </div>

            <div className="flex flex-1 overflow-hidden">
                <SettingsSidebar activeSection={section} onSelect={setSection} />

                <main className="flex-1 overflow-y-auto p-10">
                    <Title>{SECTION_TITLES[section]}</Title>

                    {section === "dashboard" ? (
                        <DashboardSettings config={config} updateConfig={updateConfig} />
                    ) : (
                        <LogsSettings config={config} updateConfig={updateConfig} />
                    )}
                </main>
            </div>
        </div>
    );
}

export default Settings;
