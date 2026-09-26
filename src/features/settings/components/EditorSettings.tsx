import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { AppConfig } from "../types";
import { buildFontFamilyCss, isFontAvailable } from "../font";
import { downloadFont, downloadableFonts, removeDownloadedFont } from "../localFonts";
import { fontOptions } from "./EditorSettings.constants";

const previewText = "var chord tipo texto es \"DisChord\"";
const tabSizeOptions = [2, 4, 8];
const minFontSize = 8;
const maxFontSize = 32;

interface EditorSettingsProps {
    config: AppConfig;
    updateConfig: (patch: Partial<AppConfig>) => void;
}

export const EditorSettings = ({ config, updateConfig }: EditorSettingsProps) => {
    const [customFont, setCustomFont] = useState(config.editor_font_family);
    const [checking, setChecking] = useState(false);
    const [downloading, setDownloading] = useState<string | null>(null);
    const [fontError, setFontError] = useState<string | null>(null);
    const [uninstalled, setUninstalled] = useState<Set<string>>(new Set());
    const [installing, setInstalling] = useState<string | null>(null);
    const [installError, setInstallError] = useState<string | null>(null);
    const [deleting, setDeleting] = useState<string | null>(null);
    const isPreset = fontOptions.some((option) => option.value === config.editor_font_family);
    const fontSizeFillPercent = ((config.editor_font_size - minFontSize) / (maxFontSize - minFontSize)) * 100;

    useEffect(() => {
        setCustomFont(config.editor_font_family);
        setFontError(null);
    }, [config.editor_font_family]);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            const downloadable = fontOptions.filter((option) => downloadableFonts.has(option.value));
            const results = await Promise.all(
                downloadable.map(async (option) => [option.value, await isFontAvailable(option.value)] as const)
            );
            if (cancelled) return;
            setUninstalled(new Set(results.filter(([, available]) => !available).map(([name]) => name)));
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    const installFont = async (name: string) => {
        setInstalling(name);
        setInstallError(null);

        try {
            await downloadFont(name);
            setUninstalled((prev) => {
                const next = new Set(prev);
                next.delete(name);
                return next;
            });
            updateConfig({ editor_font_family: name });
        } catch (error) {
            setInstallError(`No se pudo instalar "${name}": ${error}`);
        } finally {
            setInstalling(null);
        }
    };

    const deleteFont = async (name: string) => {
        setDeleting(name);
        setInstallError(null);

        try {
            await removeDownloadedFont(name);
            setUninstalled((prev) => new Set(prev).add(name));
            if (config.editor_font_family === name) {
                updateConfig({ editor_font_family: "Monocraft" });
            }
        } catch (error) {
            setInstallError(`No se pudo borrar "${name}": ${error}`);
        } finally {
            setDeleting(null);
        }
    };

    const applyFont = async (name: string) => {
        const trimmed = name.trim();
        if (!trimmed || trimmed === config.editor_font_family) return;

        setChecking(true);
        setFontError(null);

        const available = await isFontAvailable(trimmed);

        setChecking(false);

        if (!available) {
            if (!downloadableFonts.has(trimmed)) {
                setFontError(`La fuente "${trimmed}" no está instalada en tu sistema.`);
                return;
            }

            setDownloading(trimmed);
            try {
                await downloadFont(trimmed);
            } catch (error) {
                setDownloading(null);
                setFontError(`No se pudo descargar "${trimmed}": ${error}`);
                return;
            }
            setDownloading(null);
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
                    {fontOptions.map((option) => {
                        const isDownloadable = downloadableFonts.has(option.value);
                        const needsInstall = isDownloadable && uninstalled.has(option.value);
                        const isInstallingThis = installing === option.value;
                        const isDeletingThis = deleting === option.value;

                        return (
                            <div
                                key={option.value}
                                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-md border transition-colors
                                    ${config.editor_font_family === option.value
                                        ? "bg-accent/10 border-accent/40"
                                        : "bg-white/[0.02] border-white/[0.06]"
                                    }`}
                            >
                                <button
                                    onClick={() => !needsInstall && applyFont(option.value)}
                                    disabled={needsInstall}
                                    className={`flex-1 min-w-0 text-left ${needsInstall ? "cursor-default" : "hover:opacity-90"}`}
                                >
                                    <p className="text-[12px] text-gray-200">{option.label}</p>
                                    <p className="text-[10px] text-gray-500">
                                        {needsInstall ? option.description : (option.installedDescription ?? option.description)}
                                    </p>
                                    {!needsInstall && (
                                        <p className="text-[12px] text-gray-400 mt-1.5 truncate" style={{ fontFamily: buildFontFamilyCss(option.value) }}>
                                            {previewText}
                                        </p>
                                    )}
                                </button>

                                {needsInstall ? (
                                    <button
                                        onClick={() => installFont(option.value)}
                                        disabled={isInstallingThis}
                                        className="shrink-0 flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-md bg-accent/15 text-accent-light border border-accent/30 hover:bg-accent/25 transition-colors disabled:opacity-70"
                                    >
                                        {isInstallingThis ? (
                                            <>
                                                <i className="bi bi-arrow-repeat text-[12px] animate-spin"></i>
                                                Instalando...
                                            </>
                                        ) : (
                                            <>
                                                <i className="bi bi-download text-[12px]"></i>
                                                Instalar
                                            </>
                                        )}
                                    </button>
                                ) : (
                                    <div className="flex items-center gap-2 shrink-0">
                                        {config.editor_font_family === option.value && (
                                            <i className="bi bi-check2 text-accent text-[13px]"></i>
                                        )}
                                        {isDownloadable && (
                                            <button
                                                onClick={() => deleteFont(option.value)}
                                                disabled={isDeletingThis}
                                                title={`Borrar ${option.label}`}
                                                className="text-gray-500 hover:text-red-400 transition-colors disabled:opacity-50"
                                            >
                                                <i className={`bi ${isDeletingThis ? "bi-arrow-repeat animate-spin" : "bi-trash3"} text-[12px]`}></i>
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {checking && <p className="text-[10px] text-gray-500 mt-1.5">Comprobando...</p>}
                {downloading && <p className="text-[10px] text-accent-light mt-1.5">Descargando "{downloading}"...</p>}
                {fontError && <p className="text-[10px] text-red-400 mt-1.5">{fontError}</p>}
                {installError && <p className="text-[10px] text-red-400 mt-1.5">{installError}</p>}

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
                <p className="text-sm text-gray-200 font-medium mb-0.5">Indentación</p>
                <p className="text-xs text-gray-500 mb-3">
                    Ancho de cada nivel de sangría{config.editor_use_tabs ? " (cómo se dibuja cada tabulador)" : " (espacios que se insertan con Tab)"}.
                </p>

                <button
                    onClick={() => updateConfig({ editor_use_tabs: !config.editor_use_tabs })}
                    className="w-full flex items-center justify-between text-left mb-3"
                >
                    <div>
                        <p className="text-[12px] text-gray-200 mb-0.5">Usar tabuladores</p>
                        <p className="text-[10px] text-gray-500">
                            Inserta un carácter de tabulación en vez de varios espacios al indentar.
                        </p>
                    </div>
                    <span
                        className={`shrink-0 ml-3 w-9 h-5 rounded-full p-0.5 transition-colors ${config.editor_use_tabs ? "bg-accent" : "bg-white/10"}`}
                    >
                        <span
                            className={`block w-4 h-4 rounded-full bg-white transition-transform ${config.editor_use_tabs ? "translate-x-4" : "translate-x-0"}`}
                        />
                    </span>
                </button>

                <div className="flex items-center gap-1.5">
                    {tabSizeOptions.map((size) => (
                        <button
                            key={size}
                            onClick={() => updateConfig({ editor_tab_size: size })}
                            className={`min-w-[56px] px-3 py-1.5 rounded-md border text-[12px] font-mono transition-colors
                                ${config.editor_tab_size === size
                                    ? "bg-accent/10 border-accent/40 text-white"
                                    : "bg-white/[0.02] border-white/[0.06] text-gray-400 hover:bg-white/[0.04] hover:text-gray-200"
                                }`}
                        >
                            {size}
                        </button>
                    ))}
                    <span className="text-[11px] text-gray-500 ml-1">{config.editor_use_tabs ? "de ancho" : "espacios"}</span>
                </div>
            </div>

            <div className="py-3 border-b border-white/5">
                <p className="text-sm text-gray-200 font-medium mb-0.5">Ventana no maximizada</p>
                <p className="text-xs text-gray-500 mb-3">
                    Con la ventana maximizada se ven siempre. Si la reduces, por defecto se ocultan para dar más espacio al código.
                </p>

                <button
                    onClick={() => updateConfig({ editor_keep_minimap: !config.editor_keep_minimap })}
                    className="w-full flex items-center justify-between text-left"
                >
                    <div>
                        <p className="text-[12px] text-gray-200 mb-0.5">Mantener el minimapa y la barra de desplazamiento</p>
                        <p className="text-[10px] text-gray-500">Los muestra aunque el editor no esté maximizado.</p>
                    </div>
                    <span
                        className={`shrink-0 ml-3 w-9 h-5 rounded-full p-0.5 transition-colors ${config.editor_keep_minimap ? "bg-accent" : "bg-white/10"}`}
                    >
                        <span
                            className={`block w-4 h-4 rounded-full bg-white transition-transform ${config.editor_keep_minimap ? "translate-x-4" : "translate-x-0"}`}
                        />
                    </span>
                </button>

                <div className="h-3" />

                <button
                    onClick={() => updateConfig({ editor_keep_statusbar: !config.editor_keep_statusbar })}
                    className="w-full flex items-center justify-between text-left"
                >
                    <div>
                        <p className="text-[12px] text-gray-200 mb-0.5">Mantener la barra de estado</p>
                        <p className="text-[10px] text-gray-500">La muestra aunque el editor no esté maximizado.</p>
                    </div>
                    <span
                        className={`shrink-0 ml-3 w-9 h-5 rounded-full p-0.5 transition-colors ${config.editor_keep_statusbar ? "bg-accent" : "bg-white/10"}`}
                    >
                        <span
                            className={`block w-4 h-4 rounded-full bg-white transition-transform ${config.editor_keep_statusbar ? "translate-x-4" : "translate-x-0"}`}
                        />
                    </span>
                </button>
            </div>

            <div className="py-3 border-b border-white/5">
                <button
                    onClick={() => updateConfig({ editor_final_newline: !config.editor_final_newline })}
                    className="w-full flex items-center justify-between text-left"
                >
                    <div>
                        <p className="text-sm text-gray-200 font-medium mb-0.5">Línea vacía al final del archivo</p>
                        <p className="text-xs text-gray-500">
                            Al guardar, añade un salto de línea al final si el archivo no lo tiene. Si ya lo tiene, no toca nada.
                        </p>
                    </div>
                    <span
                        className={`shrink-0 ml-3 w-9 h-5 rounded-full p-0.5 transition-colors ${config.editor_final_newline ? "bg-accent" : "bg-white/10"}`}
                    >
                        <span
                            className={`block w-4 h-4 rounded-full bg-white transition-transform ${config.editor_final_newline ? "translate-x-4" : "translate-x-0"}`}
                        />
                    </span>
                </button>
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
