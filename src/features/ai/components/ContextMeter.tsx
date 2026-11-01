import type { AiAccount, AiContextUsage, AiSessionUsage } from "../types";
import { Meter, MeterBar } from "./MeterBar";

const cacheLowPercent = 70;
const cacheLowInputTokens = 10_000;

const formatTokens = (value: number) => (value >= 1000 ? `${(value / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(Math.round(value)));

const cacheOf = (usage: AiSessionUsage) => {
    const input = usage.cacheHitTokens + usage.cacheMissTokens || usage.promptTokens;
    return { input, percent: input > 0 ? Math.round((usage.cacheHitTokens / input) * 100) : 0 };
};

interface ContextMeterProps {
    context: AiContextUsage | null;
    usage: AiSessionUsage | null;
    account: AiAccount | null;
}

/** How full the conversation is, with the figures on hover. */
export const ContextMeter = ({ context, usage, account }: ContextMeterProps) => {
    const planLimit = context?.limit ?? account?.contextLimit ?? 0;
    const compactAt = context?.compactAt ?? 0;
    // The conversation is compacted before the plan's limit when the server says so, so that is the real ceiling.
    const limit = compactAt > 0 ? Math.min(compactAt, planLimit) : planLimit;
    if (limit <= 0) return null;

    const tokens = context?.tokens ?? 0;
    const value = Math.min(100, (tokens / limit) * 100);
    const cache = usage ? cacheOf(usage) : null;
    const cacheLow = !!cache && cache.input >= cacheLowInputTokens && cache.percent < cacheLowPercent;

    return (
        <Meter label="Contexto" value={value} align="left">
            <div className="flex justify-between">
                <span>Contexto</span>
                <span>{formatTokens(tokens)} / {formatTokens(limit)} tokens</span>
            </div>
            <MeterBar value={value} />
            {usage && cache && (
                <div className="flex justify-between border-t border-border pt-2">
                    <span>Gastado aquí</span>
                    <span>
                        {formatTokens(cache.input + usage.completionTokens)} tokens ·{" "}
                        <span className={cacheLow ? "text-amber-400" : ""} title={cacheLow ? "caché baja" : undefined}>{cache.percent}% caché</span>
                        {usage.costEur != null ? ` · ${usage.costEur.toFixed(4)} €` : ""}
                    </span>
                </div>
            )}
            <p className="leading-relaxed text-gray-500">Al llenarse, la conversación se compacta sola.</p>
        </Meter>
    );
};
