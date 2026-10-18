import { LanguageDescription, type LanguageSupport } from "@codemirror/language";
import { languages } from "@codemirror/language-data";

/** Languages already loaded, by description, so the next file of the same kind can be coloured at once. */
const loaded = new Map<LanguageDescription, LanguageSupport>();

const describe = (fileName: string) => LanguageDescription.matchFilename(languages, fileName);

/** The syntax of a file from CodeMirror's catalogue, if it has been loaded before. */
export const loadedLanguageFor = (fileName: string): LanguageSupport | null => {
    const description = describe(fileName);
    return (description && loaded.get(description)) ?? null;
};

/** The syntax of a file from CodeMirror's catalogue, loading it the first time. Null when there is none. */
export const languageFor = async (fileName: string): Promise<LanguageSupport | null> => {
    const description = describe(fileName);
    if (!description) return null;

    const known = loaded.get(description);
    if (known) return known;

    const support = await description.load();
    loaded.set(description, support);
    return support;
};

/** Loads the syntaxes of the most common file kinds ahead of time, so opening one never shows plain text first. */
export const preloadCommonLanguages = () => {
    for (const sample of ["a.js", "a.ts", "a.tsx", "a.json", "a.html", "a.css", "a.md"]) {
        languageFor(sample).catch(() => {}); // Warm-up only: a real failure surfaces when that language is actually needed.
    }
};
