// ส่งใบเสนอราคาเข้า SME Move — SME Move ไม่มี API สาธารณะ และนำเข้าใบเสนอราคาจาก Excel ไม่ได้ (คู่มือ: อัปโหลด Excel ได้เฉพาะใบแจ้งหนี้/สินค้า/รายชื่อ)
// จึงเตรียม "ข้อมูลพร้อมกรอก" เรียงตามฟอร์มสร้างใบเสนอราคา (ขาย → ใบเสนอราคา → สร้างใบเสนอราคา) ให้คัดลอกทีละช่อง/ทั้งชุด
// ห้ามเดา: ช่องที่บรีฟไม่มี (ที่อยู่/เลขผู้เสียภาษีโรงเรียน) = ว่าง + บอกให้กรอกเอง · ไม่มีต้นทุน/กำไร
import type { Camp } from '../src/eqcamp-core';
import { withAddonPrice, buildSchedule, compose, addonPriceNote } from '../src/eqcamp-core';

export interface SmeField { key: string; label: string; value: string; missing?: boolean; hint?: string }
export interface SmeLine { name: string; detail: string; qty: number; unit: string; price: number; discount: number; total: number }
export interface SmeQuote { customer: SmeField[]; doc: SmeField[]; lines: SmeLine[]; notes: string; total: number; problems: string[]; vat: 'include' | 'exclude' | 'none' | ''; vatText: string }

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
  const qc = c0.quoteCustomer || {}, sch = school ? (/^โรงเรียน/.test(school) ? school : 'โรงเรียน' + school) : '';
  const customer: SmeField[] = [
    { key: 'cust', label: 'ชื่อลูกค้า', value: sch, missing: !school },
    { key: 'branch', label: 'สาขา', value: String(qc.branch || '').trim(), hint: 'ไม่ระบุ = สำนักงานใหญ่ (ตามที่โรงเรียนแจ้ง)' },
    { key: 'addr', label: 'ที่อยู่ลูกค้า', value: String(qc.address || '').trim(), missing: !String(qc.address || '').trim(), hint: 'ยังไม่มีที่อยู่ — กรอกในช่องด้านบน หรือเลือกลูกค้าเดิมใน SME Move' },
    { key: 'tax', label: 'เลขประจำตัวผู้เสียภาษี', value: String(qc.taxId || '').trim(), hint: 'ไม่มี = ไม่ใส่ (โรงเรียนรัฐมักมีเลข 13 หลักของหน่วยงาน)' },
    { key: 'attn', label: 'ผู้ติดต่อ', value: String(qc.contact || '').trim() || (sch ? `ผู้อำนวยการ${sch}` : ''), missing: !school },
    { key: 'phone', label: 'โทร / อีเมลลูกค้า', value: [qc.phone, qc.email].map(x => String(x || '').trim()).filter(Boolean).join(' · ') }
  ];
  if (qc.taxId && !/^\d{13}$/.test(String(qc.taxId).replace(/[\s-]/g, ''))) problems.push('เลขผู้เสียภาษีต้องมี 13 หลัก');
  const doc: SmeField[] = [
    { key: 'date', label: 'วันที่', value: today(now) },
    { key: 'valid', label: 'ยืนราคาถึง', value: c.validDays ? `${today(addDays(c.validDays, now))} (${c.validDays} วัน)` : '', missing: !c.validDays },
    { key: 'ref', label: 'อ้างอิง', value: [qt, c.docCode ? `โปรแกรม ${c.docCode}` : ''].filter(Boolean).join(' / '), missing: !c.docCode },
    { key: 'sales', label: 'พนักงานขาย / ผู้เสนอราคา', value: String(c.contactName || '').trim(), missing: !String(c.contactName || '').trim() }
  ];
  const notes = [c.payTerms, normal > price && price ? `ราคาปกติ ${fmt(normal)} บาท/ท่าน ลดเหลือ ${fmt(price)} บาท/ท่าน` : '', 'กำหนดการอาจเปลี่ยนแปลงตามความเหมาะสม โดยไม่กระทบเนื้อหาการเรียนรู้'].filter(Boolean).join('\n');
  const vat = (qc.vat || '') as SmeQuote['vat'];
  const vatText = vat === 'include' ? 'ราคารวมภาษีมูลค่าเพิ่มแล้ว' : vat === 'exclude' ? 'ราคายังไม่รวมภาษีมูลค่าเพิ่ม (บวก VAT 7% ในใบเสนอราคา)' : vat === 'none' ? 'ไม่คิดภาษีมูลค่าเพิ่ม' : '';
  if (!vat) problems.push('ยังไม่ได้เลือกประเภทภาษี (รวม/ไม่รวม VAT)');
  return { customer, doc, lines: [line], notes, total: line.total, problems, vat, vatText };
}

// ข้อความทั้งชุด (วางในโน้ต/ส่งให้คนกรอก) — ไม่มีต้นทุน/กำไร
export function smeText(q: SmeQuote): string {
  const L = q.lines.map((l, i) => [`${i + 1}. ${l.name}`, l.detail.split('\n').map(s => '   ' + s).join('\n'), `   จำนวน ${fmt(l.qty)} ${l.unit} × ${fmt(l.price)} บาท${l.discount ? ` ส่วนลด ${fmt(l.discount)} บาท/${l.unit}` : ''} = ${fmt(l.total)} บาท`].join('\n'));
  const F = (fs: SmeField[]) => fs.map(f => `${f.label}: ${f.value || '(กรอกเอง)'}`).join('\n');
  return ['ใบเสนอราคา (สำหรับกรอกใน SME Move)', F(q.customer), F(q.doc), '', 'รายการ', ...L, '', `ยอดรวม ${fmt(q.total)} บาท${q.vatText ? ' · ' + q.vatText : ' (ยังไม่ได้เลือกประเภทภาษี)'}`, '', 'หมายเหตุ', q.notes].join('\n');
}
// คำสั่งสำหรับ AI เอเจนต์ที่ควบคุมเบราว์เซอร์ได้ (เช่น Claude in Chrome) ให้สร้างใบเสนอราคาจริงใน SME Move
// ผู้ใช้ล็อกอิน SME Move เอง (เอเจนต์ห้ามกรอกรหัสผ่าน) · เอเจนต์บันทึกเป็นฉบับร่าง และไม่ส่งอีเมลถึงลูกค้า
export function smeAgentPrompt(q: SmeQuote, smeUrl: string): string {
  const l = q.lines[0], F = (fs: SmeField[]) => fs.filter(f => f.value).map(f => `- ${f.label}: ${f.value}`).join('\n');
  return [
    'งาน: สร้างใบเสนอราคาจริงในโปรแกรมบัญชี SME Move จากข้อมูลด้านล่าง (ข้อมูลมาจากเว็บ EQ Camp — ตรวจแล้ว)',
    '',
    'กติกา:',
    `1. เปิด SME Move (${smeUrl}) ในแท็บที่ฉันล็อกอินไว้แล้ว — ถ้ายังไม่ล็อกอิน ให้หยุดและบอกให้ฉันล็อกอินเอง ห้ามกรอกรหัสผ่าน`,
    '2. ไปที่ ขาย → ใบเสนอราคา → สร้างใบเสนอราคา',
    '3. ลูกค้า: ค้นชื่อก่อน ถ้ามีอยู่แล้วให้เลือกรายเดิม ถ้าไม่มีให้สร้างลูกค้าใหม่ตามข้อมูลนี้ (ช่องที่ไม่มีข้อมูลให้เว้นว่าง ห้ามเดา)',
    '4. กรอกรายการสินค้า/บริการตามข้อมูลนี้ทุกช่อง แล้วตรวจยอดรวมให้ตรง',
    '5. บันทึกเป็น "ฉบับร่าง" เท่านั้น ห้ามกดอนุมัติ/ส่งอีเมล/ส่งให้ลูกค้า',
    '6. บอกเลขที่เอกสารที่ SME Move ออกให้ + สิ่งที่กรอกไม่ได้ (ถ้ามี) แล้วหยุดให้ฉันตรวจ',
    '',
    'ลูกค้า:', F(q.customer),
    '',
    'เอกสาร:', F(q.doc),
    '',
    'รายการ:',
    `- ชื่อสินค้า/บริการ: ${l.name}`,
    `- รายละเอียด: ${l.detail.replace(/\n/g, ' / ')}`,
    `- จำนวน: ${fmt(l.qty)} ${l.unit}`,
    `- ราคาต่อหน่วย: ${fmt(l.price)} บาท`,
    l.discount ? `- ส่วนลดต่อหน่วย: ${fmt(l.discount)} บาท` : '',
    `- ยอดรวมที่ต้องได้: ${fmt(q.total)} บาท${q.vatText ? ` (${q.vatText})` : ''}`,
    q.vatText ? `- ประเภทภาษี: ${q.vatText}` : '- ประเภทภาษี: ยังไม่ได้ระบุ — ถามฉันก่อนเลือก',
    '',
    'หมายเหตุในเอกสาร:', q.notes
  ].filter(x => x !== '').join('\n').replace(/\n(ลูกค้า:|เอกสาร:|รายการ:|หมายเหตุในเอกสาร:)/g, '\n\n$1');
}
export const SME_URL_KEY = 'eqcamp.smemove.url';
export const SME_DEFAULT = 'https://smemove.com/';
export const fmtMoney = fmt;
