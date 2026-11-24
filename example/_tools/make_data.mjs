// Dummy data + story configs for the example site. Deterministic (seeded), so
// re-running gives the same files. Everything here is made up.
//   node _tools/make_data.mjs      (from example/)
import { writeFileSync } from 'node:fs';

let seed = 20261124;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const round = (x, d = 4) => Number(x.toFixed(d));
const fc = (features) => ({ type: 'FeatureCollection', features });
const pt = (props, x, y) => ({ type: 'Feature', properties: props, geometry: { type: 'Point', coordinates: [round(x), round(y)] } });
const line = (props, coords) => ({ type: 'Feature', properties: props, geometry: { type: 'LineString', coordinates: coords.map(([x, y]) => [round(x), round(y)]) } });
const poly = (props, ring) => ({ type: 'Feature', properties: props, geometry: { type: 'Polygon', coordinates: [ring.map(([x, y]) => [round(x), round(y)])] } });
const out = (name, obj) => writeFileSync(`assets/data/${name}`, JSON.stringify(obj, null, 1));

/* 1. Districts: a 6 x 4 grid of made-up districts with a flood-risk % and tonnes. */
const districts = [];
for (let r = 0; r < 4; r++) {
  for (let c = 0; c < 6; c++) {
    const x0 = 111.6 + c * 0.55, y0 = 1.4 + r * 0.5;
    const id = `D${r}${c}`;
    const risk = r === 3 && c === 5 ? null : round(5 + rnd() * 70 * (1 - r * 0.18), 1); // one district has no data
    districts.push(poly({ id, name: `District ${String.fromCharCode(65 + r)}${c + 1}`, risk, tonnes: Math.round(200 + rnd() * 4800) },
      [[x0, y0], [x0 + 0.55, y0], [x0 + 0.55, y0 + 0.5], [x0, y0 + 0.5], [x0, y0]]));
  }
}
out('districts.geojson', fc(districts));
const worst = districts.filter((d) => d.properties.risk != null).sort((a, b) => b.properties.risk - a.properties.risk)[0].properties.id;

out('choropleth-story.json', {
  mode: 'deck', markers: 'none', map: { center: [113.2, 2.4], zoom: 7 },
  layers: [{ id: 'districts', type: 'polygon', source: { geojson: '/assets/data/districts.geojson' },
    style: { kind: 'choropleth', property: 'risk', classes: 5, method: 'jenks', palette: 'blues', unit: '%', title: 'Flood risk' } }],
  slides: [
    { position: 'full', kicker: 'Choropleth', title: 'Flood risk by district', camera: { fit: { layer: 'districts' } }, legend: ['districts'],
      html: '<p>Rates per area belong in a <strong>choropleth</strong>: classed colours (natural breaks here), light to dark, grey for no data. Never raw totals, or big districts look worse just for being big.</p>' },
    { kicker: 'Hotspot', title: 'The riskiest district', camera: { fit: { layer: 'districts', where: { id: worst } } }, legend: ['districts'],
      highlight: { layer: 'districts', filter: ['==', ['get', 'id'], worst] },
      chart: { title: 'Five riskiest districts', layer: 'districts', property: 'risk', top: 5, unit: '%', highlight: districts.find((d) => d.properties.id === worst).properties.name, source: 'made-up data' },
      html: '<p>Filtered to one district. The classes stay the same, so the colour keeps its meaning.</p>' }
  ]
});

/* 2. Towns with made-up populations: proportional symbols. */
const towns = [['Kuching', 110.35, 1.55, 570000], ['Sibu', 111.83, 2.29, 250000], ['Miri', 113.99, 4.4, 300000],
  ['Bintulu', 113.04, 3.17, 210000], ['Sri Aman', 111.46, 1.24, 60000], ['Kapit', 112.94, 2.02, 25000],
  ['Mukah', 112.09, 2.9, 45000], ['Limbang', 115.0, 4.75, 50000]];
out('towns.geojson', fc(towns.map(([name, x, y, pop]) => pt({ name, pop }, x, y))));
out('proportional-story.json', {
  mode: 'deck', markers: 'none', map: { center: [112.6, 3], zoom: 6 },
  layers: [{ id: 'towns', type: 'point', source: { geojson: '/assets/data/towns.geojson' },
    style: { kind: 'proportional', property: 'pop', maxRadius: 34, title: 'Population (dummy)' } }],
  slides: [
    { position: 'full', kicker: 'Proportional symbols', title: 'How big is each town?', camera: { fit: { layer: 'towns' } }, legend: ['towns'],
      html: '<p>Totals at places: circle <strong>area</strong> grows with the value (square-root scaling), so a town twice the size gets a circle twice the area, not twice the width. Big circles sit under small ones.</p>' },
    { kicker: 'Largest', title: 'Kuching', camera: { center: [110.35, 1.55], zoom: 8 }, stop: false, legend: ['towns'],
      chart: { title: 'Population (dummy)', layer: 'towns', property: 'pop', top: 4, highlight: 'Kuching' },
      html: '<p>The legend sizes match the map exactly.</p>' }
  ]
});

/* 3. Coffee supply chain: farms to roastery to cafes (flows + categories). */
const roastery = [113.99, 4.4];
const farms = [['Highland farm A', 115.45, 3.73, 42], ['Highland farm B', 115.6, 3.5, 25], ['Valley farm C', 114.8, 3.1, 14], ['Ridge farm D', 115.2, 4.0, 8]];
const cafes = [['Cafe Kuching', 110.35, 1.55, 30], ['Cafe Sibu', 111.83, 2.29, 18], ['Cafe Bintulu', 113.04, 3.17, 12], ['Cafe Miri', 114.0, 4.39, 22]];
// Gentle quadratic curve so flows sharing an end do not sit on top of each other.
const bend = (a, b, k = 0.15) => {
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1];
  const c = [mx - dy * k, my + dx * k];
  return Array.from({ length: 13 }, (_, i) => {
    const t = i / 12;
    return [(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]];
  });
};
out('coffee-sites.geojson', fc([
  ...farms.map(([name, x, y, t]) => pt({ name, role: 'farm', tonnes: t }, x, y)),
  pt({ name: 'Roastery', role: 'roastery', tonnes: 89 }, ...roastery),
  ...cafes.map(([name, x, y, t]) => pt({ name, role: 'cafe', tonnes: t }, x, y))
]));
out('coffee-flows.geojson', fc([
  ...farms.map(([name, x, y, t]) => line({ from: name, to: 'Roastery', stage: 'beans', tonnes: t }, bend([x, y], roastery))),
  ...cafes.map(([name, x, y, t]) => line({ from: 'Roastery', to: name, stage: 'roasted', tonnes: t }, bend(roastery, [x, y])))
]));
out('coffee-story.json', {
  mode: 'deck', markers: 'none', map: { center: [113, 3], zoom: 6 },
  layers: [
    { id: 'flows', type: 'line', source: { geojson: '/assets/data/coffee-flows.geojson' },
      style: { kind: 'flows', property: 'tonnes', maxWidth: 12, unit: 't', title: 'Coffee moved' },
      tooltip: '{from} → {to}<br><strong>{tonnes} t</strong>' },
    { id: 'sites', type: 'point', source: { geojson: '/assets/data/coffee-sites.geojson' },
      style: { kind: 'categories', property: 'role', palette: 'dark2', order: ['farm', 'roastery', 'cafe'],
        labels: { farm: 'Farm', roastery: 'Roastery', cafe: 'Cafe' }, title: 'Who' } }
  ],
  slides: [
    { position: 'full', kicker: 'Flows + categories', title: 'From farm to cup', camera: { fit: { layer: 'sites' } }, legend: ['sites', 'flows'],
      html: '<p>A made-up supply chain: four highland farms send beans to one roastery, which supplies four cafes. Line width is the tonnage.</p>' },
    { kicker: 'Stage 1', title: 'Beans leave the highlands', camera: { fit: { layer: 'flows', where: { stage: 'beans' } } }, legend: ['flows'],
      highlight: { layer: 'flows', filter: ['==', ['get', 'stage'], 'beans'] }, html: '<p>Highland farm A grows half the coffee.</p>',
      chart: { title: 'Beans per farm', unit: 't', highlight: 'Highland farm A', data: farms.map(([label, , , value]) => ({ label, value })) } },
    { kicker: 'Stage 2', title: 'Roasted, then shipped out', camera: { fit: { layer: 'flows', where: { stage: 'roasted' } } }, legend: ['flows'],
      highlight: { layer: 'flows', filter: ['==', ['get', 'stage'], 'roasted'] }, html: '<p>Kuching drinks the most, even from the farthest away.</p>' }
  ]
});

/* 4. Fire hotspots: clustered points for a heatmap. */
const clusters = [[113.3, 2.6, 160], [112.4, 2.2, 90], [114.2, 3.4, 60]];
const hot = [];
for (const [cx, cy, n] of clusters) {
  for (let i = 0; i < n; i++) {
    const a = rnd() * 6.283, r = Math.sqrt(rnd()) * 0.35;
    hot.push(pt({ frp: Math.round(5 + rnd() * 95) }, cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.8));
  }
}
out('hotspots.geojson', fc(hot));
out('heatmap-story.json', {
  mode: 'deck', markers: 'none', map: { center: [113.3, 2.8], zoom: 7 },
  layers: [{ id: 'fires', type: 'point', source: { geojson: '/assets/data/hotspots.geojson' },
    style: { kind: 'heatmap', property: 'frp', radius: 14, title: 'Fire hotspots (dummy)' } }],
  slides: [
    { position: 'full', kicker: 'Heatmap', title: 'Where the fires burn', camera: { fit: { layer: 'fires' } }, legend: ['fires'],
      html: '<p>Hundreds of hotspot points become a density surface, weighted by fire radiative power. Good for many events; bad for exact counts.</p>' },
    { kicker: 'Main cluster', title: 'The biggest burn', camera: { center: [113.3, 2.6], zoom: 9 }, stop: false, legend: ['fires'],
      html: '<p>Zoom in and the surface follows: the radius grows with zoom.</p>' }
  ]
});

/* 5. Wildlife sightings: categories. */
const species = ['Hornbill', 'Orangutan', 'Proboscis monkey', 'Clouded leopard'];
const sightings = [];
for (let i = 0; i < 60; i++) {
  sightings.push(pt({ species: species[Math.floor(rnd() ** 1.6 * species.length)] }, 111.2 + rnd() * 2.6, 1.3 + rnd() * 1.8));
}
out('sightings.geojson', fc(sightings));
out('categories-story.json', {
  mode: 'deck', markers: 'none', map: { center: [112.5, 2.2], zoom: 7 },
  layers: [{ id: 'sightings', type: 'point', source: { geojson: '/assets/data/sightings.geojson' },
    style: { kind: 'categories', property: 'species', palette: 'set2', title: 'Sightings (dummy)' }, tooltip: '{species}' }],
  slides: [
    { position: 'full', kicker: 'Categories', title: 'Who was seen where', camera: { fit: { layer: 'sightings' } }, legend: ['sightings'],
      html: '<p>Kinds, not amounts: a qualitative palette where no colour looks bigger than another.</p>' },
    { kicker: 'Filter', title: 'Only the leopards', camera: { fit: { layer: 'sightings', where: { species: 'Clouded leopard' } } }, legend: ['sightings'],
      highlight: { layer: 'sightings', filter: ['==', ['get', 'species'], 'Clouded leopard'] }, html: '<p>Rare ones, so a filter beats squinting.</p>' }
  ]
});

/* 6. Extrusion: the district tonnes in 3D. */
out('extrusion-story.json', {
  mode: 'deck', markers: 'none', map: { center: [113.2, 2.4], zoom: 7 },
  layers: [{ id: 'tonnes', type: 'polygon', source: { geojson: '/assets/data/districts.geojson' },
    style: { kind: 'extrusion', property: 'tonnes', heightScale: 8, classes: 4, method: 'quantile', unit: 't', title: 'Harvest (dummy)' } }],
  slides: [
    { position: 'full', kicker: '3D extrusion', title: 'The harvest as a skyline', camera: { center: [113.2, 2.1], zoom: 7.2, pitch: 55, bearing: -20 }, stop: false, legend: ['tonnes'],
      html: '<p>Height and colour both show the tonnes. Eye-catching, but height hides what is behind it: use it for a headline view, then go flat.</p>' },
    { kicker: 'Flat again', title: 'Same data, top-down', camera: { center: [113.2, 2.4], zoom: 7, pitch: 0 }, stop: false, legend: ['tonnes'],
      html: '<p>Readable, comparable, honest.</p>' }
  ]
});

/* 7. Track: a made-up hike as a line on a topographic basemap. */
const trk = [];
let x = 115.42, y = 3.72;
for (let i = 0; i < 40; i++) { x += 0.004 + rnd() * 0.004; y += (rnd() - 0.35) * 0.006; trk.push([x, y]); }
out('hike.geojson', fc([line({ name: 'Ridge walk' }, trk)]));
out('track-story.json', {
  mode: 'deck', markers: 'none', map: { basemap: 'opentopo', center: [115.5, 3.75], zoom: 11 },
  layers: [{ id: 'hike', type: 'line', source: { geojson: '/assets/data/hike.geojson' }, style: { kind: 'track', width: 3, legendLabel: 'Ridge walk' }, tooltip: '{name}' }],
  slides: [
    { position: 'full', kicker: 'Track', title: 'A day on the ridge', camera: { fit: { layer: 'hike' } }, legend: ['hike'],
      html: '<p>A recorded path as a cased line: readable on any basemap, here a topographic one.</p>' }
  ]
});

console.log('wrote data and stories');
