import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Tooltip } from "../../components/ui/Tooltip";
import type { SystemStats } from "./types";

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
    showNumber = true,
    tooltipAlign = "center",
}: {
    label: string;
    percent: number;
    tooltip: string;
    size?: number;
    showNumber?: boolean;
    tooltipAlign?: "center" | "start" | "end";
}) => {
    const stroke = Math.max(size * 0.08, 2);
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const clamped = Math.min(Math.max(percent, 0), 100);
    const offset = circumference - (clamped / 100) * circumference;
    const color = ringColor(clamped);
    const fontSize = Math.max(size * 0.24, 6);

    return (
        <Tooltip label={tooltip} placement="top" align={tooltipAlign} className="flex-col items-center">
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
                {showNumber && (
                    <span
                        className="absolute inset-0 flex items-center justify-center font-mono font-medium"
                        style={{ color, fontSize }}
                    >
                        {Math.round(clamped)}
                    </span>
                )}
            </div>
            {size >= 30 && (
                <span className="text-[9px] text-gray-600 font-mono uppercase tracking-wide mt-0.5">
                    {label}
                </span>
            )}
        </Tooltip>
    );
};

export const SystemMonitorRings = ({ size = 44, showNumbers = true }: { size?: number; showNumbers?: boolean }) => {
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
                showNumber={showNumbers}
            />
            <RingGauge
                label="RAM"
                percent={stats.ram_percent}
                tooltip={`Consumo de RAM: ${ramGb(stats.ram_used_mb)} GB / ${ramGb(stats.ram_total_mb)} GB (${stats.ram_percent.toFixed(1)}%)`}
                size={size}
                showNumber={showNumbers}
                tooltipAlign="end"
            />
        </div>
    );
};