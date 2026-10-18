/** Subsequence match score of `query` against a path; null when it does not match. Higher is better. */
export const fuzzyScore = (query: string, path: string): number | null => {
    const q = query.toLowerCase();
    if (!q) return 0;

    const target = path.toLowerCase();
    const nameStart = target.lastIndexOf("/") + 1;
    let score = 0;
    let from = 0;
    let previous = -2;

    for (const ch of q) {
        const at = target.indexOf(ch, from);
        if (at === -1) return null;

        score += 1;
        if (at === previous + 1) score += 3;
        if (at === 0 || "/._-".includes(target[at - 1])) score += 2;
        if (at >= nameStart) score += 2;
        previous = at;
        from = at + 1;
    }

    if (target.slice(nameStart).includes(q)) score += 10;
    return score - target.length * 0.01;
};

export const filterPaths = (paths: string[], query: string, limit = 60): string[] => {
    if (!query.trim()) return paths.slice(0, limit);

    const scored: { path: string; score: number }[] = [];
    for (const path of paths) {
        const score = fuzzyScore(query.trim(), path);
        if (score !== null) scored.push({ path, score });
    }
    return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.path);
};
