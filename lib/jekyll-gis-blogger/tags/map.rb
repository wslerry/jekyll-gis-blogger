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
          # Block form avoids gsub's replacement-string backreferences
          # (a literal "\\'" replacement means post-match, not an escaped quote).
          text.to_s.gsub(/[\\'\r\n]/) { |c| c == "\n" || c == "\r" ? " " : "\\#{c}" }
        end
      end
    end
  end
end

Liquid::Template.register_tag("map", Jekyll::GisBlogger::Tags::MapTag)
