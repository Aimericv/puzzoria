export type MapRegion = { id: string; path: string; point: [number, number]; small: boolean };
export type MapGeometry = { version: "europe-v1"; width: number; height: number; regions: MapRegion[]; context: string; neutral: string };
export function validMapGeometry(value: unknown): value is MapGeometry {
  if (!value || typeof value !== "object") return false;
  const m = value as MapGeometry, path = (d: unknown) => typeof d === "string" && /^[MLZ0-9.,-]+$/.test(d);
  return m.version === "europe-v1" && m.width === 1000 && m.height === 760 && Array.isArray(m.regions) && m.regions.length === 44 && path(m.context) && path(m.neutral) && m.regions.every(r=>!!r && typeof r === "object" && /^z[a-f0-9]{8}$/.test(r.id) && path(r.path) && Array.isArray(r.point) && r.point.length === 2 && r.point.every((v,i)=>Number.isFinite(v)&&v>=0&&v<=[m.width,m.height][i]) && typeof r.small === "boolean") && new Set(m.regions.map(r=>r.id)).size === 44;
}
