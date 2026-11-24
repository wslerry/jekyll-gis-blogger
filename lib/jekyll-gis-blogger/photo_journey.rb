# frozen_string_literal: true

require "rexml/document"
require "time"

module Jekyll
  module GisBlogger
    # Photo stories: a GPX track plus geotagged photos, read at build time with the
    # standard library only (a small EXIF reader; no gem dependency).
    #
    # A photo is placed by its EXIF GPS position when it has one; otherwise its EXIF
    # time (plus time_offset, for a camera clock that was off) is matched against the
    # track's timestamps and the position interpolated. `progress` (0..1) is how far
    # along the track, by distance, the photo was taken.
    module PhotoJourney
      module_function

      # ---------------------------------------------------------------- EXIF

      TAG_DESCRIPTION = 0x010E
      TAG_EXIF_IFD    = 0x8769
      TAG_GPS_IFD     = 0x8825
      TAG_DATETIME    = 0x9003
      TAG_OFFSET      = 0x9011
      TYPE_SIZES = { 1 => 1, 2 => 1, 3 => 2, 4 => 4, 5 => 8, 7 => 1, 9 => 4, 10 => 8 }.freeze

      # { lat:, lon:, time: (UTC Time), caption: } from a JPEG; {} if it has no EXIF.
      def read_exif(path)
        tiff = app1_tiff(File.binread(path))
        return {} unless tiff

        le = tiff[0, 2] == "II"
        u16 = ->(o) { tiff[o, 2].unpack1(le ? "v" : "n") }
        u32 = ->(o) { tiff[o, 4].unpack1(le ? "V" : "N") }
        ifd0 = read_ifd(tiff, u32.call(4), u16, u32, le)
        exif = ifd0[TAG_EXIF_IFD] ? read_ifd(tiff, ifd0[TAG_EXIF_IFD], u16, u32, le) : {}
        gps = ifd0[TAG_GPS_IFD] ? read_ifd(tiff, ifd0[TAG_GPS_IFD], u16, u32, le) : {}

        out = {}
        out[:caption] = ifd0[TAG_DESCRIPTION].to_s.strip if ifd0[TAG_DESCRIPTION]
        if gps[2] && gps[4]
          out[:lat] = dms(gps[2]) * (gps[1].to_s.start_with?("S") ? -1 : 1)
          out[:lon] = dms(gps[4]) * (gps[3].to_s.start_with?("W") ? -1 : 1)
        end
        if exif[TAG_DATETIME]
          offset = exif[TAG_OFFSET].to_s[/[+-]\d\d:\d\d/] || "+00:00"
          stamp = exif[TAG_DATETIME].to_s.sub(/\A(\d{4}):(\d\d):(\d\d)/, '\1-\2-\3')
          out[:time] = Time.parse("#{stamp} #{offset}").utc
        end
        out
      rescue StandardError
        {}
      end

      def app1_tiff(bytes)
        return nil unless bytes.byteslice(0, 2) == "\xFF\xD8".b

        pos = 2
        while pos + 4 <= bytes.bytesize
          marker, len = bytes.byteslice(pos, 4).unpack("nn")
          return nil if (marker & 0xFF00) != 0xFF00 || marker == 0xFFDA

          seg = bytes.byteslice(pos + 4, len - 2)
          return seg.byteslice(6..) if marker == 0xFFE1 && seg.start_with?("Exif\0\0".b)

          pos += 2 + len
        end
        nil
      end

      # Tag => value for one IFD (ASCII as String, rationals as Float arrays, ints as Integer).
      def read_ifd(tiff, off, u16, u32, little)
        n = u16.call(off)
        (0...n).each_with_object({}) do |i, h|
          e = off + 2 + i * 12
          tag, type = u16.call(e), u16.call(e + 2)
          count = u32.call(e + 4)
          size = TYPE_SIZES.fetch(type, 1) * count
          data = size <= 4 ? e + 8 : u32.call(e + 8)
          h[tag] = case type
                   when 2 then tiff[data, count].delete("\0")
                   when 3 then count == 1 ? u16.call(data) : (0...count).map { |k| u16.call(data + 2 * k) }
                   when 4 then count == 1 ? u32.call(data) : (0...count).map { |k| u32.call(data + 4 * k) }
                   when 5, 10
                     (0...count).map do |k|
                       num, den = tiff[data + 8 * k, 8].unpack(little ? "VV" : "NN")
                       den.zero? ? 0.0 : num.to_f / den
                     end
                   else tiff[data, size]
                   end
        end
      end

      def dms(parts)
        d, m, s = Array(parts) + [0, 0, 0]
        d + m / 60.0 + s / 3600.0
      end

      # ----------------------------------------------------------------- GPX

      # [{ lonlat: [lon, lat], time: Time|nil, dist: metres from start }]
      def read_gpx(text)
        doc = REXML::Document.new(text)
        pts = []
        REXML::XPath.each(doc, "//*[local-name()='trkpt' or local-name()='rtept']") do |p|
          t = p.elements.to_a.find { |c| c.name == "time" }&.text
          pts << { lonlat: [p.attributes["lon"].to_f, p.attributes["lat"].to_f], time: t && Time.parse(t).utc }
        end
        total = 0.0
        pts.each_with_index do |p, i|
          total += haversine(pts[i - 1][:lonlat], p[:lonlat]) if i.positive?
          p[:dist] = total
        end
        pts
      end

      def haversine((lon1, lat1), (lon2, lat2))
        rad = Math::PI / 180
        dlat = (lat2 - lat1) * rad
        dlon = (lon2 - lon1) * rad
        a = Math.sin(dlat / 2)**2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dlon / 2)**2
        2 * 6_371_000 * Math.asin(Math.sqrt(a))
      end

      # ----------------------------------------------------------- placement

      # { lonlat:, progress:, source: :gps|:time } or nil when the photo cannot be placed.
      def place(exif, track, time_offset: 0)
        return nil if track.size < 2

        total = track.last[:dist].to_f
        if exif[:lat] && exif[:lon]
          lonlat = [exif[:lon], exif[:lat]]
          dist = project(lonlat, track)
          return { lonlat: lonlat, progress: total.positive? ? dist / total : 0, source: :gps }
        end
        return nil unless exif[:time] && track.first[:time] && track.last[:time]

        t = exif[:time] + time_offset
        return nil if t < track.first[:time] || t > track.last[:time]

        a, b = track.each_cons(2).find { |p, q| t >= p[:time] && t <= q[:time] }
        f = b[:time] == a[:time] ? 0 : (t - a[:time]) / (b[:time] - a[:time])
        lonlat = [0, 1].map { |k| a[:lonlat][k] + (b[:lonlat][k] - a[:lonlat][k]) * f }
        dist = a[:dist] + (b[:dist] - a[:dist]) * f
        { lonlat: lonlat, progress: total.positive? ? dist / total : 0, source: :time }
      end

      # Distance along the track (m) of the point on it closest to lonlat.
      # Planar projection per segment: fine at photo-to-river distances.
      def project(lonlat, track)
        best = [Float::INFINITY, 0.0]
        track.each_cons(2) do |a, b|
          ax, ay = a[:lonlat]
          bx, by = b[:lonlat]
          dx, dy = bx - ax, by - ay
          len2 = dx * dx + dy * dy
          f = len2.zero? ? 0 : ((lonlat[0] - ax) * dx + (lonlat[1] - ay) * dy) / len2
          f = f.clamp(0, 1)
          px, py = ax + dx * f, ay + dy * f
          d2 = (lonlat[0] - px)**2 + (lonlat[1] - py)**2
          best = [d2, a[:dist] + (b[:dist] - a[:dist]) * f] if d2 < best[0]
        end
        best[1]
      end
    end
  end
end
