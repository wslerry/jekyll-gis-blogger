# frozen_string_literal: true

require "minitest/autorun"
require "jekyll"
require "jekyll-gis-blogger"

class TestTagsRegistered < Minitest::Test
  TAGS = {
    "storymap"  => Jekyll::GisBlogger::Tags::StorymapTag,
    "lungkui"   => Jekyll::GisBlogger::Tags::LungkuiTag,
    "map"       => Jekyll::GisBlogger::Tags::MapTag,
    "gpx_track" => Jekyll::GisBlogger::Tags::GpxTrackTag,
    "datatable" => Jekyll::GisBlogger::Tags::DatatableTag
  }.freeze

  def test_all_tags_registered_to_correct_class
    TAGS.each do |name, klass|
      assert_equal klass, Liquid::Template.tags[name], "#{name} tag should map to #{klass}"
    end
  end
end

class TestUtils < Minitest::Test
  def setup
    @u = Class.new { include Jekyll::GisBlogger::Utils }.new
  end

  def test_truthy
    %w[1 true yes y TRUE Yes].each { |v| assert @u.truthy(v), "#{v} should be truthy" }
    ["0", "false", "no", "", nil].each { |v| refute @u.truthy(v), "#{v.inspect} should be falsey" }
    assert_equal true, @u.truthy(true)
    assert_equal false, @u.truthy(false)
  end

  def test_present
    assert @u.present?("x")
    refute @u.present?("")
    refute @u.present?("   ")
    refute @u.present?(nil)
  end

  def test_order_of_falls_back_to_index
    assert_equal 3.0, @u.order_of({ "order" => "3" }, 9)
    assert_equal 9.0, @u.order_of({}, 9)
  end

  def test_absolute
    %w[http://x https://x //x].each { |p| assert @u.absolute?(p) }
    refute @u.absolute?("/local/path")
  end

  def test_inline_escapes_closing_tag_to_prevent_script_breakout
    out = @u.inline("headline" => "</script><b>hi</b>")
    refute_includes out, "</script>"
    assert_includes out, '<\\/script>'
  end
end

class TestMapEscaping < Minitest::Test
  def setup
    @tag = Jekyll::GisBlogger::Tags::MapTag.allocate
  end

  # Regression: the old gsub("'", "\\'") used the post-match backreference,
  # mangling any caption containing an apostrophe.
  def test_escape_js_escapes_apostrophe
    assert_equal "Kolo\\'mee", @tag.send(:escape_js, "Kolo'mee")
  end

  def test_escape_js_escapes_backslash_and_flattens_newlines
    assert_equal "a\\\\b", @tag.send(:escape_js, "a\\b")
    assert_equal "a b", @tag.send(:escape_js, "a\nb")
  end
end

class TestStorymapParsing < Minitest::Test
  def setup
    @tag = Jekyll::GisBlogger::Tags::StorymapTag.allocate
  end

  def geojson
    {
      "features" => [
        { "properties" => { "order" => "2", "headline" => "Second" }, "geometry" => { "coordinates" => [10.0, 20.0] } },
        { "properties" => { "order" => "1", "headline" => "First" },  "geometry" => { "coordinates" => [11.0, 21.0] } },
        { "properties" => { "type" => "overview", "headline" => "Intro" }, "geometry" => { "coordinates" => [0, 0] } }
      ]
    }.to_json
  end

  def test_slides_sorted_overview_first_then_order
    slides = @tag.send(:slides_from_geojson, geojson)
    assert_equal "overview", slides.first["type"]
    assert_equal %w[Intro First Second], slides.map { |s| s.dig("text", "headline") }
  end

  def test_geojson_maps_lat_lon_from_coordinates
    slides = @tag.send(:slides_from_geojson, geojson)
    first = slides.find { |s| s.dig("text", "headline") == "First" }
    assert_equal 21.0, first.dig("location", "lat")
    assert_equal 11.0, first.dig("location", "lon")
  end

  def test_invalid_geojson_degrades_to_empty
    assert_equal [], @tag.send(:slides_from_geojson, "{ not json")
  end

  def test_csv_reads_lat_lon_aliases
    csv = "headline,latitude,longitude,order\nStop,5.5,100.1,1\n"
    slides = @tag.send(:slides_from_csv, csv)
    assert_equal 5.5, slides.first.dig("location", "lat")
    assert_equal 100.1, slides.first.dig("location", "lon")
  end
end

class TestDatatableParsing < Minitest::Test
  def setup
    @tag = Jekyll::GisBlogger::Tags::DatatableTag.allocate
  end

  def test_from_geojson_headers_and_rows
    gj = { "features" => [{ "properties" => { "name" => "A", "pop" => 3 } },
                          { "properties" => { "name" => "B", "pop" => 1 } }] }.to_json
    headers, rows = @tag.send(:from_geojson, gj)
    assert_equal %w[name pop], headers
    assert_equal [%w[A 3], %w[B 1]], rows
  end

  def test_from_csv_headers_and_rows
    headers, rows = @tag.send(:from_csv, "name,pop\nA,3\nB,1\n")
    assert_equal %w[name pop], headers
    assert_equal [%w[A 3], %w[B 1]], rows
  end

  def test_sort_rows_numeric_vs_string
    rows = [["A", "10"], ["B", "2"], ["C", "1"]]
    assert_equal %w[1 2 10], @tag.send(:sort_rows, rows, 1).map { |r| r[1] }
  end

  def test_escape_html
    assert_equal "&lt;b&gt;&amp;", @tag.send(:escape_html, "<b>&")
  end
end

class TestGpxStats < Minitest::Test
  def setup
    @tag = Jekyll::GisBlogger::Tags::GpxTrackTag.allocate
  end

  def test_haversine_one_degree_longitude_at_equator
    d = @tag.send(:haversine, 0.0, 0.0, 0.0, 1.0)
    assert_in_delta 111_195, d, 500
  end

  def test_compute_stats_gain_and_loss
    points = [{ lat: 0.0, lon: 0.0, ele: 100.0 },
              { lat: 0.0, lon: 0.01, ele: 150.0 },
              { lat: 0.0, lon: 0.02, ele: 120.0 }]
    stats = @tag.send(:compute_stats, points)
    assert_operator stats[:distance_km], :>, 0
    assert_equal 50, stats[:gain_m]
    assert_equal 30, stats[:loss_m]
    assert_equal 100, stats[:min_elev]
    assert_equal 150, stats[:max_elev]
  end
end

class TestVendoredAssets < Minitest::Test
  def test_every_registered_asset_exists_on_disk
    Jekyll::GisBlogger::Assets::FILES.each do |dir, names|
      names.each do |name|
        path = File.join(Jekyll::GisBlogger::Assets::VENDOR_ROOT, dir, name)
        assert File.file?(path), "vendored asset missing: #{path}"
      end
    end
  end
end
