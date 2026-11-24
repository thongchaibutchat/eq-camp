/* งานที่บันทึกไว้ (Saved jobs) — ทำต่อภายหลังได้ทุกงาน
 * บันทึกอัตโนมัติทุกครั้งที่แก้ (ไม่ต้องกดเซฟ) + เมื่อสร้างไฟล์ (นับจำนวนไฟล์) · เก็บในเครื่องนี้ (localStorage)
 * ไม่เก็บไฟล์ภาพที่อัปโหลดเอง (โควตาเบราว์เซอร์จำกัด) — ภาพจากไฟล์ค่าย/ชุดภาพจะดึงให้ใหม่ตอนเปิดงาน
 * ย้ายไปเครื่องอื่น = "ส่งออกงาน" (.json รวมภาพ) แล้ว "นำเข้างาน" */
export interface Job { id: string; name: string; course?: string; school?: string; dates?: string; duration?: string; savedAt: string; files: number; lastFileAt?: string; snap: any;
  /** ทำเสร็จแล้ว (กด "เสร็จสิ้น") · แก้ต่อภายหลัง = กลับเป็นกำลังทำเอง */ done?: boolean; doneAt?: string; doneBy?: string }
const KEY = 'eqcamp.jobs.v1';
const MAX = 80;

export const newJobId = () => 'j' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const loadJobs = (): Job[] => {
  try { const r = localStorage.getItem(KEY); const a = r ? JSON.parse(r) : []; return Array.isArray(a) ? a.filter(j => j && j.id && j.snap) : []; } catch { return []; }
};
const write = (jobs: Job[]): boolean => {
  // เต็มโควตา → ตัดงานเก่าสุดทีละงานจนบันทึกได้ (งานล่าสุดสำคัญกว่า)
  let list = jobs.slice(0, MAX);
  while (list.length) { try { localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch { list = list.slice(0, -1); } }
  return false;
};
export const saveJob = (j: Omit<Job, 'files' | 'savedAt'> & { files?: number; fileMade?: boolean }): Job[] => {
  const jobs = loadJobs(); const old = jobs.find(x => x.id === j.id);
  const now = new Date().toISOString();
  const rec: Job = { ...old, ...j, savedAt: now, files: (old?.files || 0) + (j.fileMade ? 1 : 0), lastFileAt: j.fileMade ? now : old?.lastFileAt } as Job;
  delete (rec as any).fileMade;
  const next = [rec, ...jobs.filter(x => x.id !== j.id)];
  write(next); return next;
};
export const removeJob = (id: string): Job[] => { const next = loadJobs().filter(j => j.id !== id); write(next); return next; };
export const ago = (iso?: string): string => {
  if (!iso) return '';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'เมื่อสักครู่';
  if (s < 3600) return `${Math.floor(s / 60)} นาทีที่แล้ว`;
  if (s < 86400) return `${Math.floor(s / 3600)} ชั่วโมงที่แล้ว`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} วันที่แล้ว`;
  try { return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }); } catch { return iso.slice(0, 10); }
};

// ── งานของทีม (ศูนย์กลางทีม): ทุกเครื่องเห็นงานเดียวกัน เปิดทำต่อจากมือถือ/คอมเครื่องไหนก็ได้ ──
import { hubReady, hubCall, enqueue, deviceId, onQueued } from './hub';
export interface TeamJob { done?: boolean; doneAt?: string; doneBy?: string; id: string; savedAt: string; name: string; course?: string; school?: string; dates?: string; duration?: string; docCode?: string; files?: number; lastFileAt?: string; by?: string; dev?: string; deleted?: boolean }
const TKEY = 'eqcamp.jobs.team.v1';
export const loadTeamJobs = (): TeamJob[] => { try { const a = JSON.parse(localStorage.getItem(TKEY) || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } };
export async function refreshTeamJobs(): Promise<TeamJob[] | null> {
  if (!hubReady()) return null;
  try { const j = await hubCall('jobs', {}, 30000); const list: TeamJob[] = (j.jobs || []).filter((x: any) => x && x.id); try { localStorage.setItem(TKEY, JSON.stringify(list)); } catch { /* quota */ } return list; }
  catch { return null; }
}
export async function fetchTeamJob(id: string): Promise<(TeamJob & { snap: any }) | null> {
  const j = await hubCall('job.get', { id }, 30000); const job = j.job && j.job.snap ? j.job : null;
  if (job) setSync(id, { base: job.savedAt, h: contentHash(job.snap, job.files, job.name) + (job.done ? ':D' : '') });   // ฉบับที่เปิดมา = ฐานของการแก้ครั้งต่อไป
  return job;
}
// ── หลายคนแก้งานเดียวกัน: จำ "ฉบับทีมที่เครื่องนี้ทำต่อจาก" (base) → ศูนย์กลางไม่ยอมให้ทับฉบับที่ใหม่กว่าจากเครื่องอื่น (ไม่มีงานหายเงียบ ๆ)
// · เนื้องานไม่เปลี่ยน (เช่น แค่เปิดงาน) → ไม่ส่งซ้ำ
const SKEY = 'eqcamp.jobs.sync.v1';
type Sync = { base: string; h: string };
const syncAll = (): Record<string, Sync> => { try { return JSON.parse(localStorage.getItem(SKEY) || '{}') || {}; } catch { return {}; } };
const setSync = (id: string, v: Sync) => { const a = syncAll(); a[id] = v; const ks = Object.keys(a); if (ks.length > 300) ks.slice(0, ks.length - 300).forEach(k => delete a[k]); try { localStorage.setItem(SKEY, JSON.stringify(a)); } catch { /* */ } };
const stable = (snap: any) => { try { const { savedAt, ...rest } = snap || {}; return JSON.stringify(rest); } catch { return ''; } };
const hstr = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36) + ':' + s.length; };
export const contentHash = (snap: any, files?: number, name?: string) => hstr(stable(snap) + '|' + (Number(files) || 0) + '|' + (name || ''));
// ส่งงานขึ้นทีม (เข้าคิว — งานเดียวกันส่งเฉพาะครั้งล่าสุด)
export function pushJob(j: Job, opt: { force?: boolean } = {}) {
  if (!hubReady()) return;
  const { snap, ...meta } = j;
  const h = contentHash(snap, j.files, j.name) + (j.done ? ':D' : ''), cur = syncAll()[j.id];   // เปลี่ยนสถานะเสร็จ/ไม่เสร็จ = ส่งใหม่
  if (!opt.force && cur && cur.h === h) return;
  enqueue('job.put', { job: { ...meta, done: !!j.done, docCode: snap?.camp?.docCode || '', snap }, base: cur?.base || '', h }, 'job:' + j.id);
}
// เลือก "ทำต่อฉบับของฉัน" หลังชนกัน → ยอมรับว่ารู้แล้วว่ามีฉบับใหม่กว่า (base = ฉบับทีมล่าสุด) แล้วส่งของฉันทับ
export function keepMine(j: Job, teamSavedAt: string) { setSync(j.id, { base: teamSavedAt, h: '' }); pushJob(j, { force: true }); }
const conflictSubs = new Set<(id: string, info: { savedAt?: string; by?: string }) => void>();
export const onJobConflict = (f: (id: string, info: { savedAt?: string; by?: string }) => void) => { conflictSubs.add(f); return () => { conflictSubs.delete(f); }; };
onQueued('job.put', (body, res, err) => {
  const id = body?.job?.id; if (!id) return;
  if (res && res.savedAt) setSync(id, { base: res.savedAt, h: body.h || '' });
  else if (err && err.code === 'conflict') conflictSubs.forEach(f => { try { f(id, { savedAt: err.data?.savedAt, by: err.data?.by }); } catch { /* */ } });
});
export function pushDelete(id: string) { if (hubReady()) enqueue('job.del', { id }, 'job:' + id); }
export const isMine = (t: TeamJob) => !t.dev || t.dev === deviceId();

// สถานะงานสำหรับแสดงผล
export const jobStatus = (j?: { done?: boolean } | null) => (j && j.done ? 'done' : 'doing') as 'done' | 'doing';
