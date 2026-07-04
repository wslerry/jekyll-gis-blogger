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
