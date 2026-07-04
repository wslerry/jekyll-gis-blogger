# frozen_string_literal: true

require "jekyll"

module Jekyll
  module GisBlogger
  end
end

require_relative "jekyll-gis-blogger/utils"
require_relative "jekyll-gis-blogger/assets"

require_relative "jekyll-gis-blogger/tags/storymap"
require_relative "jekyll-gis-blogger/tags/lungkui"
require_relative "jekyll-gis-blogger/tags/map"
require_relative "jekyll-gis-blogger/tags/gpx_track"
require_relative "jekyll-gis-blogger/tags/datatable"
require_relative "jekyll-gis-blogger/hooks/table_wrapper"
