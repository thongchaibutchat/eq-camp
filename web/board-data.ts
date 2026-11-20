// บอร์ดภาพรวมทีม — คำนวณจากข้อมูลศูนย์กลางทีม (ทะเบียนการสร้างไฟล์ + งานของทีม + สถานะการขาย)
// ฟังก์ชันล้วน (ไม่มี UI) → ทดสอบได้: scripts/qa/board-test.ts
import type { LogEv } from './registry';
import type { TeamJob } from './jobs';
import type { SaleStatus } from '../src/nsr-core';
import { needsFollow } from '../src/nsr-core';

export const DOC_NAME: Record<string, string> = { program: 'โปรแกรมค่าย', quotation: 'ใบเสนอราคา', booking: 'หนังสือขอราคาโรงแรม', runsheet: 'Run-down' };
export const NO_NAME = 'ไม่ระบุชื่อ';
export const whoOf = (e: { byName?: string }) => String(e.byName || '').trim() || NO_NAME;
const n0 = (v: unknown) => { const x = Number(String(v ?? '').replace(/[,\s฿]/g, '')); return Number.isFinite(x) ? x : 0; };
const normSchool = (s: string) => String(s || '').replace(/\s+/g, '').replace(/^โรงเรียน/, '').toLowerCase();

// เดือนแบบ "YYYY-MM" ตามเวลาไทย (ไม่ใช่ UTC — งานตอนตี 1 ไทยต้องนับเป็นวันนั้น)
export const monthOf = (iso: string) => { const t = Date.parse(iso); if (!Number.isFinite(t)) return ''; return new Date(t + 7 * 3600e3).toISOString().slice(0, 7); };
const TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
export const monthLabel = (ym: string) => { const [y, m] = ym.split('-').map(Number); return y && m ? `${TH_M[m - 1]} ${y + 543}` : ym; };

export interface TeamMember { id: string; nick: string; role?: string; active?: boolean; email?: string; lastSeen?: string; device?: string }
export interface PersonRow { name: string; programs: number; files: number; pdf: number; schools: string[]; value: number; last: string; id?: string; email?: string; device?: string; lastSeen?: string; role?: string; member?: boolean }
export interface CourseRow { course: string; programs: number; students: number }
export interface FeedRow { ts: string; who: string; what: string; school: string; course: string; jobId: string; programId: string; device: string; email: string }
export interface BoardStats {
  month: string; months: string[];
  programs: number; schools: number; students: number; value: number; files: number; pdf: number; people: number;
  prevPrograms: number;
  byPerson: PersonRow[]; byCourse: CourseRow[]; byCourseAll: CourseRow[];
  feed: FeedRow[];
  sales: { quoted: number; hold: number; won: number; lost: number; wonMonth: number; wonValueMonth: number; closeRate: number | null; follow: SaleStatus[] };
  activeJobs: (TeamJob & { who: string })[];
}

export function teamBoard(input: { events: LogEv[]; jobs?: TeamJob[]; statuses?: SaleStatus[]; month?: string; now?: Date; team?: TeamMember[] }): BoardStats {
  const now = input.now || new Date();
  const month = input.month || monthOf(now.toISOString());
  const evs = dedupeEv(input.events).filter(e => monthOf(e.ts));
  const months = [...new Set([monthOf(now.toISOString()), ...evs.map(e => monthOf(e.ts))])].sort().reverse();

  // โปรแกรม = programId (โหลดงานเดิมซ้ำ/หลายไฟล์ = 1 โปรแกรม) · นับในเดือนที่มีการสร้างไฟล์
  const inMonth = evs.filter(e => monthOf(e.ts) === month);
  const prevYm = (() => { const [y, m] = month.split('-').map(Number); const d = new Date(Date.UTC(y, m - 2, 1)); return d.toISOString().slice(0, 7); })();
  const progKey = (e: LogEv) => e.programId || 'x' + e.eid;
  const latest = new Map<string, LogEv>();   // ข้อมูลล่าสุดของแต่ละโปรแกรม (ทั้งหมด)
  for (const e of [...evs].sort((a, b) => (a.ts < b.ts ? -1 : 1))) latest.set(progKey(e), e);
  const progMonth = new Set(inMonth.map(progKey));
  const prevPrograms = new Set(evs.filter(e => monthOf(e.ts) === prevYm).map(progKey)).size;

  // สมาชิกทีม (จากศูนย์กลาง): ทุกคนขึ้นบอร์ดแม้ยังไม่มีงานเดือนนี้ · จับคู่เหตุการณ์ด้วยรหัสสมาชิก > อีเมล > ชื่อเล่น
  const team = (input.team || []).filter(m => m && m.id && m.id !== 'shared' && m.active !== false);
  const memberOf = (e: LogEv) => team.find(m => (e.mid && e.mid === m.id) || (e.email && m.email && e.email.toLowerCase() === m.email.toLowerCase()) || whoOf(e) === m.nick);
  const people = new Map<string, PersonRow & { _p: Set<string>; _s: Set<string> }>();
  const mk = (name: string, m?: TeamMember) => ({ name, programs: 0, files: 0, pdf: 0, schools: [], value: 0, last: '', id: m?.id, email: m?.email, device: m?.device, lastSeen: m?.lastSeen, role: m?.role, member: !!m, _p: new Set<string>(), _s: new Set<string>() });
  for (const m of team) people.set('m:' + m.id, mk(m.nick, m));
  for (const e of inMonth) {
    const m = memberOf(e), pk = m ? 'm:' + m.id : 'n:' + whoOf(e); let p = people.get(pk);
    if (!p) { p = mk(whoOf(e)); people.set(pk, p); }
    if (e.device && (!p.device || !p.member)) p.device = e.device;
    p.files++; if (e.action === 'pdf') p.pdf++;
    if (e.ts > p.last) p.last = e.ts;
    const k = progKey(e);
    if (!p._p.has(k)) { p._p.add(k); const L = latest.get(k) || e; p.value += n0(L.students) * n0(L.specialPrice); }
    if (e.school) p._s.add(e.school);
  }
  const byPerson = [...people.values()].map(({ _p, _s, ...r }) => ({ ...r, programs: _p.size, schools: [..._s] }))
    .sort((a, b) => b.programs - a.programs || b.files - a.files || Number(!!b.member) - Number(!!a.member) || ((a.last || a.lastSeen || '') < (b.last || b.lastSeen || '') ? 1 : -1));

  const courseRows = (keys: Iterable<string>) => {
    const m = new Map<string, CourseRow>();
    for (const k of keys) { const L = latest.get(k); if (!L) continue; const c = L.course || L.courseCode || 'ไม่ระบุหลักสูตร'; const r = m.get(c) || { course: c, programs: 0, students: 0 }; r.programs++; r.students += n0(L.students); m.set(c, r); }
    return [...m.values()].sort((a, b) => b.programs - a.programs || b.students - a.students);
  };
  const progs = [...progMonth].map(k => latest.get(k)!).filter(Boolean);
  const schools = new Set(progs.map(p => normSchool(p.school)).filter(Boolean)).size;

  const feed: FeedRow[] = [...evs].sort((a, b) => (a.ts < b.ts ? 1 : -1)).slice(0, 40).map(e => ({
    ts: e.ts, who: (memberOf(e)?.nick) || whoOf(e), device: String(e.device || ''), email: String(e.email || ''), what: e.action === 'pdf' ? 'บันทึก PDF โปรแกรมค่าย' : `สร้าง ${DOC_NAME[e.docKind] || 'เอกสาร'}`,
    school: e.school || '', course: e.course || '', jobId: e.jobId || '', programId: e.programId || ''
  }));

  const st = (input.statuses || []);
  const cnt = { quoted: 0, hold: 0, won: 0, lost: 0 } as Record<string, number>;
  let wonMonth = 0, wonValueMonth = 0;
  for (const s of st) {
    cnt[s.status] = (cnt[s.status] || 0) + 1;
    if (s.status === 'won' && s.at && monthOf(s.at) === month) { wonMonth++; wonValueMonth += (n0(s.finalPax) || n0(s.participants)) * (n0(s.finalPrice) || n0(s.price)); }
  }
  const closeRate = cnt.won + cnt.lost ? cnt.won / (cnt.won + cnt.lost) : null;
  const follow = st.filter(s => needsFollow(s, now)).sort((a, b) => String(a.followUp || a.at || '').localeCompare(String(b.followUp || b.at || ''))).slice(0, 12);

  const weekAgo = new Date(now.getTime() - 7 * 864e5).toISOString();
  const activeJobs = (input.jobs || []).filter(j => j && !j.deleted && String(j.savedAt || '') >= weekAgo)
    .sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1)).slice(0, 12).map(j => ({ ...j, who: String(j.by || '').trim() || NO_NAME }));

  return {
    month, months,
    programs: progMonth.size, schools, students: progs.reduce((s, p) => s + n0(p.students), 0), value: progs.reduce((s, p) => s + n0(p.students) * n0(p.specialPrice), 0),
    files: inMonth.length, pdf: inMonth.filter(e => e.action === 'pdf').length, people: byPerson.filter(p => p.files > 0).length, prevPrograms,
    byPerson, byCourse: courseRows(progMonth), byCourseAll: courseRows(latest.keys()),
    feed, sales: { quoted: cnt.quoted || 0, hold: cnt.hold || 0, won: cnt.won || 0, lost: cnt.lost || 0, wonMonth, wonValueMonth, closeRate, follow }, activeJobs
  };
}
function dedupeEv(list: LogEv[]) { const m = new Map<string, LogEv>(); for (const e of list || []) if (e && e.eid && e.ts && !m.has(e.eid)) m.set(e.eid, { ...e, ts: String(e.ts) }); return [...m.values()]; }
