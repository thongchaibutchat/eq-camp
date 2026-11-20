// ศูนย์กลางทีม (Team Hub) — เชื่อมทุกส่วนเข้าหาข้อมูลชุดเดียวกันแบบเรียลไทม์ ทุกเครื่อง/ทุกแอป
// ฝั่งเซิร์ฟเวอร์ = Apps Script ตัวเดียวบนชีต NSR (ทีมติดตั้งครั้งเดียว) ให้บริการ:
//   · NSR: รายชื่อแท็บ / อ่าน / สร้างแท็บ / แก้ช่อง / แท็บที่เปลี่ยน
//   · ทะเบียนโปรแกรม: บันทึก/อ่านเหตุการณ์สร้างไฟล์
//   · งานของทีม: เก็บ/เปิด/ลบงาน (บรีฟ+ค่าทั้งหมดของงาน) — เปิดต่อจากเครื่องไหนก็ได้
//   · rev: เลขรุ่นข้อมูล — เปลี่ยนทุกครั้งที่มีคนแก้ (ผ่านเว็บ หรือแก้ในชีตเอง) → ทุกเครื่องรู้ภายใน ~5 วินาที
// ความปลอดภัย: ทุกคำสั่งต้องมี "รหัสทีม" · ไม่ฝังที่อยู่/รหัสใน bundle สาธารณะ · เข้าร่วมทีมด้วยลิงก์เชิญ (#/join/…)
// ออฟไลน์: คำสั่งเขียนเข้าคิวในเครื่อง แล้วส่งเองเมื่อกลับมาออนไลน์

export interface HubState { status: 'off' | 'connecting' | 'live' | 'offline' | 'error' | 'blocked'; code?: string; msg?: string; lastOk?: number; rev?: string; pending: number }
type Listener = (rev: string, changed: boolean) => void;

const LS = { url: 'eqcamp.hub.url', key: 'eqcamp.hub.key', name: 'eqcamp.hub.name', dev: 'eqcamp.hub.device', q: 'eqcamp.hub.queue.v1' };
const ls = {
  get(k: string) { try { return localStorage.getItem(k) || ''; } catch { return ''; } },
  set(k: string, v: string) { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); return true; } catch { return false; } }
};
// ที่อยู่ web app ฝังได้เมื่อทีมส่งมา (ไม่ลับ) — รหัสทีมไม่ฝังเด็ดขาด
export const HUB_URL = 'https://script.google.com/macros/s/AKfycbxLIYQHufbhDLnpF_bCwXhs8ZaCqAZeVNVZJRmNshaS3jDsu7zCh8lEB_wxKcQ-k1L6KA/exec';
export const URL_RX = /^https:\/\/script\.google(usercontent)?\.com\/macros\/s\/[\w-]+\/exec$/;

// ย้ายค่าที่ตั้งไว้แบบเดิม (NSR / ชีตทะเบียน) มาเป็นศูนย์กลางเดียว
(function migrate() {
  if (ls.get(LS.url)) return;
  const u = ls.get('eqcamp.nsr.url') || ls.get('eqcamp.teamLogUrl'); const k = ls.get('eqcamp.nsr.key') || ls.get('eqcamp.teamKey');
  if (u && k) { ls.set(LS.url, u); ls.set(LS.key, k); }
})();

export const hubUrl = () => (ls.get(LS.url) || HUB_URL).trim();
export const hubKey = () => ls.get(LS.key).trim();
export const hubReady = () => URL_RX.test(hubUrl()) && !!hubKey();
export const userName = () => ls.get(LS.name).trim();
export const setUserName = (n: string) => { ls.set(LS.name, n.trim().slice(0, 40)); };
export const deviceId = () => { let d = ls.get(LS.dev); if (!d) { d = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); ls.set(LS.dev, d); } return d; };
export function setHub(url: string, key: string) { ls.set(LS.url, url.trim()); ls.set(LS.key, key.trim()); state = { ...state, status: hubReady() ? 'connecting' : 'off', msg: '', code: undefined }; emitState(); kick(); }
export function clearHub() { ls.set(LS.url, ''); ls.set(LS.key, ''); state = { status: 'off', pending: queue().length }; emitState(); }

// ── ลิงก์เชิญ: เปิดลิงก์นี้บนเครื่อง/แอปไหนก็เข้าร่วมทีมได้ทันที (ที่อยู่+รหัส อยู่หลัง # → ไม่ถูกส่งถึงเซิร์ฟเวอร์เว็บ) ──
const b64u = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));
export const inviteLink = (base?: string) => `${base || (location.origin + location.pathname)}#/join/${b64u(JSON.stringify({ u: hubUrl(), k: hubKey() }))}`;
// ลิงก์ติดตั้ง (เจ้าของชีต): #/setup/<รหัสทีม> — เปิดแล้วกรอกเฉพาะที่อยู่ Web app (รหัสตรงกับโค้ดที่วางแล้ว)
export const setupKeyFrom = (hash: string): string => { const m = hash.match(/^#\/setup\/([\w-]+)/); if (!m) return ''; try { const k = unb64u(m[1]); return /^[\w-]{8,64}$/.test(k) ? k : ''; } catch { return ''; } };
export const setupLink = (key: string, base: string) => `${base}#/setup/${b64u(key)}`;
// อ่านลิงก์ทีมได้ทุกรูป: ลิงก์เต็ม #/join/…, ลิงก์สั้น #/t/<รหัส>, # ที่ถูกแปลงเป็น %23 (LINE/แอปแชต), โค้ดลิงก์ล้วน หรือรหัสทีมล้วน (eq-…)
const KEY_RX = /^eq-[a-z0-9]{8,40}$/i;
export function parseInvite(text: string): { u: string; k: string } | null {
  let t = String(text || '').trim(); if (!t) return null;
  try { if (/%23|%2F/i.test(t)) t = decodeURIComponent(t); } catch { /* ไม่ใช่ลิงก์ที่เข้ารหัส */ }
  const sh = t.match(/(?:#|\/)t\/(eq-[a-z0-9]{8,40})/i) || (KEY_RX.test(t) ? [t, t] : null);
  if (sh && HUB_URL) return { u: HUB_URL, k: sh[1] };
  const m = t.match(/(?:#|\/)join\/([\w-]{20,})/) || (/^[\w-]{40,}$/.test(t) ? [t, t] : null);
  if (m) { try { const j = JSON.parse(unb64u(m[1])); if (URL_RX.test(j.u) && j.k) return { u: j.u, k: String(j.k) }; } catch { /* ลิงก์เสีย/ถูกตัด */ } }
  return null;
}
export const isInviteHash = (h: string) => /^#\/(join|t)\//.test(h);
export const inviteHash = () => hubUrl() === HUB_URL && HUB_URL ? `#/t/${hubKey()}` : `#/join/${b64u(JSON.stringify({ u: hubUrl(), k: hubKey() }))}`;
export function acceptInvite(text: string): boolean {
  const v = parseInvite(text); if (!v) return false; setHub(v.u, v.k);
  // เปิดจากแอปแชต (LINE ฯลฯ) แล้วกด "เปิดในเบราว์เซอร์" → ลิงก์ที่ส่งต่อยังพารหัสทีมไปด้วย
  try { sessionStorage.setItem('eqcamp.inviteHash', inviteHash()); } catch { /* */ }
  return true;
}
// ลิงก์ทีมแบบสั้น (ใช้ศูนย์กลางที่ฝังไว้) — สั้น ไม่ขาดกลางบรรทัดในแชต; ศูนย์กลางอื่นใช้ลิงก์เต็ม
export const teamLink = (base?: string) => `${base || (location.origin + location.pathname)}${inviteHash()}`;

// ── เรียกเซิร์ฟเวอร์ ──
export class HubError extends Error { code: string; data?: any; constructor(code: string, msg: string, data?: any) { super(msg); this.code = code; this.data = data; } }
export const IN_CLAUDE = typeof window !== 'undefined' && !!(window as any).claude;
// claude.ai ห้ามหน้าเว็บเรียกเว็บอื่น (fetch ไป Google ถูกบล็อกเสมอ) → ข้อมูลทีมแบบสดใช้ได้เฉพาะเวอร์ชันเว็บนี้
export const LIVE_WEB = 'https://thongchaibutchat.github.io/eq-camp/';
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
// ศูนย์กลางทีม (Apps Script) รับงานพร้อมกันได้จำกัด (~30 คำสั่งพร้อมกันต่อบัญชีเจ้าของ) → คำตอบ "ไม่ว่าง" = รอสุ่มเวลาแล้วลองใหม่เอง (คำสั่งยังไม่ถูกทำ จึงลองซ้ำได้ปลอดภัย)
export const BUSY_RETRIES = 3;
export async function hubCall<T = any>(op: string, body: Record<string, any> = {}, timeout = 45000): Promise<T> {
  for (let i = 0; ; i++) {
    try { return await hubCallOnce<T>(op, body, timeout); }
    catch (e: any) {
      if (e?.code !== 'busy' || i >= BUSY_RETRIES) throw e;
      busyHits++; await sleep(Math.round((600 * 2 ** i) * (0.6 + Math.random() * 0.8)));
    }
  }
}
export let busyHits = 0;
async function hubCallOnce<T = any>(op: string, body: Record<string, any>, timeout: number): Promise<T> {
  const url = hubUrl(), key = hubKey();
  if (!URL_RX.test(url) || !key) throw new HubError('off', 'ยังไม่ได้เชื่อมต่อทีม');
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeout);
  let r: Response;
  try {
    r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...body, op, key, dev: deviceId(), by: userName() }), signal: ctl.signal, cache: 'no-store' });
  } catch (e: any) {
    clearTimeout(t);
    if (e?.name === 'AbortError') throw new HubError('timeout', 'ชีตตอบช้าเกินไป');
    if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new HubError('offline', 'ไม่มีอินเทอร์เน็ต');
    throw new HubError(IN_CLAUDE ? 'blocked' : 'net', IN_CLAUDE ? 'หน้านี้บน claude.ai ต่อออกไป Google ไม่ได้ — ใช้เวอร์ชันเว็บเพื่อซิงก์ทีม' : 'เชื่อมต่อศูนย์กลางทีมไม่ได้');
  }
  let text = ''; try { text = await r.text(); } catch { /* ขาดกลางทาง */ } finally { clearTimeout(t); }
  let j: any = null; try { j = JSON.parse(text); } catch { /* ไม่ใช่ JSON */ }
  if (!j) {
    // Google ตอบหน้า HTML (คนใช้พร้อมกันเกินโควตา/เซิร์ฟเวอร์สะดุด) → นับเป็น "ไม่ว่าง" ลองใหม่เอง
    if (r.status === 429 || r.status >= 500 || /too many|simultaneous|invoked|try again|ลองอีกครั้ง|ไม่พร้อมใช้งาน|unavailable|Service/i.test(text)) throw new HubError('busy', 'ศูนย์กลางทีมมีคนใช้พร้อมกันมาก — กำลังลองใหม่');
    throw new HubError('bad', 'ศูนย์กลางทีมตอบกลับผิดรูปแบบ (ตรวจว่า Deploy เป็น Web app แล้ว)');
  }
  if (j.ok === false) {
    const c = j.error || 'server';
    const msg: Record<string, string> = { key: 'รหัสทีมในเครื่องนี้ไม่ตรงกับศูนย์กลาง — เปิดลิงก์เชิญจากกลุ่มทีมอีกครั้ง', exists: 'มีแท็บชื่อนี้แล้ว', missing: 'ไม่พบรายการนี้แล้ว', op: 'ศูนย์กลางทีมเป็นรุ่นเก่า — คัดลอกโค้ดใหม่แล้ว Deploy อีกครั้ง', conflict: 'มีคนแก้ระหว่างนี้', busy: 'ศูนย์กลางทีมมีคนใช้พร้อมกันมาก — ลองใหม่อีกครั้ง' };
    throw new HubError(c, msg[c] || j.message || 'ศูนย์กลางทีมตอบกลับไม่สำเร็จ', j);
  }
  noteOk(j.rev, j.areas, op);
  return j as T;
}

// ── คิวคำสั่งเขียน (ออฟไลน์/เน็ตหลุด) — ส่งตามลำดับ · คีย์ซ้ำ = แทนของเก่า (เช่น บันทึกงานเดียวกันหลายครั้ง ส่งครั้งล่าสุดครั้งเดียว) ──
type QItem = { id: string; op: string; body: any; ck?: string; at: number; tries: number };
const queue = (): QItem[] => { try { const a = JSON.parse(ls.get(LS.q) || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } };
const saveQ = (q: QItem[]) => { ls.set(LS.q, q.length ? JSON.stringify(q.slice(-500)) : ''); state = { ...state, pending: q.length }; emitState(); };
export function enqueue(op: string, body: any, ck?: string) {
  let q = queue(); if (ck) q = q.filter(x => x.ck !== ck);
  q.push({ id: Math.random().toString(36).slice(2), op, body, ck, at: Date.now(), tries: 0 }); saveQ(q);
  if (hubReady()) setTimeout(flush, 50);
}
// ผลของคำสั่งในคิว (เช่น บันทึกงานสำเร็จได้เวลาใหม่ / ชนกับเครื่องอื่น) → ส่วนที่สนใจรับไปจัดการ
const qSubs = new Map<string, Set<(body: any, res: any, err: HubError | null) => void>>();
export const onQueued = (op: string, fn: (body: any, res: any, err: HubError | null) => void) => { if (!qSubs.has(op)) qSubs.set(op, new Set()); qSubs.get(op)!.add(fn); return () => { qSubs.get(op)!.delete(fn); }; };
const qEmit = (op: string, body: any, res: any, err: HubError | null) => qSubs.get(op)?.forEach(f => { try { f(body, res, err); } catch { /* */ } });
let flushing = false;
export async function flush() {
  if (flushing || !hubReady()) return; flushing = true;
  try {
    for (;;) {
      const q = queue(); if (!q.length) break;
      const it = q[0];
      try { const res = await hubCall(it.op, it.body); saveQ(queue().filter(x => x.id !== it.id)); bc?.postMessage({ t: 'changed' }); qEmit(it.op, it.body, res, null); }
      catch (e: any) {
        if (['net', 'offline', 'timeout', 'blocked', 'off', 'busy'].includes(e?.code)) break;  // ชั่วคราว → ลองใหม่ภายหลัง (ไม่นับเป็นผิด ไม่ทิ้งข้อมูล)
        if (e?.code === 'conflict') { saveQ(queue().filter(x => x.id !== it.id)); qEmit(it.op, it.body, null, e); continue; }   // มีคนบันทึกฉบับใหม่กว่า → ไม่ทับ แจ้งผู้ใช้เลือกเอง
        it.tries++; const rest = queue().filter(x => x.id !== it.id);
        saveQ(it.tries >= 3 ? rest : [it, ...rest]);                                           // ผิดถาวร 3 ครั้ง → ทิ้ง (ไม่ค้างคิว)
        if (it.tries < 3) break;
      }
    }
  } finally { flushing = false; }
}

// ── เรียลไทม์ ──
// · ถาม rev ทุก ~5 วิ ขณะมีคนใช้งานหน้าจอ · ไม่ได้แตะหน้าจอเกิน 3 นาที = ทุก ~20 วิ · ซ่อนหน้า = หยุด · สุ่มเหลื่อมเวลา ±15% (หลายเครื่องไม่ยิงพร้อมกัน)
// · เบราว์เซอร์เดียวเปิดหลายแท็บ = ถามแท็บเดียว (ผู้นำ) แล้วบอกแท็บอื่นผ่าน localStorage
// · ศูนย์กลางรุ่น 8 บอก "ส่วนที่เปลี่ยน" (nsr/log/job/st) → แต่ละหน้าโหลดใหม่เฉพาะส่วนที่ตัวเองใช้ และหน่วงสุ่ม 0–2.5 วิ (ไม่ถล่มศูนย์กลางพร้อมกันหลังมีคนบันทึก)
export type Area = 'nsr' | 'log' | 'job' | 'st';
export const AREAS: Area[] = ['nsr', 'log', 'job', 'st'];
let state: HubState = { status: hubReady() ? 'connecting' : 'off', pending: queue().length };
const stateSubs = new Set<(s: HubState) => void>();
const revSubs = new Set<Listener>();
const areaSubs = new Set<{ areas: Area[]; fn: (changed: Area[]) => void }>();
const emitState = () => stateSubs.forEach(f => { try { f(state); } catch { /* */ } });
export const hubState = () => state;
export const onHubState = (f: (s: HubState) => void) => { stateSubs.add(f); f(state); return () => { stateSubs.delete(f); }; };
export const onRev = (f: Listener) => { revSubs.add(f); start(); return () => { revSubs.delete(f); }; };
// เรียก fn เมื่อส่วนข้อมูลที่สนใจเปลี่ยน (เครื่องอื่นบันทึก/คนแก้ชีต) — ไม่เรียกตอนเริ่ม
export const onArea = (areas: Area[], fn: (changed: Area[]) => void) => { const sub = { areas, fn }; areaSubs.add(sub); start(); return () => { areaSubs.delete(sub); }; };
export const REFRESH_JITTER_MS = 2500;
let lastRev = '', lastAreas: Record<string, string> | null = null;
function noteOk(rev?: string, areas?: Record<string, string>, op?: string) {
  state = { ...state, status: 'live', msg: '', code: undefined, lastOk: Date.now() };
  const revChanged = !!rev && rev !== lastRev, had = !!lastRev;
  let changed: Area[] = [];
  if (areas && typeof areas === 'object') { if (lastAreas) changed = AREAS.filter(a => String(areas[a] ?? '') !== String(lastAreas![a] ?? '')); lastAreas = { ...areas }; }
  else if (revChanged && had) changed = [...AREAS];                                   // ศูนย์กลางรุ่นเก่า: ไม่รู้ว่าส่วนไหน = ถือว่าทุกส่วน
  if (revChanged) { lastRev = rev!; state.rev = rev; }
  emitState();
  if (revChanged) revSubs.forEach(f => { try { f(rev!, had); } catch { /* */ } });
  if (changed.length && had) fireAreas(changed, op === 'rev');
}
const pendingAreas = new Set<Area>(); let areaT: any = null;
function fireAreas(changed: Area[], jitter: boolean) {
  changed.forEach(a => pendingAreas.add(a));
  if (areaT) return;
  areaT = setTimeout(() => { areaT = null; const ch = [...pendingAreas]; pendingAreas.clear();
    areaSubs.forEach(s => { const hit = ch.filter(a => s.areas.includes(a)); if (hit.length) { try { s.fn(hit); } catch { /* */ } } }); }, jitter ? Math.round(Math.random() * REFRESH_JITTER_MS) : 0);
}
const bc: BroadcastChannel | null = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('eqcamp-hub') : null;
if (bc) bc.onmessage = (m: MessageEvent) => { if (m.data?.t === 'changed') kick(); };
// ผู้นำการถาม (ข้ามแท็บในเบราว์เซอร์เดียวกัน)
const TAB_ID = Math.random().toString(36).slice(2);
const LEAD = 'eqcamp.hub.lead', LAST = 'eqcamp.hub.last';
const readJ = (k: string) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
function shareRev(rev: string, areas?: Record<string, string>) { try { localStorage.setItem(LAST, JSON.stringify({ rev, areas: areas || null, at: Date.now(), by: TAB_ID })); } catch { /* */ } }
let lastActive = Date.now();
export const IDLE_AFTER_MS = 180000, POLL_MS = 5000, IDLE_POLL_MS = 20000;
const pollGap = () => { const base = Date.now() - lastActive > IDLE_AFTER_MS ? IDLE_POLL_MS : POLL_MS; return Math.round(base * (0.85 + Math.random() * 0.3)); };
let timer: any = null, started = false, fails = 0;
async function tick() {
  timer = null;
  if (!hubReady()) { state = { ...state, status: 'off' }; emitState(); return; }
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;   // หยุดเมื่อซ่อน — visibilitychange ปลุกใหม่
  const lead = readJ(LEAD), now = Date.now();
  if (lead && lead.id !== TAB_ID && now - lead.at < POLL_MS * 2.5) { schedule(pollGap()); return; }   // แท็บอื่นถามให้แล้ว
  try { localStorage.setItem(LEAD, JSON.stringify({ id: TAB_ID, at: now })); } catch { /* */ }
  try { const j: any = await hubCall('rev', {}, 15000); fails = 0; if (j?.rev) shareRev(j.rev, j.areas); if (queue().length) flush(); }
  catch (e: any) {
    fails++;
    state = { ...state, status: e?.code === 'offline' ? 'offline' : e?.code === 'blocked' ? 'blocked' : 'error', code: e?.code, msg: e?.message };
    emitState();
    if (e?.code === 'key' || e?.code === 'blocked') return;                                 // ไม่วนถามซ้ำเมื่อผิดถาวร
  }
  schedule(fails ? Math.min(30000, POLL_MS * (1 + fails)) * (0.8 + Math.random() * 0.4) : pollGap());
}
const schedule = (ms: number) => { if (timer) clearTimeout(timer); timer = setTimeout(tick, ms); };
export function kick() { if (!hubReady()) return; schedule(30 + Math.round(Math.random() * 120)); }
function start() {
  if (started || typeof window === 'undefined') return; started = true;
  const wake = () => { const was = Date.now() - lastActive > IDLE_AFTER_MS; lastActive = Date.now(); if (was) kick(); };
  ['pointerdown', 'keydown', 'touchstart', 'wheel'].forEach(ev => window.addEventListener(ev, wake, { passive: true }));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { lastActive = Date.now(); kick(); } });
  window.addEventListener('focus', () => { lastActive = Date.now(); kick(); }); window.addEventListener('online', () => { kick(); flush(); });
  window.addEventListener('pageshow', kick);
  // ปิด/รีโหลดแท็บผู้นำ → ปล่อยตำแหน่งทันที (แท็บอื่น/หน้าที่โหลดใหม่ถามเองได้เลย ไม่ต้องรอ)
  window.addEventListener('pagehide', () => { try { const l = readJ(LEAD); if (l && l.id === TAB_ID) localStorage.removeItem(LEAD); } catch { /* */ } });
  window.addEventListener('storage', (e: StorageEvent) => { if (e.key !== LAST || !e.newValue) return; try { const v = JSON.parse(e.newValue); if (v && v.by !== TAB_ID && v.rev) noteOk(v.rev, v.areas || undefined, 'rev'); } catch { /* */ } });
  kick();
}
export const notifyLocalChange = () => { bc?.postMessage({ t: 'changed' }); };

// ── โค้ดฝั่งเซิร์ฟเวอร์ (Apps Script ผูกกับชีต NSR) ──
// sheetId ว่าง = สคริปต์ผูกกับชีต (วางใน ส่วนขยาย → Apps Script) · มี sheetId = สคริปต์เดี่ยวในไดรฟ์ (สร้างไฟล์ให้ได้เลย)
export const hubAppsScript = (key: string, sheetId = '') => `// EQ Camp — ศูนย์กลางทีม (Web app: Deploy → New deployment → Web app)
// Execute as: Me · Who has access: Anyone — ทุกคำสั่งต้องมีรหัสทีมด้านล่าง
// เก็บ: NSR = ชีตนี้ · ทะเบียน/งานของทีม = สเปรดชีต "EQ Camp — ข้อมูลกลางทีม" ที่สคริปต์สร้างให้ในไดรฟ์ของคุณ (ไม่แชร์สาธารณะ)
// ไม่ลบแท็บ ไม่แทรก/ลบแถวในแท็บ NSR ไม่ทับสูตรที่ไม่ได้แก้
const TEAM_KEY = '${key}';
const NSR_ID = '${sheetId}';   // ว่าง = ใช้ชีตที่สคริปต์ผูกอยู่
const VERSION = 8;
function nsr_() { return NSR_ID ? SpreadsheetApp.openById(NSR_ID) : SpreadsheetApp.getActiveSpreadsheet(); }
// สคริปต์เดี่ยว: ติดตั้งตัวจับ "มีคนแก้ชีต" ให้เองครั้งแรก (สคริปต์ผูกชีตใช้ onEdit ธรรมดา)
function ensureTrigger_() { if (!NSR_ID) return; var p = props_(); if (p.getProperty('trig') === NSR_ID) return;
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'onEdit') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('onEdit').forSpreadsheet(NSR_ID).onEdit().create(); p.setProperty('trig', NSR_ID); }
// อุ่นแคชภาพรวมทุกแท็บทุก 4 ชม. (แคชของ Apps Script หมดอายุ 6 ชม.) — ติดตั้งให้เองครั้งแรก
function ensureWarm_() { var p = props_(); if (p.getProperty('warm') === '1') return;
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'warmCache') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('warmCache').timeBased().everyHours(4).create(); p.setProperty('warm', '1'); }
function warmCache() { var cs = tab_('NsrCache', CACHE_COLS), n = cs.getLastRow(); if (n < 2) return; var v = cs.getRange(2, 1, n - 1, 4).getValues(), put = {};
  v.forEach(function (r) { if (r[3] && String(r[3]).length < 30000) put['d:' + r[0]] = String(r[3]); }); cachePut_(put); }
function cachePut_(obj) { var c = CacheService.getScriptCache(), ks = Object.keys(obj); for (var i = 0; i < ks.length; i += 100) { var part = {}; ks.slice(i, i + 100).forEach(function (k) { part[k] = obj[k]; }); try { c.putAll(part, 21600); } catch (x) {} } }
function cacheGet_(keys) { var c = CacheService.getScriptCache(), out = {}; for (var i = 0; i < keys.length; i += 100) { try { var g = c.getAll(keys.slice(i, i + 100)); for (var k in g) out[k] = g[k]; } catch (x) {} } return out; }
function doGet() { return out_({ ok: true, app: 'EQ Camp Hub', version: VERSION }); }
// เรียกครั้งแรกจากตัวแก้สคริปต์เพื่ออนุญาตสิทธิ์ล่วงหน้า (ไม่บังคับ)
function setup() { nsr_().getName(); hub_(); ensureTrigger_(); return 'ok'; }
function doPost(e) {
  var req; try { req = JSON.parse(e.postData.contents); } catch (x) { return out_({ ok: false, error: 'bad' }); }
  if (!req || req.key !== TEAM_KEY) return out_({ ok: false, error: 'key' });
  // rev = ทุกเครื่องถามทุก 5–20 วิ → ทางด่วน: อ่านค่าเลขรุ่นอย่างเดียว ไม่เปิดชีต (รองรับคนใช้พร้อมกันมาก)
  if (req.op === 'rev') { try { return out_({ ok: true, version: VERSION, rev: rev_(), areas: areas_() }); } catch (x) { return out_({ ok: false, error: 'busy' }); } }
  try {
    var r = route_(req) || { ok: false, error: 'op' };
    if (r.ok !== false) { r.rev = rev_(); r.areas = areas_(); }
    return out_(r);
  } catch (err) {
    var m = String(err);   // ล็อกรอนาน/โควตาชั่วคราว → busy (เครื่องลองใหม่เอง ไม่เสียข้อมูล)
    return out_({ ok: false, error: /lock|timeout|too many|simultaneous|invoked|rate|quota|Service|busy/i.test(m) ? 'busy' : 'server', message: m });
  }
}
function route_(q) {
  switch (q.op) {   // อ่านข้อมูลกลางทีม: ไม่ต้องเปิดชีต NSR · ไม่ต้องรอคิวล็อก
    case 'events': return events_(q.from);
    case 'jobs': return { ok: true, jobs: jobs_().map(function (j) { delete j.snap; return j; }).filter(function (j) { return !q.since || j.savedAt > q.since; }) };
    case 'job.get': { var jj = jobs_(true).filter(function (j) { return j.id === q.id; })[0]; return jj ? { ok: true, job: jj } : { ok: false, error: 'missing' }; }
    case 'status.list': return { ok: true, status: statuses_() };
    // บอร์ดทีม: ทะเบียน + งาน + สถานะการขาย ในคำสั่งเดียว
    case 'board': { var b = events_(q.from); b.jobs = jobs_().map(function (j) { delete j.snap; return j; }); b.status = statuses_(); return b; }
  }
  var ss = nsr_();
  try { ensureTrigger_(); } catch (x) {}
  try { ensureWarm_(); } catch (x) {}
  switch (q.op) {
    case 'rev': return { ok: true, version: VERSION };
    case 'nsr.list': return { ok: true, url: ss.getUrl(), tabs: ss.getSheets().map(function (s) { return { title: s.getName(), sheetId: s.getSheetId(), index: s.getIndex() - 1 }; }) };
    case 'nsr.read': return { ok: true, tabs: (q.tabs || []).slice(0, 80).map(function (t) {
        var sh = ss.getSheetByName(t); if (!sh) return { title: t, missing: true };
        var n = Math.min(Math.max(sh.getLastRow(), 1), 60), rg = sh.getRange(1, 1, n, 15);
        return { title: t, sheetId: sh.getSheetId(), index: sh.getIndex() - 1, values: rg.getDisplayValues(), formulas: rg.getFormulas() }; }) };
    case 'nsr.changes': return { ok: true, since: Number(q.since) || 0, ids: changed_(Number(q.since) || 0) };
    case 'nsr.all': return all_(ss, q);
  }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(28000)) return { ok: false, error: 'busy' };   // คิวยาวเกิน → ให้เครื่องลองใหม่ (ไม่ค้าง ไม่ทิ้งข้อมูล)
  try {
    switch (q.op) {
      case 'nsr.create': {
        if (ss.getSheetByName(q.title)) return { ok: false, error: 'exists' };
        var rows = q.rows || [], w = 1; rows.forEach(function (r) { w = Math.max(w, r.length); });
        var vals = rows.map(function (r) { var a = r.slice(); while (a.length < w) a.push(''); return a; });
        var sh = ss.insertSheet(String(q.title).slice(0, 99), Math.min(Number(q.index) || ss.getSheets().length, ss.getSheets().length));
        sh.getRange(1, 1, vals.length, w).setValues(vals);
        var f = q.fmt || {};
        (f.boldRows || []).forEach(function (r) { sh.getRange(r, 1, 1, 13).setFontWeight('bold'); });
        (f.moneyCols || []).forEach(function (c) { sh.getRange(5, c, Math.max(vals.length - 4, 1), 1).setNumberFormat('#,##0.##'); });
        if (f.staffCols) sh.getRange(3, 9, Math.max(f.staffCols[1] - 2, 1), 5).setNumberFormat('#,##0');
        (f.pctCells || []).forEach(function (p) { sh.getRange(p[0], p[1]).setNumberFormat('0.00%'); });
        sh.setColumnWidth(2, 320); sh.setColumnWidth(8, 200);
        touch_(sh.getSheetId()); bump_('nsr');
        return { ok: true, sheetId: sh.getSheetId(), title: sh.getName() };
      }
      case 'nsr.edit': {
        var s2 = ss.getSheetByName(q.title); if (!s2) return { ok: false, error: 'missing' };
        var conflicts = [];
        (q.edits || []).forEach(function (x) { var cur = s2.getRange(x.r, x.c).getDisplayValue(); if (!same_(cur, x.was)) conflicts.push({ r: x.r, c: x.c, now: cur }); });
        if (conflicts.length && !q.force) return { ok: false, error: 'conflict', conflicts: conflicts };
        (q.edits || []).forEach(function (x) { s2.getRange(x.r, x.c).setValue(x.v); });
        touch_(s2.getSheetId()); bump_('nsr');
        return { ok: true };
      }
      case 'log': { var ev = q.ev || {}; if (!ev.eid) return { ok: false, error: 'bad' };
        var lg = tab_('Log', LOG_COLS); if (seen_(lg, ev.eid)) return { ok: true, dup: true };
        lg.appendRow(LOG_COLS.map(function (c) { return ev[c] === undefined ? '' : String(ev[c]).slice(0, 300); })); bump_('log'); return { ok: true }; }
      case 'log.many': { var lg2 = tab_('Log', LOG_COLS), have = {}, n2 = lg2.getLastRow(); if (n2 > 1) lg2.getRange(2, 2, n2 - 1, 1).getValues().forEach(function (r) { have[r[0]] = 1; });
        var add = (q.events || []).slice(0, 500).filter(function (ev) { return ev && ev.eid && !have[ev.eid]; }).map(function (ev) { return LOG_COLS.map(function (c) { return ev[c] === undefined ? '' : String(ev[c]).slice(0, 300); }); });
        if (add.length) { lg2.getRange(lg2.getLastRow() + 1, 1, add.length, LOG_COLS.length).setValues(add); bump_('log'); } return { ok: true, added: add.length }; }
      case 'job.put': return putJob_(q.job || {}, q.base, q.dev, q.by);
      case 'job.del': return delJob_(q.id);
      case 'nsr.migrateOT': return migrateOT_(ss);
      case 'status.set': { var st = q.st || {}; if (st.sheetId === undefined || st.sheetId === null || st.sheetId === '' || !st.status) return { ok: false, error: 'bad' };
        var ssh = tab_('Status', ST_COLS), sn = ssh.getLastRow(), sids = sn > 1 ? ssh.getRange(2, 1, sn - 1, 1).getValues().map(function (r) { return String(r[0]); }) : [];
        st.at = new Date().toISOString(); st.by = q.by || ''; st.dev = q.dev || '';
        var srow = ST_COLS.map(function (c) { return st[c] === undefined || st[c] === null ? '' : String(st[c]).slice(0, 500); });
        var si = sids.indexOf(String(st.sheetId)); if (si >= 0) ssh.getRange(si + 2, 1, 1, srow.length).setValues([srow]); else ssh.appendRow(srow);
        tab_('StatusLog', ST_COLS).appendRow(srow); bump_('st'); return { ok: true, at: st.at }; }
    }
  } finally { lock.releaseLock(); }
}
// ── rev: เลขรุ่น = เวลาที่เขียนผ่านเว็บล่าสุด + เวลาที่มีคนแก้ชีตเองล่าสุด (onEdit) ──
function props_() { return PropertiesService.getScriptProperties(); }
function rev_() { var p = props_(); return (p.getProperty('rev') || '0') + '.' + (p.getProperty('edit') || '0'); }
// แยกเลขรุ่นตามส่วน (nsr/log/job/st) → เครื่องอื่นโหลดใหม่เฉพาะส่วนที่เปลี่ยน ไม่ใช่ทุกอย่างพร้อมกัน
function bump_(area) { var now = String(Date.now()), p = props_(); p.setProperty('rev', now); if (area) p.setProperty('r.' + area, now); }
function areas_() { var p = props_(), e = Number(p.getProperty('edit') || 0), n = Number(p.getProperty('r.nsr') || 0);
  return { nsr: String(Math.max(e, n)), log: p.getProperty('r.log') || '0', job: p.getProperty('r.job') || '0', st: p.getProperty('r.st') || '0' }; }
// ทะเบียน: เพิ่มต่อท้ายอย่างเดียว → ขอเฉพาะแถวใหม่ (from = จำนวนที่เครื่องมีแล้ว)
function events_(from) { var sh = tab_('Log', LOG_COLS), n = Math.max(sh.getLastRow() - 1, 0), f = Math.max(0, Math.min(Number(from) || 0, n)), hd = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), LOG_COLS.length)).getValues()[0];
  var lv = n - f > 0 ? sh.getRange(f + 2, 1, n - f, hd.length).getValues() : [];
  return { ok: true, n: n, from: f, events: lv.map(function (r) { var o = {}; hd.forEach(function (h, i) { o[h] = r[i] instanceof Date ? r[i].toISOString() : r[i]; }); return o; }) }; }
function touch_(sheetId) { props_().setProperty('t:' + sheetId, String(Date.now())); }
function changed_(since) { var all = props_().getProperties(), out = []; for (var k in all) if (k.indexOf('t:') === 0 && Number(all[k]) > since) out.push(Number(k.slice(2))); return out; }
// คนแก้ในชีตเอง → ทุกเครื่องรู้ (simple trigger ทำงานเองไม่ต้องตั้งค่า)
function onEdit(e) { try { var now = String(Date.now()); var p = PropertiesService.getScriptProperties(); p.setProperty('edit', now); if (e && e.range) p.setProperty('t:' + e.range.getSheet().getSheetId(), now); } catch (x) {} }
// ── สเปรดชีตข้อมูลกลางทีม (สร้างครั้งแรกอัตโนมัติ) ──
var LOG_COLS = ['ts','eid','programId','jobId','action','docKind','docCode','school','courseCode','course','dayThemes','addons','partyTheme','durationMode','days','nights','dates','venue','province','region','students','teachers','normalPrice','specialPrice','source','by','byName'];
var JOB_COLS = ['id','savedAt','name','course','school','dates','duration','docCode','files','lastFileAt','by','dev','deleted','size'];
function hub_() {
  var p = props_(), id = p.getProperty('HUB_ID'), ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (x) { ss = null; } }
  if (!ss) { ss = SpreadsheetApp.create('EQ Camp — ข้อมูลกลางทีม (ห้ามแชร์สาธารณะ)'); p.setProperty('HUB_ID', ss.getId()); }
  return ss;
}
function tab_(name, cols) { var ss = hub_(), sh = ss.getSheetByName(name); if (!sh) { sh = ss.insertSheet(name); sh.appendRow(cols); sh.setFrozenRows(1); var d = ss.getSheetByName('Sheet1') || ss.getSheetByName('ชีต1') || ss.getSheetByName('แผ่น1'); if (d && ss.getSheets().length > 1) ss.deleteSheet(d); } return sh; }
function seen_(sh, eid) { var n = sh.getLastRow(); if (n < 2) return false; var v = sh.getRange(Math.max(2, n - 300), 2, Math.min(300, n - 1), 1).getValues(); for (var i = 0; i < v.length; i++) if (v[i][0] === eid) return true; return false; }
// งาน: ข้อมูลงาน (JSON) แบ่งเก็บหลายช่อง ช่องละไม่เกิน 45,000 ตัวอักษร (เพดานชีต 50,000)
function jobs_(withSnap) {
  var sh = tab_('Jobs', JOB_COLS), last = sh.getLastRow();   // รายการงานอ่านเฉพาะคอลัมน์ข้อมูลงาน (ไม่ดึงเนื้องานก้อนใหญ่) → เร็วแม้หลายคนเปิดพร้อมกัน
  if (last < 2) return [];
  var v = withSnap ? sh.getDataRange().getValues() : sh.getRange(1, 1, last, JOB_COLS.length).getValues(); v.shift();
  return v.filter(function (r) { return r[0]; }).map(function (r) { var o = {}; JOB_COLS.forEach(function (c, i) { o[c] = r[i] instanceof Date ? r[i].toISOString() : r[i]; });
    o.files = Number(o.files) || 0; o.deleted = o.deleted === true || o.deleted === 'TRUE';
    if (withSnap) { var s = r.slice(JOB_COLS.length).join(''); try { o.snap = s ? JSON.parse(s) : null; } catch (x) { o.snap = null; } }
    return o; });
}
function putJob_(j, base, dev, by) {
  if (!j.id || !j.snap) return { ok: false, error: 'bad' };
  var sh = tab_('Jobs', JOB_COLS), ids = sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), 1).getValues().map(function (r) { return r[0]; });
  var at = ids.indexOf(j.id) + 1, now = new Date().toISOString();
  if (at > 1 && base) { var cur = sh.getRange(at, 2).getValue(); cur = cur instanceof Date ? cur.toISOString() : String(cur); var cdev = sh.getRange(at, 12).getValue();
    if (cur > base && cdev !== dev) return { ok: false, error: 'conflict', savedAt: cur, by: sh.getRange(at, 11).getValue() }; }
  var s = JSON.stringify(j.snap), parts = []; for (var i = 0; i < s.length; i += 45000) parts.push(s.slice(i, i + 45000));
  var row = [j.id, now, j.name || '', j.course || '', j.school || '', j.dates || '', j.duration || '', j.docCode || '', Number(j.files) || 0, j.lastFileAt || '', by || '', dev || '', false, s.length].concat(parts);
  if (at > 1) { sh.getRange(at, 1, 1, Math.max(sh.getLastColumn(), row.length)).clearContent(); sh.getRange(at, 1, 1, row.length).setValues([row]); }
  else sh.appendRow(row);
  bump_('job'); return { ok: true, savedAt: now };
}
function delJob_(id) { var sh = tab_('Jobs', JOB_COLS), ids = sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), 1).getValues().map(function (r) { return r[0]; }), at = ids.indexOf(id) + 1;
  if (at > 1) { sh.getRange(at, 13).setValue(true); sh.getRange(at, 2).setValue(new Date().toISOString()); bump_('job'); } return { ok: true }; }
function num_(s) { var t = String(s == null ? '' : s).replace(/[฿,\\s]/g, ''); return /^-?\\d+(\\.\\d+)?%?$/.test(t) ? parseFloat(t) / (t.slice(-1) === '%' ? 100 : 1) : null; }
function same_(a, b) { var x = num_(a), y = num_(b); if (x !== null && y !== null) return Math.abs(x - y) < 0.5; return String(a || '').replace(/\\s/g, '') === String(b || '').replace(/\\s/g, ''); }
// ── สถานะการขายต่อแท็บ NSR (เก็บในสเปรดชีตข้อมูลกลาง: Status = ล่าสุด · StatusLog = ประวัติทุกครั้ง) ──
var ST_COLS = ['sheetId','title','name','status','reason','note','finalPrice','finalPax','followUp','pct','price','participants','by','dev','at'];
function statuses_() { var sh = tab_('Status', ST_COLS), v = sh.getDataRange().getValues(); v.shift();
  return v.filter(function (r) { return r[0] !== ''; }).map(function (r) { var o = {}; ST_COLS.forEach(function (c, i) { o[c] = r[i] instanceof Date ? r[i].toISOString() : r[i]; }); return o; }); }
// ── ภาพรวมทุกแท็บในคำสั่งเดียว: เก็บสำเนาแต่ละแท็บไว้ในแท็บ NsrCache ของสเปรดชีตข้อมูลกลาง · อ่านแท็บจริงใหม่เฉพาะที่มีคนแก้/เปลี่ยนชื่อ/ใหม่ ──
var CACHE_COLS = ['sheetId','title','ts','json'];
function trimRows_(m) { return m.map(function (r) { var a = r.slice(); while (a.length && (a[a.length - 1] === '' || a[a.length - 1] === null)) a.pop(); return a; }); }
function snap_(sh) { var n = Math.min(Math.max(sh.getLastRow(), 1), 60), rg = sh.getRange(1, 1, n, 15), v = trimRows_(rg.getDisplayValues()), f = trimRows_(rg.getFormulas());
  while (v.length && !v[v.length - 1].length && !(f[v.length - 1] || []).length) { v.pop(); f.pop(); } return JSON.stringify({ v: v, f: f }); }
function all_(ss, q) {
  var t0 = Date.now(), since = Number(q.since) || 0, props = props_().getProperties(), sheets = ss.getSheets();
  var cs = tab_('NsrCache', CACHE_COLS), n = cs.getLastRow(), meta = n > 1 ? cs.getRange(2, 1, n - 1, 3).getValues() : [];
  var tm = { open: Date.now() - t0 };
  var hit = since ? {} : cacheGet_(meta.map(function (m) { return 'd:' + m[0]; }));                // ข้อมูลแต่ละแท็บจากแคช (เร็ว) — ไม่มีในแคชค่อยอ่านจากแท็บ NsrCache
  var live = {}; sheets.forEach(function (sh) { live[String(sh.getSheetId())] = 1; });   // แท็บที่ลบไปแล้ว/ใหญ่เกินแคช ไม่นับว่าแคชหาย
  var missN = since ? 0 : meta.filter(function (m) { return live[String(m[0])] && Number(m[2]) > 1 && !hit['d:' + m[0]]; }).length;
  var json = since ? null : (missN ? (n > 1 ? cs.getRange(2, 4, n - 1, 1).getValues() : []) : meta.map(function (m) { return [hit['d:' + m[0]]]; }));
  if (missN && json) { var refill = {}; meta.forEach(function (m, k) { var v = json[k] && json[k][0]; if (v && !hit['d:' + m[0]] && String(v).length < 30000) refill['d:' + m[0]] = String(v); }); cachePut_(refill); }
  tm.data = Date.now() - t0; tm.miss = missN;
  var at = {}; meta.forEach(function (r, i) { at[String(r[0])] = i; });
  var lock = LockService.getScriptLock(), locked = lock.tryLock(2000), left = 0, built = 0, refresh = 0, out = [], writes = [];
  try {
    sheets.forEach(function (sh) {
      var id = String(sh.getSheetId()), i = at[id], r = i === undefined ? null : meta[i], edited = Number(props['t:' + id]) || 0;
      var need = !r || String(r[1]) !== sh.getName() || edited > Number(r[2]) || Number(r[2]) <= 1;   // ts 1 = แท็บใหญ่เกินช่อง (อ่านสดทุกครั้ง)
      var old = !need && r && t0 - Number(r[2]) > 86400000 && refresh < 15;   // กันพลาด: แท็บที่ไม่ได้อ่านใหม่เกิน 1 วัน ทยอยอ่านใหม่
      var rec = { title: sh.getName(), sheetId: Number(id), index: sh.getIndex() - 1 };
      if ((need || old) && locked && Date.now() - t0 < 20000) {
        var ts = Date.now(), d = snap_(sh), fit = d.length < 30000; if (old) refresh++; built++;
        var mrow = [Number(id), "'" + rec.title, fit ? ts : 1], cd = fit ? d : '';   // ' = เก็บชื่อแท็บเป็นข้อความ (กันชีตแปลง 12/2025 เป็นวันที่)
        if (r) { meta[i] = mrow; writes.push([i, cd]); } else { at[id] = meta.length; meta.push(mrow); writes.push([meta.length - 1, cd]); }
        rec.ts = ts; rec.d = d;
      } else if (need) { left++; rec.pending = true; if (r) { rec.ts = Number(r[2]); rec.stale = true; } }
      else { rec.ts = Number(r[2]); }
      if (!rec.d && rec.ts > since && json && r) rec.d = String((json[i] || [''])[0] || '');
      if (!rec.d && rec.ts > since && !json && r) rec.want = i;
      out.push(rec);
    });
    if (writes.length) {
      if (writes.length > 25) { var all = meta.map(function (m, k) { return [m[0], m[1], m[2], '']; });
        var cur = json || (n > 1 ? cs.getRange(2, 4, n - 1, 1).getValues() : []); all.forEach(function (row, k) { row[3] = cur[k] ? cur[k][0] : ''; });
        writes.forEach(function (w) { all[w[0]][3] = w[1]; }); cs.getRange(2, 1, all.length, 4).setValues(all); }
      else writes.forEach(function (w) { cs.getRange(w[0] + 2, 1, 1, 4).setValues([[meta[w[0]][0], meta[w[0]][1], meta[w[0]][2], w[1]]]); });
      var put = {}; writes.forEach(function (w) { if (w[1] && w[1].length < 30000) put['d:' + meta[w[0]][0]] = w[1]; }); cachePut_(put);
    }
  } finally { if (locked) lock.releaseLock(); }
  var wants = out.filter(function (rec) { return rec.want !== undefined; }), wh = cacheGet_(wants.map(function (rec) { return 'd:' + rec.sheetId; }));
  wants.forEach(function (rec) { rec.d = wh['d:' + rec.sheetId] || String(cs.getRange(rec.want + 2, 4).getValue() || ''); delete rec.want; });
  tm.total = Date.now() - t0;
  return { ok: true, at: t0, tabs: out, left: left, built: built, url: ss.getUrl(), status: statuses_(), tm: tm };
}
// ── เติมช่องค่าล่วงเวลาให้แท็บเดิม (ครั้งเดียว): N = คืนล่วงเวลา (0) · O = ค่าตอบแทน/วัน × 25% × คน × คืน · M เดิม + O
// ตัวเลขเดิมไม่เปลี่ยน (คืน = 0) · ข้ามแท็บที่มีช่องแล้ว/ไม่ใช่ตาราง NSR/คอลัมน์ N:O ไม่ว่าง · ทำทีละ ≤20 วิ เหลือ = left
function migrateOT_(ss) {
  var t0 = Date.now(), done = [], skip = 0, left = 0, bad = [], P = props_(), seen = P.getProperties();   // ot:<sheetId> = ตรวจแล้ว (ไม่อ่านซ้ำ)
  ss.getSheets().forEach(function (sh) {
    var oid = 'ot:' + sh.getSheetId();
    if (seen[oid]) { skip++; return; }
    if (Date.now() - t0 > 20000) { left++; return; }
    var mark = function (x) { P.setProperty(oid, x); };
    var n = Math.min(Math.max(sh.getLastRow(), 1), 60), rg = sh.getRange(1, 8, n, 8), v = rg.getDisplayValues(), f = rg.getFormulas(), hr = -1, tr = -1;
    for (var i = 0; i < v.length; i++) { var h = String(v[i][0]).trim(); if (hr < 0 && h === 'ประเภท') hr = i; else if (hr >= 0 && h.indexOf('รวม') === 0) { tr = i; break; } }
    if (hr < 0 || tr < 0) { bad.push(sh.getName() + ' (ไม่ใช่ตาราง NSR)'); mark('x'); return; }
    if (String(v[hr][6]).indexOf('ล่วงเวลา') >= 0) { skip++; mark('1'); return; }
    for (var r = hr; r <= tr; r++) if (v[r][6] !== '' || v[r][7] !== '' || f[r][6] || f[r][7]) { bad.push(sh.getName() + ' (คอลัมน์ N:O มีข้อมูลอยู่แล้ว)'); mark('x'); return; }
    var no = [], ms = [], ok = true;   // no = N:O ทุกแถว · ms = [แถว, สูตร M ใหม่] เฉพาะแถวที่มีประเภททีม (แถวว่างไม่แตะ M)
    for (var r2 = hr + 1; r2 < tr; r2++) {
      var R = r2 + 1, role = String(v[r2][0]).trim(), mf = f[r2][5], mv = String(v[r2][5]).replace(/[฿,\\s]/g, '');
      if (!role) { no.push(['', '']); continue; }
      var m = mf ? '=(' + mf.slice(1) + ')+O' + R : (mv === '' ? '=O' + R : (/^-?\\d+(\\.\\d+)?$/.test(mv) ? '=' + mv + '+O' + R : null));
      if (m === null) { ok = false; break; }
      no.push([0, '=I' + R + '*25%*J' + R + '*N' + R]); ms.push([R, m]);
    }
    if (!ok) { bad.push(sh.getName() + ' (ช่องค่าตอบแทนเป็นข้อความ)'); mark('x'); return; }
    sh.getRange(hr + 1, 14, 1, 2).setValues([['คืนล่วงเวลา', 'ค่าล่วงเวลา (25%/คืน)']]);
    if (no.length) sh.getRange(hr + 2, 14, no.length, 2).setValues(no);
    ms.forEach(function (x) { sh.getRange(x[0], 13).setValue(x[1]); });
    sh.getRange(tr + 1, 15).setValue('=SUM(O' + (hr + 2) + ':O' + tr + ')');
    try { sh.getRange(hr + 1, 13, tr - hr + 1, 1).copyTo(sh.getRange(hr + 1, 14, tr - hr + 1, 2), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false); } catch (x) {}
    touch_(sh.getSheetId()); mark('1'); done.push(sh.getName());
  });
  if (done.length) bump_('nsr');
  var badAll = []; for (var k in seen) if (k.indexOf('ot:') === 0 && seen[k] === 'x') badAll.push(Number(k.slice(3)));
  return { ok: true, done: done.length, skip: skip, left: left, bad: bad, badIds: badAll };
}
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
`;
export const newHubKey = () => 'eq-' + Array.from(crypto.getRandomValues(new Uint8Array(12))).map(b => b.toString(36).padStart(2, '0')).join('').slice(0, 18);
