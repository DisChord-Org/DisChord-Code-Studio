export const noisePatterns: RegExp[] = [
    /^\s*\d+ \| /,
    /^\s*\^+\s*$/,
    /^\s*at .*(\$bunfs|node:|node_modules)/,
    /^error: Command failed/,
    /^\s*(pid|status|signal|output|stdout|stderr):/,
];

export const blockStart = /^error: Command failed/;
export const blockEnd = /^Bun v\d/;

// Fewer noisy lines than this are not worth hiding behind a toggle.
export const minNoisyLines = 3;
