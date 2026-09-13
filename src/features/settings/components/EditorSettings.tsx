import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { AppConfig } from "../types";
import { buildFontFamilyCss, isFontAvailable } from "../font";
import { fontOptions } from "./EditorSettings.constants";

const previewText = "var chord tipo texto es \"DisChord\"";
const minFontSize = 8;
const maxFontSize = 32;

interface EditorSettingsProps {
    config: AppConfig;
    updateConfig: (patch: Partial<AppConfig>) => void;
}

export const EditorSettings = ({ config, updateConfig }: EditorSettingsProps) => {
    const [customFont, setCustomFont] = useState(config.editor_font_family);
    const [checking, setChecking] = useState(false);
    const [fontError, setFontError] = useState<string | null>(null);
    const isPreset = fontOptions.some((option) => option.value === config.editor_font_family);
    const fontSizeFillPercent = ((config.editor_font_size - minFontSize) / (maxFontSize - minFontSize)) * 100;

    useEffect(() => {
        setCustomFont(config.editor_font_family);
        setFontError(null);
    }, [config.editor_font_family]);

    const applyFont = async (name: string) => {
        const trimmed = name.trim();
        if (!trimmed || trimmed === config.editor_font_family) return;

        setChecking(true);
        setFontError(null);

        const available = await isFontAvailable(trimmed);

        setChecking(false);

        if (!available) {
            setFontError(`La fuente "${trimmed}" no está instalada en tu sistema.`);
            return;
        }

        updateConfig({ editor_font_family: trimmed });
    };

    return (
        <div className="max-w-xl flex flex-col">
            <div className="py-3 border-b border-white/5">
                <p className="text-sm text-gray-200 font-medium mb-0.5">Tipografía del editor</p>
                <p className="text-xs text-gray-500 mb-3">
                    La fuente que se usa en el CodeView, la numeración de líneas, la terminal y el minimapa.
                </p>

                <div className="flex flex-col gap-1.5">
                    {fontOptions.map((option) => (
                        <button
                            key={option.value}
                            onClick={() => applyFont(option.value)}
                            className={`flex items-center justify-between text-left px-3 py-2 rounded-md border transition-colors
                                ${config.editor_font_family === option.value
                                    ? "bg-accent/10 border-accent/40"
                                    : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]"
                                }`}
                        >
                            <div className="min-w-0">
                                <p className="text-[12px] text-gray-200">{option.label}</p>
                                <p className="text-[10px] text-gray-500">{option.description}</p>
                                <p className="text-[12px] text-gray-400 mt-1.5 truncate" style={{ fontFamily: buildFontFamilyCss(option.value) }}>
                                    {previewText}
                                </p>
                            </div>
                            {config.editor_font_family === option.value && (
                                <i className="bi bi-check2 text-accent text-[13px] shrink-0 ml-2"></i>
                            )}
                        </button>
                    ))}
                </div>

                <div className={`mt-1.5 px-3 py-2 rounded-md border transition-colors ${!isPreset ? "bg-accent/10 border-accent/40" : "bg-white/[0.02] border-white/[0.06]"}`}>
                    <p className="text-[12px] text-gray-200 mb-0.5">Personalizada</p>
                    <p className="text-[10px] text-gray-500 mb-2">
                        Escribe el nombre exacto de cualquier fuente instalada en tu sistema.
                    </p>
                    <input
                        value={customFont}
                        onChange={(e) => setCustomFont(e.target.value)}
                        onBlur={() => applyFont(customFont)}
                        onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
                        placeholder="p. ej. Comic Mono"
                        className={`w-full bg-border border rounded px-2 py-1.5 text-[12px] text-white outline-none
                            ${fontError ? "border-red-500/50 focus:border-red-500" : "border-border-strong focus:border-accent"}`}
                    />
                    {checking && <p className="text-[10px] text-gray-500 mt-1.5">Comprobando...</p>}
                    {fontError && <p className="text-[10px] text-red-400 mt-1.5">{fontError}</p>}
                    <p className="text-[12px] text-gray-400 mt-2 truncate" style={{ fontFamily: buildFontFamilyCss(config.editor_font_family) }}>
                        {previewText}
                    </p>
                </div>
            </div>

            <div className="py-3 border-b border-white/5">
                <p className="text-sm text-gray-200 font-medium mb-0.5">Tamaño de fuente</p>
                <p className="text-xs text-gray-500 mb-3">
                    Tamaño del texto en el CodeView y la numeración de líneas ({minFontSize}–{maxFontSize}px).
                </p>

                <div className="flex items-center gap-3">
                    <input
                        type="range"
                        min={minFontSize}
                        max={maxFontSize}
                        step={1}
                        value={config.editor_font_size}
                        onChange={(e) => updateConfig({ editor_font_size: Number(e.target.value) })}
                        style={{ "--range-fill": `${fontSizeFillPercent}%` } as CSSProperties}
                        className="font-size-slider flex-1"
                    />
                    <span className="text-[11px] text-gray-300 font-mono bg-white/5 border border-white/10 rounded px-2 py-1 text-right shrink-0 tabular-nums">
                        {config.editor_font_size}px
                    </span>
                </div>
            </div>

            <div className="py-3 border-b border-white/5">
                <button
                    onClick={() => updateConfig({ editor_word_wrap: !config.editor_word_wrap })}
                    className="w-full flex items-center justify-between text-left"
                >
                    <div>
                        <p className="text-sm text-gray-200 font-medium mb-0.5">Ajuste de línea</p>
                        <p className="text-xs text-gray-500">
                            Envuelve las líneas largas en vez de mostrar scroll horizontal. Atajo: <span className="font-mono">Alt+Z</span>.
                        </p>
                    </div>
                    <span
                        className={`shrink-0 ml-3 w-9 h-5 rounded-full p-0.5 transition-colors ${config.editor_word_wrap ? "bg-accent" : "bg-white/10"}`}
                    >
                        <span
                            className={`block w-4 h-4 rounded-full bg-white transition-transform ${config.editor_word_wrap ? "translate-x-4" : "translate-x-0"}`}
                        />
                    </span>
                </button>
            </div>
        </div>
    );
};
