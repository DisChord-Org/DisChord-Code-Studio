export type DiagnosticSeverity = "error" | "warning" | "info";

export interface CompilerDiagnostic {
    file?: string | null;
    phase?: string | null;
    severity: DiagnosticSeverity | string;
    message: string;
    line?: number | null;
    column?: number | null;
}

export interface CheckResult {
    ok: boolean;
    diagnostics: CompilerDiagnostic[];
    tool_error?: string | null;
}

export interface Corelib {
    schema: number;
    compilerVersion: string;
    keywords: string[];
    types: Array<{ name: string; kind: string }>;
    events: Array<{ name: string; params: string[] }>;
    scopes: Array<{ construct: string; identifiers: string[] }>;
    [key: string]: unknown;
}
