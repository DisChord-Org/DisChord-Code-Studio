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

export interface PkgResult {
    package: string;
    version: string | null;
    phase: string;
    message: string | null;
}

export interface PkgOpOutcome {
    success: boolean;
    output: string;
    results: PkgResult[];
}

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

export interface Feedback {
    ok: boolean;
    message: string;
}
