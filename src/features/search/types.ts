export interface SearchMatch {
    line: number;
    column: number;
    length: number;
    preview: string;
    preview_offset: number;
}

export interface FileMatches {
    path: string;
    matches: SearchMatch[];
}

export interface SearchResults {
    files: FileMatches[];
    total_matches: number;
    truncated: boolean;
}

export interface ReplaceSummary {
    files: number;
    occurrences: number;
}
