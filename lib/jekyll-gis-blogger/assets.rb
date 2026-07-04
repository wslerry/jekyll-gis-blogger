# frozen_string_literal: true

module Jekyll
  module GisBlogger
    # Ships the gem's own JS/CSS with every Jekyll build.
    #
    # The storymap and lungkui tags need local assets (StoryMapJS + lungkui.js).
    # Rather than making each project copy them by hand, we register them as
    # Jekyll static files so they are emitted into <dest>/assets/gis-blogger/...
    # automatically. Namespaced under /assets/gis-blogger/ so a site's own
    # /assets/ is never touched.
    module Assets
      # <gem>/lib/jekyll-gis-blogger/vendor
      VENDOR_ROOT = File.expand_path("vendor", __dir__)

      # dir (URL path, mirrored on disk under VENDOR_ROOT) => filenames
      FILES = {
        "/assets/gis-blogger/js"  => %w[storymap-min.js lungkui.js],
        "/assets/gis-blogger/css" => %w[storymap.css lungkui.css]
      }.freeze

      # ponytail: always copies all four (~370KB) even if a page uses none —
      # usage isn't known at :post_read. Browsers only fetch what a tag references,
      # so the cost is disk in _site, not bandwidth. Fine until it isn't.
      Jekyll::Hooks.register :site, :post_read do |site|
        FILES.each do |dir, names|
          names.each do |name|
            already = site.static_files.any? { |f| f.relative_path == File.join(dir, name) }
            next if already

            site.static_files << Jekyll::StaticFile.new(site, VENDOR_ROOT, dir, name)
          end
        end
      end
    end
  end
end
