import { ToolbarButton } from "./ToolbarButton";

export const Toolbar = ({ projectName, onBack }: { projectName: string, onBack: () => void }) => (
    <header className="h-12 border-b border-[#1e1f22] bg-[#0B0E14] flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2">
            <span className="text-[#5865F2] font-bold text-lg mr-4">D</span>
            <ToolbarButton label="Archivo" />
            <ToolbarButton label="Editar" />
            <ToolbarButton label="Ejecutar" icon="" variant="run" />
        </div>

        <div className="flex items-center gap-4">
            <span className="text-xs text-gray-600 font-mono px-2 py-1 rounded">
                {projectName}
            </span>
            <button onClick={onBack} className="text-xs text-gray-500 hover:text-white transition-colors">
                ← Volver
            </button>
        </div>
    </header>
);