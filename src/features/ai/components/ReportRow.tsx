import { memo } from "react";
import type { AiItem } from "../types";
import { ContextDetails } from "./ContextMeter";
import { PlanDetails } from "./PlanMeter";

export const ReportRow = memo(({ item }: { item: Extract<AiItem, { kind: "report" }> }) => (
    <section className="ai-enter flex flex-col gap-2 rounded-md border border-border bg-app-bg px-3 py-2.5 text-[11px] text-gray-400" aria-label={item.report === "context" ? "Contexto" : "Uso del plan"}>
        {item.report === "context" ? (
            <ContextDetails context={item.context} usage={item.usage} account={item.account} />
        ) : (
            <>
                <p className="text-xs font-medium text-gray-200">Uso del plan{item.account?.plan ? ` ${item.account.plan}` : ""}</p>
                <PlanDetails account={item.account} />
            </>
        )}
    </section>
));
