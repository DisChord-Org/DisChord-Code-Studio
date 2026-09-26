import { useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import Dashboard from "./views/Dashboard";
import Editor from "./views/Editor";
import Update from "./views/Update";
import Settings from "./views/Settings";
import { DialogHost } from "./components/ui";

const windowLabel = getCurrentWindow().label;

function AppRoutes() {
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

function App() {
    return (
        <>
            <AppRoutes />
            <DialogHost />
        </>
    );
}

export default App;
