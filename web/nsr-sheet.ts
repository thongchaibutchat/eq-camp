// เชื่อมหน้า NSR กับ Google Sheet ของทีม (อ่านงานย้อนหลัง / เขียนกลับ / อัปเดตต่อเนื่อง)
// 2 ทาง (ใช้ทางที่พร้อมก่อน):
//   1) Apps Script web app บนชีต NSR — ทีมติดตั้งเอง ใช้ได้ทุกที่ (เว็บสาธารณะ/มือถือ) · อ่านและเขียนต้องมี "รหัสทีม"
//      (ไม่ฝังรหัสใน bundle สาธารณะ — กันคนนอกเห็นต้นทุน/ราคา)
//   2) ตัวเชื่อม Google Sheets ของผู้ชมบน claude.ai (capability mcp) — ใช้ได้เมื่อหน้านี้ประกาศสิทธิ์ไว้และผู้ชมเชื่อม Google Sheets แล้ว
// ไม่มีทั้งสองทาง → คำนวณได้ปกติ บันทึกในเครื่องนี้
import { sheetIdFromUrl, quoteTab, Grid, CellOut, CellEdit, readNum } from '../src/nsr-core';
import { hubCall } from './hub';

export interface TabInfo { title: string; sheetId: number; index: number }
export interface TabData extends TabInfo { grid: Grid }
export interface Conn {
  kind: 'script' | 'mcp'; label: string;
  listTabs(): Promise<TabInfo[]>;
  readTabs(titles: string[]): Promise<TabData[]>;
  createTab(title: string, rows: CellOut[][], index: number, fmt: Fmt): Promise<{ sheetId: number; title: string }>;
  editCells(title: string, sheetId: number, edits: CellEdit[], force?: boolean): Promise<{ ok: true } | { ok: false; conflicts: { r: number; c: number; now: string }[] }>;
  changes?(since: number): Promise<number[]>;   // sheetId ที่เปลี่ยนหลังเวลา since (ms)
  // ทุกแท็บในคำสั่งเดียว (ศูนย์กลางทีมรุ่น 4+) — since = เวลาจากผลครั้งก่อน → คืนข้อมูลเฉพาะแท็บที่เปลี่ยน · left > 0 = ยังเตรียมไม่ครบ เรียกซ้ำ
  all?(since: number): Promise<AllResult>;
  setStatus?(st: any): Promise<void>;
}
export interface AllResult { at: number; tabs: (TabInfo & { grid?: Grid; pending?: boolean })[]; left: number; built: number; status: any[] }

export interface Fmt { boldRows: number[]; moneyCols: number[]; pctCells: [number, number][]; staffCols: [number, number] }

const LS_SHEET = 'eqcamp.nsr.sheet';
const ls = { get(k: string) { try { return localStorage.getItem(k) || ''; } catch { return ''; } }, set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* ignore */ } } };
// ลิงก์ชีต NSR (เก็บในเครื่องนี้เท่านั้น — ได้จากศูนย์กลางทีมตอนเชื่อมต่อ หรือวางเองสำหรับบัญชี Google บน claude.ai)
export const sheetUrl = () => { const u = ls.get(LS_SHEET).trim(); return sheetIdFromUrl(u) ? `https://docs.google.com/spreadsheets/d/${sheetIdFromUrl(u)}/edit` : ''; };
export const setSheetUrl = (u: string) => ls.set(LS_SHEET, String(u || '').trim());

const toGrid = (values: string[][], formulas?: string[][]): Grid => values.map((r, i) => r.map((v, j) => ({ v: String(v ?? ''), f: (formulas && formulas[i] && formulas[i][j]) || undefined })));
const norm = (s: unknown) => String(s ?? '').replace(/[฿,\s]/g, '');
const sameCell = (a: unknown, b: unknown) => { const x = readNum(a).n, y = readNum(b).n; if (x != null && y != null) return Math.abs(x - y) < 0.5; return norm(a) === norm(b); };

// ── 1) ศูนย์กลางทีม (Apps Script บนชีต NSR) ──
export function hubConn(): Conn {
  return {
    kind: 'script', label: 'ศูนย์กลางทีม',
    async listTabs() { const j = await hubCall('nsr.list', {}, 25000); if (j.url) setSheetUrl(j.url); return j.tabs || []; },
    async readTabs(titles) {
      const out: TabData[] = [];
      for (let i = 0; i < titles.length; i += 60) {
        const j = await hubCall('nsr.read', { tabs: titles.slice(i, i + 60) }, 60000);
        for (const t of j.tabs || []) if (!t.missing) out.push({ title: t.title, sheetId: t.sheetId, index: t.index, grid: toGrid(t.values || [], t.formulas) });
      }
      return out;
    },
    async createTab(title, rows, index, fmt) {
      const j = await hubCall('nsr.create', { title, index, fmt, rows: rows.map(r => r.map(c => (typeof c === 'object' ? c.f : c))) }, 60000);
      return { sheetId: j.sheetId, title: j.title || title };
    },
    async editCells(title, _id, edits, force) {
      try { await hubCall('nsr.edit', { title, edits, force: !!force }); return { ok: true }; }
      catch (e: any) { if (e?.code === 'conflict') return { ok: false, conflicts: e.data?.conflicts || [] }; throw e; }
    },
    async changes(since) { const j = await hubCall('nsr.changes', { since }, 20000); return (j.ids || []) as number[]; },
    async all(since) {
      const j = await hubCall('nsr.all', { since }, 60000);
      if (j.url) setSheetUrl(j.url);
      const tabs = (j.tabs || []).map((t: any) => {
        let grid: Grid | undefined; if (t.d) { try { const d = JSON.parse(t.d); grid = toGrid(d.v || [], d.f); } catch { /* แท็บเสีย → อ่านใหม่รอบหน้า */ } }
        return { title: String(t.title), sheetId: Number(t.sheetId), index: Number(t.index), grid, pending: !!t.pending };
      });
      return { at: Number(j.at) || Date.now(), tabs, left: Number(j.left) || 0, built: Number(j.built) || 0, status: Array.isArray(j.status) ? j.status : [] };
    },
    async setStatus(st) { await hubCall('status.set', { st }, 30000); },
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

