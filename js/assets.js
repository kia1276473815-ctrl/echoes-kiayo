// In the packaged single-file deck every asset lives inside the file and is handed out as a blob: URL.
// When the deck runs from its folder, paths are used as they are.
export const asset = (p) => (globalThis.__ASSETS && globalThis.__ASSETS[p]) || p;
