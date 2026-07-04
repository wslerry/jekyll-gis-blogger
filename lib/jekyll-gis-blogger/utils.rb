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
