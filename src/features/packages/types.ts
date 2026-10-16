export interface PackageVersion {
    tag: string;
    is_audited: boolean;
    download_url: string;
    created_at: number;
}

export interface PackageEntry {
    name: string;
    description: string;
    trust_level: number;
    repository: string;
    latest_version: string;
    is_audited: boolean;
    versions: PackageVersion[];
}

export interface ProjectLibrary {
    name: string;
    version: string;
}

/** How serious what happened to a package is: "info" means it was already as asked. */
export type PkgSeverity = "info" | "success" | "error";

export interface PkgResult {
    package: string;
    version: string | null;
    phase: string;
    message: string | null;
    severity: PkgSeverity;
    /** The CLI warned about it (for example, an unsigned package) even though the operation went on. */
    warned: boolean;
}

export interface PkgOpOutcome {
    success: boolean;
    /** False when everything was already as asked. */
    changed: boolean;
    output: string;
    results: PkgResult[];
}

export type PkgOp = PkgProgressEvent["op"];

export interface PkgProgressEvent {
    op: "install" | "uninstall" | "use" | "unuse" | "sync";
    package: string;
    version?: string;
    phase: string;
    percent?: number;
    current_bytes?: number;
    total_bytes?: number;
    message?: string;
    path?: string;
}

