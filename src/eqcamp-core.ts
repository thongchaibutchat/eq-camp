import {
  Document, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType,
  ShadingType, BorderStyle, ImageRun, PageBreak, VerticalAlign
} from 'docx';

/* ===================== TYPES ===================== */
export type Subject = 'math' | 'steam' | 'english' | 'ai';
export type DocKind = 'program' | 'quotation' | 'booking' | 'runsheet';
// รูปแบบระยะเวลา: half = ครึ่งวัน, day = ไป-กลับเต็มวัน, overnight = พักค้าง
export type DurationMode = 'half' | 'day' | 'overnight';
export interface Img { data?: Uint8Array; caption: string }
export interface Row { time: string; title: string; sub?: string[] }
export interface Day { day: number; items: Row[] }
export interface Camp {
  docCode: string; subject: Subject; school: string; level: string;
  students: number; teachers: number; days: number; nights: number; durationMode: DurationMode;
  dates: string; province: string; venue: string; venueVisit: string; startTime: string; travelHours: number;
  normalPrice: number; specialPrice: number; costPerPerson: number;
  contactName: string; supplierNote: string; validDays: number; payTerms: string;
  activityIds: string[]; actImgs: Img[]; venueImgs: Img[];
  extraActivities: Activity[]; // กิจกรรมที่ผู้ใช้เพิ่มเอง (custom) — ผูกกับวิชาปัจจุบัน
}

/* ===================== SYSTEM DATA ===================== */
export const SUBJECTS: Record<Subject, { label: string; titleTh: string; en: string; field: string; careers: string; extra: string[] }> = {
  math: { label: 'คณิตศาสตร์', titleTh: 'ค่ายบูรณาการวิชาการคณิตศาสตร์', en: 'Math Camp 2026', field: 'คณิตศาสตร์',
    careers: 'นักคณิตศาสตร์ นักสถิติ รวมถึงสาขาอาชีพในสายงานคณิตศาสตร์',
    extra: ['บูรณาการแบบสหวิทยาการทักษะคณิตศาสตร์', 'บูรณาการทักษะวิชาชีพด้านคณิตศาสตร์'] },
  steam: { label: 'วิทย์ / STEAM', titleTh: 'ค่ายบูรณาการวิชาการวิทยาศาสตร์และสะตีมศึกษา', en: 'Science & STEAM Camp 2026',
    field: 'วิทยาศาสตร์ เทคโนโลยี วิศวกรรมศาสตร์ ศิลปะ และคณิตศาสตร์ (STEAM)',
    careers: 'นักวิทยาศาสตร์ วิศวกร และนวัตกรในอนาคต',
    extra: ['บูรณาการโดยใช้โครงงานฐานกิจกรรมค่าย (Project-Based Camp)', 'บูรณาการแบบสหวิทยาการ STEAM Education'] },
  english: { label: 'ภาษาอังกฤษ', titleTh: 'ค่ายบูรณาการวิชาการภาษาอังกฤษ', en: 'English Camp 2026', field: 'ภาษาอังกฤษ',
    careers: 'ผู้ใช้ภาษาอังกฤษเพื่อการสื่อสารและการประกอบอาชีพในอนาคต',
    extra: ['บูรณาการทักษะการฟัง พูด อ่าน เขียน ภาษาอังกฤษ', 'บูรณาการการสื่อสารข้ามวัฒนธรรม (Intercultural Communication)'] },
  ai: { label: 'AI & Coding', titleTh: 'ค่ายนวัตกรรมปัญญาประดิษฐ์และโค้ดดิ้ง', en: 'AI & Coding Camp 2026', field: 'เทคโนโลยีดิจิทัล ปัญญาประดิษฐ์ และการเขียนโปรแกรม',
    careers: 'นักพัฒนาโปรแกรม นักนวัตกรรม และนักเทคโนโลยีในอนาคต',
    extra: ['บูรณาการทักษะการคิดเชิงคำนวณ (Computational Thinking)', 'บูรณาการโครงงานฐานนวัตกรรมดิจิทัล'] }
};

export type Kind = 'opening' | 'core' | 'night' | 'recreation' | 'closing';
export interface Activity { id: string; subjects: Subject[]; kind: Kind; title: string; desc?: string; draft?: boolean }
const ALL: Subject[] = ['math', 'steam', 'english', 'ai'];
// คลังกิจกรรมมาตรฐาน EQ Camp — ครบทุกวิชา กิจกรรมหลักมากพอเติมค่าย 4 วันโดยไม่ซ้ำ
// (ชุดคณิต/STEAM ดึงจากไฟล์จริง PL 0109 / PL 0110 ; อังกฤษ/AI เป็นชุดมาตรฐานพร้อมใช้ แก้ชื่อได้)
export const LIB: Activity[] = [
  /* ---------- เปิดค่าย ---------- */
  { id: 'o-door', subjects: ['math', 'english', 'ai'], kind: 'opening', title: 'กิจกรรม “เปิดประตู สู่ห้องเรียน”' },
  { id: 'o-reboot', subjects: ['steam'], kind: 'opening', title: 'กิจกรรม “Reboot Your Brain”' },
  { id: 'o-ice', subjects: ALL, kind: 'opening', title: 'กิจกรรมสันทนาการสร้างสัมพันธ์ “Ice Breaking & Team Building”' },

  /* ---------- คณิตศาสตร์ (core) ---------- */
  { id: 'm-brain', subjects: ['math'], kind: 'core', title: 'กิจกรรม “BRAIN STROM X2”', desc: '(กระบวนการสันทนาการสร้างสัมพันธ์)' },
  { id: 'm-code', subjects: ['math'], kind: 'core', title: 'กิจกรรม “ถอดรหัสตัวเลขอัจฉริยะ”' },
  { id: 'm-cls', subjects: ['math'], kind: 'core', title: 'กิจกรรม “Creative Learning Station”' },
  { id: 'm-station', subjects: ['math'], kind: 'core', title: 'กิจกรรม “Mathematics Station ฝึกคิดคณิตน่ารู้”' },
  { id: 'm-creative', subjects: ['math'], kind: 'core', title: 'กิจกรรม “Creative Math”' },
  { id: 'm-group', subjects: ['math'], kind: 'core', title: 'กิจกรรมกลุ่มสัมพันธ์ “กระตุ้นสมอง ประลองกำลัง”' },
  { id: 'm-logic', subjects: ['math'], kind: 'core', title: 'กิจกรรม “Logic & Puzzle Challenge”', desc: '(ตรรกศาสตร์ ปริศนา และเกมคณิตศาสตร์)' },
  { id: 'm-real', subjects: ['math'], kind: 'core', title: 'กิจกรรม “คณิตในชีวิตจริง (Math in Real Life)”', desc: '(การเงิน สถิติ และการวัดรอบตัว)' },
  { id: 'm-mini', subjects: ['math'], kind: 'night', title: 'กิจกรรม “Mini Math”' },

  /* ---------- วิทยาศาสตร์ / STEAM (core) ---------- */
  { id: 's-station', subjects: ['steam'], kind: 'core', title: 'กิจกรรม “STEAM Station พิชิตภารกิจนวัตกรรม”', desc: '(Roller Coaster & Bridge Design)' },
  { id: 's-chem', subjects: ['steam'], kind: 'core', title: 'กิจกรรมปฏิบัติการเคมี “Crystallization Heat Packs”' },
  { id: 's-rocket', subjects: ['steam'], kind: 'core', title: 'กิจกรรม “STEAM Mission : Baking Soda Rocket”', desc: '(ฟิสิกส์แรงดันอากาศ มุมยิงโปรเจกไทล์ และอากาศพลศาสตร์)' },
  { id: 's-circuit', subjects: ['steam'], kind: 'core', title: 'กิจกรรม “Creative Circuit วงจรไฟฟ้าสร้างสรรค์”' },
  { id: 's-bridge', subjects: ['steam'], kind: 'core', title: 'กิจกรรม “Spaghetti Bridge วิศวกรรมโครงสร้าง”' },
  { id: 's-water', subjects: ['steam'], kind: 'core', title: 'กิจกรรม “Water Rocket จรวดน้ำและแรงปฏิกิริยา”' },
  { id: 's-microbit', subjects: ['steam'], kind: 'core', title: 'กิจกรรม “Micro:bit Coding Station”', desc: '(เขียนโปรแกรมควบคุมเซนเซอร์เบื้องต้น)' },
  { id: 's-night', subjects: ['steam'], kind: 'night', title: 'กิจกรรม “Night STEAM Challenge”' },

  /* ---------- ภาษาอังกฤษ (core) ---------- */
  { id: 'e-race', subjects: ['english'], kind: 'core', title: 'กิจกรรม “English Amazing Race”', desc: '(ภารกิจสื่อสารภาษาอังกฤษตามฐาน)' },
  { id: 'e-role', subjects: ['english'], kind: 'core', title: 'กิจกรรม “Role-Play Station : English in Real Life”' },
  { id: 'e-vocab', subjects: ['english'], kind: 'core', title: 'กิจกรรม “Vocabulary Battle Station”' },
  { id: 'e-story', subjects: ['english'], kind: 'core', title: 'กิจกรรม “Story Creation & Presentation”', desc: '(สร้างเรื่องเล่าและนำเสนอเป็นกลุ่ม)' },
  { id: 'e-phonics', subjects: ['english'], kind: 'core', title: 'กิจกรรม “Phonics & Song Workshop”' },
  { id: 'e-market', subjects: ['english'], kind: 'core', title: 'กิจกรรม “English Mini Market สถานการณ์จำลองการสื่อสาร”' },
  { id: 'e-night', subjects: ['english'], kind: 'night', title: 'กิจกรรม “English Night Show”' },

  /* ---------- AI & Coding (core) ---------- */
  { id: 'a-unplug', subjects: ['ai'], kind: 'core', title: 'กิจกรรม “Coding Unplugged Challenge”', desc: '(ฝึกการคิดเชิงคำนวณแบบไม่ใช้คอมพิวเตอร์)' },
  { id: 'a-block', subjects: ['ai'], kind: 'core', title: 'กิจกรรม “Block Coding Station (Scratch)”' },
  { id: 'a-ai', subjects: ['ai'], kind: 'core', title: 'กิจกรรม “รู้จักปัญญาประดิษฐ์ (Teachable Machine)”', desc: '(ฝึกสอน AI จำแนกภาพและเสียง)' },
  { id: 'a-robot', subjects: ['ai'], kind: 'core', title: 'กิจกรรม “Robot / Drone Mission”' },
  { id: 'a-iot', subjects: ['ai'], kind: 'core', title: 'กิจกรรม “IoT & Sensor Station”' },
  { id: 'a-game', subjects: ['ai'], kind: 'core', title: 'กิจกรรม “Game Design ออกแบบเกมดิจิทัล”' },
  { id: 'a-night', subjects: ['ai'], kind: 'night', title: 'กิจกรรม “AI Idea Pitching”' },

  /* ---------- สันทนาการ / ปิดค่าย (ใช้ได้ทุกวิชา) ---------- */
  { id: 'x-boost', subjects: ALL, kind: 'recreation', title: 'กิจกรรม “Boost Up Learning” สันทนาการ' },
  { id: 'x-next', subjects: ALL, kind: 'closing', title: 'กิจกรรม “The Next Step”' }
];
export const VENUES = [
  { province: 'เลย', name: 'โรงแรมเชียงคานฮิลล์รีสอร์ท', visit: 'ถนนวัฒนธรรมเชียงคาน / ชมวิวทะเลหมอก ณ ภูทอก อำเภอเชียงคาน จังหวัดเลย', note: 'พร้อมห้องประชุมและสระว่ายน้ำ' },
  { province: 'ระยอง', name: 'โรงแรมโกลเด้น ซิตี้ ระยอง', visit: 'ศูนย์การเรียนรู้ด้านพลังงาน / สถานแสดงพันธุ์สัตว์น้ำระยอง', note: 'คุณทราย 088-6171446 (ห้องประชุมจุได้สูงสุด 1,800 คน)' },
  { province: 'ระยอง', name: 'ปาล์มมาลี บีช รีสอร์ท ระยอง', visit: 'สวนพฤกษศาสตร์ระยอง / สวนสุภัทราแลนด์', note: 'คุณโต้ง 096-9817556' },
  { province: 'นครนายก', name: 'ธารา ชลพฤกษ์ รีสอร์ท', visit: 'เขื่อนขุนด่านปราการชล / ศูนย์ภูมิรักษ์ธรรมชาติ', note: 'คุณเป้ 089-7790126 (ห้องประชุมจุได้ 300 คน)' },
  { province: 'ชลบุรี', name: 'สวนนงนุช พัทยา รีสอร์ท', visit: 'ทัศนศึกษาสวนนงนุชและหุบเขาไดโนเสาร์', note: 'คุณฟ้า 092-2928296' },
  { province: 'กาญจนบุรี', name: 'เฟลิกซ์ ริเวอร์แคว รีสอร์ท', visit: 'พิพิธภัณฑ์ธรณีศาสตร์ ม.มหิดล กาญจนบุรี / ถ้ำกระแซ', note: 'คุณปุ้ย 062-3599138' }
];
export const DOC_TYPES: { id: DocKind; label: string; stage: string; desc: string; internal?: boolean }[] = [
  { id: 'program', label: 'โปรแกรมค่าย (PL)', stage: '1. เสนอโปรแกรม', desc: 'วัตถุประสงค์ + กิจกรรมบูรณาการ + กำหนดการ + ราคา + ภาพกิจกรรม/ที่พัก' },
  { id: 'quotation', label: 'ใบเสนอราคา', stage: '2. เสนอราคา', desc: 'ตารางรายการ จำนวน ราคา/ท่าน ยอดรวม เงื่อนไข ลายเซ็น' },
  { id: 'booking', label: 'หนังสือขอราคา/จองโรงแรม', stage: '3. ประสานซัพพลายเออร์', desc: 'วันที่ จำนวนคน มื้ออาหาร ห้องประชุม (ไม่แสดงราคาขาย/ต้นทุน)' },
  { id: 'runsheet', label: 'Run-down ทีมงาน + สรุปต้นทุน', stage: '4. เตรียมงาน (ภายใน)', desc: 'กำหนดการแบบมีช่องผู้รับผิดชอบ + กำไร/Margin', internal: true }
];

export const PRESETS: { id: string; label: string; camp: Partial<Camp> }[] = [
  { id: 'pl0109', label: 'PL 0109/2569 — Math Camp ร.ร.อำนาจเจริญ 3 วัน 2 คืน', camp: {
    docCode: 'PL 0109/2569', subject: 'math', school: 'โรงเรียนอำนาจเจริญ', level: 'ม.1-2', students: 72, teachers: 6, days: 3, nights: 2,
    dates: 'วันที่ 18 – 20 พฤศจิกายน 2569', durationMode: 'overnight', province: 'เลย', venue: VENUES[0].name, venueVisit: VENUES[0].visit, startTime: '06.30', travelHours: 7,
    normalPrice: 4590, specialPrice: 3290, costPerPerson: 2150,
    supplierNote: 'เรตที่พักเชียงคานฮิลล์รีสอร์ท + อาหาร 6 มื้อ + เบรค 2 มื้อ + ทีมวิทยากร 6 ท่าน',
    activityIds: ['m-brain', 'm-code', 'm-cls', 'm-station', 'm-creative', 'm-mini', 'x-boost', 'x-next'] } },
  { id: 'pl0110', label: 'PL 0110/2569 — STEAM Camp ร.ร.สาธิตเทศบาล 2 วัน 1 คืน', camp: {
    docCode: 'PL 0110/2569', subject: 'steam', school: 'โรงเรียนสาธิตเทศบาล', level: 'ม.1-3', students: 120, teachers: 8, days: 2, nights: 1,
    dates: 'วันที่ 14 – 15 พฤศจิกายน 2569', durationMode: 'overnight', province: 'ระยอง', venue: VENUES[1].name, venueVisit: VENUES[1].visit, startTime: '07.00', travelHours: 3.5,
    normalPrice: 3290, specialPrice: 2450, costPerPerson: 1680,
    supplierNote: 'ติดต่อคุณทราย Golden City โทร 088-6171446 | รถบัสพันแสนแทรเวล โทร 089-6663414',
    activityIds: ['s-station', 's-chem', 's-rocket', 's-night', 'x-next'] } }
];
export const blankCamp = (): Camp => ({
  docCode: 'PL 0000/2569', subject: 'math', school: 'โรงเรียน...', level: 'ม.1-2', students: 50, teachers: 5, days: 2, nights: 1,
  dates: 'วันที่ ... พฤศจิกายน 2569', durationMode: 'overnight', province: VENUES[0].province, venue: VENUES[0].name, venueVisit: VENUES[0].visit, startTime: '07.00', travelHours: 3,
  normalPrice: 3290, specialPrice: 2490, costPerPerson: 1700, contactName: 'ฝ่ายขาย EQ Camp', supplierNote: '',
  validDays: 30, payTerms: 'ชำระตามเงื่อนไขที่ตกลงกับโรงเรียน (ปรับแก้ตามนโยบายบริษัท)',
  activityIds: [], actImgs: [], venueImgs: [], extraActivities: []
});
export const fromPreset = (id: string): Camp => ({ ...blankCamp(), ...PRESETS.find(p => p.id === id)!.camp, actImgs: [], venueImgs: [], extraActivities: [] });

// ---- ระยะเวลา: รองรับเลขอารบิก/เลขไทย/คำไทย/ครึ่งวัน/ไป-กลับ ----
const TH_DIGITS = '๐๑๒๓๔๕๖๗๘๙';
const toArabic = (s: string) => s.replace(/[๐-๙]/g, d => String(TH_DIGITS.indexOf(d)));
const WORDNUM: Record<string, number> = { 'หนึ่ง': 1, 'สอง': 2, 'สาม': 3, 'สี่': 4, 'ห้า': 5, 'หก': 6, 'เจ็ด': 7, 'แปด': 8 };
const NUMPAT = '\\d+|หนึ่ง|สอง|สาม|สี่|ห้า|หก|เจ็ด|แปด';
const toNum = (s?: string): number | null => { if (!s) return null; if (/^\d+$/.test(s)) return +s; return WORDNUM[s] ?? null; };

export interface DurationParse { mode: DurationMode; days: number; nights: number; resolved: boolean; ambiguous: boolean; note?: string; session?: 'morning' | 'afternoon' }
export function parseDuration(textRaw: string): DurationParse {
  const text = toArabic(textRaw);
  if (/ครึ่ง\s*วัน|half[-\s]?day/i.test(text)) {
    const session = /บ่าย|afternoon/i.test(text) ? 'afternoon' : 'morning';
    return { mode: 'half', days: 1, nights: 0, resolved: true, ambiguous: false, session };
  }
  const dm = text.match(new RegExp(`(${NUMPAT})\\s*วัน`));
  const nm = text.match(new RegExp(`(${NUMPAT})\\s*คืน`));
  const days = toNum(dm?.[1]); const nights = toNum(nm?.[1]);
  const dayTrip = /ไป\s*-?\s*กลับ|ไปกลับ|เช้า\s*-?\s*เย็น|วันเดย์|day\s*camp|one[-\s]?day/i.test(text);
  if (nights !== null && nights > 0) {
    const d = days ?? nights + 1;
    return { mode: 'overnight', days: Math.max(2, d), nights, resolved: true, ambiguous: false };
  }
  if (days !== null) {
    if (days <= 1 || dayTrip) return { mode: 'day', days: Math.max(1, days), nights: 0, resolved: true, ambiguous: false };
    return { mode: 'overnight', days, nights: days - 1, resolved: true, ambiguous: true, note: `บรีฟระบุ ${days} วัน แต่ไม่ได้บอกจำนวนคืน — ระบบตั้งเป็น ${days - 1} คืน (พักค้าง) โปรดยืนยัน` };
  }
  if (dayTrip) return { mode: 'day', days: 1, nights: 0, resolved: true, ambiguous: false };
  return { mode: 'overnight', days: 2, nights: 1, resolved: false, ambiguous: false };
}
// ทำให้ days/nights สอดคล้องกับ durationMode เสมอ
export function normalizeDuration(c: Camp): Camp {
  const out = { ...c };
  if (out.durationMode === 'half') { out.days = 1; out.nights = 0; }
  else if (out.durationMode === 'day') { out.days = Math.max(1, out.days || 1); out.nights = 0; }
  else { out.days = Math.max(2, out.days || 2); out.nights = out.nights > 0 ? out.nights : out.days - 1; }
  return out;
}
// เติม durationMode ให้ข้อมูลรุ่นเก่า (ก่อนมีฟิลด์นี้) แล้ว normalize
export function migrateCamp(raw: any): Camp {
  const out: Camp = { ...blankCamp(), ...raw, extraActivities: raw?.extraActivities || [] };
  if (out.durationMode !== 'half' && out.durationMode !== 'day' && out.durationMode !== 'overnight') {
    out.durationMode = Number(out.nights) > 0 ? 'overnight' : (Number(out.days) <= 1 ? 'day' : 'overnight');
  }
  return normalizeDuration(out);
}

/* ===================== BRIEF PARSER ===================== */
export function parseBrief(t: string, base: Camp): Camp {
  const c = { ...base };
  const num = (s: string) => Number(s.replace(/,/g, ''));
  let m: RegExpMatchArray | null;
  if ((m = t.match(/(PL\s*\d+\/\d+)/i))) c.docCode = m[1].toUpperCase().replace(/\s+/, ' ');
  if ((m = t.match(/โรงเรียน\S+(?:\s(?!ม\.|ครู|จำนวน|ค่าย|นักเรียน|ระดับ)[^\s\d]+)?/))) c.school = m[0].trim();
  if ((m = t.match(/ม\.\s*\d(?:\s*[-–]\s*\d)?/))) c.level = m[0].replace(/\s/g, '');
  if ((m = t.match(/(?:นักเรียน\S*\s*)?จำนวน\s*([\d,]+)\s*คน/))) c.students = num(m[1]);
  if ((m = t.match(/ครู\S*\s*([\d,]+)\s*(?:คน|ท่าน)/))) c.teachers = num(m[1]);
  if ((m = t.match(/วันที่\s*\d+[^ณ\n]*?(?:25\d\d|26\d\d)/))) c.dates = m[0].trim();
  const dur = parseDuration(t);
  if (dur.resolved) { c.durationMode = dur.mode; c.days = dur.days; c.nights = dur.nights; }
  if ((m = t.match(/ราคาปกติ\s*([\d,]+)/))) c.normalPrice = num(m[1]);
  if ((m = t.match(/(?:ลดเหลือเพียง|ลดเหลือ|ราคาพิเศษ)\s*([\d,]+)/))) c.specialPrice = num(m[1]);
  // ---- สถานที่/โรงแรม: ดึงจากข้อความ "ณ ..." ก่อน รองรับชื่อที่ไม่อยู่ในคลัง ----
  let venueText = '';
  if ((m = t.match(/\sณ\s+(.+?)(?=\s*(?:ราคา|งบประมาณ|งบ|โทร|ติดต่อ|โดย|จังหวัด|จ\.|$)|[\n,])/))) {
    venueText = m[1].replace(/[.\s]+$/, '').trim();
  }
  // จับคู่กับคลัง: จากชื่อในข้อความ หรือจากทั้งบรีฟ เพื่อเติมทัศนศึกษา/ผู้ติดต่อ/จังหวัด
  const known = VENUES.find(x => {
    const key = x.name.slice(0, 8);
    return (venueText && (venueText.includes(key) || x.name.includes(venueText.slice(0, 8)))) || t.includes(key);
  });
  if (known) {
    c.venue = venueText || known.name; c.province = known.province; c.venueVisit = known.visit;
    c.supplierNote = c.supplierNote || known.note;
  } else if (venueText) {
    // โรงแรมใหม่ที่ยังไม่อยู่ในคลัง — ใช้ตามบรีฟ และล้างทัศนศึกษา/ผู้ติดต่อ/จังหวัดของที่เดิมทิ้ง (ให้กรอกเองในแท็บ 2)
    c.venue = venueText; c.venueVisit = ''; c.supplierNote = ''; c.province = '';
  }
  // จังหวัด: ระบุชัดในบรีฟ > จังหวัดที่พบในข้อความ (เฉพาะเมื่อยังไม่ได้จากคลัง)
  if ((m = t.match(/จังหวัด\s*([^\s,\n]+)/)) || (m = t.match(/จ\.\s*([^\s,\n]+)/))) c.province = m[1];
  else if (!known && !c.province) { const kp = VENUES.find(x => t.includes(x.province)); if (kp) c.province = kp.province; }
  const prev = c.subject;
  if (/steam|สะตีม|สะเต็ม|วิทย์/i.test(t)) c.subject = 'steam';
  else if (/อังกฤษ|english/i.test(t)) c.subject = 'english';
  else if (/\bai\b|coding|โค้ด|โดรน|หุ่นยนต์/i.test(t)) c.subject = 'ai';
  else if (/คณิต|math/i.test(t)) c.subject = 'math';
  if (!base.activityIds.length || c.subject !== prev) c.activityIds = defaultActs(c.subject);
  return c;
}
// เลือกกิจกรรมเริ่มต้นให้ครบชุดสำหรับวิชานั้น (เปิด + หลักทั้งหมด + ค่ำ + สันทนาการ + ปิด)
export const defaultActs = (s: Subject) => LIB.filter(a => a.subjects.includes(s)).map(a => a.id);

/* ===================== SCHEDULE ENGINE ===================== */
const fmt = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}.${String(Math.round(m % 60)).padStart(2, '0')}`;
const rng = (a: number, b: number) => `${fmt(a)} – ${fmt(b)} น.`;
const ANCH: Record<string, number> = { breakfast: 450, lunch: 720, dinner: 1080 };
const FIX: Record<string, number> = { snack: 15, trip: 90, checkin: 45, register: 30, arrive: 30, opening: 60, summary: 30, night: 60, aar: 45, award: 30, checkout: 60, recreation: 30, closing: 30 };
export const staffText = (n: number) => `${Math.max(2, Math.ceil(n / 18))} – ${Math.max(3, Math.ceil(n / 12))}`;

export interface Plan { days: Day[]; meals: { b: number; l: number; d: number; s: number }; coreSlots: number; hasTrip: boolean; usedActivityIds: string[] }
export function subjectPool(c: Camp): Activity[] {
  return [...LIB.filter(a => a.subjects.includes(c.subject)), ...c.extraActivities.filter(a => a.subjects.includes(c.subject))];
}
export function buildSchedule(c: Camp): Plan {
  const pool = subjectPool(c);
  const sel = pool.filter(a => c.activityIds.includes(a.id));
  const of = (k: Kind) => { const r = sel.filter(a => a.kind === k); return r.length ? r : pool.filter(a => a.kind === k).slice(0, 1); };
  // รายการเติมช่องกิจกรรมหลัก: ที่เลือกก่อน แล้วตามด้วยที่เหลือในคลัง เพื่อไม่ให้เหลือช่องว่าง
  const selCores = sel.filter(a => a.kind === 'core');
  const poolCores = pool.filter(a => a.kind === 'core');
  const fillCores = (selCores.length ? [...selCores, ...poolCores.filter(a => !selCores.includes(a))] : poolCores);
  const cores = fillCores;
  const meals = { b: 0, l: 0, d: 0, s: 0 }; let mealNo = 0, coreIdx = 0, coreSlots = 0, hasTrip = false;
  const used: string[] = [];
  const act = (a?: Activity): Row['sub'] => { if (a?.id) used.push(a.id); return a?.desc ? [a.desc] : []; };
  const days: Day[] = [];
  const startMin = Math.round(parseInt(c.startTime.split(/[.:]/)[0]) * 60 + parseInt(c.startTime.split(/[.:]/)[1] || '0'));
  for (let d = 1; d <= c.days; d++) {
    const first = d === 1, last = d === c.days;
    const lateStart = startMin + c.travelHours * 60 + 120 >= 11 * 60;
    let T: string[];
    if (c.durationMode === 'half') {
      // ครึ่งวัน: ช่วงสั้น ไม่มีมื้อหลัก/ไม่พักค้าง จบด้วย AAR + พิธีปิด
      T = ['depart', 'arrive', 'register', 'opening', 'core', 'snack', 'core', 'aar', 'award', 'return'];
    } else if (c.durationMode === 'day') {
      // ไป-กลับเต็มวัน (รองรับหลายวันแบบไม่พักค้าง: เดินทางไป-กลับทุกวัน)
      T = ['depart', 'arrive'];
      if (first) T.push('register', 'opening');
      T.push('core', 'snack', 'lunch', 'core');
      T.push(last ? 'aar' : 'summary', ...(last ? ['award'] : []), 'return');
    } else {
      // พักค้าง (overnight)
      T = first ? ['depart', 'arrive', 'lunch?', 'register', 'opening', 'core', 'snack', 'trip', 'checkin', 'dinner', 'night', 'rest']
        : last ? ['breakfast', 'checkout', 'recreation', 'closing', 'aar', 'award', 'lunch', 'return']
        : ['breakfast', 'core', 'snack', 'core', 'lunch', 'core', 'snack', 'core', 'summary', 'free', 'dinner', 'night', 'rest'];
      if (first && lateStart) T = ['depart', 'arrive', 'lunch', 'register', 'opening', 'core', 'snack', 'checkin', 'dinner', 'night', 'rest'];
    }
    let cur = (first || c.durationMode !== 'overnight') ? startMin : 0;
    const items: Row[] = [];
    T.forEach((tk, i) => {
      const rest = T.slice(i + 1);
      const span = () => { let fixed = 0, k = 0; for (const t of rest) { if (ANCH[t] !== undefined) return { a: ANCH[t], fixed, k }; if (t === 'core') k++; else if (t !== 'free' && t !== 'lunch?') fixed += FIX[t] || 0; } return { a: null as number | null, fixed, k }; };
      const put = (title: string, dur: number, sub?: string[], anchor?: number) => { const s = anchor ? Math.max(cur, anchor) : cur; items.push({ time: rng(s, s + dur), title, sub }); cur = s + dur; };
      const open = (title: string, sub?: string[]) => { items.push({ time: `${fmt(cur)} น. เป็นต้นไป`, title, sub }); };
      switch (tk) {
        case 'depart': { const dur = Math.round(c.travelHours * 60); put(`ออกเดินทางจาก${c.school}`, dur); break; }
        case 'arrive': put(`เดินทางถึง ณ ${c.venue}`, 30); break;
        case 'lunch?': case 'lunch': if (tk === 'lunch?' && cur > 13 * 60) break; meals.l++; put(`รับประทานอาหารกลางวัน (${++mealNo})`, 60, undefined, ANCH.lunch); break;
        case 'breakfast': meals.b++; put(`รับประทานอาหารเช้า (${++mealNo})`, 60, undefined, ANCH.breakfast); break;
        case 'dinner': meals.d++; put(`รับประทานอาหารเย็น (${++mealNo})`, 60, undefined, ANCH.dinner); break;
        case 'snack': meals.s++; put(`รับประทานอาหารว่าง (${meals.s})`, 15); break;
        case 'register': put('ลงทะเบียน / พิธีเปิด', 30); break;
        case 'opening': { const a = of('opening')[0]; put(a.title, 60, act(a)); break; }
        case 'core': {
          if (cur > 16.5 * 60) break; coreSlots++;
          const sp = span(); const dur = sp.a !== null ? Math.min(120, Math.max(45, Math.round((sp.a - cur - sp.fixed) / (sp.k + 1) / 15) * 15)) : 90;
          if (cores.length) {
            const a = cores[coreIdx % cores.length];
            const repeat = Math.floor(coreIdx / cores.length) > 0;
            coreIdx++;
            put(repeat ? `${a.title} (ต่อยอด)` : a.title, dur, act(a));
          } else {
            // ไม่มีกิจกรรมในคลังเลย (วิชาที่ยังไม่ได้ตั้งค่า) — ใส่ฐานกลางเพื่อไม่ให้ค้าง
            put('กิจกรรมฐานการเรียนรู้เชิงบูรณาการ', dur);
          }
          break;
        }
        case 'trip': if (cur > 16.5 * 60 || !c.venueVisit.trim()) break; hasTrip = true; put(`กิจกรรมทัศนศึกษา ${c.venueVisit}`, 90); break;
        case 'checkin': put('เช็คอินเข้าที่พัก / พักผ่อนตามอัธยาศัย', 45); break;
        case 'night': { const a = of('night')[0]; put(a.title, 60, act(a), 19 * 60 + 30); break; }
        case 'summary': put('สรุปการเรียนรู้ประจำวัน / ถอดบทเรียนกลุ่ม', 30); break;
        case 'free': { const sp = span(); put('พักผ่อนตามอัธยาศัย / เตรียมกิจกรรมนำเสนอ', sp.a !== null ? Math.min(150, Math.max(30, sp.a - cur)) : 60); break; }
        case 'checkout': put('เก็บสัมภาระ / เช็คเอาท์', 60); break;
        case 'recreation': { const a = of('recreation')[0]; put(a.title, 30, act(a)); break; }
        case 'closing': { const a = of('closing')[0]; put(a.title, 30, act(a)); break; }
        case 'aar': put('ถอดบทเรียน AAR (After Action Review) และสรุปสิ่งที่ได้เรียนรู้', 45); break;
        case 'award': put('มอบของรางวัล และพิธีปิด', 30); break;
        case 'return': open(`เดินทางกลับ${c.school} โดยสวัสดิภาพ`); break;
        case 'rest': open('พักผ่อนฝันดี'); break;
      }
    });
    days.push({ day: d, items });
  }
  return { days, meals, coreSlots, hasTrip, usedActivityIds: used };
}

/* ===================== SENTENCE COMPOSER ===================== */
export function compose(c: Camp, plan: Plan) {
  const S = SUBJECTS[c.subject];
  const pool = subjectPool(c);
  // ใช้กิจกรรมที่ "จัดจริงในตาราง" (ไม่ซ้ำ) เพื่อให้รายละเอียดตรงกับกำหนดการ; สำรองเป็นที่เลือกไว้
  const seen = new Set<string>(); const usedSel: Activity[] = [];
  for (const id of (plan.usedActivityIds || [])) { if (!seen.has(id)) { seen.add(id); const a = pool.find(x => x.id === id); if (a) usedSel.push(a); } }
  const sel = usedSel.length ? usedSel : pool.filter(a => c.activityIds.includes(a.id));
  const objectives = [
    `เพื่อพัฒนานักเรียนให้มีความสามารถและมีทักษะการบูรณาการความรู้ด้าน${S.field}`,
    `เพื่อส่งเสริมและสนับสนุน ให้นักเรียนมีแรงบันดาลใจในการเป็น${S.careers}`,
    'เพื่อจัดกระบวนการเรียนรู้ให้ผู้เรียนได้เกิดเจตคติที่ดีต่อการเรียน และเอาใจใส่ในการเรียน เกิดพฤติกรรมในการรักการเรียนรู้ ใฝ่ฝึกฝนตนเองอยู่เสมออย่างเต็มที่',
    'เพื่อจัดกระบวนการเรียนรู้ให้ผู้เรียนเกิดกระบวนการเรียนรู้ที่สร้างสรรค์อย่างมีความสุข ทั้งสุขภาพกายและสุขภาพจิตที่ดี ได้เรียนรู้ร่วมกันจากการปฏิบัติจริง ด้วยความหลากหลายและสร้างองค์ความรู้ใหม่ได้ในศตวรรษที่ 21'
  ];
  const names = sel.map(a => a.title);
  const acts: string[] = [];
  for (let i = 0; i < names.length; i += 2) acts.push(names.slice(i, i + 2).join(' / '));
  acts.push('กิจกรรมทดสอบหลังการเรียนรู้ (After Action Review : AAR)');
  const integ = ['บูรณาการคุณลักษณะที่พึงประสงค์ในการเรียนรู้ในศตวรรษที่ 21', 'บูรณาการโดยใช้โครงการในทางกิจกรรมค่ายเป็นลักษณะภารกิจในระหว่างกิจกรรม', ...S.extra,
    'บูรณาการกระบวนการกลุ่มและทักษะความเป็นผู้นำ (Collaborative and Leadership Skills.)', 'บูรณาการทักษะการเรียนรู้และนวัตกรรม (Learning and Innovation Skills)', 'บูรณาการทักษะการสื่อสาร (Communication Tactic)'];
  const m = plan.meals, main = m.b + m.l + m.d;
  const parts = [m.b && `อาหารเช้า ${m.b} มื้อ`, m.l && `อาหารกลางวัน ${m.l} มื้อ`, m.d && `อาหารเย็น ${m.d} มื้อ`].filter(Boolean).join(' ');
  const staff = staffText(c.students);
  const budget = [
    c.nights > 0 && `ค่าที่พัก ${c.nights} คืน ${c.venue}`, main > 0 && `ค่าอาหาร ${main} มื้อ (${parts})`, m.s > 0 && `ค่าอาหารว่าง ${m.s} มื้อ`,
    'ค่าห้องประชุมสัมมนารองรับการทำกิจกรรม', `ค่าวิทยากรและทีมงาน จำนวน ${staff} ท่าน`, 'ค่าเดินทางวิทยากร',
    plan.hasTrip && 'ค่ากิจกรรมทัศนศึกษาแหล่งเรียนรู้', 'ค่าอุปกรณ์การจัดค่ายทั้งหมด'
  ].filter(Boolean) as string[];
  const total = c.students + c.teachers;
  return {
    titleTh: `หลักสูตร “${S.titleTh}”`, titleEn: `( ${S.en} )`, objectives, acts, integ, budget, staff,
    p1: `นักเรียนห้องเรียนพิเศษ ระดับชั้น ${c.level} จำนวน ${c.students} คน`, p2: `คุณครูผู้ดูแล ${c.teachers} คน รวม ${total} คน`,
    dur: c.durationMode === 'half' ? 'ครึ่งวัน (ไป-กลับ)'
      : c.durationMode === 'day' ? `${c.days} วัน (ไป-กลับ)`
      : `${c.days} วัน ${c.nights} คืน`
  };
}

/* ===================== VALIDATION ===================== */
export function check(c: Camp, plan: Plan): { ok: boolean; msg: string; soft?: boolean }[] {
  const pool = subjectPool(c);
  const coreAvail = pool.filter(a => a.kind === 'core').length;
  const unique = coreAvail >= plan.coreSlots; // มีกิจกรรมหลักพอให้ทุกช่องไม่ซ้ำ
  const allItems = plan.days.flatMap(d => d.items);
  const noGap = allItems.length > 0 && allItems.every(r => !r.title.includes('ระบุกิจกรรมเพิ่ม') && !/^กิจกรรมฐานการเรียนรู้เชิงบูรณาการ$/.test(r.title));
  // รายการพักค้าง (เช็คอิน/อาหารเย็น/พักผ่อนฝันดี) ต้องไม่โผล่ในค่ายไป-กลับ/ครึ่งวัน
  const overnightWords = /เช็คอิน|อาหารเย็น|พักผ่อนฝันดี|อาหารเช้า/;
  const noStrayOvernight = c.durationMode === 'overnight' || !allItems.some(r => overnightWords.test(r.title));
  const durOK = c.durationMode === 'overnight' ? c.nights > 0 : c.nights === 0;
  const hasAAR = allItems.some(r => /AAR/.test(r.title));
  return [
    { ok: /^PL\s*\d+\/\d+$/.test(c.docCode.trim()), msg: 'รหัสเอกสารรูปแบบ PL xxxx/2569' },
    { ok: !!c.school && !c.school.includes('...'), msg: 'ระบุชื่อโรงเรียนแล้ว' },
    { ok: !!c.dates.trim() && !c.dates.includes('...'), msg: 'ระบุวันที่จัดค่ายแล้ว' },
    { ok: c.students > 0 && c.specialPrice > 0, msg: 'จำนวนคนและราคาพิเศษถูกต้อง' },
    { ok: c.specialPrice <= c.normalPrice, msg: 'ราคาพิเศษไม่เกินราคาปกติ' },
    { ok: c.specialPrice > c.costPerPerson, msg: 'ราคาขายสูงกว่าต้นทุน/ท่าน' },
    { ok: durOK, msg: c.durationMode === 'overnight' ? `พักค้าง ${c.nights} คืน (สอดคล้องกับรูปแบบค่าย)` : `ค่าย${c.durationMode === 'half' ? 'ครึ่งวัน' : 'ไป-กลับ'} — ไม่มีการพักค้าง` },
    { ok: noStrayOvernight, msg: 'กำหนดการสอดคล้องรูปแบบ (ไม่มีรายการพักค้างในค่ายไป-กลับ)' },
    { ok: hasAAR, msg: 'มีกิจกรรมถอดบทเรียน (AAR)' },
    { ok: noGap, msg: 'ทุกช่วงเวลามีกิจกรรมจริง (ไม่มีช่องว่าง)' },
    { ok: unique, soft: true, msg: unique ? `กิจกรรมหลักพอทุกช่องไม่ซ้ำ (ใช้ ${plan.coreSlots} ช่อง · คลังมี ${coreAvail})` : `ค่ายยาว ใช้ ${plan.coreSlots} ช่อง แต่คลังมี ${coreAvail} — ระบบวนใช้ซ้ำแบบติดป้าย “(ต่อยอด)” หรือเพิ่มกิจกรรมเองในแท็บ 3` }
  ];
}
// พร้อมส่งเมื่อผ่านทุกข้อ "แข็ง" (soft ไม่บังคับ)
export const isReady = (checks: { ok: boolean; soft?: boolean }[]) => checks.every(c => c.ok || c.soft);
export const money = (n: number) => Math.round(n).toLocaleString('en-US');

/* ===================== DOCX HELPERS ===================== */
const FONT = { ascii: 'TH SarabunPSK', hAnsi: 'TH SarabunPSK', cs: 'TH SarabunPSK', eastAsia: 'TH SarabunPSK' };
const BLUE = '155D90', SKY = '087FC2', W = 9400;
type RO = { b?: boolean; sz?: number; color?: string; strike?: boolean; i?: boolean };
const R = (text: string, o: RO = {}) => { const sz = (o.sz || 16) * 2; return new TextRun({ text, font: FONT, size: sz, sizeComplexScript: sz, bold: o.b, boldComplexScript: o.b, color: o.color, strike: o.strike, italics: o.i }); };
const P = (t: string | TextRun[], o: RO & { al?: (typeof AlignmentType)[keyof typeof AlignmentType]; before?: number; after?: number; indent?: number; hang?: number; keep?: boolean } = {}) =>
  new Paragraph({ alignment: o.al, spacing: { before: (o.before || 0) * 20, after: (o.after ?? 2) * 20, line: 312 }, indent: o.indent !== undefined ? { left: o.indent * 567, hanging: (o.hang || 0) * 567 } : undefined, keepNext: o.keep,
    children: typeof t === 'string' ? [R(t, o)] : t });
const CTR = AlignmentType.CENTER, RGT = AlignmentType.RIGHT;
const code = (t: string) => P(t, { b: true, color: BLUE, al: RGT });
const title = (th: string, en?: string, sz = 20) => [P(th, { b: true, sz, color: '0F3D63', al: CTR, after: 0 }), ...(en ? [P(en, { b: true, sz: 18, color: SKY, al: CTR, after: 8 })] : [])];
const H = (t: string) => P(t, { b: true, sz: 17, color: BLUE, before: 8, after: 3, keep: true });
const numbered = (a: string[]) => a.map((x, i) => P(`${i + 1}. ${x}`, { indent: 0.9, hang: 0.9, after: 1 }));
const dashed = (a: string[]) => a.map(x => P(`-\t${x}`, { indent: 0.9, hang: 0.9, after: 1 }));
const NB = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const LB = { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' };
const cell = (kids: Paragraph[], w: number, o: { fill?: string; border?: 'none' | 'line' | 'box'; span?: number } = {}) => {
  const bx = { style: BorderStyle.SINGLE, size: 6, color: '94A3B8' };
  const bd = o.border === 'box' ? { top: bx, bottom: bx, left: bx, right: bx } : o.border === 'line' ? { top: NB, left: NB, right: NB, bottom: LB } : { top: NB, bottom: NB, left: NB, right: NB };
  return new TableCell({ children: kids, width: { size: w, type: WidthType.DXA }, borders: bd, columnSpan: o.span, verticalAlign: VerticalAlign.TOP,
    shading: o.fill ? { type: ShadingType.CLEAR, fill: o.fill, color: 'auto' } : undefined, margins: { top: 50, bottom: 50, left: 100, right: 100 } });
};
const tbl = (rows: TableRow[], cols: number[]) => new Table({ rows, width: { size: W, type: WidthType.DXA }, columnWidths: cols });
const infoRows = (pairs: [string, string[]][]) => tbl(pairs.map(([k, v]) => new TableRow({ children: [cell([P(k, { b: true, color: BLUE })], 2200), cell(v.map(x => P(x, { after: 0 })), W - 2200)] })), [2200, W - 2200]);
const dayBanner = (t: string) => tbl([new TableRow({ children: [cell([P(t, { b: true, sz: 17, color: 'FFFFFF', after: 0 })], W, { fill: BLUE })] })], [W]);
const scheduleTable = (d: Day, extra?: boolean) => {
  const cols = extra ? [2250, 4150, 3000] : [2700, W - 2700];
  return tbl(d.items.map(r => new TableRow({ cantSplit: true, children: [
    cell([P(r.time, { b: true, sz: 15.5, after: 0 })], cols[0], { border: 'line' }),
    cell([P(r.title, { b: true, sz: 15.5, after: 0 }), ...(r.sub || []).map(s => P(s, { sz: 15, indent: 0.5, after: 0 }))], cols[1], { border: 'line' }),
    ...(extra ? [cell([P('', { after: 0 })], cols[2], { border: 'line' })] : [])] })), cols);
};
const scheduleBlock = (c: Camp, plan: Plan, k: ReturnType<typeof compose>, extra = false) => [
  ...title('กำหนดการ'), ...title(k.titleTh, k.titleEn),
  P(c.school, { b: true, al: CTR, after: 0 }), P(c.dates, { b: true, al: CTR, after: 0 }), P(`ณ ${c.venue}`, { b: true, al: CTR, after: 8 }),
  ...plan.days.flatMap(d => [P('', { after: 0, sz: 6 }), dayBanner(`วันที่ ${d.day}${extra ? '  (ช่องขวา: ผู้รับผิดชอบ / อุปกรณ์)' : ''}`), scheduleTable(d, extra)]),
  P('หมายเหตุ กำหนดการอาจจะเปลี่ยนแปลงตามความเหมาะสม', { b: true, color: '334155', before: 6 })
];
const priceBanner = (c: Camp) => tbl([new TableRow({ children: [cell([P([R('ราคาปกติ ', { b: true, sz: 19, color: '0C4A6E' }), R(money(c.normalPrice), { b: true, sz: 19, color: 'DC2626', strike: true }), R(' ลดเหลือเพียง ', { b: true, sz: 19, color: '0C4A6E' }), R(`${money(c.specialPrice)} บ./ท่าน`, { b: true, sz: 21, color: '15803D' })], { al: CTR, after: 0 })], W, { fill: 'F0F9FF', border: 'box' })] })], [W]);
const photoGrid = (imgs: Img[], fallbackN: number) => {
  const list = imgs.length ? imgs : Array.from({ length: fallbackN }, (_, i) => ({ caption: `(วางภาพที่ ${i + 1})` } as Img));
  const rows: TableRow[] = [];
  for (let i = 0; i < list.length; i += 2) rows.push(new TableRow({ children: [0, 1].map(j => { const im = list[i + j]; if (!im) return cell([P('')], W / 2); return cell([
    im.data ? new Paragraph({ alignment: CTR, children: [new ImageRun({ data: im.data, transformation: { width: 235, height: 150 } })] }) : P('[ พื้นที่วางภาพ ]', { al: CTR, color: '94A3B8', before: 30, after: 30 }),
    P(im.caption, { sz: 13, color: '334155', al: CTR, after: 0 })], W / 2, { border: 'box' }); }) }));
  return tbl(rows, [W / 2, W / 2]);
};
const sign = (l: string, who: string) => cell([P('', { after: 18 }), P('ลงชื่อ ....................................................', { al: CTR, after: 0 }), P(`( ${who} )`, { al: CTR, after: 0 }), P(l, { al: CTR, after: 0 })], W / 2);
const thDate = () => { const d = new Date(); return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() + 543}`; };

/* ===================== 4 DOCUMENT BUILDERS ===================== */
export function buildDoc(kind: DocKind, c: Camp, planIn?: Plan, k0?: ReturnType<typeof compose>): Document {
  const plan = planIn || buildSchedule(c); const k = k0 || compose(c, plan);
  const total = c.students * c.specialPrice, cost = c.students * c.costPerPerson, profit = total - cost, margin = total ? (profit / total) * 100 : 0;
  let body: (Paragraph | Table)[] = [];
  if (kind === 'program') {
    body = [code(c.docCode), ...title(k.titleTh, k.titleEn),
      H('วัตถุประสงค์การเรียนรู้'), ...numbered(k.objectives), P('', { after: 2 }),
      infoRows([['จำนวน', [k.p1, k.p2]], ['วิทยากร', [`${k.staff} คน`]], ['ระยะเวลาอบรม', [k.dur]]]),
      H('กิจกรรมเชิงบูรณาการ'), ...numbered(k.acts), H('บูรณาการการเรียน (integration instruction)'), ...numbered(k.integ),
      new Paragraph({ children: [new PageBreak()] }), ...scheduleBlock(c, plan, k), P('', { after: 4 }), priceBanner(c), P('', { after: 2 }),
      H('รายละเอียดงบประมาณมีดังนี้'), ...dashed(k.budget),
      new Paragraph({ children: [new PageBreak()] }), ...title('ตัวอย่างภาพกิจกรรม'), photoGrid(c.actImgs, 4), P('', { after: 8 }),
      ...title(`ที่พัก ${c.venue}`), photoGrid(c.venueImgs, 4)];
  } else if (kind === 'quotation') {
    const cols = [700, 4300, 1100, 1600, 1700];
    const hd = ['ลำดับ', 'รายการ', 'จำนวน', 'ราคา/ท่าน (บาท)', 'รวม (บาท)'];
    body = [code(`QT ${c.docCode.replace(/^PL\s*/, '')}`), ...title('ใบเสนอราคา', 'QUOTATION'),
      P(`วันที่ ${thDate()}`, { al: RGT }),
      infoRows([['เรียน', [`ผู้อำนวยการ${c.school}`]], ['เรื่อง', [`เสนอราคา${k.titleTh.replace(/^หลักสูตร\s*/, '')} ${k.titleEn}`]], ['อ้างอิง', [`โปรแกรมเลขที่ ${c.docCode} / ${c.dates}`]], ['สถานที่', [`${c.venue} จังหวัด${c.province}`]]]),
      P('', { after: 4 }),
      tbl([new TableRow({ tableHeader: true, children: hd.map((h, i) => cell([P(h, { b: true, color: 'FFFFFF', al: CTR, after: 0 })], cols[i], { fill: BLUE, border: 'box' })) }),
        new TableRow({ children: [
          cell([P('1', { al: CTR, after: 0 })], cols[0], { border: 'box' }),
          cell([P(k.titleTh, { b: true, after: 0 }), P(`${k.dur} · ${c.dates}`, { sz: 14, after: 0 }), P(`นักเรียน ${c.level} · รวมที่พัก อาหาร วิทยากร อุปกรณ์ ตามรายละเอียดในโปรแกรม`, { sz: 14, after: 0 })], cols[1], { border: 'box' }),
          cell([P(String(c.students), { al: CTR, after: 0 })], cols[2], { border: 'box' }),
          cell([P(money(c.specialPrice), { al: RGT, after: 0 })], cols[3], { border: 'box' }),
          cell([P(money(total), { al: RGT, after: 0 })], cols[4], { border: 'box' })] }),
        new TableRow({ children: [cell([P('ยอดรวมสุทธิ (บาท)', { b: true, al: RGT, after: 0 })], cols[0] + cols[1] + cols[2] + cols[3], { fill: 'F0F9FF', border: 'box', span: 4 }), cell([P(money(total), { b: true, al: RGT, after: 0 })], cols[4], { fill: 'F0F9FF', border: 'box' })] })], cols),
      P(`ราคาปกติ ${money(c.normalPrice)} บาท/ท่าน ลดเหลือพิเศษ ${money(c.specialPrice)} บาท/ท่าน (ประหยัด ${money(c.normalPrice - c.specialPrice)} บาท/ท่าน)`, { b: true, color: '15803D', before: 6 }),
      H('รายละเอียดที่รวมอยู่ในราคา'), ...dashed(k.budget),
      H('เงื่อนไข'), ...numbered([`ราคานี้ยืนยันภายใน ${c.validDays} วัน นับจากวันที่เสนอราคา`, c.payTerms, 'กำหนดการอาจเปลี่ยนแปลงตามความเหมาะสม โดยไม่กระทบเนื้อหาการเรียนรู้']),
      P('', { after: 6 }), tbl([new TableRow({ children: [sign('ผู้เสนอราคา', c.contactName), sign('ผู้อนุมัติ / ตัวแทนโรงเรียน', `ผู้อำนวยการ${c.school}`)] })], [W / 2, W / 2])];
  } else if (kind === 'booking') {
    const supplier = c.supplierNote || VENUES.find(x => x.name === c.venue)?.note || ''; const m = plan.meals, ppl = c.students + c.teachers;
    body = [code(`BK ${c.docCode.replace(/^PL\s*/, '')}`), ...title('หนังสือขอใบเสนอราคาและยืนยันห้องพัก/ห้องประชุม', 'ACCOMMODATION & MEETING REQUEST'), P(`วันที่ ${thDate()}`, { al: RGT }),
      P(`เรียน  ฝ่ายขาย/ฝ่ายจัดเลี้ยง ${c.venue}`, { b: true }), P(`ด้วยบริษัท อีคิวแคมป์ มีความประสงค์จัด${k.titleTh.replace(/^หลักสูตร\s*/, '')} ให้แก่${c.school} จึงขอความอนุเคราะห์เสนอราคาและตรวจสอบความพร้อมตามรายละเอียดดังนี้`, { indent: 1 }),
      infoRows([['วันที่เข้าพัก', [c.dates]], ['ระยะเวลา', [k.dur]], ['จำนวนผู้เข้าพัก', [`นักเรียน ${c.students} คน ครู ${c.teachers} คน ทีมวิทยากร ${k.staff} คน (รวมผู้เข้าร่วมประมาณ ${ppl} คน)`]],
        ['เวลาถึงโดยประมาณ', [plan.days[0].items.find(r => r.title.startsWith('เดินทางถึง'))?.time || '-']]]),
      H('รายการที่ขอเสนอราคา'), ...numbered([
        c.nights > 0 ? `ห้องพัก ${c.nights} คืน (ระบุประเภทห้องและจำนวนเตียง/ห้อง)` : 'ไม่ต้องการห้องพัก (ค่ายไป-กลับ)',
        `อาหารหลัก ${m.b + m.l + m.d} มื้อ (เช้า ${m.b} กลางวัน ${m.l} เย็น ${m.d})`,
        `อาหารว่าง ${m.s} มื้อ`,
        'ห้องประชุมสัมมนาจุได้ไม่น้อยกว่าจำนวนผู้เข้าร่วม พร้อมเครื่องเสียง โปรเจกเตอร์ และพื้นที่ทำกิจกรรมกลุ่ม',
        ...(c.nights > 0 ? ['ห้องพักวิทยากร'] : []),
        'พื้นที่เก็บอุปกรณ์กิจกรรม'
      ]),
      supplier ? P(`ข้อมูลประสานงานเดิมในระบบ: ${supplier}`, { sz: 14, color: '64748B' }) : P('', { after: 0 }),
      H('รายละเอียดกำหนดการสำหรับห้องประชุมและมื้ออาหาร'), ...plan.days.flatMap(d => [P(`วันที่ ${d.day}`, { b: true, after: 0 }), ...d.items.filter(r => /อาหาร|กิจกรรม|พิธี|AAR/.test(r.title)).map(r => P(`${r.time}  ${r.title}`, { sz: 14, indent: 1, after: 0 }))]),
      P('จึงเรียนมาเพื่อโปรดพิจารณาและตอบกลับ ขอขอบคุณอย่างสูง', { before: 8, indent: 1 }), P('', { after: 6 }), tbl([new TableRow({ children: [cell([P('')], W / 2), sign('ผู้ประสานงาน EQ Camp', c.contactName)] })], [W / 2, W / 2])];
  } else {
    body = [P('[เอกสารภายใน EQ CAMP — ห้ามส่งลูกค้า]', { b: true, color: 'B45309', al: CTR }), code(`RD ${c.docCode.replace(/^PL\s*/, '')}`),
      tbl([new TableRow({ children: [cell([
        P(`ต้นทุน ${money(c.costPerPerson)} บ./ท่าน × ${c.students} = ${money(cost)} บาท`, { sz: 15, after: 0 }),
        P(`ราคาขาย ${money(c.specialPrice)} บ./ท่าน × ${c.students} = ${money(total)} บาท`, { sz: 15, after: 0 }),
        P(`กำไรประเมิน ${money(profit)} บาท (Margin ${margin.toFixed(1)}%)${margin < 20 ? '  ⚠ ต่ำกว่า 20%' : ''}`, { b: true, sz: 16, color: profit < 0 ? 'DC2626' : '15803D', after: 0 }),
        P(`ซัพพลายเออร์/ผู้ติดต่อ: ${c.supplierNote || (VENUES.find(v => v.name === c.venue)?.note ?? '-')}`, { sz: 14, after: 0 })], W, { fill: 'FFFBEB', border: 'box' })] })], [W]),
      P('', { after: 4 }), ...scheduleBlock(c, plan, k, true)];
  }
  return new Document({ creator: 'EQ Camp', title: `${c.docCode} ${k.titleTh}`,
    styles: { default: { document: { run: { font: FONT, size: 32, sizeComplexScript: 32 } } } },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1253, right: 1253 } } }, children: body }] });
}
export const fileName = (kind: DocKind, c: Camp) => `${c.docCode.replace(/[^\w-]+/g, '_')}_${{ program: 'โปรแกรม', quotation: 'ใบเสนอราคา', booking: 'ขอราคาโรงแรม', runsheet: 'Rundown_INTERNAL' }[kind]}_${c.school.replace(/\s+/g, '')}.docx`;
