// ทะเบียนโปรแกรมที่สร้างจากระบบนี้ (Program Registry)
// เก็บ 3 ชั้น — แสดงรวมกันในแท็บ "สถิติ / ประวัติ" (ตัดซ้ำด้วย eid):
//   1) เครื่องนี้ (localStorage) — ทำงานทุกที่ทันที ไม่ต้องตั้งค่า · ส่งออก/นำเข้า JSON รวมข้อมูลจากหลายเครื่องได้
//   2) ทั้งทีม (Google Sheet ผ่าน Apps Script web app) — ส่งทุกครั้งที่สร้างไฟล์ ถ้าตั้งค่าที่อยู่ไว้ (TEAM_LOG_URL หรือที่ตั้งในหน้าเว็บ)
//      อ่านกลับต้องใช้ "รหัสทีม" (ไม่ฝังใน bundle สาธารณะ — กันคนนอกดูรายชื่อโรงเรียน/ราคา)
//   3) บัญชีทีมบน claude.ai (artifact db) — ของเดิม
// ไม่เก็บต้นทุน/กำไร (ข้อมูลภายใน)
import type { Camp, DocKind } from '../src/eqcamp-core';
import { withAddonPrice, courseLabel, dayCourseOf } from '../src/eqcamp-core';

export interface LogEv {
  eid: string; ts: string; action: string; docKind: string; programId: string;
  docCode: string; school: string; courseCode: string; course: string; dayThemes: string; addons: string; partyTheme: string;
  durationMode: string; days: number; nights: number; dates: string; venue: string; province: string; region: string;
  students: number; teachers: number; normalPrice: number; specialPrice: number; source: string; by?: string; byName?: string;
}
export interface ProgRow {
  programId: string; first: string; last: string; docCode: string; school: string; course: string; courseCode: string;
  dayThemes: string; addons: string; dur: string; dates: string; venue: string; province: string; students: number; specialPrice: number;
  files: number; pdf: number; kinds: Record<string, number>; by: string[];
}

// ที่อยู่ Apps Script ของทีม (ใส่หลังทีม deploy แล้ว — ว่าง = ใช้ค่าที่ตั้งในหน้าเว็บ)
export const TEAM_LOG_URL = '';
// ชีตทะเบียนของทีม (ในโฟลเดอร์ Sales Kit) — ติดตั้ง Apps Script ในชีตนี้
export const TEAM_LOG_SHEET = 'https://docs.google.com/spreadsheets/d/1UFcE7BnzNdyHlCCZzma7L7b0kVHoSjAYJpmfVqlM2vs/edit';
const LS_EVENTS = 'eqcamp.registry.v1', LS_URL = 'eqcamp.teamLogUrl', LS_KEY = 'eqcamp.teamKey', MAX_LOCAL = 5000;

const ls = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); return true; } catch { return false; } }
};
export const teamLogUrl = () => (ls.get(LS_URL) || TEAM_LOG_URL || '').trim();
export const teamKey = () => (ls.get(LS_KEY) || '').trim();
export const setTeamLog = (url: string, key: string) => { ls.set(LS_URL, url.trim()); ls.set(LS_KEY, key.trim()); };

// รหัสโปรแกรม = ลายนิ้วมือของงาน (รหัสเอกสาร + โรงเรียน + วันที่ + หลักสูตร) → โหลดซ้ำ/หลายไฟล์ของงานเดียวกัน นับเป็น 1 โปรแกรม
const norm = (s: string) => String(s || '').replace(/\s+/g, '').toLowerCase();
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
export const programIdOf = (c: Camp) => 'p' + hash([c.docCode, c.school, c.dates, c.courseCode || c.subject].map(norm).join('|'));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export function makeEvent(action: string, c0: Camp, dk: DocKind | undefined, source: string, who?: { by?: string; byName?: string }): LogEv {
  const c = withAddonPrice(c0);
  const n = c.durationMode === 'half' ? 1 : Math.max(1, c.days || 1);
  const themes = c.courseCode && (c.dayCourses || []).some(Boolean) ? Array.from({ length: n }, (_, i) => `วันที่ ${i + 1} ${courseLabel(dayCourseOf(c, i))}`).join(' · ') : '';
  return {
    eid: uid(), ts: new Date().toISOString(), action, docKind: dk || (action === 'pdf' ? 'program' : ''), programId: programIdOf(c0),
    docCode: c.docCode || '', school: c.school || '', courseCode: c.courseCode || '', course: c.courseCode ? courseLabel(c.courseCode) : (c.subject || ''),
    dayThemes: themes, addons: (c.addons || []).map(a => courseLabel(a.code)).join(' + '), partyTheme: c.partyTheme || '',
    durationMode: c.durationMode || '', days: c.days || 0, nights: c.nights || 0, dates: c.dates || '', venue: c.venue || '', province: c.province || '', region: String(c.region || ''),
    students: c.students || 0, teachers: c.teachers || 0, normalPrice: c.normalPrice || 0, specialPrice: c.specialPrice || 0,
    source, by: who?.by || '', byName: who?.byName || ''
  };
}

export function loadLocal(): LogEv[] { try { const j = JSON.parse(ls.get(LS_EVENTS) || '[]'); return Array.isArray(j) ? j.filter(e => e && e.eid) : []; } catch { return []; } }
export function saveLocal(list: LogEv[]) { const uniq = dedupe(list).sort((a, b) => (a.ts < b.ts ? 1 : -1)).slice(0, MAX_LOCAL); return ls.set(LS_EVENTS, JSON.stringify(uniq)); }
export const dedupe = (list: LogEv[]) => { const m = new Map<string, LogEv>(); for (const e of list) if (e && e.eid && !m.has(e.eid)) m.set(e.eid, e); return [...m.values()]; };

// บันทึก 1 เหตุการณ์: เครื่องนี้เสมอ + ส่งเข้าชีตทีม (ถ้าตั้งค่า) — ล้มเหลวเงียบ ไม่ทำให้ดาวน์โหลดพัง
export async function record(ev: LogEv): Promise<void> {
  saveLocal([ev, ...loadLocal()]);
  const url = teamLogUrl(); if (!url) return;
  try { await fetch(url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(ev) }); } catch { /* เงียบ */ }
}
// อ่านทั้งทีมจากชีต (ต้องมีรหัสทีม)
export async function readTeam(): Promise<{ ok: boolean; events: LogEv[]; msg?: string }> {
  const url = teamLogUrl(), key = teamKey();
  if (!url) return { ok: false, events: [], msg: 'ยังไม่ได้ตั้งค่า' };
  if (!key) return { ok: false, events: [], msg: 'ยังไม่ได้ใส่รหัสทีม' };
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 12000);
    const r = await fetch(`${url}${url.includes('?') ? '&' : '?'}key=${encodeURIComponent(key)}`, { signal: ctl.signal }); clearTimeout(t);
    const j = await r.json();
    if (!j || j.ok === false) return { ok: false, events: [], msg: j && j.error === 'key' ? 'รหัสทีมไม่ถูกต้อง' : 'อ่านชีตไม่สำเร็จ' };
    return { ok: true, events: (j.events || []).filter((e: any) => e && e.eid) };
  } catch { return { ok: false, events: [], msg: 'เชื่อมต่อชีตทีมไม่ได้' }; }
}

// สรุปเป็น "โปรแกรม" (ตัดซ้ำด้วย programId) — นับไฟล์/PDF/ชนิดเอกสารต่อโปรแกรม
export function summarize(events: LogEv[]) {
  const progs = new Map<string, ProgRow>();
  const ordered = [...events].sort((a, b) => (a.ts < b.ts ? -1 : 1));
  for (const e of ordered) {
    const id = e.programId || ('x' + e.eid);
    let p = progs.get(id);
    if (!p) { p = { programId: id, first: e.ts, last: e.ts, docCode: '', school: '', course: '', courseCode: '', dayThemes: '', addons: '', dur: '', dates: '', venue: '', province: '', students: 0, specialPrice: 0, files: 0, pdf: 0, kinds: {}, by: [] }; progs.set(id, p); }
    // ข้อมูลล่าสุดของงานเป็นค่าที่แสดง
    Object.assign(p, { last: e.ts, docCode: e.docCode, school: e.school, course: e.course, courseCode: e.courseCode, dayThemes: e.dayThemes, addons: e.addons, dates: e.dates, venue: e.venue, province: e.province, students: e.students, specialPrice: e.specialPrice,
      dur: e.durationMode === 'half' ? 'ครึ่งวัน' : e.durationMode === 'day' ? `${e.days} วัน` : `${e.days} วัน ${e.nights} คืน` });
    p.files++; if (e.action === 'pdf') p.pdf++;
    const k = e.docKind || 'program'; p.kinds[k] = (p.kinds[k] || 0) + 1;
    const who = e.byName || e.by || ''; if (who && !p.by.includes(who)) p.by.push(who);
  }
  const list = [...progs.values()].sort((a, b) => (a.last < b.last ? 1 : -1));
  const byMonth: Record<string, number> = {}; const byCourse: Record<string, number> = {};
  for (const p of list) { const m = p.first.slice(0, 7); byMonth[m] = (byMonth[m] || 0) + 1; const c = p.course || '—'; byCourse[c] = (byCourse[c] || 0) + 1; }
  const schools = new Set(list.map(p => norm(p.school)).filter(Boolean));
  const students = list.reduce((s, p) => s + (p.students || 0), 0);
  const value = list.reduce((s, p) => s + (p.students || 0) * (p.specialPrice || 0), 0);
  return { programs: list, files: events.length, pdf: events.filter(e => e.action === 'pdf').length, schools: schools.size, students, value, byMonth, months: Object.keys(byMonth).sort(), byCourse };
}

const csvEsc = (v: any) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
export function programsCsv(list: ProgRow[]): string {
  const head = ['สร้างครั้งแรก', 'แก้ล่าสุด', 'รหัสเอกสาร', 'โรงเรียน', 'หลักสูตร', 'ธีมรายวัน', 'กิจกรรมเสริม', 'ระยะเวลา', 'วันที่ค่าย', 'สถานที่', 'จังหวัด', 'นักเรียน', 'ราคา/ท่าน', 'มูลค่า (นักเรียน×ราคา)', 'จำนวนไฟล์', 'PDF', 'ผู้สร้าง'];
  const rows = list.map(p => [p.first.slice(0, 16).replace('T', ' '), p.last.slice(0, 16).replace('T', ' '), p.docCode, p.school, p.course, p.dayThemes, p.addons, p.dur, p.dates, p.venue, p.province, p.students, p.specialPrice, p.students * p.specialPrice, p.files, p.pdf, p.by.join(' / ')]);
  return '﻿' + [head, ...rows].map(r => r.map(csvEsc).join(',')).join('\n');
}

// โค้ด Google Apps Script สำหรับชีตบันทึกของทีม (วางใน ส่วนขยาย → Apps Script แล้ว Deploy เป็น Web app)
export const appsScriptCode = (key: string) => `// EQ Camp — บันทึกโปรแกรมที่สร้าง (วางทั้งไฟล์นี้ใน ส่วนขยาย → Apps Script ของชีต แล้ว Deploy เป็น Web app)
// เขียน: ใครก็ได้ที่ใช้เว็บ (เพิ่มแถวอย่างเดียว) · อ่าน: ต้องมีรหัสทีมด้านล่าง
const TEAM_KEY = '${key}';
const COLS = ['ts','eid','programId','action','docKind','docCode','school','courseCode','course','dayThemes','addons','partyTheme','durationMode','days','nights','dates','venue','province','region','students','teachers','normalPrice','specialPrice','source','by','byName'];
function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName('Log') || ss.getSheets()[0];
  if (sh.getLastRow() === 0) { sh.appendRow(COLS); sh.setFrozenRows(1); }
  return sh;
}
function doPost(e) {
  try {
    const ev = JSON.parse(e.postData.contents);
    if (!ev || !ev.eid || !ev.ts) return out_({ ok: false });
    const lock = LockService.getScriptLock(); lock.waitLock(10000);
    try { sheet_().appendRow(COLS.map(c => (ev[c] === undefined ? '' : String(ev[c]).slice(0, 300)))); } finally { lock.releaseLock(); }
    return out_({ ok: true });
  } catch (err) { return out_({ ok: false }); }
}
function doGet(e) {
  if (!e.parameter.key || e.parameter.key !== TEAM_KEY) return out_({ ok: false, error: 'key' });
  const v = sheet_().getDataRange().getValues(); const head = v.shift() || [];
  const events = v.map(r => { const o = {}; head.forEach((h, i) => o[h] = r[i] instanceof Date ? r[i].toISOString() : r[i]); return o; });
  return out_({ ok: true, events: events });
}
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
`;
export const newTeamKey = () => 'eq-' + Array.from(crypto.getRandomValues(new Uint8Array(9))).map(b => b.toString(36).padStart(2, '0')).join('').slice(0, 14);
