import { open } from "@tauri-apps/plugin-dialog";
import type { AppConfig } from "../types";

interface TerminalSettingsProps {
    config: AppConfig;
    updateConfig: (patch: Partial<AppConfig>) => void;
}

const sourceOptions = [
    { value: "bundled", label: "Incluida" },
    { value: "custom", label: "Propia" },
    { value: "none", label: "Ninguna" },
] as const;

const fitOptions = [
    { value: "cover", label: "Cubrir todo" },
    { value: "contain", label: "Entera, a la derecha" },
] as const;

const chipClass = (active: boolean) =>
    `px-2.5 py-1 rounded text-[11px] transition-colors ${active ? "bg-accent text-white" : "bg-white/5 text-gray-400 hover:bg-white/10"}`;

const fileName = (path: string) => path.split(/[\\/]/).pop() ?? path;

export const TerminalSettings = ({ config, updateConfig }: TerminalSettingsProps) => {
    const hasImage = config.terminal_background_source !== "none";

    const handlePick = async () => {
        try {
            const picked = await open({
                multiple: false,
                filters: [{ name: "Imágenes", extensions: ["gif", "png", "jpg", "jpeg", "webp"] }],
            });
            if (typeof picked === "string") {
                updateConfig({ terminal_background_source: "custom", terminal_background_image: picked });
            }
        } catch (error) {
            console.error("No se pudo abrir el selector de ficheros:", error);
        }
    };

    return (
        <div className="max-w-2xl">
            <div className="py-3 border-b border-white/5">
                <p className="text-sm text-gray-200 font-medium mb-0.5">Imagen de fondo</p>
                <p className="text-xs text-gray-500 mb-3">Se muestra detrás de "Salida" y "Terminal". Admite GIF animados.</p>

                <div className="flex gap-2">
                    {sourceOptions.map((option) => (
                        <button
                            key={option.value}
                            onClick={() => updateConfig({ terminal_background_source: option.value })}
                            className={chipClass(config.terminal_background_source === option.value)}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>

                {config.terminal_background_source === "custom" && (
                    <div className="mt-3 flex items-center gap-3">
                        <button onClick={handlePick} className="px-3 py-1.5 rounded text-xs bg-white/5 hover:bg-white/10 text-gray-200 transition-colors">
                            <i className="bi bi-folder2-open mr-1.5" />
                            Elegir imagen…
                        </button>
                        <span className="text-xs text-gray-500 font-mono truncate" title={config.terminal_background_image}>
                            {config.terminal_background_image ? fileName(config.terminal_background_image) : "Ninguna elegida (se usa la incluida)"}
                        </span>
                    </div>
                )}
            </div>

            {hasImage && (
                <>
                    <div className="py-3 border-b border-white/5">
                        <p className="text-sm text-gray-200 font-medium mb-2">Ajuste</p>
                        <div className="flex gap-2">
                            {fitOptions.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => updateConfig({ terminal_background_fit: option.value })}
                                    className={chipClass(config.terminal_background_fit === option.value)}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="py-3 border-b border-white/5">
                        <p className="text-sm text-gray-200 font-medium mb-0.5">Oscurecer imagen: {config.terminal_background_dim}%</p>
                        <p className="text-xs text-gray-500 mb-2">Más oscuro = texto más legible.</p>
                        <input
                            type="range"
                            min={0}
                            max={100}
                            value={config.terminal_background_dim}
                            onChange={(e) => updateConfig({ terminal_background_dim: Number(e.target.value) })}
                            className="w-full accent-[#5865f2]"
                        />
                    </div>
                </>
            )}
        </div>
    );
};
