import { useState } from "react";
import { WindowControls, BackButton, Title } from "../components/ui";
import {
    SettingsSidebar,
    DashboardSettings,
    EditorSettings,
    LogsSettings,
    JsonFileEditor,
    useConfig,
    type SettingsSection,
} from "../features/settings";
import { sectionTitles } from "./Settings.constants";

interface SettingsProps {
    onBack: () => void;
}

function Settings({ onBack }: SettingsProps) {
    const { config, updateConfig } = useConfig();
    const [section, setSection] = useState<SettingsSection>("dashboard");
    const [editingJson, setEditingJson] = useState(false);

    return (
        <div data-tauri-drag-region className="h-screen bg-app-bg flex flex-col text-white overflow-hidden select-none">
            <div data-tauri-drag-region className="h-10 bg-panel-alt shadow-[0_1px_3px_0_rgba(0,0,0,0.35)] flex items-center justify-between shrink-0 relative z-20">
                <BackButton onClick={onBack} className="ml-4" />

                <WindowControls className="ml-2" />
            </div>

            {editingJson ? (
                <div className="flex-1 overflow-hidden">
                    <JsonFileEditor />
                </div>
            ) : (
                <div className="flex flex-1 overflow-hidden">
                    <SettingsSidebar
                        activeSection={section}
                        onSelect={setSection}
                        onEditJson={() => setEditingJson(true)}
                    />

                    <main className="custom-scrollbar flex-1 overflow-y-auto p-10">
                        <Title>{sectionTitles[section]}</Title>

                        {section === "dashboard" ? (
                            <DashboardSettings config={config} updateConfig={updateConfig} />
                        ) : section === "editor" ? (
                            <EditorSettings config={config} updateConfig={updateConfig} />
                        ) : (
                            <LogsSettings config={config} updateConfig={updateConfig} />
                        )}
                    </main>
                </div>
            )}
        </div>
    );
}

export default Settings;
