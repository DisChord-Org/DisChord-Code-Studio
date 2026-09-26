/** Separator the backend uses for the relative paths it hands out. */
export const pathSeparator = navigator.userAgent.includes("Windows") ? "\\" : "/";

export const joinPath = (dir: string, name: string) => (dir ? `${dir}${pathSeparator}${name}` : name);

export const parentPath = (path: string) => {
    const cut = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
    return cut === -1 ? "" : path.slice(0, cut);
};

export const baseName = (path: string) => path.slice(Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1);

const isInside = (path: string, dir: string) => path.startsWith(`${dir}/`) || path.startsWith(`${dir}\\`);

/** Whether `path` is `dir` itself or lives somewhere under it. */
export const isSameOrInside = (path: string, dir: string) => path === dir || isInside(path, dir);

/** Where `path` ends up after `from` (a file or a folder) has been moved to `to`. */
export const remapPath = (path: string, from: string, to: string) => {
    if (path === from) return to;
    return isInside(path, from) ? to + path.slice(from.length) : path;
};

/** Whether `source` can be dropped into the folder `targetDir` ("" is the project root). */
export const canMoveInto = (source: string, targetDir: string) =>
    source !== targetDir && parentPath(source) !== targetDir && !isSameOrInside(targetDir, source);
