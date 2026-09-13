import { phaseLabels } from "./PackageManager.constants";

export const opKey = (action: string, name: string, version?: string) =>
    version ? `${action}:${name}:${version}` : `${action}:${name}`;

export const phaseLabel = (phase: string) => phaseLabels[phase] ?? phase;
