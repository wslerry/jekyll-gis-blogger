// lungkui.js — framework-agnostic map-story library on MapLibre GL JS.
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
      scale: map.scale ?? true
    },
    theme: config.theme ?? {},
    layers: config.layers ?? [],
    controls: config.controls ?? true,
    // Numbered stop markers for slides with a point camera ('numbered' | 'dot' | 'none').
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
  }

  async add(layers, theme, deps = {}) {
    const load = deps.loadSourceData ?? loadSourceData;
    for (const layer of layers) {
      const sourceSpec = await load(layer.source, deps);
      this.map.addSource(layer.id, sourceSpec);
      this.data[layer.id] = sourceSpec.data;
      this.map.addLayer(buildMapLayer(layer, theme));
      this.layerIds.push(layer.id);
    }
  }

  apply({ show = [], hide = [], highlight = null } = {}) {
    for (const id of show) {
      if (this.map.getLayer(id)) this.map.setLayoutProperty(id, 'visibility', 'visible');
    }
    for (const id of hide) {
      if (this.map.getLayer(id)) this.map.setLayoutProperty(id, 'visibility', 'none');
    }
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

// Small key for the panel: [{ type: fill|line|point, color, label }]. Colours
// may be theme tokens ('@accent').
export function legendHTML(items = [], theme = {}) {
  if (!items.length) return '';
  const t = resolveTheme(theme);
  const color = (c) => (typeof c === 'string' && c.startsWith('@') ? t[c.slice(1)] ?? c : c ?? t.accent);
  const rows = items.map((it) => {
    const type = ['fill', 'line', 'point'].includes(it.type) ? it.type : 'point';
    return `<li><span class="lk-swatch lk-swatch--${type}" style="--lk-swatch:${escapeHtml(color(it.color))}"></span>${escapeHtml(it.label ?? '')}</li>`;
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
    if (this.gl.AttributionControl) this._map.addControl?.(new this.gl.AttributionControl({ compact: true }), 'bottom-right');
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
         `<div class="lk-slide__panel"><div class="lk-slide__body">${kicker}${title}${media}${slide.html ?? ''}${legendHTML(slide.legend, theme)}</div></div></section>`;
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
      this._overviewReady = true;
      this._syncOverview();
    });
  }

  _syncOverview() {
    const m = this._overviewMap;
    if (!m || !this._overviewReady || this._overviewEl?.hidden) return;
    const b = slidesBounds(this.config.slides);
    if (b) m.fitBounds(b, { padding: 18, animate: false, maxZoom: this.config.map.overviewZoom + 3 });
    m.setFilter('lk-ov-current', ['==', ['get', 'index'], this._index]);
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
          fetch: this.deps.fetch, loadSourceData: this.deps.loadSourceData
        });
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
    for (const layer of this.config.layers) {
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
