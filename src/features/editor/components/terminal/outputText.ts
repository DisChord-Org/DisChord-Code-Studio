import { notify } from "../../../../utils/Toasts";

const pad = (n: number) => String(n).padStart(2, "0");

const msPerSecond = 1000;
const secondsPerMinute = 60;
const minutesPerHour = 60;

export const formatClock = (ts: number) => {
    const d = new Date(ts);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

export const formatDuration = (ms: number) => {
    const total = Math.max(0, Math.floor(ms / msPerSecond));
    if (total < secondsPerMinute) return `${total}s`;
    const minutes = Math.floor(total / secondsPerMinute);
    if (minutes < minutesPerHour) return `${minutes}m ${pad(total % secondsPerMinute)}s`;
    return `${Math.floor(minutes / minutesPerHour)}h ${pad(minutes % minutesPerHour)}m`;
};

// eslint-disable-next-line no-control-regex
export const stripAnsi = (text: string) => text.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "");

export const copyText = (text: string) =>
    navigator.clipboard.writeText(text).catch((error) => notify("error", "No se pudo copiar al portapapeles.", [String(error)]));
