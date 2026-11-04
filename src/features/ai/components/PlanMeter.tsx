import type { AiAccount, AiQuota } from "../types";
import { Meter, MeterBar } from "./MeterBar";

const minute = 60_000;
const hour = 60 * minute;
const day = 24 * hour;

const periodText = (period?: string) => {
    if (/day|dia|diari/i.test(period ?? "")) return "al día";
    if (/week|seman/i.test(period ?? "")) return "a la semana";
    if (/month|mes/i.test(period ?? "")) return "al mes";
    return "";
};

const percentOf = (quota?: AiQuota) => (quota?.limit && quota.limit > 0 ? Math.min(100, Math.floor(((quota.used ?? 0) / quota.limit) * 100)) : 0);

const clock = (date: Date) => date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", hour12: false });

const absolute = (date: Date) =>
    date.toDateString() === new Date().toDateString()
        ? `hoy a las ${clock(date)}`
        : `el ${date.toLocaleDateString("es-ES", { weekday: "long", day: "numeric" })} a las ${clock(date)}`;

const relative = (date: Date) => {
    const left = date.getTime() - Date.now();
    if (left < minute) return "en menos de un minuto";
    if (left < hour) return `en ${Math.round(left / minute)} min`;
    if (left < day) return `en ${Math.round(left / hour)} h`;
    const days = Math.round(left / day);
    return `en ${days} ${days === 1 ? "día" : "días"}`;
};

const QuotaRow = ({ title, quota }: { title: string; quota?: AiQuota }) => {
    if (!quota?.limit || quota.limit <= 0) return null;
    const value = percentOf(quota);
    const reset = quota.resetsAt ? new Date(quota.resetsAt) : null;
    const known = reset && !Number.isNaN(reset.getTime());

    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex justify-between">
                <span>{title}</span>
                <span>{(quota.used ?? 0).toLocaleString("es-ES")} / {quota.limit.toLocaleString("es-ES")} {periodText(quota.period)}</span>
            </div>
            <MeterBar value={value} kind="quota" />
            {known && <span className="text-gray-500">Se reinicia {absolute(reset)} ({relative(reset)}).</span>}
        </div>
    );
};

const planValue = (account: AiAccount | null) => {
    const { chat, bridge } = account?.usage ?? {};
    return chat?.limit && chat.limit > 0 ? Math.max(percentOf(chat), percentOf(bridge)) : null;
};

export const PlanDetails = ({ account }: { account: AiAccount | null }) => {
    if (planValue(account) === null) return <p className="text-gray-500">Aún no hay datos del plan.</p>;

    return (
        <>
            <QuotaRow title="En la app" quota={account?.usage?.chat} />
            <QuotaRow title="En Discord" quota={account?.usage?.bridge} />
        </>
    );
};

export const PlanMeter = ({ account }: { account: AiAccount | null }) => {
    const value = planValue(account);
    if (value === null) return null;

    return (
        <Meter label="Plan" value={value} kind="quota" align="right">
            <PlanDetails account={account} />
        </Meter>
    );
};
