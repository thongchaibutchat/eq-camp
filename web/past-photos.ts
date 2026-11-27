// คลังภาพจากงานจริง (ศูนย์กลางรุ่น 15): ภาพที่ฝังอยู่ในโปรแกรม Word ที่ทีมส่งแล้ว — ที่พัก · รถบัส · กิจกรรม
// แยกหมวดจาก "หัวข้อก่อนภาพ" ในเอกสาร (เช่น "ตัวอย่างภาพบรรยากาศที่พัก …" / "รถบัสปรับอากาศ") — ไม่เดาจากตัวภาพ
// ภาพเก็บในเครื่องสมาชิก (IndexedDB) ย่อเหลือ ≤1600 px ก่อนใช้ · ไม่ฝังในเว็บสาธารณะ
import { hubCall, hubReady, HubError } from './hub';
import { readPastLib } from './past-library';

export type MediaKind = 'venue' | 'bus' | 'activity' | 'other';
export interface PastMedia { name: string; size: number; ctx: string }
export interface PhotoRef { fileId: string; name: string; ctx: string; kind: MediaKind; venue: string; course: string; date: string; job: string }
const LS = 'eqcamp.pastmedia.v1';
interface MediaStore { at: string; files: Record<string, { at: string; media: PastMedia[] } | { at: string; err: string }> }
export const readMedia = (): MediaStore => { try { const v = JSON.parse(localStorage.getItem(LS) || 'null'); return v && v.files ? v : { at: '', files: {} }; } catch { return { at: '', files: {} }; } };
const listeners = new Set<() => void>();
export const onMedia = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const writeMedia = (m: MediaStore) => { try { localStorage.setItem(LS, JSON.stringify(m)); } catch { /* เต็ม */ } listeners.forEach(f => { try { f(); } catch { /* */ } }); };

const BUS = /รถบัส|รถโดยสาร|รถทัวร์|รถตู้|รถปรับอากาศ|รถ\s*vip|\bbus\b|coach|พาหนะ/i;
const VENUE = /ที่พัก|โรงแรม|รีสอร์ท|รีสอร์ต|resort|hotel|ห้องพัก|ห้องประชุม|สระว่ายน้ำ|บรรยากาศ/i;
const ACT = /ภาพกิจกรรม|ตัวอย่างภาพ|กิจกรรม|activity|photo|gallery/i;
export function classify(ctx: string): { kind: MediaKind; venue: string } {
  const c = String(ctx || ''); const last = c.split(' | ').reverse();
  // ใช้หัวข้อที่ใกล้ภาพที่สุดก่อน
  for (const t of last) {
    if (BUS.test(t)) return { kind: 'bus', venue: '' };
    if (VENUE.test(t)) { const m = t.match(/(?:ที่พัก|บรรยากาศ(?:ที่พัก)?)\s*[:：-]?\s*(.+)$/); return { kind: 'venue', venue: (m ? m[1] : '').replace(/^(?:ณ\s*)/, '').trim() }; }
    if (ACT.test(t)) return { kind: 'activity', venue: '' };
  }
  return { kind: 'other', venue: '' };
}
const OK_IMG = (m: PastMedia) => m.size >= 20000 && /\.(jpe?g|png|webp)$/i.test(m.name);

let running: Promise<void> | null = null;
/** อ่านรายการภาพของทุกงานที่อ่านโปรแกรมแล้ว (ต้องอ่านคลังกิจกรรมก่อน) — เฉพาะไฟล์ที่ยังไม่เคยอ่าน */
export function buildPastMedia(opt: { onStep?: (done: number, total: number) => void; signal?: AbortSignal } = {}): Promise<void> {
  if (running) return running;
  running = (async () => {
    if (!hubReady()) throw new HubError('off', 'ยังไม่ได้เชื่อมต่อทีม');
    const lib = readPastLib(); const st = readMedia();
    const files = [...new Set(Object.values(lib.items).filter(d => d.fileId && !d.err).map(d => d.fileId))];
    const todo = files.filter(f => !st.files[f] || 'err' in st.files[f]);
    let done = files.length - todo.length, i = 0, n = 0; const retry: Record<string, number> = {}; opt.onStep?.(done, files.length);
    const worker = async () => {
      while (i < todo.length) {
        if (opt.signal?.aborted) return;
        const f = todo[i++];
        try {
          const r = await hubCall<{ ok: boolean; media?: PastMedia[]; error?: string }>('past.media', { fileId: f }, 90000);
          st.files[f] = r.ok ? { at: new Date().toISOString(), media: (r.media || []).map(m => ({ name: m.name, size: m.size, ctx: m.ctx })) } : { at: new Date().toISOString(), err: r.error || 'read' };
        } catch (e: any) {
          if (e?.code === 'op') { i = todo.length; throw new HubError('op', 'ศูนย์กลางทีมยังเป็นรุ่นเก่า — ต้องอัปเดตเป็นรุ่น 15 ก่อนรวมภาพจากงานจริง'); }
          if ((e?.code === 'busy' || e?.code === 'timeout' || e?.code === 'offline') && (retry[f] = (retry[f] || 0) + 1) <= 3) { i--; todo.splice(i, 1); todo.push(f); await new Promise(r => setTimeout(r, 4000)); continue; }
          st.files[f] = { at: new Date().toISOString(), err: e?.code || 'read' };
        }
        done++; opt.onStep?.(done, files.length);
        if (++n % 8 === 0) { st.at = new Date().toISOString(); writeMedia(st); }
      }
    };
    await Promise.all([worker(), worker()]);
    st.at = new Date().toISOString(); writeMedia(st);
  })().finally(() => { running = null; });
  return running;
}

export interface PhotoIndex { venues: { name: string; items: PhotoRef[] }[]; bus: PhotoRef[]; acts: Record<string, PhotoRef[]>; other: PhotoRef[]; files: number; total: number }
export function photoIndex(): PhotoIndex {
  const lib = readPastLib(), st = readMedia();
  const byFile = new Map(Object.values(lib.items).filter(d => d.fileId).map(d => [d.fileId, d]));
  const venues = new Map<string, PhotoRef[]>(); const bus: PhotoRef[] = [], other: PhotoRef[] = []; const acts: Record<string, PhotoRef[]> = {};
  let files = 0, total = 0;
  for (const [fileId, e] of Object.entries(st.files)) {
    if (!('media' in e)) continue; const d = byFile.get(fileId); if (!d) continue; files++;
    for (const m of e.media.filter(OK_IMG)) {
      const c = classify(m.ctx); total++;
      const ref: PhotoRef = { fileId, name: m.name, ctx: m.ctx, kind: c.kind, venue: c.venue || d.venue, course: d.course, date: d.date, job: d.name };
      if (c.kind === 'bus') bus.push(ref);
      else if (c.kind === 'venue') { const v = (ref.venue || 'ไม่ระบุชื่อที่พัก').replace(/\s+/g, ' ').trim(); const a = venues.get(v) || []; a.push(ref); venues.set(v, a); }
      else if (c.kind === 'activity') (acts[d.course] = acts[d.course] || []).push(ref);
      else other.push(ref);
    }
  }
  const byDate = (a: PhotoRef, b: PhotoRef) => b.date.localeCompare(a.date);
  return { venues: [...venues.entries()].map(([name, items]) => ({ name, items: items.sort(byDate) })).sort((a, b) => b.items.length - a.items.length), bus: bus.sort(byDate), acts, other, files, total };
}

/* ===================== โหลดภาพ (ย่อ + เก็บในเครื่อง) ===================== */
const DB = 'eqcamp-img', STORE = 'img';
const idb = (): Promise<IDBDatabase | null> => new Promise(res => { try { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE); r.onsuccess = () => res(r.result); r.onerror = () => res(null); } catch { res(null); } });
const idbGet = async (k: string): Promise<Blob | null> => { const db = await idb(); if (!db) return null; return new Promise(res => { try { const q = db.transaction(STORE).objectStore(STORE).get(k); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); } catch { res(null); } }); };
const idbPut = async (k: string, v: Blob) => { const db = await idb(); if (!db) return; try { db.transaction(STORE, 'readwrite').objectStore(STORE).put(v, k); } catch { /* เต็ม */ } };
const mem = new Map<string, Promise<Blob>>();
async function shrink(b: Blob, max = 1600): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(b); const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * s); cv.height = Math.round(bmp.height * s);
    cv.getContext('2d')!.drawImage(bmp, 0, 0, cv.width, cv.height); bmp.close?.();
    const out: Blob | null = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.85)); cv.width = 0; return out || b;
  } catch { return b; }
}
/** ภาพหนึ่งใบ (JPEG ≤1600 px) — แคชในเครื่อง */
export function photoBlob(ref: { fileId: string; name: string }): Promise<Blob> {
  const k = ref.fileId + '|' + ref.name;
  if (!mem.has(k)) mem.set(k, (async () => {
    const hit = await idbGet(k); if (hit) return hit;
    const r = await hubCall<{ ok: boolean; data?: string; mime?: string; error?: string }>('past.img', { fileId: ref.fileId, name: ref.name }, 90000);
    if (!r.ok || !r.data) throw new HubError(r.error || 'read', r.error === 'op' ? 'ต้องอัปเดตศูนย์กลางเป็นรุ่น 15' : r.error === 'big' ? 'ภาพใหญ่เกินไป' : 'โหลดภาพไม่ได้');
    const bin = atob(r.data); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const small = await shrink(new Blob([u], { type: r.mime || 'image/jpeg' }));
    await idbPut(k, small); return small;
  })().catch(e => { mem.delete(k); throw e; }));
  return mem.get(k)!;
}
export const photoBytes = async (ref: { fileId: string; name: string }) => new Uint8Array(await (await photoBlob(ref)).arrayBuffer());
