# jekyll-gis-blogger

Jekyll Liquid tags and hooks for GIS storytelling blogs — maps, GPX tracks,
StoryMapJS, lungkui.js scrollytelling, and sortable data tables. Zero runtime
dependencies beyond Jekyll.

## Installation

Add to your Jekyll site's `Gemfile`:

```ruby
gem "jekyll-gis-blogger"
```

Then add to `_config.yml`:

```yaml
plugins:
  - jekyll-gis-blogger
```

Then `bundle install`.

## Available Tags

### `{% map %}` — Leaflet single-marker map

```liquid
{% map lat="1.55" lon="110.33" %}
{% map lat="1.55" lon="110.33" zoom="14" caption="Kuching, Sarawak" height="500px" %}
{% map lat="1.55" lon="110.33" marker="false" %}
```

| Attribute | Default | Description |
|-----------|---------|-------------|
| `lat` | required | Latitude (decimal degrees) |
| `lon` | required | Longitude (decimal degrees) |
| `zoom` | `12` | Leaflet zoom level |
| `height` | `400px` | Map height (CSS) |
| `width` | `100%` | Map width (CSS) |
| `caption` | — | HTML `<figcaption>` below map |
| `basemap` | OSM | Tile URL template |
| `attribution` | OSM | Tile attribution HTML |
| `marker` | `true` | Set `"false"` to hide marker |

Leaflet CSS/JS loaded from CDN once per page.

### `{% storymap %}` — StoryMapJS embed

**GeoJSON (build-time transform):**

```liquid
{% storymap geojson="/assets/datasets/my_story.geojson" %}
```

**CSV (build-time transform):**

```liquid
{% storymap csv="/assets/datasets/my_story.csv" %}
```

**Raw StoryMapJS JSON:**

```liquid
{% storymap data="/assets/datasets/my_story.json" %}
```

Options: `height="600px" width="80%" options='{"calculate_zoom":false}'`

#### Authoring schema

| Field | Description |
|-------|-------------|
| `headline` | Slide title |
| `text` | Slide body (HTML allowed) |
| `media` | Image/video/embed URL |
| `caption` | Media caption |
| `credit` | Media credit |
| `name` | Marker label |
| `zoom` | Zoom level (integer) |
| `icon` | Marker image URL |
| `line` | `true`/`1` to draw connecting line |
| `date` | Optional date |
| `order` | Slide order (integer, default: file order) |
| `overview` | `1`/`true` for intro/title slide |
| `lat`, `lon` | CSV only; GeoJSON uses Point geometry |

#### Required assets

- `assets/css/storymap.css`
- `assets/js/storymap-min.js`

### `{% lungkui %}` — lungkui.js MapLibre scrollytelling

**GeoJSON (build-time transform):**

```liquid
{% lungkui geojson="/assets/datasets/my_story.geojson" %}
```

**Raw config JSON:**

```liquid
{% lungkui config="/assets/datasets/my_story.lungkui.json" %}
```

Options: `height="600px" width="100%" mode="deck"|"scroll" center="113.9,3.5" zoom="6" accent="#e4572e" basemap="..."`

Mode `deck` (default) uses arrow keys/click — no page scroll needed. Mode `scroll` drives the map from page scroll position.

#### Authoring schema

Same GeoJSON field names as storymap (`headline`, `text`, `media`, `caption`, `credit`, `zoom`, `order`, `overview`). Coordinates from Point geometry.

#### Required assets

- `assets/js/lungkui.js`
- `assets/css/lungkui.css`
- MapLibre GL JS loaded from CDN automatically

### `{% gpx_track %}` — GPX track + elevation profile

```liquid
{% gpx_track file="/assets/tracks/hike.gpx" %}
{% gpx_track file="/assets/tracks/hike.gpx" height="500px" color="#e4572e" caption="Day 1 survey" %}
{% gpx_track file="/assets/tracks/hike.gpx" profile="false" %}
```

| Attribute | Default | Description |
|-----------|---------|-------------|
| `file` | required | Path to GPX file |
| `height` | `400px` | Map height (CSS) |
| `width` | `100%` | Map width (CSS) |
| `color` | `#e4572e` | Track line color |
| `caption` | — | HTML `<figcaption>` |
| `profile` | `true` | Set `"false"` to hide elevation SVG |

Renders: Leaflet map with track polyline + start/end markers, inline SVG elevation profile, and stats (distance, gain, loss, elevation range).

### `{% datatable %}` — Sortable table from GeoJSON/CSV

```liquid
{% datatable src="/assets/data/sites.geojson" %}
{% datatable src="/assets/data/samples.csv" caption="Field samples" %}
{% datatable src="/assets/data/sites.geojson" cols="name,date,elevation" sort="date" %}
```

| Attribute | Default | Description |
|-----------|---------|-------------|
| `src` | required | Path to `.geojson` or `.csv` |
| `caption` | — | HTML `<caption>` |
| `cols` | all | Comma-separated columns to show |
| `sort` | first col | Column to pre-sort by |

Click column headers to sort ascending/descending. Client-side vanilla JS.

### Automatic: Responsive table wrapper

All `<table>` elements in posts/pages are automatically wrapped in
`<div class="table-wrapper">` for mobile scroll. Tables already inside
`.dt-scroll` or `.table-wrapper` are skipped.

## Requirements

- Jekyll ~> 4.0
- Ruby >= 2.7

## License

MIT — see [LICENSE](LICENSE).
