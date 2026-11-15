"""Lunar Light core: horizon ray casting, shadow fingerprints, solar position, PNG output.

All shadows come from elevation grids only (no hillshade or derived rasters as input).
Grid convention: row 0 is grid north, 'azimuth' is clockwise from grid north (up).
"""
from __future__ import annotations

import json
import struct
import zlib
from pathlib import Path

import numpy as np
from scipy import ndimage

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent


def load_settings():
    return json.loads((HERE / "settings.json").read_text(encoding="utf8"))


# --------------------------------------------------------------------------- shadows

def _bilinear(dem, r, c):
    """Bilinear sample with NaN outside the grid or next to NaN cells."""
    h, w = dem.shape
    r0 = np.floor(r).astype(np.int64)
    c0 = np.floor(c).astype(np.int64)
    fr = r - r0
    fc = c - c0
    inside = (r0 >= 0) & (c0 >= 0) & (r0 < h - 1) & (c0 < w - 1)
    r0c = np.clip(r0, 0, h - 2)
    c0c = np.clip(c0, 0, w - 2)
    a = dem[r0c, c0c]
    b = dem[r0c, c0c + 1]
    cc = dem[r0c + 1, c0c]
    d = dem[r0c + 1, c0c + 1]
    v = (a * (1 - fc) + b * fc) * (1 - fr) + (cc * (1 - fc) + d * fc) * fr
    v[~inside] = np.nan
    return v


def horizon(dem, rows, cols, az_deg, pixel_m, cap_m, radius_m):
    """For each observer pixel, the max elevation angle (as tangent) of terrain toward the Sun.

    Returns (max_tan, saw_gap). max_tan uses only valid samples; saw_gap is True when the ray
    met missing data or left the grid before reaching the cap.
    """
    az = np.radians(az_deg)
    dr, dc = -np.cos(az), np.sin(az)          # one pixel step toward the Sun, in grid units
    h0 = dem[rows, cols].astype(np.float64)
    best = np.full(h0.shape, -np.inf)
    gap = np.zeros(h0.shape, bool)
    steps = int(round(cap_m / pixel_m))
    for k in range(1, steps + 1):
        d = k * pixel_m
        s = _bilinear(dem, rows + k * dr, cols + k * dc)
        bad = np.isnan(s)
        gap |= bad
        t = (s - h0 - d * d / (2.0 * radius_m)) / d
        t[bad] = -np.inf
        np.maximum(best, t, out=best)
    return best, gap


def shadow_states(max_tan, gap, alt_deg):
    """0 = lit, 1 = shadow (blocked by known terrain), 2 = unresolved (no blocker found, data gap)."""
    blocked = max_tan > np.tan(np.radians(alt_deg))
    out = np.where(blocked, 1, np.where(gap, 2, 0)).astype(np.uint8)
    return out


# --------------------------------------------------------------------------- fingerprints

def _runs_along(state, valid, az_deg, pixel_m):
    """Lengths (km) of contiguous shadow runs measured along the Sun direction inside the core.

    A run is found from its far end (the shadow pixel whose next pixel away from the Sun is not
    shadow) by stepping toward the Sun until the shadow ends. Runs touching the core edge are
    truncated by the core size; the count of those is returned too.
    """
    n = state.shape[0]
    sh = (state == 1) & valid
    az = np.radians(az_deg)
    dr, dc = -np.cos(az), np.sin(az)
    step = 1.0 / max(abs(dr), abs(dc))          # one cell along the dominant axis
    sr, sc = dr * step, dc * step
    rr, cc = np.nonzero(sh)
    if rr.size == 0:
        return np.array([]), 0

    def at(r, c):
        ri = np.rint(r).astype(int)
        ci = np.rint(c).astype(int)
        ins = (ri >= 0) & (ci >= 0) & (ri < n) & (ci < n)
        v = np.zeros(r.shape, bool)
        v[ins] = sh[ri[ins], ci[ins]]
        return v, ins

    behind, ins_b = at(rr - sr, cc - sc)
    end = ~behind
    rr, cc = rr[end], cc[end]
    trunc = ~ins_b[end]
    length = np.ones(rr.shape)
    alive = np.ones(rr.shape, bool)
    for k in range(1, n * 2):
        v, ins = at(rr + k * sr, cc + k * sc)
        trunc |= alive & ~ins
        alive &= v
        if not alive.any():
            break
        length += alive
    seg_km = length * step * pixel_m / 1000.0 * np.hypot(dr, dc)
    return seg_km, int(trunc.sum())


def fingerprint(states_by_az, valid, azimuths, pixel_m):
    """Fingerprint for one Sun altitude: states_by_az is a list of uint8 core grids (one per azimuth)."""
    px_km2 = (pixel_m / 1000.0) ** 2
    fracs, unres, runs, patch_w, edges = [], [], [], [], []
    truncated = 0
    for st, az in zip(states_by_az, azimuths):
        res = valid & (st != 2)
        nres = res.sum()
        unres.append(1 - nres / max(valid.sum(), 1))
        if nres == 0:
            continue
        sh = (st == 1) & res
        fracs.append(sh.sum() / nres)
        r, t = _runs_along(st, valid, az, pixel_m)
        runs.append(r)
        truncated += t
        lab, nlab = ndimage.label(sh)
        if nlab:
            sizes = np.bincount(lab.ravel())[1:] * px_km2
            patch_w.append(sizes[lab[sh] - 1])
        # light/dark boundaries between resolved neighbours, km of edge per km^2 of resolved ground
        e = 0
        for a, b, ra, rb in ((sh[:, :-1], sh[:, 1:], res[:, :-1], res[:, 1:]),
                             (sh[:-1, :], sh[1:, :], res[:-1, :], res[1:, :])):
            e += ((a != b) & ra & rb).sum()
        edges.append(e * (pixel_m / 1000.0) / (nres * px_km2))
    allr = np.concatenate(runs) if runs else np.array([])
    allp = np.concatenate(patch_w) if patch_w else np.array([])
    dark_all = np.ones(valid.shape, bool)
    any_unres = np.zeros(valid.shape, bool)
    for st in states_by_az:
        dark_all &= st == 1
        any_unres |= st == 2
    denom = (valid & ~any_unres).sum()
    return {
        "shadow_fraction": float(np.mean(fracs)) if fracs else None,
        "shadow_run_km": float(np.median(allr)) if allr.size else None,
        "patch_km2": float(np.median(allp)) if allp.size else None,
        "edge_km_per_km2": float(np.mean(edges)) if edges else None,
        "always_dark_fraction": float((dark_all & valid).sum() / denom) if denom else None,
        "unresolved_fraction": float(np.mean(unres)),
        "runs_counted": int(allr.size),
        "runs_truncated_fraction": float(truncated / allr.size) if allr.size else None,
    }


def metric_similarity(a, b, scale):
    if a is None or b is None:
        return None
    lo, hi = scale["lo"], scale["hi"]
    if scale["kind"] == "log":
        a, b, lo, hi = (np.log10(max(x, lo)) for x in (a, b, lo, hi))
    return float(max(0.0, 1.0 - abs(min(max(a, lo), hi) - min(max(b, lo), hi)) / (hi - lo)))


# --------------------------------------------------------------------------- display

def surface_cos(dem, az_deg, alt_deg, pixel_m):
    """Cosine of the Sun incidence angle on each cell, from the elevation grid (display only)."""
    gy, gx = np.gradient(dem.astype(np.float64), pixel_m)
    dzdx, dzdn = gx, -gy                          # rows grow southward
    az, alt = np.radians(az_deg), np.radians(alt_deg)
    sx, sn, sz = np.sin(az) * np.cos(alt), np.cos(az) * np.cos(alt), np.sin(alt)
    return (-dzdx * sx - dzdn * sn + sz) / np.sqrt(dzdx ** 2 + dzdn ** 2 + 1)


def render_gray(cosi, state, water=None, shadow_level=6, scale=2):
    """8-bit greyscale view: lit cells shaded by incidence, shadow near-black, unresolved checked."""
    lit = state == 0
    q = np.nanpercentile(cosi[lit], 99) if lit.any() else 1.0
    v = 0.16 + 0.84 * np.clip(cosi / max(q, 1e-6), 0, 1) ** 0.8
    img = np.where(lit, v * 255, shadow_level).astype(np.float64)
    if scale > 1:
        img = ndimage.zoom(img, scale, order=1)
        st = np.kron(state, np.ones((scale, scale), np.uint8))
        wt = np.kron(water, np.ones((scale, scale), bool)) if water is not None else None
    else:
        st, wt = state, water
    yy, xx = np.indices(img.shape)
    unres = st == 2
    img[unres] = np.where(((yy[unres] // 4 + xx[unres] // 4) % 2) == 0, 92, 52)
    if wt is not None:
        img[wt] = np.where((yy[wt] % 6) < 2, 46, 24)
    return np.clip(img, 0, 255).astype(np.uint8)


def write_png(path, gray):
    """Minimal 8-bit greyscale PNG writer (stdlib only)."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    h, w = gray.shape
    raw = b"".join(b"\x00" + gray[i].tobytes() for i in range(h))

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 0, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    path.write_bytes(png)


# --------------------------------------------------------------------------- Sun on Earth

def solar_elevation(lat_deg, lon_deg, minutes, year):
    """Apparent solar elevation (deg) at UTC minutes since 1 Jan of `year` (NOAA algorithm,
    with the NOAA atmospheric refraction approximation)."""
    jd0 = _jd(year, 1, 1)  # 1 Jan, 0h UTC
    jd = jd0 + minutes / 1440.0
    t = (jd - 2451545.0) / 36525.0
    L0 = np.mod(280.46646 + t * (36000.76983 + t * 0.0003032), 360)
    M = 357.52911 + t * (35999.05029 - 0.0001537 * t)
    e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t)
    Mr = np.radians(M)
    C = np.sin(Mr) * (1.914602 - t * (0.004817 + 0.000014 * t)) + np.sin(2 * Mr) * (0.019993 - 0.000101 * t) + np.sin(3 * Mr) * 0.000289
    true_long = L0 + C
    omega = 125.04 - 1934.136 * t
    lam = true_long - 0.00569 - 0.00478 * np.sin(np.radians(omega))
    eps0 = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60
    eps = eps0 + 0.00256 * np.cos(np.radians(omega))
    decl = np.arcsin(np.sin(np.radians(eps)) * np.sin(np.radians(lam)))
    y = np.tan(np.radians(eps) / 2) ** 2
    L0r = np.radians(L0)
    eqt = 4 * np.degrees(y * np.sin(2 * L0r) - 2 * e * np.sin(Mr) + 4 * e * y * np.sin(Mr) * np.cos(2 * L0r)
                         - 0.5 * y * y * np.sin(4 * L0r) - 1.25 * e * e * np.sin(2 * Mr))
    tst = np.mod(np.mod(minutes, 1440) + eqt + 4 * lon_deg, 1440)
    ha = np.radians(tst / 4 - 180)
    latr = np.radians(lat_deg)
    cosz = np.clip(np.sin(latr) * np.sin(decl) + np.cos(latr) * np.cos(decl) * np.cos(ha), -1, 1)
    elev = 90 - np.degrees(np.arccos(cosz))
    # refraction (NOAA), degrees
    te = np.tan(np.radians(elev))
    r = np.zeros_like(elev)
    a = elev > 5
    r[a] = 58.1 / te[a] - 0.07 / te[a] ** 3 + 0.000086 / te[a] ** 5
    b = (elev > -0.575) & ~a
    eb = elev[b]
    r[b] = 1735 + eb * (-518.2 + eb * (103.4 + eb * (-12.79 + eb * 0.711)))
    c = elev <= -0.575
    r[c] = -20.774 / te[c]
    return elev + r / 3600.0


def _jd(y, m, d):
    if m <= 2:
        y -= 1
        m += 12
    a = y // 100
    b = 2 - a + a // 4
    return int(365.25 * (y + 4716)) + int(30.6001 * (m + 1)) + d + b - 1524.5


def low_sun_budget(lat, lon, year, band=(0, 7), step_min=1):
    """Hours per year with the apparent Sun inside `band`, the longest unbroken stretch, and when."""
    n = (366 if (year % 4 == 0 and (year % 100 or year % 400 == 0)) else 365) * 1440
    mins = np.arange(0, n, step_min, dtype=np.float64)
    el = solar_elevation(lat, lon, mins, year)
    low = (el > band[0]) & (el <= band[1])
    hours = float(low.sum() * step_min / 60.0)
    # longest run
    d = np.diff(np.concatenate(([0], low.astype(np.int8), [0])))
    starts, ends = np.nonzero(d == 1)[0], np.nonzero(d == -1)[0]
    if starts.size:
        k = int(np.argmax(ends - starts))
        run_h = float((ends[k] - starts[k]) * step_min / 60.0)
        run = (float(mins[starts[k]]), float(mins[ends[k] - 1]))
    else:
        run_h, run = 0.0, None
    # hours per month
    per_month = []
    days_in = [31, 29 if n == 366 * 1440 else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    edges = np.cumsum([0] + days_in) * 1440
    for i in range(12):
        sel = (mins >= edges[i]) & (mins < edges[i + 1])
        per_month.append(float(low[sel].sum() * step_min / 60.0))
    return {"hours": hours, "longest_h": run_h, "longest_span_min": run, "hours_by_month": per_month,
            "max_elev": float(el.max())}
