// จำลอง Apps Script ของชีต NSR สำหรับทดสอบ (เก็บในหน่วยความจำ + คำนวณสูตรแบบชีตอย่างง่าย)
// สูตรที่รองรับ: อ้างช่อง A1, ช่วง A1:B2, + - * / ( ), x%, sum()/SUM(), MAX(), IFERROR(a,b)
const colN = s => s.split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
function evalTab(t) {
  const H = t.values.length; const memo = new Map();
  const raw = (r, c) => { const f = (t.formulas[r] || [])[c]; if (f) return { f }; const v = (t.values[r] || [])[c]; return { v }; };
  const num = s => { const x = String(s ?? '').replace(/[฿,\s]/g, ''); if (x === '') return 0; const p = x.endsWith('%'); const n = parseFloat(p ? x.slice(0, -1) : x); return isNaN(n) ? 0 : p ? n / 100 : n; };
  const val = (r, c, depth = 0) => {
    const k = r + ':' + c; if (memo.has(k)) return memo.get(k);
    const x = raw(r, c); let out;
    if (!x.f) out = num(x.v);
    else {
      if (depth > 50) return 0;
      let e = x.f.replace(/^=/, '');
      e = e.replace(/\b([A-M])(\d+):([A-M])(\d+)\b/g, (_, a, b, c2, d) => `RG(${b - 1},${colN(a) - 1},${d - 1},${colN(c2) - 1})`);
      e = e.replace(/\b([A-M])(\d+)\b/g, (_, a, b) => `V(${b - 1},${colN(a) - 1})`);
      e = e.replace(/(\d+(?:\.\d+)?)%/g, '($1/100)').replace(/\bsum\(/gi, 'S(').replace(/\bMAX\(/gi, 'MX(').replace(/\bIFERROR\(/gi, 'IE(');
      const V = (r2, c2) => val(r2, c2, depth + 1);
      const RG = (r1, c1, r2, c2) => { const a = []; for (let i = r1; i <= r2; i++) for (let j = c1; j <= c2; j++) a.push(V(i, j)); return a; };
      const S = (...a) => a.flat().reduce((s, n) => s + (Number(n) || 0), 0);
      const MX = (...a) => Math.max(...a.flat().map(Number));
      const IE = (a, b) => (Number.isFinite(a) ? a : b);
      try { out = Function('V', 'RG', 'S', 'MX', 'IE', `return (${e});`)(V, RG, S, MX, IE); } catch { out = NaN; }
      if (!Number.isFinite(out)) out = 0;
    }
    memo.set(k, out); return out;
  };
  for (let r = 0; r < H; r++) for (let c = 0; c < (t.values[r] || []).length; c++) if ((t.formulas[r] || [])[c]) {
    const n = val(r, c); t.values[r][c] = String(Math.round(n * 10000) / 10000);
  }
}
function makeStore(fixture) {
  // fixture: { [title]: [[value, formula], ...][] } (รูปแบบเดียวกับไฟล์ดึงจากชีต)
  const tabs = []; let id = 1000;
  for (const [title, rows] of Object.entries(fixture)) {
    const w = Math.max(13, ...rows.map(r => r.length));
    const t = { title, sheetId: id++, values: rows.map(r => Array.from({ length: w }, (_, i) => String((r[i] || [''])[0] ?? ''))), formulas: rows.map(r => Array.from({ length: w }, (_, i) => (r[i] || ['', ''])[1] || '')) };
    tabs.push(t);
  }
  tabs.forEach(evalTab);
  const log = [];
  const same = (a, b) => { const n = s => { const t = String(s ?? '').replace(/[฿,\s]/g, ''); return /^-?\d+(\.\d+)?%?$/.test(t) ? parseFloat(t) / (t.endsWith('%') ? 100 : 1) : null; }; const x = n(a), y = n(b); if (x !== null && y !== null) return Math.abs(x - y) < 0.5; return String(a || '').trim() === String(b || '').trim(); };
  const handle = req => {
    log.push(req);
    if (req.key !== 'nsr-testkey') return { ok: false, error: 'key' };
    if (req.op === 'list') return { ok: true, url: 'https://docs.google.com/spreadsheets/d/TESTSHEET0000000000000000/edit', tabs: tabs.map((t, i) => ({ title: t.title, sheetId: t.sheetId, index: i })) };
    if (req.op === 'read') return { ok: true, tabs: (req.tabs || []).map(n => { const i = tabs.findIndex(t => t.title === n); if (i < 0) return { title: n, missing: true }; const t = tabs[i]; return { title: t.title, sheetId: t.sheetId, index: i, values: t.values, formulas: t.formulas }; }) };
    if (req.op === 'create') {
      if (tabs.some(t => t.title === req.title)) return { ok: false, error: 'exists' };
      const rows = req.rows; const w = Math.max(13, ...rows.map(r => r.length));
      const t = { title: req.title, sheetId: id++, values: rows.map(r => Array.from({ length: w }, (_, i) => { const v = r[i]; return typeof v === 'string' && v.startsWith('=') ? '' : String(v ?? ''); })), formulas: rows.map(r => Array.from({ length: w }, (_, i) => { const v = r[i]; return typeof v === 'string' && v.startsWith('=') ? v : ''; })) };
      evalTab(t); tabs.splice(Math.min(req.index || 1, tabs.length), 0, t);
      return { ok: true, sheetId: t.sheetId, title: t.title };
    }
    if (req.op === 'edit') {
      const t = tabs.find(x => x.title === req.title); if (!t) return { ok: false, error: 'missing' };
      const conflicts = (req.edits || []).filter(x => !same(t.values[x.r - 1][x.c - 1], x.was)).map(x => ({ r: x.r, c: x.c, now: t.values[x.r - 1][x.c - 1] }));
      if (conflicts.length && !req.force) return { ok: false, error: 'conflict', conflicts };
      for (const x of req.edits) { t.values[x.r - 1][x.c - 1] = String(x.v); t.formulas[x.r - 1][x.c - 1] = ''; }
      evalTab(t); return { ok: true };
    }
    return { ok: false, error: 'op' };
  };
  // แก้ค่าในชีตแทน "คนอื่น" (ทดสอบอัปเดตต่อเนื่อง)
  const poke = (title, r, c, v) => { const t = tabs.find(x => x.title === title); t.values[r - 1][c - 1] = String(v); t.formulas[r - 1][c - 1] = ''; evalTab(t); };
  return { handle, poke, tabs, log };
}
module.exports = { makeStore, evalTab };
