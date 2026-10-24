// OpenStreetMap's standard tile server. Fine for a low-traffic demo under their
// tile usage policy; override with VITE_TILE_URL to switch providers.
export const TILE_URL: string =
  import.meta.env.VITE_TILE_URL ?? "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

export const TILE_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';