"""Elevation tiles for Lunar Light.

Moon: windows cut from the LOLA south-pole mosaic in moon_data/ (80 m, polar stereographic).
Earth: Copernicus GLO-30 DSM, streamed from the public AWS bucket, averaged onto an 80 m grid
in the site's local UTM zone, and cached in moon_data/lunar_light_cache/.
Every tile is a square of core + 2 x shadow cap, so rays from every core pixel can reach the cap.
"""
from __future__ import annotations

import math
from pathlib import Path

import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.transform import from_origin
from rasterio.warp import reproject, transform, transform_bounds, Resampling
from rasterio.windows import Window, from_bounds

from core import ROOT, load_settings

MOON_DEM = ROOT / "moon_data" / "The moon" / "The moon" / "LDEM_80S_80MPP_ADJ.tiff"
CACHE = ROOT / "moon_data" / "lunar_light_cache"
GLO30 = "https://copernicus-dem-30m.s3.amazonaws.com/{n}/{n}.tif"
MOON_GEO = CRS.from_proj4("+proj=longlat +R=1737400 +no_defs")


def grid_px(S):
    return S["core_px"] + 2 * int(round(S["shadow_cap_m"] / S["pixel_m"]))


# --------------------------------------------------------------------------- Moon

def moon_tile(site, S, taken=()):
    """Returns dict(dem, centre_lat, centre_lon, note) for a Moon site."""
    n = grid_px(S)
    with rasterio.open(MOON_DEM) as d:
        (x,), (y,) = transform(MOON_GEO, d.crs, [site["lon"]], [site["lat"]])
        note = None
        if site["kind"] in ("rim", "peak"):
            x, y, note = _locate(d, x, y, site, taken, S["core_px"] * S["pixel_m"])
        col, row = ~d.transform * (x, y)
        r0, c0 = int(round(row)) - n // 2, int(round(col)) - n // 2
        dem = d.read(1, window=Window(c0, r0, n, n), boundless=True, fill_value=np.nan).astype(np.float32)
        cx, cy = d.transform * (c0 + n / 2, r0 + n / 2)
        (lon,), (lat,) = transform(d.crs, MOON_GEO, [cx], [cy])
        crs = d.crs.to_string()
    return {"dem": dem, "lat": lat, "lon": lon, "note": note, "crs": crs, "x": cx, "y": cy}


def _locate(d, x, y, site, taken=(), keep_out=0.0):
    """Find a rim or peak from the elevation itself: the highest point on the rim annulus
    (0.85–1.15 x radius) or the highest point within search_km. Reads a decimated window."""
    rad = (site.get("diam_km", 0) / 2 * 1000) if site["kind"] == "rim" else site["search_km"] * 1000
    outer = rad * (1.15 if site["kind"] == "rim" else 1.0)
    win = from_bounds(x - outer, y - outer, x + outer, y + outer, d.transform).round_offsets().round_lengths()
    a = d.read(1, window=win, boundless=True, fill_value=np.nan)
    t = d.window_transform(win)
    rr, cc = np.indices(a.shape)
    xs, ys = t * (cc + 0.5, rr + 0.5)
    dist = np.hypot(xs - x, ys - y)
    ok = (dist >= 0.85 * rad) & (dist <= outer) if site["kind"] == "rim" else dist <= outer
    for tx, ty in taken:                       # keep places distinct: no overlap with earlier tiles
        ok &= np.hypot(xs - tx, ys - ty) >= keep_out
    if not ok.any():
        raise ValueError(f"{site['id']}: no rim/peak candidate left after excluding earlier tiles")
    a = np.where(ok, a, -np.inf)
    i = np.unravel_index(np.nanargmax(a), a.shape)
    rel = float(a[i] - np.nanmin(np.where(ok, d.read(1, window=win, boundless=True, fill_value=np.nan), np.nan)))
    what = "highest rim point" if site["kind"] == "rim" else "highest point"
    return float(xs[i]), float(ys[i]), f"{what}, {rel:,.0f} m above the lowest ground within {outer / 1000:.0f} km"


# --------------------------------------------------------------------------- Earth

def _tile_name(lat, lon):
    ns = "N" if lat >= 0 else "S"
    ew = "E" if lon >= 0 else "W"
    return f"Copernicus_DSM_COG_10_{ns}{abs(lat):02d}_00_{ew}{abs(lon):03d}_00_DEM"


def earth_tile(site, S, refresh=False):
    """Returns dict(dem, water, missing, crs, sources) for an Earth site (cached GeoTIFF)."""
    n = grid_px(S)
    px = S["pixel_m"]
    zone = int((site["lon"] + 180) // 6) + 1
    epsg = (32600 if site["lat"] >= 0 else 32700) + zone
    crs = CRS.from_epsg(epsg)
    (x,), (y,) = transform("EPSG:4326", crs, [site["lon"]], [site["lat"]])
    half = n * px / 2
    dst_t = from_origin(x - half, y + half, px, px)
    path = CACHE / f"earth_{site['id']}.tif"
    if path.exists() and not refresh:
        with rasterio.open(path) as f:
            dem, water = f.read(1), f.read(2) > 0.5
            sources = f.tags().get("sources", "").split(";")
            missing = f.tags().get("missing", "")
        return {"dem": dem, "water": water, "crs": crs.to_string(), "sources": [s for s in sources if s],
                "missing": [m for m in missing.split(";") if m], "epsg": epsg}

    lon0, lat0, lon1, lat1 = transform_bounds(crs, "EPSG:4326", x - half, y - half, x + half, y + half, densify_pts=41)
    if lon1 < lon0:
        raise ValueError("antimeridian crossing not supported")
    dem = np.full((n, n), np.nan, np.float32)
    zero = np.full((n, n), np.nan, np.float32)
    sources, missing = [], []
    for la in range(math.floor(lat0), math.floor(lat1) + 1):
        for lo in range(math.floor(lon0), math.floor(lon1) + 1):
            name = _tile_name(la, lo)
            try:
                src = rasterio.open("/vsicurl/" + GLO30.format(n=name))
            except rasterio.errors.RasterioIOError:
                missing.append(name)       # GLO-30 has no tile where there is only ocean
                continue
            with src:
                pad = 0.02
                win = from_bounds(max(lon0 - pad, src.bounds.left), max(lat0 - pad, src.bounds.bottom),
                                  min(lon1 + pad, src.bounds.right), min(lat1 + pad, src.bounds.top), src.transform)
                win = win.round_offsets().round_lengths()
                if win.width <= 0 or win.height <= 0:
                    continue
                a = src.read(1, window=win).astype(np.float32)
                if src.nodata is not None:
                    a[a == src.nodata] = np.nan
                wt = src.window_transform(win)
                for arr, out in ((a, dem), ((a == 0).astype(np.float32), zero)):
                    tmp = np.full((n, n), np.nan, np.float32)
                    reproject(arr, tmp, src_transform=wt, src_crs=src.crs, dst_transform=dst_t, dst_crs=crs,
                              resampling=Resampling.average, src_nodata=np.nan, dst_nodata=np.nan)
                    fill = np.isnan(out) & ~np.isnan(tmp)
                    out[fill] = tmp[fill]
                sources.append(name)
    gap = np.isnan(dem)
    if missing:
        # Pixels that fall in a tile GLO-30 does not publish are open ocean: sea level, masked.
        dem[gap] = 0.0
        zero[gap] = 1.0
    water = np.nan_to_num(zero, nan=0.0) > 0.5
    CACHE.mkdir(parents=True, exist_ok=True)
    with rasterio.open(path, "w", driver="GTiff", width=n, height=n, count=2, dtype="float32", crs=crs,
                       transform=dst_t, nodata=np.nan, compress="deflate") as f:
        f.write(dem, 1)
        f.write(water.astype(np.float32), 2)
        f.update_tags(sources=";".join(sources), missing=";".join(missing))
    return {"dem": dem, "water": water, "crs": crs.to_string(), "sources": sources, "missing": missing, "epsg": epsg}
