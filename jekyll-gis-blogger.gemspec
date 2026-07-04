# frozen_string_literal: true

Gem::Specification.new do |spec|
  spec.name          = "jekyll-gis-blogger"
  spec.version       = "0.1.1"
  spec.authors       = ["Lerry William Seling"]
  spec.email         = ["wslerry@gmail.com"]
  spec.summary       = "Jekyll Liquid tags for GIS storytelling — maps, GPX tracks, StoryMapJS, lungkui.js, and sortable data tables"
  spec.description   = "A collection of Jekyll Liquid tags and hooks for GIS blogging: " \
                       "Leaflet maps, GPX track display with elevation profiles, " \
                       "StoryMapJS and lungkui.js story-map embeds, and sortable " \
                       "HTML tables from GeoJSON/CSV. Zero runtime dependencies beyond Jekyll."
  spec.homepage      = "https://github.com/wslerry/jekyll-gis-blogger"
  spec.license       = "MIT"

  spec.required_ruby_version = ">= 2.7.0"

  spec.metadata["homepage_uri"]    = spec.homepage
  spec.metadata["source_code_uri"] = spec.homepage

  spec.files = Dir[
    "lib/**/*.rb",
    "lib/jekyll-gis-blogger/vendor/**/*.{js,css}",
    "LICENSE", "README.md"
  ]

  spec.add_dependency "jekyll", "~> 4.0"
end
