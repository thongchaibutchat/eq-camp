// เชื่อมหน้า NSR กับ Google Sheet ของทีม (อ่านงานย้อนหลัง / เขียนกลับ / อัปเดตต่อเนื่อง)
// 2 ทาง (ใช้ทางที่พร้อมก่อน):
//   1) Apps Script web app บนชีต NSR — ทีมติดตั้งเอง ใช้ได้ทุกที่ (เว็บสาธารณะ/มือถือ) · อ่านและเขียนต้องมี "รหัสทีม"
//      (ไม่ฝังรหัสใน bundle สาธารณะ — กันคนนอกเห็นต้นทุน/ราคา)
//   2) ตัวเชื่อม Google Sheets ของผู้ชมบน claude.ai (capability mcp) — ใช้ได้เมื่อหน้านี้ประกาศสิทธิ์ไว้และผู้ชมเชื่อม Google Sheets แล้ว
// ไม่มีทั้งสองทาง → คำนวณได้ปกติ บันทึกในเครื่องนี้
import { sheetIdFromUrl, quoteTab, Grid, CellOut, CellEdit, readNum } from '../src/nsr-core';

export interface TabInfo { title: string; sheetId: number; index: number }
export interface TabData extends TabInfo { grid: Grid }
export interface Conn {
  kind: 'script' | 'mcp'; label: string;
  listTabs(): Promise<TabInfo[]>;
  readTabs(titles: string[]): Promise<TabData[]>;
  createTab(title: string, rows: CellOut[][], index: number, fmt: Fmt): Promise<{ sheetId: number; title: string }>;
  editCells(title: string, sheetId: number, edits: CellEdit[], force?: boolean): Promise<{ ok: true } | { ok: false; conflicts: { r: number; c: number; now: string }[] }>;
}
export interface Fmt { boldRows: number[]; moneyCols: number[]; pctCells: [number, number][]; staffCols: [number, number] }

const LS_URL = 'eqcamp.nsr.url', LS_KEY = 'eqcamp.nsr.key', LS_SHEET = 'eqcamp.nsr.sheet';
const ls = { get(k: string) { try { return localStorage.getItem(k) || ''; } catch { return ''; } }, set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* ignore */ } } };
// ใส่ที่อยู่ web app ที่ทีม deploy แล้ว (ว่าง = ใช้ค่าที่ตั้งในหน้าเว็บ) — รหัสทีมไม่ใส่ที่นี่
export const NSR_SCRIPT_URL = '';
export const scriptUrl = () => (ls.get(LS_URL) || NSR_SCRIPT_URL).trim();
export const scriptKey = () => ls.get(LS_KEY).trim();
export const setScript = (url: string, key: string) => { ls.set(LS_URL, url.trim()); ls.set(LS_KEY, key.trim()); };
// ลิงก์ชีต NSR (เก็บในเครื่องนี้เท่านั้น — ได้จาก Apps Script ตอนเชื่อมต่อ หรือวางเองสำหรับบัญชี Google บน claude.ai)
export const sheetUrl = () => { const u = ls.get(LS_SHEET).trim(); return sheetIdFromUrl(u) ? `https://docs.google.com/spreadsheets/d/${sheetIdFromUrl(u)}/edit` : ''; };
export const setSheetUrl = (u: string) => ls.set(LS_SHEET, String(u || '').trim());

const toGrid = (values: string[][], formulas?: string[][]): Grid => values.map((r, i) => r.map((v, j) => ({ v: String(v ?? ''), f: (formulas && formulas[i] && formulas[i][j]) || undefined })));
const norm = (s: unknown) => String(s ?? '').replace(/[฿,\s]/g, '');
const sameCell = (a: unknown, b: unknown) => { const x = readNum(a).n, y = readNum(b).n; if (x != null && y != null) return Math.abs(x - y) < 0.5; return norm(a) === norm(b); };

// ── 1) Apps Script ──
export function scriptConn(url: string, key: string): Conn {
  const post = async (body: any, ms = 60000) => {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...body, key }), signal: ctl.signal });
      const j = await r.json();
      if (!j || j.ok === false) { const e: any = new Error(j?.error === 'key' ? 'รหัสทีมไม่ถูกต้อง' : j?.error === 'exists' ? 'มีแท็บชื่อนี้แล้ว' : j?.error === 'missing' ? 'ไม่พบแท็บนี้ในชีตแล้ว' : j?.message || 'ชีตตอบกลับไม่สำเร็จ'); e.code = j?.error; e.data = j; throw e; }
      return j;
    } catch (e: any) { if (e?.code) throw e; const x: any = new Error(e?.name === 'AbortError' ? 'ชีตตอบช้าเกินไป' : 'เชื่อมต่อชีตไม่ได้ (ตรวจที่อยู่ web app / อินเทอร์เน็ต)'); x.code = 'net'; throw x; }
    finally { clearTimeout(t); }
  };
  return {
    kind: 'script', label: 'Apps Script ของทีม',
    async listTabs() { const j = await post({ op: 'list' }, 20000); if (j.url) setSheetUrl(j.url); return j.tabs || []; },
    async readTabs(titles) {
      const out: TabData[] = [];
      for (let i = 0; i < titles.length; i += 60) {
        const j = await post({ op: 'read', tabs: titles.slice(i, i + 60) });
        for (const t of j.tabs || []) if (!t.missing) out.push({ title: t.title, sheetId: t.sheetId, index: t.index, grid: toGrid(t.values || [], t.formulas) });
      }
      return out;
    },
    async createTab(title, rows, index, fmt) {
      const j = await post({ op: 'create', title, index, fmt, rows: rows.map(r => r.map(c => (typeof c === 'object' ? c.f : c))) });
      return { sheetId: j.sheetId, title: j.title || title };
    },
    async editCells(title, _id, edits, force) {
      try { await post({ op: 'edit', title, edits, force: !!force }); return { ok: true }; }
      catch (e: any) { if (e?.code === 'conflict') return { ok: false, conflicts: e.data?.conflicts || [] }; throw e; }
    }
  };
}

// ── 2) claude.ai — ตัวเชื่อม Google Sheets ของผู้ชม ──
const GS = 'Google Sheets';
const unwrap = (p: any): any => { if (typeof p === 'string') { try { p = JSON.parse(p); } catch { return p; } } return p && p.content && (p.content.sheets || p.content.replies || p.content.spreadsheetId) ? p.content : p; };
export async function mcpConn(): Promise<Conn | null> {
  const cl = typeof window !== 'undefined' ? (window as any).claude : null;
  if (!cl || typeof cl.use !== 'function') return null;
  const NSR_SHEET_ID = sheetIdFromUrl(sheetUrl()); if (!NSR_SHEET_ID) return null;
  const mcp = await cl.use('mcp').catch(() => null); if (!mcp) return null;
  const call = async (tool: string, input: any) => { const r = await mcp.callTool(GS, tool, input, { cache: false }); return unwrap(r?.payload ?? r); };
  const cellsOf = (row: CellOut[]) => ({ values: row.map(c => ({ userEnteredValue: typeof c === 'object' ? { formulaValue: c.f } : typeof c === 'number' ? { numberValue: c } : { stringValue: String(c) } })) });
  const conn: Conn = {
    kind: 'mcp', label: 'Google Sheets (บัญชีของคุณบน claude.ai)',
    async listTabs() {
      const p = await call('get_spreadsheet', { spreadsheetId: NSR_SHEET_ID, fields: ['sheets.properties.title', 'sheets.properties.sheetId', 'sheets.properties.index'] });
      return (p.sheets || []).map((s: any) => ({ title: s.properties.title, sheetId: s.properties.sheetId, index: s.properties.index ?? 0 }));
    },
    async readTabs(titles) {
      const out: TabData[] = [];
      for (let i = 0; i < titles.length; i += 40) {
        const part = titles.slice(i, i + 40);
        const p = await call('get_spreadsheet', { spreadsheetId: NSR_SHEET_ID, includeGridData: true, ranges: part.map(t => `${quoteTab(t)}!A1:M60`),
          fields: ['sheets.properties.title', 'sheets.properties.sheetId', 'sheets.properties.index', 'sheets.data.rowData.values.formattedValue', 'sheets.data.rowData.values.userEnteredValue.formulaValue'] });
        for (const s of p.sheets || []) {
          const rd = (s.data && s.data[0] && s.data[0].rowData) || [];
          out.push({ title: s.properties.title, sheetId: s.properties.sheetId, index: s.properties.index ?? 0,
            grid: rd.map((r: any) => (r.values || []).map((v: any) => ({ v: String(v.formattedValue ?? ''), f: v.userEnteredValue?.formulaValue || undefined }))) });
        }
      }
      return out;
    },
    async createTab(title, rows, index, fmt) {
      const sheetId = 100000000 + Math.floor(Math.random() * 1900000000);
      const reqs: any[] = [
        { addSheet: { properties: { sheetId, title, index } } },
        { updateCells: { start: { sheetId, rowIndex: 0, columnIndex: 0 }, rows: rows.map(cellsOf), fields: 'userEnteredValue' } },
        ...fmt.boldRows.map(r => ({ repeatCell: { range: { sheetId, startRowIndex: r - 1, endRowIndex: r, startColumnIndex: 0, endColumnIndex: 13 }, cell: { userEnteredFormat: { textFormat: { bold: true } } }, fields: 'userEnteredFormat.textFormat.bold' } })),
        ...fmt.moneyCols.map(c => ({ repeatCell: { range: { sheetId, startRowIndex: 4, endRowIndex: rows.length, startColumnIndex: c - 1, endColumnIndex: c }, cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: '#,##0.##' } } }, fields: 'userEnteredFormat.numberFormat' } })),
        { repeatCell: { range: { sheetId, startRowIndex: 2, endRowIndex: fmt.staffCols[1], startColumnIndex: 8, endColumnIndex: 13 }, cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: '#,##0' } } }, fields: 'userEnteredFormat.numberFormat' } },
        ...fmt.pctCells.map(([r, c]) => ({ repeatCell: { range: { sheetId, startRowIndex: r - 1, endRowIndex: r, startColumnIndex: c - 1, endColumnIndex: c }, cell: { userEnteredFormat: { numberFormat: { type: 'PERCENT', pattern: '0.00%' } } }, fields: 'userEnteredFormat.numberFormat' } })),
        { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 }, properties: { pixelSize: 320 }, fields: 'pixelSize' } },
        { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 7, endIndex: 8 }, properties: { pixelSize: 200 }, fields: 'pixelSize' } },
      ];
      await call('update_spreadsheet', { spreadsheetId: NSR_SHEET_ID, requests: reqs });
      return { sheetId, title };
    },
    async editCells(title, sheetId, edits, force) {
      if (!force) {
        const [cur] = await conn.readTabs([title]);
        if (!cur) throw Object.assign(new Error('ไม่พบแท็บนี้ในชีตแล้ว'), { code: 'missing' });
        const conflicts = edits.filter(e => !sameCell((cur.grid[e.r - 1] && cur.grid[e.r - 1][e.c - 1] || { v: '' }).v, e.was)).map(e => ({ r: e.r, c: e.c, now: (cur.grid[e.r - 1] && cur.grid[e.r - 1][e.c - 1] || { v: '' }).v }));
        if (conflicts.length) return { ok: false, conflicts };
      }
      await call('update_spreadsheet', { spreadsheetId: NSR_SHEET_ID, requests: edits.map(e => ({ updateCells: { start: { sheetId, rowIndex: e.r - 1, columnIndex: e.c - 1 }, rows: [cellsOf([e.v])], fields: 'userEnteredValue' } })) });
      return { ok: true };
    }
  };
  return conn;
}

// อธิบายข้อผิดพลาดของ mcp ตามรหัส (ไม่รวมเป็นข้อความเดียว)
export function connError(e: any): string {
  const c = e?.code;
  if (c === 'needs_reauth') return 'การเชื่อม Google Sheets หมดอายุ — เชื่อมใหม่ที่ claude.ai → Settings → Connectors';
  if (c === 'server_not_connected') return 'ยังไม่ได้เพิ่ม Google Sheets — เพิ่มที่ claude.ai → Settings → Connectors';
  if (c === 'not_in_manifest' || c === 'approval_required' || c === 'consent_required') return 'ยังไม่ได้อนุญาตให้หน้านี้ใช้ Google Sheets';
  if (c === 'tool_error') return 'ชีตปฏิเสธคำสั่ง: ' + String(e?.message || '').slice(0, 160) + ' (บัญชีนี้มีสิทธิ์แก้ชีต NSR หรือไม่?)';
  if (c === 'server_unavailable' || c === 'upstream_error') return 'Google Sheets ไม่ตอบชั่วคราว — ลองใหม่อีกครั้ง';
  return String(e?.message || 'เชื่อมต่อชีตไม่ได้');
}

// โค้ด Apps Script สำหรับชีต NSR (ส่วนขยาย → Apps Script → วาง → Deploy เป็น Web app: Execute as Me, Who has access: Anyone)
export const nsrAppsScript = (key: string) => `// EQ Camp — เชื่อมหน้าเว็บ "คำนวณ NSR" กับชีตนี้
// อ่านงานย้อนหลัง / สร้างแท็บงานใหม่ / แก้ค่าในแท็บเดิม — ทุกคำสั่งต้องมีรหัสทีมด้านล่าง
// ไม่ลบแท็บ ไม่แทรก/ลบแถว ไม่ทับสูตรที่ไม่ได้แก้
const TEAM_KEY = '${key}';
function doPost(e) {
  var req; try { req = JSON.parse(e.postData.contents); } catch (x) { return out_({ ok: false, error: 'bad' }); }
  if (!req || req.key !== TEAM_KEY) return out_({ ok: false, error: 'key' });
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  try {
    if (req.op === 'list') return out_({ ok: true, url: ss.getUrl(), tabs: ss.getSheets().map(function (s) { return { title: s.getName(), sheetId: s.getSheetId(), index: s.getIndex() - 1 }; }) });
    if (req.op === 'read') {
      var tabs = (req.tabs || []).slice(0, 80).map(function (t) {
        var sh = ss.getSheetByName(t); if (!sh) return { title: t, missing: true };
        var n = Math.min(Math.max(sh.getLastRow(), 1), 60), r = sh.getRange(1, 1, n, 13);
        return { title: t, sheetId: sh.getSheetId(), index: sh.getIndex() - 1, values: r.getDisplayValues(), formulas: r.getFormulas() };
      });
      return out_({ ok: true, tabs: tabs });
    }
    var lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      if (req.op === 'create') {
        if (ss.getSheetByName(req.title)) return out_({ ok: false, error: 'exists' });
        var rows = req.rows || [], w = 1; rows.forEach(function (r) { w = Math.max(w, r.length); });
        var vals = rows.map(function (r) { var a = r.slice(); while (a.length < w) a.push(''); return a; });
        var sh = ss.insertSheet(String(req.title).slice(0, 99), Math.min(Number(req.index) || ss.getSheets().length, ss.getSheets().length));
        sh.getRange(1, 1, vals.length, w).setValues(vals);
        var f = req.fmt || {};
        (f.boldRows || []).forEach(function (r) { sh.getRange(r, 1, 1, 13).setFontWeight('bold'); });
        (f.moneyCols || []).forEach(function (c) { sh.getRange(5, c, Math.max(vals.length - 4, 1), 1).setNumberFormat('#,##0.##'); });
        if (f.staffCols) sh.getRange(3, 9, Math.max(f.staffCols[1] - 2, 1), 5).setNumberFormat('#,##0');
        (f.pctCells || []).forEach(function (p) { sh.getRange(p[0], p[1]).setNumberFormat('0.00%'); });
        sh.setColumnWidth(2, 320); sh.setColumnWidth(8, 200);
        return out_({ ok: true, sheetId: sh.getSheetId(), title: sh.getName() });
      }
      if (req.op === 'edit') {
        var s2 = ss.getSheetByName(req.title); if (!s2) return out_({ ok: false, error: 'missing' });
        var conflicts = [];
        (req.edits || []).forEach(function (x) { var cur = s2.getRange(x.r, x.c).getDisplayValue(); if (!same_(cur, x.was)) conflicts.push({ r: x.r, c: x.c, now: cur }); });
        if (conflicts.length && !req.force) return out_({ ok: false, error: 'conflict', conflicts: conflicts });
        (req.edits || []).forEach(function (x) { s2.getRange(x.r, x.c).setValue(x.v); });
        return out_({ ok: true });
      }
    } finally { lock.releaseLock(); }
    return out_({ ok: false, error: 'op' });
  } catch (err) { return out_({ ok: false, error: 'server', message: String(err) }); }
}
function doGet() { return out_({ ok: true, hello: 'EQ Camp NSR' }); }
function num_(s) { var t = String(s == null ? '' : s).replace(/[฿,\\s]/g, ''); return /^-?\\d+(\\.\\d+)?%?$/.test(t) ? parseFloat(t) / (t.slice(-1) === '%' ? 100 : 1) : null; }
function same_(a, b) { var x = num_(a), y = num_(b); if (x !== null && y !== null) return Math.abs(x - y) < 0.5; return String(a || '').replace(/\\s/g, '') === String(b || '').replace(/\\s/g, ''); }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
`;
export const newNsrKey = () => 'nsr-' + Array.from(crypto.getRandomValues(new Uint8Array(10))).map(b => b.toString(36).padStart(2, '0')).join('').slice(0, 16);
