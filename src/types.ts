export interface ProjectSummary {
    name: string;
    last_modified: string;
}

export interface PackageEntry {
    name: string;
    latest_version: string;
    description: string;
    repo: string | null;
    tags: string[];
    versions: string[];
}

export interface ProjectLibrary {
    name: string;
    version: string;
}

export interface PkgOpOutcome {
    success: boolean;
    output: string;
}
