# jekyll-gis-blogger — Gem Design

**Date:** 2026-07-04
**Status:** Approved

## Purpose

Centralize the GIS/storymapping Jekyll plugins from `wslerry.github.io/_plugins`
into a reusable Ruby gem. One `require` activates all Liquid tags and hooks.

## Scope

Six plugins ported from the blog's `_plugins/`:

| Source file | Gem target | Tag / Hook |
|---|---|---|
| `storymap.rb` | `tags/storymap.rb` | `{% storymap %}` — StoryMapJS from GeoJSON/CSV/URL |
| `lungkui-storymap.rb` | `tags/lungkui.rb` | `{% lungkui %}` — lungkui.js MapLibre scrollytelling |
| `map.rb` | `tags/map.rb` | `{% map %}` — Single-marker Leaflet map |
| `gpx_track.rb` | `tags/gpx_track.rb` | `{% gpx_track %}` — GPX track + elevation profile |
| `datatable.rb` | `tags/datatable.rb` | `{% datatable %}` — Sortable table from GeoJSON/CSV |
| `table.rb` | `hooks/table_wrapper.rb` | `post_render` hook — responsive `<table>` wrapper |

**Excluded:** `baseurl.rb`, `generate_categories.rb` (general blogging, not GIS).

Shared utility (`lib/utils.rb`) becomes `jekyll-gis-blogger/utils.rb`.

## Architecture

```
gis-blogger/
├── lib/
│   ├── jekyll-gis-blogger.rb
│   └── jekyll-gis-blogger/
│       ├── utils.rb
│       ├── tags/
│       │   ├── storymap.rb
│       │   ├── lungkui.rb
│       │   ├── map.rb
│       │   ├── gpx_track.rb
│       │   └── datatable.rb
│       └── hooks/
│           └── table_wrapper.rb
├── jekyll-gis-blogger.gemspec
├── Gemfile
├── README.md
└── LICENSE
```

## Key Decisions

1. **Single require activates everything.** User adds `jekyll-gis-blogger` to
   `_config.yml` `plugins:` list. No per-tag opt-in.

2. **Zero external dependencies.** Stdlib only (`json`, `csv`, `rexml`).
   `jekyll ~> 4.0` is the sole runtime dependency.

3. **Namespaced under `Jekyll::GisBlogger::`.** Tags live in
   `Jekyll::GisBlogger::Tags`, hook in `Jekyll::GisBlogger::Hooks`.
   Registered into Liquid globally so templates see `{% storymap %}` etc.

4. **Assets NOT bundled.** CSS/JS (Leaflet CDN, storymap.js, lungkui.js,
   storymap.css, lungkui.css) remain the user's responsibility per site.
   README documents the required asset paths. This avoids an asset pipeline
   and keeps the gem pure Ruby.

5. **Ruby >= 2.7** (Jekyll 4.x minimum). Tested against Ruby 3.4.

6. **`SharedUtils` becomes `Jekyll::GisBlogger::Utils`** — a proper module,
   required by `jekyll-gis-blogger.rb` before tags load.

## Usage

```ruby
# Gemfile
gem "jekyll-gis-blogger", path: "../gis-blogger"  # local dev
# gem "jekyll-gis-blogger"                        # after publishing

# _config.yml
plugins:
  - jekyll-gis-blogger
```

All tags are available in Liquid with no further configuration.

## Migration Path (wslerry.github.io)

1. Remove 6 .rb files from `_plugins/`
2. Add `jekyll-gis-blogger` to `Gemfile` and `_config.yml` `plugins:`
3. Tags keep same names, no post content changes needed

## Non-Goals

- Asset bundling / pipeline
- Configuration UI (everything is tag attributes)
- Publishing to RubyGems in this iteration (local `path:` gem first)
