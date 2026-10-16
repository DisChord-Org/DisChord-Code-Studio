interface HighlightedTextProps {
    text: string;
    query: string;
}

/** Wraps every case-insensitive occurrence of `query` in a highlight. */
export const HighlightedText = ({ text, query }: HighlightedTextProps) => {
    if (!query) return <>{text}</>;

    const lower = text.toLowerCase();
    const needle = query.toLowerCase();
    const parts: React.ReactNode[] = [];
    let from = 0;
    for (let at = lower.indexOf(needle); at !== -1; at = lower.indexOf(needle, from)) {
        if (at > from) parts.push(text.slice(from, at));
        parts.push(<mark key={at} className="bg-accent/40 text-white rounded-sm">{text.slice(at, at + needle.length)}</mark>);
        from = at + needle.length;
    }
    parts.push(text.slice(from));
    return <>{parts}</>;
};
