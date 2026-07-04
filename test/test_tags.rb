# frozen_string_literal: true

require "minitest/autorun"
require "jekyll"
require "jekyll-gis-blogger"

class TestTagsRegistered < Minitest::Test
  def test_storymap_tag_registered
    assert Liquid::Template.tags["storymap"],
           "storymap tag should be registered"
  end

  def test_lungkui_tag_registered
    assert Liquid::Template.tags["lungkui"],
           "lungkui tag should be registered"
  end

  def test_map_tag_registered
    assert Liquid::Template.tags["map"],
           "map tag should be registered"
  end

  def test_gpx_track_tag_registered
    assert Liquid::Template.tags["gpx_track"],
           "gpx_track tag should be registered"
  end

  def test_datatable_tag_registered
    assert Liquid::Template.tags["datatable"],
           "datatable tag should be registered"
  end

  def test_tag_classes_in_correct_namespace
    assert_equal Jekyll::GisBlogger::Tags::StorymapTag,
                 Liquid::Template.tags["storymap"]

    assert_equal Jekyll::GisBlogger::Tags::LungkuiTag,
                 Liquid::Template.tags["lungkui"]

    assert_equal Jekyll::GisBlogger::Tags::MapTag,
                 Liquid::Template.tags["map"]

    assert_equal Jekyll::GisBlogger::Tags::GpxTrackTag,
                 Liquid::Template.tags["gpx_track"]

    assert_equal Jekyll::GisBlogger::Tags::DatatableTag,
                 Liquid::Template.tags["datatable"]
  end
end
