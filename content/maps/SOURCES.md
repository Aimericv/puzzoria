# Europe interactive map — frozen v1

Verified 3 November 2026. Runtime serves committed assets; there is no map provider,
tile request, API key, third-party script or new dependency.

## Sources and licence

- Boundaries: [Natural Earth 1:50m Admin 0 Countries](https://www.naturalearthdata.com/downloads/50m-cultural-vectors/50m-admin-0-countries-2/),
  version 5.1.2, [source revision f1890d9](https://github.com/nvkelso/natural-earth-vector/tree/f1890d9f152c896d250a77557a5751a93d494776).
- [Natural Earth terms](https://www.naturalearthdata.com/about/terms-of-use/): public domain;
  retain this provenance even though attribution is not required.
- [Disputed boundaries policy](https://www.naturalearthdata.com/about/disputed-boundaries-policy/):
  the source uses de facto boundaries and provides auxiliary disputed areas. It is a
  simplified educational map, not current political-control information.
- Scope: [UN Statistics Division M49](https://unstats.un.org/unsd/methodology/m49/),
  the same 44 European countries as the existing `countries-europe` quiz. Russia and
  Vatican City are included. Türkiye, Cyprus, the Caucasus and Kosovo are outside
  this exercise. This convention is stated on all four public pages.
- Country names in EN/FR/ES/DE reuse the verified, frozen
  `src/lib/server/data/quiz-expansion.v1.json` selection. Existing text answers are
  not changed by this map format.

## Geographic treatment

The importer clips to longitude −26…62°, latitude 33…72.5° and projects to a
Lambert azimuthal equal-area map centred at 15°E, 54°N, fitted to 1000×760.
Russia is intentionally cropped; overseas possessions outside this extent are not
separate targets. Other source countries remain grey context. The auxiliary Crimea
polygon is grey and not a selectable target, avoiding a scored choice on this
disputed territory. Grey context does not spend an attempt.

Andorra, Liechtenstein, Luxembourg, Monaco, Malta, San Marino and Vatican City have
enlarged selectable markers. Zoom and native scrolling/panning allow precise
selection. Every marker anchor is checked inside its country's geometry. Natural
Earth's Vatican label coordinate was outside its tiny boundary; the importer finds
an interior point instead. Holes use SVG even-odd filling.

## Reproducibility and compatibility

Run from the repository root with Node 24.15+:

```sh
node scripts/import-europe-map.mjs
```

The development-only importer downloads these two files from the pinned revision
and refuses an unexpected SHA-256:

| Source file | SHA-256 |
| --- | --- |
| `ne_50m_admin_0_countries.geojson` | `3e458fc036ad0a66411f2c1e6cac49c5d7bfb81cb1123bc513b22511a2b7fdeb` |
| `ne_50m_admin_0_breakaway_disputed_areas.geojson` | `e91f0f9518b24355ceec6668f4df874d6f39db7d0bc9ec22d9b14429bfb6be01` |

Outputs:

- `public/maps/europe-v1.json`: paths, opaque region IDs, interior points and
  small-state markers; no country names or ISO-to-region mapping. About 258 kB
  before HTTP compression. The blank preview uses the same paths in
  `public/maps/europe-outline-v1.svg`.
- `src/lib/server/data/europe-map.v1.json`: private ISO/name/region mapping.
  It is never imported by client code or sent with a new challenge.
- Canonical JSON hashes, also locked by tests: geometry
  `9b49e5619ef92651e955a180163d6051861901ea2e44a4341a3eb5d34643ba68`;
  private mapping
  `b1a8861f01b9634bdd43f504e0b606d7f19cb6bb549a5537aaf0d74c1ff9e040`.

Keep the v1 assets, mapping and rules frozen once published. Any future change to
scope, accepted locations or scoring must introduce a new map/content version and
cohort while retaining old run replay. Do not regenerate v1 from a moving branch.
Opaque geometry is a delivery boundary, not a claim that a public geography puzzle
cannot be reverse engineered.
