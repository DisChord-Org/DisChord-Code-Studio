import type { AiAccount, AiContextUsage, AiSessionUsage } from "../types";
import { Meter, MeterBar } from "./MeterBar";

const cacheLowPercent = 70;
const cacheLowInputTokens = 10_000;

const formatTokens = (value: number) => (value >= 1000 ? `${(value / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(Math.round(value)));

const cacheOf = (usage: AiSessionUsage) => {
    const input = usage.cacheHitTokens + usage.cacheMissTokens || usage.promptTokens;
    return { input, percent: input > 0 ? Math.round((usage.cacheHitTokens / input) * 100) : 0 };
};

export interface ContextMeterProps {
    context: AiContextUsage | null;
    usage: AiSessionUsage | null;
    account: AiAccount | null;
}

const figuresOf = (context: AiContextUsage | null, account: AiAccount | null) => {
    const planLimit = context?.limit ?? account?.contextLimit ?? 0;
    const compactAt = context?.compactAt ?? 0;
    const limit = compactAt > 0 ? Math.min(compactAt, planLimit) : planLimit;

    if (limit <= 0) return null;

    const tokens = context?.tokens ?? 0;
    return { tokens, limit, value: Math.min(100, (tokens / limit) * 100) };
};

export const ContextDetails = ({ context, usage, account }: ContextMeterProps) => {
    const figures = figuresOf(context, account);
    if (!figures) return <p className="text-gray-500">Aún no hay datos del contexto.</p>;

    const cache = usage ? cacheOf(usage) : null;
    const cacheLow = !!cache && cache.input >= cacheLowInputTokens && cache.percent < cacheLowPercent;

    return (
        <>
            <div className="flex justify-between">
                <span>Contexto</span>
                <span>{formatTokens(figures.tokens)} / {formatTokens(figures.limit)} tokens</span>
            </div>
            <MeterBar value={figures.value} />
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
        </>
    );
};

export const ContextMeter = (props: ContextMeterProps) => {
    const figures = figuresOf(props.context, props.account);
    if (!figures) return null;

    return (
        <Meter label="Contexto" value={figures.value} align="left">
            <ContextDetails {...props} />
        </Meter>
    );
};
