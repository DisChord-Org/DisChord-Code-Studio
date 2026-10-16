import { Tooltip } from "../../../../components/ui";

interface TerminalControlsProps {
    armed: boolean;
    onStop: () => void;
    onRestart: () => void;
}

/** Window-style dots that become "stop" / "restart" once armed. */
export const TerminalControls = ({ armed, onStop, onRestart }: TerminalControlsProps) => (
    <div className="flex gap-1.5">
        {armed ? (
            <>
                <Tooltip label="Detener" placement="bottom">
                    <button onClick={onStop} className="w-2 h-2 rounded-full bg-red-500 hover:bg-red-400 transition-colors" />
                </Tooltip>
                <Tooltip label="Reiniciar" placement="bottom">
                    <button onClick={onRestart} className="w-2 h-2 rounded-full bg-amber-500 hover:bg-amber-400 transition-colors" />
                </Tooltip>
            </>
        ) : (
            <>
                <div className="w-2 h-2 rounded-full bg-white/10" />
                <div className="w-2 h-2 rounded-full bg-white/10" />
            </>
        )}
    </div>
);
