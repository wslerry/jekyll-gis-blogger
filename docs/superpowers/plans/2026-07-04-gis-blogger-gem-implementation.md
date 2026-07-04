# jekyll-gis-blogger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package 6 GIS Jekyll plugins into a reusable `jekyll-gis-blogger` gem.

**Architecture:** Single-entry-point gem (`require "jekyll-gis-blogger"` activates all tags/hooks). Tags namespaced under `Jekyll::GisBlogger::Tags`, registered into Liquid globally. Shared utils extracted to `Jekyll::GisBlogger::Utils`. Zero external dependencies, stdlib only.

**Tech Stack:** Ruby 3.4.10 (mise), Jekyll ~> 4.0, Bundler 4.x, stdlib only (`json`, `csv`, `rexml`)

## Global Constraints

- Ruby >= 2.7 (Jekyll 4.x minimum), test target: Ruby 3.4.10
- Zero runtime dependencies beyond `jekyll ~> 4.0`
- No asset bundling — CSS/JS remain per-site user responsibility
- All tags keep current Liquid names (`storymap`, `lungkui`, `map`, `gpx_track`, `datatable`)
- Namespace: `Jekyll::GisBlogger::` for modules, tags registered into Liquid root
- Mise Ruby path: `/home/lerry/.local/share/mise/installs/ruby/3/bin/`
- Repo root: `/home/lerry/Workspace/Websites/gis-blogger/`
- Source plugins: `/home/lerry/Workspace/Websites/wslerry.github.io/_plugins/`

---

## File Map

```
gis-blogger/
├── Gemfile                          # [Task 1] Development deps
├── jekyll-gis-blogger.gemspec       # [Task 1] Gem metadata
├── LICENSE                          # [Task 11] MIT
├── README.md                        # [Task 12] Full docs
├── lib/
│   ├── jekyll-gis-blogger.rb        # [Task 1] Entry point, requires all
│   └── jekyll-gis-blogger/
│       ├── utils.rb                 # [Task 3] SharedUtils → Utils module
│       └── tags/
│           ├── storymap.rb          # [Task 4] {% storymap %}
│           ├── lungkui.rb           # [Task 5] {% lungkui %}
│           ├── map.rb               # [Task 6] {% map %}
│           ├── gpx_track.rb         # [Task 7] {% gpx_track %}
│           └── datatable.rb         # [Task 8] {% datatable %}
│       └── hooks/
│           └── table_wrapper.rb     # [Task 9] post_render table wrapper
└── test/
    └── test_utils.rb                # [Task 10] Smoke tests
```

---

### Task 1: Gem scaffold (gemspec, Gemfile, entry point, directories)

**Files:**
- Create: `Gemfile`
- Create: `jekyll-gis-blogger.gemspec`
- Create: `lib/jekyll-gis-blogger.rb`
- Create directories: `lib/jekyll-gis-blogger/tags/`, `lib/jekyll-gis-blogger/hooks/`

**Interfaces:**
- Produces: `Jekyll::GisBlogger` module, empty `Jekyll::GisBlogger::Utils`, `Jekyll::GisBlogger::Tags`, `Jekyll::GisBlogger::Hooks`

- [ ] **Step 1: Create directory structure**

```bash
cd /home/lerry/Workspace/Websites/gis-blogger
mkdir -p lib/jekyll-gis-blogger/tags
mkdir -p lib/jekyll-gis-blogger/hooks
mkdir -p test
```

- [ ] **Step 2: Write gemspec**

File: `jekyll-gis-blogger.gemspec`

```ruby
# frozen_string_literal: true

Gem::Specification.new do |spec|
  spec.name          = "jekyll-gis-blogger"
  spec.version       = "0.1.0"
  spec.authors       = ["Lerry William Seling"]
  spec.email         = ["wslerry@gmail.com"]
  spec.summary       = "Jekyll Liquid tags for GIS storytelling — maps, GPX tracks, StoryMapJS, lungkui.js, and sortable data tables"
  spec.description   = "A collection of Jekyll Liquid tags and hooks for GIS blogging: " \
                       "Leaflet maps, GPX track display with elevation profiles, " \
                       "StoryMapJS and lungkui.js story-map embeds, and sortable " \
                       "HTML tables from GeoJSON/CSV. Zero runtime dependencies beyond Jekyll."
  spec.homepage      = "https://github.com/wslerry/jekyll-gis-blogger"
  spec.license       = "MIT"

  spec.required_ruby_version = ">= 2.7.0"

  spec.metadata["homepage_uri"]    = spec.homepage
  spec.metadata["source_code_uri"] = spec.homepage

  spec.files = Dir["lib/**/*.rb", "LICENSE", "README.md"]

  spec.add_dependency "jekyll", "~> 4.0"
end
```

- [ ] **Step 3: Write Gemfile**

File: `Gemfile`

```ruby
# frozen_string_literal: true

source "https://rubygems.org"

gemspec

gem "rake", "~> 13.0"
gem "minitest", "~> 5.0"
```

- [ ] **Step 4: Write entry point**

File: `lib/jekyll-gis-blogger.rb`

```ruby
# frozen_string_literal: true

require "jekyll"

module Jekyll
  module GisBlogger
  end
end

require_relative "jekyll-gis-blogger/utils"

require_relative "jekyll-gis-blogger/tags/storymap"
require_relative "jekyll-gis-blogger/tags/lungkui"
require_relative "jekyll-gis-blogger/tags/map"
require_relative "jekyll-gis-blogger/tags/gpx_track"
require_relative "jekyll-gis-blogger/tags/datatable"
require_relative "jekyll-gis-blogger/hooks/table_wrapper"
```

- [ ] **Step 5: Install dependencies**

```bash
cd /home/lerry/Workspace/Websites/gis-blogger
/home/lerry/.local/share/mise/installs/ruby/3/bin/bundle install
```

Expected: Bundle completes successfully.

- [ ] **Step 6: Commit**

```bash
cd /home/lerry/Workspace/Websites/gis-blogger
git init
git add -A
git commit -m "feat: scaffold gem structure"
```

---

### Task 2: Install mise local Ruby and verify Jekyll dev environment

**Files:**
- Create: `.ruby-version` (mise)
- Create: `.mise.toml` (optional, for mise config)

**Interfaces:**
- Produces: Mise-configured Ruby 3 for the project directory

- [ ] **Step 1: Set mise local Ruby**

```bash
cd /home/lerry/Workspace/Websites/gis-blogger
echo "3" > .ruby-version
```

- [ ] **Step 2: Verify Ruby resolves correctly**

```bash
cd /home/lerry/Workspace/Websites/gis-blogger
/home/lerry/.local/share/mise/installs/ruby/3/bin/ruby --version
```

Expected: `ruby 3.4.10 ...`

- [ ] **Step 3: Verify gem builds**

```bash
cd /home/lerry/Workspace/Websites/gis-blogger
/home/lerry/.local/share/mise/installs/ruby/3/bin/gem build jekyll-gis-blogger.gemspec
```

Expected: `jekyll-gis-blogger-0.1.0.gem` created. Delete it after — `rm *.gem`.

- [ ] **Step 4: Commit**

```bash
git add .ruby-version
git commit -m "chore: set mise Ruby 3 for project"
```

---

### Task 3: Port utils.rb → Jekyll::GisBlogger::Utils

**Files:**
- Create: `lib/jekyll-gis-blogger/utils.rb`
- Source: `/home/lerry/Workspace/Websites/wslerry.github.io/_plugins/lib/utils.rb`

**Interfaces:**
- Produces: `Jekyll::GisBlogger::Utils` module with `ATTR_RE`, `read_source`, `inline`, `absolute?`, `order_of`, `truthy`, `present?`

- [ ] **Step 1: Write utils.rb with proper namespace**

File: `lib/jekyll-gis-blogger/utils.rb`

```ruby
# frozen_string_literal: true

module Jekyll
  module GisBlogger
    # Shared helpers for all GIS Blogger Liquid tag plugins.
    module Utils
      ATTR_RE = /(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)')/

      def read_source(site, path)
        File.read(site.in_source_dir(path))
      rescue StandardError => e
        Jekyll.logger.warn "GisBlogger:", "Cannot read #{path}: #{e.message}"
        ""
      end

      def inline(object)
        JSON.generate(object).gsub("</", '<\/')
      end

      def absolute?(path)
        path.start_with?("http://", "https://", "//")
      end

      def order_of(props, index)
        present?(props["order"]) ? props["order"].to_f : index.to_f
      end

      def truthy(v)
        return v if v == true || v == false
        %w[1 true yes y].include?(v.to_s.strip.downcase)
      end

      def present?(v)
        !v.nil? && v.to_s.strip != ""
      end
    end
  end
end
```

- [ ] **Step 2: Verify file parses**

```bash
/home/lerry/.local/share/mise/installs/ruby/3/bin/ruby -c lib/jekyll-gis-blogger/utils.rb
```

Expected: `Syntax OK`

- [ ] **Step 3: Commit**

```bash
git add lib/jekyll-gis-blogger/utils.rb
git commit -m "feat: add Utils module"
```

---

### Task 4: Port storymap.rb → tags/storymap.rb

**Files:**
- Create: `lib/jekyll-gis-blogger/tags/storymap.rb`
- Source: `/home/lerry/Workspace/Websites/wslerry.github.io/_plugins/storymap.rb`

**Interfaces:**
- Consumes: `Jekyll::GisBlogger::Utils`
- Produces: `Jekyll::GisBlogger::Tags::StorymapTag`, registers Liquid tag `storymap`

- [ ] **Step 1: Write storymap.rb with namespace migration**

File: `lib/jekyll-gis-blogger/tags/storymap.rb`

```ruby
# frozen_string_literal: true

require "json"
require "csv"

module Jekyll
  module GisBlogger
    module Tags
      class StorymapTag < Liquid::Tag
        include Jekyll::GisBlogger::Utils

        DEFAULTS = { "height" => "480px", "width" => "100%", "options" => "{}" }.freeze

        def initialize(tag_name, markup, tokens)
          super
          @attrs = markup.scan(ATTR_RE).each_with_object({}) do |(k, dq, sq), h|
            h[k] = dq || sq
          end
        end

        def render(context)
          site    = context.registers[:site]
          baseurl = site.config["baseurl"].to_s.chomp("/")
          page    = context.registers[:page]

          height  = @attrs["height"]  || DEFAULTS["height"]
          width   = @attrs["width"]   || DEFAULTS["width"]
          options = @attrs["options"] || DEFAULTS["options"]

          count = page["storymap_map_count"] || 0
          page["storymap_map_count"] = count + 1
          div_id = "storymap-map-#{count}"
          js_var = "storymapMap#{count}"

          data_arg = build_data_arg(site, baseurl)
          assets   = inject_assets_once(page, baseurl)

          [
            assets,
            "<div id=\"#{div_id}\" style=\"width: #{width}; height: #{height};\"></div>",
            "<script>",
            "var #{js_var} = new VCO.StoryMap('##{div_id}', #{data_arg}, #{options});",
            "window.addEventListener('resize', function(){ #{js_var}.updateDisplay(); });",
            "</script>"
          ].join("\n")
        end

        private

        def build_data_arg(site, baseurl)
          if @attrs["geojson"]
            inline(build_object(slides_from_geojson(read_source(site, @attrs["geojson"]))))
          elsif @attrs["csv"]
            inline(build_object(slides_from_csv(read_source(site, @attrs["csv"]))))
          elsif @attrs["data"]
            url = absolute?(@attrs["data"]) ? @attrs["data"] : "#{baseurl}#{@attrs['data']}"
            "'#{url}'"
          else
            raise ArgumentError, "{% storymap %} needs one of: data= | geojson= | csv="
          end
        end

        def build_object(slides)
          { "storymap" => { "slides" => slides } }
        end

        def slides_from_geojson(text)
          features = JSON.parse(text)["features"] || []
          indexed = features.each_with_index.map do |f, i|
            props  = f["properties"] || {}
            coords = (f["geometry"] || {})["coordinates"] || []
            [build_slide(props, coords[1], coords[0]), order_of(props, i), i]
          end
          sort_slides(indexed)
        rescue JSON::ParserError => e
          Jekyll.logger.warn "storymap:", "Invalid GeoJSON: #{e.message}"
          []
        end

        def slides_from_csv(text)
          indexed = CSV.parse(text, headers: true).each_with_index.map do |row, i|
            props = row.to_h
            lat = (props["lat"] || props["latitude"]).to_f
            lon = (props["lon"] || props["lng"] || props["longitude"]).to_f
            [build_slide(props, lat, lon), order_of(props, i), i]
          end
          sort_slides(indexed)
        rescue CSV::MalformedCSVError => e
          Jekyll.logger.warn "storymap:", "Invalid CSV: #{e.message}"
          []
        end

        def build_slide(props, lat, lon)
          text  = { "headline" => props["headline"].to_s, "text" => props["text"].to_s }
          media = { "url" => props["media"].to_s, "caption" => props["caption"].to_s, "credit" => props["credit"].to_s }

          if truthy(props["overview"]) || props["type"].to_s == "overview"
            slide = { "type" => "overview", "text" => text, "media" => media }
          else
            slide = { "location" => { "lat" => lat, "lon" => lon } }
            slide["name"] = props["name"].to_s   if present?(props["name"])
            slide["zoom"] = props["zoom"].to_i    if present?(props["zoom"])
            slide["icon"] = props["icon"].to_s    if present?(props["icon"])
            slide["line"] = truthy(props["line"]) if present?(props["line"])
            slide["text"]  = text
            slide["media"] = media
          end
          slide["date"] = props["date"].to_s if present?(props["date"])
          slide
        end

        def sort_slides(indexed)
          indexed.sort_by { |slide, order, i| [slide["type"] == "overview" ? 0 : 1, order, i] }
                 .map     { |slide, _order, _i| slide }
        end

        def inject_assets_once(page, baseurl)
          return "" if page["storymap_assets_injected"]

          page["storymap_assets_injected"] = true
          [
            "<link rel=\"stylesheet\" href=\"#{baseurl}/assets/css/storymap.css\">",
            "<script type=\"text/javascript\" src=\"#{baseurl}/assets/js/storymap-min.js\"></script>"
          ].join("\n")
        end
      end
    end
  end
end

Liquid::Template.register_tag("storymap", Jekyll::GisBlogger::Tags::StorymapTag)
```

- [ ] **Step 2: Verify file parses**

```bash
/home/lerry/.local/share/mise/installs/ruby/3/bin/ruby -c lib/jekyll-gis-blogger/tags/storymap.rb
```

Expected: `Syntax OK`

- [ ] **Step 3: Commit**

```bash
git add lib/jekyll-gis-blogger/tags/storymap.rb
git commit -m "feat: add storymap tag"
```

---

### Task 5: Port lungkui-storymap.rb → tags/lungkui.rb

**Files:**
- Create: `lib/jekyll-gis-blogger/tags/lungkui.rb`
- Source: `/home/lerry/Workspace/Websites/wslerry.github.io/_plugins/lungkui-storymap.rb`

**Interfaces:**
- Consumes: `Jekyll::GisBlogger::Utils`
- Produces: `Jekyll::GisBlogger::Tags::LungkuiTag`, registers Liquid tag `lungkui`

- [ ] **Step 1: Write lungkui.rb**

File: `lib/jekyll-gis-blogger/tags/lungkui.rb`

```ruby
# frozen_string_literal: true

require "json"

module Jekyll
  module GisBlogger
    module Tags
      class LungkuiTag < Liquid::Tag
        include Jekyll::GisBlogger::Utils

        DEFAULTS = {
          "height"  => "600px",
          "width"   => "100%",
          "mode"    => "deck",
          "zoom"    => "6",
          "accent"  => "#e4572e",
          "basemap" => "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        }.freeze

        MAPLIBRE_CSS = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css"
        MAPLIBRE_JS  = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"

        IMAGE_RE = /\.(png|jpe?g|gif|webp|svg|avif)(\?|#|$)/i

        def initialize(tag_name, markup, tokens)
          super
          @attrs = markup.scan(ATTR_RE).each_with_object({}) do |(k, dq, sq), h|
            h[k] = dq || sq
          end
        end

        def render(context)
          site    = context.registers[:site]
          baseurl = site.config["baseurl"].to_s.chomp("/")
          page    = context.registers[:page]

          height = @attrs["height"] || DEFAULTS["height"]
          width  = @attrs["width"]  || DEFAULTS["width"]

          count = page["lungkui_map_count"] || 0
          page["lungkui_map_count"] = count + 1
          div_id = "lungkui-map-#{count}"

          config_js = build_config_arg(site, baseurl)
          assets    = inject_assets_once(page, baseurl)

          [
            assets,
            %(<div id="#{div_id}" class="lk-root lk-embed" ) +
              %(style="position:relative;width:#{width};height:#{height};"></div>),
            %(<script type="module">),
            %(import { Lungkui } from '#{baseurl}/assets/js/lungkui.js';),
            %(new Lungkui('##{div_id}', #{config_js});),
            %(</script>)
          ].join("\n")
        end

        private

        def build_config_arg(site, baseurl)
          if @attrs["config"]
            inline(parse_config(site, @attrs["config"]))
          elsif @attrs["geojson"]
            inline(build_config(site, baseurl))
          else
            raise ArgumentError, "{% lungkui %} needs one of: geojson= | config="
          end
        end

        def build_config(site, baseurl)
          geojson_path = @attrs["geojson"]
          slides = slides_from_geojson(read_source(site, geojson_path))

          geojson_url = absolute?(geojson_path) ? geojson_path : "#{baseurl}#{geojson_path}"
          center = @attrs["center"] ? @attrs["center"].split(",").map(&:to_f) : default_center(slides)

          {
            "mode"  => @attrs["mode"] || DEFAULTS["mode"],
            "map"   => {
              "basemap" => { "type" => "xyz", "url" => (@attrs["basemap"] || DEFAULTS["basemap"]),
                             "attribution" => "© OpenStreetMap contributors" },
              "center"  => center,
              "zoom"    => (@attrs["zoom"] || DEFAULTS["zoom"]).to_f
            },
            "theme" => { "accent" => (@attrs["accent"] || DEFAULTS["accent"]) },
            "layers" => [{
              "id" => "trail", "type" => "circle",
              "source" => { "geojson" => geojson_url },
              "paint"  => { "circle-radius" => 7, "circle-color" => "@accent",
                            "circle-stroke-color" => "#fff", "circle-stroke-width" => 2 }
            }],
            "slides" => slides
          }
        end

        def slides_from_geojson(text)
          features = JSON.parse(text)["features"] || []
          indexed = features.each_with_index.map do |f, i|
            props  = f["properties"] || {}
            coords = (f["geometry"] || {})["coordinates"] || []
            [props, coords[0], coords[1], order_of(props, i), i]
          end
          ordered = indexed.sort_by { |props, _lon, _lat, order, i| [overview?(props) ? 0 : 1, order, i] }
          ordered.each_with_index.map { |(props, lon, lat, _o, _i), pos| build_slide(props, lon, lat, pos) }
        rescue JSON::ParserError => e
          Jekyll.logger.warn "lungkui:", "Invalid GeoJSON: #{e.message}"
          []
        end

        def build_slide(props, lon, lat, pos)
          html  = props["text"].to_s
          media = props["media"].to_s
          media_block = nil
          if present?(media)
            if media.match?(IMAGE_RE)
              media_block = { "url" => media, "caption" => props["caption"].to_s, "credit" => props["credit"].to_s }
            else
              html += %(<p><a href="#{media}" target="_blank" rel="noopener">Read more →</a></p>)
            end
          end

          overview = overview?(props)
          zoom = if overview
                   (@attrs["zoom"] || DEFAULTS["zoom"]).to_f
                 else
                   present?(props["zoom"]) ? props["zoom"].to_f : 9
                 end

          slide = {
            "id"       => "s#{pos}",
            "position" => overview ? "full" : (pos.odd? ? "left" : "right"),
            "title"    => props["headline"].to_s,
            "html"     => html,
            "camera"   => { "center" => [lon, lat], "zoom" => zoom, "pitch" => overview ? 0 : 40 },
            "show"     => ["trail"]
          }
          slide["media"] = media_block if media_block
          slide
        end

        def default_center(slides)
          (slides.find { |s| s["position"] == "full" } || slides.first)&.dig("camera", "center") || [0, 0]
        end

        def parse_config(site, path)
          JSON.parse(read_source(site, path))
        rescue JSON::ParserError => e
          Jekyll.logger.warn "lungkui:", "Invalid config JSON: #{e.message}"
          {}
        end

        def overview?(props)
          truthy(props["overview"]) || props["type"].to_s == "overview"
        end

        def inject_assets_once(page, baseurl)
          return "" if page["lungkui_assets_injected"]

          page["lungkui_assets_injected"] = true
          [
            %(<link rel="stylesheet" href="#{MAPLIBRE_CSS}">),
            %(<link rel="stylesheet" href="#{baseurl}/assets/css/lungkui.css">),
            %(<script src="#{MAPLIBRE_JS}"></script>)
          ].join("\n")
        end
      end
    end
  end
end

Liquid::Template.register_tag("lungkui", Jekyll::GisBlogger::Tags::LungkuiTag)
```

- [ ] **Step 2: Verify file parses**

```bash
/home/lerry/.local/share/mise/installs/ruby/3/bin/ruby -c lib/jekyll-gis-blogger/tags/lungkui.rb
```

Expected: `Syntax OK`

- [ ] **Step 3: Commit**

```bash
git add lib/jekyll-gis-blogger/tags/lungkui.rb
git commit -m "feat: add lungkui tag"
```

---

### Task 6: Port map.rb → tags/map.rb

**Files:**
- Create: `lib/jekyll-gis-blogger/tags/map.rb`
- Source: `/home/lerry/Workspace/Websites/wslerry.github.io/_plugins/map.rb`

**Interfaces:**
- Consumes: `Jekyll::GisBlogger::Utils`
- Produces: `Jekyll::GisBlogger::Tags::MapTag`, registers Liquid tag `map`

- [ ] **Step 1: Write map.rb**

File: `lib/jekyll-gis-blogger/tags/map.rb`

```ruby
# frozen_string_literal: true

module Jekyll
  module GisBlogger
    module Tags
      class MapTag < Liquid::Tag
        include Jekyll::GisBlogger::Utils

        DEFAULTS = {
          "height"      => "400px",
          "width"       => "100%",
          "zoom"        => "12",
          "basemap"     => "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
          "attribution" => '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }.freeze

        LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        LEAFLET_JS  = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"

        def initialize(tag_name, markup, tokens)
          super
          @attrs = markup.scan(ATTR_RE).each_with_object({}) do |(k, dq, sq), h|
            h[k] = dq || sq
          end
        end

        def render(context)
          page    = context.registers[:page]
          baseurl = context.registers[:site].config["baseurl"].to_s.chomp("/")

          unless present?(@attrs["lat"]) && present?(@attrs["lon"])
            Jekyll.logger.warn "map:", "Missing lat= or lon= — tag ignored"
            return "<!-- map tag: missing lat= or lon= -->"
          end

          lat     = parse_float("lat") or return warn_html("lat")
          lon     = parse_float("lon") or return warn_html("lon")
          zoom    = Integer(@attrs["zoom"] || DEFAULTS["zoom"])
          height  = @attrs["height"]  || DEFAULTS["height"]
          width   = @attrs["width"]   || DEFAULTS["width"]
          caption = @attrs["caption"].to_s
          marker  = @attrs["marker"] != "false"

          count = page["map_count"] || 0
          page["map_count"] = count + 1
          div_id = "jekyll-map-#{count}"

          assets       = inject_leaflet_once(page)
          caption_html = present?(caption) ? "<figcaption class=\"map-caption\">#{caption}</figcaption>" : ""
          marker_js    = marker ? "L.marker([#{lat}, #{lon}]).addTo(map).bindPopup('#{escape_js(caption)}');" : ""

          [
            assets,
            "<figure class=\"jekyll-map\">",
            "  <div id=\"#{div_id}\" style=\"width: #{width}; height: #{height};\"></div>",
            "  #{caption_html}",
            "</figure>",
            "<script>",
            "(function(){",
            "  var el=document.getElementById('#{div_id}');if(!el)return;",
            "  var map=L.map(el).setView([#{lat},#{lon}],#{zoom});",
            "  L.tileLayer('#{@attrs["basemap"] || DEFAULTS["basemap"]}',{attribution:'#{escape_js(@attrs["attribution"] || DEFAULTS["attribution"])}'}).addTo(map);",
            "  #{marker_js}",
            "  window.addEventListener('resize',function(){map.invalidateSize();});",
            "})();",
            "</script>"
          ].join("\n")
        end

        private

        def parse_float(name)
          Float(@attrs[name])
        rescue ArgumentError
          Jekyll.logger.warn "map:", "#{name} must be a number, got: #{@attrs[name].inspect}"
          nil
        end

        def warn_html(name)
          "<!-- map tag: invalid #{name}= -->"
        end

        def inject_leaflet_once(page)
          return "" if page["leaflet_injected"]

          page["leaflet_injected"] = true
          [
            %(<link rel="stylesheet" href="#{LEAFLET_CSS}" crossorigin="anonymous">),
            %(<script src="#{LEAFLET_JS}" crossorigin="anonymous"></script>)
          ].join("\n")
        end

        def escape_js(text)
          text.to_s.gsub("\\", "\\\\").gsub("'", "\\'").gsub("\n", " ")
        end
      end
    end
  end
end

Liquid::Template.register_tag("map", Jekyll::GisBlogger::Tags::MapTag)
```

- [ ] **Step 2: Verify file parses**

```bash
/home/lerry/.local/share/mise/installs/ruby/3/bin/ruby -c lib/jekyll-gis-blogger/tags/map.rb
```

Expected: `Syntax OK`

- [ ] **Step 3: Commit**

```bash
git add lib/jekyll-gis-blogger/tags/map.rb
git commit -m "feat: add map tag"
```

---

### Task 7: Port gpx_track.rb → tags/gpx_track.rb

**Files:**
- Create: `lib/jekyll-gis-blogger/tags/gpx_track.rb`
- Source: `/home/lerry/Workspace/Websites/wslerry.github.io/_plugins/gpx_track.rb`

**Interfaces:**
- Consumes: `Jekyll::GisBlogger::Utils`
- Produces: `Jekyll::GisBlogger::Tags::GpxTrackTag`, registers Liquid tag `gpx_track`

- [ ] **Step 1: Write gpx_track.rb**

File: `lib/jekyll-gis-blogger/tags/gpx_track.rb`

```ruby
# frozen_string_literal: true

require "rexml/document"

module Jekyll
  module GisBlogger
    module Tags
      class GpxTrackTag < Liquid::Tag
        include Jekyll::GisBlogger::Utils

        DEFAULTS = {
          "height" => "400px",
          "width"  => "100%",
          "color"  => "#e4572e"
        }.freeze

        EARTH_R = 6_371_000.0

        def initialize(tag_name, markup, tokens)
          super
          @attrs = markup.scan(ATTR_RE).each_with_object({}) do |(k, dq, sq), h|
            h[k] = dq || sq
          end
        end

        def render(context)
          site    = context.registers[:site]
          baseurl = context.registers[:site].config["baseurl"].to_s.chomp("/")
          page    = context.registers[:page]

          file = @attrs["file"]
          return warn_html("missing file=") unless present?(file)

          gpx_xml = read_source(site, file)
          return warn_html("#{file} is empty") if gpx_xml.empty?

          points = parse_gpx(gpx_xml)
          return warn_html("#{file} has no track points") if points.empty?

          height  = @attrs["height"] || DEFAULTS["height"]
          width   = @attrs["width"]  || DEFAULTS["width"]
          color   = @attrs["color"]  || DEFAULTS["color"]
          caption = @attrs["caption"].to_s
          show_profile = @attrs["profile"] != "false" && points.any? { |p| p[:ele] }

          count = page["gpx_map_count"] || 0
          page["gpx_map_count"] = count + 1
          div_id  = "gpx-map-#{count}"
          prof_id = "gpx-profile-#{count}"

          stats  = compute_stats(points)
          assets = inject_leaflet_once(page)
          latlngs_js = points.map { |p| "[#{p[:lat]},#{p[:lon]}]" }.join(",")

          caption_html = present?(caption) ? "<figcaption class=\"map-caption\">#{caption}</figcaption>" : ""
          profile_html = show_profile ? profile_svg(prof_id, points, stats, color) : ""

          [
            assets,
            "<figure class=\"jekyll-gpx\">",
            "  <div id=\"#{div_id}\" style=\"width: #{width}; height: #{height};\"></div>",
            "  #{profile_html}",
            "  #{stats_html(stats)}",
            "  #{caption_html}",
            "</figure>",
            "<script>",
            "(function(){",
            "  var el=document.getElementById('#{div_id}');if(!el)return;",
            "  var track=[#{latlngs_js}];",
            "  var map=L.map(el).fitBounds(L.latLngBounds(track));",
            "  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OSM contributors'}).addTo(map);",
            "  L.polyline(track,{color:'#{color}',weight:3,opacity:0.8}).addTo(map);",
            "  L.circleMarker(track[0],{radius:5,color:'#{color}',fillColor:'#fff',fillOpacity:1}).addTo(map);",
            "  L.circleMarker(track[track.length-1],{radius:5,color:'#{color}',fillColor:'#{color}',fillOpacity:1}).addTo(map);",
            "  window.addEventListener('resize',function(){map.invalidateSize();});",
            "})();",
            "</script>"
          ].join("\n")
        end

        private

        def parse_gpx(xml)
          doc = REXML::Document.new(xml)
          points = []
          doc.elements.each("//*") do |el|
            next unless el.name == "trkpt"

            lat = el.attributes["lat"]
            lon = el.attributes["lon"]
            next unless lat && lon

            ele = el.elements["ele"] || el.elements["*[local-name()='ele']"]
            points << { lat: lat.to_f, lon: lon.to_f, ele: ele&.text&.to_f }
            break if points.size > 5000
          end
          points
        rescue REXML::ParseException => e
          Jekyll.logger.warn "gpx_track:", "Invalid GPX: #{e.message}"
          []
        end

        def compute_stats(points)
          return {} if points.size < 2

          dist = gain = loss = 0.0
          min_e = max_e = points.first[:ele]

          points.each_cons(2) do |a, b|
            dist += haversine(a[:lat], a[:lon], b[:lat], b[:lon])
            if a[:ele] && b[:ele]
              diff = b[:ele] - a[:ele]
              gain += diff if diff > 0
              loss -= diff if diff < 0
              min_e = b[:ele] if b[:ele] < min_e
              max_e = b[:ele] if b[:ele] > max_e
            end
          end

          min_e ||= 0; max_e ||= 0

          { distance_km: (dist / 1000.0).round(2),
            gain_m: gain.round(0),
            loss_m: loss.round(0),
            min_elev: min_e.round(0),
            max_elev: max_e.round(0) }
        end

        def haversine(lat1, lon1, lat2, lon2)
          dlat = (lat2 - lat1) * Math::PI / 180.0
          dlon = (lon2 - lon1) * Math::PI / 180.0
          a = Math.sin(dlat / 2)**2 +
              Math.cos(lat1 * Math::PI / 180.0) * Math.cos(lat2 * Math::PI / 180.0) *
              Math.sin(dlon / 2)**2
          EARTH_R * 2.0 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        end

        def profile_svg(id, points, stats, color)
          return "" if points.size < 2

          w, h = 600, 150
          pad = { top: 12, right: 8, bottom: 20, left: 44 }
          pw = w - pad[:left] - pad[:right]
          ph = h - pad[:top] - pad[:bottom]

          elevs    = points.map { |p| p[:ele] || 0.0 }
          min_e    = elevs.min
          max_e    = elevs.max
          e_range  = (max_e - min_e).nonzero? || 1.0

          cum_dist = [0.0]
          points.each_cons(2) { |a, b| cum_dist << cum_dist.last + haversine(a[:lat], a[:lon], b[:lat], b[:lon]) }
          max_dist = cum_dist.last.nonzero? || 1.0

          sx = ->(d) { pad[:left] + (d / max_dist) * pw }
          sy = ->(e) { pad[:top] + (1.0 - (e - min_e) / e_range) * ph }

          poly_pts = points.each_with_index.map { |p, i| "#{sx.call(cum_dist[i]).round(1)},#{sy.call(p[:ele] || 0.0).round(1)}" }.join(" ")

          y_ticks = [min_e.round(-1), ((min_e + max_e) / 2).round(-1), max_e.round(-1)].uniq
          y_labels = y_ticks.map { |v| "<text x=\"#{pad[:left] - 4}\" y=\"#{sy.call(v).round(1) + 4}\" text-anchor=\"end\" class=\"gpx-y-label\">#{v}m</text>" }.join

          x_km = (max_dist / 1000.0).round(1)
          x_label = "#{x_km} km"

          %(<div class="gpx-profile" style="max-width:#{w}px;">
  <svg id="#{id}" viewBox="0 0 #{w} #{h}" class="gpx-profile-svg" aria-label="Elevation profile: #{stats[:gain_m]}m gain, #{x_label}">
    #{y_ticks.map { |v| "<line x1=\"#{pad[:left]}\" x2=\"#{w - pad[:right]}\" y1=\"#{sy.call(v).round(1)}\" y2=\"#{sy.call(v).round(1)}\" stroke=\"#ddd\" stroke-dasharray=\"3,3\"/>" }.join("\n    ")}
    <line x1="#{pad[:left]}" x2="#{w - pad[:right]}" y1="#{h - pad[:bottom]}" y2="#{h - pad[:bottom]}" stroke="#aaa"/>
    <line x1="#{pad[:left]}" x2="#{pad[:left]}" y1="#{pad[:top]}" y2="#{h - pad[:bottom]}" stroke="#aaa"/>
    <polygon points="#{sx.call(0).round(1)},#{h - pad[:bottom]} #{poly_pts} #{sx.call(max_dist).round(1)},#{h - pad[:bottom]}" fill="#{color}" opacity="0.12"/>
    <polyline points="#{poly_pts}" fill="none" stroke="#{color}" stroke-width="2" vector-effect="non-scaling-stroke"/>
    #{y_labels}
    <text x="#{w - pad[:right]}" y="#{h - 4}" text-anchor="end" class="gpx-x-label">#{x_label}</text>
  </svg>
</div>)
        end

        def stats_html(stats)
          return "" if stats.empty?

          "<dl class=\"gpx-stats\">" \
            "<dt>Distance</dt><dd>#{stats[:distance_km]} km</dd>" \
            "<dt>Gain</dt><dd>+#{stats[:gain_m]} m</dd>" \
            "<dt>Loss</dt><dd>−#{stats[:loss_m]} m</dd>" \
            "<dt>Elevation</dt><dd>#{stats[:min_elev]}–#{stats[:max_elev]} m</dd>" \
            "</dl>"
        end

        def inject_leaflet_once(page)
          return "" if page["leaflet_injected"]

          page["leaflet_injected"] = true
          [
            %(<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="anonymous">),
            %(<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin="anonymous"></script>)
          ].join("\n")
        end

        def warn_html(reason)
          Jekyll.logger.warn "gpx_track:", reason
          "<!-- gpx_track: #{reason} -->"
        end
      end
    end
  end
end

Liquid::Template.register_tag("gpx_track", Jekyll::GisBlogger::Tags::GpxTrackTag)
```

- [ ] **Step 2: Verify file parses**

```bash
/home/lerry/.local/share/mise/installs/ruby/3/bin/ruby -c lib/jekyll-gis-blogger/tags/gpx_track.rb
```

Expected: `Syntax OK`

- [ ] **Step 3: Commit**

```bash
git add lib/jekyll-gis-blogger/tags/gpx_track.rb
git commit -m "feat: add gpx_track tag"
```

---

### Task 8: Port datatable.rb → tags/datatable.rb

**Files:**
- Create: `lib/jekyll-gis-blogger/tags/datatable.rb`
- Source: `/home/lerry/Workspace/Websites/wslerry.github.io/_plugins/datatable.rb`

**Interfaces:**
- Consumes: `Jekyll::GisBlogger::Utils`
- Produces: `Jekyll::GisBlogger::Tags::DatatableTag`, registers Liquid tag `datatable`

- [ ] **Step 1: Write datatable.rb**

File: `lib/jekyll-gis-blogger/tags/datatable.rb`

```ruby
# frozen_string_literal: true

require "json"
require "csv"

module Jekyll
  module GisBlogger
    module Tags
      class DatatableTag < Liquid::Tag
        include Jekyll::GisBlogger::Utils

        def initialize(tag_name, markup, tokens)
          super
          @attrs = markup.scan(ATTR_RE).each_with_object({}) do |(k, dq, sq), h|
            h[k] = dq || sq
          end
        end

        def render(context)
          site = context.registers[:site]
          page = context.registers[:page]

          src = @attrs["src"]
          return warn_html("missing src=") unless present?(src)

          raw = read_source(site, src)
          return warn_html("#{src} is empty") if raw.empty?

          if src.end_with?(".geojson")
            headers, rows = from_geojson(raw)
          else
            headers, rows = from_csv(raw)
          end

          return warn_html("#{src} has no data") if rows.empty?

          cols    = @attrs["cols"]&.split(",")&.map(&:strip)
          sort_by = @attrs["sort"]

          if cols
            idxs = cols.map { |c| headers.index(c) }.compact
            headers = cols.select { |c| headers.include?(c) }
            rows = rows.map { |r| idxs.map { |i| r[i] } }
            sort_by = nil unless headers.include?(sort_by)
          end

          sort_idx = sort_by ? headers.index(sort_by) || 0 : 0

          caption_html = present?(@attrs["caption"]) ? "<caption>#{@attrs['caption']}</caption>" : ""

          count = page["datatable_count"] || 0
          page["datatable_count"] = count + 1
          table_id = "jekyll-dt-#{count}"

          rows_html = (sort_idx ? sort_rows(rows, sort_idx) : rows).map do |row|
            "<tr>" + row.map { |cell| "<td>#{escape_html(cell)}</td>" }.join + "</tr>"
          end.join("\n")

          thead = "<thead><tr>" + headers.map.with_index { |h, i|
            cls = i == sort_idx ? " class=\"sorted-asc\"" : ""
            "<th#{cls}>#{escape_html(h)}</th>"
          }.join + "</tr></thead>"

          assets = inject_sort_js_once(page)

          [
            assets,
            "<figure class=\"jekyll-datatable\">",
            "  #{caption_html}",
            "  <div class=\"dt-scroll\">",
            "  <table id=\"#{table_id}\" class=\"dt-table\">",
            "    #{thead}",
            "    <tbody>",
            "    #{rows_html}",
            "    </tbody>",
            "  </table>",
            "  </div>",
            "</figure>"
          ].join("\n")
        end

        private

        def from_geojson(text)
          features = JSON.parse(text)["features"] || []
          return [[], []] if features.empty?

          headers = features.first["properties"]&.keys || []
          rows = features.map { |f| (f["properties"] || {}).values.map(&:to_s) }
          [headers, rows]
        rescue JSON::ParserError => e
          Jekyll.logger.warn "datatable:", "Invalid GeoJSON: #{e.message}"
          [[], []]
        end

        def from_csv(text)
          table = CSV.parse(text, headers: true)
          headers = table.headers || []
          rows = table.map { |row| row.fields.map(&:to_s) }
          [headers, rows]
        rescue CSV::MalformedCSVError => e
          Jekyll.logger.warn "datatable:", "Invalid CSV: #{e.message}"
          [[], []]
        end

        def sort_rows(rows, col_idx)
          rows.sort_by do |r|
            val = r[col_idx].to_s
            Float(val)
          rescue ArgumentError
            val.downcase
          end
        end

        def escape_html(text)
          text.to_s.gsub("&", "&amp;").gsub("<", "&lt;").gsub(">", "&gt;")
        end

        def inject_sort_js_once(page)
          return "" if page["datatable_js_injected"]

          page["datatable_js_injected"] = true
          <<~JS
            <script>
            (function(){
              if(window.__dtSortInit)return;window.__dtSortInit=true;
              document.addEventListener('click',function(e){
                var th=e.target.closest('.dt-table th');if(!th)return;
                var t=th.closest('table'),tb=t.querySelector('tbody'),rows=Array.from(tb.rows);
                var idx=Array.from(th.parentNode.children).indexOf(th);
                var asc=!th.classList.contains('sorted-asc');
                t.querySelectorAll('th').forEach(function(h){h.classList.remove('sorted-asc','sorted-desc')});
                th.classList.add(asc?'sorted-asc':'sorted-desc');
                var isNum=rows.length>0&&!isNaN(parseFloat(rows[0].cells[idx].textContent));
                rows.sort(function(a,b){
                  var av=a.cells[idx].textContent.trim(),bv=b.cells[idx].textContent.trim();
                  if(isNum){return asc?av-bv:bv-av;}
                  return asc?av.localeCompare(bv):bv.localeCompare(av);
                });
                rows.forEach(function(r){tb.appendChild(r)});
              });
            })();
            </script>
          JS
        end

        def warn_html(reason)
          Jekyll.logger.warn "datatable:", reason
          "<!-- datatable: #{reason} -->"
        end
      end
    end
  end
end

Liquid::Template.register_tag("datatable", Jekyll::GisBlogger::Tags::DatatableTag)
```

- [ ] **Step 2: Verify file parses**

```bash
/home/lerry/.local/share/mise/installs/ruby/3/bin/ruby -c lib/jekyll-gis-blogger/tags/datatable.rb
```

Expected: `Syntax OK`

- [ ] **Step 3: Commit**

```bash
git add lib/jekyll-gis-blogger/tags/datatable.rb
git commit -m "feat: add datatable tag"
```

---

### Task 9: Port table.rb → hooks/table_wrapper.rb

**Files:**
- Create: `lib/jekyll-gis-blogger/hooks/table_wrapper.rb`
- Source: `/home/lerry/Workspace/Websites/wslerry.github.io/_plugins/table.rb`

**Interfaces:**
- Produces: `Jekyll::GisBlogger::Hooks::TableWrapper` — auto-activates via `Jekyll::Hooks.register`

- [ ] **Step 1: Write table_wrapper.rb**

File: `lib/jekyll-gis-blogger/hooks/table_wrapper.rb`

```ruby
# frozen_string_literal: true

module Jekyll
  module GisBlogger
    module Hooks
      # Post-render hook that wraps every rendered <table> in a responsive
      # scroll container so tables never overflow on mobile.
      # Tables inside .dt-scroll or .table-wrapper are skipped.
      module TableWrapper
        Jekyll::Hooks.register [:posts, :pages, :documents], :post_render do |doc|
          doc.output = doc.output.gsub(%r{<table[^>]*>.*?</table>}m) do |match|
            before = $`[-100..] || ""
            if before.include?("dt-scroll") || before.include?("table-wrapper")
              match
            else
              "<div class=\"table-wrapper\">#{match}</div>"
            end
          end
        end
      end
    end
  end
end
```

- [ ] **Step 2: Verify file parses**

```bash
/home/lerry/.local/share/mise/installs/ruby/3/bin/ruby -c lib/jekyll-gis-blogger/hooks/table_wrapper.rb
```

Expected: `Syntax OK`

- [ ] **Step 3: Commit**

```bash
git add lib/jekyll-gis-blogger/hooks/table_wrapper.rb
git commit -m "feat: add table wrapper hook"
```

---

### Task 10: Smoke test — load gem and verify all tags register

**Files:**
- Create: `test/test_tags.rb`

**Interfaces:**
- Consumes: All tag modules, `jekyll-gis-blogger` entry point
- Produces: Passing test suite

- [ ] **Step 1: Write smoke test**

File: `test/test_tags.rb`

```ruby
# frozen_string_literal: true

require "minitest/autorun"
require "jekyll"
require "jekyll-gis-blogger"

class TestTagsRegistered < Minitest::Test
  def test_storymap_tag_registered
    assert Liquid::Template.tags["storymap"],
           "storymap tag should be registered"
  end

  def test_lungkui_tag_registered
    assert Liquid::Template.tags["lungkui"],
           "lungkui tag should be registered"
  end

  def test_map_tag_registered
    assert Liquid::Template.tags["map"],
           "map tag should be registered"
  end

  def test_gpx_track_tag_registered
    assert Liquid::Template.tags["gpx_track"],
           "gpx_track tag should be registered"
  end

  def test_datatable_tag_registered
    assert Liquid::Template.tags["datatable"],
           "datatable tag should be registered"
  end

  def test_tag_classes_in_correct_namespace
    assert_equal Jekyll::GisBlogger::Tags::StorymapTag,
                 Liquid::Template.tags["storymap"]

    assert_equal Jekyll::GisBlogger::Tags::LungkuiTag,
                 Liquid::Template.tags["lungkui"]

    assert_equal Jekyll::GisBlogger::Tags::MapTag,
                 Liquid::Template.tags["map"]

    assert_equal Jekyll::GisBlogger::Tags::GpxTrackTag,
                 Liquid::Template.tags["gpx_track"]

    assert_equal Jekyll::GisBlogger::Tags::DatatableTag,
                 Liquid::Template.tags["datatable"]
  end
end
```

- [ ] **Step 2: Run tests**

```bash
cd /home/lerry/Workspace/Websites/gis-blogger
/home/lerry/.local/share/mise/installs/ruby/3/bin/ruby -Ilib:test test/test_tags.rb
```

Expected: 7 tests, 0 failures

- [ ] **Step 3: Commit**

```bash
git add test/test_tags.rb
git commit -m "test: add tag registration smoke tests"
```

---

### Task 11: Add LICENSE

**Files:**
- Create: `LICENSE`

- [ ] **Step 1: Write MIT LICENSE**

File: `LICENSE`

```
MIT License

Copyright (c) 2026 Lerry William Seling

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 2: Commit**

```bash
git add LICENSE
git commit -m "docs: add MIT license"
```

---

### Task 12: Write README.md

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README**

File: `README.md`

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README"
```

---

### Task 13: Build gem and test in blog

**Files:**
- Modify: (blog) `Gemfile`
- Modify: (blog) `_config.yml`

- [ ] **Step 1: Build the gem**

```bash
cd /home/lerry/Workspace/Websites/gis-blogger
/home/lerry/.local/share/mise/installs/ruby/3/bin/gem build jekyll-gis-blogger.gemspec
```

Expected: `jekyll-gis-blogger-0.1.0.gem` created.

- [ ] **Step 2: Verify gem contents**

```bash
/home/lerry/.local/share/mise/installs/ruby/3/bin/gem contents jekyll-gis-blogger-0.1.0.gem 2>/dev/null || tar -tzf jekyll-gis-blogger-0.1.0.gem
```

Expected: All `lib/` files, `LICENSE`, `README.md`.

- [ ] **Step 3: Install gem via path in blog Gemfile**

```bash
cd /home/lerry/Workspace/Websites/wslerry.github.io
# Add: gem "jekyll-gis-blogger", path: "../gis-blogger"
# Add to _config.yml: plugins: [jekyll-gis-blogger]
/home/lerry/.local/share/mise/installs/ruby/3/bin/bundle install
```

- [ ] **Step 4: Test blog build**

```bash
cd /home/lerry/Workspace/Websites/wslerry.github.io
/home/lerry/.local/share/mise/installs/ruby/3/bin/bundle exec jekyll build 2>&1 | tail -20
```

Expected: Build succeeds, no Liquid errors about unknown tags.

- [ ] **Step 5: Remove old _plugins (after confirming build works)**

```bash
cd /home/lerry/Workspace/Websites/wslerry.github.io/_plugins
rm storymap.rb lungkui-storymap.rb map.rb gpx_track.rb datatable.rb table.rb lib/utils.rb
# Keep: baseurl.rb, generate_categories.rb
```

- [ ] **Step 6: Rebuild and verify**

```bash
cd /home/lerry/Workspace/Websites/wslerry.github.io
/home/lerry/.local/share/mise/installs/ruby/3/bin/bundle exec jekyll build
```

Expected: Clean build.

- [ ] **Step 7: Commit blog changes**

```bash
cd /home/lerry/Workspace/Websites/wslerry.github.io
git add Gemfile Gemfile.lock _config.yml _plugins/
git commit -m "refactor: switch to jekyll-gis-blogger gem"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** All 6 plugins ported. 5 tags + 1 hook. Entry point requires all. Utils module extracted. README covers every tag with attribute tables.
- [x] **No placeholders:** No TBDs, TODOs, or vague steps. Every file has complete code.
- [x] **Type consistency:** `ATTR_RE` accessible via `Jekyll::GisBlogger::Utils`. All tag classes in `Jekyll::GisBlogger::Tags`. Tag names match original (`storymap`, `lungkui`, `map`, `gpx_track`, `datatable`).
