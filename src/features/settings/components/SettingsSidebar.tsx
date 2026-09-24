import type { SettingsSection } from "../types";
import { Label, Tooltip } from "../../../components/ui";
import { navItems } from "./SettingsSidebar.constants";

interface SettingsSidebarProps {
    activeSection: SettingsSection;
    onSelect: (section: SettingsSection) => void;
    onEditJson: () => void;
}

export const SettingsSidebar = ({ activeSection, onSelect, onEditJson }: SettingsSidebarProps) => (
    <aside className="w-52 bg-panel-alt shadow-[1px_0_3px_0_rgba(0,0,0,0.35)] flex flex-col shrink-0 select-none relative z-10">
        <div className="px-3 pt-3 pb-1.5">
            <Label>Configuración</Label>
        </div>

        <nav className="flex flex-col px-2 gap-0.5">
            {navItems.map((item) => (
                <button
                    key={item.key}
                    onClick={() => onSelect(item.key)}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded text-[12px] text-left transition-colors
                        ${activeSection === item.key
                            ? "bg-accent/10 text-white"
                            : "text-gray-300 hover:bg-white/5 hover:text-white"
                        }`}
                >
                    <i className={`bi ${item.icon} text-[11px]`}></i>
                    {item.label}
                </button>
            ))}
        </nav>

        <div className="mt-auto px-2 pt-2 pb-2 border-t border-white/5">
            <Tooltip label="Editar config.json directamente" placement="top" className="w-full">
                <button
                    onClick={onEditJson}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-[12px] text-left text-gray-500 hover:bg-white/5 hover:text-gray-300 transition-colors"
                >
                    <i className="bi bi-filetype-json text-[11px]"></i>
                    Editar como JSON
                </button>
            </Tooltip>
        </div>
    </aside>
);
