"""Re-rank without recomputing shadows: python tools/lunar_light/rerank.py

Reads every fingerprint from data/moon_fingerprints.csv (one row per place and Sun height) and the
weights, scales and time-score rules from settings.json, then recomputes every pair score and the
Earth ranking in data/moon_light.json. Adding a Moon target only needs its fingerprint rows
(python tools/lunar_light/build.py --moon <id>), never a new Earth run.
"""
from __future__ import annotations

import csv
import json

import numpy as np

from core import ROOT, load_settings, metric_similarity

OUT_JSON = ROOT / "data" / "moon_light.json"
FP_CSV = ROOT / "data" / "moon_fingerprints.csv"
METRICS = ["shadow_fraction", "shadow_run_km", "patch_km2", "edge_km_per_km2", "always_dark_fraction"]
EXTRA = ["unresolved_fraction", "runs_counted", "runs_truncated_fraction"]
COLUMNS = ["body", "id", "sun_alt_deg", *METRICS, *EXTRA]


# --------------------------------------------------------------------------- fingerprint table

def write_fingerprints(out):
    rows = []
    for body, key in (("Moon", "moon"), ("Earth", "earth")):
        for s in out[key]:
            for alt, f in s["fingerprint"].items():
                rows.append({"body": body, "id": s["id"], "sun_alt_deg": alt, **{k: f.get(k) for k in METRICS + EXTRA}})
    with FP_CSV.open("w", newline="", encoding="utf8") as fh:
        w = csv.DictWriter(fh, fieldnames=COLUMNS)
        w.writeheader()
        for r in rows:
            w.writerow({k: ("" if v is None else v) for k, v in r.items()})
    return len(rows)


def read_fingerprints():
    table = {}
    with FP_CSV.open(newline="", encoding="utf8") as fh:
        for r in csv.DictReader(fh):
            f = {}
            for k in METRICS + EXTRA:
                v = r[k]
                f[k] = None if v == "" else (int(float(v)) if k == "runs_counted" else float(v))
            table.setdefault((r["body"], r["id"]), {})[str(int(float(r["sun_alt_deg"])))] = f
    return table


# --------------------------------------------------------------------------- scoring

def pair_score(e, mo, S):
    reach = [a for a in S["sun_altitudes_deg"] if a <= mo["max_sun_deg"]] or [min(S["sun_altitudes_deg"])]
    per_metric = {k: [] for k in METRICS}
    per_alt = {}
    for a in reach:
        fe, fm = e["fingerprint"][str(a)], mo["fingerprint"][str(a)]
        sims = {k: metric_similarity(fe[k], fm[k], S["metric_scales"][k]) for k in METRICS}
        good = [v for v in sims.values() if v is not None]
        per_alt[str(a)] = float(np.mean(good)) if good else None
        for k, v in sims.items():
            if v is not None:
                per_metric[k].append(v)
    vals = [v for v in per_alt.values() if v is not None]
    return {
        "earth": e["id"], "moon": mo["id"], "altitudes": reach,
        "shadow": float(np.mean(vals)) if vals else None,
        "per_alt": per_alt, "per_metric": {k: (float(np.mean(v)) if v else None) for k, v in per_metric.items()},
    }


def time_score(budget, norm, S):
    wp = S["time_score_parts"]
    return (wp["hours"] * budget["hours"] / norm["hours_max"]
            + wp["stretch"] * np.log1p(budget["longest_h"]) / np.log1p(norm["longest_max_h"]))


def rank(out, S, table=None):
    """Recompute pairs, site scores and the ranking in place. `table` overrides fingerprints."""
    if table:
        for body, key in (("Moon", "moon"), ("Earth", "earth")):
            for s in out[key]:
                if (body, s["id"]) in table:
                    s["fingerprint"] = table[(body, s["id"])]
    for m in out["moon"]:
        m["max_sun_deg"] = 90 - abs(m["lat"]) + S["moon_axis_tilt_deg"]
    W = S["weights"]
    pairs = []
    for e in out["earth"]:
        e["budget"]["score"] = float(time_score(e["budget"], out["time_norm"], S))
        for mo in out["moon"]:
            p = pair_score(e, mo, S)
            p["time"] = e["budget"]["score"]
            p["total"] = W["shadow"] * p["shadow"] + W["time"] * p["time"] if p["shadow"] is not None else None
            pairs.append(p)
    for e in out["earth"]:
        mine = [p for p in pairs if p["earth"] == e["id"] and p["total"] is not None]
        e["best_moon"] = max(mine, key=lambda p: p["total"])["moon"]
        e["shadow_mean"] = float(np.mean([p["shadow"] for p in mine]))
        e["score"] = W["shadow"] * e["shadow_mean"] + W["time"] * e["budget"]["score"]
    out["earth"].sort(key=lambda e: -e["score"])
    out["pairs"] = pairs
    out["settings"] = S
    out["metrics"] = METRICS
    return out


def save(out):
    OUT_JSON.write_text(json.dumps(out, indent=1, allow_nan=False), encoding="utf8")


def main():
    S = load_settings()
    out = json.loads(OUT_JSON.read_text(encoding="utf8"))
    rank(out, S, read_fingerprints())
    save(out)
    for i, e in enumerate(out["earth"], 1):
        print(f"{i:2d}. {e['name']:22s} {e['score'] * 100:5.1f}  (shadow {e['shadow_mean'] * 100:.0f}, time {e['budget']['score'] * 100:.0f}, twin {e['best_moon']})")


if __name__ == "__main__":
    main()
