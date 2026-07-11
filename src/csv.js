// Dependency-free CSV helpers shared across bulk-entry screens.

// Parse CSV text into an array of row objects keyed by the header row.
// Handles quoted fields, embedded commas/newlines, and "" escapes.
export function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  const s = String(text ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n") {
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  // last field / row (if no trailing newline)
  if (field.length || row.length) { row.push(field); rows.push(row); }
  // drop fully-empty trailing rows
  const cleaned = rows.filter(r => r.some(cell => String(cell).trim() !== ""));
  if (!cleaned.length) return { headers: [], rows: [] };
  const headers = cleaned[0].map(h => h.trim());
  const objs = cleaned.slice(1).map(r => {
    const o = {};
    headers.forEach((h, idx) => { o[h] = (r[idx] ?? "").trim(); });
    return o;
  });
  return { headers, rows: objs };
}

// Escape one CSV cell.
function esc(v) {
  const str = String(v ?? "");
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

// Build CSV text from headers + array-of-arrays (or array-of-objects).
export function toCSV(headers, rows) {
  const head = headers.map(esc).join(",");
  const body = rows.map(r => {
    const arr = Array.isArray(r) ? r : headers.map(h => r[h]);
    return arr.map(esc).join(",");
  });
  return "\uFEFF" + [head, ...body].join("\r\n");
}

// Trigger a browser download of a CSV file.
export function downloadCSV(filename, headers, rows = []) {
  const blob = new Blob([toCSV(headers, rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// Read a File object as text (Promise).
export function readFileText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error("Could not read file"));
    r.readAsText(file);
  });
}
