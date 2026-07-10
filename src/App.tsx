import { useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import Dashboard from "./views/Dashboard";
import Editor from "./views/Editor";
import Update from "./views/Update";

const windowLabel = getCurrentWindow().label;

function App() {
    const [currentProject, setCurrentProject] = useState<string | null>(null);

    if (windowLabel === "update") {
        return <Update />;
    }

    if (currentProject) {
        return (
            <Editor 
                projectName={currentProject} 
                onBack={() => setCurrentProject(null)} 
            />
        );
    }

    return (
        <Dashboard onSelectProject={(name) => setCurrentProject(name)} />
    );
}

export default App;