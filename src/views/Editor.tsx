import {
    Toolbar,
    Sidebar,
    CodeCanvas,
    CodeMinimap,
    TerminalPanel,
    StatusBar,
    EditorScrollbar,
    TabBar,
    useEditor,
} from "../features/editor";
import { PackageManager } from "../features/packages";
import { useConfig } from "../features/settings";

interface EditorInterface {
    projectName: string,
    onBack: () => void,
    onSwitchProject?: (name: string) => void
}

export const Editor = ({ projectName, onBack, onSwitchProject }: EditorInterface) => {
    const { config, updateConfig } = useConfig();
    const {
        fileTree,
        openTabs,
        activeTabPath,
        activeTab,
        isRunning,
        showTerminal,
        isMaximized,
        codeCanvasRef,
        minimapViewport,
        setActiveTabPath,
        setShowTerminal,
        setMinimapViewport,
        handleFileSelect,
        openPackagesTab,
        closeTab,
        updateActiveTabContent,
        setActiveTabDirty,
        refreshFiles,
        handleToggleRun,
        handleBack,
        handleSwitchProject,
    } = useEditor({ projectName, onBack, onSwitchProject });

    return (
        <div className="h-screen bg-app-bg flex flex-col text-white overflow-hidden">
            <Toolbar
                projectName={projectName}
                onBack={handleBack}
                onRun={handleToggleRun}
                isRunning={isRunning}
                onSwitchProject={handleSwitchProject}
                onOpenPackages={openPackagesTab}
            />

            <div className="flex flex-1 overflow-hidden relative">
                <Sidebar
                    files={fileTree}
                    onFileClick={handleFileSelect}
                    projectName={projectName}
                    onRefresh={refreshFiles}
                />

                <main className="flex-1 flex flex-col bg-app-bg overflow-hidden">
                    <TabBar
                        tabs={openTabs}
                        activePath={activeTabPath}
                        onSelect={setActiveTabPath}
                        onClose={closeTab}
                    />

                    <div className="flex-1 min-h-0 relative overflow-hidden">
                        {activeTab?.kind === "packages" ? (
                            <PackageManager
                                key={`${projectName}:${activeTab.relative_path}`}
                                projectName={projectName}
                                onClose={() => closeTab(activeTab.relative_path)}
                            />
                        ) : activeTab ? (
                            <div className="flex h-full">
                                <div className="flex-1 overflow-hidden">
                                    <CodeCanvas
                                        ref={codeCanvasRef}
                                        key={`${projectName}:${activeTab.relative_path}`}
                                        projectName={projectName}
                                        relative_path={activeTab.relative_path}
                                        fileName={activeTab.name}
                                        content={activeTab.content}
                                        setIsDirty={setActiveTabDirty}
                                        onChange={updateActiveTabContent}
                                        onViewportChange={setMinimapViewport}
                                    />
                                </div>
                                {isMaximized && (
                                    <>
                                        <CodeMinimap
                                            text={activeTab.content}
                                            viewport={minimapViewport}
                                            onScrollTo={(scrollTop) => codeCanvasRef.current?.scrollTo(scrollTop)}
                                        />
                                        <EditorScrollbar
                                            viewport={minimapViewport}
                                            onScrollTo={(scrollTop) => codeCanvasRef.current?.scrollTo(scrollTop)}
                                        />
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className="h-full w-full bg-[radial-gradient(#1e1f22_1px,transparent_1px)] [background-size:20px_20px] flex flex-col items-center justify-center pointer-events-none">
                                <p className="text-border font-black text-6xl uppercase tracking-tighter">
                                    DisChord
                                </p>
                            </div>
                        )}
                    </div>

                    {showTerminal && <TerminalPanel projectName={projectName} onClose={() => setShowTerminal(false)} />}

                    {isMaximized && (
                        <StatusBar
                            fileName={activeTab?.kind === "file" ? activeTab.name : undefined}
                            isDirty={activeTab?.kind === "file" && activeTab.isDirty}
                            contentLength={activeTab?.kind === "file" ? activeTab.content.length : 0}
                            wordWrap={config.editor_word_wrap}
                            onToggleWordWrap={() => updateConfig({ editor_word_wrap: !config.editor_word_wrap })}
                        />
                    )}
                </main>
            </div>
        </div>
    );
};

export default Editor;
