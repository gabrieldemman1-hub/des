/** Links inside the site, under its base path (/des/ on GitHub Pages). */
const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');

export const home = () => base;
export const settingPath = (id: string) => `${base}settings/${id}/`;
export const aimStylePath = (id: string) => `${base}aim-styles/${id}/`;
export const sourcesPath = () => `${base}sources/`;
export const asset = (file: string) => `${base}${file.replace(/^\//, '')}`;
