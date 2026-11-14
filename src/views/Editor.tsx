import { useEffect, useState } from "react";
import {
    Toolbar,
    Sidebar,
    CodeMinimap,
    TerminalPanel,
    StatusBar,
    EditorScrollbar,
    useEditor,
    useSplitView,
    useTabDrop,
} from "../features/editor";
import { useResizablePanel } from "../features/editor/useResizablePanel";
import { EditorPane } from "./EditorPane";
import { useShortcut } from "../features/shortcuts";
import { QuickOpen } from "../features/search";
import { AiPanel, onAskAmaya } from "../features/ai";
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
        refreshFiles,
        isMaximized,
        tabs,
        run,
        codeCanvasRef,
        minimapViewport,
        setMinimapViewport,
        handleBack,
        handleSwitchProject,
    } = useEditor({ projectName, onBack, onSwitchProject });
    const { activeTab, activeTabPath, setActiveTabPath } = tabs;

    useEffect(() => {
        loadCorelib();
        preloadCommonLanguages();
    }, []);

    const { leftTabs, rightTabs, rightActiveTab, setRightActive, isSplit, movePane, toggleSplit } = useSplitView(projectName, tabs.openTabs, activeTabPath, setActiveTabPath);
    useShortcut("editor.splitView", toggleSplit);

    const { size: splitWidth, startDrag: startSplitDrag } = useResizablePanel({ initialSize: 560, min: 280, max: 1400, axis: "x", invert: true });

    const { draggingTab, dropOn } = useTabDrop((path) => rightTabs.some((t) => t.relative_path === path), movePane);

    const [showAi, setShowAi] = useState(false);
    useShortcut("editor.toggleAssistant", () => setShowAi((open) => !open));

    const [prefill, setPrefill] = useState<{ text: string; nonce: number }>();
    useEffect(() => onAskAmaya((text) => {
        setShowAi(true);
        setPrefill({ text, nonce: Date.now() });
    }), []);

    const [overlay, setOverlay] = useState<"quickOpen" | null>(null);
    useShortcut("file.quickOpen", () => setOverlay("quickOpen"));

    useShortcut("terminal.toggle", run.toggleShellTerminal, config.advanced_mode);

    const scrollCanvasTo = (scrollTop: number) => codeCanvasRef.current?.scrollTo(scrollTop);
    const showMinimap = !isSplit && (isMaximized || config.editor_keep_minimap);
    const activeFile = activeTab?.kind === "file" ? activeTab : null;

    return (
        <div className="h-screen bg-app-bg flex flex-col text-white overflow-hidden">
            <Toolbar
                projectName={projectName}
                onBack={handleBack}
                onRun={run.toggleRun}
                isRunning={run.isRunning}
                onSwitchProject={handleSwitchProject}
                onOpenPackages={tabs.openPackagesTab}
                onOpenShortcuts={tabs.openShortcutsTab}
                onToggleTerminal={config.advanced_mode ? run.toggleShellTerminal : undefined}
                aiOpen={showAi}
                onToggleAi={() => setShowAi((open) => !open)}
            />

            {overlay === "quickOpen" && (
                <QuickOpen
                    projectName={projectName}
                    onOpen={(path) => tabs.handleFileSelect({ name: path.split("/").pop() ?? path, relative_path: path, is_dir: false })}
                    onClose={() => setOverlay(null)}
                />
            )}
            <div className="flex flex-1 overflow-hidden relative">
                <Sidebar
                    files={fileTree}
                    onFileClick={tabs.handleFileSelect}
                    projectName={projectName}
                    onRefresh={refreshFiles}
                    onPathMoved={tabs.handlePathMoved}
                    onPathDeleted={tabs.handlePathDeleted}
                    activeFilePath={activeFile?.relative_path}
                    onJumpTo={tabs.openFileAt}
                />

                <main className="flex-1 flex flex-col bg-app-bg overflow-hidden">
                    <div className="relative flex-1 min-h-0 flex overflow-hidden">
                        <div className="flex-1 min-w-0 flex flex-col" {...dropOn("left")}>
                            <EditorPane
                                pane="main"
                                projectName={projectName}
                                tabs={leftTabs}
                                activeTab={activeTab}
                                onSelect={setActiveTabPath}
                                onClose={tabs.closeTab}
                                onOpenInSplit={movePane}
                                onToggleSplit={toggleSplit}
                                splitOpen={isSplit}
                                onContentChange={tabs.updateTabContent}
                                onDirtyChange={tabs.setTabDirty}
                                beforeSave={tabs.guardSave}
                                canvasRef={codeCanvasRef}
                                onViewportChange={setMinimapViewport}
                                goto={tabs.gotoTarget}
                                requireFocus={isSplit}
                                sideContent={showMinimap && activeFile && (
                                    <>
                                        <CodeMinimap
                                            text={activeFile.content}
                                            viewport={minimapViewport}
                                            onScrollTo={scrollCanvasTo}
                                        />
                                        <EditorScrollbar
                                            viewport={minimapViewport}
                                            onScrollTo={scrollCanvasTo}
                                        />
                                    </>
                                )}
                            />
                        </div>

                        {rightActiveTab && (
                            <div className="relative flex shrink-0 flex-col border-l border-border-strong" style={{ width: splitWidth, maxWidth: "75%" }} {...dropOn("right")}>
                                <div
                                    onMouseDown={startSplitDrag}
                                    className="absolute left-0 top-0 z-20 h-full w-1 -translate-x-1/2 cursor-col-resize transition-colors hover:bg-accent/50 active:bg-accent"
                                />
                                <EditorPane
                                    pane="split"
                                    projectName={projectName}
                                    tabs={rightTabs}
                                    activeTab={rightActiveTab}
                                    onSelect={setRightActive}
                                    onClose={tabs.closeTab}
                                    onOpenInSplit={movePane}
                                    onContentChange={tabs.updateTabContent}
                                    onDirtyChange={tabs.setTabDirty}
                                    beforeSave={tabs.guardSave}
                                    requireFocus
                                />
                            </div>
                        )}

                        {draggingTab && !rightActiveTab && (
                            <div
                                className="absolute inset-y-0 right-0 z-30 flex w-1/4 items-center justify-center border-l-2 border-dashed border-accent bg-accent/10 text-xs text-accent-light"
                                {...dropOn("right")}
                            >
                                Suelta aquí para dividir
                            </div>
                        )}
                    </div>

                    {run.showTerminal && (
                        <TerminalPanel
                            projectName={projectName}
                            initialTab={run.terminalStartTab}
                            outputSignal={run.outputSignal}
                            isRunning={run.isRunning}
                            onStop={run.stopRun}
                            onRestart={run.restartRun}
                            onOpenLocation={tabs.openFileAt}
                            onClose={() => run.setShowTerminal(false)}
                        />
                    )}

                    {(isMaximized || config.editor_keep_statusbar) && (
                        <StatusBar
                            projectName={projectName}
                            fileName={activeFile?.name}
                            filePath={activeFile?.relative_path}
                            isDirty={activeFile?.isDirty ?? false}
                            contentLength={activeFile?.content.length ?? 0}
                            wordWrap={config.editor_word_wrap}
                            onToggleWordWrap={() => updateConfig({ editor_word_wrap: !config.editor_word_wrap })}
                        />
                    )}
                </main>

                <AiPanel
                    projectName={projectName}
                    prefill={prefill}
                    file={activeFile ? { name: activeFile.name, path: activeFile.relative_path } : undefined}
                    open={showAi}
                    onClose={() => setShowAi(false)}
                    onRequestOpen={() => setShowAi(true)}
                />
            </div>
        </div>
    );
};

export default Editor;
