import { useEffect, useRef, useState } from "react";
import { Tooltip } from "../../../../components/ui";
import { useConfig } from "../../../settings";
import { useResizablePanel } from "../../useResizablePanel";
import { InteractiveTerminal } from "./InteractiveTerminal";
import { RunOutput } from "./RunOutput";
import { TerminalBackground } from "./TerminalBackground";
import { TerminalControls } from "./TerminalControls";
import { TerminalTabs } from "./TerminalTabs";
import { panelSize } from "./TerminalPanel.constants";
import { clearOutput } from "./outputStore";
import { useControlsArmed } from "./useControlsArmed";
import { useTerminalBackground } from "./useTerminalBackground";
import type { OpenLocationHandler, TerminalTab } from "./types";

interface TerminalPanelProps {
    projectName: string;
    initialTab?: TerminalTab;
    outputSignal?: number;
    isRunning: boolean;
    onStop: () => void;
    onRestart: () => void;
    onOpenLocation: OpenLocationHandler;
    onClose: () => void;
}

export const TerminalPanel = ({ projectName, initialTab = "shell", outputSignal = 0, isRunning, onStop, onRestart, onOpenLocation, onClose }: TerminalPanelProps) => {
    const { config } = useConfig();
    const backgroundUrl = useTerminalBackground(config);
    const [tab, setTab] = useState<TerminalTab>(initialTab);
    const showShell = config.advanced_mode && tab === "shell";
    const controlsArmed = useControlsArmed(isRunning);
    const { size: height, startDrag } = useResizablePanel({ initialSize: panelSize.initial, min: panelSize.min, max: panelSize.max, axis: "y", invert: true });

    // Compare against the last seen value so the initial mount does not force the output tab.
    const lastOutputSignal = useRef(outputSignal);
    useEffect(() => {
        if (outputSignal !== lastOutputSignal.current) {
            lastOutputSignal.current = outputSignal;
            setTab("output");
        }
    }, [outputSignal]);

    return (
        <div className="flex flex-col bg-app-bg border-t border-white/5 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.5)] relative shrink-0" style={{ height }}>
            <div
                onMouseDown={startDrag}
                className="absolute top-0 left-0 right-0 h-1 -translate-y-1/2 cursor-row-resize hover:bg-accent/50 active:bg-accent transition-colors z-20"
            />

            <div className="flex items-center justify-between px-4 py-2 bg-[#0E1117]/50 backdrop-blur-sm border-b border-white/[0.02]">
                <div className="flex items-center gap-3">
                    <TerminalControls armed={controlsArmed} onStop={onStop} onRestart={onRestart} />
                    <TerminalTabs advanced={config.advanced_mode} current={showShell ? "shell" : "output"} onSelect={setTab} />
                </div>

                <div className="flex items-center gap-4">
                    {!showShell && <button
                        onClick={clearOutput}
                        className="group flex items-center gap-1.5 text-[10px] font-medium text-gray-500 hover:text-accent transition-all"
                    >
                        <i className="bi bi-trash3 text-xs opacity-50 group-hover:opacity-100"></i>
                        <span>LIMPIAR</span>
                    </button>}

                    {!showShell && <div className="w-[1px] h-3 bg-white/10" />}

                    <Tooltip label="Cerrar panel" placement="bottom">
                        <button
                            onClick={onClose}
                            className="text-gray-500 hover:text-white transition-colors flex items-center justify-center"
                        >
                            <i className="bi bi-x-lg text-sm"></i>
                        </button>
                    </Tooltip>
                </div>
            </div>

            <div className="flex-1 p-3 overflow-hidden relative bg-[#0B0E14]">
                {backgroundUrl && (
                    <TerminalBackground url={backgroundUrl} dim={config.terminal_background_dim} fit={config.terminal_background_fit} />
                )}
                <RunOutput onOpenLocation={onOpenLocation} className={`relative h-full w-full ${showShell ? "hidden" : ""}`} />
                {config.advanced_mode && (
                    <div className={`h-full w-full ${showShell ? "" : "hidden"}`}>
                        <InteractiveTerminal
                            projectName={projectName}
                            fontFamily={config.editor_font_family}
                            active={showShell}
                            height={height}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};
