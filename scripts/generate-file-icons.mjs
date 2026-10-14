// Builds the data of the explorer's file and folder icons from Material Icon Theme (MIT, by Philipp Kief):
// which icon each file name, extension and folder name gets, and the drawings themselves, trimmed to the ones
// that mapping uses. Run it with `pnpm icons` after updating `material-icon-theme` or the iconify package.

import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { generateManifest } from "material-icon-theme";

const require = createRequire(import.meta.url);
const set = require("@iconify-json/material-icon-theme/icons.json");
const manifest = generateManifest();

const resolve = (name) => set.icons[name]?.body ?? (set.aliases?.[name] ? resolve(set.aliases[name].parent) : undefined);
const available = { has: (name) => resolve(name) !== undefined };

// Material Icon Theme names some icons with underscores (`react_ts`) and the iconify set with hyphens.
const normalize = (name) => (resolve(name) !== undefined ? name : name.replaceAll("_", "-"));
const unmatched = new Set();
const used = new Set();

const pick = (record) => {
    const out = {};
    for (const [key, original] of Object.entries(record ?? {})) {
        const icon = normalize(original);
        if (!available.has(icon)) {
            unmatched.add(original);
            continue;
        }
        out[key.toLowerCase()] = icon;
        used.add(icon);
    }
    return out;
};

const use = (name) => {
    const icon = normalize(name);
    used.add(icon);
    return icon;
};

const mapping = {
    file: use(manifest.file),
    folder: use(manifest.folder),
    folderExpanded: use(manifest.folderExpanded),
    fileNames: pick(manifest.fileNames),
    fileExtensions: pick(manifest.fileExtensions),
    folderNames: pick(manifest.folderNames),
    folderNamesExpanded: pick(manifest.folderNamesExpanded),
};

const icons = {};
for (const name of [...used].sort()) icons[name] = resolve(name);

const out = new URL("../src/features/editor/fileIcons/", import.meta.url);
mkdirSync(out, { recursive: true });
writeFileSync(new URL("mapping.json", out), JSON.stringify(mapping));
writeFileSync(new URL("icons.json", out), JSON.stringify(icons));

const kb = (value) => (JSON.stringify(value).length / 1024).toFixed(0);
if (unmatched.size > 0) console.log(`Sin dibujo: ${[...unmatched].slice(0, 15).join(", ")}${unmatched.size > 15 ? "…" : ""} (${unmatched.size})`);
console.log(`mapping.json ${kb(mapping)} KB, icons.json ${kb(icons)} KB (${used.size} icons)`);
