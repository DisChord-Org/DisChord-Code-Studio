import { Tooltip } from "../../../components/ui/Tooltip";

interface ViewModeToggleProps {
    value: "list" | "grid";
    onChange: (mode: "list" | "grid") => void;
}

export const ViewModeToggle = ({ value, onChange }: ViewModeToggleProps) => (
    <div className="flex items-center gap-0.5 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-md p-0.5 transition-colors duration-200">
        <Tooltip label="Vista de lista">
            <button
                onClick={() => onChange("list")}
                className={`flex items-center justify-center w-5 h-5 rounded transition-all duration-200 ${
                    value === "list"
                        ? "bg-[#5865F2] text-white shadow-sm"
                        : "text-gray-600 hover:text-gray-300"
                }`}
            >
                <i className="bi bi-list-ul text-[10px]"></i>
            </button>
        </Tooltip>
        <Tooltip label="Vista de cuadrícula">
            <button
                onClick={() => onChange("grid")}
                className={`flex items-center justify-center w-5 h-5 rounded transition-all duration-200 ${
                    value === "grid"
                        ? "bg-[#5865F2] text-white shadow-sm"
                        : "text-gray-600 hover:text-gray-300"
                }`}
            >
                <i className="bi bi-grid-3x3-gap-fill text-[10px]"></i>
            </button>
        </Tooltip>
    </div>
);
