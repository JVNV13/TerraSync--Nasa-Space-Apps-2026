// Data layer: loads the TerraTwin CSV, types every column, validates records,
// and produces a data-quality report. Nothing here invents values: a blank or
// unparseable cell becomes null and is reported.
import { parseCSV } from './csv.js';

// Field dictionary: type, human label, unit, and group used across the UI.
export const FIELDS = {
  'id': { type: 'str', label: 'Record ID', group: 'Identity' },
  'name': { type: 'str', label: 'Name', group: 'Identity' },
  'planet': { type: 'str', label: 'Body', group: 'Identity' },
  'is_synthetic': { type: 'bool', label: 'Synthetic record', group: 'Identity' },
  'is_control': { type: 'bool', label: 'Negative control', group: 'Identity' },
  'geographic.latitude': { type: 'num', label: 'Latitude', unit: '°', group: 'Location', range: [-90, 90] },
  'geographic.longitude': { type: 'num', label: 'Longitude', unit: '°', group: 'Location', range: [-180, 360] },
  'geographic.coordinate_system': { type: 'str', label: 'Coordinate system', group: 'Location' },
  'geographic.region': { type: 'str', label: 'Region', group: 'Location' },
  'geographic.geological_formation': { type: 'str', label: 'Geological formation', group: 'Location' },
  'geographic.elevation_m': { type: 'num', label: 'Elevation', unit: 'm', group: 'Location' },
  'geographic.elevation_reference': { type: 'str', label: 'Elevation datum', group: 'Location' },
  'geology.surface_material': { type: 'str', label: 'Surface material', group: 'Geology' },
  'geology.rock_types': { type: 'list', label: 'Rock types', group: 'Geology' },
  'geology.soil_type': { type: 'str', label: 'Soil / regolith', group: 'Geology' },
  'geology.minerals': { type: 'list', label: 'Minerals', group: 'Geology' },
  'geology.mineral_groups': { type: 'list', label: 'Mineral groups', group: 'Geology' },
  'geology.geological_features': { type: 'list', label: 'Geological features', group: 'Geology' },
  'terrain.classification': { type: 'str', label: 'Terrain class', group: 'Terrain' },
  'terrain.secondary_classes': { type: 'list', label: 'Secondary classes', group: 'Terrain' },
  'terrain.slope_mean_deg': { type: 'num', label: 'Mean slope', unit: '°', group: 'Terrain', range: [0, 90] },
  'terrain.slope_max_deg': { type: 'num', label: 'Max slope', unit: '°', group: 'Terrain', range: [0, 90] },
  'terrain.roughness_index': { type: 'num', label: 'Roughness index', group: 'Terrain', range: [0, 1] },
  'terrain.crater_density_gt1km_per_1e6km2': { type: 'num', label: 'Crater density (>1 km)', unit: '/10⁶ km²', group: 'Terrain', range: [0, Infinity] },
  'terrain.is_impact_structure': { type: 'bool', label: 'Impact structure', group: 'Terrain' },
  'environment.temperature_c.mean': { type: 'num', label: 'Mean temperature', unit: '°C', group: 'Environment' },
  'environment.temperature_c.min': { type: 'num', label: 'Min temperature', unit: '°C', group: 'Environment' },
  'environment.temperature_c.max': { type: 'num', label: 'Max temperature', unit: '°C', group: 'Environment' },
  'environment.diurnal_range_c': { type: 'num', label: 'Diurnal range', unit: '°C', group: 'Environment' },
  'environment.atmospheric_pressure_kpa': { type: 'num', label: 'Surface pressure', unit: 'kPa', group: 'Environment', range: [0, Infinity] },
  'environment.pressure_derivation': { type: 'str', label: 'Pressure derivation', group: 'Environment' },
  'environment.wind_speed_ms.mean': { type: 'num', label: 'Mean wind', unit: 'm/s', group: 'Environment', range: [0, Infinity] },
  'environment.wind_speed_ms.gust_max': { type: 'num', label: 'Max gust', unit: 'm/s', group: 'Environment', range: [0, Infinity] },
  'environment.dust_activity_index': { type: 'num', label: 'Dust activity index', group: 'Environment', range: [0, 1] },
  'environment.dust_storms_per_earth_year': { type: 'num', label: 'Dust storms / Earth yr', group: 'Environment', range: [0, Infinity] },
  'environment.erosion_indicators': { type: 'list', label: 'Erosion indicators', group: 'Environment' },
  'environment.solar_irradiance_surface_mean_wm2': { type: 'num', label: 'Mean surface irradiance', unit: 'W/m²', group: 'Environment', range: [0, Infinity] },
  'environment.uv_exposure_index': { type: 'num', label: 'UV exposure index', group: 'Environment', range: [0, 1] },
  'environment.radiation_dose_mgy_per_day': { type: 'num', label: 'Radiation dose', unit: 'mGy/day', group: 'Environment', range: [0, Infinity] },
  'environment.annual_liquid_precipitation_mm': { type: 'num', label: 'Liquid precipitation', unit: 'mm/yr', group: 'Environment', range: [0, Infinity] },
  'water_resources.water_availability_index': { type: 'num', label: 'Water availability', group: 'Water & ice', range: [0, 1] },
  'water_resources.surface_ice_probability': { type: 'num', label: 'Surface ice probability', group: 'Water & ice', range: [0, 1] },
  'water_resources.subsurface_ice_probability': { type: 'num', label: 'Subsurface ice probability', group: 'Water & ice', range: [0, 1] },
  'water_resources.hydrated_minerals_present': { type: 'bool', label: 'Hydrated minerals', group: 'Water & ice' },
  'water_resources.hydrated_mineral_types': { type: 'list', label: 'Hydrated mineral types', group: 'Water & ice' },
  'water_resources.regolith_water_equivalent_wt_pct': { type: 'num', label: 'Regolith water-equivalent', unit: 'wt%', group: 'Water & ice', range: [0, 100] },
  'water_resources.subsurface_water_notes': { type: 'str', label: 'Subsurface water notes', group: 'Water & ice' },
  'habitability.vegetation_cover_pct': { type: 'num', label: 'Vegetation cover', unit: '%', group: 'Habitability', range: [0, 100] },
  'habitability.ndvi_mean': { type: 'num', label: 'Mean NDVI', group: 'Habitability', range: [-1, 1] },
  'habitability.soil_moisture_vol_pct': { type: 'num', label: 'Soil moisture', unit: 'vol%', group: 'Habitability', range: [0, 100] },
  'habitability.extremophile_friendly': { type: 'bool', label: 'Extremophile-friendly', group: 'Habitability' },
  'habitability.extremophile_types': { type: 'list', label: 'Extremophile types', group: 'Habitability' },
  'habitability.biological_indicators': { type: 'str', label: 'Biological indicators', group: 'Habitability' },
  'habitability.biosignature_preservation_potential': { type: 'num', label: 'Biosignature preservation', group: 'Habitability', range: [0, 1] },
  'habitability.past_habitability_potential': { type: 'num', label: 'Past habitability potential', group: 'Habitability', range: [0, 1] },
  'habitability.present_day_life_status': { type: 'str', label: 'Present-day life', group: 'Habitability' },
  'subsurface.cave_present': { type: 'bool', label: 'Cave present', group: 'Subsurface' },
  'subsurface.lava_tube_present': { type: 'bool', label: 'Lava tube present', group: 'Subsurface' },
  'subsurface.known_cave_length_m': { type: 'num', label: 'Known cave length', unit: 'm', group: 'Subsurface', range: [0, Infinity] },
  'subsurface.cave_temperature_c': { type: 'num', label: 'Cave temperature', unit: '°C', group: 'Subsurface' },
  'subsurface.notes': { type: 'str', label: 'Subsurface notes', group: 'Subsurface' },
  'exploration.landing_suitability_index': { type: 'num', label: 'Landing suitability', group: 'Exploration', range: [0, 1] },
  'exploration.trafficability_index': { type: 'num', label: 'Trafficability', group: 'Exploration', range: [0, 1] },
  'exploration.access_difficulty_index': { type: 'num', label: 'Access difficulty', group: 'Exploration', range: [0, 1] },
  'exploration.analog_maturity': { type: 'str', label: 'Analog maturity', group: 'Exploration' },
  'exploration.mission_history': { type: 'list', label: 'Mission history', group: 'Exploration' },
  'analog_tags': { type: 'list', label: 'Analog tags', group: 'Identity' },
  'summary': { type: 'str', label: 'Summary', group: 'Identity' },
};

export const GROUP_ORDER = ['Location', 'Geology', 'Terrain', 'Environment', 'Water & ice', 'Habitability', 'Subsurface', 'Exploration'];

const BOOL = { true: true, false: false, yes: true, no: false, '1': true, '0': false };

function coerce(raw, spec) {
  const s = (raw ?? '').trim();
  if (s === '' || /^(na|n\/a|nan|null|none)$/i.test(s)) return { value: null, blank: true };
  switch (spec.type) {
    case 'num': {
      const n = Number(s);
      if (!Number.isFinite(n)) return { value: null, error: `"${s}" is not a number` };
      if (spec.range && (n < spec.range[0] || n > spec.range[1])) return { value: null, error: `${n} outside valid range [${spec.range[0]}, ${spec.range[1]}]` };
      return { value: n };
    }
    case 'bool': {
      const b = BOOL[s.toLowerCase()];
      return b === undefined ? { value: null, error: `"${s}" is not true/false` } : { value: b };
    }
    case 'list': return { value: s.split('|').map(x => x.trim()).filter(Boolean) };
    default: return { value: s };
  }
}

/** Parse + type + validate. Returns { sites, quality }. */
export function buildDataset(text, sourceName = 'dataset.csv') {
  const { header, records } = parseCSV(text);
  const quality = { source: sourceName, rows: records.length, accepted: 0, rejected: [], issues: [], unknownColumns: [], missingColumns: [], emptyColumns: [], fill: {} };
  if (!header.length) throw new Error('The file is empty or not a CSV.');
  for (const req of ['id', 'name', 'planet', 'geographic.latitude', 'geographic.longitude']) {
    if (!header.includes(req)) throw new Error(`Required column "${req}" is missing.`);
  }
  quality.unknownColumns = header.filter(h => !FIELDS[h]);
  quality.missingColumns = Object.keys(FIELDS).filter(k => !header.includes(k));

  const sites = [];
  const seen = new Set();
  const filled = Object.fromEntries(Object.keys(FIELDS).map(k => [k, 0]));
  for (const rec of records) {
    if (rec.cells.length !== header.length) {
      quality.rejected.push({ line: rec.line, reason: `has ${rec.cells.length} fields, header has ${header.length}` });
      continue;
    }
    const site = { _line: rec.line };
    for (let c = 0; c < header.length; c++) {
      const key = header[c], spec = FIELDS[key];
      if (!spec) continue;
      const r = coerce(rec.cells[c], spec);
      site[key] = r.value;
      if (r.error) quality.issues.push({ line: rec.line, id: rec.cells[header.indexOf('id')], field: key, msg: r.error });
    }
    for (const k of Object.keys(FIELDS)) if (!(k in site)) site[k] = null;
    if (!site.id || !site.name || !site.planet) { quality.rejected.push({ line: rec.line, reason: 'missing id, name or body' }); continue; }
    if (seen.has(site.id)) { quality.rejected.push({ line: rec.line, reason: `duplicate id ${site.id}` }); continue; }
    if (site['geographic.latitude'] == null || site['geographic.longitude'] == null) { quality.rejected.push({ line: rec.line, reason: `${site.id}: no valid coordinates` }); continue; }
    seen.add(site.id);
    // Normalise longitude to [-180, 180] for mapping (planetocentric east-positive is preserved in sign).
    let lon = site['geographic.longitude'];
    if (lon > 180) lon -= 360;
    site.lon = lon; site.lat = site['geographic.latitude'];
    site.body = normaliseBody(site.planet);
    for (const k of Object.keys(FIELDS)) if (site[k] != null && !(Array.isArray(site[k]) && !site[k].length)) filled[k]++;
    sites.push(site);
  }
  quality.accepted = sites.length;
  for (const k of Object.keys(FIELDS)) {
    quality.fill[k] = sites.length ? filled[k] / sites.length : 0;
    if (header.includes(k) && filled[k] === 0) quality.emptyColumns.push(k);
  }
  quality.bodies = countBy(sites, s => s.body);
  quality.synthetic = sites.filter(s => s.is_synthetic === true).length;
  quality.controls = sites.filter(s => s.is_control === true).length;
  return { sites, quality };
}

function normaliseBody(p) {
  const s = String(p).trim().toLowerCase();
  if (s === 'earth') return 'Earth';
  if (s === 'mars') return 'Mars';
  if (s === 'moon' || s === 'luna') return 'Moon';
  return p;
}

export function countBy(arr, fn) {
  const m = {};
  for (const x of arr) { const k = fn(x); m[k] = (m[k] || 0) + 1; }
  return m;
}

export async function loadDefaultDataset(url = 'data/terratwin.csv') {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Could not load ${url} (HTTP ${res.status}).`);
  return buildDataset(await res.text(), url.split('/').pop());
}

export function formatValue(v, key) {
  const spec = FIELDS[key] || {};
  if (v == null || (Array.isArray(v) && !v.length)) return null;
  if (Array.isArray(v)) return v.map(humanize).join(', ');
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') {
    const abs = Math.abs(v);
    const s = abs !== 0 && abs < 0.01 ? v.toPrecision(2) : abs >= 1000 ? Math.round(v).toLocaleString('en-US') : String(+v.toFixed(2));
    return spec.unit ? `${s} ${spec.unit}` : s;
  }
  return key === 'exploration.analog_maturity' || key === 'habitability.present_day_life_status' || key === 'terrain.classification' ? humanize(v) : v;
}

export const humanize = s => String(s).replace(/_/g, ' ');
