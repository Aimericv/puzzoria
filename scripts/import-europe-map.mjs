// Development-only importer. Runtime uses the committed, versioned assets.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
const revision = "f1890d9f152c896d250a77557a5751a93d494776";
const root = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${revision}/geojson/`;
const codes = "AD AL AT BA BE BG BY CH CZ DE DK EE ES FI FR GB GR HR HU IE IS IT LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SK SM UA VA".split(" ");
const digest = text => createHash("sha256").update(text).digest("hex");
const source = await fetch(root + "ne_50m_admin_0_countries.geojson").then(r => { if (!r.ok) throw Error(r.status); return r.text(); });
if (digest(source) !== "3e458fc036ad0a66411f2c1e6cac49c5d7bfb81cb1123bc513b22511a2b7fdeb") throw Error("Source changed: publish a new map version instead");
const disputedText = await fetch(root + "ne_50m_admin_0_breakaway_disputed_areas.geojson").then(r => { if (!r.ok) throw Error(r.status); return r.text(); });
if (digest(disputedText) !== "e91f0f9518b24355ceec6668f4df874d6f39db7d0bc9ec22d9b14429bfb6be01") throw Error("Disputed-area source changed");
const features = JSON.parse(source).features, disputed = JSON.parse(disputedText).features;
const original = JSON.parse(await readFile("src/lib/server/data/quiz-expansion.v1.json", "utf8"))["countries-europe"];
const box = [-26, 33, 62, 72.5], rad = Math.PI / 180, phi = 54 * rad, lambda = 15 * rad;
function project([lon, lat]) {
  const p = lat * rad, d = lon * rad - lambda;
  const k = Math.sqrt(2 / (1 + Math.sin(phi) * Math.sin(p) + Math.cos(phi) * Math.cos(p) * Math.cos(d)));
  return [k * Math.cos(p) * Math.sin(d), -k * (Math.cos(phi) * Math.sin(p) - Math.sin(phi) * Math.cos(p) * Math.cos(d))];
}
const corners = [];
for (let x = box[0]; x <= box[2]; x++) for (let y = box[1]; y <= box[3]; y += .5) corners.push(project([x, y]));
const minX = Math.min(...corners.map(p => p[0])), maxX = Math.max(...corners.map(p => p[0])), minY = Math.min(...corners.map(p => p[1])), maxY = Math.max(...corners.map(p => p[1]));
const scale = Math.min(940 / (maxX - minX), 700 / (maxY - minY));
const screen = point => { const [x, y] = project(point); return [+(500 + (x - (minX + maxX) / 2) * scale).toFixed(2), +(380 + (y - (minY + maxY) / 2) * scale).toFixed(2)]; };
function clip(ring) {
  let points = ring.slice(0, -1);
  for (const [axis, bound, sign] of [[0, box[0], 1], [0, box[2], -1], [1, box[1], 1], [1, box[3], -1]]) {
    const result = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length], ai = (a[axis] - bound) * sign >= 0, bi = (b[axis] - bound) * sign >= 0;
      if (ai) result.push(a);
      if (ai !== bi) { const t = (bound - a[axis]) / (b[axis] - a[axis]); result.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]); }
    }
    points = result;
  }
  return points.length >= 3 ? points.map(screen) : [];
}
const area = points => Math.abs(points.reduce((sum, a, i) => { const b = points[(i + 1) % points.length]; return sum + a[0] * b[1] - b[0] * a[1]; }, 0)) / 2;
function inside(point, ring) {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit;
  }
  return hit;
}
function geometry(feature) {
  const polygons = (feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates).map(p => p.map(clip).filter(r => r.length >= 3 && area(r) > .0001)).filter(p => p.length);
  const path = polygons.flat().map(r => `M${r.map(p => p.join(",")).join("L")}Z`).join("");
  return { polygons, path };
}
function anchor(feature, polygons) {
  const valid = p => polygons.some(poly => inside(p, poly[0]) && !poly.slice(1).some(h => inside(p, h)));
  const label = screen([feature.properties.LABEL_X, feature.properties.LABEL_Y]);
  if (valid(label)) return label;
  // Natural Earth's Vatican label point is outside its tiny boundary. Find an interior point.
  const ring = [...polygons].sort((a, b) => area(b[0]) - area(a[0]))[0][0];
  const lo = [Math.min(...ring.map(p => p[0])), Math.min(...ring.map(p => p[1]))], hi = [Math.max(...ring.map(p => p[0])), Math.max(...ring.map(p => p[1]))];
  for (let y = 1; y < 20; y++) for (let x = 1; x < 20; x++) { const p = lo.map((n, i) => +(n + (hi[i] - n) * [x, y][i] / 20).toFixed(2)); if (valid(p)) return p; }
  throw Error(`Missing interior anchor: ${feature.properties.ADMIN}`);
}
const names = new Intl.DisplayNames(["en"], { type: "region" });
const regions = [], countries = [];
for (const iso of codes) {
  const f = features.find(f => f.properties.ISO_A2_EH === iso);
  const rows = original.filter(r => r.answer.en === (iso === "VA" ? "Vatican City" : names.of(iso)));
  if (!f || rows.length !== 1) throw Error(`Unmatched country: ${iso}`);
  const g = geometry(f), point = anchor(f, g.polygons), id = "z" + digest(`puzzoria:europe-v1:${iso}`).slice(0, 8);
  if (!g.path) throw Error(`Empty country: ${iso}`);
  regions.push({ id, path: g.path, point, small: ["AD", "LI", "LU", "MC", "MT", "SM", "VA"].includes(iso) });
  countries.push({ iso, region: id, name: rows[0].answer });
}
const context = features.filter(f => !codes.includes(f.properties.ISO_A2_EH)).map(geometry).map(g => g.path).filter(Boolean).join("");
const neutral = disputed.filter(f => f.properties.NAME === "Crimea").map(geometry).map(g => g.path).join("");
if (!neutral || countries.length !== 44) throw Error("Incomplete scope");
const asset = { version: "europe-v1", width: 1000, height: 760, regions, context, neutral };
await mkdir("public/maps", { recursive: true });
await writeFile("public/maps/europe-v1.json", JSON.stringify(asset) + "\n");
await writeFile("src/lib/server/data/europe-map.v1.json", JSON.stringify(countries, null, 2) + "\n");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 760"><rect width="1000" height="760" fill="#eaf3fa"/><g stroke="#ffffff" stroke-width="1.1" fill-rule="evenodd"><path d="${context}" fill="#d9e0e9"/>${regions.map(r => `<path d="${r.path}" fill="#d2e2cf"/>`).join("")}<path d="${neutral}" fill="#c5cfdd"/></g></svg>\n`;
await writeFile("public/maps/europe-outline-v1.svg", svg);
console.log(JSON.stringify({ countries: countries.length, geometryBytes: Buffer.byteLength(JSON.stringify(asset)), publicHash: digest(JSON.stringify(asset)), privateHash: digest(JSON.stringify(countries)), disputedHash: digest(disputedText) }));
