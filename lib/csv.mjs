// Minimal RFC 4180 CSV parser/serializer: quoted fields, escaped quotes,
// commas and newlines inside quotes, CRLF, optional UTF-8 BOM.

export function parseCsv(text) {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field); field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else {
      field += ch;
    }
  }
  if (inQuotes) throw new Error('CSV parse error: unterminated quoted field');
  if (field !== '' || row.length) { row.push(field); rows.push(row); }

  const nonEmpty = rows.filter((r) => !(r.length === 1 && r[0] === ''));
  if (!nonEmpty.length) return { headers: [], records: [] };
  const [headers, ...data] = nonEmpty;
  const records = data.map((r, n) => {
    if (r.length !== headers.length) {
      throw new Error(`CSV parse error: row ${n + 2} has ${r.length} fields, expected ${headers.length}`);
    }
    return Object.fromEntries(headers.map((h, i) => [h, r[i]]));
  });
  return { headers, records };
}

function quote(value) {
  const s = value == null ? '' : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function stringifyCsv(headers, records) {
  const lines = [headers.map(quote).join(',')];
  for (const r of records) lines.push(headers.map((h) => quote(r[h])).join(','));
  return lines.join('\n') + '\n';
}
