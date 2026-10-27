import { useEffect, useState } from "react";
import {
    Toolbar,
    Sidebar,
    CodeCanvas,
    CodeMinimap,
    TerminalPanel,
    StatusBar,
    EditorScrollbar,
    TabBar,
    EmptyEditor,
    useEditor,
    useSplitView,
} from "../features/editor";
import { PackageManager } from "../features/packages";
import { ShortcutsReference, useShortcut } from "../features/shortcuts";
import { QuickOpen } from "../features/search";
import { useConfig } from "../features/settings";
import { loadCorelib } from "../features/compiler";
import { preloadCommonLanguages } from "../languages/language-for-file";

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
        terminalStartTab,
        outputSignal,
        toggleShellTerminal,
        isMaximized,
        codeCanvasRef,
        minimapViewport,
        setActiveTabPath,
        setShowTerminal,
        setMinimapViewport,
        handleFileSelect,
        openFileAt,
        handlePathMoved,
        handlePathDeleted,
        gotoTarget,
        openPackagesTab,
        openShortcutsTab,
        closeTab,
        updateActiveTabContent,
        setActiveTabDirty,
        updateTabContent,
        setTabDirty,
        refreshFiles,
        handleToggleRun,
        handleStopRun,
        handleRestartRun,
        handleBack,
        handleSwitchProject,
    } = useEditor({ projectName, onBack, onSwitchProject });

    useEffect(() => {
        loadCorelib();
        preloadCommonLanguages();
    }, []);

    const { leftTabs, rightTabs, rightActiveTab, setRightActive, isSplit, movePane, toggleSplit } = useSplitView(openTabs, activeTabPath, setActiveTabPath);
    useShortcut("editor.splitView", toggleSplit);

    const [overlay, setOverlay] = useState<"quickOpen" | null>(null);
    useShortcut("file.quickOpen", () => setOverlay("quickOpen"));

    useShortcut("terminal.toggle", toggleShellTerminal, config.advanced_mode);

    return (
        <div className="h-screen bg-app-bg flex flex-col text-white overflow-hidden">
            <Toolbar
                projectName={projectName}
                onBack={handleBack}
                onRun={handleToggleRun}
                isRunning={isRunning}
                onSwitchProject={handleSwitchProject}
                onOpenPackages={openPackagesTab}
                onOpenShortcuts={openShortcutsTab}
                onToggleTerminal={config.advanced_mode ? toggleShellTerminal : undefined}
            />

            {overlay === "quickOpen" && (
                <QuickOpen
                    projectName={projectName}
                    onOpen={(path) => handleFileSelect({ name: path.split("/").pop() ?? path, relative_path: path, is_dir: false })}
                    onClose={() => setOverlay(null)}
                />
            )}
            <div className="flex flex-1 overflow-hidden relative">
                <Sidebar
                    files={fileTree}
                    onFileClick={handleFileSelect}
                    projectName={projectName}
                    onRefresh={refreshFiles}
                    onPathMoved={handlePathMoved}
                    onPathDeleted={handlePathDeleted}
                    activeFilePath={activeTab?.kind === "file" ? activeTab.relative_path : undefined}
                    onJumpTo={openFileAt}
                />

                <main className="flex-1 flex flex-col bg-app-bg overflow-hidden">
                    <div className="flex-1 min-h-0 flex overflow-hidden">
                        <div className="flex-1 min-w-0 flex flex-col">
                            <TabBar
                                tabs={leftTabs}
                                activePath={activeTabPath}
                                onSelect={setActiveTabPath}
                                onClose={closeTab}
                                onOpenInSplit={movePane}
                                onToggleSplit={toggleSplit}
                                splitOpen={isSplit}
                            />

                        <div className="flex-1 min-h-0 relative overflow-hidden">
                            {activeTab?.kind === "packages" ? (
                                <PackageManager
                                    key={`${projectName}:${activeTab.relative_path}`}
                                    projectName={projectName}
                                    onClose={() => closeTab(activeTab.relative_path)}
                                />
                            ) : activeTab?.kind === "shortcuts" ? (
                                <ShortcutsReference onClose={() => closeTab(activeTab.relative_path)} />
                            ) : activeTab ? (
                                <div className="flex h-full">
                                    <div className="flex-1 min-w-0 overflow-hidden">
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
                                            goto={gotoTarget}
                                            requireFocus={isSplit}
                                        />
                                    </div>
                                    {!isSplit && (isMaximized || config.editor_keep_minimap) && (
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
                                <EmptyEditor />
                            )}
                        </div>
                        </div>

                        {rightActiveTab && (
                            <div className="flex-1 min-w-0 flex flex-col border-l border-border-strong">
                                <TabBar
                                    tabs={rightTabs}
                                    activePath={rightActiveTab.relative_path}
                                    onSelect={setRightActive}
                                    onClose={closeTab}
                                    onOpenInSplit={movePane}
                                />
                                <div className="flex-1 min-h-0 overflow-hidden">
                                    <CodeCanvas
                                        key={`${projectName}:split:${rightActiveTab.relative_path}`}
                                        projectName={projectName}
                                        relative_path={rightActiveTab.relative_path}
                                        fileName={rightActiveTab.name}
                                        content={rightActiveTab.content}
                                        setIsDirty={(value) => setTabDirty(rightActiveTab.relative_path, value)}
                                        onChange={(value) => updateTabContent(rightActiveTab.relative_path, value)}
                                        requireFocus
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {showTerminal && <TerminalPanel projectName={projectName} initialTab={terminalStartTab} outputSignal={outputSignal} isRunning={isRunning} onStop={handleStopRun} onRestart={handleRestartRun} onOpenLocation={openFileAt} onClose={() => setShowTerminal(false)} />}

                    {(isMaximized || config.editor_keep_statusbar) && (
                        <StatusBar
                            fileName={activeTab?.kind === "file" ? activeTab.name : undefined}
                            filePath={activeTab?.kind === "file" ? activeTab.relative_path : undefined}
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
