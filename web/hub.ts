// ศูนย์กลางทีม (Team Hub) — เชื่อมทุกส่วนเข้าหาข้อมูลชุดเดียวกันแบบเรียลไทม์ ทุกเครื่อง/ทุกแอป
// ฝั่งเซิร์ฟเวอร์ = Apps Script ตัวเดียวบนชีต NSR (ทีมติดตั้งครั้งเดียว) ให้บริการ:
//   · NSR: รายชื่อแท็บ / อ่าน / สร้างแท็บ / แก้ช่อง / แท็บที่เปลี่ยน
//   · ทะเบียนโปรแกรม: บันทึก/อ่านเหตุการณ์สร้างไฟล์
//   · งานของทีม: เก็บ/เปิด/ลบงาน (บรีฟ+ค่าทั้งหมดของงาน) — เปิดต่อจากเครื่องไหนก็ได้
//   · rev: เลขรุ่นข้อมูล — เปลี่ยนทุกครั้งที่มีคนแก้ (ผ่านเว็บ หรือแก้ในชีตเอง) → ทุกเครื่องรู้ภายใน ~5 วินาที
// ความปลอดภัย: ทุกคำสั่งต้องมี "รหัสทีม" · ไม่ฝังที่อยู่/รหัสใน bundle สาธารณะ · เข้าร่วมทีมด้วยลิงก์เชิญ (#/join/…)
// ออฟไลน์: คำสั่งเขียนเข้าคิวในเครื่อง แล้วส่งเองเมื่อกลับมาออนไลน์

export interface HubMe { id: string; nick: string; role: 'admin' | 'member'; email?: string; shared?: boolean; legacy?: boolean; claimable?: boolean }
export interface HubState { status: 'off' | 'connecting' | 'live' | 'offline' | 'error' | 'blocked'; code?: string; msg?: string; lastOk?: number; rev?: string; pending: number; me?: HubMe | null }
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
export function setHub(url: string, key: string) { ls.set(LS.url, url.trim()); ls.set(LS.key, key.trim()); try { localStorage.removeItem('eqcamp.hub.me'); } catch { /* */ } state = { ...state, status: hubReady() ? 'connecting' : 'off', msg: '', code: undefined, me: null }; emitState(); kick(); }
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
import { deviceLabel } from './platform';
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
    r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...body, op, key, dev: deviceId(), dl: deviceLabel(), by: userName() }), signal: ctl.signal, cache: 'no-store' });
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
    if (j.error === 'rate') throw new HubError('busy', 'ส่งคำสั่งถี่เกินไป — ระบบจะลองใหม่เอง');
    const msg: Record<string, string> = { key: 'ลิงก์ในเครื่องนี้ใช้ไม่ได้แล้ว (ลิงก์ผิด หรือแอดมินปิดลิงก์รวม/ออกลิงก์ใหม่) — ขอลิงก์ส่วนตัวจากแอดมิน', revoked: 'แอดมินปิดสิทธิ์ของลิงก์นี้แล้ว — ติดต่อแอดมินทีม', forbidden: 'ทำได้เฉพาะแอดมินทีม', exists: 'มีแท็บชื่อนี้แล้ว', missing: 'ไม่พบรายการนี้แล้ว', op: 'ศูนย์กลางทีมเป็นรุ่นเก่า — คัดลอกโค้ดใหม่แล้ว Deploy อีกครั้ง', conflict: 'มีคนแก้ระหว่างนี้', busy: 'ศูนย์กลางทีมมีคนใช้พร้อมกันมาก — ลองใหม่อีกครั้ง' };
    throw new HubError(c, msg[c] || j.message || 'ศูนย์กลางทีมตอบกลับไม่สำเร็จ', j);
  }
  if (j.me && typeof j.me === 'object') noteMe(j.me);
  noteOk(j.rev, j.areas, op);
  return j as T;
}

// ── คิวคำสั่งเขียน (ออฟไลน์/เน็ตหลุด) — ส่งตามลำดับ · คีย์ซ้ำ = แทนของเก่า (เช่น บันทึกงานเดียวกันหลายครั้ง ส่งครั้งล่าสุดครั้งเดียว) ──
type QItem = { id: string; op: string; body: any; ck?: string; at: number; tries: number };
const queue = (): QItem[] => { try { const a = JSON.parse(ls.get(LS.q) || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } };
export const queueOf = (op: string) => queue().filter(x => x.op === op);
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
        if (e?.code === 'revoked' || e?.code === 'key') break;                                  // สิทธิ์ถูกปิด: เก็บคิวไว้ (ไม่ทิ้งงาน) จนกว่าจะได้ลิงก์ใหม่
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
export type Area = 'nsr' | 'log' | 'job' | 'st' | 'past';
export const AREAS: Area[] = ['nsr', 'log', 'job', 'st', 'past'];
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
function noteMe(me: HubMe) { const prev = JSON.stringify(state.me || null), nx = JSON.stringify(me); if (prev !== nx) { state = { ...state, me }; try { localStorage.setItem('eqcamp.hub.me', nx); } catch { /* */ } emitState(); } }
export const hubMe = (): HubMe | null => state.me || (() => { try { return JSON.parse(localStorage.getItem('eqcamp.hub.me') || 'null'); } catch { return null; } })();
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
    if (e?.code === 'key' || e?.code === 'blocked' || e?.code === 'revoked') return;                                 // ไม่วนถามซ้ำเมื่อผิดถาวร
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
// สมาชิกตั้งต้น (ใส่เฉพาะในไฟล์สคริปต์ส่วนตัวของเจ้าของ — ห้ามใส่อีเมลจริงใน repo/bundle สาธารณะ)
export interface HubSeed { id: string; nick: string; name?: string; email?: string; role?: 'admin' | 'member' }
// ตั้งค่าทีม (เก็บในศูนย์กลาง ไม่อยู่ในเว็บสาธารณะ) — บัญชี SME Move ของใบเสนอราคาสีฟ้า (มีภาษี) / สีส้ม (ไม่มีภาษี)
export interface TeamConfig { sme?: { blue?: { email?: string; label?: string }; orange?: { email?: string; label?: string }; url?: string } }
export const hubAppsScript = (key: string, sheetId = '', opt: { owner?: string; seed?: HubSeed[]; config?: TeamConfig; pastFolder?: string } = {}) => `// EQ Camp — ศูนย์กลางทีม (Web app: Deploy → New deployment → Web app)
// Execute as: Me · Who has access: Anyone — ทุกคำสั่งต้องมีรหัส (ลิงก์ส่วนตัวของแต่ละคน หรือลิงก์รวมเดิมจนกว่าแอดมินปิด)
// เก็บ: NSR = ชีตนี้ · ทะเบียน/งานของทีม = สเปรดชีต "EQ Camp — ข้อมูลกลางทีม" ที่สคริปต์สร้างให้ในไดรฟ์ของคุณ (ไม่แชร์สาธารณะ)
// ไม่ลบแท็บ ไม่แทรก/ลบแถวในแท็บ NSR ไม่ทับสูตรที่ไม่ได้แก้
const TEAM_KEY = '${key}';     // ลิงก์รวมเดิม — ใช้ได้จนกว่าแอดมินกด "ปิดลิงก์รวม"
const NSR_ID = '${sheetId}';   // ว่าง = ใช้ชีตที่สคริปต์ผูกอยู่
const OWNER_CODE = '${opt.owner || ''}';   // รหัสเจ้าของ: อยู่ในไฟล์นี้เท่านั้น ใช้รับสิทธิ์แอดมินครั้งแรก/กู้สิทธิ์
const MEMBERS_SEED = ${JSON.stringify(opt.seed || [])};
const CONFIG_SEED = ${JSON.stringify(opt.config || {})};   // ค่าตั้งต้นของทีม (แอดมินแก้ได้บนเว็บ)
const PAST_FOLDER = '${opt.pastFolder || ''}';   // โฟลเดอร์งานที่เคยส่งจริง (เช่น "2569") — อ่านอย่างเดียว ไม่แก้ไฟล์ต้นฉบับ
const VERSION = 13;
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
  if (!req || typeof req !== 'object') return out_({ ok: false, error: 'bad' });
  ST_MEMO = null; COLS_OK = {};   // ค่าในหน่วยความจำต่อคำสั่ง (เครื่องจำลอง/อินสแตนซ์ที่ถูกใช้ซ้ำ ต้องเริ่มใหม่)
  try {
    var S = st_(), who = auth_(req, S.mem);
    if (!who) { keyFail_(req); return out_({ ok: false, error: 'key' }); }
    if (who.revoked) { keyFail_(req, who); return out_({ ok: false, error: 'revoked' }); }
    // ตัวตนมาจากศูนย์กลางเท่านั้น (ไม่เชื่อชื่อที่เครื่องส่งมา) + เครื่องที่ใช้
    req.dev = String(req.dev || '').slice(0, 40); req.dl = String(req.dl || '').slice(0, 80);
    req.who = who; req.by = who.shared ? (String(req.by || '').slice(0, 40) ? String(req.by).slice(0, 40) + ' (ลิงก์รวม)' : 'ลิงก์รวม') : who.nick;
    seen_(who, req);
    // rev = ทุกเครื่องถามทุก 5–20 วิ → ทางด่วน: อ่านจากแคชอย่างเดียว ไม่เปิดชีต ไม่อ่าน Properties (โควตารายวัน)
    if (req.op === 'rev') return out_({ ok: true, version: VERSION, rev: S.revs.rev, areas: S.revs.areas, me: me_(who, S.mem) });
    if (!rate_(who, req)) return out_({ ok: false, error: 'rate' });
    if (ADMIN_OPS[req.op] && who.role !== 'admin') { audit_(req, 'ปฏิเสธ', req.op, 'ไม่ใช่แอดมิน'); return out_({ ok: false, error: 'forbidden' }); }
    var r = route_(req) || { ok: false, error: 'op' };
    if (r.ok !== false) { var R = st_().revs; r.rev = R.rev; r.areas = R.areas; r.me = me_(who, st_().mem); }
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
    // บอร์ดทีม: ทะเบียน + งาน + สถานะการขาย + สมาชิก ในคำสั่งเดียว
    case 'board': { var b = events_(q.from); b.jobs = jobs_().filter(function (j) { return !j.deleted; }).map(function (j) { delete j.snap; return j; }); b.status = statuses_(); b.team = team_(q.who); return b; }
    case 'me': return { ok: true };
    // คลังงานเก่า (อ่านอย่างเดียว): รายการโฟลเดอร์งาน + ไฟล์ · ข้อความของไฟล์ Word เฉพาะไฟล์ที่อยู่ในคลังเท่านั้น
    case 'past.list': return { ok: true, folders: pastRows_(), scannedAt: props_().getProperty('pastAt') || '', root: PAST_FOLDER ? 1 : 0 };
    case 'past.text': return pastText_(String(q.fileId || ''));
    case 'past.scan': { if (!pastLock_()) return { ok: false, error: 'busy' }; try { ensurePast_(); var rs = pastScan_(!!q.full); if (rs.ok) audit_(q, 'สแกนคลังงานเก่า', String(rs.n), 'เปลี่ยน ' + rs.changed + (rs.left ? ' (ยังไม่ครบ)' : '')); return rs; } finally { pastUnlock_(); } }
    case 'config.get': return { ok: true, config: cfg_() };
    case 'config.set': { var nc = q.config || {}, cur = cfg_(), sm = nc.sme || {}; var clean = function (x) { x = x || {}; return { email: String(x.email || '').trim().toLowerCase().slice(0, 80), label: String(x.label || '').slice(0, 60) }; };
      cur.sme = { blue: clean(sm.blue), orange: clean(sm.orange), url: String(sm.url || '').indexOf('https://') === 0 ? String(sm.url).slice(0, 200) : 'https://app.smemove.com/' };
      props_().setProperty('config', JSON.stringify(cur)); dropCache_(['cfg']); audit_(q, 'ตั้งค่าทีม', 'SME Move', JSON.stringify(cur.sme)); return { ok: true, config: cur }; }
    // ── แอดมิน ──
    case 'admin.claim': return claim_(q);
    case 'members.list': return { ok: true, members: team_(q.who, true), legacy: !!st_().mem.legacy };
    case 'members.save': return saveMember_(q);
    case 'members.key': return newKey_(q);
    case 'legacy.set': return setLegacy_(q);
    case 'audit': return audit_list_(q);
    case 'jobs.trash': return trash_();
    case 'job.versions': return versions_(q.id);
    case 'job.restore': return restore_(q);
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
        var bad = gridBad_(q); if (bad) { audit_(q, 'ปฏิเสธ', 'nsr.create', bad); return { ok: false, error: 'bad', message: bad }; }
        if (ss.getSheetByName(q.title)) return { ok: false, error: 'exists' };
        var rows = q.rows || [], w = 1; rows.forEach(function (r) { w = Math.max(w, r.length); });
        var vals = rows.map(function (r) { var a = r.map(function (v) { return cellIn_(v, false); }); while (a.length < w) a.push(''); return a; });
        var sh = ss.insertSheet(String(q.title).slice(0, 99), Math.min(Number(q.index) || ss.getSheets().length, ss.getSheets().length));
        sh.getRange(1, 1, vals.length, w).setValues(vals);
        var f = q.fmt || {};
        (f.boldRows || []).forEach(function (r) { sh.getRange(r, 1, 1, 13).setFontWeight('bold'); });
        (f.moneyCols || []).forEach(function (c) { sh.getRange(5, c, Math.max(vals.length - 4, 1), 1).setNumberFormat('#,##0.##'); });
        if (f.staffCols) sh.getRange(3, 9, Math.max(f.staffCols[1] - 2, 1), 5).setNumberFormat('#,##0');
        (f.pctCells || []).forEach(function (p) { sh.getRange(p[0], p[1]).setNumberFormat('0.00%'); });
        sh.setColumnWidth(2, 320); sh.setColumnWidth(8, 200);
        touch_(sh.getSheetId()); bump_('nsr'); audit_(q, 'สร้างแท็บ NSR', sh.getName(), vals.length + ' แถว');
        return { ok: true, sheetId: sh.getSheetId(), title: sh.getName() };
      }
      case 'nsr.edit': {
        var bad2 = editsBad_(q.edits); if (bad2) { audit_(q, 'ปฏิเสธ', 'nsr.edit ' + q.title, bad2); return { ok: false, error: 'bad', message: bad2 }; }
        var s2 = ss.getSheetByName(q.title); if (!s2) return { ok: false, error: 'missing' };
        var conflicts = [];
        (q.edits || []).forEach(function (x) { var cur = s2.getRange(x.r, x.c).getDisplayValue(); if (!same_(cur, x.was) && !same_(cur, x.v)) conflicts.push({ r: x.r, c: x.c, now: cur }); });   // ช่องเป็นค่าใหม่อยู่แล้ว (เช่น ส่งซ้ำหลังหมดเวลา) = สำเร็จ ไม่ใช่ชนกัน
        if (conflicts.length && !q.force) return { ok: false, error: 'conflict', conflicts: conflicts };
        var was = (q.edits || []).map(function (x) { return [x.r, x.c, s2.getRange(x.r, x.c).getDisplayValue(), x.v]; });
        (q.edits || []).forEach(function (x) { s2.getRange(x.r, x.c).setValue(cellIn_(x.v, true)); });
        touch_(s2.getSheetId()); bump_('nsr');
        audit_(q, 'แก้ NSR', s2.getName(), JSON.stringify(was.map(function (w) { return String.fromCharCode(64 + w[1]) + w[0] + ': ' + w[2] + ' → ' + w[3]; })).slice(0, 4000));   // ค่าเดิม→ค่าใหม่ (แอดมินย้อนได้)
        return { ok: true };
      }
      case 'log': { var ev = stampEv_(q.ev || {}, q, true); if (!ev.eid) return { ok: false, error: 'bad' };
        var lg = tab_('Log', LOG_COLS); if (seenEid_(lg, ev.eid)) return { ok: true, dup: true };
        lg.appendRow(LOG_COLS.map(function (c) { return ev[c] === undefined ? '' : String(ev[c]).slice(0, 300); })); bump_('log'); return { ok: true }; }
      case 'log.many': { var lg2 = tab_('Log', LOG_COLS), have = {}, n2 = lg2.getLastRow(); if (n2 > 1) lg2.getRange(2, 2, n2 - 1, 1).getValues().forEach(function (r) { have[r[0]] = 1; });
        var add = (q.events || []).slice(0, 500).filter(function (ev) { return ev && ev.eid && !have[ev.eid]; }).map(function (ev) { ev = stampEv_(ev, q, false); return LOG_COLS.map(function (c) { return ev[c] === undefined ? '' : String(ev[c]).slice(0, 300); }); });
        if (add.length) { lg2.getRange(lg2.getLastRow() + 1, 1, add.length, LOG_COLS.length).setValues(add); bump_('log'); } return { ok: true, added: add.length }; }
      case 'job.put': return putJob_(q.job || {}, q.base, q.dev, q.by, q);
      case 'job.del': return delJob_(q.id, q);
      case 'nsr.migrateOT': audit_(q, 'เติมช่องค่าล่วงเวลา', 'NSR', ''); return migrateOT_(ss);
      case 'status.set': { var st = q.st || {}; if (st.sheetId === undefined || st.sheetId === null || st.sheetId === '' || !st.status) return { ok: false, error: 'bad' };
        var ssh = tab_('Status', ST_COLS), sn = ssh.getLastRow(), sids = sn > 1 ? ssh.getRange(2, 1, sn - 1, 1).getValues().map(function (r) { return String(r[0]); }) : [];
        st.at = new Date().toISOString(); st.by = q.by || ''; st.dev = q.dev || '';
        audit_(q, 'สถานะการขาย', String(st.title || st.sheetId), String(st.status) + (st.reason ? ' · ' + st.reason : ''));
        var srow = ST_COLS.map(function (c) { return st[c] === undefined || st[c] === null ? '' : String(st[c]).slice(0, 500); });
        var si = sids.indexOf(String(st.sheetId)); if (si >= 0) ssh.getRange(si + 2, 1, 1, srow.length).setValues([srow]); else ssh.appendRow(srow);
        tab_('StatusLog', ST_COLS).appendRow(srow); bump_('st'); return { ok: true, at: st.at }; }
    }
  } finally { lock.releaseLock(); }
}
// ── rev: เลขรุ่น = เวลาที่เขียนผ่านเว็บล่าสุด + เวลาที่มีคนแก้ชีตเองล่าสุด (onEdit) ──
function props_() { return PropertiesService.getScriptProperties(); }
// ── เลขรุ่น (rev + แยกส่วน nsr/log/job/st) เก็บใน Properties แต่ "อ่าน" จากแคช → rev ที่ทุกเครื่องถามบ่อยไม่กินโควตา Properties รายวัน ──
function revsFrom_(all) { var e = Number(all.edit || 0);
  return { rev: (all.rev || '0') + '.' + (all.edit || '0'), areas: { nsr: String(Math.max(e, Number(all['r.nsr'] || 0))), log: all['r.log'] || '0', job: all['r.job'] || '0', st: all['r.st'] || '0', past: all['r.past'] || '0' } }; }
function rev_() { return st_().revs.rev; }
function areas_() { return st_().revs.areas; }
function bump_(area) { var now = String(Date.now()), p = props_(); p.setProperty('rev', now); if (area) p.setProperty('r.' + area, now); dropCache_(['revs']); ST_MEMO = null; }
function touch_(sheetId) { props_().setProperty('t:' + sheetId, String(Date.now())); }
function changed_(since) { var all = props_().getProperties(), out = []; for (var k in all) if (k.indexOf('t:') === 0 && Number(all[k]) > since) out.push(Number(k.slice(2))); return out; }
// คนแก้ในชีตเอง → ทุกเครื่องรู้ (simple trigger ทำงานเองไม่ต้องตั้งค่า)
function onEdit(e) { try { var now = String(Date.now()); var p = PropertiesService.getScriptProperties(); p.setProperty('edit', now); if (e && e.range) p.setProperty('t:' + e.range.getSheet().getSheetId(), now); dropCache_(['revs']); } catch (x) {} }
function dropCache_(ks) { try { CacheService.getScriptCache().removeAll(ks); } catch (x) {} }
// ทะเบียน: เพิ่มต่อท้ายอย่างเดียว → ขอเฉพาะแถวใหม่ (from = จำนวนที่เครื่องมีแล้ว)
function events_(from) { var sh = tab_('Log', LOG_COLS), n = Math.max(sh.getLastRow() - 1, 0), f = Math.max(0, Math.min(Number(from) || 0, n)), hd = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), LOG_COLS.length)).getValues()[0];
  var lv = n - f > 0 ? sh.getRange(f + 2, 1, n - f, hd.length).getValues() : [];
  return { ok: true, n: n, from: f, events: lv.map(function (r) { var o = {}; hd.forEach(function (h, i) { o[h] = r[i] instanceof Date ? r[i].toISOString() : r[i]; }); return o; }) }; }
// สถานะรวม (เลขรุ่น + สมาชิก) — อ่านแคชคำสั่งเดียว · แคชหาย = อ่าน Properties ครั้งเดียวแล้วเติมแคช
var ST_MEMO = null;
function st_() {
  if (ST_MEMO) return ST_MEMO;
  var c = CacheService.getScriptCache(), g = {}; try { g = c.getAll(['revs', 'mem']) || {}; } catch (x) {}
  var revs = null, mem = null; try { revs = g.revs ? JSON.parse(g.revs) : null; mem = g.mem ? JSON.parse(g.mem) : null; } catch (x) {}
  if (!revs || !mem) { var all = props_().getProperties(); revs = revsFrom_(all); mem = memFrom_(all.members); try { c.putAll({ revs: JSON.stringify(revs), mem: JSON.stringify(mem) }, 21600); } catch (x) {} }
  ST_MEMO = { revs: revs, mem: mem }; return ST_MEMO;
}
function memFrom_(raw) { var m = null; try { m = raw ? JSON.parse(raw) : null; } catch (x) { m = null; }
  if (!m || !m.list) m = { legacy: true, list: MEMBERS_SEED.map(function (x) { return { id: x.id, nick: x.nick, name: x.name || '', email: x.email || '', role: x.role || 'member', kh: '', active: true }; }) };
  return m; }
function cfg_() { var c = CacheService.getScriptCache(), r = null; try { r = c.get('cfg'); } catch (x) {}
  if (!r) { r = props_().getProperty('config') || JSON.stringify(CONFIG_SEED); try { c.put('cfg', r, 21600); } catch (x) {} }
  try { return JSON.parse(r) || {}; } catch (x) { return {}; } }
function saveMem_(m) { props_().setProperty('members', JSON.stringify(m)); dropCache_(['mem']); ST_MEMO = null; }
// ── ตัวตน: ลิงก์ส่วนตัว = รหัสเฉพาะคน (เก็บแค่ค่าแฮช ไม่เก็บรหัสจริง) · ลิงก์รวมเดิม = ใช้ได้เฉพาะตอนยังไม่ปิด ──
var ADMIN_OPS = { 'config.set': 1, 'members.list': 1, 'members.save': 1, 'members.key': 1, 'legacy.set': 1, 'audit': 1, 'jobs.trash': 1, 'job.versions': 1, 'job.restore': 1, 'nsr.migrateOT': 1, 'past.scan': 1 };
function hash_(k) { var b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'eqhub|' + k, Utilities.Charset.UTF_8);
  return b.map(function (x) { return ((x + 256) % 256).toString(16).replace(/^(.)$/, '0$1'); }).join(''); }
function auth_(req, mem) {
  var k = String(req.key || ''); if (k.length < 8 || k.length > 80) return null;
  if (k === TEAM_KEY) return mem.legacy ? { id: 'shared', nick: 'ลิงก์รวม', role: 'member', shared: true, email: '' } : null;
  var h = hash_(k);
  for (var i = 0; i < mem.list.length; i++) { var m = mem.list[i]; if (m.kh && m.kh === h) return m.active ? m : { revoked: true, id: m.id, nick: m.nick }; }
  return null;
}
function me_(who, mem) { return { id: who.id, nick: who.nick, role: who.role, email: who.email || '', shared: !!who.shared, legacy: !!mem.legacy, claimable: !!OWNER_CODE }; }
function newSecret_() { return 'eq-' + (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '').slice(0, 26).toLowerCase(); }
// ขอสิทธิ์แอดมินครั้งแรก/กู้สิทธิ์: ต้องมีรหัสเจ้าของ (อยู่ในไฟล์สคริปต์ที่เจ้าของวางเองเท่านั้น)
function claim_(q) {
  if (!OWNER_CODE || String(q.owner || '') !== OWNER_CODE) { audit_(q, 'ปฏิเสธ', 'admin.claim', 'รหัสเจ้าของไม่ถูก'); return { ok: false, error: 'forbidden' }; }
  var lock = LockService.getScriptLock(); if (!lock.tryLock(20000)) return { ok: false, error: 'busy' };
  try {
    var m = memFrom_(props_().getProperty('members')), a = null;
    for (var i = 0; i < m.list.length; i++) if (m.list[i].role === 'admin') { a = m.list[i]; break; }
    if (!a) { a = { id: 'admin', nick: 'แอดมิน', name: '', email: '', role: 'admin', kh: '', active: true }; m.list.unshift(a); }
    var key = newSecret_(); a.kh = hash_(key); a.active = true; saveMem_(m);
    audit_(q, 'รับสิทธิ์แอดมิน', a.nick, 'ด้วยรหัสเจ้าของ');
    return { ok: true, key: key, member: pub_(a, true) };
  } finally { lock.releaseLock(); }
}
function pub_(m, full) { var dv = devs_()[m.id] || {}, list = Object.keys(dv).map(function (d) { var x = dv[d]; return { dev: d, label: x.l || '', first: x.f || '', last: x.s || '' }; }).sort(function (a, b) { return a.last < b.last ? 1 : -1; });
  var o = { id: m.id, nick: m.nick, role: m.role, active: m.active !== false, lastSeen: list.length ? list[0].last : '', device: list.length ? list[0].label : '' };
  if (full) { o.name = m.name || ''; o.email = m.email || ''; o.hasKey = !!m.kh; o.devices = list; }
  return o; }
// ทุกคนเห็นชื่อเล่น/บทบาท/ใช้ล่าสุด · อีเมลและรายการเครื่อง = แอดมินเท่านั้น
function team_(who, full) { var m = st_().mem, adm = who && who.role === 'admin'; var out = m.list.map(function (x) { return pub_(x, adm && (full || true)); });
  if (m.legacy && devs_().shared) out.push(pub_({ id: 'shared', nick: 'ลิงก์รวม (ไม่ระบุตัว)', role: 'member', active: true }, adm)); return out; }
function saveMember_(q) {
  var x = q.member || {}, nick = String(x.nick || '').trim().slice(0, 30); if (!nick) return { ok: false, error: 'bad', message: 'ต้องมีชื่อเล่น' };
  var lock = LockService.getScriptLock(); if (!lock.tryLock(20000)) return { ok: false, error: 'busy' };
  try {
    var m = memFrom_(props_().getProperty('members')), cur = null;
    for (var i = 0; i < m.list.length; i++) if (m.list[i].id === x.id) cur = m.list[i];
    if (!cur) { if (m.list.length >= 30) return { ok: false, error: 'bad', message: 'สมาชิกเต็ม' }; cur = { id: 'm' + Date.now().toString(36), kh: '', active: true }; m.list.push(cur); }
    var before = JSON.stringify({ nick: cur.nick, email: cur.email, role: cur.role, active: cur.active });
    cur.nick = nick; cur.name = String(x.name || '').slice(0, 60); cur.email = String(x.email || '').trim().toLowerCase().slice(0, 80);
    cur.role = x.role === 'admin' ? 'admin' : 'member'; cur.active = x.active !== false;
    if (!m.list.some(function (y) { return y.role === 'admin' && y.active !== false && y.kh; })) return { ok: false, error: 'bad', message: 'ต้องเหลือแอดมินที่ใช้งานได้อย่างน้อย 1 คน' };
    saveMem_(m); audit_(q, 'แก้สมาชิก', nick, before + ' → ' + JSON.stringify({ nick: cur.nick, email: cur.email, role: cur.role, active: cur.active }));
    return { ok: true, member: pub_(cur, true) };
  } finally { lock.releaseLock(); }
}
// ออกลิงก์ส่วนตัวใหม่ (ลิงก์เดิมของคนนั้นใช้ไม่ได้ทันที) — รหัสแสดงครั้งเดียว
function newKey_(q) {
  var lock = LockService.getScriptLock(); if (!lock.tryLock(20000)) return { ok: false, error: 'busy' };
  try {
    var m = memFrom_(props_().getProperty('members')), cur = null;
    for (var i = 0; i < m.list.length; i++) if (m.list[i].id === q.id) cur = m.list[i];
    if (!cur) return { ok: false, error: 'missing' };
    var key = newSecret_(); cur.kh = hash_(key); cur.active = true; saveMem_(m);
    audit_(q, 'ออกลิงก์ส่วนตัวใหม่', cur.nick, 'ลิงก์เดิมของคนนี้ใช้ไม่ได้แล้ว');
    return { ok: true, key: key, member: pub_(cur, true) };
  } finally { lock.releaseLock(); }
}
function setLegacy_(q) {
  var m = memFrom_(props_().getProperty('members'));
  if (!q.on && !m.list.some(function (y) { return y.role === 'admin' && y.active !== false && y.kh; })) return { ok: false, error: 'bad', message: 'ต้องมีแอดมินที่มีลิงก์ส่วนตัวก่อนปิดลิงก์รวม' };
  m.legacy = !!q.on; saveMem_(m); audit_(q, m.legacy ? 'เปิดลิงก์รวม' : 'ปิดลิงก์รวม', 'ทีม', ''); return { ok: true, legacy: m.legacy };
}
// เครื่องที่ใช้ของแต่ละคน: บันทึกเครื่องใหม่ทันที (+ บันทึกเหตุการณ์ "เครื่องใหม่") · เวลาใช้ล่าสุดอัปเดตทุก ~10 นาที (ประหยัดโควตา)
function devs_() { var c = CacheService.getScriptCache(), r = null; try { r = c.get('devs'); } catch (x) {}
  if (!r) { r = props_().getProperty('devices') || '{}'; try { c.put('devs', r, 21600); } catch (x) {} }
  try { return JSON.parse(r) || {}; } catch (x) { return {}; } }
function seen_(who, req) {
  if (!req.dev) return; var c = CacheService.getScriptCache(), ck = 'sd:' + who.id + ':' + req.dev;
  try { if (c.get(ck)) return; } catch (x) {}
  var all = devs_(), mine = all[who.id] || {}, now = new Date().toISOString(), isNew = !mine[req.dev];
  mine[req.dev] = { l: req.dl || (mine[req.dev] && mine[req.dev].l) || '', f: (mine[req.dev] && mine[req.dev].f) || now, s: now };
  var ks = Object.keys(mine).sort(function (a, b) { return mine[a].s < mine[b].s ? 1 : -1; }); ks.slice(8).forEach(function (k) { delete mine[k]; });
  all[who.id] = mine; var j = JSON.stringify(all); if (j.length < 8500) { props_().setProperty('devices', j); try { c.put('devs', j, 21600); } catch (x) {} }
  try { c.put(ck, '1', 600); } catch (x) {}
  if (isNew) audit_(req, 'เครื่องใหม่', who.nick, req.dl || req.dev);
}
// รหัสผิด/ถูกปิด: นับในแคช · บันทึกลงประวัติไม่เกิน 1 ครั้ง/10 นาที/เครื่อง (กันถูกยิงจนชีตเต็ม)
function keyFail_(req, who) { try { var c = CacheService.getScriptCache(), k = 'kf:' + String(req.dev || 'x').slice(0, 40); if (c.get(k)) return; c.put(k, '1', 600);
  audit_({ who: who ? { nick: who.nick, role: '' } : { nick: '?', role: '' }, dev: String(req.dev || '').slice(0, 40), dl: String(req.dl || '').slice(0, 80) }, who ? 'ลิงก์ถูกปิดแต่ยังพยายามใช้' : 'รหัสไม่ถูกต้อง', String(req.op || '').slice(0, 30), ''); } catch (x) {} }
// จำกัดความถี่ต่อคน/เครื่อง (กันสคริปต์ยิงถล่ม): เขียน ≤ 40/นาที · อ่าน ≤ 150/นาที
var WRITE_OPS = { 'config.set': 1, 'nsr.create': 1, 'nsr.edit': 1, 'log': 1, 'log.many': 1, 'job.put': 1, 'job.del': 1, 'status.set': 1, 'members.save': 1, 'members.key': 1, 'legacy.set': 1, 'job.restore': 1, 'admin.claim': 1, 'nsr.migrateOT': 1 };
function rate_(who, req) { try { var c = CacheService.getScriptCache(), w = WRITE_OPS[req.op] ? 'w' : 'r', k = 'rl:' + w + ':' + who.id + ':' + req.dev + ':' + Math.floor(Date.now() / 60000), n = Number(c.get(k) || 0) + 1;
  c.put(k, String(n), 120); return n <= (w === 'w' ? 40 : 150); } catch (x) { return true; } }
// ── บันทึกการใช้งาน (ใคร · อีเมล · เครื่อง · ทำอะไร · กับอะไร) — แอดมินเท่านั้นที่อ่านได้ ──
var AUDIT_COLS = ['ts', 'who', 'email', 'role', 'device', 'dev', 'action', 'target', 'detail'];
function audit_(q, action, target, detail) { try { var w = q.who || {}, sh = tab_('Audit', AUDIT_COLS);
  sh.appendRow([new Date().toISOString(), String(w.nick || q.by || ''), String(w.email || ''), String(w.role || ''), String(q.dl || ''), String(q.dev || ''), action, String(target || '').slice(0, 200), String(detail || '').slice(0, 4000)]);
  var n = sh.getLastRow(); if (n > 6000) sh.deleteRows(2, 1000); } catch (x) {} }
function audit_list_(q) { var sh = tab_('Audit', AUDIT_COLS), n = sh.getLastRow() - 1, k = Math.min(Math.max(Number(q.limit) || 300, 1), 1000); if (n < 1) return { ok: true, rows: [] };
  var v = sh.getRange(Math.max(2, n + 2 - k), 1, Math.min(k, n), AUDIT_COLS.length).getValues().reverse();
  return { ok: true, rows: v.map(function (r) { var o = {}; AUDIT_COLS.forEach(function (c, i) { o[c] = r[i] instanceof Date ? r[i].toISOString() : String(r[i]); }); return o; }) }; }
// ทะเบียน: ชื่อ/อีเมล/เครื่องมาจากศูนย์กลาง (ลิงก์ส่วนตัว) — ลิงก์รวมใช้ชื่อที่พิมพ์ + "(ลิงก์รวม)"
function stampEv_(ev, q, force) { ev = ev || {}; var w = q.who || {};
  if (!w.shared) { if (force || !ev.byName) ev.byName = w.nick; ev.email = w.email || ''; ev.mid = w.id || ''; }
  else { ev.byName = String(ev.byName || '').slice(0, 40) ? String(ev.byName).slice(0, 40) + ' (ลิงก์รวม)' : 'ลิงก์รวม'; ev.email = ''; ev.mid = 'shared'; }
  if (force || !ev.device) ev.device = q.dl || ev.device || ''; return ev; }
// ── ตรวจข้อมูลที่จะเขียนลงชีต NSR (กันใส่สูตรแปลก/เขียนนอกตาราง) ──
var FN_OK = /\\b(SUM|MAX|MIN|IFERROR|ROUND|ROUNDUP|ROUNDDOWN|AVERAGE|IF|CEILING|FLOOR|ABS)\\s*\\(/gi;
function formulaOk_(f) { var t = String(f).slice(1).replace(FN_OK, '(').replace(/\\$?[A-Z]{1,3}\\$?\\d{1,4}/gi, ''); return /^[0-9+\\-*\\/().,:%\\s<>=]*$/.test(t); }
function gridBad_(q) { var rows = q.rows; if (!q.title || String(q.title).length > 99) return 'ชื่อแท็บไม่ถูกต้อง'; if (!Array.isArray(rows) || rows.length > 120) return 'จำนวนแถวเกิน';
  for (var i = 0; i < rows.length; i++) { if (!Array.isArray(rows[i]) || rows[i].length > 20) return 'จำนวนคอลัมน์เกิน';
    for (var j = 0; j < rows[i].length; j++) { var v = rows[i][j]; if (typeof v === 'string' && v.length > 2000) return 'ข้อความยาวเกิน'; if (typeof v === 'string' && v.charAt(0) === '=' && !formulaOk_(v)) return 'สูตรไม่อนุญาต: ' + v.slice(0, 60); } }
  return ''; }
function editsBad_(ed) { if (!Array.isArray(ed) || ed.length > 80) return 'จำนวนช่องที่แก้เกิน';
  for (var i = 0; i < ed.length; i++) { var x = ed[i]; if (!x || !(x.r >= 1 && x.r <= 80) || !(x.c >= 1 && x.c <= 20)) return 'ตำแหน่งช่องอยู่นอกตาราง NSR';
    if (typeof x.v === 'string' && x.v.length > 2000) return 'ข้อความยาวเกิน'; if (x.v !== null && typeof x.v === 'object') return 'ค่าไม่ถูกต้อง'; }
  return ''; }
// ข้อความที่ขึ้นต้นด้วย = + @ (ไม่ใช่สูตรที่อนุญาต/ตัวเลข) → ใส่เครื่องหมาย ' นำ ให้ชีตเก็บเป็นข้อความ (กันฝังสูตร)
function cellIn_(v, editMode) { if (typeof v !== 'string') return v; var c = v.charAt(0);
  if (c === '=' && !editMode && formulaOk_(v)) return v;
  if (c === '=' || c === '+' || c === '@' || (c === '-' && !/^-?\\d+(\\.\\d+)?$/.test(v))) return "'" + v; return v; }
// ── สเปรดชีตข้อมูลกลางทีม (สร้างครั้งแรกอัตโนมัติ) ──
var LOG_COLS = ['ts','eid','programId','jobId','action','docKind','docCode','school','courseCode','course','dayThemes','addons','partyTheme','durationMode','days','nights','dates','venue','province','region','students','teachers','normalPrice','specialPrice','source','by','byName','email','device','mid'];
var JOB_COLS = ['id','savedAt','name','course','school','dates','duration','docCode','files','lastFileAt','by','dev','deleted','size'];
function hub_() {
  var p = props_(), id = p.getProperty('HUB_ID'), ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (x) { ss = null; } }
  if (!ss) { ss = SpreadsheetApp.create('EQ Camp — ข้อมูลกลางทีม (ห้ามแชร์สาธารณะ)'); p.setProperty('HUB_ID', ss.getId()); }
  return ss;
}
function tab_(name, cols) { var ss = hub_(), sh = ss.getSheetByName(name); if (sh) { ensureCols_(sh, cols); return sh; } if (!sh) { sh = ss.insertSheet(name); sh.appendRow(cols); sh.setFrozenRows(1); var d = ss.getSheetByName('Sheet1') || ss.getSheetByName('ชีต1') || ss.getSheetByName('แผ่น1'); if (d && ss.getSheets().length > 1) ss.deleteSheet(d); } return sh; }
// แท็บเดิมจากรุ่นก่อน: เติมหัวคอลัมน์ใหม่ต่อท้าย (ไม่ย้าย/ไม่ลบคอลัมน์เดิม) — ตรวจครั้งเดียวต่อการเรียก
var COLS_OK = {};
function ensureCols_(sh, cols) { var k = sh.getName(); if (COLS_OK[k]) return; COLS_OK[k] = 1; var n = Math.max(sh.getLastColumn(), 1), hd = sh.getRange(1, 1, 1, n).getValues()[0];
  if (k === 'Jobs') return;   // Jobs: คอลัมน์ท้ายเป็นเนื้องาน ห้ามเติมหัว
  var miss = cols.filter(function (c) { return hd.indexOf(c) < 0; }); if (!miss.length) return; var at = hd.filter(function (h) { return h !== ''; }).length;
  sh.getRange(1, at + 1, 1, miss.length).setValues([miss]); }
function seenEid_(sh, eid) { var n = sh.getLastRow(); if (n < 2) return false; var v = sh.getRange(Math.max(2, n - 300), 2, Math.min(300, n - 1), 1).getValues(); for (var i = 0; i < v.length; i++) if (v[i][0] === eid) return true; return false; }
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
function putJob_(j, base, dev, by, q) {
  if (!j.id || !j.snap || String(j.id).length > 40) return { ok: false, error: 'bad' };
  if (JSON.stringify(j.snap).length > 600000) return { ok: false, error: 'bad', message: 'งานใหญ่เกิน' };
  var sh = tab_('Jobs', JOB_COLS), ids = sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), 1).getValues().map(function (r) { return r[0]; });
  var at = ids.indexOf(j.id) + 1, now = new Date().toISOString();
  if (at > 1 && base) { var cur = sh.getRange(at, 2).getValue(); cur = cur instanceof Date ? cur.toISOString() : String(cur); var cdev = sh.getRange(at, 12).getValue();
    if (cur > base && cdev !== dev) return { ok: false, error: 'conflict', savedAt: cur, by: sh.getRange(at, 11).getValue() }; }
  var s = JSON.stringify(j.snap), parts = []; for (var i = 0; i < s.length; i += 45000) parts.push(s.slice(i, i + 45000));
  var row = [j.id, now, j.name || '', j.course || '', j.school || '', j.dates || '', j.duration || '', j.docCode || '', Number(j.files) || 0, j.lastFileAt || '', by || '', dev || '', false, s.length].concat(parts);
  if (at > 1) { hist_(sh, at, q, 'ก่อนบันทึกทับ'); sh.getRange(at, 1, 1, Math.max(sh.getLastColumn(), row.length)).clearContent(); sh.getRange(at, 1, 1, row.length).setValues([row]); }
  else sh.appendRow(row);
  bump_('job'); return { ok: true, savedAt: now };
}
function delJob_(id, q) { var sh = tab_('Jobs', JOB_COLS), ids = sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), 1).getValues().map(function (r) { return r[0]; }), at = ids.indexOf(id) + 1;
  if (at > 1) { hist_(sh, at, q, 'ก่อนลบ'); sh.getRange(at, 13).setValue(true); sh.getRange(at, 2).setValue(new Date().toISOString()); bump_('job'); audit_(q || {}, 'ลบงาน', String(sh.getRange(at, 3).getValue()), id); } return { ok: true }; }
// ── ประวัติงาน: เก็บฉบับเดิมทุกครั้งก่อนบันทึกทับ/ลบ → แอดมินกู้คืนได้ (ไม่มีงานหายถาวรจากหน้าเว็บ) ──
var HIST_HEAD = ['ts', 'why', 'who', 'dev'];
function hist_(sh, at, q, why) { try { var n = Math.max(sh.getLastColumn(), JOB_COLS.length), row = sh.getRange(at, 1, 1, n).getValues()[0].map(function (v) { return v instanceof Date ? v.toISOString() : v; });
  while (row.length && row[row.length - 1] === '') row.pop();
  var h = tab_('JobHist', HIST_HEAD.concat(JOB_COLS)); h.appendRow([new Date().toISOString(), why, String((q && q.who && q.who.nick) || (q && q.by) || ''), String((q && q.dev) || '')].concat(row));
  var m = h.getLastRow(); if (m > 3000) h.deleteRows(2, 500); } catch (x) {} }
function histRows_(id) { var h = tab_('JobHist', HIST_HEAD.concat(JOB_COLS)), n = h.getLastRow(); if (n < 2) return [];
  var w = Math.max(h.getLastColumn(), HIST_HEAD.length + JOB_COLS.length), v = h.getRange(2, 1, n - 1, w).getValues(), out = [];
  for (var i = v.length - 1; i >= 0; i--) if (!id || v[i][4] === id) out.push({ row: i + 2, r: v[i] }); return out; }
function trash_() { var del = jobs_().filter(function (j) { return j.deleted; }).map(function (j) { delete j.snap; return j; });
  var recent = histRows_('').slice(0, 60).map(function (x) { var r = x.r; return { ts: String(r[0]), why: r[1], who: r[2], id: r[4], name: r[6], school: r[8], savedAt: r[5] instanceof Date ? r[5].toISOString() : String(r[5]) }; });
  return { ok: true, deleted: del, recent: recent }; }
function versions_(id) { return { ok: true, versions: histRows_(String(id || '')).slice(0, 30).map(function (x) { var r = x.r; return { at: String(r[0]), why: r[1], who: r[2], savedAt: r[5] instanceof Date ? r[5].toISOString() : String(r[5]), name: r[6], by: r[14], size: r[17] }; }) }; }
function restore_(q) {
  var lock = LockService.getScriptLock(); if (!lock.tryLock(25000)) return { ok: false, error: 'busy' };
  try {
    var sh = tab_('Jobs', JOB_COLS), ids = sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), 1).getValues().map(function (r) { return r[0]; }), at = ids.indexOf(q.id) + 1;
    var row = null;
    if (q.at) { var hv = histRows_(String(q.id)).filter(function (x) { return String(x.r[0]) === String(q.at); })[0]; if (!hv) return { ok: false, error: 'missing' }; row = hv.r.slice(HIST_HEAD.length); while (row.length && row[row.length - 1] === '') row.pop(); }
    if (at < 2 && !row) return { ok: false, error: 'missing' };
    if (at > 1) hist_(sh, at, q, 'ก่อนกู้คืน');
    var now = new Date().toISOString();
    if (row) { row[1] = now; row[12] = false; if (at > 1) { sh.getRange(at, 1, 1, Math.max(sh.getLastColumn(), row.length)).clearContent(); sh.getRange(at, 1, 1, row.length).setValues([row]); } else sh.appendRow(row); }
    else { sh.getRange(at, 13).setValue(false); sh.getRange(at, 2).setValue(now); }
    bump_('job'); audit_(q, 'กู้คืนงาน', String(row ? row[2] : sh.getRange(at, 3).getValue()), q.at ? 'ฉบับ ' + q.at : 'ยกเลิกการลบ');
    return { ok: true, savedAt: now };
  } finally { lock.releaseLock(); }
}
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
// ล็อกด้วย CacheService (หมดอายุเอง 2 นาที · ไม่กินโควตา Properties รายวัน) · ถือล็อกรวมแค่ช่วงตรวจ-จอง (มิลลิวินาที)
function allLock_() { var l = LockService.getScriptLock(); if (!l.tryLock(1500)) return false; try { var c = CacheService.getScriptCache(); if (c.get('allRun')) return false; c.put('allRun', '1', 120); return true; } catch (x) { return false; } finally { l.releaseLock(); } }
function allUnlock_() { try { CacheService.getScriptCache().remove('allRun'); } catch (x) {} }
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
  // ล็อกของการอ่านแท็บใหม่เท่านั้น (ไม่ใช้ล็อกบันทึกของทีม — เดิมถือได้ 20 วิ ทุกเครื่องบันทึกต้องรอ) · ค้าง >2 นาที = หลุด
  var locked = allLock_(), left = 0, built = 0, refresh = 0, out = [], writes = [];
  try {
    sheets.forEach(function (sh) {
      var id = String(sh.getSheetId()), i = at[id], r = i === undefined ? null : meta[i], edited = Number(props['t:' + id]) || 0;
      var need = !r || String(r[1]) !== sh.getName() || edited > Number(r[2]) || Number(r[2]) <= 1;   // ts 1 = แท็บใหญ่เกินช่อง (อ่านสดทุกครั้ง)
      var old = !need && r && t0 - Number(r[2]) > 86400000 && refresh < 15;   // กันพลาด: แท็บที่ไม่ได้อ่านใหม่เกิน 1 วัน ทยอยอ่านใหม่
      var rec = { title: sh.getName(), sheetId: Number(id), index: sh.getIndex() - 1 };
      if ((need || old) && locked && Date.now() - t0 < 15000) {
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
  } finally { if (locked) allUnlock_(); }
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
// ── คลังงานเก่า: สแกนโฟลเดอร์งานจริง (เช่น 2569) → แท็บ Past ในข้อมูลกลางทีม · อ่านอย่างเดียว ไม่แตะไฟล์ต้นฉบับ ──
var PAST_COLS = ['folderId', 'name', 'updated', 'files', 'scannedAt', 'created'];
function pastRows_() { var sh = tab_('Past', PAST_COLS), n = sh.getLastRow(); if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, PAST_COLS.length).getValues().map(function (r) { var f = []; try { f = JSON.parse(r[3] || '[]'); } catch (x) {} return { id: String(r[0]), name: String(r[1]), updated: String(r[2]), files: f, scannedAt: String(r[4]), created: String(r[5] || '') }; }); }
function pastFiles_(folder, prefix, out, depth) { var it = folder.getFiles();
  while (it.hasNext() && out.length < 80) { var f = it.next(); out.push({ id: f.getId(), n: (prefix ? prefix + '/' : '') + f.getName(), m: f.getMimeType(), s: f.getSize(), u: f.getLastUpdated().toISOString() }); }
  if (depth < 1) { var sub = folder.getFolders(); while (sub.hasNext() && out.length < 80) { var sf = sub.next(); pastFiles_(sf, (prefix ? prefix + '/' : '') + sf.getName(), out, depth + 1); } }
  return out; }
// สแกนทีละช่วง (งบ 20 วิ) ต่อจากจุดเดิมครั้งถัดไป · โฟลเดอร์ใหม่/เปลี่ยนชื่อ/แก้ไข/สแกนเกิน 3 วัน (งานอายุ ≤ 180 วัน) = อ่านรายการไฟล์ใหม่
function pastScan_(full) {
  if (!PAST_FOLDER) return { ok: false, error: 'nopast' };
  var t0 = Date.now(), sh = tab_('Past', PAST_COLS), rows = pastRows_(), idx = {}; rows.forEach(function (r, i) { idx[r.id] = i; });
  var p = props_(), tok = full ? '' : (p.getProperty('pastTok') || ''), it = null;
  if (tok) { try { it = DriveApp.continueFolderIterator(tok); } catch (x) { it = null; } }
  if (!it) it = DriveApp.getFolderById(PAST_FOLDER).getFolders();
  var changed = 0, now = Date.now();
  while (it.hasNext()) {
    if (Date.now() - t0 > 20000) { p.setProperty('pastTok', it.getContinuationToken()); if (changed) bump_('past'); return { ok: true, left: true, changed: changed, n: Math.max(0, sh.getLastRow() - 1) }; }
    var fo = it.next(), id = fo.getId(), up = fo.getLastUpdated().toISOString(), i = idx[id], cr = fo.getDateCreated ? fo.getDateCreated().toISOString() : '';
    if (i !== undefined && rows[i].updated === up && rows[i].name === fo.getName() && !(now - Date.parse(rows[i].scannedAt || 0) > 3 * 864e5 && now - Date.parse(cr || up) < 180 * 864e5)) continue;
    var row = [id, fo.getName(), up, JSON.stringify(pastFiles_(fo, '', [], 0)), new Date().toISOString(), cr];
    if (i !== undefined) sh.getRange(i + 2, 1, 1, PAST_COLS.length).setValues([row]); else { sh.appendRow(row); idx[id] = rows.length; rows.push({ id: id, updated: up, name: fo.getName(), scannedAt: row[4] }); }
    changed++;
  }
  p.setProperty('pastTok', ''); p.setProperty('pastAt', new Date().toISOString()); if (changed) bump_('past');
  return { ok: true, left: false, changed: changed, n: Math.max(0, sh.getLastRow() - 1) };
}
// ล็อกเฉพาะการสแกน (ไม่ใช้ล็อกรวมของทีม — สแกนนานหลายนาทีแล้วทีมยังบันทึกงานได้) · ค้างเกิน 6 นาที = ถือว่าหลุด
function pastLock_() { var l = LockService.getScriptLock(); if (!l.tryLock(3000)) return false; try { var p = props_(), t = +(p.getProperty('pastRun') || 0); if (t && Date.now() - t < 360000) return false; p.setProperty('pastRun', String(Date.now())); return true; } finally { l.releaseLock(); } }
function pastUnlock_() { props_().setProperty('pastRun', ''); }
function pastDaily() { if (!pastLock_()) return; try { var t0 = Date.now(), r = pastScan_(false); while (r.ok && r.left && Date.now() - t0 < 240000) { props_().setProperty('pastRun', String(Date.now())); r = pastScan_(false); } } finally { pastUnlock_(); } }
function ensurePast_() { var p = props_(); if (!PAST_FOLDER || p.getProperty('pastTrig') === '1') return;
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'pastDaily') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('pastDaily').timeBased().everyHours(6).create(); p.setProperty('pastTrig', '1'); }
// ข้อความของไฟล์ Word (ทีละย่อหน้า · แถวตาราง = ช่องคั่นแท็บ) — เฉพาะไฟล์ .docx ที่อยู่ในคลังงานเก่า
function pastText_(fileId) {
  var hit = null; pastRows_().some(function (r) { return r.files.some(function (f) { if (f.id === fileId) { hit = f; return true; } return false; }); });
  if (!fileId || !hit) return { ok: false, error: 'missing' };
  if (!(/\\.docx$/i.test(hit.n) || /wordprocessingml/.test(hit.m))) return { ok: false, error: 'type' };
  var c = CacheService.getScriptCache(), k = 'px:' + fileId; try { var got = c.get(k); if (got) return { ok: true, text: got, name: hit.n, cached: true }; } catch (x) {}
  var blob = DriveApp.getFileById(fileId).getBlob(); try { blob.setContentType('application/zip'); } catch (x) {}
  var xml = ''; Utilities.unzip(blob).forEach(function (b) { if (b.getName() === 'word/document.xml') xml = b.getDataAsString('UTF-8'); });
  if (!xml) return { ok: false, error: 'read' };
  var text = docxText_(xml); if (text.length < 90000) { try { c.put(k, text, 21600); } catch (x) {} }
  return { ok: true, text: text, name: hit.n };
}
function ent_(s) { return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\\d+);/g, function (m, d) { return String.fromCharCode(+d); }).replace(/&amp;/g, '&'); }
function ptext_(p) { var out = ''; p.replace(/<w:tab\\/>|<w:br\\b[^>]*\\/>|<w:t(?:\\s[^>]*)?>([\\s\\S]*?)<\\/w:t>/g, function (m, t) { out += m.indexOf('<w:tab') === 0 ? '\\t' : m.indexOf('<w:br') === 0 ? '\\n' : t; return m; }); return ent_(out); }
function paras_(x) { var out = []; x.replace(/<w:p\\b[^>]*\\/>|<w:p\\b[^>]*>[\\s\\S]*?<\\/w:p>/g, function (m) { out.push(ptext_(m)); return m; }); return out; }
function docxText_(xml) {
  var body = xml.replace(/^[\\s\\S]*?<w:body>/, '').replace(/<w:sectPr\\b[\\s\\S]*$/, ''), lines = [];
  body.split(/(<w:tbl>[\\s\\S]*?<\\/w:tbl>)/).forEach(function (part) {
    if (part.indexOf('<w:tbl>') === 0) {
      part.replace(/<w:tr\\b[^>]*>[\\s\\S]*?<\\/w:tr>/g, function (tr) {
        var cells = []; tr.replace(/<w:tc>[\\s\\S]*?<\\/w:tc>/g, function (tc) { cells.push(paras_(tc).filter(function (s) { return s.trim(); })); return tc; });
        var first = cells.map(function (c) { return c[0] || ''; }).filter(function (s) { return s.trim(); }).join('\\t'); if (first) lines.push(first);
        cells.forEach(function (c) { c.slice(1).forEach(function (s) { lines.push(s); }); }); return tr; });
    } else paras_(part).forEach(function (s) { lines.push(s); });
  });
  return lines.join('\\n').split('\\n').map(function (s) { return s.replace(/\\s+$/, ''); }).filter(function (s) { return s.trim(); }).join('\\n');
}
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
`;
export const newHubKey = () => 'eq-' + Array.from(crypto.getRandomValues(new Uint8Array(12))).map(b => b.toString(36).padStart(2, '0')).join('').slice(0, 18);

// ── ตั้งค่าทีมจากศูนย์กลาง (บัญชี SME Move ใบเสนอราคาสีฟ้า/สีส้ม) — ไม่อยู่ในเว็บสาธารณะ จำไว้ในเครื่องหลังเชื่อมต่อ ──
const LS_CFG = 'eqcamp.team.cfg';
export const teamConfig = (): TeamConfig => { try { return JSON.parse(localStorage.getItem(LS_CFG) || '{}') || {}; } catch { return {}; } };
export async function loadTeamConfig(): Promise<TeamConfig> {
  if (!hubReady()) return teamConfig();
  try { const j: any = await hubCall('config.get', {}, 20000); const c = j.config || {}; try { localStorage.setItem(LS_CFG, JSON.stringify(c)); } catch { /* */ } return c; }
  catch { return teamConfig(); }   // ศูนย์กลางรุ่นเก่า/ออฟไลน์ = ใช้ค่าที่จำไว้
}
export async function saveTeamConfig(c: TeamConfig): Promise<TeamConfig> {
  const j: any = await hubCall('config.set', { config: c }, 20000); try { localStorage.setItem(LS_CFG, JSON.stringify(j.config || c)); } catch { /* */ } return j.config || c;
}
