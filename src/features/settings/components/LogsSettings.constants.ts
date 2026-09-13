import type { LogRotation } from "../types";

export const rotationOptions: { value: LogRotation; label: string; description: string }[] = [
    { value: "daily", label: "Cada día", description: "Un fichero nuevo cada día (por defecto)." },
    { value: "session", label: "Cada inicio", description: "Un fichero nuevo cada vez que abres el IDE." },
    { value: "hourly", label: "Cada hora", description: "Un fichero nuevo cada hora." },
];
