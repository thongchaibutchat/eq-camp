// ส่งใบเสนอราคาเข้า SME Move — SME Move ไม่มี API สาธารณะ และนำเข้าใบเสนอราคาจาก Excel ไม่ได้ (คู่มือ: อัปโหลด Excel ได้เฉพาะใบแจ้งหนี้/สินค้า/รายชื่อ)
// จึงเตรียม "ข้อมูลพร้อมกรอก" เรียงตามฟอร์มสร้างใบเสนอราคา (ขาย → ใบเสนอราคา → สร้างใบเสนอราคา) ให้คัดลอกทีละช่อง/ทั้งชุด
// ห้ามเดา: ช่องที่บรีฟไม่มี (ที่อยู่/เลขผู้เสียภาษีโรงเรียน) = ว่าง + บอกให้กรอกเอง · ไม่มีต้นทุน/กำไร
import type { Camp } from '../src/eqcamp-core';
import { withAddonPrice, buildSchedule, compose, addonPriceNote } from '../src/eqcamp-core';

export interface SmeField { key: string; label: string; value: string; missing?: boolean; hint?: string }
export interface SmeLine { name: string; detail: string; qty: number; unit: string; price: number; discount: number; total: number }
export interface SmeQuote { customer: SmeField[]; doc: SmeField[]; lines: SmeLine[]; notes: string; total: number; problems: string[] }

const fmt = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
const today = (d = new Date()) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
const addDays = (n: number, d = new Date()) => { const x = new Date(d.getTime()); x.setDate(x.getDate() + (Number(n) || 0)); return x; };

export function smeQuote(c0: Camp, now = new Date()): SmeQuote {
  const c = withAddonPrice(c0);
  const plan = buildSchedule(c), k = compose(c, plan);
  const school = String(c.school || '').trim();
  const qty = Number(c.students) || 0, price = Number(c.specialPrice) || 0, normal = Number(c.normalPrice) || 0;
  const problems: string[] = [];
  if (!school) problems.push('ยังไม่มีชื่อโรงเรียน');
  if (!qty) problems.push('ยังไม่มีจำนวนนักเรียน');
  if (!price) problems.push('ยังไม่มีราคาพิเศษ/ท่าน');
  // แสดงเป็นราคาปกติ + ส่วนลด/หน่วย เมื่อราคาปกติสูงกว่า (ตรงกับเอกสาร "ราคาปกติ … ลดเหลือ …"); ไม่งั้นใช้ราคาพิเศษตรง ๆ
  const useDisc = normal > price && price > 0;
  const name = String(k.titleTh || '').replace(/\s+/g, ' ').trim();
  const dates = /…|\.\.\./.test(String(c.dates || '')) ? '' : String(c.dates || '');   // ค่าว่าง/ตัวอย่าง ไม่ใส่
  const detail = [k.titleEn, [k.dur, dates].filter(Boolean).join(' · '), c.venue ? `ณ ${c.venue}${c.province ? ' จ.' + c.province : ''}` : '',
    k.addonItems?.length ? k.addonItems.join(' · ') + (addonPriceNote(c) ? ' ' + addonPriceNote(c) : '') : '',
    `นักเรียน${c.level ? ' ' + c.level : ''} · รวมที่พัก อาหาร วิทยากร อุปกรณ์ ตามรายละเอียดในโปรแกรม`].filter(Boolean).join('\n');
  const line: SmeLine = { name, detail, qty, unit: 'ท่าน', price: useDisc ? normal : price, discount: useDisc ? normal - price : 0, total: qty * price };
  const qt = c.docCode ? `QT ${String(c.docCode).replace(/^PL\s*/, '')}` : '';
  const customer: SmeField[] = [
    { key: 'cust', label: 'ชื่อลูกค้า', value: school ? (/^โรงเรียน/.test(school) ? school : 'โรงเรียน' + school) : '', missing: !school },
    { key: 'attn', label: 'ผู้ติดต่อ / เรียน', value: school ? `ผู้อำนวยการ${/^โรงเรียน/.test(school) ? school : 'โรงเรียน' + school}` : '', missing: !school },
    { key: 'addr', label: 'ที่อยู่ลูกค้า', value: '', missing: true, hint: 'บรีฟไม่มีที่อยู่ — กรอกใน SME Move หรือเลือกลูกค้าเดิม' },
    { key: 'tax', label: 'เลขประจำตัวผู้เสียภาษี', value: '', missing: true, hint: 'กรอกเองถ้าโรงเรียนต้องการ' }
  ];
  const doc: SmeField[] = [
    { key: 'date', label: 'วันที่', value: today(now) },
    { key: 'valid', label: 'ยืนราคาถึง', value: c.validDays ? `${today(addDays(c.validDays, now))} (${c.validDays} วัน)` : '', missing: !c.validDays },
    { key: 'ref', label: 'อ้างอิง', value: [qt, c.docCode ? `โปรแกรม ${c.docCode}` : ''].filter(Boolean).join(' / '), missing: !c.docCode },
    { key: 'sales', label: 'พนักงานขาย / ผู้เสนอราคา', value: String(c.contactName || '').trim(), missing: !String(c.contactName || '').trim() }
  ];
  const notes = [c.payTerms, normal > price && price ? `ราคาปกติ ${fmt(normal)} บาท/ท่าน ลดเหลือ ${fmt(price)} บาท/ท่าน` : '', 'กำหนดการอาจเปลี่ยนแปลงตามความเหมาะสม โดยไม่กระทบเนื้อหาการเรียนรู้'].filter(Boolean).join('\n');
  return { customer, doc, lines: [line], notes, total: line.total, problems };
}

// ข้อความทั้งชุด (วางในโน้ต/ส่งให้คนกรอก) — ไม่มีต้นทุน/กำไร
export function smeText(q: SmeQuote): string {
  const L = q.lines.map((l, i) => [`${i + 1}. ${l.name}`, l.detail.split('\n').map(s => '   ' + s).join('\n'), `   จำนวน ${fmt(l.qty)} ${l.unit} × ${fmt(l.price)} บาท${l.discount ? ` ส่วนลด ${fmt(l.discount)} บาท/${l.unit}` : ''} = ${fmt(l.total)} บาท`].join('\n'));
  const F = (fs: SmeField[]) => fs.map(f => `${f.label}: ${f.value || '(กรอกเอง)'}`).join('\n');
  return ['ใบเสนอราคา (สำหรับกรอกใน SME Move)', F(q.customer), F(q.doc), '', 'รายการ', ...L, '', `ยอดรวม ${fmt(q.total)} บาท (ตรวจประเภทภาษีใน SME Move ให้ตรงกับที่บริษัทใช้)`, '', 'หมายเหตุ', q.notes].join('\n');
}
export const SME_URL_KEY = 'eqcamp.smemove.url';
export const SME_DEFAULT = 'https://smemove.com/';
export const fmtMoney = fmt;
