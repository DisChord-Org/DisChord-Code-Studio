type Inset = "sm" | "lg";
type Padding = "sm" | "md" | "lg";

// The row bleeds outside its container by the amount it pads itself, so its hover highlight is wider than the text.
const insets: Record<Inset, string> = { sm: "-mx-2 px-2", lg: "-mx-5 px-5" };
const paddings: Record<Padding, string> = { sm: "py-2", md: "py-2.5", lg: "py-3" };

interface ListRowProps {
    children: React.ReactNode;
    /** How far the highlight sticks out to the sides. */
    inset?: Inset;
    padding?: Padding;
    className?: string;
}

/** One entry of a list: a rounded row that lights up on hover. Put rows inside a `ListGroup`. */
export const ListRow = ({ children, inset = "sm", padding = "md", className = "" }: ListRowProps) => (
    <div className={`group relative ${insets[inset]} ${paddings[padding]} rounded-md hover:bg-white/[0.03] transition-colors ${className}`.trim()}>
        {children}
    </div>
);

/** Container of a list of rows, with a thin divider between them. */
export const ListGroup = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
    <div className={`divide-y divide-white/[0.05] ${className}`.trim()}>{children}</div>
);
