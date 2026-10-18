import type { FormEvent } from "react";
import { TabPage } from "../../../components/ui";
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
        searchedQuery,
        busy,
        syncing,
        progress,
        installedVersions,
        usedVersion,
        versionFor,
        handleSearch,
        handleInstall,
        handleUse,
        handleUnuse,
        handleUpdate,
        handleUninstall,
        handleSync,
    } = usePackageManager({ projectName });

    const onSubmitSearch = (e: FormEvent) => {
        e.preventDefault();
        handleSearch();
    };

    return (
        <TabPage
            title="Dependencias"
            description="Busca, instala y gestiona librerías DisChord (chord pkg)."
            onClose={onClose}
            headerExtra={
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
            }
        >
            <InUseSection
                projectLibs={projectLibs}
                busy={busy}
                syncing={syncing}
                progress={progress}
                onSync={handleSync}
                onUnuse={handleUnuse}
            />

            <RegistrySection
                results={results}
                loading={loading}
                error={error}
                busy={busy}
                searchedQuery={searchedQuery}
                onRetry={handleSearch}
                progress={progress}
                installedVersions={installedVersions}
                usedVersion={usedVersion}
                versionFor={versionFor}
                onSelectVersion={(name, version) => setSelectedVersion((prev) => ({ ...prev, [name]: version }))}
                onInstall={handleInstall}
                onUse={handleUse}
                onUnuse={handleUnuse}
                onUpdate={handleUpdate}
                onUninstall={handleUninstall}
            />
        </TabPage>
    );
};
