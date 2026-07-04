// lungkui.js — framework-agnostic scrollytelling map-story library on MapLibre GL JS.
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

/* ─────────────────────────────── config ─────────────────────────────── */

export const DEFAULT_BASEMAP = {
  type: 'xyz',
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '© OpenStreetMap contributors'
};

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
      basemap: map.basemap ?? DEFAULT_BASEMAP,
      center: map.center ?? [0, 0],
      zoom: map.zoom ?? 2,
      pitch: map.pitch ?? 0,
      bearing: map.bearing ?? 0,
      overviewZoom: map.overviewZoom ?? 5,
      // Story drives the camera; the map is display-only by default so wheel/drag
      // can't zoom it past the data extent. Set true to allow free interaction.
      interactive: map.interactive ?? false
    },
    theme: config.theme ?? {},
    layers: config.layers ?? [],
    controls: config.controls ?? true,
    slides: config.slides
  };
}

/* ──────────────────────────────── theme ─────────────────────────────── */

export const DEFAULT_THEME = {
  accent: '#e4572e',
  panelBg: '#ffffff',
  text: '#111111',
  font: 'Georgia, serif',
  panelWidth: '360px'
};

export function resolveTokens(paint = {}, theme = {}) {
  const merged = { ...DEFAULT_THEME, ...theme };
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

export function themeToCssVars(theme = {}) {
  const m = { ...DEFAULT_THEME, ...theme };
  return {
    '--lk-accent': m.accent,
    '--lk-panel-bg': m.panelBg,
    '--lk-text': m.text,
    '--lk-font': m.font,
    '--lk-panel-width': m.panelWidth
  };
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
  const attribution = basemap.attribution ?? '';
  const raster = (tiles) => ({
    kind: 'raster',
    source: { type: 'raster', tiles: [tiles], tileSize: 256, attribution },
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
  }

  async add(layers, theme, deps = {}) {
    const load = deps.loadSourceData ?? loadSourceData;
    for (const layer of layers) {
      const sourceSpec = await load(layer.source, deps);
      this.map.addSource(layer.id, sourceSpec);
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

/* ───────────────────────────── map controller ───────────────────────── */

export function slidesBounds(slides) {
  const centers = slides.map((s) => s.camera?.center).filter(Boolean);
  if (centers.length === 0) return null;
  const lngs = centers.map((c) => c[0]);
  const lats = centers.map((c) => c[1]);
  return [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]];
}

export function cameraOptions(camera) {
  return {
    center: camera.center,
    zoom: camera.zoom,
    pitch: camera.pitch ?? 0,
    bearing: camera.bearing ?? 0
  };
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

export class MapController {
  constructor(container, mapConfig, { maplibregl } = {}) {
    this.gl = maplibregl ?? globalThis.maplibregl;
    if (!this.gl) throw new Error('lungkui: MapLibre GL JS (maplibregl) is required but was not found');
    this.container = container;
    this.mapConfig = mapConfig;
    this._map = null;
  }

  init() {
    const bm = buildBasemap(this.mapConfig.basemap);
    const style = bm.kind === 'style'
      ? bm.style
      : { version: 8, sources: { 'lk-basemap': bm.source }, layers: [bm.layer] };

    this._map = new this.gl.Map({
      container: this.container,
      style,
      center: this.mapConfig.center,
      zoom: this.mapConfig.zoom,
      pitch: this.mapConfig.pitch ?? 0,
      bearing: this.mapConfig.bearing ?? 0
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
    return this._map;
  }

  flyTo(camera) {
    this._map.flyTo(cameraOptions(camera));
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
  constructor(slideEls, { IntersectionObserver } = {}) {
    this.els = slideEls;
    this.IO = IntersectionObserver ?? globalThis.IntersectionObserver;
    this._cb = () => {};
    this._index = 0;
    this._observer = null;
  }
  onChange(cb) { this._cb = cb; }
  start() {
    this._observer = new this.IO((entries) => {
      const active = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!active) return;
      const idx = Number(active.target.dataset.index);
      if (idx !== this._index) { this._index = idx; this._cb(idx); }
    }, { threshold: [0.25, 0.5, 0.75] });
    this.els.forEach((el) => this._observer.observe(el));
  }
  // Arrow/keyboard nav: scroll the target slide into view; the observer above
  // then fires onChange once it becomes the most-visible slide.
  goTo(i) {
    const idx = clampIndex(i, this.els.length);
    this.els[idx]?.scrollIntoView({ behavior: 'smooth' });
  }
  next() { this.goTo(this._index + 1); }
  prev() { this.goTo(this._index - 1); }
  get index() { return this._index; }
  stop() { this._observer?.disconnect(); }
}

/* ──────────────────────────── slide renderer ────────────────────────── */

export function slidePanelHTML(slide, index) {
  const position = slide.position ?? 'center';
  const title = slide.title ? `<h2>${escapeHtml(slide.title)}</h2>` : '';
  let media = '';
  if (slide.media?.url) {
    const cap = escapeHtml(slide.media.caption ?? '');
    const cred = slide.media.credit ? ` <span class="lk-credit">${escapeHtml(slide.media.credit)}</span>` : '';
    media = `<figure class="lk-media"><img src="${escapeHtml(slide.media.url)}" alt="${cap}">` +
            `<figcaption>${cap}${cred}</figcaption></figure>`;
  }
  return `<section class="lk-slide lk-slide--${position}" data-index="${index}">` +
         `<div class="lk-slide__panel">${title}${slide.html ?? ''}${media}</div></section>`;
}

export class SlideRenderer {
  constructor(container, { document } = {}) {
    this.container = container;
    this.doc = document ?? globalThis.document;
    this.els = [];
  }
  render(slides) {
    this.container.innerHTML = slides.map((s, i) => slidePanelHTML(s, i)).join('');
    this.els = Array.from(this.container.querySelectorAll('.lk-slide'));
    return this.els;
  }
  activate(index) {
    this.els.forEach((el, i) => el.classList.toggle('is-active', i === index));
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

export class Lungkui {
  constructor(target, config, deps = {}) {
    this.deps = deps;
    this.config = normalizeConfig(config);
    this.emitter = createEmitter();
    this.container = resolveElement(target, deps.document);
    const doc = deps.document ?? globalThis.document;

    // Apply theme tokens as CSS variables on the container.
    const vars = themeToCssVars(this.config.theme);
    for (const [k, v] of Object.entries(vars)) this.container.style.setProperty(k, v);
    if (this.config.mode === 'deck') this.container.classList.add('lk-deck');

    // Map and slides need separate child elements: SlideRenderer.render wipes
    // its container's innerHTML, which would destroy the MapLibre canvas if shared.
    const mapEl = doc.createElement('div');
    mapEl.className = 'lk-map';
    const slidesEl = doc.createElement('div');
    slidesEl.className = 'lk-slides';
    this.container.append(mapEl, slidesEl);

    this.controller = new MapController(mapEl, this.config.map, { maplibregl: deps.maplibregl });
    this.layers = new LayerManager(this.controller.init());
    this.renderer = new SlideRenderer(slidesEl, { document: deps.document });
    const els = this.renderer.render(this.config.slides);

    this._doc = doc;
    this._buildStrategy(els);
    this._buildControls(doc);
    this._buildOverview(doc);
    this._wire();
  }

  _buildControls(doc) {
    if (this.config.controls === false) return;

    // Top toolbar: overview toggle + back to beginning (StoryMapJS-style).
    const bar = doc.createElement('div');
    bar.className = 'lk-toolbar';
    const mkBtn = (label, fn) => {
      const b = doc.createElement('button');
      b.type = 'button';
      b.className = 'lk-toolbar__btn';
      b.textContent = label;
      b.addEventListener('click', fn);
      return b;
    };
    this._overviewBtn = mkBtn('Map Overview', () => this._toggleOverview());
    bar.append(this._overviewBtn, mkBtn('Back to Beginning ↩', () => { this._closeOverview(); this.goTo(0); }));
    this.container.append(bar);

    // Edge arrows.
    const nav = doc.createElement('div');
    nav.className = 'lk-controls';
    const mkArrow = (dir, label, glyph, fn) => {
      const b = doc.createElement('button');
      b.type = 'button';
      b.className = `lk-arrow lk-arrow--${dir}`;
      b.setAttribute('aria-label', label);
      b.textContent = glyph;
      b.addEventListener('click', fn);
      return b;
    };
    nav.append(
      mkArrow('prev', 'Previous slide', '❮', () => this.prev()),
      mkArrow('next', 'Next slide', '❯', () => this.next())
    );
    this.container.append(nav);

    this._win = doc.defaultView ?? globalThis;
    this._onKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') this.next();
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') this.prev();
    };
    this._win.addEventListener('keydown', this._onKey);

    // Wheel/trackpad advances slides in deck mode (scroll mode scrolls natively).
    if (this.config.mode === 'deck') {
      let locked = false;
      this._onWheel = (e) => {
        e.preventDefault();
        if (locked) return;
        locked = true;
        setTimeout(() => { locked = false; }, 600);
        if (e.deltaY > 0) this.next(); else this.prev();
      };
      this.container.addEventListener('wheel', this._onWheel, { passive: false });
    }
  }

  _buildOverview(doc) {
    const el = doc.createElement('div');
    el.className = 'lk-overview';
    el.style.display = 'none';
    this.container.append(el);
    this._overviewEl = el;
  }

  _toggleOverview() {
    const el = this._overviewEl;
    if (!el) return;
    if (el.style.display !== 'none') { this._closeOverview(); return; }
    el.style.display = 'block';
    this._overviewBtn?.classList.add('is-active');
    if (!this._overviewMap) this._initOverviewMap();
    else { this._overviewMap.resize(); this._syncOverview(); }
  }

  _closeOverview() {
    const el = this._overviewEl;
    if (!el || el.style.display === 'none') return;
    el.style.display = 'none';
    this._overviewBtn?.classList.remove('is-active');
  }

  _initOverviewMap() {
    const gl = this.controller.gl;
    if (!gl?.Map) return;
    const bm = buildBasemap(this.config.map.basemap);
    const style = bm.kind === 'style'
      ? bm.style
      : { version: 8, sources: { 'lk-basemap': bm.source }, layers: [bm.layer] };
    this._overviewMap = new gl.Map({
      container: this._overviewEl, style, interactive: false, attributionControl: false
    });
    this._overviewMap.on('load', () => { this._overviewReady = true; this._syncOverview(); });
  }

  // Locator inset: centre on the current point at a wide zoom with a single
  // marker, matching StoryMapJS. Recentres as the story advances.
  _syncOverview() {
    const gl = this.controller.gl;
    if (!this._overviewMap || !this._overviewReady || this._overviewEl?.style.display === 'none') return;
    const center = this.config.slides[this._index ?? 0]?.camera?.center;
    if (!center) return;
    this._overviewMap.jumpTo({ center, zoom: this.config.map.overviewZoom ?? 5 });
    if (!gl?.Marker) return;
    const color = this.config.theme.accent ?? DEFAULT_THEME.accent;
    if (!this._overviewMarker) this._overviewMarker = new gl.Marker({ color });
    this._overviewMarker.setLngLat(center).addTo(this._overviewMap);
  }

  _updateMarker(slide) {
    const gl = this.controller.gl;
    if (!gl?.Marker || !slide?.camera?.center) return;
    const color = this.config.theme.accent ?? DEFAULT_THEME.accent;
    if (!this._marker) this._marker = new gl.Marker({ color });
    this._marker.setLngLat(slide.camera.center).addTo(this.controller.map);
  }

  _buildStrategy(els) {
    this.strategy = this.config.mode === 'deck'
      ? new DeckStrategy(this.config.slides.length)
      : new ScrollStrategy(els, { IntersectionObserver: this.deps.IntersectionObserver });
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
        // Surface source/fetch failures without aborting the story (§8).
        this.emitter.emit('error', err);
      }
      this._wireFeatureClicks();
      this.strategy.start?.();
      this._activate(0);
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

  _activate(index) {
    const slide = this.config.slides[index];
    if (!slide) return;
    this._index = index;
    this.controller.flyTo(slide.camera);
    this.layers.apply({ show: slide.show, hide: slide.hide, highlight: slide.highlight });
    this.renderer.activate(index);
    this._updateMarker(slide);
    this._syncOverview();
    this.emitter.emit('slidechange', { index, slide });
  }

  on(evt, cb) { this.emitter.on(evt, cb); return this; }
  off(evt, cb) { this.emitter.off(evt, cb); return this; }
  goTo(i) { this.strategy.goTo?.(i); }
  next() { this.strategy.next?.(); }
  prev() { this.strategy.prev?.(); }
  get map() { return this.controller.map; }
  destroy() {
    this.strategy.stop?.();
    if (this._onKey) this._win?.removeEventListener('keydown', this._onKey);
    if (this._onWheel) this.container.removeEventListener('wheel', this._onWheel);
    this._overviewMap?.remove?.();
    this.controller.map?.remove?.();
  }
}
