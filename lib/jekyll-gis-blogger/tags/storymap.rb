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
            "var #{js_var} = new VCO.StoryMap('#{div_id}', #{data_arg}, #{options});",
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
