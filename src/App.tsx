import { useState } from "react";
import Dashboard from "./views/Dashboard";
import Editor from "./views/Editor";

function App() {
    const [currentProject, setCurrentProject] = useState<string | null>(null);

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