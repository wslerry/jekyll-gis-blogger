"""Dummy river journey for the photo-story example: a GPX track with timestamps and
JPEG "photos" with real EXIF (some with GPS, some with only a timestamp).
Everything is made up; the river line only roughly follows the Congo.

    quv run dem -- python _tools/make_photos.py        (from example/)
Also writes the gem's test fixtures (test/fixtures/).
"""
import math
import os
from datetime import datetime, timedelta, timezone

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
EX = os.path.dirname(HERE)
FIX = os.path.join(os.path.dirname(EX), "test", "fixtures")
PHOTOS = os.path.join(EX, "assets", "congo", "photos")
os.makedirs(PHOTOS, exist_ok=True)
os.makedirs(FIX, exist_ok=True)

# Rough river waypoints, Kisangani -> Kinshasa (lon, lat).
RIVER = [(25.19, 0.52), (24.25, 0.77), (23.3, 1.4), (22.47, 2.19), (21.51, 2.15), (20.4, 1.6),
         (19.3, 0.9), (18.26, 0.05), (17.4, -1.0), (16.23, -2.16), (15.9, -3.2), (15.31, -4.32)]
START = datetime(2026, 3, 2, 6, 0, tzinfo=timezone.utc)
DAYS = 9


def densify(points, per_leg=20):
    out = []
    for (x0, y0), (x1, y1) in zip(points, points[1:]):
        for i in range(per_leg):
            t = i / per_leg
            # small meander so it looks like a river, not a ruler
            wob = math.sin(t * math.pi * 3) * 0.04
            out.append((x0 + (x1 - x0) * t + wob * (y1 - y0), y0 + (y1 - y0) * t - wob * (x1 - x0)))
    out.append(points[-1])
    return out


track = densify(RIVER)
step = timedelta(days=DAYS) / (len(track) - 1)
times = [START + step * i for i in range(len(track))]


def write_gpx(path, pts, ts):
    rows = "\n".join(
        f'      <trkpt lat="{y:.5f}" lon="{x:.5f}"><time>{t.strftime("%Y-%m-%dT%H:%M:%SZ")}</time></trkpt>'
        for (x, y), t in zip(pts, ts))
    with open(path, "w", encoding="utf-8") as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="dummy" xmlns="http://www.topografix.com/GPX/1/1">\n'
                f'  <trk><name>Down the river (dummy)</name><trkseg>\n{rows}\n  </trkseg></trk>\n</gpx>\n')


def dms(v):
    v = abs(v)
    d = int(v)
    m = int((v - d) * 60)
    s = round(((v - d) * 60 - m) * 60, 2)
    return (float(d), float(m), s)  # Pillow stores floats as EXIF rationals


def photo(path, title, when, lonlat=None, hue=0, clock_offset=timedelta(0), size=(960, 640)):
    w, h = size
    img = Image.new("RGB", size)
    px = ImageDraw.Draw(img)
    # Dummy "landscape": sky, river band, forest band, tinted per photo.
    for y in range(h):
        t = y / h
        base = (int(120 + 100 * (1 - t)), int(150 + 60 * (1 - t)), int(190 - 80 * t)) if t < 0.45 else \
               (int(40 + 30 * t), int(90 + 50 * (1 - t)), int(60 + 20 * t)) if t < 0.7 else \
               (int(90 + 40 * t), int(110 + 30 * t), int(120 + 30 * t))
        r, g, b = base
        px.line([(0, y), (w, y)], fill=((r + hue) % 256, g, (b + hue // 2) % 256))
    px.rectangle([24, h - 70, w - 24, h - 24], fill=(0, 0, 0))
    px.text((40, h - 58), f"{title}  (dummy photo)", fill=(255, 255, 255))

    exif = Image.Exif()
    exif[0x010E] = title                                   # ImageDescription -> caption
    exif[0x0110] = "Dummy Camera"                         # Model
    ex = exif.get_ifd(0x8769)
    local = (when + clock_offset).astimezone(timezone(timedelta(hours=1)))  # camera set to local time (UTC+1)
    ex[0x9003] = local.strftime("%Y:%m:%d %H:%M:%S")      # DateTimeOriginal
    ex[0x9011] = "+01:00"                                  # OffsetTimeOriginal
    if lonlat:
        lon, lat = lonlat
        gps = exif.get_ifd(0x8825)
        gps[1] = "N" if lat >= 0 else "S"
        gps[2] = dms(lat)
        gps[3] = "E" if lon >= 0 else "W"
        gps[4] = dms(lon)
    img.save(path, "JPEG", quality=78, exif=exif)


def along(frac):
    i = frac * (len(track) - 1)
    k = min(int(i), len(track) - 2)
    t = i - k
    (x0, y0), (x1, y1) = track[k], track[k + 1]
    return (x0 + (x1 - x0) * t, y0 + (y1 - y0) * t), START + timedelta(days=DAYS) * frac


SHOTS = [
    (0.02, "Kisangani at dawn, loading the boat", True),
    (0.12, "Fishermen at the Wagenia falls", False),
    (0.22, "A storm builds over the forest", True),
    (0.33, "Market day on the riverbank", False),
    (0.45, "Children racing the boat in pirogues", True),
    (0.55, "The river widens past Mbandaka", False),
    (0.66, "Sunset on the equator", True),
    (0.78, "Islands of water hyacinth", False),
    (0.9, "The last rapids before the city", True),
]

write_gpx(os.path.join(EX, "assets", "congo", "river.gpx"), track, times)
for i, (frac, title, with_gps) in enumerate(SHOTS, start=1):
    (lon, lat), when = along(frac)
    photo(os.path.join(PHOTOS, f"{i:02d}.jpg"), title, when, (lon, lat) if with_gps else None, hue=i * 23)
# Taken before the trip started: no GPS and outside the track's time range -> skipped with a warning.
photo(os.path.join(PHOTOS, "10.jpg"), "Packing at home", START - timedelta(days=3), None, hue=200)

# Gem test fixtures: small, known values.
fix_track = [(25.0, 0.0), (26.0, 0.0), (27.0, 0.0)]
fix_times = [START, START + timedelta(hours=1), START + timedelta(hours=2)]
write_gpx(os.path.join(FIX, "line.gpx"), fix_track, fix_times)
photo(os.path.join(FIX, "gps.jpg"), "With GPS", START + timedelta(minutes=10), (25.5, -0.25), size=(64, 48))
photo(os.path.join(FIX, "time.jpg"), "Time only", START + timedelta(minutes=90), None, size=(64, 48))
print("wrote", len(SHOTS) + 1, "photos, river.gpx and test fixtures")
