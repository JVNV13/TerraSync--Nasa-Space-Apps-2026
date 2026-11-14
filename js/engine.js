// TerraSync similarity engine.
// Scores how well a candidate site (usually Earth) reproduces a target site
// (Mars / Moon) along nine analog dimensions. Every score is derived from CSV
// fields; missing values are skipped (and reported as reduced coverage), never imputed.
//
// Numeric similarity uses a FIXED physical scale per field (lo..hi):
// 1 − |a − b| / (hi − lo), with both values clamped to the scale. The scale never
// depends on which records are loaded, so adding or removing a site cannot change
// the score of any other pair.

export const DIMENSIONS = [
  { key: 'geology', label: 'Geology & minerals', short: 'GEO', blurb: 'Overlap of mineral groups, minerals and rock types.',
    features: [
      { key: 'geology.mineral_groups', kind: 'set', w: 0.5 },
      { key: 'geology.minerals', kind: 'set', w: 0.3 },
      { key: 'geology.rock_types', kind: 'set', w: 0.2 },
    ] },
  { key: 'terrain', label: 'Terrain & topography', short: 'TER', blurb: 'Landform class, slope distribution, roughness, cratering.',
    features: [
      { key: 'terrain.classification', kind: 'class', w: 0.25 },
      // Slopes are compared as whole distributions. Mean and max are used only when a site has no distribution.
      { key: 'terrain.slope_hist_1deg', kind: 'dist', w: 0.3 },
      { key: 'terrain.slope_mean_deg', kind: 'num', w: 0.2, scale: [0, 35], why: 'flat to the ~35° angle of repose of loose dry regolith', fallbackFor: 'terrain.slope_hist_1deg' },
      { key: 'terrain.slope_max_deg', kind: 'num', w: 0.1, scale: [0, 90], why: 'flat to vertical', fallbackFor: 'terrain.slope_hist_1deg' },
      { key: 'terrain.roughness_index', kind: 'num', w: 0.2, scale: [0, 1], why: 'index defined on 0–1' },
      { key: 'terrain.crater_density_gt1km_per_1e6km2', kind: 'num', log: true, w: 0.15, scale: [0, 100000], why: 'uncratered to ~10⁵ per 10⁶ km², the order of crater saturation for D > 1 km' },
      { key: 'terrain.is_impact_structure', kind: 'bool', w: 0.1 },
    ] },
  { key: 'thermal', label: 'Thermal & light', short: 'THM', blurb: 'Temperature regime, surface irradiance and UV.',
    features: [
      { key: 'environment.temperature_c.mean', kind: 'num', w: 0.3, scale: [-150, 60], why: 'Mars polar-winter CO₂ frost to the hottest Earth ground-level air' },
      { key: 'environment.temperature_c.min', kind: 'num', w: 0.25, scale: [-150, 60], why: 'same span as mean temperature' },
      { key: 'environment.temperature_c.max', kind: 'num', w: 0.15, scale: [-150, 60], why: 'same span as mean temperature' },
      { key: 'environment.solar_irradiance_surface_mean_wm2', kind: 'num', w: 0.15, scale: [0, 1361], why: 'darkness to the solar constant at 1 AU' },
      { key: 'environment.uv_exposure_index', kind: 'num', w: 0.15, scale: [0, 1], why: 'index defined on 0–1' },
    ] },
  { key: 'aeolian', label: 'Dust & wind', short: 'AEO', blurb: 'Dust activity, storm frequency, wind regime, erosion style.',
    features: [
      { key: 'environment.dust_activity_index', kind: 'num', w: 0.3, scale: [0, 1], why: 'index defined on 0–1' },
      { key: 'environment.dust_storms_per_earth_year', kind: 'num', w: 0.2, log: true, scale: [0, 365], why: 'none to one storm per day' },
      { key: 'environment.wind_speed_ms.mean', kind: 'num', w: 0.15, scale: [0, 25], why: 'calm to the windiest long-term station means on Earth' },
      { key: 'environment.wind_speed_ms.gust_max', kind: 'num', w: 0.15, scale: [0, 100], why: 'calm to the strongest non-tornadic surface gusts recorded' },
      { key: 'environment.erosion_indicators', kind: 'words', w: 0.2 },
    ] },
  { key: 'water', label: 'Water & ice', short: 'H₂O', blurb: 'Ice probability, hydrated minerals, water content, aridity.',
    features: [
      { key: 'water_resources.water_availability_index', kind: 'num', w: 0.2, scale: [0, 1], why: 'index defined on 0–1' },
      { key: 'water_resources.surface_ice_probability', kind: 'num', w: 0.15, scale: [0, 1], why: 'probability' },
      { key: 'water_resources.subsurface_ice_probability', kind: 'num', w: 0.2, scale: [0, 1], why: 'probability' },
      { key: 'water_resources.hydrated_minerals_present', kind: 'bool', w: 0.1 },
      { key: 'water_resources.hydrated_mineral_types', kind: 'set', w: 0.15 },
      { key: 'water_resources.regolith_water_equivalent_wt_pct', kind: 'num', log: true, w: 0.2, scale: [0, 100], why: 'dry to pure water ice, weight percent' },
    ] },
  { key: 'habitability', label: 'Habitability & biosignatures', short: 'BIO', blurb: 'Biosphere sparseness, rainfall and biosignature preservation.',
    features: [
      { key: 'habitability.vegetation_cover_pct', kind: 'num', w: 0.3, scale: [0, 100], why: 'percent cover' },
      { key: 'environment.annual_liquid_precipitation_mm', kind: 'num', log: true, w: 0.3, scale: [0, 12000], why: 'none to the wettest long-term station means on Earth' },
      { key: 'habitability.biosignature_preservation_potential', kind: 'num', w: 0.4, scale: [0, 1], why: 'index defined on 0–1' },
    ] },
  { key: 'subsurface', label: 'Caves & subsurface', short: 'SUB', blurb: 'Lava tubes and caves (scored only if the target has them).',
    onlyIfTarget: s => s['subsurface.cave_present'] === true || s['subsurface.lava_tube_present'] === true,
    features: [
      { key: 'subsurface.lava_tube_present', kind: 'bool', w: 0.6 },
      { key: 'subsurface.cave_present', kind: 'bool', w: 0.4 },
    ] },
  { key: 'processes', label: 'Processes & themes', short: 'PRC', blurb: 'Shared analog themes and geological features.',
    features: [
      { key: 'analog_tags', kind: 'words', w: 0.6 },
      { key: 'geology.geological_features', kind: 'words', w: 0.4 },
    ] },
  { key: 'operations', label: 'Surface operations', short: 'OPS', blurb: 'Trafficability and worst-case slopes for rovers and crews.',
    features: [
      { key: 'exploration.trafficability_index', kind: 'num', w: 0.6, scale: [0, 1], why: 'index defined on 0–1' },
      { key: 'exploration.landing_suitability_index', kind: 'num', w: 0.4, scale: [0, 1], why: 'index defined on 0–1' },
    ] },
];

// Mission profiles = weight presets. They change emphasis, never the data.
export const PROFILES = {
  balanced: { label: 'Balanced survey', desc: 'Every dimension counts equally.',
    w: { geology: 1, terrain: 1, thermal: 1, aeolian: 1, water: 1, habitability: 1, subsurface: 1, processes: 1, operations: 1 } },
  life: { label: 'Life detection', desc: 'Biosignatures, aqueous minerals, habitability limits.',
    w: { geology: 1.2, terrain: 0.4, thermal: 0.6, aeolian: 0.4, water: 1.4, habitability: 2.2, subsurface: 0.8, processes: 1.4, operations: 0.3 } },
  isru: { label: 'Resource prospecting', desc: 'Water ice, hydrated minerals, regolith chemistry.',
    w: { geology: 1.3, terrain: 0.6, thermal: 0.9, aeolian: 0.4, water: 2.4, habitability: 0.3, subsurface: 0.8, processes: 1, operations: 0.8 } },
  mobility: { label: 'Rover & landing ops', desc: 'Slopes, roughness, dust and trafficability.',
    w: { geology: 0.5, terrain: 2.2, thermal: 0.8, aeolian: 1.4, water: 0.3, habitability: 0.1, subsurface: 0.4, processes: 0.6, operations: 2.2 } },
  geology: { label: 'Field geology training', desc: 'Rocks, minerals, landforms, processes.',
    w: { geology: 2.2, terrain: 1.3, thermal: 0.3, aeolian: 0.7, water: 1, habitability: 0.4, subsurface: 0.6, processes: 1.8, operations: 0.4 } },
  shelter: { label: 'Subsurface habitat', desc: 'Lava tubes and caves for shielding and stable climate.',
    w: { geology: 0.8, terrain: 0.8, thermal: 0.8, aeolian: 0.3, water: 0.6, habitability: 0.4, subsurface: 2.8, processes: 1.4, operations: 0.6 } },
};

// Physical constants (not from the CSV) used only to explain where Earth cannot be an analog.
export const GRAVITY = { Earth: 9.81, Mars: 3.72, Moon: 1.62 };

const STOP = new Set(['and', 'of', 'the', 'with', 'source', 'limit', 'near', 'site', 'early', 'young', 'fresh', 'mars', 'earth']);

const transform = (f, v) => (f.log ? Math.log10(v + 1) : v);
const clampTo = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v));

/** Similarity of two numbers on a fixed physical scale. Independent of the loaded records. */
export function scaledSim(f, va, vb) {
  const [lo, hi] = f.scale;
  const span = transform(f, hi) - transform(f, lo);
  return Math.max(0, 1 - Math.abs(transform(f, clampTo(va, f.scale)) - transform(f, clampTo(vb, f.scale))) / span);
}

/** Share of two histograms (equal-width bins from 0) that coincides: Σ min(pᵢ, qᵢ), 0–1. */
export function histOverlap(a, b) {
  const na = a.reduce((x, y) => x + y, 0), nb = b.reduce((x, y) => x + y, 0);
  if (!na || !nb) return null;
  let o = 0;
  for (let i = 0; i < Math.max(a.length, b.length); i++) o += Math.min((a[i] || 0) / na, (b[i] || 0) / nb);
  return o;
}

/** Summary of a 1°-bin slope histogram: quantiles (linear within a bin) and share steeper than thresholds. */
export function histSummary(h, thresholds = [5, 10, 15, 20, 25]) {
  const n = h.reduce((x, y) => x + y, 0);
  const q = p => {
    let acc = 0;
    for (let i = 0; i < h.length; i++) {
      if (acc + h[i] >= p * n && h[i] > 0) return i + (p * n - acc) / h[i];
      acc += h[i];
    }
    return h.length;
  };
  const above = t => h.slice(t).reduce((x, y) => x + y, 0) / n;
  return { n, p10: q(0.1), p25: q(0.25), p50: q(0.5), p75: q(0.75), p90: q(0.9), p95: q(0.95), above: Object.fromEntries(thresholds.map(t => [t, above(t)])) };
}

const prov = (s, key) => s._prov?.[key] ?? null;

export class Engine {
  constructor(sites) {
    this.sites = sites;
    this.byId = new Map(sites.map(s => [s.id, s]));
    this.cache = new Map();
  }

  featureSim(f, a, b) {
    const va = a[f.key], vb = b[f.key];
    if (va == null || vb == null) return null;
    switch (f.kind) {
      case 'num': return scaledSim(f, va, vb);
      case 'dist': return histOverlap(va, vb);
      case 'bool': return va === vb ? 1 : 0;
      case 'set': return jaccard(new Set(va), new Set(vb));
      case 'words': return 0.5 * jaccard(new Set(va), new Set(vb)) + 0.5 * jaccard(words(va), words(vb));
      case 'class': {
        if (va === vb) return 1;
        const secA = a['terrain.secondary_classes'] || [], secB = b['terrain.secondary_classes'] || [];
        if (secA.includes(vb) || secB.includes(va)) return 0.6;
        return secA.some(x => secB.includes(x)) ? 0.3 : 0;
      }
    }
    return null;
  }

  /** Full comparison: candidate (Earth) vs target (Mars). Cached per weight-set. */
  compare(candId, targetId, weights = PROFILES.balanced.w) {
    const cacheKey = candId + '|' + targetId + '|' + JSON.stringify(weights);
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);
    const a = this.byId.get(candId), b = this.byId.get(targetId);
    const dims = DIMENSIONS.map(d => {
      if (d.onlyIfTarget && !d.onlyIfTarget(b)) return { key: d.key, label: d.label, score: null, coverage: 0, na: 'Target has no recorded caves or lava tubes', features: [] };
      let num = 0, den = 0, possible = 0;
      const primary = {};
      for (const f of d.features) if (!f.fallbackFor) primary[f.key] = this.featureSim(f, a, b);
      const features = d.features.map(f => {
        // A fallback (e.g. mean slope) stands in only when its primary (the slope distribution) is unavailable.
        const standby = !!f.fallbackFor && primary[f.fallbackFor] != null;
        if (!f.fallbackFor) possible += f.w;
        const sim = standby ? null : f.fallbackFor ? this.featureSim(f, a, b) : primary[f.key];
        if (sim != null) { num += sim * f.w; den += f.w; }
        const pa = prov(a, f.key), pb = prov(b, f.key);
        return { key: f.key, kind: f.kind, sim, a: a[f.key], b: b[f.key], provA: pa, provB: pb, standby, fallback: !!f.fallbackFor,
          basis: sim == null ? null : pa === 'measured' && pb === 'measured' ? 'measured' : pa === 'synthetic' && pb === 'synthetic' ? 'synthetic' : 'mixed' };
      });
      return { key: d.key, label: d.label, score: den ? num / den : null, coverage: Math.min(1, den / possible), na: den ? null : 'No overlapping data', features };
    });
    let num = 0, den = 0;
    for (const d of dims) if (d.score != null) { const w = weights[d.key] ?? 1; num += d.score * w; den += w; }
    const all = dims.flatMap(d => d.features.filter(f => f.sim != null).map(f => ({ ...f, dim: d.key })));
    const basis = { measured: 0, mixed: 0, synthetic: 0 };
    for (const f of all) basis[f.basis]++;
    const result = {
      candidate: a, target: b, score: den ? num / den : 0, dims,
      coverage: dims.filter(d => d.score != null).length / dims.length,
      scoredFields: all.length, basis,
      strengths: all.filter(f => f.sim >= 0.75).sort((x, y) => y.sim - x.sim),
      gaps: all.filter(f => f.sim <= 0.35).sort((x, y) => x.sim - y.sim),
      limits: this.limits(a, b),
    };
    this.cache.set(cacheKey, result);
    return result;
  }

  /** Where the analogy physically breaks: quantities Earth cannot reproduce. */
  limits(a, b) {
    const out = [];
    const src = k => `CSV · ${prov(a, k) || 'n/a'} vs ${prov(b, k) || 'n/a'}`;
    const pa = a['environment.atmospheric_pressure_kpa'], pb = b['environment.atmospheric_pressure_kpa'];
    if (pa != null && pb != null && pb >= 0) out.push({ key: 'pressure', label: 'Surface pressure', a: pa, b: pb, unit: 'kPa', ratio: pb > 0 ? pa / pb : Infinity, source: src('environment.atmospheric_pressure_kpa') + ' (barometric approximation)' });
    const ra = a['environment.radiation_dose_mgy_per_day'], rb = b['environment.radiation_dose_mgy_per_day'];
    if (ra != null && rb != null && ra > 0) out.push({ key: 'radiation', label: 'Surface radiation dose', a: ra, b: rb, unit: 'mGy/day', ratio: rb / ra, source: src('environment.radiation_dose_mgy_per_day') });
    const ga = GRAVITY[a.body], gb = GRAVITY[b.body];
    if (ga && gb && a.body !== b.body) out.push({ key: 'gravity', label: 'Surface gravity', a: ga, b: gb, unit: 'm/s²', ratio: ga / gb, source: 'Reference constant (not in CSV)' });
    return out;
  }

  /** Rank candidates against one target. */
  rank(targetId, candidates, weights) {
    return candidates.map(c => this.compare(c.id, targetId, weights)).sort((x, y) => y.score - x.score);
  }

  /** Matrix of scores for heatmap. */
  matrix(rows, cols, weights) {
    return rows.map(r => cols.map(c => this.compare(r.id, c.id, weights)));
  }
}

function jaccard(A, B) {
  if (!A.size && !B.size) return null;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

function words(list) {
  const out = new Set();
  for (const item of list) for (const w of String(item).toLowerCase().split(/[\s_\-/]+/)) {
    if (w.length < 3 || STOP.has(w)) continue;
    out.add(w.replace(/s$/, ''));
  }
  return out;
}

export function scoreBand(s) {
  if (s >= 0.6) return { key: 'strong', label: 'Strong analog' };
  if (s >= 0.5) return { key: 'good', label: 'Useful analog' };
  if (s >= 0.4) return { key: 'partial', label: 'Partial analog' };
  return { key: 'weak', label: 'Weak analog' };
}
