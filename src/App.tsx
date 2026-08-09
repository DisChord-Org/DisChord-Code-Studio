import { useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import Dashboard from "./views/Dashboard";
import Editor from "./views/Editor";
import Update from "./views/Update";
import Settings from "./views/Settings";

const windowLabel = getCurrentWindow().label;

function App() {
    const [currentProject, setCurrentProject] = useState<string | null>(null);
    const [showSettings, setShowSettings] = useState(false);

    if (windowLabel === "update") {
        return <Update />;
    }

    if (currentProject) {
        return (
            <Editor
                projectName={currentProject}
                onBack={() => setCurrentProject(null)}
                onSwitchProject={(name) => setCurrentProject(name)}
            />
        );
    }

    if (showSettings) {
        return <Settings onBack={() => setShowSettings(false)} />;
    }

    return (
        <Dashboard
            onSelectProject={(name) => setCurrentProject(name)}
            onOpenSettings={() => setShowSettings(true)}
        />
    );
}

export default App;