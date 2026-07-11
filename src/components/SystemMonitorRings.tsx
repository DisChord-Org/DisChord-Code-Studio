import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface SystemStats {
    cpu_percent: number;
    ram_used_mb: number;
    ram_total_mb: number;
    ram_percent: number;
}

const POLL_INTERVAL = 1500;

const useSystemStats = () => {
    const [stats, setStats] = useState<SystemStats | null>(null);

    useEffect(() => {
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout>;

        const poll = async () => {
            try {
                const result = await invoke<SystemStats>("get_system_stats");
                if (!cancelled) setStats(result);
            } catch (error) {
                console.error("No se pudieron leer las métricas del sistema:", error);
            } finally {
                if (!cancelled) timer = setTimeout(poll, POLL_INTERVAL);
            }
        };

        poll();
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, []);

    return stats;
};

const ringColor = (percent: number): string => {
    if (percent >= 85) return "#f14c4c";
    if (percent >= 60) return "#e5c07b";
    return "#5865F2";
};

const RingGauge = ({
    label,
    percent,
    tooltip,
    size = 44,
}: {
    label: string;
    percent: number;
    tooltip: string;
    size?: number;
}) => {
    const [hovered, setHovered] = useState(false);
    const stroke = Math.max(size * 0.08, 2);
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const clamped = Math.min(Math.max(percent, 0), 100);
    const offset = circumference - (clamped / 100) * circumference;
    const color = ringColor(clamped);
    const fontSize = Math.max(size * 0.24, 6);

    return (
        <div
            className="relative flex flex-col items-center"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <div className="relative" style={{ width: size, height: size }}>
                <svg width={size} height={size} className="-rotate-90">
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke="#1e1f22"
                        strokeWidth={stroke}
                    />
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke={color}
                        strokeWidth={stroke}
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.6s ease" }}
                    />
                </svg>
                <span
                    className="absolute inset-0 flex items-center justify-center font-mono font-medium"
                    style={{ color, fontSize }}
                >
                    {Math.round(clamped)}
                </span>
            </div>
            {size >= 30 && (
                <span className="text-[9px] text-gray-600 font-mono uppercase tracking-wide mt-0.5">
                    {label}
                </span>
            )}

            {hovered && (
                <div className="absolute bottom-full mb-2 right-0 bg-[#1e1f22] text-white text-[10px] px-2.5 py-1.5 rounded whitespace-nowrap border border-white/5 shadow-xl z-50 pointer-events-none">
                    {tooltip}
                </div>
            )}
        </div>
    );
};

export const SystemMonitorRings = ({ size = 44 }: { size?: number }) => {
    const stats = useSystemStats();

    if (!stats) return null;

    const ramGb = (mb: number) => (mb / 1024).toFixed(1);

    return (
        <div className="flex items-end gap-3 select-none">
            <RingGauge
                label="CPU"
                percent={stats.cpu_percent}
                tooltip={`Consumo de CPU: ${stats.cpu_percent.toFixed(1)}%`}
                size={size}
            />
            <RingGauge
                label="RAM"
                percent={stats.ram_percent}
                tooltip={`Consumo de RAM: ${ramGb(stats.ram_used_mb)} GB / ${ramGb(stats.ram_total_mb)} GB (${stats.ram_percent.toFixed(1)}%)`}
                size={size}
            />
        </div>
    );
};