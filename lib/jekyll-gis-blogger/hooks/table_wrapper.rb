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
