import type { AiAccount, AiUser } from "../types";

const plans: Record<string, { label: string; className: string }> = {
    free: { label: "Free", className: "text-gray-500" },
    pro: { label: "Pro", className: "plan-pro font-medium" },
    max: { label: "Max", className: "plan-max font-semibold" },
};

/** The plan's name, as plain text: Pro and Max get their own colors. */
export const PlanLabel = ({ plan }: { plan: string }) => {
    const known = plans[plan.toLowerCase()];
    return <span title="Tu plan actual" className={`shrink-0 text-[11px] ${known?.className ?? "text-gray-500"}`}>{known?.label ?? plan}</span>;
};

interface UserBadgeProps {
    user: AiUser | null;
    account: AiAccount | null;
}

/** Who is signed in: avatar, name as Discord writes it, and plan. */
export const UserBadge = ({ user, account }: UserBadgeProps) => {
    const name = account?.discordUsername ?? user?.discordUsername ?? "";
    const plan = account?.plan ?? user?.plan;

    return (
        <div className="flex min-w-0 items-center gap-2">
            {account?.avatarDataUrl ? (
                <img src={account.avatarDataUrl} alt="" aria-hidden="true" draggable={false} width={18} height={18} className="h-[18px] w-[18px] shrink-0 select-none rounded-md object-cover" />
            ) : (
                <span aria-hidden="true" className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md bg-white/10 text-[10px] font-semibold uppercase text-gray-300">
                    {name.charAt(0)}
                </span>
            )}
            <span className="truncate text-xs font-semibold text-gray-200">{name}</span>
            {plan && <PlanLabel plan={plan} />}
        </div>
    );
};
