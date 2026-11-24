# frozen_string_literal: true

require "json"

module Jekyll
  module GisBlogger
    module Tags
      class LungkuiTag < Liquid::Tag
        include Jekyll::GisBlogger::Utils

        DEFAULTS = {
          "height" => "600px",
          "width"  => "100%",
          "mode"   => "deck",
          "zoom"   => "6",
          "panel"  => "left"
        }.freeze

        # lungkui.js basemap presets; anything else is treated as an XYZ tile URL.
        BASEMAP_PRESETS = %w[positron dark liberty bright fiord osm opentopo].freeze

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
          return warn_html("needs one of: geojson= | config= | gpx= with photos=") unless config_js

          assets = inject_assets_once(page, baseurl)

          [
            assets,
            # fullpage: a full-screen story in the page flow (sticky map, page scrolls);
            # otherwise a fixed-height box inside the post.
            if truthy(@attrs["fullpage"])
              %(<div id="#{div_id}" class="lk-root"></div>)
            else
              %(<div id="#{div_id}" class="lk-root lk-embed" ) +
                %(style="position:relative;width:#{width};height:#{height};"></div>)
            end,
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
          elsif @attrs["gpx"] && @attrs["photos"]
            inline(build_photo_config(site, baseurl))
          elsif @attrs["geojson"]
            inline(build_config(site, baseurl))
          end
        end

        PHOTO_EXT = /\.jpe?g\z/i

        # Photo story: the GPX track, then one slide per placeable photo in time
        # order. Options: title, text (cover HTML), photo_zoom, time_offset (seconds
        # added to camera times), plus the usual panel/theme/basemap/accent.
        def build_photo_config(site, baseurl)
          pj = Jekyll::GisBlogger::PhotoJourney
          track = pj.read_gpx(read_source(site, @attrs["gpx"]))
          return {} if track.size < 2

          dir = @attrs["photos"].sub(%r{/*\z}, "/")
          files = Dir.glob(File.join(site.in_source_dir(dir), "*")).select { |f| f.match?(PHOTO_EXT) }
          offset = @attrs["time_offset"].to_i
          shots = files.filter_map do |f|
            exif = pj.read_exif(f)
            placed = pj.place(exif, track, time_offset: offset)
            unless placed
              Jekyll.logger.warn "lungkui:", "#{File.basename(f)}: no GPS and no time on the track, skipped"
              next
            end
            { file: File.basename(f), exif: exif, placed: placed }
          end
          # Time order when known (that is the journey), else along-track order.
          shots.sort_by! { |s| [s[:exif][:time] ? 0 : 1, s[:exif][:time] || Time.at(0), s[:placed][:progress]] }

          line = { "type" => "FeatureCollection", "features" => [{
            "type" => "Feature", "properties" => {},
            "geometry" => { "type" => "LineString", "coordinates" => track.map { |p| p[:lonlat].map { |v| v.round(5) } } }
          }] }
          zoom = (@attrs["photo_zoom"] || 10).to_f
          panel = @attrs["panel"] || DEFAULTS["panel"]
          url_dir = absolute?(dir) ? dir : "#{baseurl}#{dir}"

          slides = [{
            "id" => "cover", "position" => "full", "title" => @attrs["title"].to_s,
            "html" => @attrs["text"].to_s, "camera" => { "fit" => { "layer" => "track" } },
            "progress" => { "layer" => "track", "value" => 0 }, "legend" => ["track"]
          }]
          shots.each_with_index do |s, i|
            caption = s[:exif][:caption].to_s
            title = caption.empty? ? File.basename(s[:file], ".*").tr("_-", "  ") : caption
            slides << {
              "id" => "photo-#{i + 1}", "position" => panel, "title" => title,
              "kicker" => s[:exif][:time] ? s[:exif][:time].strftime("%-d %b %Y, %H:%M UTC") : "Photo #{i + 1}",
              "media" => { "url" => "#{url_dir}#{s[:file]}", "caption" => caption },
              "camera" => { "center" => s[:placed][:lonlat].map { |v| v.round(5) }, "zoom" => zoom },
              "progress" => { "layer" => "track", "value" => s[:placed][:progress].round(4) }
            }
          end

          cfg = {
            "mode" => @attrs["mode"] || DEFAULTS["mode"], "markers" => "photo", "panelSide" => panel,
            "map" => { "center" => track.first[:lonlat], "zoom" => (@attrs["zoom"] || DEFAULTS["zoom"]).to_f },
            "layers" => [{ "id" => "track", "type" => "line",
                           "source" => { "geojson" => line, "lineMetrics" => true },
                           "style" => { "kind" => "track", "width" => 3.5, "legendLabel" => "Route travelled" } }],
            "slides" => slides
          }
          cfg["map"]["basemap"] = basemap_config(@attrs["basemap"]) if present?(@attrs["basemap"])
          theme = {}
          theme["preset"] = @attrs["theme"] if present?(@attrs["theme"])
          theme["accent"] = @attrs["accent"] if present?(@attrs["accent"])
          cfg["theme"] = theme unless theme.empty?
          cfg
        end

        def warn_html(reason)
          Jekyll.logger.warn "lungkui:", reason
          "<!-- lungkui: #{reason} -->"
        end

        def build_config(site, baseurl)
          slides = slides_from_geojson(read_source(site, @attrs["geojson"]))
          center = @attrs["center"] ? @attrs["center"].split(",").map(&:to_f) : default_center(slides)
        
          map = { "center" => center, "zoom" => (@attrs["zoom"] || DEFAULTS["zoom"]).to_f }
          map["basemap"] = basemap_config(@attrs["basemap"]) if present?(@attrs["basemap"])
        
          config = {
            "mode"      => @attrs["mode"] || DEFAULTS["mode"],
            "map"       => map,
            "layers"    => [],   # lungkui draws the numbered stops and the route itself
            "route"     => @attrs.key?("route") ? truthy(@attrs["route"]) : true,
            "panelSide" => @attrs["panel"] || DEFAULTS["panel"],
            "slides"    => slides
          }
          config["markers"] = @attrs["markers"] if present?(@attrs["markers"])
          theme = {}
          theme["preset"] = @attrs["theme"] if present?(@attrs["theme"])
          theme["accent"] = @attrs["accent"] if present?(@attrs["accent"])
          config["theme"] = theme unless theme.empty?
          config
        end
        
        # A lungkui preset name passes through; anything else is an XYZ tile URL.
        def basemap_config(value)
          return value if BASEMAP_PRESETS.include?(value)
        
          { "type" => "xyz", "url" => value, "attribution" => "© OpenStreetMap contributors" }
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
            "position" => overview ? "full" : (@attrs["panel"] || DEFAULTS["panel"]),
            "title"    => props["headline"].to_s,
            "html"     => html,
            "camera"   => overview ? { "center" => [lon, lat], "fit" => true } : { "center" => [lon, lat], "zoom" => zoom, "pitch" => (@attrs["pitch"] || 0).to_f }
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
