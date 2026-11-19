// NSR — ตารางคำนวณต้นทุน/ยอดขาย (ถอดแบบจาก Google Sheet ทีม "ตัวอย่างตารางคำนวนต้นทุนยอดขาย NSR")
// แหล่งความจริง: แท็บแม่แบบ "ตารางคำนวนต้นทุนยอดขาย NSR" + แท็บงานจริง 376 แท็บ (ตรวจ 130 แท็บ 18 พ.ย. 2569 — ดู docs/NSR_SPEC.md)
//
// สูตรที่ชีตใช้จริง (ต่อท่าน — ทุกบรรทัดคิดเป็นเงินต่อผู้เข้าร่วม 1 คน):
//   ค่าตอบแทนทีม (H:M)   M = ค่าตอบแทน/วัน × คน × วัน + ค่าเดินทางล่วงหน้า × คน      (=sum(J*I*K)+(L*J))
//   รวมเงินแต่ละบรรทัด     E = ราคา × จำนวน                                          (=sum(C*D))
//   รวมก่อนภาษี            Subtotal = ผลรวม E ทุกบรรทัด                              (=SUM(E4:E22))
//   ภาษี                   VAT = 7% × ราคาขาย                                         (=sum(E26*0.07))  ← 7% ของ "ราคาขาย" ไม่ใช่ของต้นทุน
//   ต้นทุนรวมสุทธิ          Total = Subtotal + VAT
//   กำไรจริง (NSR/ท่าน)     = ราคาขาย − Total                                         (=sum(E26-E25))
//   NSR %                  = กำไรจริง ÷ ราคาขาย                                       (=E27/E26)
//   ยอด NSR (ทั้งงาน)       = กำไรจริง × ผู้เข้าร่วม                                   (=E27*D3)
//   ราคาขายในใบเสนอราคา    = ราคาขาย × ผู้เข้าร่วม                                    (=sum(E26*D3))
//   เป้ากำไร 30%            = ราคาขาย × 30%                                            (=E26*30%)
// ไฟล์นี้ไม่มีตัวเลขต้นทุนจริงฝังอยู่ (เว็บสาธารณะ) — ข้อมูลงานอ่านจากชีตตอนใช้งานเท่านั้น

// ห้ามฝังรหัส/ลิงก์ชีต NSR ในโค้ด: ชีตตั้งแชร์ "ทุกคนที่มีลิงก์ดูได้" → ลิงก์ในเว็บสาธารณะ = ต้นทุนจริงรั่ว
// ลิงก์ชีตมาจาก Apps Script ตอนเชื่อมต่อ (หรือที่ทีมวางเองในหน้าตั้งค่า) แล้วเก็บในเครื่องผู้ใช้เท่านั้น
export const sheetIdFromUrl = (u: string) => (String(u || '').match(/\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})/) || [])[1] || '';
export const NSR_MASTER_TAB = 'ตารางคำนวนต้นทุนยอดขาย NSR';
export const VAT_RATE = 0.07;
export const TARGET = 0.30;

export type Num = number | null;
export interface StaffLine { role: string; rate: Num; people: Num; days: Num; advance: Num; ot?: Num; row?: number }   // ot = จำนวนคืนที่ทำล่วงเวลา
// ค่าล่วงเวลา (ช่วงกลางคืน) = 25% ของค่าตอบแทนต่อวัน ต่อคน ต่อคืนที่ค้าง — เช่น วันละ 1,000 → คืนละ 250
export const OT_RATE = 0.25;
export type LineKey = 'room' | 'mealHotel' | 'mealOut' | 'snack' | 'drink' | 'meeting' | 'equip' | 'trainer' | 'allowance' | 'trainerTravel' | 'trainerRoom'
  | 'teacher' | 'foreign' | 'vehicle' | 'visit' | 'shipping' | 'decor' | 'band' | 'shirt' | 'insurance' | 'overbill' | 'cashback' | 'other';
export interface CostLine {
  label: string; price: Num; qty: Num; key?: LineKey;
  auto?: boolean;          // ใช้สูตรแนะนำ (ค่าตามสูตร อัปเดตเองเมื่อข้อมูลเปลี่ยน)
  row?: number;            // แถวในชีต (1-based) เมื่ออ่านมาจากแท็บเดิม
  sheetTotal?: Num;        // ค่ารวมที่ชีตแสดง (ไว้ตรวจเทียบ)
  priceFormula?: string;   // สูตรเดิมของช่องราคาในชีต (ถ้ามี)
}
export type VatMode = 'rate' | 'fixed' | 'none';
export interface Layout {
  infoRow: number; lineRows: number[]; subRow: number; vatRow: number; totRow: number; priceRow: number; profitRow: number; nsrRow: number; quoteRow: number;
  staffRows: number[]; staffTotRow: number; subFormula?: string; vatFormula?: string; profitFormula?: string;
  otCol?: number;   // คอลัมน์ "คืนล่วงเวลา" ในแท็บ (1-based) — 0/ไม่มี = แท็บยังไม่มีช่องค่าล่วงเวลา
}
export interface SheetVals { subtotal: Num; vat: Num; total: Num; profit: Num; nsrTotal: Num; quote: Num; staffTotal: Num }
export interface NsrJob {
  id: string; tab?: string; sheetId?: number; index?: number;
  name: string; province: string; participants: Num; teachers: Num; note: string;
  staff: StaffLine[]; lines: CostLine[]; price: Num;
  vatMode: VatMode; vatFixed?: Num;
  layout?: Layout; sheet?: SheetVals;
  warnings: string[];      // ค่าที่อ่านไม่ได้ (ไม่เดา) / ข้อสังเกตจากการอ่าน
  updated?: string;
}

// ── บรรทัดมาตรฐาน (ตามแม่แบบ + หมายเหตุคอลัมน์ F ของทีม) ──
export const STD_LINES: { key: LineKey; label: string; hint: string }[] = [
  { key: 'room', label: 'ค่าที่พัก', hint: 'ราคาห้อง ÷ จำนวนผู้พัก เช่น คืนละ 1,200 พัก 3 คน = 400 ต่อคนต่อคืน · จำนวน = คืน' },
  { key: 'mealHotel', label: 'ค่าอาหาร มื้อโรงแรม', hint: 'คิดตามเรทจริงและจำนวนมื้อที่ทาน' },
  { key: 'mealOut', label: 'ค่าอาหาร มื้อด้านนอก (ถ้ามี)', hint: 'คิดตามเรทจริงและจำนวนมื้อที่ทาน' },
  { key: 'snack', label: 'ค่าอาหารว่าง', hint: 'คิดตามเรทจริงและจำนวนมื้อที่ทาน' },
  { key: 'meeting', label: 'ค่าห้องประชุม (ถ้ามี)', hint: 'ราคาเต็มของห้องประชุม ÷ จำนวนผู้เข้าร่วม' },
  { key: 'equip', label: 'ค่าอุปกรณ์และของรางวัล', hint: 'เบื้องต้น 5,000–10,000 บาท ÷ จำนวนผู้เข้าร่วม' },
  { key: 'trainer', label: 'ค่าวิทยากร', hint: 'รวมค่าตอบแทนทีม (ตารางวิทยากร) ÷ จำนวนผู้เข้าร่วม' },
  { key: 'allowance', label: 'ค่าเบี้ยเลี้ยง', hint: 'เบื้องต้น 25% ของค่าวิทยากร (ต่อท่าน)' },
  { key: 'trainerTravel', label: 'ค่าเดินทางวิทยากร', hint: 'เบื้องต้น 10,000 บาท ÷ จำนวนผู้เข้าร่วม' },
  { key: 'trainerRoom', label: 'ค่าที่พักวิทยากรและอาหาร', hint: '(ที่พัก + อาหาร + อาหารว่าง ต่อเด็ก 1 คน) × จำนวนทีมงาน ÷ จำนวนผู้เข้าร่วม' },
  { key: 'teacher', label: 'ค่าต้นทุนที่พักและอาหารคุณครู', hint: '(ที่พัก + อาหาร + อาหารว่าง + ค่าเข้าสถานที่ ต่อเด็ก 1 คน) × จำนวนครู ÷ จำนวนผู้เข้าร่วม' },
  { key: 'foreign', label: 'ค่าคุณครูชาวต่างชาติ (ถ้ามี)', hint: 'ค่าตอบแทนครูเจ้าของภาษา 3,000 บาท/วัน/คน × วัน ÷ จำนวนผู้เข้าร่วม · จำนวน = จำนวนครูต่างชาติ' },
  { key: 'vehicle', label: 'ค่ายานพาหนะ (เช่น รถบัส/รถตู้)', hint: 'คันละ 8,000 บาท × วันที่จัด ÷ จำนวนผู้เข้าร่วม · จำนวน = จำนวนคัน' },
  { key: 'visit', label: 'ค่าเข้าสถานที่ทัศนศึกษา', hint: 'คิดตามเรทราคาจริง' },
  { key: 'shipping', label: 'ค่าจัดส่งอุปกรณ์', hint: 'ถ้ามีค่าจัดส่ง 2,000 บาท ÷ จำนวนผู้เข้าร่วม' },
  { key: 'decor', label: 'ค่าตกแต่งสถานที่', hint: 'เรท 5,000–10,000 บาท ÷ จำนวนผู้เข้าร่วม' },
  { key: 'band', label: 'ค่าวงดนตรีพร้อมเครื่องเสียง (ถ้ามี)', hint: 'เรท 20,000–25,000 บาท ÷ จำนวนผู้เข้าร่วม' },
  { key: 'shirt', label: 'ค่าเสื้อ', hint: 'คิดตามเรทราคาจริง' },
  { key: 'insurance', label: 'ค่าประกันอุบัติเหตุ', hint: 'คิดตามเรทราคาจริง' },
];
export const DEFAULT_STAFF: StaffLine[] = [
  { role: 'Di Camp', rate: 2000, people: 1, days: null, advance: 500 },
  { role: 'ค่าวิทยากรหลัก / นำฐาน', rate: 1250, people: null, days: null, advance: 500 },
  { role: 'ค่าสต๊าฟซีเนียร์', rate: 1000, people: null, days: null, advance: 500 },
  { role: 'ค่าสต๊าฟจูเนียร์', rate: 750, people: null, days: null, advance: 375 },
  { role: 'ค่าสต๊าฟทั่วไป', rate: 500, people: null, days: null, advance: 250 },
];

const KEY_RX: [LineKey, RegExp][] = [
  ['trainerRoom', /ที่พักวิทยากร|อาหารวิทยากร/], ['teacher', /คุณครู(?!ชาวต่างชาติ)|ครูผู้ควบคุม|ต้นทุนที่พักและอาหารคุณครู/], ['foreign', /ต่างชาติ|เจ้าของภาษา/],
  ['trainerTravel', /เดินทางวิทยากร/], ['allowance', /เบี้ยเลี้ยง/], ['trainer', /^ค่าวิทยากร(?!และ)|ค่าวิทยากร$/],
  ['room', /ที่พัก/], ['snack', /อาหารว่าง|coffee|เบรก/i], ['drink', /ซอร์ฟ|ซอฟ|soft ?drink/i], ['mealOut', /มื้อด้านนอก|ข้าวกล่อง|อาหารบนรถ/], ['mealHotel', /ค่าอาหาร|มื้อ/],
  ['meeting', /ห้องประชุม/], ['equip', /อุปกรณ์และของรางวัล|ของรางวัล/], ['vehicle', /ยานพาหนะ|รถบัส|รถตู้|รถแดง|รถไฟ|รถ /], ['visit', /เข้าสถานที่|ทัศนศึกษา|ค่าเข้า/],
  ['shipping', /จัดส่ง/], ['decor', /ตกแต่ง/], ['band', /วงดนตรี|เครื่องเสียง/], ['shirt', /เสื้อ/], ['insurance', /ประกัน/], ['overbill', /โอเวอร์บิล|over ?bill/i], ['cashback', /cashback|แคชแบ็ก/i],
];
export const keyOf = (label: string): LineKey => { const s = String(label || '').trim(); for (const [k, rx] of KEY_RX) if (rx.test(s)) return k; return 'other'; };
export const hintOf = (k?: LineKey) => STD_LINES.find(l => l.key === k)?.hint || '';

// ── อ่านตัวเลข: ว่าง = 0 (เหมือนชีต) · ข้อความที่อ่านไม่ได้ = null + เตือน (ไม่เดา) ──
export function readNum(v: unknown): { n: Num; bad: boolean } {
  if (v === null || v === undefined) return { n: null, bad: false };
  if (typeof v === 'number') return Number.isFinite(v) ? { n: v, bad: false } : { n: null, bad: true };
  const s = String(v).replace(/[฿,\s]/g, '').replace(/บาท$/, '');
  if (s === '' || s === '-') return { n: null, bad: false };
  const pct = s.endsWith('%');
  const t = pct ? s.slice(0, -1) : s;
  if (!/^-?\d+(\.\d+)?$/.test(t)) return { n: null, bad: true };
  const n = parseFloat(t);
  return { n: pct ? n / 100 : n, bad: false };
}
const z = (n: Num) => (typeof n === 'number' && Number.isFinite(n) ? n : 0);

// ── คำนวณ ──
export interface LineCalc { line: CostLine; total: number; suggest: { value: number; text: string } | null; diff: boolean }
export interface Tier { id: string; label: string; approver: string; pending: boolean; tone: 'ok' | 'mid' | 'warn' | 'bad' }
export interface NsrCalc {
  staff: { line: StaffLine; pay: number }[]; staffTotal: number; staffPeople: number; campDays: number;
  lines: LineCalc[]; subtotal: number; vat: number; total: number;
  price: number | null; profit: number | null; pct: number | null; nsrTotal: number | null; quote: number | null; target: number | null; gapToTarget: number | null;
  minPrice: { m: number; price: number | null }[];
  priceBase: number; vatRate: number;   // ราคา p ให้ NSR = 1 − vatRate − priceBase / p
  tier: Tier | null; flags: string[]; missing: string[]; audit: string[];
}

// Approval Matrix ของทีม (ยืนยันแล้ว 19 พ.ย. 2569) — แก้ที่นี่ที่เดียว · ขอบล่างของแต่ละช่วงนับรวม (20% พอดี = ยืนยันเอง, 15%/10% พอดี = แพนด้า)
export const APPROVAL_MATRIX: { id: string; min: number; max: number; label: string; approver: string; pending: boolean; tone: Tier['tone'] }[] = [
  { id: 'gt20', min: 0.20, max: Infinity, label: 'NSR 20% ขึ้นไป', approver: 'ยืนยันได้เอง', pending: false, tone: 'ok' },
  { id: '15-20', min: 0.15, max: 0.20, label: 'NSR 15% ถึงต่ำกว่า 20%', approver: 'แพนด้า', pending: false, tone: 'mid' },
  { id: '10-15', min: 0.10, max: 0.15, label: 'NSR 10% ถึงต่ำกว่า 15%', approver: 'แพนด้า', pending: false, tone: 'warn' },
  { id: 'lt10', min: -Infinity, max: 0.10, label: 'NSR ต่ำกว่า 10%', approver: 'พี่นก', pending: false, tone: 'bad' },
];
// ช่วงยืนยันเองได้ต้องมียอด NSR รวมทั้งงาน (กำไรต่อท่าน × ผู้เข้าร่วม) ไม่น้อยกว่านี้ — น้อยกว่า = แจ้งแพนด้าทันที
export const SELF_MIN_TOTAL = 35000;
export const SELF_APPROVER = 'ยืนยันได้เอง', LOW_TOTAL_APPROVER = 'แพนด้า';
export const APPROVAL_RULES = [
  `ยืนยันเองได้เฉพาะ NSR 20% ขึ้นไป และยอด NSR รวมทั้งงานไม่น้อยกว่า ${SELF_MIN_TOTAL.toLocaleString('en-US')} บาท — ต่ำกว่านั้นแจ้งแพนด้าทันที`,
  'ขอบช่วงนับรวมขอบล่าง: 20% พอดี = ยืนยันเอง · 15% และ 10% พอดี = แพนด้า',
  'NSR สูงกว่า 30% ยืนยันเองได้ แต่ควรตรวจทานต้นทุนซ้ำว่าไม่ตกหล่น',
  '④ นิยาม NSR สำหรับงานเหมารวมและ VAT ยังไม่ยืนยัน',
];
export const FAST_TRACK = [
  { t: 'ตัดคอขวด', d: 'เคลียร์ทุกประเด็นที่ค้างคาให้จบในรอบเดียว' },
  { t: 'เช็ควันว่างกับโรงเรียน', d: 'ยืนยันวันว่างกับโรงเรียนโดยพริ้มเพรา' },
  { t: 'โทรหาผู้อนุมัติโดยตรง', d: 'โทรหาแพนด้า / พี่นก ไม่รอข้อความ' },
];
export function tierOf(pct: number): { tier: Tier; flags: string[] } {
  const r = Math.round(pct * 10000) / 10000; // ปัดทศนิยม 2 ตำแหน่งของ % ก่อนเทียบ
  const t = APPROVAL_MATRIX.find(m => r > m.min && r < m.max) || APPROVAL_MATRIX.find(m => r >= m.min && r < m.max) || APPROVAL_MATRIX[APPROVAL_MATRIX.length - 1];
  const flags: string[] = [];
  if (r > 0.30) flags.push(APPROVAL_RULES[2]);
  return { tier: { id: t.id, label: t.label, approver: t.approver, pending: t.pending || !t.approver, tone: t.tone }, flags: [...new Set(flags)] };
}

const perHead = (lines: CostLine[], keys: LineKey[]) => lines.filter(l => keys.includes((l.key || keyOf(l.label)))).reduce((s, l) => s + z(l.price) * z(l.qty), 0);

// สูตรแนะนำต่อบรรทัด (ตามหมายเหตุทีม) — คืน null ถ้าข้อมูลไม่พอ (ไม่เดา)
export function suggestFor(job: NsrJob, l: CostLine, staffTotal: number, staffPeople: number, campDays: number): { value: number; text: string } | null {
  const n = z(job.participants); if (n <= 0) return null;
  const k = l.key || keyOf(l.label);
  const f0 = (v: number) => v; // ไม่ปัด — เหมือนสูตรในชีต (แสดงผลค่อยปัด)
  if (k === 'trainer') return staffTotal > 0 ? { value: f0(staffTotal / n), text: `${fmt(staffTotal)} ÷ ${n} คน` } : null;
  if (k === 'allowance') { const t = job.lines.find(x => (x.key || keyOf(x.label)) === 'trainer'); return t && z(t.price) > 0 ? { value: f0(z(t.price) * 0.25), text: `ค่าวิทยากร ${fmt(z(t.price))} × 25%` } : null; }
  if (k === 'trainerTravel') return { value: f0(10000 / n), text: `10,000 ÷ ${n} คน` };
  if (k === 'shipping') return { value: f0(2000 / n), text: `2,000 ÷ ${n} คน` };
  if (k === 'trainerRoom') { const b = perHead(job.lines, ['room', 'mealHotel', 'mealOut', 'snack']); return b > 0 && staffPeople > 0 ? { value: f0(b * staffPeople / n), text: `${fmt(b)} × ทีมงาน ${staffPeople} คน ÷ ${n} คน` } : null; }
  if (k === 'teacher') { const b = perHead(job.lines, ['room', 'mealHotel', 'mealOut', 'snack', 'visit']); const t = z(job.teachers); return b > 0 && t > 0 ? { value: f0(b * t / n), text: `${fmt(b)} × ครู ${t} คน ÷ ${n} คน` } : null; }
  if (k === 'foreign') return campDays > 0 ? { value: f0(3000 * campDays / n), text: `3,000 × ${campDays} วัน ÷ ${n} คน (ต่อครู 1 คน)` } : null;
  if (k === 'vehicle') return campDays > 0 ? { value: f0(8000 * campDays / n), text: `8,000 × ${campDays} วัน ÷ ${n} คน (ต่อรถ 1 คัน)` } : null;
  return null;
}
// บรรทัดที่ใช้สูตรแนะนำ → ค่าใหม่ทุกครั้งที่ข้อมูลเปลี่ยน (เรียงลำดับให้ค่าวิทยากรมาก่อนเบี้ยเลี้ยง)
export function applyAuto(job: NsrJob): NsrJob {
  if (!job.lines.some(l => l.auto)) return job;
  const st = staffSum(job.staff); const lines = job.lines.map(l => ({ ...l }));
  const order: LineKey[] = ['trainer', 'allowance', 'trainerTravel', 'shipping', 'foreign', 'vehicle', 'trainerRoom', 'teacher'];
  for (const k of order) for (const l of lines) if (l.auto && (l.key || keyOf(l.label)) === k) {
    const s = suggestFor({ ...job, lines }, l, st.total, st.people, st.days);
    if (s) { l.price = s.value; if (l.qty == null) l.qty = 1; }
  }
  return { ...job, lines };
}
export const staffOT = (s: StaffLine) => z(s.rate) * OT_RATE * z(s.people) * z(s.ot ?? null);
export const staffPay = (s: StaffLine) => z(s.rate) * z(s.people) * z(s.days) + z(s.advance) * z(s.people) + staffOT(s);
export function staffSum(staff: StaffLine[]) {
  return { total: staff.reduce((a, s) => a + staffPay(s), 0), people: staff.reduce((a, s) => a + z(s.people), 0), days: Math.max(0, ...staff.map(s => z(s.days))), ot: staff.reduce((a, s) => a + staffOT(s), 0) };
}

// ราคาต่อท่านต่ำสุด (บาทเต็ม) ที่ NSR ≥ m เมื่อปัดเป็น 2 ตำแหน่งของ % แบบ tierOf/ชีต — base = รวมก่อนภาษี (+ ภาษีคงที่), vr = อัตราภาษีของราคา
export function priceForNsr(base: number, vr: number, m: number): number | null {
  const d = 1 - vr - m; if (!(d > 0) || !(base > 0)) return d > 0 ? 0 : null;
  const pr = (p: number) => Math.round((1 - vr - base / p) * 10000) / 10000;
  let p = Math.ceil(base / d); while (p > 1 && pr(p - 1) >= m) p--; while (pr(p) < m) p++;
  return p;
}
export function computeNsr(job0: NsrJob): NsrCalc {
  const job = applyAuto(job0);
  const st = staffSum(job.staff);
  const missing: string[] = [];
  if (!(z(job.participants) > 0)) missing.push('จำนวนผู้เข้าร่วม');
  if (!(z(job.price) > 0)) missing.push('ราคาขาย / ท่าน');
  const lines: LineCalc[] = job.lines.map(l => {
    const total = z(l.price) * z(l.qty);
    const suggest = suggestFor(job, l, st.total, st.people, st.days);
    return { line: l, total, suggest, diff: !!suggest && !l.auto && Math.abs(suggest.value - z(l.price)) > 1 && z(l.price) > 0 };
  });
  const subtotal = lines.reduce((s, l) => s + l.total, 0);
  for (const l of job.lines) if (z(l.price) !== 0 && l.qty == null) missing.push(`จำนวนของ "${l.label}" (มีราคาแต่ไม่มีจำนวน = คิด 0 เหมือนชีต)`);
  const price = z(job.price) > 0 ? z(job.price) : null;
  const vat = job.vatMode === 'none' ? 0 : job.vatMode === 'fixed' ? z(job.vatFixed ?? null) : price != null ? price * VAT_RATE : 0;
  const total = subtotal + vat;
  const profit = price != null ? price - total : null;
  const pct = price != null && profit != null ? profit / price : null;
  const n = z(job.participants) > 0 ? z(job.participants) : null;
  const vr = job.vatMode === 'rate' ? VAT_RATE : 0, fixedVat = job.vatMode === 'fixed' ? z(job.vatFixed ?? null) : 0;
  const minPrice = [0.10, 0.15, 0.20, 0.30].map(m => ({ m, price: priceForNsr(subtotal + fixedVat, vr, m) }));
  const t = pct != null ? tierOf(pct) : null;
  const flags = t ? [...t.flags] : [];
  if (pct != null && job.vatMode !== 'rate') flags.push(APPROVAL_RULES[3]);
  let tier = t ? t.tier : null;
  const nsrTot = profit != null && n != null ? profit * n : null;
  if (tier && tier.id === 'gt20' && nsrTot != null && nsrTot < SELF_MIN_TOTAL) {   // NSR ถึงเกณฑ์แต่ยอดรวมน้อย → ไม่ยืนยันเอง
    tier = { ...tier, approver: LOW_TOTAL_APPROVER, tone: 'warn', label: `${tier.label} แต่ยอด NSR รวม ${fmt(nsrTot)} บาท ต่ำกว่า ${fmt(SELF_MIN_TOTAL)}` };
    flags.push(`ยอด NSR รวมทั้งงาน ${fmt(nsrTot)} บาท ต่ำกว่า ${fmt(SELF_MIN_TOTAL)} — แจ้งแพนด้าทันที`);
  }
  // ตรวจเทียบกับค่าที่ชีตแสดง (แท็บเดิม) — หาสูตรรวมที่ไม่ครบแถว
  const audit: string[] = [];
  if (job.sheet && job.layout) {
    const near = (a: Num, b: number) => a == null || Math.abs(a - b) <= 1;
    if (!near(job.sheet.subtotal, subtotal)) {
      const rng = (job.layout.subFormula || '').match(/E(\d+):E(\d+)/i);
      const out = rng ? job.lines.filter(l => l.row && (l.row < +rng[1] || l.row > +rng[2]) && z(l.price) * z(l.qty) !== 0) : [];
      audit.push(`ชีตรวมก่อนภาษี ${fmt(z(job.sheet.subtotal))} แต่รวมทุกบรรทัดได้ ${fmt(subtotal)}` + (rng ? ` — สูตร ${job.layout.subFormula} ไม่รวมแถว ${out.map(l => l.row).join(', ') || 'บางแถว'}` : ''));
    }
    for (const l of job.lines) if (l.sheetTotal != null && Math.abs(l.sheetTotal - z(l.price) * z(l.qty)) > 1) audit.push(`แถว ${l.row} "${l.label}" ชีตแสดง ${fmt(l.sheetTotal)} แต่ ราคา × จำนวน = ${fmt(z(l.price) * z(l.qty))} (ช่องรวมไม่ได้ใช้สูตร)`);
    if (job.sheet.staffTotal != null && Math.abs(job.sheet.staffTotal - st.total) > 1) audit.push(`ตารางวิทยากรในชีตรวม ${fmt(job.sheet.staffTotal)} แต่คำนวณได้ ${fmt(st.total)} (สูตรค่าเดินทางล่วงหน้าบางแถวไม่คูณจำนวนคน)`);
    const pfF = job.layout.profitFormula || '';
    if (pfF && /30\s*%|\*\s*0?\.3\b/.test(pfF)) audit.push(`ช่อง "กำไรจริง" ในชีตใช้สูตร ${pfF} = เป้า 30% ไม่ใช่กำไรจริง — NSR จริงคือ ${pctText(pct)}`);
    if (job.vatMode === 'fixed') audit.push('ภาษีในชีตเป็นตัวเลขพิมพ์เอง ไม่ใช่ 7% ของราคาขาย');
  }
  return {
    staff: job.staff.map(s => ({ line: s, pay: staffPay(s) })), staffTotal: st.total, staffPeople: st.people, campDays: st.days,
    lines, subtotal, vat, total, price, profit, pct,
    nsrTotal: profit != null && n != null ? profit * n : null, quote: price != null && n != null ? price * n : null,
    target: price != null ? price * TARGET : null, gapToTarget: price != null && profit != null ? profit - price * TARGET : null,
    minPrice, priceBase: subtotal + fixedVat, vatRate: vr, tier, flags, missing, audit
  };
}

export const fmt = (n: number, d = 0) => (Number.isFinite(n) ? n.toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d }) : '–');
export const pctText = (p: number | null) => (p == null ? '–' : (Math.round(p * 10000) / 100).toFixed(2) + '%');

// ── อ่านแท็บงาน (ตารางค่า formatted + สูตร) → NsrJob (ค้นจากป้ายคำ ไม่ยึดเลขแถว — แท็บจริงเลื่อนแถวกันได้ 0–2 แถว) ──
export type Grid = { v: string; f?: string }[][];
export function parseNsrTab(title: string, grid: Grid, sheetId?: number, index?: number): NsrJob | null {
  const cell = (r: number, c: number) => (grid[r] && grid[r][c]) || { v: '' };
  const txt = (r: number, c: number) => String(cell(r, c).v ?? '').trim();
  const find = (c: number, rx: RegExp, from = 0) => { for (let r = from; r < grid.length; r++) if (rx.test(txt(r, c))) return r; return -1; };
  const warnings: string[] = [];
  const num = (r: number, c: number, what: string): Num => {
    if (r < 0) return null;
    const { n, bad } = readNum(cell(r, c).v);
    if (bad) warnings.push(`${what} (แถว ${r + 1}) อ่านไม่ได้: "${txt(r, c)}"`);
    return n;
  };
  const head = find(1, /ชื่องานที่จัด/); const lineHead = find(0, /รายการคำนวณต้นทุน/);
  const subR = find(0, /รวมต้นทุนก่อนภาษี/);
  if (head < 0 || lineHead < 0 || subR < 0) return null;
  const info = head + 1;
  const lines: CostLine[] = []; const lineRows: number[] = [];
  for (let r = lineHead + 1; r < subR; r++) {
    const label = txt(r, 1); const p = num(r, 2, `ราคา "${label}"`), q = num(r, 3, `จำนวน "${label}"`);
    if (!label && p == null && q == null) continue;
    const tot = readNum(cell(r, 4).v).n;
    lines.push({ label: label || '(ไม่มีชื่อรายการ)', price: p, qty: q, key: keyOf(label), row: r + 1, sheetTotal: cell(r, 4).f ? null : tot, priceFormula: cell(r, 2).f || undefined });
    lineRows.push(r + 1);
  }
  const vatR = find(1, /ค่าภาษี/, subR), totR = find(1, /ต้นทุนรวมสุทธิ/, subR), priceR = find(1, /ราคาขาย\s*\(Selling/i, subR);
  const profitR = find(1, /กำไรคาดการณ์/, subR), nsrR = find(1, /ยอด\s*NSR/i, subR), quoteR = find(1, /ราคาขาย\s*ในใบเสนอราคา/, subR);
  // ตารางค่าตอบแทนทีม (คอลัมน์ H:M)
  const staff: StaffLine[] = []; const staffRows: number[] = [];
  const sh = find(7, /^ประเภท$/);
  let staffTotR = -1, otC = -1;
  if (sh >= 0) for (let c = 13; c < 18; c++) if (/คืน.*ล่วงเวลา|ล่วงเวลา.*คืน/.test(txt(sh, c)) && !/^ค่า/.test(txt(sh, c))) { otC = c; break; }
  if (sh >= 0) for (let r = sh + 1; r < Math.min(grid.length, sh + 12); r++) {
    const role = txt(r, 7); if (!role) continue;
    if (/^รวม/.test(role)) { staffTotR = r; break; }
    staff.push({ role, rate: num(r, 8, `ค่าตอบแทน ${role}`), people: num(r, 9, `จำนวนคน ${role}`), days: num(r, 10, `จำนวนวัน ${role}`), advance: num(r, 11, `ค่าเดินทางล่วงหน้า ${role}`), ot: otC >= 0 ? num(r, otC, `คืนล่วงเวลา ${role}`) : null, row: r + 1 });
    staffRows.push(r + 1);
  }
  const vatF = vatR >= 0 ? cell(vatR, 4).f || '' : '';
  const vatVal = num(vatR, 4, 'ค่าภาษี');
  const vatMode: VatMode = /\*\s*0?\.07/.test(vatF) ? 'rate' : vatF ? 'rate' : vatVal ? 'fixed' : 'none';
  if (vatF && !/\*\s*0?\.07/.test(vatF)) warnings.push(`สูตรภาษีในชีตไม่ใช่ 7% ของราคาขาย: ${vatF}`);
  const participants = num(info, 3, 'จำนวนผู้เข้าร่วม');
  if (participants == null) warnings.push('ไม่พบจำนวนผู้เข้าร่วมในแท็บ');
  const price = num(priceR, 4, 'ราคาขาย');
  if (priceR < 0) warnings.push('ไม่พบแถวราคาขาย');
  return {
    id: 'tab:' + (sheetId ?? title), tab: title, sheetId, index,
    name: txt(info, 1), province: txt(info, 2), participants, teachers: num(info, 4, 'จำนวนคุณครู'), note: txt(info, 5),
    staff, lines, price, vatMode, vatFixed: vatMode === 'fixed' ? vatVal : null,
    layout: { infoRow: info + 1, lineRows, subRow: subR + 1, vatRow: vatR + 1, totRow: totR + 1, priceRow: priceR + 1, profitRow: profitR + 1, nsrRow: nsrR + 1, quoteRow: quoteR + 1, staffRows, staffTotRow: staffTotR + 1, otCol: otC >= 0 ? otC + 1 : 0, subFormula: cell(subR, 4).f || '', vatFormula: vatF, profitFormula: profitR >= 0 ? cell(profitR, 4).f || '' : '' },
    sheet: { subtotal: num(subR, 4, 'รวมก่อนภาษี'), vat: vatVal, total: num(totR, 4, 'ต้นทุนรวม'), profit: profitR >= 0 && /กำไรจริง/.test(txt(profitR, 3)) ? num(profitR, 4, 'กำไรจริง') : null, nsrTotal: num(nsrR, 4, 'ยอด NSR'), quote: num(quoteR, 4, 'ราคาในใบเสนอราคา'), staffTotal: staffTotR >= 0 ? num(staffTotR, 12, 'รวมค่าตอบแทนทีม') : null },
    warnings
  };
}

// สรุปย่อสำหรับรายการค้นหา (คำนวณจากบรรทัดจริง ไม่ใช่ค่าที่ชีตแสดง)
export interface NsrIndexRow { id: string; tab: string; sheetId?: number; index?: number; name: string; province: string; participants: Num; price: Num; subtotal: number; pct: number | null; nsrTotal: number | null; tier: string; audit: number; copy: boolean; warn: number }
export function indexRow(j: NsrJob): NsrIndexRow {
  const c = computeNsr(j);
  return { id: j.id, tab: j.tab || '', sheetId: j.sheetId, index: j.index, name: j.name, province: j.province, participants: j.participants, price: j.price, subtotal: c.subtotal, pct: c.pct, nsrTotal: c.nsrTotal, tier: c.tier?.id || '', audit: c.audit.length, copy: /^copy of|สำเนา/i.test(j.tab || ''), warn: j.warnings.length };
}

// ── งานใหม่ ──
export function newJob(): NsrJob {
  return {
    id: 'new:' + Date.now().toString(36), name: '', province: '', participants: null, teachers: null, note: '',
    staff: DEFAULT_STAFF.map(s => ({ ...s })),
    lines: STD_LINES.map(l => ({ label: l.label, price: null, qty: ['trainer', 'allowance', 'trainerTravel', 'trainerRoom', 'teacher', 'equip', 'shipping', 'meeting', 'decor', 'band', 'shirt', 'insurance', 'visit'].includes(l.key) ? 1 : null, key: l.key, auto: ['trainer', 'allowance'].includes(l.key) })),
    price: null, vatMode: 'rate', warnings: []
  };
}

// ── เขียนลงชีต ──
// แท็บใหม่: โครงเดียวกับแท็บงานจริงของทีม + สูตรเดิมทุกช่อง (ช่วงรวมครอบคลุมทุกบรรทัด)
export type CellOut = string | number | { f: string };
// หัวคอลัมน์/สูตรค่าล่วงเวลาในแท็บ (คอลัมน์ N, O) — ใช้ร่วมกับสคริปต์ที่เติมช่องให้แท็บเดิม
export const OT_HEAD_N = 'คืนล่วงเวลา', OT_HEAD_O = 'ค่าล่วงเวลา (25%/คืน)';
export const OT_FORMULA = (r: number) => `=I${r}*25%*J${r}*N${r}`;
export function jobToGrid(job0: NsrJob, stamp: string): CellOut[][] {
  const job = applyAuto(job0);
  const L = job.lines; const S = job.staff;
  const first = 5, last = first + L.length - 1;
  const sub = last + 1, vat = sub + 1, tot = vat + 1, pr = tot + 1, pf = pr + 1, ns = pf + 1, qu = ns + 1;
  const staffTot = 3 + S.length;
  const rows: CellOut[][] = [];
  const put = (r: number, c: number, v: CellOut) => { while (rows.length < r) rows.push([]); const row = rows[r - 1]; while (row.length < c) row.push(''); row[c - 1] = v; };
  const n = (v: Num): CellOut => (v == null ? '' : v);
  put(1, 1, 'ตัวอย่างตารางคำนวนต้นทุนยอดขาย NSR'); put(1, 8, 'การคำนวนการคิดค่าตอบแทนวิทยากร');
  ['ข้อมูล', 'ชื่องานที่จัด', 'จังหวัดที่จัด', 'จำนวนผู้เข้าร่วม', 'จำนวนคุณครู', 'หมายเหตุ'].forEach((t, i) => put(2, i + 1, t));
  ['ประเภท', 'ค่าตอบแทนต่อวัน', 'จำนวนคน', 'จำนวนวัน', 'ค่าเดินทางล่วงหน้า', 'ค่าตอบแทนที่จะต้องจ่าย', OT_HEAD_N, OT_HEAD_O].forEach((t, i) => put(2, i + 8, t));
  put(3, 1, 'รายละเอียดงาน'); put(3, 2, job.name || ''); put(3, 3, job.province || ''); put(3, 4, n(job.participants)); put(3, 5, n(job.teachers)); put(3, 6, job.note || '');
  ['รายการคำนวณต้นทุน', 'ลำดับ', 'ราคา (คืน/มื้อ/คน/อื่นๆ)', 'จำนวน (คืน/มื้อ/คน/อื่นๆ)', 'รวมเงิน (บาท)'].forEach((t, i) => put(4, i + 1, t));
  S.forEach((s, i) => { const r = 3 + i; put(r, 8, s.role); put(r, 9, n(s.rate)); put(r, 10, n(s.people)); put(r, 11, n(s.days)); put(r, 12, n(s.advance)); put(r, 14, z(s.ot ?? null)); put(r, 15, { f: OT_FORMULA(r) }); put(r, 13, { f: `=sum(J${r}*I${r}*K${r})+(L${r}*J${r})+O${r}` }); });
  put(staffTot, 8, 'รวม'); put(staffTot, 10, { f: `=SUM(J3:J${staffTot - 1})` }); put(staffTot, 13, { f: `=SUM(M3:M${staffTot - 1})` }); put(staffTot, 15, { f: `=SUM(O3:O${staffTot - 1})` });
  const rowOf = (k: LineKey) => { const i = L.findIndex(l => (l.key || keyOf(l.label)) === k); return i < 0 ? 0 : first + i; };
  const sumRows = (ks: LineKey[]) => L.map((l, i) => (ks.includes(l.key || keyOf(l.label)) ? `E${first + i}` : '')).filter(Boolean);
  L.forEach((l, i) => {
    const r = first + i; const k = l.key || keyOf(l.label);
    put(r, 1, i + 1); put(r, 2, l.label);
    let pf2: CellOut = n(l.price);
    if (l.auto) {
      const tr = rowOf('trainer');
      if (k === 'trainer') pf2 = { f: `=M${staffTot}/D3` };
      else if (k === 'allowance' && tr) pf2 = { f: `=C${tr}*0.25` };
      else if (k === 'trainerTravel') pf2 = { f: '=10000/D3' };
      else if (k === 'shipping') pf2 = { f: '=2000/D3' };
      else if (k === 'trainerRoom') { const s = sumRows(['room', 'mealHotel', 'mealOut', 'snack']); if (s.length) pf2 = { f: `=(${s.join('+')})*J${staffTot}/D3` }; }
      else if (k === 'teacher') { const s = sumRows(['room', 'mealHotel', 'mealOut', 'snack', 'visit']); if (s.length) pf2 = { f: `=(${s.join('+')})*E3/D3` }; }
      else if (k === 'foreign') pf2 = { f: `=3000*MAX(K3:K${staffTot - 1})/D3` };
      else if (k === 'vehicle') pf2 = { f: `=8000*MAX(K3:K${staffTot - 1})/D3` };
    }
    put(r, 3, pf2); put(r, 4, n(l.qty)); put(r, 5, { f: `=sum(C${r}*D${r})` }); const h = hintOf(k); if (h) put(r, 6, h);
  });
  let no = L.length;
  put(sub, 1, 'รวมต้นทุนก่อนภาษี (Subtotal)'); put(sub, 5, { f: `=SUM(E${first}:E${last})` });
  put(vat, 1, ++no); put(vat, 2, 'ค่าภาษี (เช่น VAT 7%)'); put(vat, 5, job.vatMode === 'rate' ? { f: `=sum(E${pr}*0.07)` } : job.vatMode === 'fixed' ? n(job.vatFixed ?? null) : 0);
  put(tot, 1, ++no); put(tot, 2, 'ต้นทุนรวมสุทธิ (Total Cost)'); put(tot, 5, { f: `=E${vat}+E${sub}` });
  put(pr, 1, ++no); put(pr, 2, 'ราคาขาย (Selling Price)'); put(pr, 4, '(กรอกราคาขายที่คุณต้องการ)'); put(pr, 5, n(job.price));
  put(pf, 1, ++no); put(pf, 2, 'กำไรคาดการณ์ (30% ของราคาขาย) NSR'); put(pf, 3, { f: `=E${pr}*30%` }); put(pf, 4, 'กำไรจริง'); put(pf, 5, { f: `=sum(E${pr}-E${tot})` });
  put(ns, 1, ++no); put(ns, 2, 'ยอด NSR +- 10%'); put(ns, 3, { f: `=IFERROR(E${pf}/E${pr},0)` }); put(ns, 5, { f: `=E${pf}*D3` });
  put(qu, 1, ++no); put(qu, 2, 'ราคาขาย ในใบเสนอราคา'); put(qu, 5, { f: `=sum(E${pr}*D3)` });
  put(qu + 2, 1, `บันทึกจากเว็บ EQ Camp ${stamp}`);
  const w = Math.max(...rows.map(r => r.length)); rows.forEach(r => { while (r.length < w) r.push(''); });
  return rows;
}
export const gridMeta = (job: NsrJob) => { const first = 5, last = first + job.lines.length - 1; const sub = last + 1; return { first, last, sub, vat: sub + 1, tot: sub + 2, price: sub + 3, profit: sub + 4, nsr: sub + 5, quote: sub + 6, staffTot: 3 + job.staff.length }; };

// แท็บเดิม: แก้เฉพาะช่องค่าที่ผู้ใช้เปลี่ยน (ไม่แทรก/ลบแถว ไม่ทับสูตรที่ไม่ได้แตะ) — โครงบรรทัดต้องเท่าเดิม
export interface CellEdit { r: number; c: number; v: string | number; was: string }
export function diffForTab(orig: NsrJob, cur0: NsrJob): { ok: true; edits: CellEdit[] } | { ok: false; reason: string } {
  const cur = applyAuto(cur0);
  const L = orig.layout; if (!L) return { ok: false, reason: 'ไม่มีข้อมูลตำแหน่งแถวของแท็บเดิม' };
  if (cur.lines.length !== orig.lines.length || cur.lines.some((l, i) => l.row !== orig.lines[i].row)) return { ok: false, reason: 'เพิ่ม/ลบ/สลับบรรทัด — บันทึกเป็นแท็บใหม่แทน (ไม่แทรกแถวในแท็บเดิม กันสูตรเดิมเพี้ยน)' };
  if (cur.staff.length !== orig.staff.length) return { ok: false, reason: 'เปลี่ยนจำนวนแถวตารางวิทยากร — บันทึกเป็นแท็บใหม่แทน' };
  if (cur.vatMode !== orig.vatMode) return { ok: false, reason: 'เปลี่ยนวิธีคิดภาษี — บันทึกเป็นแท็บใหม่แทน' };
  const edits: CellEdit[] = [];
  const same = (a: Num, b: Num) => (a ?? null) === (b ?? null) || (a != null && b != null && Math.abs(a - b) < 1e-9);
  const add = (r: number, c: number, a: Num | string, b: Num | string) => {
    if (typeof a === 'string' || typeof b === 'string') { if (String(a ?? '') !== String(b ?? '')) edits.push({ r, c, v: String(a ?? ''), was: String(b ?? '') }); return; }
    if (!same(a, b)) edits.push({ r, c, v: a == null ? '' : a, was: b == null ? '' : String(b) });
  };
  const ir = L.infoRow;
  add(ir, 2, cur.name, orig.name); add(ir, 3, cur.province, orig.province); add(ir, 4, cur.participants, orig.participants); add(ir, 5, cur.teachers, orig.teachers);
  cur.lines.forEach((l, i) => { const o = orig.lines[i]; add(o.row!, 2, l.label, o.label); add(o.row!, 3, l.price, o.price); add(o.row!, 4, l.qty, o.qty); });
  cur.staff.forEach((s, i) => { const o = orig.staff[i]; const r = o.row!; add(r, 8, s.role, o.role); add(r, 9, s.rate, o.rate); add(r, 10, s.people, o.people); add(r, 11, s.days, o.days); add(r, 12, s.advance, o.advance); if (L.otCol) add(r, L.otCol, s.ot ?? null, o.ot ?? null); });
  if (!L.otCol && cur.staff.some((s, i) => z(s.ot ?? null) !== z(orig.staff[i].ot ?? null))) return { ok: false, reason: 'แท็บนี้ยังไม่มีช่องค่าล่วงเวลา — บันทึกเป็นแท็บใหม่แทน' };
  if (L.priceRow > 0) add(L.priceRow, 5, cur.price, orig.price);
  if (cur.vatMode === 'fixed' && L.vatRow > 0) add(L.vatRow, 5, cur.vatFixed ?? null, orig.vatFixed ?? null);
  return { ok: true, edits };
}
export const colA1 = (c: number) => { let s = ''; while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; };
export const quoteTab = (t: string) => `'${t.replace(/'/g, "''")}'`;
// ชื่อแท็บตามแบบทีม "<หลักสูตร>@<โรงเรียน>" — ตัดอักขระที่ชีตห้าม และไม่ซ้ำแท็บเดิม
export function tabNameFor(job: NsrJob, existing: string[], prefix = ''): string {
  const base = (prefix + (job.name || 'งานใหม่')).replace(/[\[\]\*\?\/\\:]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90) || 'งานใหม่';
  const has = new Set(existing.map(s => s.trim()));
  if (!has.has(base)) return base;
  for (let i = 2; i < 999; i++) { const t = `${base} (${i})`; if (!has.has(t)) return t; }
  return base + ' ' + Date.now();
}

// ── เส้นราคาที่ต้องขออนุมัติ (จาก Approval Matrix) — ราคาต่อท่านต่ำกว่าเส้น = NSR ต่ำกว่าช่วงนั้น ──
// ใช้ priceForNsr เดียวกับ "ราคาขายขั้นต่ำ" — ราคาต่ำสุด (บาทเต็ม) ที่ NSR ปัด 2 ตำแหน่งแบบชีตยัง ≥ ขอบช่วง
export interface ApprovalLine { m: number; below: number | null; belowTotal: number | null; tierId: string; label: string; approver: string; pending: boolean }
export function approvalLines(calc: NsrCalc, participants: Num): ApprovalLine[] {
  const n = z(participants) > 0 ? z(participants) : null;
  return APPROVAL_MATRIX.filter(t => Number.isFinite(t.max)).map(t => {
    // ราคาต่ำสุดที่ NSR (ปัด 2 ตำแหน่งแบบ tierOf/ชีต) ยัง ≥ ขอบช่วง → ต่ำกว่านี้ตกไปช่วง t
    const below = priceForNsr(calc.priceBase, calc.vatRate, t.max);
    return { m: t.max, below, belowTotal: below != null && n ? below * n : null, tierId: t.id, label: t.label, approver: t.approver, pending: t.pending || !t.approver };
  });
}
// ราคาต่อท่านต่ำสุด (บาทเต็ม) ที่ยอด NSR รวม (กำไรต่อท่าน × ผู้เข้าร่วม) ≥ total
export function priceForTotal(base: number, vr: number, n: number, total: number): number | null {
  if (!(n > 0) || !(1 - vr > 0)) return null;
  const nsr = (p: number) => (p * (1 - vr) - base) * n;
  let p = Math.max(0, Math.ceil((base + total / n) / (1 - vr))); while (p > 0 && nsr(p - 1) >= total) p--; while (nsr(p) < total) p++;
  return p;
}
// เส้นที่ต้องแจ้ง/ขออนุมัติ (สำหรับแสดง): ผู้อนุมัติเดียวกันติดกันรวมเป็นเส้นเดียว + เส้นยอด NSR รวม 35,000
export interface ApprovalStep { key: string; below: number; belowTotal: number | null; approver: string; why: string }
export function approvalSteps(calc: NsrCalc, participants: Num): ApprovalStep[] {
  const n = z(participants) > 0 ? z(participants) : null;
  const ls = approvalLines(calc, participants).filter(l => !l.pending && l.below != null);   // เรียงจากเส้นสูงไปต่ำ
  const out: ApprovalStep[] = [];
  ls.forEach((l, i) => { if (i > 0 && ls[i - 1].approver === l.approver) return; out.push({ key: l.tierId, below: l.below as number, belowTotal: l.belowTotal, approver: l.approver, why: `NSR ต่ำกว่า ${Math.round(l.m * 100)}%` }); });
  if (n) { const p = priceForTotal(calc.priceBase, calc.vatRate, n, SELF_MIN_TOTAL); if (p != null && (!out.length || p > out[0].below)) out.unshift({ key: 'total', below: p, belowTotal: p * n, approver: LOW_TOTAL_APPROVER, why: `ยอด NSR รวมต่ำกว่า ${fmt(SELF_MIN_TOTAL)} บาท (แจ้งทันที)` }); }
  return out.sort((a, b) => b.below - a.below);
}
// ตำแหน่งราคาปัจจุบันเทียบเส้น — need = ราคาต่ำกว่าเส้นใดเส้นหนึ่ง · approver = เส้นต่ำสุดที่ราคาตกลงไป · room = ราคา − เส้นบนสุด
export function approvalNeed(calc: NsrCalc, participants: Num): { need: boolean; approver: string; step: ApprovalStep | null; room: number | null } {
  const steps = approvalSteps(calc, participants); const top = steps[0] || null; const p = calc.price;
  if (!top || p == null) return { need: false, approver: '', step: top, room: null };
  const hit = [...steps].reverse().find(s => p < s.below) || null;
  return { need: !!hit, approver: hit ? hit.approver : '', step: hit || top, room: p - top.below };
}

// ── สถานะการขายต่อแท็บ (เก็บในศูนย์กลางทีม ไม่แตะชีต NSR) ──
export type SaleStatusId = 'quoted' | 'hold' | 'won' | 'lost';
export const SALE_STATUS: { id: SaleStatusId; label: string; short: string; tone: 'ok' | 'mid' | 'warn' | 'bad' | 'mute'; hint: string }[] = [
  { id: 'quoted', label: 'เสนอราคาแล้ว', short: 'เสนอแล้ว', tone: 'mid', hint: 'ส่งใบเสนอราคา/โปรแกรมให้โรงเรียนแล้ว รอคำตอบ' },
  { id: 'hold', label: 'รอตัดสินใจ / เลื่อน', short: 'รอตัดสินใจ', tone: 'warn', hint: 'โรงเรียนขอเวลา เลื่อนวัน หรือรออนุมัติงบ' },
  { id: 'won', label: 'ปิดการขายแล้ว', short: 'ปิดการขาย', tone: 'ok', hint: 'โรงเรียนยืนยันจัดกับเรา' },
  { id: 'lost', label: 'ไม่ได้งาน', short: 'ไม่ได้งาน', tone: 'bad', hint: 'โรงเรียนไม่จัด หรือเลือกผู้จัดรายอื่น' },
];
export const LOST_REASONS = ['ราคาสูงกว่างบโรงเรียน', 'เลือกผู้จัดรายอื่น', 'โรงเรียนไม่จัดค่ายแล้ว', 'วันไม่ตรง / ที่พักไม่ว่าง', 'เลือกแบบอื่นของงานเดียวกัน', 'ติดต่อโรงเรียนไม่ได้'];
export const FOLLOW_DAYS = 14;   // เสนอแล้วเกินกี่วันโดยไม่มีวันนัดตาม = ต้องตาม
export interface SaleStatus { sheetId: number; title: string; name?: string; status: SaleStatusId; reason?: string; note?: string; finalPrice?: Num; finalPax?: Num; followUp?: string; pct?: Num; price?: Num; participants?: Num; by?: string; at?: string }
const numOrNull = (v: unknown): Num => { const r = readNum(v); return r.n; };
export function normStatus(o: any): SaleStatus | null {
  const id = Number(o?.sheetId); if (!Number.isFinite(id) || !SALE_STATUS.some(s => s.id === o?.status)) return null;
  return { sheetId: id, title: String(o.title || ''), name: String(o.name || ''), status: o.status, reason: String(o.reason || ''), note: String(o.note || ''), finalPrice: numOrNull(o.finalPrice), finalPax: numOrNull(o.finalPax), followUp: String(o.followUp || '').slice(0, 10), pct: numOrNull(o.pct), price: numOrNull(o.price), participants: numOrNull(o.participants), by: String(o.by || ''), at: String(o.at || '') };
}
export const saleValue = (s: SaleStatus, row?: { price: Num; participants: Num }) => z(s.finalPrice ?? s.price ?? row?.price ?? null) * z(s.finalPax ?? s.participants ?? row?.participants ?? null);
export function needsFollow(s: SaleStatus, today = new Date()): boolean {
  if (s.status !== 'quoted' && s.status !== 'hold') return false;
  const d0 = today.toISOString().slice(0, 10);
  if (s.followUp) return s.followUp <= d0;
  const at = Date.parse(s.at || ''); return Number.isFinite(at) && (today.getTime() - at) / 86400000 > FOLLOW_DAYS;
}
export interface SalesSummary { total: number; none: number; by: Record<SaleStatusId, number>; wonValue: number; openValue: number; winRate: number | null; follow: number; reasons: [string, number][]; wonPct: number | null; lostPct: number | null }
export function salesSummary(rows: { sheetId?: number; price: Num; participants: Num; pct: number | null }[], st: Map<number, SaleStatus>, today = new Date()): SalesSummary {
  const by = { quoted: 0, hold: 0, won: 0, lost: 0 } as Record<SaleStatusId, number>;
  let none = 0, wonValue = 0, openValue = 0, follow = 0; const rs = new Map<string, number>(); const pw: number[] = [], pl: number[] = [];
  for (const r of rows) {
    const s = r.sheetId != null ? st.get(r.sheetId) : undefined;
    if (!s) { none++; continue; }
    by[s.status]++;
    if (s.status === 'won') { wonValue += saleValue(s, r); if (r.pct != null) pw.push(r.pct); }
    if (s.status === 'quoted' || s.status === 'hold') openValue += saleValue(s, r);
    if (s.status === 'lost') { if (s.reason) rs.set(s.reason, (rs.get(s.reason) || 0) + 1); if (r.pct != null) pl.push(r.pct); }
    if (needsFollow(s, today)) follow++;
  }
  const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const closed = by.won + by.lost;
  return { total: rows.length, none, by, wonValue, openValue, winRate: closed ? by.won / closed : null, follow, reasons: [...rs.entries()].sort((a, b) => b[1] - a[1]), wonPct: avg(pw), lostPct: avg(pl) };
}
