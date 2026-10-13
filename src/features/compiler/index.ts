export { checkSource, loadCorelib } from "./api";
export { liveDiagnostics, forgetDiagnostics, toEditorDiagnostics, rangeOf } from "./liveDiagnostics";
export { useFileDiagnostics } from "./diagnosticsStore";
export { languageIntelligence, goToDefinition } from "./languageIntelligence";
export { useFileDeclarations, type Declaration } from "./declarations";
export type { CheckResult, CompilerDiagnostic, Corelib } from "./types";
