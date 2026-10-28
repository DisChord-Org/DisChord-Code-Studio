import type { ReactNode, Ref } from "react";
import { CodeCanvas, EmptyEditor, TabBar } from "../features/editor";
import type { CodeCanvasHandle, GotoTarget, MinimapViewport, OpenTab } from "../features/editor";
import { PackageManager } from "../features/packages";
import { ShortcutsReference } from "../features/shortcuts";

interface EditorPaneProps {
    projectName: string;
    tabs: OpenTab[];
    activeTab: OpenTab | null;
    pane: "main" | "split";
    onSelect: (path: string) => void;
    onClose: (path: string) => void;
    onOpenInSplit: (path: string) => void;
    onToggleSplit?: () => void;
    splitOpen?: boolean;
    onContentChange: (path: string, value: string) => void;
    onDirtyChange: (path: string, value: boolean) => void;
    canvasRef?: Ref<CodeCanvasHandle>;
    onViewportChange?: (viewport: MinimapViewport) => void;
    goto?: GotoTarget | null;
    requireFocus?: boolean;
    sideContent?: ReactNode;
}

/** One side of the editor: its tab bar and whatever the active tab shows. */
export const EditorPane = ({
    projectName,
    tabs,
    activeTab,
    pane,
    onSelect,
    onClose,
    onOpenInSplit,
    onToggleSplit,
    splitOpen,
    onContentChange,
    onDirtyChange,
    canvasRef,
    onViewportChange,
    goto,
    requireFocus,
    sideContent,
}: EditorPaneProps) => {
    const renderBody = () => {
        if (!activeTab) return <EmptyEditor />;

        if (activeTab.kind === "packages") {
            return (
                <PackageManager
                    key={`${projectName}:${activeTab.relative_path}`}
                    projectName={projectName}
                    onClose={() => onClose(activeTab.relative_path)}
                />
            );
        }

        if (activeTab.kind === "shortcuts") {
            return <ShortcutsReference onClose={() => onClose(activeTab.relative_path)} />;
        }

        return (
            <div className="flex h-full">
                <div className="flex-1 min-w-0 overflow-hidden">
                    <CodeCanvas
                        ref={canvasRef}
                        key={`${projectName}:${pane}:${activeTab.relative_path}`}
                        projectName={projectName}
                        relative_path={activeTab.relative_path}
                        fileName={activeTab.name}
                        content={activeTab.content}
                        setIsDirty={(value) => onDirtyChange(activeTab.relative_path, value)}
                        onChange={(value) => onContentChange(activeTab.relative_path, value)}
                        onViewportChange={onViewportChange}
                        goto={goto}
                        requireFocus={requireFocus}
                    />
                </div>
                {sideContent}
            </div>
        );
    };

    return (
        <>
            <TabBar
                tabs={tabs}
                activePath={activeTab?.relative_path ?? null}
                onSelect={onSelect}
                onClose={onClose}
                onOpenInSplit={onOpenInSplit}
                onToggleSplit={onToggleSplit}
                splitOpen={splitOpen}
            />
            <div className="flex-1 min-h-0 relative overflow-hidden">{renderBody()}</div>
        </>
    );
};
