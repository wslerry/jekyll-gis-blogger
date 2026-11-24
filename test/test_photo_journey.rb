# frozen_string_literal: true

require "minitest/autorun"
require "jekyll"
require "jekyll-gis-blogger"
require "tmpdir"
require "fileutils"

FIXTURES = File.expand_path("fixtures", __dir__)

class TestExif < Minitest::Test
  PJ = Jekyll::GisBlogger::PhotoJourney

  def test_reads_gps_time_and_caption
    e = PJ.read_exif(File.join(FIXTURES, "gps.jpg"))
    assert_in_delta 25.5, e[:lon], 0.0001
    assert_in_delta(-0.25, e[:lat], 0.0001)
    assert_equal "With GPS", e[:caption]
    # Camera wrote local time 07:10 with OffsetTimeOriginal +01:00 -> 06:10 UTC.
    assert_equal Time.utc(2026, 3, 2, 6, 10, 0), e[:time]
  end

  def test_time_only_photo_has_no_position
    e = PJ.read_exif(File.join(FIXTURES, "time.jpg"))
    assert_nil e[:lat]
    assert_equal Time.utc(2026, 3, 2, 7, 30, 0), e[:time]
  end

  def test_non_jpeg_or_missing_exif_is_empty_not_an_error
    Dir.mktmpdir do |d|
      path = File.join(d, "x.jpg")
      File.binwrite(path, "not a jpeg")
      assert_equal({}, PJ.read_exif(path))
    end
  end
end

class TestGpxAndPlacement < Minitest::Test
  PJ = Jekyll::GisBlogger::PhotoJourney

  def track
    PJ.read_gpx(File.read(File.join(FIXTURES, "line.gpx")))
  end

  def test_gpx_points_with_times
    t = track
    assert_equal 3, t.size
    assert_equal [25.0, 0.0], t.first[:lonlat]
    assert_equal Time.utc(2026, 3, 2, 7, 0, 0), t[1][:time]
  end

  def test_gps_photo_projects_onto_the_track_for_progress
    placed = PJ.place({ lat: -0.25, lon: 25.5, time: nil }, track)
    assert_equal [25.5, -0.25], placed[:lonlat], "GPS position is kept as shot"
    assert_in_delta 0.25, placed[:progress], 0.01
    assert_equal :gps, placed[:source]
  end

  def test_time_only_photo_is_interpolated_along_the_track
    placed = PJ.place({ time: Time.utc(2026, 3, 2, 7, 30, 0) }, track)
    assert_in_delta 26.5, placed[:lonlat][0], 0.0001
    assert_in_delta 0.75, placed[:progress], 0.01
    assert_equal :time, placed[:source]
  end

  def test_camera_clock_offset_shifts_the_match
    placed = PJ.place({ time: Time.utc(2026, 3, 2, 8, 30, 0) }, track, time_offset: -3600)
    assert_in_delta 26.5, placed[:lonlat][0], 0.0001
  end

  def test_photo_outside_the_track_time_cannot_be_placed
    assert_nil PJ.place({ time: Time.utc(2026, 2, 1) }, track)
    assert_nil PJ.place({}, track)
  end
end

class TestPhotoStoryTag < Minitest::Test
  def test_tag_builds_a_photo_story_in_time_order
    Dir.mktmpdir do |dir|
      FileUtils.mkdir_p(File.join(dir, "trip/photos"))
      FileUtils.cp(File.join(FIXTURES, "line.gpx"), File.join(dir, "trip/route.gpx"))
      FileUtils.cp(File.join(FIXTURES, "time.jpg"), File.join(dir, "trip/photos/b.jpg"))
      FileUtils.cp(File.join(FIXTURES, "gps.jpg"), File.join(dir, "trip/photos/a.jpg"))
      site = Struct.new(:source, :config) do
        def in_source_dir(*parts) = File.join(source, *parts)
      end.new(dir, { "baseurl" => "" })
      tag = Liquid::Template.parse(%({% lungkui gpx="/trip/route.gpx" photos="/trip/photos/" title="Test trip" %})).root.nodelist.first
      cfg = tag.send(:build_photo_config, site, "")

      assert_equal "photo", cfg["markers"]
      track = cfg["layers"].first
      assert_equal "track", track["style"]["kind"]
      assert track["source"]["lineMetrics"], "progress needs line metrics"
      titles = cfg["slides"].map { |s| s["title"] }
      assert_equal ["Test trip", "With GPS", "Time only"], titles, "cover, then photos by time"
      gps_slide = cfg["slides"][1]
      assert_equal "/trip/photos/a.jpg", gps_slide["media"]["url"]
      assert_in_delta 0.25, gps_slide["progress"]["value"], 0.01
      assert_in_delta 0.75, cfg["slides"][2]["progress"]["value"], 0.01
      assert_equal [26.5, 0.0], cfg["slides"][2]["camera"]["center"].map { |v| v.round(4) }
    end
  end
end
