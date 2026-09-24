import { useEffect, useState } from "react";
import { WindowControls, BackButton, Title } from "../components/ui";
import {
    SettingsSidebar,
    DashboardSettings,
    EditorSettings,
    AdvancedSettings,
    LogsSettings,
    JsonFileEditor,
    ConfigSectionForm,
    useConfig,
    useConfigSections,
    sectionNavKey,
    type SettingsSection,
} from "../features/settings";
import { sectionTitles } from "./Settings.constants";

const SECTION_PREFIX = "section:";

interface SettingsProps {
    onBack: () => void;
}

function Settings({ onBack }: SettingsProps) {
    const { config, updateConfig } = useConfig();
    const [section, setSection] = useState<SettingsSection>("dashboard");
    const [editingJson, setEditingJson] = useState(false);
    const { sections, saveSection } = useConfigSections(config.advanced_mode);

    const loadedSection = section.startsWith(SECTION_PREFIX)
        ? sections.find((s) => sectionNavKey(s.schema.id) === section)
        : undefined;

    // A gated section disappears when its flag is turned off; don't leave the screen on it.
    useEffect(() => {
        if (section.startsWith(SECTION_PREFIX) && sections.length > 0 && !loadedSection) setSection("advanced");
    }, [section, sections, loadedSection]);

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
                        extraItems={sections.map((s) => ({ key: sectionNavKey(s.schema.id), label: s.schema.title, icon: s.schema.icon }))}
                    />

                    <main className="custom-scrollbar flex-1 overflow-y-auto p-10">
                        <Title>{loadedSection ? loadedSection.schema.title : section.startsWith(SECTION_PREFIX) ? "" : sectionTitles[section as keyof typeof sectionTitles]}</Title>

                        {section === "dashboard" ? (
                            <DashboardSettings config={config} updateConfig={updateConfig} />
                        ) : section === "editor" ? (
                            <EditorSettings config={config} updateConfig={updateConfig} />
                        ) : section === "advanced" ? (
                            <AdvancedSettings config={config} updateConfig={updateConfig} />
                        ) : loadedSection ? (
                            <ConfigSectionForm section={loadedSection} onChange={(values) => saveSection(loadedSection.schema.id, values)} />
                        ) : section.startsWith(SECTION_PREFIX) ? null : (
                            <LogsSettings config={config} updateConfig={updateConfig} />
                        )}
                    </main>
                </div>
            )}
        </div>
    );
}

export default Settings;
