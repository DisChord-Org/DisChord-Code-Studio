import type { Extension, Text } from "@codemirror/state";
import { linter, lintGutter, type Diagnostic } from "@codemirror/lint";
import { checkSource } from "./api";
import { errorLens } from "./errorLens";
import { clearFileDiagnostics, setFileDiagnostics } from "./diagnosticsStore";
import type { CompilerDiagnostic } from "./types";

const checkDelayMs = 250;
const wordAt = /[\w@À-ɏ]+/y;

export const rangeOf = (doc: Text, line: number, column: number): { from: number; to: number } => {
    const target = doc.line(Math.min(Math.max(line, 1), doc.lines));
    const offset = Math.min(Math.max(column - 1, 0), target.length);
    const from = target.from + offset;

    if (offset >= target.length) {
        return { from: Math.max(target.from, target.to - 1), to: target.to };
    }

    wordAt.lastIndex = offset;
    const match = wordAt.exec(target.text);
    return { from, to: from + (match ? match[0].length : 1) };
};

const severityOf = (value: string): Diagnostic["severity"] =>
    value === "warning" || value === "info" ? value : "error";

export const toEditorDiagnostics = (doc: Text, diagnostics: CompilerDiagnostic[]): Diagnostic[] =>
    diagnostics.flatMap((d) => {
        if (!d.line) return [];

        const { from, to } = rangeOf(doc, d.line, d.column ?? 1);
        return [{
            from,
            to,
            severity: severityOf(d.severity),
            message: d.message,
            source: d.phase ?? undefined,
        }];
    });

export const liveDiagnostics = (projectName: string, filePath: string): Extension => [
    linter(
        async (view) => {
            const result = await checkSource(projectName, filePath, view.state.doc.toString());

            if (result.tool_error) {
                setFileDiagnostics(filePath, { errors: 0, warnings: 0, toolError: result.tool_error });
                return [];
            }

            setFileDiagnostics(filePath, {
                errors: result.diagnostics.filter((d) => severityOf(d.severity) === "error").length,
                warnings: result.diagnostics.filter((d) => severityOf(d.severity) === "warning").length,
                toolError: null,
            });

            return toEditorDiagnostics(view.state.doc, result.diagnostics);
        },
        { delay: checkDelayMs },
    ),
    lintGutter(),
    errorLens(),
];

export const forgetDiagnostics = clearFileDiagnostics;
