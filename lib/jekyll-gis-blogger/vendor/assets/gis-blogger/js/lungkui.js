// lungkui.js — map-story library on MapLibre GL JS. BSD-3-Clause, (c) Lerry William Seling.
// Single-file ES module. No build step, no npm dependencies. MapLibre is injected
// (default globalThis.maplibregl). Use it straight from a browser:
//   <script src="maplibre-gl.js"></script>
//   <script type="module">
//     import { Lungkui } from './lungkui.js';
//     new Lungkui('#story', { /* config */ });
//   </script>
// Everything below is also exported individually for unit testing.

/* ─────────────────────────── shared helpers ─────────────────────────── */

// Query-string builder; skips null/undefined so optional params drop out.
function qs(params) {
  return Object.entries(params)
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
}

function escapeHtml(s = '') {
  return String(s)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/* ─────────────────────────────── basemaps ───────────────────────────── */

const OSM_ATTR = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// Named raster basemaps. Each provider has its own usage policy; for heavy
// traffic use your own tiles (or a `style` URL) instead of the public servers.
export const BASEMAPS = {
  osm: { type: 'xyz', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: OSM_ATTR, maxzoom: 19 },
  // OpenFreeMap vector styles: free, no API key, sharp labels; attribution comes with the style.
  positron: { type: "style", url: "https://tiles.openfreemap.org/styles/positron" },
  liberty: { type: "style", url: "https://tiles.openfreemap.org/styles/liberty" },
  bright: { type: "style", url: "https://tiles.openfreemap.org/styles/bright" },
  dark: { type: "style", url: "https://tiles.openfreemap.org/styles/dark" },
  fiord: { type: "style", url: "https://tiles.openfreemap.org/styles/fiord" },
  opentopo: { type: 'xyz', url: 'https://tile.opentopomap.org/{z}/{x}/{y}.png', attribution: `${OSM_ATTR}, SRTM | © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)`, maxzoom: 17 }
};

export const DEFAULT_BASEMAP = BASEMAPS.osm;
export const DEFAULT_BASEMAP_PAIR = { light: "positron", dark: "dark" };

// Resolve a basemap config to a concrete one: a preset name, a { light, dark }
// pair (picked by isDark), or a full object, returned as is.
export function pickBasemap(basemap, isDark = false) {
  if (basemap == null) return DEFAULT_BASEMAP;
  if (typeof basemap === 'string') {
    const preset = BASEMAPS[basemap];
    if (!preset) throw new Error(`lungkui: unknown basemap preset '${basemap}' (expected ${Object.keys(BASEMAPS).join('|')})`);
    return preset;
  }
  if (basemap.light || basemap.dark) return pickBasemap(isDark ? (basemap.dark ?? basemap.light) : (basemap.light ?? basemap.dark), isDark);
  return basemap;
}

/* ─────────────────────────────── config ─────────────────────────────── */

const MODES = ['scroll', 'deck'];

export function normalizeConfig(config = {}) {
  if (!Array.isArray(config.slides) || config.slides.length === 0) {
    throw new Error('lungkui: config.slides must be a non-empty array');
  }
  const mode = config.mode ?? 'scroll';
  if (!MODES.includes(mode)) {
    throw new Error(`lungkui: config.mode must be one of ${MODES.join(', ')}`);
  }
  config.slides.forEach((s, i) => {
    if (!s.camera) throw new Error(`lungkui: slide[${i}] (${s.id ?? '?'}) is missing camera`);
  });

  const map = config.map ?? {};
  return {
    mode,
    map: {
      // Quiet vector basemap that follows the page: positron when light, dark when dark.
      basemap: map.basemap ?? DEFAULT_BASEMAP_PAIR,
      center: map.center ?? [0, 0],
      zoom: map.zoom ?? 2,
      pitch: map.pitch ?? 0,
      bearing: map.bearing ?? 0,
      overviewZoom: map.overviewZoom ?? 5,
      // Story drives the camera; the map is display-only by default so wheel/drag
      // can't zoom it past the data extent. Set true to allow free interaction.
      interactive: map.interactive ?? false,
      scale: map.scale ?? true,
      credit: map.credit ?? true
    },
    theme: config.theme ?? {},
    layers: config.layers ?? [],
    controls: config.controls ?? true,
    // Stop markers for slides with a point camera: 'numbered' | 'dot' | 'photo' (thumbnail of slide.media) | 'none'.
    markers: config.markers ?? 'numbered',
    // Route line joining the stops in slide order (false | true | { color, width, dash }).
    route: config.route ?? false,
    // Deck mode only: mouse wheel turns slides. Off by default so embedded
    // stories never trap page scrolling.
    wheel: config.wheel ?? false,
    // Where the panel docks on wide layouts unless a slide says otherwise.
    panelSide: config.panelSide ?? 'left',
    // Below this container width the panel becomes a bottom sheet.
    breakpoint: config.breakpoint ?? 720,
    labels: { previous: 'Previous', next: 'Next', overview: 'Overview map', restart: 'Back to start', ...(config.labels ?? {}) },
    slides: config.slides
  };
}

/* ──────────────────────────────── theme ─────────────────────────────── */

export const DEFAULT_THEME = {
  accent: '#c8462a',
  panelBg: '#ffffff',
  text: '#1d1d1b',
  muted: '#6b6860',
  border: 'rgba(0, 0, 0, 0.12)',
  font: 'Georgia, "Times New Roman", serif',
  headingFont: 'inherit',
  uiFont: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  radius: '6px',
  panelWidth: '380px'
};

export const THEME_PRESETS = {
  light: {},
  dark: { panelBg: '#1d1c19', text: '#ece7da', muted: '#a59f91', border: 'rgba(255, 255, 255, 0.14)', accent: '#e98a63' },
  paper: { panelBg: '#f4f0e6', text: '#1b1b1b', muted: '#5b5850', border: '#c9c2b2', accent: '#9b2c1d', radius: '0' }
};

// Theme = preset (by name, or theme.preset) with the given keys on top.
export function resolveTheme(theme = {}) {
  if (typeof theme === 'string') theme = { preset: theme };
  const { preset, ...own } = theme;
  if (preset && !THEME_PRESETS[preset]) throw new Error(`lungkui: unknown theme preset '${preset}' (expected ${Object.keys(THEME_PRESETS).join('|')})`);
  return { ...DEFAULT_THEME, ...(THEME_PRESETS[preset] ?? {}), ...own };
}

export function resolveTokens(paint = {}, theme = {}) {
  const merged = resolveTheme(theme);
  const out = {};
  for (const [key, value] of Object.entries(paint)) {
    if (typeof value === 'string' && value.startsWith('@')) {
      const token = value.slice(1);
      if (!(token in merged)) throw new Error(`lungkui: unknown theme token '${value}'`);
      out[key] = merged[token];
    } else {
      out[key] = value;
    }
  }
  return out;
}

const VAR_NAMES = {
  accent: '--lk-accent', panelBg: '--lk-panel-bg', text: '--lk-text', muted: '--lk-muted',
  border: '--lk-border', font: '--lk-font', headingFont: '--lk-heading-font', uiFont: '--lk-ui-font',
  radius: '--lk-radius', panelWidth: '--lk-panel-width'
};

// CSS variables for the theme. Only keys the author set (directly or through a
// preset) are emitted, so a host page's stylesheet can still theme the rest.
export function themeToCssVars(theme = {}) {
  if (typeof theme === 'string') theme = { preset: theme };
  const { preset, ...own } = theme;
  const chosen = { ...(THEME_PRESETS[preset] ?? {}), ...own };
  const out = {};
  for (const [k, v] of Object.entries(chosen)) if (VAR_NAMES[k]) out[VAR_NAMES[k]] = v;
  return out;
}

/* ───────────────────────────── basemap factory ──────────────────────── */

export function wmsTileUrl(wms) {
  const base = qs({
    service: 'WMS',
    request: 'GetMap',
    version: wms.version ?? '1.3.0',
    layers: wms.layers,
    styles: wms.styles ?? '',
    format: wms.format ?? 'image/png',
    transparent: wms.transparent ?? true,
    crs: 'EPSG:3857',
    width: 256,
    height: 256
  });
  // MapLibre substitutes {bbox-epsg-3857} per raster tile request.
  const sep = wms.url.includes('?') ? '&' : '?';
  return `${wms.url}${sep}${base}&bbox={bbox-epsg-3857}`;
}

export function wmtsTileUrl(wmts) {
  const base = qs({
    service: 'WMTS',
    request: 'GetTile',
    version: wmts.version ?? '1.0.0',
    layer: wmts.layer,
    style: wmts.style ?? 'default',
    format: wmts.format ?? 'image/png',
    TileMatrixSet: wmts.tileMatrixSet
  });
  const sep = wmts.url.includes('?') ? '&' : '?';
  // {z}/{x}/{y} are filled by MapLibre; TileMatrix/Row/Col map to them.
  return `${wmts.url}${sep}${base}&TileMatrix={z}&TileRow={y}&TileCol={x}`;
}

export function buildBasemap(basemap) {
  basemap = pickBasemap(basemap);
  const attribution = basemap.attribution ?? '';
  const raster = (tiles) => ({
    kind: 'raster',
    source: {
      type: 'raster', tiles: [tiles], tileSize: basemap.tileSize ?? 256, attribution,
      ...(basemap.maxzoom ? { maxzoom: basemap.maxzoom } : {})
    },
    layer: { id: 'lk-basemap', type: 'raster', source: 'lk-basemap' }
  });

  switch (basemap.type) {
    case 'xyz':  return raster(basemap.url);
    case 'wms':  return raster(wmsTileUrl(basemap));
    case 'wmts': return raster(wmtsTileUrl(basemap));
    case 'style': return { kind: 'style', style: basemap.url };
    default:
      throw new Error(`lungkui: unknown basemap.type '${basemap.type}' (expected xyz|wms|wmts|style)`);
  }
}

// MapLibre style for a raster basemap (or the style URL as is).
export function basemapStyle(basemap) {
  const bm = buildBasemap(basemap);
  return bm.kind === 'style' ? bm.style : { version: 8, sources: { 'lk-basemap': bm.source }, layers: [bm.layer] };
}

/* ──────────────────────────── source adapters ───────────────────────── */

export function wfsUrl(wfs) {
  const params = qs({
    service: 'WFS',
    version: wfs.version ?? '2.0.0',
    request: 'GetFeature',
    typeNames: wfs.typeName,
    outputFormat: 'application/json',
    srsName: wfs.srsName ?? 'EPSG:4326',
    bbox: wfs.bbox ?? null,
    count: wfs.count ?? null,
    startIndex: wfs.startIndex ?? null
  });
  const sep = wfs.url.includes('?') ? '&' : '?';
  return `${wfs.url}${sep}${params}`;
}

async function fetchJson(url, fetchFn) {
  const res = await fetchFn(url);
  if (!res.ok) throw new Error(`lungkui: fetch failed (${res.status}) for ${url}`);
  return res.json();
}

export async function loadSourceData(source, { fetch } = {}) {
  const fetchFn = fetch ?? globalThis.fetch;
  if (source.geojson !== undefined) {
    const data = typeof source.geojson === 'string'
      ? await fetchJson(source.geojson, fetchFn)
      : source.geojson;
    return { type: 'geojson', data };
  }
  if (source.wfs !== undefined) {
    const data = await fetchJson(wfsUrl(source.wfs), fetchFn);
    return { type: 'geojson', data };
  }
  throw new Error('lungkui: layer source must have a geojson or wfs key');
}

/* ──────────────────────────── thematic styles ───────────────────────── */

// ColorBrewer schemes (Cynthia Brewer, colorbrewer2.org) plus viridis. Sequential
// for ordered values, diverging around a midpoint, qualitative for categories.
export const PALETTES = {
  blues: ['#eff3ff', '#bdd7e7', '#6baed6', '#3182bd', '#08519c'],
  greens: ['#edf8e9', '#bae4b3', '#74c476', '#31a354', '#006d2c'],
  reds: ['#fee5d9', '#fcae91', '#fb6a4a', '#de2d26', '#a50f15'],
  oranges: ['#feedde', '#fdbe85', '#fd8d3c', '#e6550d', '#a63603'],
  purples: ['#f2f0f7', '#cbc9e2', '#9e9ac8', '#756bb1', '#54278f'],
  ylorrd: ['#ffffb2', '#fecc5c', '#fd8d3c', '#f03b20', '#bd0026'],
  ylgnbu: ['#ffffcc', '#a1dab4', '#41b6c4', '#2c7fb8', '#253494'],
  viridis: ['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725'],
  rdbu: ['#ca0020', '#f4a582', '#f7f7f7', '#92c5de', '#0571b0'],
  set2: ['#66c2a5', '#fc8d62', '#8da0cb', '#e78ac3', '#a6d854', '#ffd92f', '#e5c494', '#b3b3b3'],
  dark2: ['#1b9e77', '#d95f02', '#7570b3', '#e7298a', '#66a61e', '#e6ab02', '#a6761d', '#666666']
};
const QUALITATIVE = new Set(['set2', 'dark2']);
const NO_DATA = '#bdbdbd';

const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgbToHex = (c) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

// n colours from a scheme: qualitative schemes are taken in order (cycling),
// sequential/diverging ones are interpolated end to end.
export function palette(name, n) {
  const base = Array.isArray(name) ? name : PALETTES[name];
  if (!base) throw new Error(`lungkui: unknown palette '${name}' (expected ${Object.keys(PALETTES).join('|')})`);
  if (!Array.isArray(name) && QUALITATIVE.has(name)) return Array.from({ length: n }, (_, i) => base[i % base.length]);
  if (n <= 1) return [base[base.length - 1]];
  return Array.from({ length: n }, (_, i) => {
    const t = (i / (n - 1)) * (base.length - 1);
    const lo = Math.floor(t), hi = Math.min(lo + 1, base.length - 1), f = t - lo;
    const a = hexToRgb(base[lo]), b = hexToRgb(base[hi]);
    return rgbToHex(a.map((v, k) => v + (b[k] - v) * f));
  });
}

// Jenks natural breaks (Fisher's dynamic programme): minimises variance within classes.
function jenks(sorted, k) {
  const n = sorted.length;
  const lower = Array.from({ length: n + 1 }, () => new Array(k + 1).fill(0));
  const vari = Array.from({ length: n + 1 }, () => new Array(k + 1).fill(Infinity));
  for (let j = 1; j <= k; j++) { lower[1][j] = 1; vari[1][j] = 0; }
  for (let l = 2; l <= n; l++) {
    let s1 = 0, s2 = 0, w = 0, v = 0;
    for (let m = 1; m <= l; m++) {
      const i3 = l - m + 1, val = sorted[i3 - 1];
      s2 += val * val; s1 += val; w++;
      v = s2 - (s1 * s1) / w;
      if (i3 > 1) {
        for (let j = 2; j <= k; j++) {
          if (vari[l][j] >= v + vari[i3 - 1][j - 1]) { lower[l][j] = i3; vari[l][j] = v + vari[i3 - 1][j - 1]; }
        }
      }
    }
    lower[l][1] = 1; vari[l][1] = v;
  }
  const out = new Array(k + 1);
  out[k] = sorted[n - 1]; out[0] = sorted[0];
  let kk = n;
  for (let j = k; j >= 2; j--) { const id = lower[kk][j] - 2; out[j - 1] = sorted[id]; kk = lower[kk][j] - 1; }
  return out;
}

// Class limits [min, b1, ..., max] for n classes. method: 'quantile' | 'equal' |
// 'jenks' | an explicit array of breaks. Duplicate limits are dropped, so
// constant data gives [v, v] rather than empty classes.
export function classBreaks(values, n = 5, method = 'quantile') {
  if (Array.isArray(method)) return [...method].sort((a, b) => a - b);
  const v = values.filter((x) => typeof x === 'number' && Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return [];
  const min = v[0], max = v[v.length - 1];
  if (min === max) return [min, max];
  let b;
  if (method === 'equal') b = Array.from({ length: n + 1 }, (_, i) => min + ((max - min) * i) / n);
  else if (method === 'jenks') b = jenks(v, Math.min(n, v.length));
  else b = Array.from({ length: n + 1 }, (_, i) => v[Math.min(v.length - 1, Math.round((i * (v.length - 1)) / n))]);
  return b.filter((x, i) => i === 0 || x !== b[i - 1]);
}

const num = (p) => ['to-number', ['get', p], 0];
const missing = (p) => ['any', ['!', ['has', p]], ['==', ['get', p], null]];
const fmt = (x) => {
  if (Math.abs(x) >= 100 || Number.isInteger(x)) return Math.round(x).toLocaleString('en');
  return Number(x.toPrecision(3)).toLocaleString('en');
};

function valuesOf(data, p) {
  // Missing values (null, '', absent) are not zero: leave them out of the classes.
  return (data?.features ?? [])
    .map((f) => f.properties?.[p])
    .filter((v) => v !== null && v !== undefined && v !== '')
    .map(Number)
    .filter(Number.isFinite);
}

function geomKind(data) {
  const t = data?.features?.find((f) => f.geometry)?.geometry.type ?? 'Point';
  return /Polygon/.test(t) ? 'polygon' : /LineString/.test(t) ? 'line' : 'point';
}

function stepColor(p, breaks, colors) {
  const step = ['step', num(p), colors[0]];
  for (let i = 1; i < colors.length; i++) step.push(breaks[i], colors[i]);
  return ['case', missing(p), NO_DATA, step];
}

// MapLibre layers + legend for a data layer with `style: { kind, ... }`.
// Returns { layers: [...], legend: [...] }; the first layer keeps layer.id so
// show/hide/highlight work as for plain layers.
export function buildThematic(layer, data, theme = {}) {
  const s = layer.style;
  const id = layer.id;
  const src = layer.id;
  const t = resolveTheme(theme);
  const accent = s.color === undefined ? t.accent : (String(s.color).startsWith('@') ? t[s.color.slice(1)] : s.color);
  const unit = s.unit ? ` ${s.unit}` : '';

  switch (s.kind) {
    case 'choropleth':
    case 'extrusion': {
      const breaks = classBreaks(valuesOf(data, s.property), s.classes ?? 5, s.breaks ?? s.method ?? 'quantile');
      const classes = Math.max(1, breaks.length - 1);
      const colors = palette(s.palette ?? (s.kind === 'extrusion' ? 'ylorrd' : 'blues'), classes);
      const legend = colors.map((c, i) => ({ type: 'fill', color: c, label: `${fmt(breaks[i])} – ${fmt(breaks[i + 1] ?? breaks[i])}${unit}` }));
      if (s.noData !== false) legend.push({ type: 'fill', color: NO_DATA, label: s.noDataLabel ?? 'No data' });
      if (s.kind === 'extrusion') {
        return {
          layers: [{ id, type: 'fill-extrusion', source: src, paint: {
            'fill-extrusion-color': stepColor(s.property, breaks, colors),
            'fill-extrusion-height': ['*', num(s.heightProperty ?? s.property), s.heightScale ?? 1],
            'fill-extrusion-base': 0, 'fill-extrusion-opacity': 0.85 } }],
          legend
        };
      }
      return {
        layers: [
          { id, type: 'fill', source: src, paint: { 'fill-color': stepColor(s.property, breaks, colors), 'fill-opacity': s.opacity ?? 0.8 } },
          { id: `${id}-outline`, type: 'line', source: src, paint: { 'line-color': '#ffffff', 'line-width': 0.6, 'line-opacity': 0.9 } }
        ],
        legend
      };
    }
    case 'proportional': {
      const vals = valuesOf(data, s.property);
      const max = Math.max(...vals, 0);
      const rMax = s.maxRadius ?? 30;
      const root = Math.sqrt(max);
      // Area, not radius, is proportional to the value (r = rMax * sqrt(v / max)).
      const r = (v) => (max > 0 ? rMax * Math.sqrt(v / max) : 0);
      const legendVals = [max, max / 4, max / 16].filter((v) => v > 0);
      return {
        layers: [{ id, type: 'circle', source: src,
          layout: { 'circle-sort-key': ['-', num(s.property)] },
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['sqrt', num(s.property)], 0, 0, root || 1, rMax],
            'circle-color': accent, 'circle-opacity': s.opacity ?? 0.6,
            'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1
          } }],
        legend: legendVals.map((v) => ({ type: 'point', color: accent, size: Math.round(2 * r(v)), label: `${fmt(v)}${unit}` }))
      };
    }
    case 'categories': {
      const seen = [];
      for (const f of data?.features ?? []) {
        const v = f.properties?.[s.property];
        if (v != null && !seen.includes(v)) seen.push(v);
      }
      const cats = s.order ?? seen;
      const colors = palette(s.palette ?? 'set2', cats.length);
      const expr = ['match', ['get', s.property]];
      cats.forEach((c, i) => expr.push(c, colors[i]));
      expr.push(NO_DATA);
      const kind = geomKind(data);
      const labels = s.labels ?? {};
      const legend = cats.map((c, i) => ({ type: kind === 'polygon' ? 'fill' : kind === 'line' ? 'line' : 'point', color: colors[i], label: labels[c] ?? String(c) }));
      if (kind === 'polygon') return { layers: [{ id, type: 'fill', source: src, paint: { 'fill-color': expr, 'fill-opacity': s.opacity ?? 0.75 } }, { id: `${id}-outline`, type: 'line', source: src, paint: { 'line-color': '#ffffff', 'line-width': 0.6 } }], legend };
      if (kind === 'line') return { layers: [{ id, type: 'line', source: src, paint: { 'line-color': expr, 'line-width': s.width ?? 3 } }], legend };
      return { layers: [{ id, type: 'circle', source: src, paint: { 'circle-color': expr, 'circle-radius': s.radius ?? 6, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5 } }], legend };
    }
    case 'heatmap': {
      const colors = palette(s.palette ?? 'ylorrd', 5);
      const vals = s.property ? valuesOf(data, s.property) : [];
      const max = Math.max(...vals, 1);
      return {
        layers: [{ id, type: 'heatmap', source: src, paint: {
          'heatmap-weight': s.property ? ['interpolate', ['linear'], num(s.property), 0, 0, max, 1] : 1,
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 4, s.radius ?? 12, 12, (s.radius ?? 12) * 2.5],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 4, 0.8, 12, 2],
          'heatmap-opacity': s.opacity ?? 0.8,
          'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0,0,0,0)', 0.2, colors[0], 0.4, colors[1], 0.6, colors[2], 0.8, colors[3], 1, colors[4]]
        } }],
        legend: [{ type: 'ramp', colors, label: s.legendLabel ?? 'Fewer → more' }]
      };
    }
    case 'flows': {
      const vals = valuesOf(data, s.property);
      const max = Math.max(...vals, 0);
      const wMax = s.maxWidth ?? 10;
      const w = (v) => Math.max(1, (v / (max || 1)) * wMax);
      return {
        layers: [
          { id: `${id}-casing`, type: 'line', source: src, layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': '#ffffff', 'line-opacity': 0.7, 'line-width': ['interpolate', ['linear'], num(s.property), 0, 3, max || 1, wMax + 2] } },
          { id, type: 'line', source: src, layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': accent, 'line-opacity': s.opacity ?? 0.75, 'line-width': ['interpolate', ['linear'], num(s.property), 0, 1, max || 1, wMax] } }
        ],
        legend: [max, max / 2, max / 4].filter((v) => v > 0).map((v) => ({ type: 'line', color: accent, width: Math.round(w(v)), label: `${fmt(v)}${unit}` }))
      };
    }
    case 'track':
      return {
        layers: [
          { id: `${id}-casing`, type: 'line', source: src, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': (s.width ?? 3) + 3, 'line-opacity': 0.9 } },
          { id, type: 'line', source: src, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': accent, 'line-width': s.width ?? 3 } }
        ],
        legend: [{ type: 'line', color: accent, label: s.legendLabel ?? 'Track' }]
      };
    default:
      throw new Error(`lungkui: unknown style kind '${s.kind}' (expected choropleth|proportional|categories|heatmap|flows|extrusion|track)`);
  }
}

// Tooltip text: the template is the author's (trusted HTML); each {field} is
// replaced by that feature property, escaped, numbers formatted, '–' if missing.
export function tooltipHTML(template, props = {}, labels = {}) {
  return template.replace(/\{([\w.-]+)\}/g, (_, k) => {
    const v = props[k];
    if (v === null || v === undefined || v === '') return '–';
    const shown = labels[k]?.[v] ?? v;
    return escapeHtml(typeof shown === 'number' ? fmt(shown) : shown);
  });
}

// Default tooltip for a styled layer: its name and the styled value.
export function defaultTooltip(layer) {
  const p = layer.style?.property;
  // A heatmap is a surface, not features you can point at.
  if (!p || layer.style.kind === 'heatmap') return null;
  const unit = layer.style.unit ? ` ${layer.style.unit}` : '';
  return `<strong>{name}</strong><br>{${p}}${unit}`;
}

// Rows [{ label, value }] for a slide chart: inline `data`, or read from a loaded
// layer (`layer`, `property`, `label` field, default 'name'). Missing values are
// dropped; layer rows are sorted largest first unless sort: false; `top` keeps N.
export function chartRows(chart, layerData = {}) {
  if (Array.isArray(chart.data)) return chart.data;
  const fc = layerData[chart.layer];
  if (!fc) return [];
  const labelKey = chart.label ?? 'name';
  let rows = (fc.features ?? [])
    .map((f) => ({ label: f.properties?.[labelKey], value: f.properties?.[chart.property] }))
    .filter((r) => r.value !== null && r.value !== undefined && r.value !== '' && Number.isFinite(Number(r.value)))
    .map((r) => ({ label: String(r.label ?? ''), value: Number(r.value) }));
  if (chart.sort !== false) rows.sort((a, b) => b.value - a.value);
  if (chart.top) rows = rows.slice(0, chart.top);
  return rows;
}

// Horizontal bar chart as inline SVG: label above each bar, value at its end,
// bars from a zero baseline (length proportional to value). `highlight` names the
// row drawn in the accent colour; the others are muted.
export function chartSVG(rows, { title = '', unit = '', highlight = null, source = '', color = '#c8462a', muted = '#9a958a', width = 300 } = {}) {
  if (!rows.length) return '';
  const rowH = 32, barH = 11, room = 64;
  const max = Math.max(...rows.map((r) => r.value), 0) || 1;
  const u = unit ? ` ${unit}` : '';
  const body = rows.map((r, i) => {
    const y = i * rowH;
    const w = Math.max(0, (r.value / max) * (width - room));
    const fill = highlight == null || r.label === highlight ? color : muted;
    return `<text x="0" y="${y + 11}" class="lk-chart__label">${escapeHtml(r.label)}</text>` +
      `<rect x="0" y="${y + 15}" width="${w.toFixed(1)}" height="${barH}" fill="${escapeHtml(fill)}"/>` +
      `<text x="${(w + 6).toFixed(1)}" y="${y + 25}" class="lk-chart__value">${escapeHtml(fmt(r.value) + u)}</text>`;
  }).join('');
  const h = rows.length * rowH;
  const label = `${title || 'Chart'}: ${rows.map((r) => `${r.label} ${fmt(r.value)}${u}`).join(', ')}`;
  return `<figure class="lk-chart">${title ? `<figcaption>${escapeHtml(title)}</figcaption>` : ''}` +
    `<svg viewBox="0 0 ${width} ${h}" width="100%" role="img" aria-label="${escapeHtml(label)}">${body}</svg>` +
    `${source ? `<p class="lk-chart__source">Source: ${escapeHtml(source)}</p>` : ''}</figure>`;
}

// Paint for a journey line: the part already travelled in `done`, the rest in
// `todo`, switching at `p` (0..1 along the line). Needs a source with lineMetrics.
export function progressGradient(p, done, todo) {
  if (p >= 1) return ['step', ['line-progress'], done, 1, done];
  return ['step', ['line-progress'], done, Math.max(p, 0.000001), todo];
}

// Thumbnail marker for a photo slide (markers: 'photo').
export function photoMarkerHTML(slide) {
  const url = slide.media?.url ?? '';
  return `<span class="lk-photo" style="background-image:url(${escapeHtml(JSON.stringify(url))})"></span>`;
}

/* ───────────────────────────── layer manager ────────────────────────── */

const TYPE_MAP = { point: 'circle', circle: 'circle', line: 'line', polygon: 'fill', fill: 'fill' };

export function normalizeLayerType(type) {
  const t = TYPE_MAP[type];
  if (!t) throw new Error(`lungkui: unknown layer type '${type}' (expected point|line|polygon)`);
  return t;
}

export function buildMapLayer(layer, theme) {
  return {
    id: layer.id,
    type: normalizeLayerType(layer.type),
    source: layer.id,
    paint: resolveTokens(layer.paint ?? {}, theme)
  };
}

export class LayerManager {
  constructor(map) {
    this.map = map;
    this.layerIds = [];
    this.data = {}; // loaded GeoJSON per layer id, for fitting the camera to a layer
    this.related = {}; // extra MapLibre layers per story layer (outlines, casings)
    this.legends = {}; // auto-legends of styled layers, for slides that ask for them
  }

  async add(layers, theme, deps = {}) {
    const load = deps.loadSourceData ?? loadSourceData;
    for (const layer of layers) {
      const sourceSpec = await load(layer.source, deps);
      // lineMetrics lets a slide paint the travelled part of a track (slide.progress).
      if (layer.source.lineMetrics) sourceSpec.lineMetrics = true;
      this.map.addSource(layer.id, sourceSpec);
      this.data[layer.id] = sourceSpec.data;
      if (layer.style) {
        // Thematic layer: lungkui derives paint and legend from the data.
        const t = buildThematic(layer, sourceSpec.data, theme);
        for (const l of t.layers) this.map.addLayer(l, deps.beforeId);
        this.related[layer.id] = t.layers.map((l) => l.id);
        this.legends[layer.id] = t.legend;
      } else {
        this.map.addLayer(buildMapLayer(layer, theme), deps.beforeId);
        this.related[layer.id] = [layer.id];
      }
      this.layerIds.push(layer.id);
    }
  }

  apply({ show = [], hide = [], highlight = null } = {}) {
    const each = (ids, fn) => ids.flatMap((id) => this.related[id] ?? [id]).forEach((id) => { if (this.map.getLayer(id)) fn(id); });
    each(show, (id) => this.map.setLayoutProperty(id, 'visibility', 'visible'));
    each(hide, (id) => this.map.setLayoutProperty(id, 'visibility', 'none'));
    // Reset every layer's filter, then apply the active highlight.
    for (const id of this.layerIds) {
      if (this.map.getLayer(id)) this.map.setFilter(id, null);
    }
    if (highlight && this.map.getLayer(highlight.layer)) {
      this.map.setFilter(highlight.layer, highlight.filter);
    }
  }
}

/* ─────────────────────────── stops and route ────────────────────────── */

// A slide is a "stop" (gets a numbered marker and joins the route) when it has a
// point camera and is not an overview/title slide.
export function isStop(slide) {
  if (slide.stop === false || slide.overview || slide.position === 'full') return false;
  return Array.isArray(slide.camera?.center);
}

// [{ index, number, center }] for every stop, numbered 1..n in slide order.
export function stopsOf(slides) {
  const out = [];
  slides.forEach((s, index) => {
    if (isStop(s)) out.push({ index, number: out.length + 1, center: s.camera.center });
  });
  return out;
}

export function routeGeoJSON(slides) {
  const coords = stopsOf(slides).map((s) => s.center);
  return {
    type: 'FeatureCollection',
    features: coords.length < 2 ? [] : [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } }]
  };
}

export function stopsGeoJSON(slides) {
  return {
    type: 'FeatureCollection',
    features: stopsOf(slides).map((s) => ({
      type: 'Feature', properties: { index: s.index, number: s.number }, geometry: { type: 'Point', coordinates: s.center }
    }))
  };
}

// [[minLng, minLat], [maxLng, maxLat]] of a FeatureCollection, or null when empty.
// `where` keeps only features whose properties equal every given value.
export function geojsonBounds(fc, where = null) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const walk = (c) => {
    if (typeof c[0] === 'number') {
      if (c[0] < minX) minX = c[0];
      if (c[1] < minY) minY = c[1];
      if (c[0] > maxX) maxX = c[0];
      if (c[1] > maxY) maxY = c[1];
    } else c.forEach(walk);
  };
  for (const f of fc?.features ?? []) {
    if (where && !Object.entries(where).every(([k, v]) => f.properties?.[k] === v)) continue;
    const g = f.geometry;
    if (!g) continue;
    if (g.type === 'GeometryCollection') g.geometries.forEach((gg) => walk(gg.coordinates));
    else walk(g.coordinates);
  }
  return minX === Infinity ? null : [[minX, minY], [maxX, maxY]];
}

// Whole-story extent: every slide place plus every loaded data layer. Used by
// the overview inset, so stories without point stops still get a locator.
export function storyExtent(slides, layerData = {}) {
  const boxes = [];
  const centers = slides.map((s) => s.camera?.center).filter(Array.isArray);
  if (centers.length) boxes.push(slidesBounds(slides));
  for (const fc of Object.values(layerData)) {
    const b = geojsonBounds(fc);
    if (b) boxes.push(b);
  }
  if (!boxes.length) return null;
  return [
    [Math.min(...boxes.map((b) => b[0][0])), Math.min(...boxes.map((b) => b[0][1]))],
    [Math.max(...boxes.map((b) => b[1][0])), Math.max(...boxes.map((b) => b[1][1]))]
  ];
}

// Small key for the panel: [{ type: fill|line|point, color, label }]. Colours
// may be theme tokens ('@accent').
export function legendHTML(items = [], theme = {}) {
  if (!items.length) return '';
  const t = resolveTheme(theme);
  const color = (c) => (typeof c === 'string' && c.startsWith('@') ? t[c.slice(1)] ?? c : c ?? t.accent);
  const rows = items.map((it) => {
    const type = ['fill', 'line', 'point', 'ramp'].includes(it.type) ? it.type : 'point';
    let style = `--lk-swatch:${escapeHtml(color(it.color))}`;
    if (type === 'point' && it.size) style += `;width:${+it.size}px;height:${+it.size}px`;
    if (type === 'line' && it.width) style += `;height:${+it.width}px`;
    if (type === 'ramp') style = `background:linear-gradient(to right, ${(it.colors ?? []).map((c) => escapeHtml(color(c))).join(', ')})`;
    return `<li><span class="lk-swatch lk-swatch--${type}" style="${style}"></span>${escapeHtml(it.label ?? '')}</li>`;
  });
  return `<ul class="lk-legend">${rows.join('')}</ul>`;
}

/* ───────────────────────────── map controller ───────────────────────── */

export function slidesBounds(slides) {
  const centers = slides.map((s) => s.camera?.center).filter(Boolean);
  if (centers.length === 0) return null;
  const lngs = centers.map((c) => c[0]);
  const lats = centers.map((c) => c[1]);
  return [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]];
}

export function cameraOptions(camera, padding) {
  const out = {
    center: camera.center,
    zoom: camera.zoom,
    pitch: camera.pitch ?? 0,
    bearing: camera.bearing ?? 0
  };
  if (padding) out.padding = padding;
  return out;
}

// Index of the slide whose camera centre is closest to a [lng, lat] point.
// Used to jump to a slide when its feature is clicked on the map.
export function nearestSlideIndex(point, slides) {
  let best = null;
  let bestD = Infinity;
  slides.forEach((s, i) => {
    const c = s.camera?.center;
    if (!c) return;
    const d = (c[0] - point[0]) ** 2 + (c[1] - point[1]) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}

/* ───────────────────────────── layout maths ─────────────────────────── */

// 'side' (panel docked beside the map) when the box is wide enough, else
// 'stack' (map above, panel as a bottom sheet).
export function layoutFor(width, breakpoint = 720) {
  return width >= breakpoint ? 'side' : 'stack';
}

// Which side a slide's panel docks to in the side layout.
export function panelSide(slide, fallback = 'left') {
  const p = slide.position;
  return p === 'left' || p === 'right' ? p : (p === 'center' ? 'center' : fallback);
}

// Camera padding (px) so the camera target lands in the part of the map the
// panel does not cover. `panel` is the panel box: { width, height } in px.
// `top` reserves the strip used by the map tools (and, when stacked, attribution).
export function cameraPadding({ layout, side, width, height, panel, margin = 24, top = 44 }) {
  const pad = { top: margin + top, right: margin, bottom: margin, left: margin };
  if (layout === 'stack') {
    pad.bottom = Math.min(panel.height + margin, Math.round(height * 0.75));
  } else if (side === 'left' || side === 'right') {
    pad[side] = Math.min(panel.width + margin * 2, Math.round(width * 0.7));
  }
  return pad;
}

// Swap any map's basemap, keeping the sources and layers for which keep(id) is
// true on top of the new style. Used for the story map and its overview inset.
export function swapBasemap(map, basemap, keep = () => false) {
  if (!map?.setStyle) return;
  map.setStyle(basemapStyle(basemap), {
    transformStyle: (prev, next) => {
      if (!prev) return next;
      const ownLayers = prev.layers.filter((l) => keep(l.id));
      const ownSources = Object.fromEntries(Object.entries(prev.sources).filter(([id]) => keep(id)));
      return { ...next, sources: { ...next.sources, ...ownSources }, layers: [...next.layers, ...ownLayers] };
    }
  });
}

export class MapController {
  constructor(container, mapConfig, { maplibregl } = {}) {
    this.gl = maplibregl ?? globalThis.maplibregl;
    if (!this.gl) throw new Error('lungkui: MapLibre GL JS (maplibregl) is required but was not found');
    this.container = container;
    this.mapConfig = mapConfig;
    this._map = null;
  }

  init({ isDark = false } = {}) {
    this._map = new this.gl.Map({
      container: this.container,
      style: basemapStyle(pickBasemap(this.mapConfig.basemap, isDark)),
      center: this.mapConfig.center,
      zoom: this.mapConfig.zoom,
      pitch: this.mapConfig.pitch ?? 0,
      bearing: this.mapConfig.bearing ?? 0,
      attributionControl: false,
      // Sharp labels on retina screens without paying for it on others.
      pixelRatio: Math.min(globalThis.devicePixelRatio || 1, 2)
    });

    // Story drives the camera: disable the navigation handlers so wheel/drag
    // can't zoom past the data extent — but keep the map otherwise "interactive"
    // so feature click/hover events still fire. `interactive:true` opts out.
    if (this.mapConfig.interactive !== true) {
      for (const h of ['scrollZoom', 'boxZoom', 'dragRotate', 'dragPan',
                       'keyboard', 'doubleClickZoom', 'touchZoomRotate', 'touchPitch']) {
        this._map[h]?.disable?.();
      }
    }
    // Credit line: basemap attribution (from its source/style) plus lungkui itself.
    // map.credit: true (default) | your own HTML | false.
    const credit = this.mapConfig.credit ?? true;
    const custom = credit === true ? 'Story by lungkui.js' : (credit || undefined);
    if (this.gl.AttributionControl) this._map.addControl?.(new this.gl.AttributionControl({ compact: true, customAttribution: custom }), 'bottom-right');
    if (this.mapConfig.scale !== false && this.gl.ScaleControl) {
      this._map.addControl?.(new this.gl.ScaleControl({ unit: 'metric', maxWidth: 110 }), 'bottom-right');
    }
    return this._map;
  }

  // Swap the basemap, keeping every story source and layer (anything not from
  // the old basemap) on top of the new one.
  setBasemap(basemap, keep = () => false) {
    swapBasemap(this._map, basemap, keep);
  }

  // First label layer of a vector basemap: story lines go below it so place
  // names stay readable. Undefined for raster basemaps (draw on top).
  firstLabelLayerId() {
    return this._map?.getStyle?.()?.layers?.find((l) => l.type === 'symbol')?.id;
  }

  flyTo(camera, { padding, animate = true } = {}) {
    const opts = cameraOptions(camera, padding);
    if (animate) this._map.flyTo({ ...opts, duration: 1800, essential: true });
    else this._map.jumpTo(opts);
  }

  fitTo(bounds, { padding, animate = true, maxZoom } = {}) {
    this._map.fitBounds(bounds, { padding, animate, duration: animate ? 1800 : 0, maxZoom, essential: true });
  }

  get map() {
    return this._map;
  }
}

/* ───────────────────────────── story engine ─────────────────────────── */

export function clampIndex(i, len) {
  if (i < 0) return 0;
  if (i > len - 1) return len - 1;
  return i;
}

export class DeckStrategy {
  constructor(slideCount) {
    this.count = slideCount;
    this._index = 0;
    // The story is reachable from its element (el.lungkui.goTo(2), el.lungkui.map), e.g. from page scripts or tests.
    this._cb = () => {};
  }
  onChange(cb) { this._cb = cb; }
  goTo(i) {
    const next = clampIndex(i, this.count);
    if (next !== this._index) { this._index = next; this._cb(next); }
  }
  next() { this.goTo(this._index + 1); }
  prev() { this.goTo(this._index - 1); }
  get index() { return this._index; }
}

export class ScrollStrategy {
  constructor(slideEls, { IntersectionObserver, root = null } = {}) {
    this.els = slideEls;
    this.IO = IntersectionObserver ?? globalThis.IntersectionObserver;
    this.root = root;
    this._cb = () => {};
    this._index = 0;
    this._observer = null;
  }
  onChange(cb) { this._cb = cb; }
  start() {
    // A slide becomes active when it crosses the middle band of the viewport.
    this._observer = new this.IO((entries) => {
      const active = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!active) return;
      const idx = Number(active.target.dataset.index);
      if (idx !== this._index) { this._index = idx; this._cb(idx); }
    }, { root: this.root, rootMargin: '-40% 0px -40% 0px', threshold: [0, 0.01] });
    this.els.forEach((el) => this._observer.observe(el));
  }
  // Arrow/keyboard nav: scroll the target slide into view; the observer above
  // then fires onChange once it reaches the middle band.
  goTo(i) {
    const idx = clampIndex(i, this.els.length);
    this.els[idx]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  next() { this.goTo(this._index + 1); }
  prev() { this.goTo(this._index - 1); }
  get index() { return this._index; }
  stop() { this._observer?.disconnect(); }
}

/* ──────────────────────────── slide renderer ────────────────────────── */

// A slide legend mixes literal items and layer ids; ids become slots that the
// story fills with that layer's auto-legend once its data has loaded.
function legendBlock(items = [], theme = {}) {
  const literal = items.filter((i) => typeof i !== 'string');
  const slots = items.filter((i) => typeof i === 'string')
    .map((id) => `<div class="lk-legend-slot" data-layer="${escapeHtml(id)}"></div>`).join('');
  return slots + legendHTML(literal, theme);
}

function chartBlock(chart, index, theme = {}) {
  if (!chart) return '';
  if (Array.isArray(chart.data)) {
    const t = resolveTheme(theme);
    return chartSVG(chartRows(chart), { ...chart, color: chart.color ?? t.accent, muted: t.muted });
  }
  return `<div class="lk-chart-slot" data-index="${index}"></div>`;
}

export function slidePanelHTML(slide, index, { stopNumber = null, total = null, theme = {} } = {}) {
  const position = slide.position ?? 'center';
  const kicker = slide.kicker
    ? `<p class="lk-kicker">${escapeHtml(slide.kicker)}</p>`
    : (stopNumber ? `<p class="lk-kicker">Stop ${stopNumber}${total ? ` of ${total}` : ''}</p>` : '');
  const title = slide.title ? `<h2>${escapeHtml(slide.title)}</h2>` : '';
  let media = '';
  if (slide.media?.url) {
    const cap = escapeHtml(slide.media.caption ?? '');
    const cred = slide.media.credit ? ` <span class="lk-credit">${escapeHtml(slide.media.credit)}</span>` : '';
    media = `<figure class="lk-media"><img src="${escapeHtml(slide.media.url)}" alt="${cap}" loading="lazy">` +
            `<figcaption>${cap}${cred}</figcaption></figure>`;
  }
  return `<section class="lk-slide lk-slide--${position}" data-index="${index}">` +
         `<div class="lk-slide__panel"><div class="lk-slide__body">${kicker}${title}${media}${slide.html ?? ''}${chartBlock(slide.chart, index, theme)}${legendBlock(slide.legend, theme)}</div></div></section>`;
}

export class SlideRenderer {
  constructor(container, { document, theme = {} } = {}) {
    this.container = container;
    this.doc = document ?? globalThis.document;
    this.theme = theme;
    this.els = [];
  }
  render(slides) {
    const stops = stopsOf(slides);
    const numberOf = new Map(stops.map((s) => [s.index, s.number]));
    this.container.innerHTML = slides
      .map((s, i) => slidePanelHTML(s, i, { stopNumber: numberOf.get(i) ?? null, total: stops.length, theme: this.theme }))
      .join('');
    this.els = Array.from(this.container.querySelectorAll('.lk-slide'));
    return this.els;
  }
  activate(index) {
    this.els.forEach((el, i) => {
      const on = i === index;
      el.classList.toggle('is-active', on);
      el.setAttribute?.('aria-hidden', String(!on));
    });
  }
}

/* ──────────────────────── orchestrator + emitter ────────────────────── */

export function createEmitter() {
  const map = new Map();
  return {
    on(evt, cb) { (map.get(evt) ?? map.set(evt, new Set()).get(evt)).add(cb); },
    off(evt, cb) { map.get(evt)?.delete(cb); },
    emit(evt, payload) { map.get(evt)?.forEach((cb) => cb(payload)); }
  };
}

export function resolveElement(target, document) {
  const doc = document ?? globalThis.document;
  const el = typeof target === 'string' ? doc.querySelector(target) : target;
  if (!el) throw new Error(`lungkui: container '${target}' not found`);
  return el;
}

const ICONS = {
  prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
  overview: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="14" rx="1.5"/><path d="M3.5 15l5-4 4 3 3-2 5 4"/></svg>',
  restart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.3-5.6"/><path d="M4 4v4h4"/></svg>'
};

// True when the host page is dark: an explicit html[data-theme], else the OS setting.
function pageIsDark(doc) {
  const t = doc?.documentElement?.dataset?.theme;
  if (t === 'dark' || t === 'light') return t === 'dark';
  return !!doc?.defaultView?.matchMedia?.('(prefers-color-scheme: dark)').matches;
}

export class Lungkui {
  constructor(target, config, deps = {}) {
    this.deps = deps;
    this.config = normalizeConfig(config);
    this.theme = resolveTheme(this.config.theme);
    this.emitter = createEmitter();
    this.container = resolveElement(target, deps.document);
    const doc = deps.document ?? globalThis.document;
    this._doc = doc;
    this._win = doc?.defaultView ?? globalThis;
    this._index = 0;

    const c = this.container;
    c.lungkui = this;
    this._embed = !!c.classList?.contains?.("lk-embed");
    for (const [k, v] of Object.entries(themeToCssVars(this.config.theme))) c.style.setProperty(k, v);
    c.classList.add('lk-root', this.config.mode === 'deck' ? 'lk-deck' : 'lk-scroll');
    if (!c.hasAttribute?.('tabindex')) c.setAttribute?.('tabindex', '0');
    c.setAttribute?.('role', 'region');
    c.setAttribute?.('aria-roledescription', 'map story');

    // Map and slides need separate child elements: SlideRenderer.render wipes
    // its container's innerHTML, which would destroy the MapLibre canvas if shared.
    const mapEl = doc.createElement('div');
    mapEl.className = 'lk-map';
    const slidesEl = doc.createElement('div');
    slidesEl.className = 'lk-slides';
    if (this.config.mode === 'deck') slidesEl.setAttribute?.('aria-live', 'polite');
    c.append(mapEl, slidesEl);
    this._mapEl = mapEl;

    this.controller = new MapController(mapEl, this.config.map, { maplibregl: deps.maplibregl });
    this.layers = new LayerManager(this.controller.init({ isDark: pageIsDark(doc) }));
    this.renderer = new SlideRenderer(slidesEl, { document: deps.document, theme: this.config.theme });
    const els = this.renderer.render(this.config.slides);
    this._stops = stopsOf(this.config.slides);

    this._buildStrategy(els);
    // Text first: the first panel is readable before the map has loaded.
    this.renderer.activate(0);
    this.container.dataset.side = panelSide(this.config.slides[0], this.config.panelSide);
    this._buildControls(doc);
    this._buildOverview(doc);
    this._watchSize();
    this._updatePager(0);
    this._watchTheme();
    this._wire();
  }

  /* ── layout ── */

  get layout() {
    return layoutFor(this.container.clientWidth || 0, this.config.breakpoint);
  }

  _applyLayout() {
    const lay = this.layout;
    this.container.classList.toggle('lk-layout-side', lay === 'side');
    this.container.classList.toggle('lk-layout-stack', lay === 'stack');
    return lay;
  }

  _watchSize() {
    this._applyLayout();
    const RO = this.deps.ResizeObserver ?? globalThis.ResizeObserver;
    if (!RO) return;
    let last = this.container.clientWidth;
    this._ro = new RO(() => {
      const w = this.container.clientWidth;
      if (w === last) return;
      last = w;
      this._applyLayout();
      this.controller.map?.resize?.();
      this._frame(this._index, { animate: false });
    });
    this._ro.observe(this.container);
  }

  // Follow the host page's light/dark switch for { light, dark } basemaps.
  _watchTheme() {
    const bm = this.config.map.basemap;
    if (!bm || typeof bm !== 'object' || !(bm.light || bm.dark)) return;
    const own = new Set(["lk-route", "lk-route-casing", ...this.config.layers.map((l) => l.id)]);
    let dark = pageIsDark(this._doc);
    const update = () => {
      const now = pageIsDark(this._doc);
      if (now === dark) return;
      dark = now;
      const next = pickBasemap(bm, dark);
      this.controller.setBasemap(next, (id) => own.has(id));
      // The overview inset is a second map: swap it too, keeping its route and stops.
      swapBasemap(this._overviewMap, next, (id) => id.startsWith('lk-ov-'));
    };
    const MO = this._win?.MutationObserver;
    if (MO && this._doc?.documentElement) {
      this._mo = new MO(update);
      this._mo.observe(this._doc.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    }
    this._mq = this._win?.matchMedia?.('(prefers-color-scheme: dark)');
    this._mq?.addEventListener?.('change', update);
  }

  // Padding that keeps the camera target clear of the active panel.
  _padding(index) {
    const slideEl = this.renderer.els[index];
    const panel = slideEl?.querySelector?.('.lk-slide__panel');
    const lay = this.layout;
    const side = panelSide(this.config.slides[index] ?? {}, this.config.panelSide);
    if (this.config.mode === 'scroll' && lay === 'side' && side === 'center') return undefined;
    return cameraPadding({
      layout: lay,
      side,
      width: this.container.clientWidth || 0,
      height: (this._mapEl.clientHeight || this.container.clientHeight || 0),
      panel: { width: panel?.offsetWidth ?? 0, height: panel?.offsetHeight ?? 0 }
    });
  }

  /* ── chrome ── */

  _buildControls(doc) {
    const L = this.config.labels;
    const mkBtn = (cls, label, icon, fn) => {
      const b = doc.createElement('button');
      b.type = 'button';
      b.className = cls;
      b.setAttribute?.('aria-label', label);
      b.title = label;
      b.innerHTML = icon;
      b.addEventListener('click', fn);
      return b;
    };

    if (this.config.controls !== false) {
      // Map tools: overview inset + back to start, small and out of the reading path.
      const tools = doc.createElement('div');
      tools.className = 'lk-tools';
      this._overviewBtn = mkBtn('lk-tool', L.overview, ICONS.overview, () => this._toggleOverview());
      this._overviewBtn.setAttribute?.('aria-pressed', 'false');
      tools.append(this._overviewBtn, mkBtn("lk-tool", L.restart, ICONS.restart, () => this.goTo(0)));
      this._chromeParent().append(tools);

      // Pager: previous / progress / next. Pinned to the panel edge in deck mode.
      const pager = doc.createElement('div');
      pager.className = 'lk-pager';
      this._prevBtn = mkBtn('lk-pager__btn', L.previous, ICONS.prev, () => this.prev());
      this._nextBtn = mkBtn('lk-pager__btn', L.next, ICONS.next, () => this.next());
      this._progress = doc.createElement('span');
      this._progress.className = 'lk-pager__count';
      this._bar = doc.createElement('span');
      this._bar.className = 'lk-pager__bar';
      this._bar.innerHTML = '<span></span>';
      pager.append(this._prevBtn, this._progress, this._bar, this._nextBtn);
      this.container.append(pager);
      this._pager = pager;
    }

    // Keyboard only while the story has focus: never steal the page's arrow keys.
    this._onKey = (e) => {
      if (e.target?.closest?.('input, textarea, select, [contenteditable]')) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); this.next(); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); this.prev(); }
      else if (e.key === 'Home') { e.preventDefault(); this.goTo(0); }
      else if (e.key === 'End') { e.preventDefault(); this.goTo(this.config.slides.length - 1); }
    };
    this.container.addEventListener('keydown', this._onKey);

    if (this.config.mode === 'deck' && this.config.wheel) {
      let locked = false;
      this._onWheel = (e) => {
        e.preventDefault();
        if (locked) return;
        locked = true;
        setTimeout(() => { locked = false; }, 700);
        if (e.deltaY > 0) this.next(); else this.prev();
      };
      this.container.addEventListener('wheel', this._onWheel, { passive: false });
    }

    // Swipe left/right on the panel turns slides in deck mode (touch screens).
    if (this.config.mode === 'deck') {
      let x0 = null;
      this._onTouchStart = (e) => { x0 = e.touches?.[0]?.clientX ?? null; };
      this._onTouchEnd = (e) => {
        const x1 = e.changedTouches?.[0]?.clientX;
        if (x0 == null || x1 == null) return;
        const dx = x1 - x0;
        if (Math.abs(dx) > 50) (dx < 0 ? this.next() : this.prev());
        x0 = null;
      };
      this.renderer.container.addEventListener('touchstart', this._onTouchStart, { passive: true });
      this.renderer.container.addEventListener('touchend', this._onTouchEnd, { passive: true });
    }
  }

  // Full-page scroll stories keep map tools on the sticky map so they stay in view.
  _chromeParent() {
    return this.config.mode === "scroll" && !this._embed ? this._mapEl : this.container;
  }

  _updatePager(index) {
    if (!this._pager) return;
    const n = this.config.slides.length;
    this._progress.textContent = `${index + 1} / ${n}`;
    this._bar.firstChild.style.width = `${n > 1 ? (index / (n - 1)) * 100 : 100}%`;
    this._prevBtn.disabled = index === 0;
    this._nextBtn.disabled = index === n - 1;
  }

  _buildOverview(doc) {
    const el = doc.createElement('div');
    el.className = 'lk-overview';
    el.hidden = true;
    this._chromeParent().append(el);
    this._overviewEl = el;
  }

  _toggleOverview() {
    const el = this._overviewEl;
    if (!el) return;
    if (!el.hidden) { this._closeOverview(); return; }
    el.hidden = false;
    this._overviewBtn?.classList.add('is-active');
    this._overviewBtn?.setAttribute?.('aria-pressed', 'true');
    if (!this._overviewMap) this._initOverviewMap();
    else { this._overviewMap.resize(); this._syncOverview(); }
  }

  _closeOverview() {
    const el = this._overviewEl;
    if (!el || el.hidden) return;
    el.hidden = true;
    this._overviewBtn?.classList.remove('is-active');
    this._overviewBtn?.setAttribute?.('aria-pressed', 'false');
  }

  // Locator inset: whole route at a wide zoom, current stop highlighted.
  _initOverviewMap() {
    const gl = this.controller.gl;
    if (!gl?.Map) return;
    this._overviewMap = new gl.Map({
      container: this._overviewEl,
      style: basemapStyle(pickBasemap(this.config.map.basemap, pageIsDark(this._doc))),
      interactive: false,
      attributionControl: false
    });
    this._overviewMap.on('load', () => {
      const m = this._overviewMap;
      const accent = this.theme.accent;
      m.addSource('lk-ov-route', { type: 'geojson', data: routeGeoJSON(this.config.slides) });
      m.addSource('lk-ov-stops', { type: 'geojson', data: stopsGeoJSON(this.config.slides) });
      m.addLayer({ id: 'lk-ov-route', type: 'line', source: 'lk-ov-route', paint: { 'line-color': accent, 'line-width': 1.5, 'line-opacity': 0.7 } });
      m.addLayer({ id: 'lk-ov-stops', type: 'circle', source: 'lk-ov-stops', paint: { 'circle-radius': 3, 'circle-color': '#fff', 'circle-stroke-color': accent, 'circle-stroke-width': 1.5 } });
      m.addLayer({ id: 'lk-ov-current', type: 'circle', source: 'lk-ov-stops', filter: ['==', ['get', 'index'], -1], paint: { 'circle-radius': 5.5, 'circle-color': accent, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } });
      // "You are here": one dot at the centre of the main map (no frame).
      m.addSource('lk-ov-view', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      m.addLayer({ id: 'lk-ov-view', type: 'circle', source: 'lk-ov-view', paint: { 'circle-radius': 5, 'circle-color': accent, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } });
      this._overviewReady = true;
      this._syncOverview();
    });
    // Follow the main map as it moves (camera flights included).
    this.controller.map?.on?.('move', () => this._syncOverviewFrame());
  }

  _syncOverview() {
    const m = this._overviewMap;
    if (!m || !this._overviewReady || this._overviewEl?.hidden) return;
    const b = storyExtent(this.config.slides, this.layers.data);
    if (b) m.fitBounds(b, { padding: 18, animate: false, maxZoom: this.config.map.overviewZoom + 3 });
    m.setFilter('lk-ov-current', ['==', ['get', 'index'], this._index]);
    this._syncOverviewFrame();
  }

  _syncOverviewFrame() {
    const m = this._overviewMap;
    if (!m || !this._overviewReady || this._overviewEl?.hidden) return;
    const c = this.controller.map?.getCenter?.();
    if (!c) return;
    m.getSource('lk-ov-view')?.setData({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [c.lng, c.lat] } });
  }

  /* ── cartography: route + numbered stops ── */

  _addStoryLayers() {
    const map = this.controller.map;
    const route = this.config.route;
    if (route && map?.addSource) {
      const r = route === true ? {} : route;
      map.addSource('lk-route', { type: 'geojson', data: routeGeoJSON(this.config.slides) });
      // White casing under the coloured line keeps it legible on any basemap.
      const below = this.controller.firstLabelLayerId();
      map.addLayer({ id: "lk-route-casing", type: "line", source: "lk-route", layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#ffffff", "line-width": (r.width ?? 3) + 3, "line-opacity": 0.85 } }, below);
      map.addLayer({ id: "lk-route", type: "line", source: "lk-route", layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": r.color ?? this.theme.accent, "line-width": r.width ?? 3, "line-dasharray": r.dash ?? [2, 1.5] } }, below);
    }

    const gl = this.controller.gl;
    if (this.config.markers === 'none' || !gl?.Marker) return;
    this._markers = this._stops.map((s) => {
      const el = this._doc.createElement('button');
      el.type = 'button';
      el.className = `lk-stop lk-stop--${this.config.markers}`;
      el.setAttribute?.('aria-label', `Stop ${s.number}: ${this.config.slides[s.index].title ?? ''}`);
      if (this.config.markers === 'numbered') el.textContent = String(s.number);
      if (this.config.markers === 'photo') el.innerHTML = photoMarkerHTML(this.config.slides[s.index]);
      el.addEventListener('click', (e) => { e.stopPropagation(); this.goTo(s.index); });
      const marker = new gl.Marker({ element: el, anchor: 'center' }).setLngLat(s.center).addTo(map);
      return { el, marker, index: s.index };
    });
  }

  _highlightStop(index) {
    for (const m of this._markers ?? []) {
      const on = m.index === index;
      m.el.classList.toggle('is-active', on);
      m.el.classList.toggle('is-visited', m.index < index);
      if (on) m.el.setAttribute?.('aria-current', 'step'); else m.el.removeAttribute?.('aria-current');
    }
  }

  _buildStrategy(els) {
    this.strategy = this.config.mode === 'deck'
      ? new DeckStrategy(this.config.slides.length)
      : new ScrollStrategy(els, {
        IntersectionObserver: this.deps.IntersectionObserver,
        // An embedded scroll story scrolls its own box, so watch that box, not the page.
        root: this._embed ? this.renderer.container : null
      });
    this.strategy.onChange((i) => this._activate(i));
  }

  _wire() {
    const map = this.controller.map;
    const start = async () => {
      try {
        await this.layers.add(this.config.layers, this.config.theme, {
          fetch: this.deps.fetch, loadSourceData: this.deps.loadSourceData,
          // Data under the basemap's place labels, so names stay readable.
          beforeId: this.controller.firstLabelLayerId()
        });
        this._fillLegends();
      } catch (err) {
        // Surface source/fetch failures without aborting the story.
        this.emitter.emit('error', err);
      }
      this._addStoryLayers();
      this._wireFeatureClicks();
      this.strategy.start?.();
      this._ready = true;
      // goTo() before load only moved the strategy; start from there.
      this._activate(this.strategy.index ?? 0, { animate: false });
    };
    if (map.loaded?.()) start(); else map.on('load', start);
  }

  // Click a data feature to jump to its slide; pointer cursor on hover.
  _wireFeatureClicks() {
    const map = this.controller.map;
    if (!map?.on) return;
    this._wireTooltips(map);
    for (const layer of this.config.layers) {
      if (layer.style) continue; // thematic layers: tooltips instead of slide jumps
      map.on('click', layer.id, (e) => {
        const f = e.features?.[0];
        const point = f?.geometry?.type === 'Point'
          ? f.geometry.coordinates
          : [e.lngLat.lng, e.lngLat.lat];
        const idx = nearestSlideIndex(point, this.config.slides);
        if (idx != null) this.goTo(idx);
      });
      map.on('mouseenter', layer.id, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', layer.id, () => { map.getCanvas().style.cursor = ''; });
    }
  }

  // Hover (or tap, on touch screens) a feature to see its values.
  _wireTooltips(map) {
    const gl = this.controller.gl;
    if (!gl?.Popup) return;
    const touch = !!this._win?.matchMedia?.('(hover: none)').matches;
    const popup = new gl.Popup({ closeButton: touch, closeOnClick: touch, offset: 10, className: 'lk-tooltip', maxWidth: '260px' });
    this._popup = popup;
    for (const layer of this.config.layers) {
      const tpl = layer.tooltip === false ? null : (layer.tooltip ?? defaultTooltip(layer));
      if (!tpl) continue;
      const show = (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const labels = layer.style?.labels ? { [layer.style.property]: layer.style.labels } : {};
        popup.setLngLat(e.lngLat).setHTML(tooltipHTML(tpl, f.properties, labels)).addTo(map);
      };
      map.on(touch ? 'click' : 'mousemove', layer.id, (e) => { map.getCanvas().style.cursor = 'default'; show(e); });
      if (!touch) map.on('mouseleave', layer.id, () => { map.getCanvas().style.cursor = ''; popup.remove(); });
    }
  }

  _fillLegends() {
    for (const el of this.container.querySelectorAll?.('.lk-chart-slot') ?? []) {
      const chart = this.config.slides[Number(el.dataset.index)]?.chart;
      if (chart) el.innerHTML = chartSVG(chartRows(chart, this.layers.data), { ...chart, color: chart.color ?? this.theme.accent, muted: this.theme.muted });
    }
    for (const el of this.container.querySelectorAll?.('.lk-legend-slot') ?? []) {
      const id = el.dataset.layer;
      const layer = this.config.layers.find((l) => l.id === id);
      const title = layer?.style?.title ? `<p class="lk-legend__title">${escapeHtml(layer.style.title)}</p>` : '';
      el.innerHTML = title + legendHTML(this.layers.legends[id] ?? [], this.config.theme);
    }
  }

  // slide.progress = { layer, value }: colour the track up to this point of the journey.
  _applyProgress(slide) {
    const pr = slide.progress;
    const map = this.controller.map;
    if (!pr || !map?.getLayer?.(pr.layer)) return;
    map.setPaintProperty(pr.layer, 'line-gradient', progressGradient(pr.value ?? 0, this.theme.accent, pr.todo ?? this.theme.muted));
  }

  _reducedMotion() {
    return !!this._win?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  }

  // Point the camera at a slide: fit all stops for overview slides (or
  // camera.fit), otherwise fly to the slide camera; both clear the panel.
  _frame(index, { animate = true } = {}) {
    const slide = this.config.slides[index];
    if (!slide || !this.controller.map) return;
    const anim = animate && !this._reducedMotion();
    const padding = this._padding(index);
    // camera.fit: { layer, where }: frame a data layer (or part of it), e.g. a burnt area.
    const fitLayer = slide.camera.fit?.layer;
    if (fitLayer) {
      const b = geojsonBounds(this.layers.data[fitLayer], slide.camera.fit.where ?? null);
      if (b) { this.controller.fitTo(b, { padding: padding ?? 40, animate: anim, maxZoom: slide.camera.fit.maxZoom ?? 14 }); return; }
    }
    const fitAll = slide.camera.fit === true || (slide.camera.fit !== false && !isStop(slide) && this._stops.length > 1 && slide.camera.zoom == null);
    if (fitAll) {
      const b = slidesBounds(this._stops.map((s) => this.config.slides[s.index]));
      if (b) { this.controller.fitTo(b, { padding: padding ?? 40, animate: anim, maxZoom: 12 }); return; }
    }
    this.controller.flyTo(slide.camera, { padding, animate: anim });
  }

  _activate(index, { animate = true } = {}) {
    const slide = this.config.slides[index];
    if (!slide) return;
    this._index = index;
    const side = panelSide(slide, this.config.panelSide);
    this.container.dataset.side = side;
    this.layers.apply({ show: slide.show, hide: slide.hide, highlight: slide.highlight });
    this._applyProgress(slide);
    this.renderer.activate(index);
    this._updatePager(index);
    this._highlightStop(index);
    this._frame(index, { animate });
    this._syncOverview();
    this.emitter.emit('slidechange', { index, slide });
  }

  on(evt, cb) { this.emitter.on(evt, cb); return this; }
  off(evt, cb) { this.emitter.off(evt, cb); return this; }
  goTo(i) {
    // Same slide again (e.g. "back to start" on slide 1): re-frame the camera.
    if (this._ready && clampIndex(i, this.config.slides.length) === this._index) { this._frame(this._index); return; }
    this.strategy.goTo?.(i);
  }
  next() { this.strategy.next?.(); }
  prev() { this.strategy.prev?.(); }
  get index() { return this._index; }
  get map() { return this.controller.map; }
  destroy() {
    this.strategy.stop?.();
    this._ro?.disconnect?.();
    this._mo?.disconnect?.();
    this._mq?.removeEventListener?.('change', this._watchTheme);
    if (this._onKey) this.container.removeEventListener('keydown', this._onKey);
    if (this._onWheel) this.container.removeEventListener('wheel', this._onWheel);
    for (const m of this._markers ?? []) m.marker.remove?.();
    this._overviewMap?.remove?.();
    this.controller.map?.remove?.();
  }
}
