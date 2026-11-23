// คลังงานเก่า (ฝั่งเว็บ): รายการโฟลเดอร์งานจริงจากศูนย์กลางทีม + เปิดโปรแกรม Word เดิมมาแก้ต่อ
// ข้อมูลลูกค้า (ชื่อโรงเรียน/ราคา) อยู่ในศูนย์กลางทีมเท่านั้น — เว็บสาธารณะไม่มีข้อมูลนี้ · เก็บสำเนาในเครื่องของสมาชิกเพื่อค้นหาเร็ว
import { hubCall, hubReady, HubError } from './hub';
import { classifyPast, parsePastProgram, PastFolder, PastJob, PastParse } from '../src/past-import';

const LS = 'eqcamp.past.v1';
export interface PastCache { at: string; scannedAt: string; folders: PastFolder[] }
const empty: PastCache = { at: '', scannedAt: '', folders: [] };
export const readPastCache = (): PastCache => { try { const v = JSON.parse(localStorage.getItem(LS) || 'null'); return v && Array.isArray(v.folders) ? v : empty; } catch { return empty; } };
const writeCache = (c: PastCache) => { try { localStorage.setItem(LS, JSON.stringify(c)); } catch { /* เต็ม — ใช้ในหน่วยความจำ */ } };
let memo: { key: string; jobs: PastJob[] } = { key: '', jobs: [] };
/** งานเก่าทั้งหมดที่จัดชนิดแล้ว (จากสำเนาในเครื่อง) — ใหม่สุดก่อน */
export function pastJobs(c: PastCache = readPastCache()): PastJob[] {
  const key = c.at + ':' + c.folders.length; if (memo.key === key) return memo.jobs;
  const jobs = c.folders.map(classifyPast).sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.name.localeCompare(b.name, 'th'));
  memo = { key, jobs }; return jobs;
}
/** โหลดรายการล่าสุดจากศูนย์กลาง */
export async function loadPast(): Promise<PastCache> {
  if (!hubReady()) return readPastCache();
  const r = await hubCall<{ ok: boolean; folders: PastFolder[]; scannedAt: string; root: number; error?: string }>('past.list');
  if (!r.ok) throw new HubError(r.error || 'server', r.error === 'op' ? 'ศูนย์กลางทีมยังเป็นรุ่นเก่า — ต้องอัปเดตเป็นรุ่น 11 ก่อนใช้คลังงานเก่า' : 'โหลดคลังงานเก่าไม่ได้');
  const c: PastCache = { at: new Date().toISOString(), scannedAt: r.scannedAt || '', folders: r.folders || [] };
  writeCache(c); return c;
}
/** สแกนโฟลเดอร์ (เฉพาะแอดมิน) — ทยอยทีละช่วงจนครบ */
export async function scanPast(onStep?: (n: number) => void, full = false): Promise<{ n: number; changed: number }> {
  let changed = 0, n = 0;
  for (let k = 0; k < 30; k++) {
    const r = await hubCall<{ ok: boolean; left: boolean; changed: number; n: number; error?: string }>('past.scan', { full: full && k === 0 }, 90000);
    if (!r.ok) throw new HubError(r.error || 'server', r.error === 'nopast' ? 'ศูนย์กลางยังไม่ได้ตั้งโฟลเดอร์งานเก่า' : r.error === 'forbidden' ? 'สแกนได้เฉพาะแอดมิน' : 'สแกนไม่สำเร็จ');
    changed += r.changed; n = r.n; onStep?.(n);
    if (!r.left) break;
  }
  return { n, changed };
}
/** เปิดโปรแกรม Word ของงานเก่า → งานใหม่ (ยังไม่บันทึก จนกว่าผู้ใช้กดสร้างงาน) */
export async function openPast(job: PastJob): Promise<PastParse> {
  const f = job.programDocx; if (!f) throw new HubError('type', 'งานนี้ไม่มีไฟล์ Word ของโปรแกรม — เปิดดูได้อย่างเดียว');
  const r = await hubCall<{ ok: boolean; text: string; name: string; error?: string }>('past.text', { fileId: f.id }, 90000);
  if (!r.ok) throw new HubError(r.error || 'server', r.error === 'missing' ? 'ไม่พบไฟล์นี้ในคลัง — ให้แอดมินสแกนโฟลเดอร์ใหม่' : r.error === 'type' ? 'อ่านได้เฉพาะไฟล์ Word (.docx)' : r.error === 'read' ? 'ไฟล์ Word นี้อ่านไม่ได้' : 'อ่านไฟล์ไม่สำเร็จ');
  return parsePastProgram(r.text, { folderId: job.id, folderName: job.name, fileId: f.id, fileName: f.n, date: job.date, confirmed: job.confirmed });
}
export const driveUrl = (id: string, folder = false) => folder ? `https://drive.google.com/drive/folders/${id}` : `https://drive.google.com/file/d/${id}/view`;
