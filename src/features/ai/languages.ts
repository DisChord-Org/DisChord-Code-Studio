interface LanguageInfo {
    label: string;
    extension: string;
}

const info = (label: string, extension: string): LanguageInfo => ({ label, extension });

const languages: Record<string, LanguageInfo> = {
    chord: info("Chord", "chord"),
    dischord: info("Chord", "chord"),
    js: info("JavaScript", "js"),
    javascript: info("JavaScript", "js"),
    mjs: info("JavaScript", "mjs"),
    jsx: info("JSX", "jsx"),
    ts: info("TypeScript", "ts"),
    typescript: info("TypeScript", "ts"),
    tsx: info("TSX", "tsx"),
    json: info("JSON", "json"),
    jsonc: info("JSON", "json"),
    html: info("HTML", "html"),
    xml: info("XML", "xml"),
    css: info("CSS", "css"),
    scss: info("SCSS", "scss"),
    md: info("Markdown", "md"),
    markdown: info("Markdown", "md"),
    py: info("Python", "py"),
    python: info("Python", "py"),
    rs: info("Rust", "rs"),
    rust: info("Rust", "rs"),
    go: info("Go", "go"),
    java: info("Java", "java"),
    kt: info("Kotlin", "kt"),
    kotlin: info("Kotlin", "kt"),
    c: info("C", "c"),
    cpp: info("C++", "cpp"),
    "c++": info("C++", "cpp"),
    cs: info("C#", "cs"),
    csharp: info("C#", "cs"),
    php: info("PHP", "php"),
    rb: info("Ruby", "rb"),
    ruby: info("Ruby", "rb"),
    sh: info("Shell", "sh"),
    bash: info("Bash", "sh"),
    shell: info("Shell", "sh"),
    zsh: info("Zsh", "sh"),
    powershell: info("PowerShell", "ps1"),
    ps1: info("PowerShell", "ps1"),
    yaml: info("YAML", "yml"),
    yml: info("YAML", "yml"),
    toml: info("TOML", "toml"),
    ini: info("INI", "ini"),
    sql: info("SQL", "sql"),
    diff: info("Diff", "diff"),
    dockerfile: info("Dockerfile", "dockerfile"),
    text: info("Texto", "txt"),
    txt: info("Texto", "txt"),
};

export const describeLanguage = (language: string): { label: string; fileName: string } => {
    const known = languages[language.toLowerCase()];
    if (known) return { label: known.label, fileName: `file.${known.extension}` };
    return { label: language || "Texto", fileName: language ? `file.${language.toLowerCase()}` : "file.txt" };
};
