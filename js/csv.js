// Minimal RFC 4180 CSV parser: handles quoted fields, escaped quotes ("") and CRLF.
export function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false, i = 0;
  if (text.charCodeAt(0) === 0xfeff) i = 1; // strip BOM
  for (; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return { header: [], records: [] };
  const header = rows[0].map(h => h.trim());
  const records = rows.slice(1).map((r, idx) => ({ line: idx + 2, cells: r }));
  return { header, records };
}
