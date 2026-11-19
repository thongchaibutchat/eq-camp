// ศูนย์กลางทีม (Team Hub) — เชื่อมทุกส่วนเข้าหาข้อมูลชุดเดียวกันแบบเรียลไทม์ ทุกเครื่อง/ทุกแอป
// ฝั่งเซิร์ฟเวอร์ = Apps Script ตัวเดียวบนชีต NSR (ทีมติดตั้งครั้งเดียว) ให้บริการ:
//   · NSR: รายชื่อแท็บ / อ่าน / สร้างแท็บ / แก้ช่อง / แท็บที่เปลี่ยน
//   · ทะเบียนโปรแกรม: บันทึก/อ่านเหตุการณ์สร้างไฟล์
//   · งานของทีม: เก็บ/เปิด/ลบงาน (บรีฟ+ค่าทั้งหมดของงาน) — เปิดต่อจากเครื่องไหนก็ได้
//   · rev: เลขรุ่นข้อมูล — เปลี่ยนทุกครั้งที่มีคนแก้ (ผ่านเว็บ หรือแก้ในชีตเอง) → ทุกเครื่องรู้ภายใน ~5 วินาที
// ความปลอดภัย: ทุกคำสั่งต้องมี "รหัสทีม" · ไม่ฝังที่อยู่/รหัสใน bundle สาธารณะ · เข้าร่วมทีมด้วยลิงก์เชิญ (#/join/…)
// ออฟไลน์: คำสั่งเขียนเข้าคิวในเครื่อง แล้วส่งเองเมื่อกลับมาออนไลน์

export interface HubState { status: 'off' | 'connecting' | 'live' | 'offline' | 'error' | 'blocked'; msg?: string; lastOk?: number; rev?: string; pending: number }
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
export function setHub(url: string, key: string) { ls.set(LS.url, url.trim()); ls.set(LS.key, key.trim()); state = { ...state, status: hubReady() ? 'connecting' : 'off', msg: '' }; emitState(); kick(); }
export function clearHub() { ls.set(LS.url, ''); ls.set(LS.key, ''); state = { status: 'off', pending: queue().length }; emitState(); }

// ── ลิงก์เชิญ: เปิดลิงก์นี้บนเครื่อง/แอปไหนก็เข้าร่วมทีมได้ทันที (ที่อยู่+รหัส อยู่หลัง # → ไม่ถูกส่งถึงเซิร์ฟเวอร์เว็บ) ──
const b64u = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));
export const inviteLink = (base?: string) => `${base || (location.origin + location.pathname)}#/join/${b64u(JSON.stringify({ u: hubUrl(), k: hubKey() }))}`;
// ลิงก์ติดตั้ง (เจ้าของชีต): #/setup/<รหัสทีม> — เปิดแล้วกรอกเฉพาะที่อยู่ Web app (รหัสตรงกับโค้ดที่วางแล้ว)
export const setupKeyFrom = (hash: string): string => { const m = hash.match(/^#\/setup\/([\w-]+)/); if (!m) return ''; try { const k = unb64u(m[1]); return /^[\w-]{8,64}$/.test(k) ? k : ''; } catch { return ''; } };
export const setupLink = (key: string, base: string) => `${base}#/setup/${b64u(key)}`;
export function acceptInvite(hash: string): boolean {
  const m = hash.match(/^#\/join\/([\w-]+)/); if (!m) return false;
  try { const j = JSON.parse(unb64u(m[1])); if (URL_RX.test(j.u) && j.k) { setHub(j.u, j.k); return true; } } catch { /* ลิงก์เสีย */ }
  return false;
}

// ── เรียกเซิร์ฟเวอร์ ──
export class HubError extends Error { code: string; data?: any; constructor(code: string, msg: string, data?: any) { super(msg); this.code = code; this.data = data; } }
const IN_CLAUDE = typeof window !== 'undefined' && !!(window as any).claude;
export async function hubCall<T = any>(op: string, body: Record<string, any> = {}, timeout = 45000): Promise<T> {
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
  clearTimeout(t);
  let j: any; try { j = await r.json(); } catch { throw new HubError('bad', 'ศูนย์กลางทีมตอบกลับผิดรูปแบบ (ตรวจว่า Deploy เป็น Web app แล้ว)'); }
  if (!j || j.ok === false) {
    const c = j?.error || 'server';
    const msg: Record<string, string> = { key: 'รหัสทีมไม่ถูกต้อง', exists: 'มีแท็บชื่อนี้แล้ว', missing: 'ไม่พบรายการนี้แล้ว', op: 'ศูนย์กลางทีมเป็นรุ่นเก่า — คัดลอกโค้ดใหม่แล้ว Deploy อีกครั้ง', conflict: 'มีคนแก้ระหว่างนี้' };
    throw new HubError(c, msg[c] || j?.message || 'ศูนย์กลางทีมตอบกลับไม่สำเร็จ', j);
  }
  noteOk(j.rev);
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
let flushing = false;
export async function flush() {
  if (flushing || !hubReady()) return; flushing = true;
  try {
    for (;;) {
      const q = queue(); if (!q.length) break;
      const it = q[0];
      try { await hubCall(it.op, it.body); saveQ(queue().filter(x => x.id !== it.id)); bc?.postMessage({ t: 'changed' }); }
      catch (e: any) {
        if (['net', 'offline', 'timeout', 'blocked', 'off'].includes(e?.code)) break;          // ลองใหม่ภายหลัง
        it.tries++; const rest = queue().filter(x => x.id !== it.id);
        saveQ(it.tries >= 3 ? rest : [it, ...rest]);                                           // ผิดถาวร 3 ครั้ง → ทิ้ง (ไม่ค้างคิว)
        if (it.tries < 3) break;
      }
    }
  } finally { flushing = false; }
}

// ── เรียลไทม์: ถาม rev ทุก 5 วิ (ขณะเปิดหน้าอยู่) · หยุดเมื่อซ่อนหน้า · กลับมา/ออนไลน์ = เช็กทันที · แท็บอื่นในเครื่องเดียวกันรู้ทันทีผ่าน BroadcastChannel ──
let state: HubState = { status: hubReady() ? 'connecting' : 'off', pending: queue().length };
const stateSubs = new Set<(s: HubState) => void>();
const revSubs = new Set<Listener>();
const emitState = () => stateSubs.forEach(f => { try { f(state); } catch { /* */ } });
export const hubState = () => state;
export const onHubState = (f: (s: HubState) => void) => { stateSubs.add(f); f(state); return () => { stateSubs.delete(f); }; };
export const onRev = (f: Listener) => { revSubs.add(f); start(); return () => { revSubs.delete(f); }; };
let lastRev = '';
function noteOk(rev?: string) {
  const prev = state.status;
  state = { ...state, status: 'live', msg: '', lastOk: Date.now() };
  if (rev && rev !== lastRev) { const changed = !!lastRev; lastRev = rev; state.rev = rev; emitState(); revSubs.forEach(f => { try { f(rev, changed); } catch { /* */ } }); }
  else if (prev !== 'live' || true) emitState();
}
const bc: BroadcastChannel | null = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('eqcamp-hub') : null;
if (bc) bc.onmessage = (m: MessageEvent) => { if (m.data?.t === 'changed') kick(); };
let timer: any = null, started = false, fails = 0;
export const POLL_MS = 5000;
async function tick() {
  timer = null;
  if (!hubReady()) { state = { ...state, status: 'off' }; emitState(); return; }
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;   // หยุดเมื่อซ่อน — visibilitychange ปลุกใหม่
  try { await hubCall('rev', {}, 15000); fails = 0; if (queue().length) flush(); }
  catch (e: any) {
    fails++;
    state = { ...state, status: e?.code === 'offline' ? 'offline' : e?.code === 'blocked' ? 'blocked' : 'error', msg: e?.message };
    emitState();
    if (e?.code === 'key' || e?.code === 'blocked') return;                                 // ไม่วนถามซ้ำเมื่อผิดถาวร
  }
  schedule(fails ? Math.min(30000, POLL_MS * (1 + fails)) : POLL_MS);
}
const schedule = (ms: number) => { if (timer) clearTimeout(timer); timer = setTimeout(tick, ms); };
export function kick() { if (!hubReady()) return; schedule(30); }
function start() {
  if (started || typeof window === 'undefined') return; started = true;
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') kick(); });
  window.addEventListener('focus', kick); window.addEventListener('online', () => { kick(); flush(); });
  window.addEventListener('pageshow', kick);
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
const VERSION = 5;
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
  try {
    var r = route_(req) || { ok: false, error: 'op' };
    if (r.ok !== false) r.rev = rev_();
    return out_(r);
  } catch (err) { return out_({ ok: false, error: 'server', message: String(err) }); }
}
function route_(q) {
  var ss = nsr_();
  try { ensureTrigger_(); } catch (x) {}
  try { ensureWarm_(); } catch (x) {}
  switch (q.op) {
    case 'rev': return { ok: true, version: VERSION };
    case 'nsr.list': return { ok: true, url: ss.getUrl(), tabs: ss.getSheets().map(function (s) { return { title: s.getName(), sheetId: s.getSheetId(), index: s.getIndex() - 1 }; }) };
    case 'nsr.read': return { ok: true, tabs: (q.tabs || []).slice(0, 80).map(function (t) {
        var sh = ss.getSheetByName(t); if (!sh) return { title: t, missing: true };
        var n = Math.min(Math.max(sh.getLastRow(), 1), 60), rg = sh.getRange(1, 1, n, 13);
        return { title: t, sheetId: sh.getSheetId(), index: sh.getIndex() - 1, values: rg.getDisplayValues(), formulas: rg.getFormulas() }; }) };
    case 'nsr.changes': return { ok: true, since: Number(q.since) || 0, ids: changed_(Number(q.since) || 0) };
    case 'nsr.all': return all_(ss, q);
    case 'status.list': return { ok: true, status: statuses_() };
  }
  var lock = LockService.getScriptLock(); lock.waitLock(25000);
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
        touch_(sh.getSheetId()); bump_();
        return { ok: true, sheetId: sh.getSheetId(), title: sh.getName() };
      }
      case 'nsr.edit': {
        var s2 = ss.getSheetByName(q.title); if (!s2) return { ok: false, error: 'missing' };
        var conflicts = [];
        (q.edits || []).forEach(function (x) { var cur = s2.getRange(x.r, x.c).getDisplayValue(); if (!same_(cur, x.was)) conflicts.push({ r: x.r, c: x.c, now: cur }); });
        if (conflicts.length && !q.force) return { ok: false, error: 'conflict', conflicts: conflicts };
        (q.edits || []).forEach(function (x) { s2.getRange(x.r, x.c).setValue(x.v); });
        touch_(s2.getSheetId()); bump_();
        return { ok: true };
      }
      case 'log': { var ev = q.ev || {}; if (!ev.eid) return { ok: false, error: 'bad' };
        var lg = tab_('Log', LOG_COLS); if (seen_(lg, ev.eid)) return { ok: true, dup: true };
        lg.appendRow(LOG_COLS.map(function (c) { return ev[c] === undefined ? '' : String(ev[c]).slice(0, 300); })); bump_(); return { ok: true }; }
      case 'log.many': { var lg2 = tab_('Log', LOG_COLS), have = {}, n2 = lg2.getLastRow(); if (n2 > 1) lg2.getRange(2, 2, n2 - 1, 1).getValues().forEach(function (r) { have[r[0]] = 1; });
        var add = (q.events || []).slice(0, 500).filter(function (ev) { return ev && ev.eid && !have[ev.eid]; }).map(function (ev) { return LOG_COLS.map(function (c) { return ev[c] === undefined ? '' : String(ev[c]).slice(0, 300); }); });
        if (add.length) { lg2.getRange(lg2.getLastRow() + 1, 1, add.length, LOG_COLS.length).setValues(add); bump_(); } return { ok: true, added: add.length }; }
      case 'events': { var lv = tab_('Log', LOG_COLS).getDataRange().getValues(); var hd = lv.shift() || [];
        return { ok: true, events: lv.map(function (r) { var o = {}; hd.forEach(function (h, i) { o[h] = r[i] instanceof Date ? r[i].toISOString() : r[i]; }); return o; }) }; }
      case 'jobs': return { ok: true, jobs: jobs_().map(function (j) { delete j.snap; return j; }).filter(function (j) { return !q.since || j.savedAt > q.since; }) };
      case 'job.get': { var jj = jobs_(true).filter(function (j) { return j.id === q.id; })[0]; return jj ? { ok: true, job: jj } : { ok: false, error: 'missing' }; }
      case 'job.put': return putJob_(q.job || {}, q.base, q.dev, q.by);
      case 'job.del': return delJob_(q.id);
      case 'status.set': { var st = q.st || {}; if (st.sheetId === undefined || st.sheetId === null || st.sheetId === '' || !st.status) return { ok: false, error: 'bad' };
        var ssh = tab_('Status', ST_COLS), sn = ssh.getLastRow(), sids = sn > 1 ? ssh.getRange(2, 1, sn - 1, 1).getValues().map(function (r) { return String(r[0]); }) : [];
        st.at = new Date().toISOString(); st.by = q.by || ''; st.dev = q.dev || '';
        var srow = ST_COLS.map(function (c) { return st[c] === undefined || st[c] === null ? '' : String(st[c]).slice(0, 500); });
        var si = sids.indexOf(String(st.sheetId)); if (si >= 0) ssh.getRange(si + 2, 1, 1, srow.length).setValues([srow]); else ssh.appendRow(srow);
        tab_('StatusLog', ST_COLS).appendRow(srow); bump_(); return { ok: true, at: st.at }; }
    }
  } finally { lock.releaseLock(); }
}
// ── rev: เลขรุ่น = เวลาที่เขียนผ่านเว็บล่าสุด + เวลาที่มีคนแก้ชีตเองล่าสุด (onEdit) ──
function props_() { return PropertiesService.getScriptProperties(); }
function rev_() { var p = props_(); return (p.getProperty('rev') || '0') + '.' + (p.getProperty('edit') || '0'); }
function bump_() { props_().setProperty('rev', String(Date.now())); }
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
  var sh = tab_('Jobs', JOB_COLS), v = sh.getDataRange().getValues(); v.shift();
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
  bump_(); return { ok: true, savedAt: now };
}
function delJob_(id) { var sh = tab_('Jobs', JOB_COLS), ids = sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), 1).getValues().map(function (r) { return r[0]; }), at = ids.indexOf(id) + 1;
  if (at > 1) { sh.getRange(at, 13).setValue(true); sh.getRange(at, 2).setValue(new Date().toISOString()); bump_(); } return { ok: true }; }
function num_(s) { var t = String(s == null ? '' : s).replace(/[฿,\\s]/g, ''); return /^-?\\d+(\\.\\d+)?%?$/.test(t) ? parseFloat(t) / (t.slice(-1) === '%' ? 100 : 1) : null; }
function same_(a, b) { var x = num_(a), y = num_(b); if (x !== null && y !== null) return Math.abs(x - y) < 0.5; return String(a || '').replace(/\\s/g, '') === String(b || '').replace(/\\s/g, ''); }
// ── สถานะการขายต่อแท็บ NSR (เก็บในสเปรดชีตข้อมูลกลาง: Status = ล่าสุด · StatusLog = ประวัติทุกครั้ง) ──
var ST_COLS = ['sheetId','title','name','status','reason','note','finalPrice','finalPax','followUp','pct','price','participants','by','dev','at'];
function statuses_() { var sh = tab_('Status', ST_COLS), v = sh.getDataRange().getValues(); v.shift();
  return v.filter(function (r) { return r[0] !== ''; }).map(function (r) { var o = {}; ST_COLS.forEach(function (c, i) { o[c] = r[i] instanceof Date ? r[i].toISOString() : r[i]; }); return o; }); }
// ── ภาพรวมทุกแท็บในคำสั่งเดียว: เก็บสำเนาแต่ละแท็บไว้ในแท็บ NsrCache ของสเปรดชีตข้อมูลกลาง · อ่านแท็บจริงใหม่เฉพาะที่มีคนแก้/เปลี่ยนชื่อ/ใหม่ ──
var CACHE_COLS = ['sheetId','title','ts','json'];
function trimRows_(m) { return m.map(function (r) { var a = r.slice(); while (a.length && (a[a.length - 1] === '' || a[a.length - 1] === null)) a.pop(); return a; }); }
function snap_(sh) { var n = Math.min(Math.max(sh.getLastRow(), 1), 60), rg = sh.getRange(1, 1, n, 13), v = trimRows_(rg.getDisplayValues()), f = trimRows_(rg.getFormulas());
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
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
`;
export const newHubKey = () => 'eq-' + Array.from(crypto.getRandomValues(new Uint8Array(12))).map(b => b.toString(36).padStart(2, '0')).join('').slice(0, 18);
