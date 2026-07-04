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
          return warn_html("needs one of: geojson= | config=") unless config_js

          assets = inject_assets_once(page, baseurl)

          [
            assets,
            %(<div id="#{div_id}" class="lk-root lk-embed" ) +
              %(style="position:relative;width:#{width};height:#{height};"></div>),
            %(<script type="module">),
            %(import { Lungkui } from '#{baseurl}/assets/gis-blogger/js/lungkui.js';),
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
          end
        end

        def warn_html(reason)
          Jekyll.logger.warn "lungkui:", reason
          "<!-- lungkui: #{reason} -->"
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
            %(<link rel="stylesheet" href="#{baseurl}/assets/gis-blogger/css/lungkui.css">),
            %(<script src="#{MAPLIBRE_JS}"></script>)
          ].join("\n")
        end
      end
    end
  end
end

Liquid::Template.register_tag("lungkui", Jekyll::GisBlogger::Tags::LungkuiTag)
