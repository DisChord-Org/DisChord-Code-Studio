import type { FormEvent } from "react";
import { usePackageManager } from "../usePackageManager";
import { InUseSection } from "./InUseSection";
import { RegistrySection } from "./RegistrySection";

interface PackageManagerProps {
    onClose: () => void;
    projectName: string;
}

export const PackageManager = ({ onClose, projectName }: PackageManagerProps) => {
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
    } = usePackageManager({ projectName });

    const onSubmitSearch = (e: FormEvent) => {
        e.preventDefault();
        handleSearch();
    };

    return (
        <div className="h-full flex flex-col bg-app-bg">
            <div className="px-6 pt-5 pb-4 shrink-0 flex justify-center">
                <div className="max-w-3xl w-full">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-white font-semibold text-base">Dependencias</h2>
                            <p className="text-[11px] text-gray-500 mt-0.5">Busca, instala y gestiona librerías DisChord (chord pkg).</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-white transition-colors rounded hover:bg-white/5"
                        >
                            <i className="bi bi-x-lg text-sm"></i>
                        </button>
                    </div>

                    <form onSubmit={onSubmitSearch} className="mt-4">
                        <div className="flex items-center gap-2.5 border-b border-white/10 focus-within:border-accent/60 pb-2 transition-colors">
                            <i className="bi bi-search text-gray-600 text-xs"></i>
                            <input
                                autoFocus
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Buscar en el registro..."
                                className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-600"
                            />
                        </div>
                    </form>
                </div>
            </div>

            <div className="custom-scrollbar flex-1 overflow-y-auto px-6 pb-6">
                <div className="max-w-3xl w-full mx-auto space-y-6">
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
