import type { FormEvent } from "react";
import { Button } from "../../../components/ui/Button";
import { usePackageManager } from "../usePackageManager";
import { InUseSection } from "./InUseSection";
import { RegistrySection } from "./RegistrySection";

interface PackageManagerProps {
    isOpen: boolean;
    onClose: () => void;
    projectName: string;
}

export const PackageManager = ({ isOpen, onClose, projectName }: PackageManagerProps) => {
    const {
        query,
        setQuery,
        results,
        projectLibs,
        setSelectedVersion,
        loading,
        error,
        busy,
        syncing,
        feedback,
        progress,
        installedVersions,
        usedVersion,
        versionFor,
        handleSearch,
        handleInstall,
        handleUse,
        handleUnuse,
        handleUninstall,
        handleSync,
    } = usePackageManager({ isOpen, projectName });

    if (!isOpen) return null;

    const onSubmitSearch = (e: FormEvent) => {
        e.preventDefault();
        handleSearch();
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
            <div className="bg-panel border border-border rounded-xl w-full max-w-2xl max-h-[85vh] shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 shrink-0">
                    <div>
                        <h2 className="text-white font-bold text-sm">Dependencias del proyecto</h2>
                        <p className="text-[11px] text-gray-500 mt-0.5">Busca, instala y gestiona librerías DisChord (chord pkg).</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-white transition-colors rounded hover:bg-white/5"
                    >
                        <i className="bi bi-x-lg text-sm"></i>
                    </button>
                </div>

                <form onSubmit={onSubmitSearch} className="px-5 py-3 border-b border-white/5 shrink-0 flex gap-2">
                    <div className="relative flex-1">
                        <i className="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 text-xs"></i>
                        <input
                            autoFocus
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Buscar en el registro..."
                            className="w-full bg-border border border-border-strong rounded pl-8 pr-3 py-1.5 text-xs text-white outline-none focus:border-accent"
                        />
                    </div>
                    <Button type="submit" size="sm">Buscar</Button>
                </form>

                <div className="custom-scrollbar flex-1 overflow-y-auto px-5 py-4 space-y-5">
                    <InUseSection
                        projectLibs={projectLibs}
                        busy={busy}
                        syncing={syncing}
                        feedback={feedback}
                        progress={progress}
                        onSync={handleSync}
                        onUnuse={handleUnuse}
                    />

                    <RegistrySection
                        results={results}
                        loading={loading}
                        error={error}
                        busy={busy}
                        feedback={feedback}
                        progress={progress}
                        installedVersions={installedVersions}
                        usedVersion={usedVersion}
                        versionFor={versionFor}
                        onSelectVersion={(name, version) => setSelectedVersion((prev) => ({ ...prev, [name]: version }))}
                        onInstall={handleInstall}
                        onUse={handleUse}
                        onUnuse={handleUnuse}
                        onUninstall={handleUninstall}
                    />
                </div>
            </div>
        </div>
    );
};
