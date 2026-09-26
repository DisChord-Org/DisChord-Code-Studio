interface EmptyStateProps {
    /** Bootstrap icon class, e.g. "bi-box2". */
    icon: string;
    children: React.ReactNode;
    tone?: "muted" | "danger";
    size?: "sm" | "md";
}

/** The centered "nothing here" (or "something went wrong") block of a list. */
export const EmptyState = ({ icon, children, tone = "muted", size = "sm" }: EmptyStateProps) => (
    <div className={`flex flex-col items-center gap-2 text-center ${size === "sm" ? "py-8" : "py-10"}`}>
        <i className={`bi ${icon} text-xl ${tone === "danger" ? "text-red-400/60" : "text-gray-700"}`}></i>
        <p className={`text-xs ${tone === "danger" ? "text-red-400" : "text-gray-500"}`}>{children}</p>
    </div>
);
