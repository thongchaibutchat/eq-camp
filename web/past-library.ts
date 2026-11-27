// คลังกิจกรรม/ที่พักจากงานจริงที่ทีมเคยส่ง (โฟลเดอร์งานปีปัจจุบันในศูนย์กลางทีม)
// อ่านโปรแกรม Word ทุกงาน (past.text) → สรุปเป็น "ย่อ" ต่องาน (กิจกรรมในกำหนดการ/ที่พัก/จังหวัด/หลักสูตร) เก็บในเครื่องสมาชิก
// แล้วรวมเป็นดัชนี: กิจกรรมแต่ละตัวใช้กี่งาน ล่าสุดเมื่อไร · ตัวไหนยังไม่อยู่ในคลังกิจกรรมของเว็บ · ที่พักไหนใช้บ่อย
// กติกา: ไม่เดา — ใช้ชื่อแถวตามต้นฉบับ (ตัดเลขมื้อ/Part/EP ตอนจับคู่เท่านั้น) · ข้อมูลลูกค้าอยู่ในเครื่องสมาชิกเท่านั้น (ไม่ฝังในเว็บสาธารณะ)
import { scheduleActs, actKey, CAT_ACTS, CAT_COURSES, venueDirectory, placeKey, durKeyOf, TEMPLATES } from '../src/eqcamp-core';
import type { CatAct } from '../src/eqcamp-core';
import type { PastJob, PastParse } from '../src/past-import';
import { hubReady } from './hub';
import { openPast, pastJobs, readPastCache } from './past-data';

export const PASTLIB_V = 3;              // เปลี่ยนเมื่อวิธีย่อเปลี่ยน → อ่านใหม่ทั้งหมด
const LS = 'eqcamp.pastlib.v1';
export interface PastAct { n: string; k: string; d: number; t: string; m: number; s?: 1 }
export interface PastDigest {
  id: string; fileId: string; name: string; date: string; course: string; dur: string; /** half/day1/day2/o21/o32/… */ dk?: string;
  school: string; venue: string; province: string; students: number; price: number;
  acts: PastAct[]; upd: string; v: number; err?: string;
}
export interface PastLib { at: string; items: Record<string, PastDigest> }
const empty = (): PastLib => ({ at: '', items: {} });
export const readPastLib = (): PastLib => { try { const v = JSON.parse(localStorage.getItem(LS) || 'null'); return v && v.items ? v : empty(); } catch { return empty(); } };
const listeners = new Set<() => void>();
export const onPastLib = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const writeLib = (l: PastLib) => { try { localStorage.setItem(LS, JSON.stringify(l)); } catch { /* เต็ม */ } memo.key = ''; listeners.forEach(f => { try { f(); } catch { /* */ } }); };

const toMin = (t: string): number => {
  const m = String(t || '').match(/(\d{1,2})[.:](\d{2})\s*(?:[–—\-]|ถึง)\s*(\d{1,2})[.:](\d{2})/);
  if (!m) return 0; const a = +m[1] * 60 + +m[2], b = +m[3] * 60 + +m[4]; return b > a ? b - a : 0;
};
const firstNum = (v: unknown) => { const n = Number(String(v ?? '').replace(/[^\d.]/g, '')); return Number.isFinite(n) ? n : 0; };

/** ย่อผลอ่านโปรแกรมหนึ่งงาน — กิจกรรมในกำหนดการจริงเท่านั้น (ไม่รวมมื้อ/เดินทาง/พัก/ลงทะเบียน) */
export function digestOf(job: PastJob, p: PastParse, upd = ''): PastDigest {
  const days = (p.tpl.days || []).map((rows, i) => ({ day: i + 1, items: rows.map(r => ({ time: r.t, title: r.x })) }));
  const acts = scheduleActs({ days } as any).map(a => ({ n: a.name.replace(/\s+/g, ' ').trim(), k: a.key, d: a.day, t: a.time, m: toMin(a.time), ...(a.summary ? { s: 1 as const } : {}) }));
  const c = p.camp;
  return {
    id: job.id, fileId: c.pastRef?.fileId || '', name: job.name, date: job.date, course: c.courseCode || job.courseCode || '',
    dur: c.durationMode === 'overnight' ? `${c.days || 0}ว${c.nights || 0}ค` : c.durationMode === 'half' ? 'ครึ่งวัน' : `${c.days || 1} วัน`,
    dk: durKeyOf(c), school: c.school || job.school || '', venue: String(c.venue || '').trim(), province: String(c.province || '').trim(),
    students: firstNum(c.students), price: firstNum(c.specialPrice), acts, upd, v: PASTLIB_V,
  };
}

let running: Promise<void> | null = null;
export const libRunning = () => !!running;
/** อ่านทุกงานที่เปิดได้ (เฉพาะที่ใหม่/เปลี่ยน) — ทยอย 3 งานพร้อมกัน · หยุดกลางทางได้ · ครั้งต่อไปอ่านต่อจากที่ค้าง */
export function buildPastLibrary(opt: { onStep?: (done: number, total: number, last?: string) => void; signal?: AbortSignal; force?: boolean } = {}): Promise<void> {
  if (running) return running;
  running = (async () => {
    if (!hubReady()) throw new Error('ยังไม่ได้เชื่อมต่อทีม');
    const cache = readPastCache();
    const upd = new Map(cache.folders.map(f => [f.id, f.updated || '']));
    const jobs = pastJobs(cache).filter(j => j.canOpen);
    const lib = readPastLib();
    const keep = new Set(jobs.map(j => j.id));
    for (const id of Object.keys(lib.items)) if (!keep.has(id)) delete lib.items[id];
    const todo = jobs.filter(j => { const d = lib.items[j.id]; return opt.force || !d || d.v !== PASTLIB_V || d.upd !== (upd.get(j.id) || '') || (d.err && d.err !== 'empty'); });
    let done = jobs.length - todo.length; opt.onStep?.(done, jobs.length);
    let i = 0, sinceSave = 0; const retry: Record<string, number> = {};
    const worker = async () => {
      while (i < todo.length) {
        if (opt.signal?.aborted) return;
        const j = todo[i++];
        try {
          const p = await openPast(j);
          const d = digestOf(j, p, upd.get(j.id) || '');
          lib.items[j.id] = d.acts.length ? d : { ...d, err: 'empty' };
        } catch (e: any) {
          const code = String(e?.code || '');
          if ((code === 'busy' || code === 'offline' || code === 'timeout') && (retry[j.id] = (retry[j.id] || 0) + 1) <= 3) { i--; todo.splice(i, 1); todo.push(j); await new Promise(r => setTimeout(r, 4000)); continue; }
          lib.items[j.id] = { id: j.id, fileId: '', name: j.name, date: j.date, course: j.courseCode, dur: j.duration, school: j.school, venue: '', province: '', students: 0, price: 0, acts: [], upd: upd.get(j.id) || '', v: PASTLIB_V, err: code || 'read' };
        }
        done++; opt.onStep?.(done, jobs.length, j.name);
        if (++sinceSave >= 6) { sinceSave = 0; lib.at = new Date().toISOString(); writeLib(lib); }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    lib.at = new Date().toISOString(); writeLib(lib);
  })().finally(() => { running = null; });
  return running;
}

/* ===================== ดัชนีกิจกรรม ===================== */
export interface RealAct {
  c: string; n: string; k: string; progs: number; last: string; min: number; schools: string[]; days: number[];
  cat?: CatAct; summary?: boolean;
}
export interface PastIndex { acts: RealAct[]; byCourse: Record<string, RealAct[]>; newByCourse: Record<string, RealAct[]>; programs: number; failed: number; at: string; venues: RealVenue[] }
export interface RealVenue { name: string; province: string; progs: number; last: string; courses: string[]; known?: string }
const median = (a: number[]) => { const b = a.filter(x => x > 0).sort((x, y) => x - y); return b.length ? b[Math.floor((b.length - 1) / 2)] : 0; };
const catKey = (a: CatAct) => [a.n, ...(a.a || [])].map(actKey);
const sameKey = (k: string, ck: string) => k === ck || (k.length >= 6 && ck.length >= 6 && (k.includes(ck) || ck.includes(k)));
/** หาในคลังกิจกรรมของเว็บ (หลักสูตรเดียวกันก่อน แล้วทุกหลักสูตร) */
export function catMatch(course: string, k: string): CatAct | undefined {
  if (k.length < 3) return undefined;
  const pool = CAT_ACTS.filter(a => a.c === course);
  return pool.find(a => catKey(a).some(ck => sameKey(k, ck))) || (course ? undefined : CAT_ACTS.find(a => catKey(a).some(ck => sameKey(k, ck))));
}
let memo: { key: string; idx: PastIndex | null } = { key: '', idx: null };
export function pastIndex(lib: PastLib = readPastLib()): PastIndex {
  const key = lib.at + ':' + Object.keys(lib.items).length; if (memo.key === key && memo.idx) return memo.idx;
  const ok = Object.values(lib.items).filter(d => !d.err && d.acts.length);
  const map = new Map<string, { c: string; names: Map<string, number>; k: string; progs: Set<string>; last: string; mins: number[]; schools: Set<string>; days: Set<number>; summary: boolean }>();
  for (const d of ok) for (const a of d.acts) {
    const id = `${d.course}|${a.k}`;
    let r = map.get(id); if (!r) { r = { c: d.course, names: new Map(), k: a.k, progs: new Set(), last: '', mins: [], schools: new Set(), days: new Set(), summary: !!a.s }; map.set(id, r); }
    r.names.set(a.n, (r.names.get(a.n) || 0) + 1); r.progs.add(d.id); if (d.date > r.last) r.last = d.date; if (a.m) r.mins.push(a.m); if (d.school) r.schools.add(d.school); r.days.add(a.d);
  }
  const acts: RealAct[] = [...map.values()].map(r => {
    const n = [...r.names.entries()].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0][0];
    return { c: r.c, n, k: r.k, progs: r.progs.size, last: r.last, min: median(r.mins), schools: [...r.schools].slice(0, 4), days: [...r.days].sort(), cat: catMatch(r.c, r.k), ...(r.summary ? { summary: true } : {}) };
  }).sort((a, b) => b.progs - a.progs || b.last.localeCompare(a.last));
  const byCourse: Record<string, RealAct[]> = {}, newByCourse: Record<string, RealAct[]> = {};
  for (const a of acts) { (byCourse[a.c] = byCourse[a.c] || []).push(a); if (!a.cat && !a.summary) (newByCourse[a.c] = newByCourse[a.c] || []).push(a); }
  // ที่พัก
  const dir = venueDirectory();
  const vm = new Map<string, RealVenue>();
  for (const d of ok) {
    const v = d.venue.replace(/^(?:ณ\s*)?/, '').trim(); if (v.length < 3) continue;
    const vk = placeKey(v); const known = dir.find(e => [e.name, ...e.aliases].map(placeKey).some(n => n.length >= 5 && (vk.includes(n) || n.includes(vk)))); const kn = known?.name;
    const id = (kn || v).toLowerCase().replace(/\s+/g, '');
    const r = vm.get(id) || { name: kn || v, province: d.province || known?.province || '', progs: 0, last: '', courses: [], ...(kn ? { known: kn } : {}) };
    r.progs++; if (d.date > r.last) r.last = d.date; if (d.course && !r.courses.includes(d.course)) r.courses.push(d.course); if (!r.province && d.province) r.province = d.province;
    vm.set(id, r);
  }
  const idx: PastIndex = { acts, byCourse, newByCourse, programs: ok.length, failed: Object.values(lib.items).filter(d => d.err && d.err !== 'empty').length, at: lib.at,
    venues: [...vm.values()].sort((a, b) => b.progs - a.progs || b.last.localeCompare(a.last)) };
  memo = { key, idx }; return idx;
}
/** การใช้จริงของกิจกรรมในคลัง (นับจากงานจริงที่อ่านแล้ว) */
export function realUseOf(a: CatAct, idx: PastIndex): { progs: number; last: string } | null {
  let progs = 0, last = '';
  for (const r of idx.byCourse[a.c] || []) if (r.cat?.i === a.i) { progs += r.progs; if (r.last > last) last = r.last; }
  return progs ? { progs, last } : null;
}
export const courseName = (c: string) => CAT_COURSES.find(x => x.c === c)?.label || (c ? c : 'ไม่ระบุหลักสูตร');
const TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
export const shortDate = (iso: string) => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${+m[3]} ${TH_M[+m[2] - 1]} ${String(+m[1] + 543).slice(2)}` : ''; };

/** ส่งออกให้ทีมตรวจ (Excel) — กิจกรรมจากงานจริงทุกหลักสูตร + สถานะในคลังเว็บ */
export function pastActsCsv(idx: PastIndex): string {
  const q = (s: unknown) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const head = ['หลักสูตร', 'รหัส', 'กิจกรรม (ชื่อในโปรแกรมจริง)', 'จำนวนงานที่ใช้', 'ใช้ล่าสุด', 'นาที (มัธยฐาน)', 'วันที่ในค่าย', 'อยู่ในคลังเว็บ', 'ชื่อในคลังเว็บ', 'ตัวอย่างโรงเรียน'];
  const rows = idx.acts.filter(a => !a.summary).map(a => [courseName(a.c), a.c, a.n, a.progs, shortDate(a.last), a.min || '', a.days.join(','), a.cat ? 'มีแล้ว' : 'ยังไม่มี', a.cat?.n || '', a.schools.join(' / ')]);
  return '﻿' + [head, ...rows].map(r => r.map(q).join(',')).join('\r\n');
}

/* ===================== แม่แบบ: ขายจริงระยะไหน × มีแม่แบบทีมไหม ===================== */
export const DUR_LABEL: Record<string, string> = { half: 'ครึ่งวัน', day1: 'ไป-กลับ 1 วัน', day2: 'ไป-กลับ 2 วัน', day3: 'ไป-กลับ 3 วัน', o21: '2 วัน 1 คืน', o32: '3 วัน 2 คืน', o43: '4 วัน 3 คืน' };
export interface Coverage { course: string; dk: string; real: number; last: string; tpl: number; ids: string[] }
/** ทุกคู่ หลักสูตร × ระยะเวลา ที่ขายจริง (จากโปรแกรมที่อ่านแล้ว) หรือมีแม่แบบทีม — ช่องที่ขายจริงแต่ไม่มีแม่แบบ = ควรเพิ่มแม่แบบ */
export function templateCoverage(lib: PastLib = readPastLib()): Coverage[] {
  const m = new Map<string, Coverage>();
  const get = (course: string, dk: string) => { const k = course + '|' + dk; let r = m.get(k); if (!r) { r = { course, dk, real: 0, last: '', tpl: 0, ids: [] }; m.set(k, r); } return r; };
  for (const t of TEMPLATES) get(t.code, t.dur).tpl++;
  for (const d of Object.values(lib.items)) { if (d.err || !d.course || !d.dk) continue; const r = get(d.course, d.dk); r.real++; r.ids.push(d.id); if (d.date > r.last) r.last = d.date; }
  return [...m.values()].sort((a, b) => b.real - a.real || a.course.localeCompare(b.course));
}
/** โปรแกรมจริงหลักสูตร+ระยะเวลาเดียวกัน (ใหม่สุดก่อน) — ใช้แทนแม่แบบเมื่อทีมยังไม่มีแม่แบบระยะนั้น */
export function realProgramsFor(course: string, dk: string, lib: PastLib = readPastLib()): PastDigest[] {
  return Object.values(lib.items).filter(d => !d.err && d.course === course && d.dk === dk && d.acts.length).sort((a, b) => b.date.localeCompare(a.date));
}
