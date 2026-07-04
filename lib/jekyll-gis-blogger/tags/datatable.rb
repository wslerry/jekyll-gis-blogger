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
