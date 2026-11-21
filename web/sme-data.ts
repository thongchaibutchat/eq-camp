// ส่งใบเสนอราคาเข้า SME Move — SME Move ไม่มี API สาธารณะ และนำเข้าใบเสนอราคาจาก Excel ไม่ได้ (คู่มือ: อัปโหลด Excel ได้เฉพาะใบแจ้งหนี้/สินค้า/รายชื่อ)
// จึงเตรียม "ข้อมูลพร้อมกรอก" เรียงตามฟอร์มสร้างใบเสนอราคา (ขาย → ใบเสนอราคา → สร้างใบเสนอราคา) ให้คัดลอกทีละช่อง/ทั้งชุด
// ห้ามเดา: ช่องที่บรีฟไม่มี (ที่อยู่/เลขผู้เสียภาษีโรงเรียน) = ว่าง + บอกให้กรอกเอง · ไม่มีต้นทุน/กำไร
import type { Camp } from '../src/eqcamp-core';
import { withAddonPrice, buildSchedule, compose, addonPriceNote } from '../src/eqcamp-core';
import type { TeamConfig } from './hub';

// ใบเสนอราคา 2 แบบของทีม: สีฟ้า = มีภาษี (VAT) ออกจากบัญชี SME Move ฝั่งมีภาษี · สีส้ม = ไม่มีภาษี ออกจากบัญชีฝั่งไม่มีภาษี
export type QuoteColor = 'blue' | 'orange';
export const COLOR_NAME: Record<QuoteColor, string> = { blue: 'ใบเสนอราคาสีฟ้า', orange: 'ใบเสนอราคาสีส้ม' };
export const COLOR_DESC: Record<QuoteColor, string> = { blue: 'มีภาษี (VAT)', orange: 'ไม่มีภาษี' };
export const colorOf = (vat?: string): QuoteColor | '' => (vat === 'none' ? 'orange' : vat === 'include' || vat === 'exclude' ? 'blue' : '');
export const accountFor = (color: QuoteColor | '', cfg: TeamConfig) => (color ? String(cfg.sme?.[color]?.email || '') : '');

export interface SmeField { key: string; label: string; value: string; missing?: boolean; hint?: string }
export interface SmeLine { name: string; detail: string; qty: number; unit: string; price: number; discount: number; total: number }
export interface SmeQuote { customer: SmeField[]; doc: SmeField[]; lines: SmeLine[]; notes: string; total: number; problems: string[]; vat: 'include' | 'exclude' | 'none' | ''; vatText: string; color: QuoteColor | '' }

const fmt = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
const today = (d = new Date()) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
const addDays = (n: number, d = new Date()) => { const x = new Date(d.getTime()); x.setDate(x.getDate() + (Number(n) || 0)); return x; };

// ค่าช่อง "ภาษีมูลค่าเพิ่ม" ในฟอร์ม SME Move (ตัวเลือกจริง: ไม่มีภาษี · แยกภาษี 7 % · รวมภาษี 7 %)
export const SME_VAT: Record<'include' | 'exclude' | 'none', string> = { include: 'รวมภาษี 7 %', exclude: 'แยกภาษี 7 %', none: 'ไม่มีภาษี' };

// แพตเทิร์นจริงของทีม (ถอดจากใบเสนอราคาค่ายใน SME Move เช่น QT-000000920 · 21 พ.ย. 2569):
// 1 รายการ · ชื่อสินค้า = หลักสูตร “ชื่อค่าย” · รายละเอียด = "รายละเอียดงบประมาณมีดังนี้" + รายการงบ · จำนวน = นักเรียน · ราคาต่อหน่วย = ราคาพิเศษ
// ช่องทางการขาย หน้าร้าน · เครดิต ไม่มี · ส่วนลด ไม่มีส่วนลด · สีฟ้า = รวมภาษี 7 % (ค่าเริ่ม)
export function smeQuote(c0: Camp, now = new Date()): SmeQuote {
  const c = withAddonPrice(c0);
  const plan = buildSchedule(c), k = compose(c, plan);
  const school = String(c.school || '').trim();
  const qty = Number(c.students) || 0, price = Number(c.specialPrice) || 0;
  const problems: string[] = [];
  if (!school) problems.push('ยังไม่มีชื่อโรงเรียน');
  if (!qty) problems.push('ยังไม่มีจำนวนนักเรียน');
  if (!price) problems.push('ยังไม่มีราคาพิเศษ/ท่าน');
  const th = String(k.titleTh || '').replace(/\s+/g, ' ').trim(), en = String(k.titleEn || '').replace(/\s+/g, ' ').trim();
  const name = en && !th.includes(en) ? `${th} ( ${en} )` : th;
  const budget = (k.budget || []).map(x => String(x).trim()).filter(Boolean);
  const addon = k.addonItems?.length ? '- ' + k.addonItems.join(' · ') + (addonPriceNote(c) ? ' ' + addonPriceNote(c) : '') : '';
  const detail = [budget.length ? 'รายละเอียดงบประมาณมีดังนี้' : '', ...budget.map(x => '- ' + x), addon].filter(Boolean).join('\n');
  const line: SmeLine = { name, detail, qty, unit: 'ท่าน', price, discount: 0, total: qty * price };
  const qc = c0.quoteCustomer || {}, sch = school ? (/^โรงเรียน/.test(school) ? school : 'โรงเรียน' + school) : '';
  const customer: SmeField[] = [
    { key: 'cust', label: 'ชื่อลูกค้า', value: sch, missing: !school },
    { key: 'addr', label: 'ที่อยู่', value: String(qc.address || '').trim(), missing: !String(qc.address || '').trim(), hint: 'ยังไม่มีที่อยู่ — กรอกในช่องด้านบน หรือเลือกลูกค้าเดิมใน SME Move (ที่อยู่จะขึ้นเอง)' },
    { key: 'tax', label: 'เลขประจำตัวผู้เสียภาษี', value: String(qc.taxId || '').trim(), hint: 'ไม่มี = ไม่ใส่' },
    { key: 'branch', label: 'สำนักงาน/สาขาเลขที่', value: String(qc.branch || '').trim() || 'สำนักงานใหญ่' },
    { key: 'attn', label: 'ข้อมูลผู้ติดต่อ', value: [qc.contact, qc.phone, qc.email].map(x => String(x || '').trim()).filter(Boolean).join(' · '), hint: 'ไม่บังคับ' }
  ];
  if (qc.taxId && !/^\d{13}$/.test(String(qc.taxId).replace(/[\s-]/g, ''))) problems.push('เลขผู้เสียภาษีต้องมี 13 หลัก');
  const vat = (qc.vat || '') as SmeQuote['vat'];
  const doc: SmeField[] = [
    { key: 'date', label: 'วันที่', value: today(now) },
    { key: 'channel', label: 'ช่องทางการขาย', value: 'หน้าร้าน' },
    { key: 'credit', label: 'เครดิต', value: 'ไม่มี' },
    { key: 'vatsel', label: 'ภาษีมูลค่าเพิ่ม', value: vat ? SME_VAT[vat] : '', missing: !vat, hint: 'เลือกใบเสนอราคาสีฟ้า/สีส้มด้านบนก่อน' },
    { key: 'disc', label: 'ส่วนลด', value: 'ไม่มีส่วนลด' },
    { key: 'valid', label: 'ระยะเวลา (ยืนราคา)', value: c.validDays ? `${c.validDays} วัน (ถึง ${today(addDays(c.validDays, now))})` : '', hint: 'ไม่บังคับ' },
    { key: 'sales', label: 'พนักงานขาย', value: String(c.contactName || '').trim(), hint: 'ไม่บังคับ' },
    { key: 'inote', label: 'โน้ตภายในบริษัท', value: [c.docCode ? `โปรแกรม ${c.docCode}` : '', c.dates && !/…|\.\.\./.test(String(c.dates)) ? String(c.dates) : '', 'สร้างจากเว็บ EQ Camp'].filter(Boolean).join(' · ') }
  ];
  const notes = String(c.payTerms || '').trim();
  const vatText = vat === 'include' ? 'ราคารวมภาษีมูลค่าเพิ่มแล้ว' : vat === 'exclude' ? 'ราคายังไม่รวมภาษีมูลค่าเพิ่ม (บวก VAT 7% ในใบเสนอราคา)' : vat === 'none' ? 'ไม่คิดภาษีมูลค่าเพิ่ม' : '';
  if (!vat) problems.push('ยังไม่ได้เลือกใบเสนอราคาสีฟ้า (มีภาษี) หรือสีส้ม (ไม่มีภาษี)');
  return { customer, doc, lines: [line], notes, total: line.total, problems, vat, vatText, color: colorOf(vat) };
}

// ข้อความทั้งชุด (วางในโน้ต/ส่งให้คนกรอก) — ไม่มีต้นทุน/กำไร
export function smeText(q: SmeQuote): string {
  const L = q.lines.map((l, i) => [`${i + 1}. ${l.name}`, l.detail.split('\n').map(s => '   ' + s).join('\n'), `   จำนวน ${fmt(l.qty)} × ${fmt(l.price)} บาท = ${fmt(l.total)} บาท`].join('\n'));
  const F = (fs: SmeField[]) => fs.map(f => `${f.label}: ${f.value || '(กรอกเอง)'}`).join('\n');
  return [`${q.color ? COLOR_NAME[q.color] + ' (' + COLOR_DESC[q.color] + ')' : 'ใบเสนอราคา'} — สำหรับกรอกใน SME Move`, F(q.customer), F(q.doc), '', 'รายการ', ...L, '', `ยอดรวม ${fmt(q.total)} บาท${q.vatText ? ' · ' + q.vatText : ' (ยังไม่ได้เลือกประเภทภาษี)'}`, ...(q.notes ? ['', 'หมายเหตุเอกสาร', q.notes] : [])].join('\n');
}
// คำสั่งสำหรับ AI เอเจนต์ที่ควบคุมเบราว์เซอร์ได้ (เช่น Claude in Chrome) ให้สร้างใบเสนอราคาจริงใน SME Move
// ผู้ใช้ล็อกอิน SME Move เอง (เอเจนต์ห้ามกรอกรหัสผ่าน) · เอเจนต์บันทึกเป็นฉบับร่าง และไม่ส่งอีเมลถึงลูกค้า
export function smeAgentPrompt(q: SmeQuote, smeUrl: string, account = ''): string {
  const l = q.lines[0], F = (fs: SmeField[]) => fs.filter(f => f.value).map(f => `- ${f.label}: ${f.value}`).join('\n');
  const kind = q.color ? `${COLOR_NAME[q.color]} (${COLOR_DESC[q.color]})` : 'ยังไม่ระบุสี — ถามฉันก่อนเริ่ม';
  const v = (k: string) => q.doc.find(f => f.key === k)?.value || '';
  return [
    `งาน: สร้าง${q.color ? COLOR_NAME[q.color] : 'ใบเสนอราคา'}จริงในโปรแกรมบัญชี SME Move จากข้อมูลด้านล่าง (ข้อมูลมาจากเว็บ EQ Camp — ตรวจแล้ว)`,
    `ชนิด: ${kind}`,
    '',
    'กติกา:',
    `1. เปิด SME Move (${smeUrl}) ในแท็บที่ฉันล็อกอินไว้แล้ว — ถ้าเจอหน้า "เข้าสู่ระบบ" ให้หยุดและบอกให้ฉันล็อกอินเอง ห้ามกรอกรหัสผ่าน`,
    account ? `   ต้องเป็นบัญชี ${account} เท่านั้น (บัญชีของ${q.color ? COLOR_NAME[q.color] : 'ใบเสนอราคานี้'}) — ดูบัญชีที่ล็อกอินอยู่ก่อน ถ้าเป็นบัญชีอื่นให้หยุดและบอกให้ฉันสลับบัญชีเอง` : '   (ยังไม่ได้ตั้งบัญชี SME Move ของสีนี้ในเว็บ — ถามฉันว่าใช้บัญชีไหนก่อนเริ่ม)',
    '2. เมนูซ้าย ขาย → ใบเสนอราคา → ปุ่ม "สร้างใบเสนอราคา" (ฟอร์มเปิดเป็นหน้าต่างซ้อน)',
    '3. พนักงานขาย / ตัวแทนขาย: ช่องทางการขาย = หน้าร้าน' + (v('sales') ? ` · พนักงานขาย = ${v('sales')} (ถ้าไม่มีในรายการให้เว้นไว้)` : ''),
    '4. ลูกค้า: พิมพ์ในช่อง "ชื่อลูกค้า" แล้วเลือกจากรายการถ้ามีรายเดิม (ที่อยู่/เลขผู้เสียภาษีจะขึ้นเอง — ถ้าต่างจากข้อมูลนี้ให้แจ้งฉัน ห้ามแก้ทับ) · ถ้าไม่มี ให้พิมพ์ชื่อใหม่แล้วกรอกช่อง "ที่อยู่" ตามข้อมูลนี้ · ช่องที่ไม่มีข้อมูลให้เว้นว่าง ห้ามเดา',
    `5. เงื่อนไขราคา: สกุลเงิน THB · เครดิต = ไม่มี · ภาษีมูลค่าเพิ่ม = ${v('vatsel') || 'ยังไม่ได้ระบุ — ถามฉันก่อนเลือก'} · ส่วนลด = ไม่มีส่วนลด`,
    '6. สินค้า แถวที่ 1: ช่อง "สินค้า" = ชื่อด้านล่าง (ถ้ามีสินค้าเดิมชื่อเดียวกันทุกตัวอักษรให้เลือก ไม่งั้นพิมพ์เป็นรายการใหม่) · กด "เพิ่มรายละเอียดสินค้า" ใส่รายละเอียดทีละบรรทัด · จำนวน · ราคาต่อหน่วย · แล้วตรวจ "ยอดเงินสุทธิ" ให้ตรง',
    '7. ' + (v('valid') ? `ระยะเวลา (ยืนราคา) = ${v('valid')} · ` : '') + 'โน้ตภายในบริษัท = ตามข้อมูลด้านล่าง' + (q.notes ? ' · หมายเหตุเอกสาร = ตามข้อมูลด้านล่าง' : ''),
    '8. กดปุ่ม "บันทึก" เท่านั้น ให้สถานะเป็น "แบบร่าง" (ฉบับร่าง) — ห้ามกดอนุมัติ/ส่งอีเมล/ส่งให้ลูกค้า',
    '9. บอกเลขที่ใบเสนอราคา (QT-…) ที่ SME Move ออกให้ + ยอดเงินสุทธิที่หน้าจอแสดง + สิ่งที่กรอกไม่ได้ (ถ้ามี) แล้วหยุดให้ฉันตรวจ',
    '',
    'ลูกค้า:', F(q.customer),
    '',
    'เอกสาร:', F(q.doc),
    '',
    'รายการ:',
    `- สินค้า: ${l.name}`,
    `- รายละเอียดสินค้า (ทีละบรรทัด):\n${l.detail.split('\n').map(s => '    ' + s).join('\n')}`,
    `- จำนวน: ${fmt(l.qty)}`,
    `- ราคาต่อหน่วย: ${fmt(l.price)} บาท`,
    `- ยอดรวมที่ต้องได้: ${fmt(q.total)} บาท${q.vatText ? ` (${q.vatText})` : ''}`,
    q.vatText ? `- ประเภทภาษี: ${q.vatText}` : '- ประเภทภาษี: ยังไม่ได้ระบุ — ถามฉันก่อนเลือก',
    '',
    q.notes ? 'หมายเหตุเอกสาร:' : '', q.notes
  ].filter(x => x !== '').join('\n').replace(/\n(ลูกค้า:|เอกสาร:|รายการ:|หมายเหตุเอกสาร:)/g, '\n\n$1');
}
export const SME_URL_KEY = 'eqcamp.smemove.url';
export const SME_DEFAULT = 'https://app.smemove.com/';
export const fmtMoney = fmt;
