"""Build everything the Moon page shows.

  python tools/lunar_light/build.py               all places (Earth tiles are streamed once, then cached)
  python tools/lunar_light/build.py --moon ID ..  only the named Moon targets from sites.json, then re-rank
  python tools/lunar_light/rerank.py              re-rank only (after editing weights in settings.json)

Writes data/moon_light.json, data/moon_fingerprints.csv and images/moon/*.png.
"""
from __future__ import annotations

import datetime as dt
import json
import sys
import time

import numpy as np
import rasterio
from rasterio.windows import Window

from core import (ROOT, HERE, load_settings, horizon, shadow_states, fingerprint,
                  surface_cos, render_gray, write_png, low_sun_budget)
from rerank import rank, save, write_fingerprints, FP_CSV
from dems import moon_tile, earth_tile, grid_px, MOON_DEM

OUT_JSON = ROOT / "data" / "moon_light.json"
IMG = ROOT / "images" / "moon"


def log(*a):
    print(*a, flush=True)


def analyse(body, site, tile, S):
    px, core = S["pixel_m"], S["core_px"]
    m = (grid_px(S) - core) // 2
    dem = tile["dem"]
    cdem = dem[m:m + core, m:m + core]
    water = tile.get("water")
    cwater = water[m:m + core, m:m + core] if water is not None else np.zeros_like(cdem, bool)
    valid = ~np.isnan(cdem) & ~cwater
    rows, cols = np.indices((core, core))
    rows, cols = rows + m, cols + m
    R = S["radius_m"][body]
    hz = {}
    for az in S["sun_azimuths_deg"]:
        hz[az] = horizon(dem, rows, cols, az, px, S["shadow_cap_m"], R)
    fps = {}
    for alt in S["sun_altitudes_deg"]:
        states = [shadow_states(*hz[az], alt) for az in S["sun_azimuths_deg"]]
        fps[str(alt)] = fingerprint(states, valid, S["sun_azimuths_deg"], px)
    # display images: one Sun direction, every altitude
    images = {}
    az = S["display_azimuth_deg"]
    for alt in S["sun_altitudes_deg"]:
        st = shadow_states(*hz[az], alt)
        cosi = surface_cos(cdem, az, alt, px)
        g = render_gray(cosi, st, water=cwater if cwater.any() else None,
                        shadow_level=6 if body == "Moon" else 34, scale=2)
        name = f"{body.lower()}_{site['id']}_alt{alt}.png"
        write_png(IMG / name, g)
        images[str(alt)] = f"images/moon/{name}"
    elev = cdem[valid]
    terrain = {
        "relief_m": float(np.ptp(elev)) if elev.size else None,
        "elev_min_m": float(elev.min()) if elev.size else None,
        "elev_max_m": float(elev.max()) if elev.size else None,
        "valid_fraction": float(valid.mean()),
        "water_fraction": float(cwater.mean()),
        "nodata_fraction": float(np.isnan(cdem).mean()),
    }
    return fps, images, terrain


def overview(S, moon_sites):
    """Whole south-pole view at 320 m with a 1 degree Sun, cast from the elevation mosaic."""
    step = 4
    half_km = 160
    with rasterio.open(MOON_DEM) as d:
        n_full = int(half_km * 2 * 1000 / S["pixel_m"])
        c0 = d.width // 2 - n_full // 2
        pad = int(S["shadow_cap_m"] / S["pixel_m"])
        win = Window(c0 - pad, c0 - pad, n_full + 2 * pad, n_full + 2 * pad)
        a = d.read(1, window=win, out_shape=((n_full + 2 * pad) // step, (n_full + 2 * pad) // step),
                   resampling=rasterio.enums.Resampling.average).astype(np.float32)
    px = S["pixel_m"] * step
    p = pad // step
    n = n_full // step
    rows, cols = np.indices((n, n))
    az, alt = S["display_azimuth_deg"], 1
    mt, gap = horizon(a, rows + p, cols + p, az, px, S["shadow_cap_m"], S["radius_m"]["Moon"])
    st = shadow_states(mt, gap, alt)
    cosi = surface_cos(a[p:p + n, p:p + n], az, alt, px)
    write_png(IMG / "moon_overview.png", render_gray(cosi, st, shadow_level=4, scale=1))
    return {"image": "images/moon/moon_overview.png", "half_km": half_km, "pixel_m": px, "sun_alt": alt,
            "sun_az": az, "marks": marks(moon_sites, half_km), "shadow_fraction": float((st == 1).mean())}


def marks(moon, half_km):
    return [{"id": s["id"], "fx": round((s["x"] + half_km * 1000) / (2 * half_km * 1000), 4),
             "fy": round((half_km * 1000 - s["y"]) / (2 * half_km * 1000), 4)} for s in moon]


def analyse_moon(s, S, taken, t0):
    tile = moon_tile(s, S, taken=taken)
    fps, imgs, terrain = analyse("Moon", s, tile, S)
    max_sun = 90 - abs(tile["lat"]) + S["moon_axis_tilt_deg"]
    log(f"moon  {s['id']:16s} lat {tile['lat']:.2f} lon {tile['lon']:.2f} maxsun {max_sun:.2f}  "
        f"sf1 {fps['1']['shadow_fraction']:.2f} relief {terrain['relief_m']:.0f}  {tile['note'] or ''}  {time.time() - t0:.0f}s")
    return {**{k: s[k] for k in ("id", "name", "blurb")}, "lat": tile["lat"], "lon": tile["lon"],
            "x": tile["x"], "y": tile["y"], "located_by": tile["note"], "max_sun_deg": max_sun,
            "fingerprint": fps, "images": imgs, "terrain": terrain}


def add_moon(ids, S, sites, t0):
    """Fingerprint only the named Moon targets, keep every Earth result, then re-rank."""
    out = json.loads(OUT_JSON.read_text(encoding="utf8"))
    known = {s["id"]: s for s in sites["moon"]}
    for i in ids:
        if i not in known:
            sys.exit(f"{i} is not in sites.json")
        others = [m for m in out["moon"] if m["id"] != i]
        rec = analyse_moon(known[i], S, [(m["x"], m["y"]) for m in others], t0)
        out["moon"] = others + [rec]
    order = [s["id"] for s in sites["moon"]]
    out["moon"].sort(key=lambda m: order.index(m["id"]) if m["id"] in order else len(order))
    if out.get("overview"):
        out["overview"]["marks"] = marks(out["moon"], out["overview"]["half_km"])
    return out


def main():
    t0 = time.time()
    S = load_settings()
    sites = json.loads((HERE / "sites.json").read_text(encoding="utf8"))
    IMG.mkdir(parents=True, exist_ok=True)
    args = sys.argv[1:]
    if args[:1] == ["--moon"]:
        out = add_moon(args[1:], S, sites, t0)
        finish(out, S, t0)
        return

    moon = []
    for s in sites["moon"]:
        moon.append(analyse_moon(s, S, [(m["x"], m["y"]) for m in moon], t0))
    curve_step = 10
    lat_curve = []
    for lat in range(-90, 91, 2):
        b = low_sun_budget(float(lat), 0.0, S["budget_year"], tuple(S["low_sun_band_deg"]), curve_step)
        lat_curve.append({"lat": lat, "hours": round(b["hours"], 1), "longest_h": round(b["longest_h"], 1)})
    h_max = max(c["hours"] for c in lat_curve)
    run_max = max(c["longest_h"] for c in lat_curve)
    log(f"latitude curve done: max hours {h_max:.0f}, max stretch {run_max:.0f} h  {time.time() - t0:.0f}s")

    earth = []
    for s in sites["earth"]:
        tile = earth_tile(s, S)
        fps, imgs, terrain = analyse("Earth", s, tile, S)
        b = low_sun_budget(s["lat"], s["lon"], S["budget_year"], tuple(S["low_sun_band_deg"]), curve_step)
        y0 = dt.datetime(S["budget_year"], 1, 1)
        span = b["longest_span_min"]
        window = None
        if span:
            window = {"start": (y0 + dt.timedelta(minutes=span[0])).isoformat(timespec="minutes"),
                      "end": (y0 + dt.timedelta(minutes=span[1])).isoformat(timespec="minutes")}
        earth.append({**{k: s[k] for k in ("id", "name", "place", "lat", "lon", "blurb")},
                      "epsg": tile["epsg"], "sources": tile["sources"], "ocean_tiles": tile["missing"],
                      "fingerprint": fps, "images": imgs, "terrain": terrain,
                      "budget": {"hours": b["hours"], "longest_h": b["longest_h"], "longest_window": window,
                                 "hours_by_month": b["hours_by_month"], "max_elev": b["max_elev"]}})
        log(f"earth {s['id']:16s} sf1 {fps['1']['shadow_fraction']:.2f} hours {b['hours']:.0f} run {b['longest_h']:.0f}h "
            f"relief {terrain['relief_m']:.0f} water {terrain['water_fraction']:.2f}  {time.time() - t0:.0f}s")

    ov = overview(S, moon)
    out = {
        "generated": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "settings": S,
        "time_norm": {"hours_max": h_max, "longest_max_h": run_max, "curve_step_min": curve_step},
        "lat_curve": lat_curve,
        "moon": moon, "earth": earth, "pairs": [], "overview": ov,
        "files": {
            "moon_dem": {"path": "moon_data/The moon/The moon/LDEM_80S_80MPP_ADJ.tiff", "pixel_m": 80,
                         "size_px": [7600, 7600], "extent_km": 608, "crs": "Polar stereographic, Moon sphere R = 1737.4 km"},
            "earth_dem": {"product": "Copernicus GLO-30 DSM", "native": "1 arc-second (~30 m)", "resampled_m": 80,
                          "url": "https://copernicus-dem-30m.s3.amazonaws.com/readme.html"},
            "grid_px": grid_px(S),
        },
    }
    finish(out, S, t0)


def finish(out, S, t0):
    out["generated"] = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    n = write_fingerprints(out)
    rank(out, S)
    save(out)
    log(f"wrote {OUT_JSON.relative_to(ROOT)} and {FP_CSV.relative_to(ROOT)} ({n} rows)  {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
