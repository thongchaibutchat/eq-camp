import {
  Document, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType,
  ShadingType, BorderStyle, ImageRun, PageBreak, VerticalAlign, Header, Footer, PageNumber, HeadingLevel, TableLayoutType
} from 'docx';
import { LETTERHEADS, regionOf, Region } from './letterheads-data';
export { LETTERHEADS, regionOf } from './letterheads-data';
export type { Region } from './letterheads-data';

/* ===================== TYPES ===================== */
import { COURSES, REF_ACTIVITIES, Course } from './eqcamp-data';
export { COURSES } from './eqcamp-data';
export type { Course } from './eqcamp-data';
import { COURSE_PHOTOS } from './course-photos-data';
export { COURSE_PHOTOS } from './course-photos-data';
import { STEAM_GALLERY } from './steam-gallery-data';
export { STEAM_GALLERY } from './steam-gallery-data';
import { BRAND } from './brand-data';
import { FULL_HEADERS } from './letterhead-full-data';
import { FONT_NAME, FONT_REG_B64, FONT_BOLD_B64 } from './font-data';
import JSZip from 'jszip';
import { Packer } from 'docx';
export { BRAND } from './brand-data';
export type Subject = 'math' | 'steam' | 'english' | 'ai' | 'chinese' | 'leadership';
export type DocKind = 'program' | 'quotation' | 'booking' | 'runsheet';
// รูปแบบระยะเวลา: half = ครึ่งวัน, day = ไป-กลับเต็มวัน, overnight = พักค้าง
export type DurationMode = 'half' | 'day' | 'overnight';
export interface Img { data?: Uint8Array; caption: string }
// slot = ดัชนีช่อง "กิจกรรมหลัก" (core) ทั่วทั้งกำหนดการ (0..N-1) ใช้ผูกกับ coreSlotIds เพื่อเลือกกิจกรรมรายช่วง
export interface Row { time: string; title: string; sub?: string[]; slot?: number }
export interface Day { day: number; items: Row[] }
export interface Camp {
  docCode: string; subject: Subject; courseCode?: string; school: string; level: string;
  /** รายการงบประมาณที่ทีมแก้เอง (ว่าง = ระบบสร้างอัตโนมัติจากที่พัก/มื้ออาหาร/ทีมงาน) */
  budgetItems?: string[];
  students: number; teachers: number; days: number; nights: number; durationMode: DurationMode;
  dates: string; province: string; region?: Region; venue: string; venueVisit: string; startTime: string; travelHours: number;
  normalPrice: number; specialPrice: number; costPerPerson: number;
  contactName: string; supplierNote: string; validDays: number; payTerms: string;
  activityIds: string[]; coreSlotIds?: string[]; actImgs: Img[]; venueImgs: Img[];
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
    extra: ['บูรณาการทักษะการคิดเชิงคำนวณ (Computational Thinking)', 'บูรณาการโครงงานฐานนวัตกรรมดิจิทัล'] },
  chinese: { label: 'ภาษาจีน', titleTh: 'ค่ายภาษาและวัฒนธรรมจีน', en: 'Chinese Language & Culture Camp 2026', field: 'ภาษาและวัฒนธรรมจีน',
    careers: 'ผู้ใช้ภาษาจีนเพื่อการสื่อสารและการประกอบอาชีพในอนาคต',
    extra: ['บูรณาการทักษะการฟัง พูด อ่าน เขียน ภาษาจีน', 'บูรณาการการเรียนรู้วัฒนธรรมข้ามชาติ'] },
  leadership: { label: 'ภาวะผู้นำ / EQ', titleTh: 'ค่ายพัฒนาสมรรถนะและภาวะผู้นำ', en: 'Leadership & Competency Camp 2026', field: 'สมรรถนะ ภาวะผู้นำ และความฉลาดทางอารมณ์ (EQ)',
    careers: 'ผู้นำ นักจัดการ และผู้ที่ทำงานร่วมกับผู้อื่นได้อย่างมีประสิทธิภาพ',
    extra: ['บูรณาการทักษะการทำงานเป็นทีมและการสื่อสาร', 'บูรณาการการพัฒนา EQ ควบคู่ IQ'] }
};

export type Kind = 'opening' | 'core' | 'night' | 'recreation' | 'closing';
export interface Activity { id: string; subjects: Subject[]; kind: Kind; title: string; desc?: string; draft?: boolean; courseCode?: string }
const ALL: Subject[] = ['math', 'steam', 'english', 'ai', 'chinese', 'leadership'];
// คลังกิจกรรมมาตรฐาน EQ Camp — ครบทุกวิชา กิจกรรมหลักมากพอเติมค่าย 4 วันโดยไม่ซ้ำ
// (ชุดคณิต/STEAM ดึงจากไฟล์จริง PL 0109 / PL 0110 ; อังกฤษ/AI เป็นชุดมาตรฐานพร้อมใช้ แก้ชื่อได้)
// จัดรูปชื่อกิจกรรมให้เรียบร้อยแบบเอกสารทางการ: เครื่องหมายคำพูดไทย “ ” ไม่มีช่องว่างเกิน
export function tidyTitle(t: string): string {
  let n = 0;
  let s = t.replace(/"/g, () => (n++ % 2 === 0 ? '“' : '”'));
  s = s.replace(/“\s+/g, '“').replace(/\s+”/g, '”').replace(/([^\s(])“/g, '$1 “').replace(/”(?=[^\s.,)])/g, '” ');
  return s.replace(/\s{2,}/g, ' ').replace(/\s*EP\.\s*(\d+)/gi, ' EP.$1').trim();
}
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
  { id: 'x-next', subjects: ALL, kind: 'closing', title: 'กิจกรรม “The Next Step”' },
  /* ---------- กิจกรรมจริงจากคลัง 14 หลักสูตร (รหัส ref-, สถานะ "รอตรวจ") ---------- */
  ...REF_ACTIVITIES.map(a => ({ id: a.id, subjects: [a.family as Subject], kind: a.kind as Kind, title: tidyTitle(a.title), courseCode: a.course, draft: true }))
];
// หลักสูตร (ธีม) จริง 14 รายการ — ใช้เลือกคลังกิจกรรมเฉพาะธีม
export const courseById = (code?: string): Course | undefined => COURSES.find(c => c.code === code);
// รหัสเอกสารอ้างจากรหัสหลักสูตรจริง (เช่น PL STM 0101 → "PL STM 0101/2569") — ไม่เดา/ไม่มั่ว
export const docCodeFor = (code?: string): string => code ? `${code}/2569` : '';
// ภาพกิจกรรมจริงของทีม (ฝังในคลัง course-photos-data) — มีเฉพาะหลักสูตรที่ทีมอัปโหลดแล้ว
// สถานะลิขสิทธิ์เผยแพร่: รอทีมรับรอง — UI ติดธงเตือนก่อนส่งลูกค้า
export const hasCoursePhotos = (code?: string): boolean => !!(code && COURSE_PHOTOS[code] && COURSE_PHOTOS[code].length);
export function coursePhotos(code?: string, max = 4): Img[] {
  if (!code || !COURSE_PHOTOS[code]) return [];
  const name = (courseById(code)?.name || '').replace(/\s*\([^)]*\)\s*$/, '').replace(/^หลักสูตรค่าย\s*/, '').replace(/^ค่าย/, '');
  return COURSE_PHOTOS[code].slice(0, max).map((p, i) => ({ data: b64bytes(p.b64), caption: `บรรยากาศกิจกรรมค่าย${name} (${i + 1})`.slice(0, 90) }));
}
// สรุป "ฐานข้อมูลของค่าย/หลักสูตร" หนึ่งรายการ — รวมทุกอย่างที่ผูกกับ CUR นั้น (ใช้ในหน้าฐานข้อมูลค่าย)
export interface CourseDataset { course: Course; actsByKind: { kind: Kind; items: Activity[] }[]; total: number; draftCount: number; photoCount: number; photos: { b64: string; w: number; h: number }[] }
export function courseDataset(code: string): CourseDataset | undefined {
  const course = courseById(code); if (!course) return undefined;
  const acts = LIB.filter(a => a.courseCode === code);
  const kinds: Kind[] = ['opening', 'core', 'night', 'recreation', 'closing'];
  return {
    course,
    actsByKind: kinds.map(kind => ({ kind, items: acts.filter(a => a.kind === kind) })).filter(g => g.items.length),
    total: acts.length,
    draftCount: acts.filter(a => a.draft).length,
    photoCount: COURSE_PHOTOS[code]?.length || 0,
    photos: COURSE_PHOTOS[code] || []
  };
}
export const VENUES = [
  { province: 'เลย', name: 'โรงแรมเชียงคานฮิลล์รีสอร์ท', visit: 'ถนนวัฒนธรรมเชียงคาน / ชมวิวทะเลหมอก ณ ภูทอก อำเภอเชียงคาน จังหวัดเลย', note: 'พร้อมห้องประชุมและสระว่ายน้ำ' },
  { province: 'ระยอง', name: 'โรงแรมโกลเด้น ซิตี้ ระยอง', visit: 'ศูนย์การเรียนรู้ด้านพลังงาน / สถานแสดงพันธุ์สัตว์น้ำระยอง', note: 'คุณทราย 088-6171446 (ห้องประชุมจุได้สูงสุด 1,800 คน)' },
  { province: 'ระยอง', name: 'ปาล์มมาลี บีช รีสอร์ท ระยอง', visit: 'สวนพฤกษศาสตร์ระยอง / สวนสุภัทราแลนด์', note: 'คุณโต้ง 096-9817556' },
  { province: 'นครนายก', name: 'ธารา ชลพฤกษ์ รีสอร์ท', visit: 'เขื่อนขุนด่านปราการชล / ศูนย์ภูมิรักษ์ธรรมชาติ', note: 'คุณเป้ 089-7790126 (ห้องประชุมจุได้ 300 คน)' },
  { province: 'ชลบุรี', name: 'สวนนงนุช พัทยา รีสอร์ท', visit: 'ทัศนศึกษาสวนนงนุชและหุบเขาไดโนเสาร์', note: 'คุณฟ้า 092-2928296' },
  { province: 'กาญจนบุรี', name: 'เฟลิกซ์ ริเวอร์แคว รีสอร์ท', visit: 'พิพิธภัณฑ์ธรณีศาสตร์ ม.มหิดล กาญจนบุรี / ถ้ำกระแซ', note: 'คุณปุ้ย 062-3599138' }
];
// สาขา/ที่อยู่รายภาค — แหล่งเดียวกับหัวกระดาษ (ภาคใต้ยังไม่มีข้อมูล: ห้ามเดา)
export const BRANCHES: { region: string; address: string; phone?: string; note?: string }[] = [
  { region: 'ภาคกลาง (กรุงเทพฯ)', address: '523 ม.4 แขวงบางปะกอก เขตราษฎร์บูรณะ กรุงเทพมหานคร 10140', note: 'จากเอกสารจริงของทีม' },
  { region: 'ภาคอีสาน (สำนักงานใหญ่)', address: '289/69 ไพรเวท พาร์ค วิลล์ ม.4 ต.หนองบัว อ.เมือง จ.อุดรธานี 41000', phone: '065 4919415 / 099 2394747' },
  { region: 'ภาคเหนือ (เชียงใหม่)', address: '62 ม.10 ต.ป่าไผ่ อ.สันทราย จ.เชียงใหม่ 50210' },
  { region: 'ภาคใต้', address: '', note: 'ยังไม่มีข้อมูล — เอกสารใช้ที่อยู่อุดรแทน' }
];
// ชุดข้อมูลขายบน Drive (ทีมแก้ที่นี่ แล้วสั่ง "อัปเดตข้อมูล") — ไม่ใส่ลิงก์โฟลเดอร์ต้นทุน (99) ในเว็บ
export const SALES_KIT = {
  folder: 'https://drive.google.com/drive/folders/16dCNDLqlhF41TvGaJV9v8DxUfetc-xaE',
  sheets: [
    { label: 'วิธีใช้', url: 'https://docs.google.com/document/d/1e6TCfp_o3sPTrzLqPiD-3cxyIFRg81yvxOs_2Ygb9BY/edit' },
    { label: 'หลักสูตร', url: 'https://docs.google.com/spreadsheets/d/1AnEwrclPR8awYijL9Ya4rp8vno7U4fzs7CmHkGG4oZo/edit' },
    { label: 'กิจกรรม', url: 'https://docs.google.com/spreadsheets/d/1Q5OxyIc4Hso9Jg9ckOkMlu8jNVIcxZlglFQmiGwP16c/edit' },
    { label: 'ที่พัก', url: 'https://docs.google.com/spreadsheets/d/1llVOOIK7q_oZigDqdKYUNfmeTSu-JhRkJTY3_ybZ4mM/edit' },
    { label: 'ราคาขาย', url: 'https://docs.google.com/spreadsheets/d/1mBUpngNJrpFtxZdfNELjB4PQFVwWE8To_6uwHhJzx1w/edit' },
    { label: 'ภาพ', url: 'https://docs.google.com/spreadsheets/d/15N65FFPhhq5gFUDtneJ1Gv2IkELSYsuF91-2rhtresA/edit' },
    { label: 'บริษัท-สาขา', url: 'https://docs.google.com/spreadsheets/d/1GxlcaIskicpT_u8Csd4SfzcqaH-wj7PIG1Iquj2sLQg/edit' },
    { label: 'บันทึกการแก้ไข', url: 'https://docs.google.com/spreadsheets/d/1BNTIKO0ECwCCNAi_rfeYfVGc4oDtPS61-65UPtl171E/edit' }
  ],
  courseFolders: {
    'PL STM 0101': '1UKieUmdXC9FueJXB4YbZJfJc8488EfDl', 'PL LEA 0102': '1kBU6_HhTJ70HEH5jmC7XOn5R1u1gcdU8', 'PL SEA 0103': '1XfkNZwMq6tJBnsI8HRUnW5HiJwMd8qiM',
    'PL ENG 0104': '1SyuI0n1V5-oZJF06kJqEmLsMCkKR0KZy', 'PL PRE 0105': '16rcaSrrCOBviN4VcjUmKn24i04x7EyTa', 'PL ENV 0106': '1KQoka073l29N1bx7k2RZjE0E5TlxJosx',
    'PL MAT 0107': '1t6fgh-k66GVCORbVXDnkSDRqFyQCdTKm', 'PL AST 0108': '1cuaUnXLxkc3z4E-DSlBvCcpSmbmL8IYG', 'PL CHI 0109': '1KiSNHqG3w-IewScwgtj_1TIftKkZxqx2',
    'PL FOR 0110': '1LCA5Kt938CdlDyRTrMP2qDNu8yX-MRtG', 'PL COD 0111': '1-JD4ZrsvOcxedlbygBq20YnqkKIhFhUF', 'PL GEO 0112': '1SRQUpYbXajEm96RQEHQahZID-DI5maRM',
    'PL ITD 0113': '1mpnyUgTnyRVwiGY1zKwPVt2aPj-ZVaMl', 'PL TI 0116': '1Nx9cF6eukj1tgzWgXfAZ73OLqc0O0TbT'
  } as Record<string, string>,
  venueFolders: {
    'โรงแรมเชียงคานฮิลล์รีสอร์ท': '1fPfkyOyhzkK5DYRTOdwlsUy7pl-TShv_', 'โรงแรมโกลเด้น ซิตี้ ระยอง': '1T9AWbBx-LGbxXFsDrLh94Nfde6NMNBsW',
    'ปาล์มมาลี บีช รีสอร์ท ระยอง': '19Qt0XMsgkxqNB4QyrcCvSH4lYV5tm0hp', 'ธารา ชลพฤกษ์ รีสอร์ท': '1WFgEO3PYknLl9soMKNaXb6qxK4lS1jl6',
    'สวนนงนุช พัทยา รีสอร์ท': '1vGwZJ6SzsGDCAvs0a1Vagr9RtWziOvcV', 'เฟลิกซ์ ริเวอร์แคว รีสอร์ท': '1Y5Gih0ET7LQORQkGvXnpUlUKYZKhukoA'
  } as Record<string, string>
};
export const driveFolder = (id?: string) => id ? `https://drive.google.com/drive/folders/${id}` : undefined;
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
// งานใหม่เริ่มจาก "ค่าว่างจริง" — ไม่มีสถานที่/ทัศนศึกษา/ราคาตัวอย่าง เพื่อไม่ให้ค่างานเก่ารั่วเข้าเอกสาร
// (โครงสร้างเริ่มต้นเป็น overnight 2 วัน 1 คืน แต่ validation จะจับฟิลด์ที่ยังว่าง)
export const blankCamp = (): Camp => ({
  docCode: 'PL 0000/2569', subject: 'math', school: 'โรงเรียน...', level: 'ม.1-2', students: 0, teachers: 0, days: 2, nights: 1,
  dates: 'วันที่ ...', durationMode: 'overnight', province: '', venue: '', venueVisit: '', startTime: '07.00', travelHours: 3,
  normalPrice: 0, specialPrice: 0, costPerPerson: 0, contactName: 'ฝ่ายขาย EQ Camp', supplierNote: '',
  validDays: 30, payTerms: 'ชำระตามเงื่อนไขที่ตกลงกับโรงเรียน (ปรับแก้ตามนโยบายบริษัท)',
  activityIds: [], coreSlotIds: [], actImgs: [], venueImgs: [], extraActivities: []
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
  const dayTrip = /ไป\s*-?\s*กลับ|ไปกลับ|เช้า\s*-?\s*เย็น|วันเดย์|day\s*camp|one[-\s]?day|ไม่พักค้าง|ไม่ค้างคืน/i.test(text);
  // ระบุทั้งวันและคืน
  if (days !== null && nights !== null) {
    if (nights === 0) return { mode: 'day', days: Math.max(1, days), nights: 0, resolved: true, ambiguous: false };
    if (nights === days - 1) return { mode: 'overnight', days, nights, resolved: true, ambiguous: false };
    // ขัดแย้งกัน เช่น "1 วัน 2 คืน"
    return { mode: 'overnight', days: Math.max(days, nights + 1), nights, resolved: true, ambiguous: true, note: `บรีฟระบุ ${days} วัน ${nights} คืน ซึ่งไม่สอดคล้องกัน (ปกติ วัน = คืน + 1) โปรดยืนยัน` };
  }
  // ระบุเฉพาะคืน
  if (nights !== null) {
    if (nights === 0) return { mode: 'day', days: 1, nights: 0, resolved: true, ambiguous: false };
    return { mode: 'overnight', days: nights + 1, nights, resolved: true, ambiguous: false };
  }
  // ระบุเฉพาะวัน
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
// นำผล extraction จาก AI (JSON) มาลงฟอร์มอย่างปลอดภัย — ตรวจชนิด/ช่วงค่า ไม่ coerce null เป็น 0
export interface ExtractResult { camp: Camp; applied: string[]; missing: string[]; warnings: string[] }
export function applyExtraction(base: Camp, r: any): ExtractResult {
  const c: Camp = { ...base };
  const applied: string[] = [], missing: string[] = [], warnings: string[] = [];
  const has = (v: any) => v !== null && v !== undefined && v !== '';
  const str = (k: keyof Camp) => { const v = r?.[k]; if (typeof v === 'string' && v.trim()) { (c as any)[k] = v.trim(); applied.push(k as string); } else missing.push(k as string); };
  const numf = (k: keyof Camp, o: { min?: number; allowZero?: boolean; int?: boolean } = {}) => {
    const raw = r?.[k]; const { min = 0, allowZero = false, int = false } = o;
    if (!has(raw)) { missing.push(k as string); return; }
    let v = Number(raw);
    if (!Number.isFinite(v)) { warnings.push(`${k as string}: ไม่ใช่ตัวเลข (${raw})`); missing.push(k as string); return; }
    if (int) v = Math.round(v);
    if (v < min || (!allowZero && v === 0)) { warnings.push(`${k as string}: ค่าไม่ถูกต้อง (${raw})`); missing.push(k as string); return; }
    (c as any)[k] = v; applied.push(k as string);
  };
  str('docCode'); str('school'); str('level'); str('dates'); str('province'); str('venue'); str('venueVisit'); str('startTime');
  numf('students', { min: 1, int: true }); numf('teachers', { min: 0, allowZero: true, int: true });
  numf('normalPrice', { min: 1 }); numf('specialPrice', { min: 1 }); numf('travelHours', { min: 0, allowZero: true });
  if (['math', 'steam', 'english', 'ai', 'chinese', 'leadership'].includes(r?.subject)) { c.subject = r.subject; applied.push('subject'); } else missing.push('subject');
  // หลักสูตร (ธีม) จาก AI หรือเดาจากข้อความชื่อหลักสูตร
  if (typeof r?.courseCode === 'string' && COURSES.some(x => x.code === r.courseCode)) { c.courseCode = r.courseCode; c.subject = courseById(r.courseCode)!.family as Subject; applied.push('course'); }
  else if (typeof r?.courseName === 'string') { const cc = detectCourse(r.courseName); if (cc) { c.courseCode = cc.code; c.subject = cc.family as Subject; applied.push('course'); } }
  // ระยะเวลา: ใช้ก็ต่อเมื่อมีสัญญาณจริง (durationMode/days/nights) — ไม่เช่นนั้นคงค่าเดิมและเตือน
  const dmOK = ['half', 'day', 'overnight'].includes(r?.durationMode);
  const dOK = has(r?.days) && Number.isFinite(Number(r.days));
  const nOK = has(r?.nights) && Number.isFinite(Number(r.nights));
  if (dmOK || dOK || nOK) {
    if (dmOK) c.durationMode = r.durationMode;
    if (dOK) c.days = Math.min(7, Math.max(1, Math.round(Number(r.days))));
    if (nOK) c.nights = Math.max(0, Math.round(Number(r.nights)));
    if (!dmOK) c.durationMode = c.nights > 0 ? 'overnight' : (c.days <= 1 ? 'day' : 'overnight');
    applied.push('duration');
  } else { missing.push('duration'); warnings.push('อ่านระยะเวลาจากบรีฟไม่ได้ — คงค่าเดิมไว้ โปรดเลือกเองในแท็บ 2'); }
  const norm = normalizeDuration(c);
  if (norm.courseCode && (applied.includes('course') || !norm.activityIds.length)) {
    norm.activityIds = defaultCourseActs(norm.courseCode); norm.coreSlotIds = [];
  } else if (!norm.courseCode && (!norm.activityIds.length || applied.includes('subject'))) {
    norm.activityIds = defaultActs(norm.subject).concat(norm.extraActivities.filter(a => a.subjects.includes(norm.subject)).map(a => a.id)); norm.coreSlotIds = [];
  }
  // รหัสเอกสารจากรหัสหลักสูตรจริง ถ้า AI ไม่ได้ให้ docCode ที่ถูกแบบมาเอง
  if (norm.courseCode && !/^PL\s/i.test(String(r?.docCode || '').trim())) norm.docCode = docCodeFor(norm.courseCode);
  return { camp: norm, applied, missing, warnings };
}
// เติม durationMode ให้ข้อมูลรุ่นเก่า (ก่อนมีฟิลด์นี้) แล้ว normalize
export function migrateCamp(raw: any): Camp {
  const out: Camp = { ...blankCamp(), ...raw, coreSlotIds: Array.isArray(raw?.coreSlotIds) ? raw.coreSlotIds : [], extraActivities: raw?.extraActivities || [] };
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
  // รหัสเอกสาร: รองรับทั้งแบบเก่า (PL 0109/2569) และแบบอ้างรหัสหลักสูตรจริง (PL STM 0101/2569)
  if ((m = t.match(/(PL\s*[A-Z]{2,4}\s*\d{3,4}\s*\/\s*\d{4}|PL\s*\d+\s*\/\s*\d{4})/i))) c.docCode = m[1].toUpperCase().replace(/\s+/g, ' ').replace(/\s*\/\s*/, '/');
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
  // จับคู่ด้วย "ชื่อเฉพาะ" (ตัดคำนำหน้าทั่วไป โรงแรม/รีสอร์ท ออกก่อน) — กันจับผิด เช่น เชียงใหม่ฮิลล์ ≠ เชียงคานฮิลล์
  const core = (s: string) => s.replace(/^(โรงแรม|รีสอร์ท|ณ)\s*/g, '').replace(/\s+/g, '');
  const known = VENUES.find(x => {
    const key = core(x.name).slice(0, 8);
    if (key.length < 5) return false;
    const vt = core(venueText);
    return venueText ? vt.includes(key) || (vt.length >= 5 && core(x.name).includes(vt.slice(0, 8))) : t.replace(/\s+/g, '').includes(key);
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
  // ตรวจจับหลักสูตร (ธีม) จริงจากบรีฟก่อน — ได้คลังกิจกรรมตรงธีม
  const course = detectCourse(t);
  const prev = c.subject, prevCourse = c.courseCode;
  if (course) { c.courseCode = course.code; c.subject = course.family as Subject; }
  else {
    if (/steam|สะตีม|สะเต็ม|วิทย์/i.test(t)) c.subject = 'steam';
    else if (/จีน|chinese|แมนดาริน/i.test(t)) c.subject = 'chinese';
    else if (/ผู้นำ|leadership|\beq\b/i.test(t)) c.subject = 'leadership';
    else if (/อังกฤษ|english/i.test(t)) c.subject = 'english';
    else if (/\bai\b|coding|โค้ด|โดรน|หุ่นยนต์/i.test(t)) c.subject = 'ai';
    else if (/คณิต|math/i.test(t)) c.subject = 'math';
  }
  if (c.courseCode && c.courseCode !== prevCourse) { c.activityIds = defaultCourseActs(c.courseCode); c.coreSlotIds = []; }
  else if (!c.courseCode && (!base.activityIds.length || c.subject !== prev)) { c.activityIds = defaultActs(c.subject); c.coreSlotIds = []; }
  // รหัสเอกสารต้องอ้างจากรหัสหลักสูตรจริงเท่านั้น (ห้ามเดา) — ผูกหลักสูตรแล้วตั้ง docCode จากรหัสนั้น ถ้าบรีฟยังไม่ได้ระบุรหัสเอง
  if (c.courseCode && (!/^PL\s/i.test(c.docCode) || c.docCode === base.docCode)) c.docCode = docCodeFor(c.courseCode);
  return c;
}
// ตรวจจับหลักสูตร (ธีม) จากข้อความบรีฟ ด้วยคีย์เวิร์ดเฉพาะธีม
const COURSE_KEYS: [string, RegExp][] = [
  ['PL SEA 0103', /ทะเล|marine|ชายหาด|ปะการัง|ใต้ท้องทะเล/i],
  ['PL GEO 0112', /ธรณี|หิน|แร่|geolog/i],
  ['PL AST 0108', /ดารา\s*ศาสตร์|astro|ดวงดาว|จักรวาล|ท้องฟ้าจำลอง/i],
  ['PL FOR 0110', /นิติ\s*วิทย|forensic|สืบสวน|ชีววิทยา/i],
  ['PL TI 0116', /โดรน|drone/i],
  ['PL COD 0111', /หุ่นยนต์|robot|โค้ดดิ้ง|coding/i],
  ['PL ITD 0113', /สตาร์ท\s*อัพ|startup|ดิจิทัล|ธุรกิจ/i],
  ['PL CHI 0109', /จีน|chinese|แมนดาริน|mandarin/i],
  ['PL LEA 0102', /ผู้นำ|leadership|สมรรถนะ|\beq\b/i],
  ['PL PRE 0105', /pre[-\s]?genius|อัจฉริยะ|คณิต.*วิทย|วิทย.*คณิต/i],
  ['PL ENV 0106', /สิ่งแวดล้อม|environment/i],
  ['PL ENG 0104', /อังกฤษ|english/i],
  ['PL MAT 0107', /คณิต|math/i],
  ['PL STM 0101', /steam|stem|สะตีม|สะเต็ม/i]
];
export function detectCourse(text: string): Course | undefined {
  for (const [code, re] of COURSE_KEYS) if (re.test(text)) return COURSES.find(c => c.code === code);
  return undefined;
}
// เลือกกิจกรรมเริ่มต้นให้ครบชุดสำหรับวิชานั้น (ชุดเดิม ไม่รวมกิจกรรมหลักสูตรจริง)
export const defaultActs = (s: Subject) => LIB.filter(a => !a.courseCode && a.subjects.includes(s)).map(a => a.id);
// เลือกกิจกรรมเริ่มต้นของหลักสูตรจริง (CUR) + เติมสันทนาการ/ปิด/เปิดกลางถ้าหลักสูตรไม่มี
export const defaultCourseActs = (code: string): string[] => {
  const own = LIB.filter(a => a.courseCode === code);
  const ids = own.map(a => a.id);
  const kinds = new Set(own.map(a => a.kind));
  if (!kinds.has('recreation')) ids.push('x-boost');
  if (!kinds.has('closing')) ids.push('x-next');
  if (!kinds.has('opening')) ids.push('o-ice');
  return ids;
};

/* ===================== SCHEDULE ENGINE ===================== */
const fmt = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}.${String(Math.round(m % 60)).padStart(2, '0')}`;
const rng = (a: number, b: number) => `${fmt(a)} – ${fmt(b)} น.`;
const ANCH: Record<string, number> = { breakfast: 450, lunch: 720, dinner: 1080 };
const FIX: Record<string, number> = { snack: 15, trip: 90, checkin: 45, register: 30, arrive: 30, opening: 60, summary: 30, night: 60, aar: 45, award: 30, checkout: 60, recreation: 30, closing: 30 };
// สูตรจำนวนทีมงาน (ตายตัว ตามนโยบาย EQ Camp) — ห้ามเปลี่ยน:
//   25–50 คน → 4–5 ท่าน · 50–80 → 6–8 · 80–120 → 6–8 · 120–180 → 8–12 · 180–300 → 10–16
export const staffText = (n: number): string => {
  if (n <= 50) return '4 – 5';
  if (n <= 120) return '6 – 8';
  if (n <= 180) return '8 – 12';
  return '10 – 16';
};

export interface Plan { days: Day[]; meals: { b: number; l: number; d: number; s: number }; coreSlots: number; hasTrip: boolean; usedActivityIds: string[] }
// คลังกิจกรรมที่ใช้ได้: ถ้าเลือกหลักสูตร (courseCode) → กิจกรรมจริงของหลักสูตรนั้น + สันทนาการ/ปิด/เปิดกลาง; ไม่งั้น → ตาม subject (ชุดเดิม)
// ความเฉพาะของกิจกรรม: ชื่อเดียวกันปรากฏในกี่หลักสูตร (1 = เฉพาะหลักสูตรนี้) — ใช้เรียงให้กิจกรรมประจำหลักสูตรมาก่อนกิจกรรมกลาง
const normTitle = (t: string) => t.replace(/[“”"'\s]/g, '').replace(/EP\.?\d+$/i, '').toLowerCase();
const SHARED: Record<string, number> = (() => {
  const m: Record<string, Set<string>> = {};
  for (const a of LIB) if (a.courseCode) (m[normTitle(a.title)] = m[normTitle(a.title)] || new Set()).add(a.courseCode);
  const out: Record<string, number> = {}; for (const k in m) out[k] = m[k].size; return out;
})();
const sharedCount = (a: Activity) => SHARED[normTitle(a.title)] || 1;
// ค่ายที่ใช้แพทเทิร์น STEAM (STEAM Mission / 5 STEPs / ภาพเซ็ต STEAM) — เฉพาะหลักสูตร STEAM จริง ไม่ใช่วิทย์สายอื่น (ดาราศาสตร์/ธรณี/ทะเล ฯลฯ)
export const isSteamProgram = (c: Camp) => c.courseCode ? c.courseCode === 'PL STM 0101' : c.subject === 'steam';
// ชื่อหลักสูตรแบบสั้น (ไทย) ใช้ในประโยคกำหนดการ เช่น "ดาราศาสตร์"
export const courseShortTh = (c: Camp): string => {
  const co = courseById(c.courseCode);
  if (!co) return SUBJECTS[c.subject].field;
  return co.name.replace(/\s*\([^)]*\)\s*$/, '').replace(/^หลักสูตรค่าย\s*/, '').replace(/^ค่าย(บูรณาการ)?(วิชาการ)?/, '').trim();
};
export function subjectPool(c: Camp): Activity[] {
  const extras = c.extraActivities.filter(a => a.subjects.includes(c.subject));
  if (c.courseCode) {
    // กิจกรรมของหลักสูตร — เรียงกิจกรรมเฉพาะหลักสูตรก่อน (stable) แล้วค่อยกิจกรรมที่ใช้ร่วมกับหลายหลักสูตร
    const courseActs = LIB.filter(a => a.courseCode === c.courseCode).map((a, i) => ({ a, i }))
      .sort((x, y) => (sharedCount(x.a) - sharedCount(y.a)) || (x.i - y.i)).map(x => x.a);
    const kinds = new Set(courseActs.map(a => a.kind));
    const generics = LIB.filter(a => !a.courseCode && a.subjects.length >= 6 && !kinds.has(a.kind)); // เติม recreation/closing/opening กลางที่หลักสูตรไม่มี
    return [...courseActs, ...generics, ...extras];
  }
  return [...LIB.filter(a => !a.courseCode && a.subjects.includes(c.subject)), ...extras];
}
export function buildSchedule(c: Camp): Plan {
  const pool = subjectPool(c);
  const sel = pool.filter(a => c.activityIds.includes(a.id));
  const of = (k: Kind) => { const r = sel.filter(a => a.kind === k); return r.length ? r : pool.filter(a => a.kind === k).slice(0, 1); };
  // หัวข้อสำรองเมื่อคลัง/หลักสูตรไม่มีกิจกรรมชนิดนั้น (กันพัง และไม่ให้ช่องว่าง)
  const FALLBACK: Record<string, string> = { opening: 'กิจกรรมเปิดค่าย / สันทนาการสร้างสัมพันธ์', night: 'กิจกรรมภาคค่ำ (Night Activity)', recreation: 'กิจกรรมสันทนาการ', closing: 'กิจกรรมสรุปและปิดค่าย' };
  // ผูกหลักสูตร: ช่องภาคค่ำ/สันทนาการ ถ้าหลักสูตรไม่มีกิจกรรมชนิดนั้นโดยตรง ให้หยิบ "กิจกรรมของหลักสูตรเอง" ที่เข้าลักษณะก่อน
  // (เช่น ดาราศาสตร์ → ภาคค่ำ = มองดาวผ่านกล้อง) — ใช้ของกลางเป็นทางเลือกสุดท้ายเท่านั้น
  // คีย์เวิร์ดเรียงตามลำดับความเหมาะ (กลุ่มแรกเหมาะที่สุด) — หาเฉพาะกิจกรรมหลักของหลักสูตร ไม่หยิบกิจกรรมเปิด/ปิดค่ายมาใช้ซ้ำ
  const KW: Partial<Record<Kind, RegExp[]>> = {
    night: [/กล้อง|มองดาว|ดูดาว|ส่องดาว|stargaz/i, /การแสดง|show|night|ค่ำ|กองไฟ|camp\s*fire|ปาร์ตี้|party|talent|showcase|networking/i],
    recreation: [/นันทนาการ|fun|morning|boost/i, /สันทนาการ/i]
  };
  const courseOwnList = (k: Kind): Activity[] => {
    if (!c.courseCode || !KW[k]) return [];
    const cand = [...sel, ...pool].filter((a, i, arr) => arr.indexOf(a) === i && a.courseCode === c.courseCode && a.kind !== 'opening' && a.kind !== 'closing');
    const out: Activity[] = [];
    for (const re of KW[k]!) for (const a of cand) if (re.test(a.title) && !out.includes(a)) out.push(a);
    return out;
  };
  const reserved: Partial<Record<Kind, Activity[]>> = {};
  for (const k of (c.durationMode === 'overnight' ? ['night', 'recreation'] : []) as Kind[]) {
    const direct = of(k)[0];
    if (direct && (direct.courseCode || !c.courseCode)) continue;      // มีกิจกรรมชนิดนี้ของหลักสูตรอยู่แล้ว
    const own = courseOwnList(k).filter(a => !Object.values(reserved).some(l => l!.includes(a)));
    if (own.length) reserved[k] = own.slice(0, k === 'night' ? Math.max(1, c.nights) : 1);
  }
  const useN: Partial<Record<Kind, number>> = {};
  const pick1 = (k: Kind): Activity => {
    const list = reserved[k];
    if (list && list.length) { const i = useN[k] || 0; useN[k] = i + 1; return list[i % list.length]; } // หลายคืน → หมุนกิจกรรมของหลักสูตร
    const direct = of(k)[0];
    if (direct && (direct.courseCode || !c.courseCode || k === 'opening' || k === 'closing')) return direct;
    // หลักสูตรไม่มีกิจกรรมชนิดนี้ → ใช้กิจกรรมมาตรฐานของ "วิชาเดียวกัน" (เช่น อังกฤษ → English Night Show) ก่อนของกลาง
    const sameSubject = LIB.find(a => !a.courseCode && a.kind === k && a.subjects.length === 1 && a.subjects[0] === c.subject);
    return sameSubject || direct || ({ id: `fb-${k}`, subjects: [c.subject], kind: k, title: FALLBACK[k] || 'กิจกรรมค่าย' } as Activity);
  };
  const reservedIds = new Set(Object.values(reserved).flatMap(l => l!.map(a => a.id)));
  // รายการเติมช่องกิจกรรมหลัก: ที่เลือกก่อน แล้วตามด้วยที่เหลือในคลัง (ไม่ซ้ำกับที่จองไว้ภาคค่ำ/สันทนาการ)
  const selCores = sel.filter(a => a.kind === 'core' && !reservedIds.has(a.id));
  const poolCores = pool.filter(a => a.kind === 'core' && !reservedIds.has(a.id));
  const fillCores = (selCores.length ? [...selCores, ...poolCores.filter(a => !selCores.includes(a))] : poolCores);
  const cores = fillCores;
  const meals = { b: 0, l: 0, d: 0, s: 0 }; let mealNo = 0, coreIdx = 0, coreSlots = 0, hasTrip = false;
  const used: string[] = [];
  const act = (a?: Activity): Row['sub'] => { if (a?.id) used.push(a.id); return a?.desc ? [a.desc] : []; };
  const days: Day[] = [];
  // กันค่าเวลา/ชั่วโมงเดินทางที่อ่านไม่ได้ (NaN) ไม่ให้เวลาในตารางกลายเป็น "NaN.NaN"
  const hh = parseInt(c.startTime?.split(/[.:]/)[0]); const mm = parseInt(c.startTime?.split(/[.:]/)[1] || '0');
  const startMin = Math.round((Number.isFinite(hh) ? hh : 7) * 60 + (Number.isFinite(mm) ? mm : 0));
  const travelH = Number.isFinite(c.travelHours) && c.travelHours >= 0 ? c.travelHours : 0;
  // ===== Day Camp (จัดที่โรงเรียน ไป-กลับ) — แพทเทิร์นมาตรฐาน 08.30–16.00 ไม่มีเดินทาง/พักค้าง =====
  if (c.durationMode === 'day') {
    // แพทเทิร์น STEAM (5 STEPs + STEAM Mission) ใช้กับหลักสูตร STEAM เท่านั้น — หลักสูตรอื่นใช้ชื่อและกิจกรรมของหลักสูตรนั้นเอง
    const isSteam = isSteamProgram(c);
    const topic = courseShortTh(c);
    const introTitle = isSteam
      ? 'เรียนรู้พื้นฐาน STEM ด้วยกระบวนการ 5 STEPs Learning และหลักการออกแบบเชิงวิศวกรรม (Engineering Design Process : EDP)'
      : `ปูพื้นฐานความรู้ด้าน${topic} และชี้แจงภารกิจการเรียนรู้`;
    const mission = isSteam ? '“STEAM Mission”' : `ภารกิจการเรียนรู้ด้าน${topic}`;
    for (let d = 1; d <= c.days; d++) {
      const first = d === 1, last = d === c.days;
      let cur = 8 * 60 + 30; // 08.30 น.
      const items: Row[] = [];
      const put = (title: string, dur: number, sub?: string[]) => { items.push({ time: rng(cur, cur + dur), title, sub }); cur += dur; };
      const coreRow = (label: string, dur: number) => {
        const slotIdx = coreSlots; coreSlots++;
        const pick = c.coreSlotIds && c.coreSlotIds[slotIdx] ? pool.find(a => a.id === c.coreSlotIds![slotIdx]) : undefined;
        let name: string;
        if (pick) { name = pick.title; act(pick); }
        else if (cores.length) { const a = cores[coreIdx % cores.length]; const rep = Math.floor(coreIdx / cores.length) > 0; coreIdx++; name = rep ? `${a.title}\u00A0(ต่อ\u2060ยอด)` : a.title; act(a); }
        else name = 'กิจกรรมฐานการเรียนรู้เชิงบูรณาการ';
        if (isSteam) put(`กิจกรรม ${mission} ${label}`, dur, [name]);
        else put(name, dur);                                     // หลักสูตรอื่น: ชื่อกิจกรรมของหลักสูตรเป็นหัวข้อช่วงโดยตรง
        items[items.length - 1].slot = slotIdx;
      };
      // วันแรก: ลงทะเบียน+เปิดค่าย+ปูพื้นฐาน · วันถัดไป: ทบทวน+สันทนาการปลุกพลัง+ชี้แจงภารกิจประจำวัน (ไม่ซ้ำกิจกรรมเปิด)
      const ep = (d - 1) * 2;
      if (first) put('ลงทะเบียน / พิธีเปิด', 30); else put(`ทบทวนการเรียนรู้วันที่ ${d - 1}`, 30);
      { const a = first ? pick1('opening') : pick1('recreation'); put(a.title, 60, act(a)); }  // 09.00–10.00
      put(first ? introTitle : `ชี้แจงภารกิจการเรียนรู้ประจำวันที่ ${d}`, 20);                 // 10.00–10.20
      meals.s++; put(`รับประทานอาหารว่าง (${meals.s})`, 15);      // 10.20–10.35
      coreRow(`#EP.${ep + 1}`, 85);                              // 10.35–12.00
      meals.l++; put(`รับประทานอาหารกลางวัน (${++mealNo})`, 60);  // 12.00–13.00
      coreRow(`#EP.${ep + 2}`, 120);                             // 13.00–15.00
      meals.s++; put(`รับประทานอาหารว่าง (${meals.s})`, 15);      // 15.00–15.15
      const sumWhat = isSteam ? ` ${mission}` : `ด้าน${topic}`;
      put(last ? `สรุปการเรียนรู้${sumWhat} และถอดบทเรียน (AAR : After Action Review)` : `สรุปการเรียนรู้${sumWhat} ประจำวัน`, 45); // 15.15–16.00
      days.push({ day: d, items });
    }
    return { days, meals, coreSlots, hasTrip: false, usedActivityIds: used };
  }
  for (let d = 1; d <= c.days; d++) {
    const first = d === 1, last = d === c.days;
    const lateStart = startMin + travelH * 60 + 120 >= 11 * 60;
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
      // วันแรก: เลือกโครงตาม "เวลาถึงสถานที่" เพื่อไม่ให้มีช่วงว่างก่อนอาหารกลางวัน
      const arr = startMin + Math.round(travelH * 60) + 30;
      const day1 = arr <= 570 ? ['depart', 'arrive', 'register', 'opening', 'core', 'lunch', 'core', 'snack', 'trip', 'checkin', 'dinner', 'night', 'rest']   // ถึงก่อน 09.30
        : arr <= 660 ? ['depart', 'arrive', 'register', 'opening', 'lunch', 'core', 'snack', 'trip', 'checkin', 'dinner', 'night', 'rest']                  // ถึง 09.30–11.00
        : arr <= 750 ? ['depart', 'arrive', 'lunch', 'register', 'opening', 'core', 'snack', 'trip', 'checkin', 'dinner', 'night', 'rest']                  // ถึง 11.00–12.30
        : ['depart', 'arrive', 'register', 'opening', 'core', 'snack', 'checkin', 'dinner', 'night', 'rest'];                                             // ถึงบ่าย (ทานกลางวันระหว่างทาง)
      if (!c.venueVisit.trim()) for (let i = 0; i < day1.length; i++) if (day1[i] === 'trip') day1[i] = 'core'; // ไม่มีทัศนศึกษา → ใส่กิจกรรมหลักสูตรแทน ไม่ปล่อยช่วงว่าง
      T = first ? day1
        : last ? ['breakfast', 'checkout', 'recreation', 'closing', 'aar', 'award', 'lunch', 'return']
        : ['breakfast', 'core', 'snack', 'core', 'lunch', 'core', 'snack', 'core', 'summary', 'free', 'dinner', 'night', 'rest'];
      void lateStart;
    }
    let cur = (first || c.durationMode !== 'overnight') ? startMin : 0;
    // ครึ่งวัน: จำกัดให้กิจกรรมจบในหน้าต่างราว 3.5 ชม. หลังถึงสถานที่ (กันลากยาวเป็นเต็มวัน)
    const coreCap = c.durationMode === 'half' ? startMin + Math.round(travelH * 60) + 30 + 210 : 16.5 * 60;
    const items: Row[] = [];
    T.forEach((tk, i) => {
      const rest = T.slice(i + 1);
      const span = () => { let fixed = 0, k = 0; for (const t of rest) { if (ANCH[t] !== undefined) return { a: ANCH[t], fixed, k }; if (t === 'core') k++; else if (t !== 'free' && t !== 'lunch?') fixed += FIX[t] || 0; } return { a: null as number | null, fixed, k }; };
      const put = (title: string, dur: number, sub?: string[], anchor?: number) => { const s = anchor ? Math.max(cur, anchor) : cur; items.push({ time: rng(s, s + dur), title, sub }); cur = s + dur; };
      const open = (title: string, sub?: string[]) => { items.push({ time: `${fmt(cur)} น. เป็นต้นไป`, title, sub }); };
      switch (tk) {
        case 'depart': { const dur = Math.round(travelH * 60); put(`ออกเดินทางจาก${c.school}`, dur); break; }
        case 'arrive': put(`เดินทางถึง ณ ${c.venue}`, 30); break;
        case 'lunch?': case 'lunch': if (tk === 'lunch?' && cur > 13 * 60) break; meals.l++; put(`รับประทานอาหารกลางวัน (${++mealNo})`, 60, undefined, ANCH.lunch); break;
        case 'breakfast': meals.b++; put(`รับประทานอาหารเช้า (${++mealNo})`, 60, undefined, ANCH.breakfast); break;
        case 'dinner': meals.d++; put(`รับประทานอาหารเย็น (${++mealNo})`, 60, undefined, ANCH.dinner); break;
        case 'snack': meals.s++; put(`รับประทานอาหารว่าง (${meals.s})`, 15); break;
        case 'register': put('ลงทะเบียน / พิธีเปิด', 30); break;
        case 'opening': { const a = pick1('opening'); put(a.title, c.durationMode === 'half' ? 45 : 60, act(a)); break; }
        case 'core': {
          if (cur > coreCap) break;
          const slotIdx = coreSlots; coreSlots++;
          const defDur = c.durationMode === 'half' ? 60 : 90;
          const sp = span(); const dur = sp.a !== null ? Math.min(120, Math.max(45, Math.round((sp.a - cur - sp.fixed) / (sp.k + 1) / 15) * 15)) : defDur;
          // เลือกกิจกรรมรายช่วง: ถ้าผู้ใช้กำหนด coreSlotIds[slotIdx] และมีในคลัง → ใช้ตัวนั้น; ไม่งั้นเติมอัตโนมัติ
          const pick = c.coreSlotIds && c.coreSlotIds[slotIdx]
            ? pool.find(a => a.id === c.coreSlotIds![slotIdx]) : undefined;
          if (pick) {
            put(pick.title, dur, act(pick));
          } else if (cores.length) {
            const a = cores[coreIdx % cores.length];
            const repeat = Math.floor(coreIdx / cores.length) > 0;
            coreIdx++;
            put(repeat ? `${a.title}\u00A0(ต่อ\u2060ยอด)` : a.title, dur, act(a));
          } else {
            // ไม่มีกิจกรรมในคลังเลย (วิชาที่ยังไม่ได้ตั้งค่า) — ใส่ฐานกลางเพื่อไม่ให้ค้าง
            put('กิจกรรมฐานการเรียนรู้เชิงบูรณาการ', dur);
          }
          items[items.length - 1].slot = slotIdx; // ติดดัชนีช่องให้ UI เลือกกิจกรรมรายช่วงได้
          break;
        }
        case 'trip': if (cur > 16.5 * 60 || !c.venueVisit.trim()) break; hasTrip = true; put(/^\s*ทัศนศึกษา/.test(c.venueVisit) ? `กิจกรรม${c.venueVisit.trim()}` : `กิจกรรมทัศนศึกษา ${c.venueVisit}`, 90); break;
        case 'checkin': put('เช็คอินเข้าที่พัก / พักผ่อนตามอัธยาศัย', 45); break;
        case 'night': { const a = pick1('night'); put(a.title, 60, act(a), 19 * 60 + 30); break; }
        case 'summary': put('สรุปการเรียนรู้ประจำวัน / ถอดบทเรียนกลุ่ม', 30); break;
        case 'free': { const sp = span(); put('พักผ่อนตามอัธยาศัย / เตรียมกิจกรรมนำเสนอ', sp.a !== null ? Math.min(150, Math.max(30, sp.a - cur)) : 60); break; }
        case 'checkout': put('เก็บสัมภาระ / เช็คเอาท์', 60); break;
        case 'recreation': { const a = pick1('recreation'); put(a.title, 30, act(a)); break; }
        case 'closing': { const a = pick1('closing'); put(a.title, 30, act(a)); break; }
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
  const course = courseById(c.courseCode);
  const pool = subjectPool(c);
  // ใช้กิจกรรมที่ "จัดจริงในตาราง" (ไม่ซ้ำ) เพื่อให้รายละเอียดตรงกับกำหนดการ; สำรองเป็นที่เลือกไว้
  const seen = new Set<string>(); const usedSel: Activity[] = [];
  for (const id of (plan.usedActivityIds || [])) { if (!seen.has(id)) { seen.add(id); const a = pool.find(x => x.id === id); if (a) usedSel.push(a); } }
  const sel = usedSel.length ? usedSel : pool.filter(a => c.activityIds.includes(a.id));
  // วัตถุประสงค์ข้อ 1-2 จากหลักสูตรจริง (ถ้าเลือก) หรือจาก subject family; ข้อ 3-4 คงที่ตามมาตรฐาน
  const objectives = [
    course && course.obj1 ? course.obj1 : `เพื่อพัฒนานักเรียนให้มีความสามารถและมีทักษะการบูรณาการความรู้ด้าน${S.field}`,
    course && course.obj2 ? course.obj2 : `เพื่อส่งเสริมและสนับสนุน ให้นักเรียนมีแรงบันดาลใจในการเป็น${S.careers}`,
    'เพื่อจัดกระบวนการเรียนรู้ให้ผู้เรียนได้เกิดเจตคติที่ดีต่อการเรียน และเอาใจใส่ในการเรียน เกิดพฤติกรรมในการรักการเรียนรู้ ใฝ่ฝึกฝนตนเองอยู่เสมออย่างเต็มที่',
    'เพื่อจัดกระบวนการเรียนรู้ให้ผู้เรียนเกิดกระบวนการเรียนรู้ที่สร้างสรรค์อย่างมีความสุข ทั้งสุขภาพกายและสุขภาพจิตที่ดี ได้เรียนรู้ร่วมกันจากการปฏิบัติจริง ด้วยความหลากหลายและสร้างองค์ความรู้ใหม่ได้ในศตวรรษที่ 21'
  ];
  // กิจกรรมเชิงบูรณาการ: ยึด "กิจกรรมของหลักสูตร" ที่เลือกไว้เป็นหลักเสมอ (ไม่ใช่แค่ที่ลงตาราง)
  // เรียงกิจกรรมหลัก/ภาคค่ำก่อน (พื้นฐานหลักสูตร) แล้วจับคู่ 2 รายการ/บรรทัด → ~5 บรรทัด (คล้ายต้นฉบับ, พอดีหน้าแรก)
  const ORD: Record<string, number> = { core: 0, night: 1, opening: 2, recreation: 3, closing: 4 };
  const selForActs = pool.filter(a => c.activityIds.includes(a.id)).length
    ? pool.filter(a => c.activityIds.includes(a.id)) : sel;
  const ordered = [...selForActs].sort((a, b) => (ORD[a.kind] ?? 9) - (ORD[b.kind] ?? 9));
  // ชื่อฐาน (ตัด EP./ต่อยอด) → รวม EP.1/EP.2 เป็นกิจกรรมเดียว; 1 กิจกรรม/บรรทัด ไม่เกิน 6 + AAR (พอดีหน้าแรก)
  const baseName = (t: string) => tidyTitle(t).replace(/\s*\(ต่อยอด\)\s*$/, '').replace(/\s*(EP|Part)\.?\s*\d+\s*$/i, '').trim();
  const acts: string[] = Array.from(new Set(ordered.map(a => baseName(a.title)))).slice(0, 6);
  acts.push('กิจกรรมทดสอบหลังการเรียนรู้ (After Action Review : AAR)');
  // บูรณาการการเรียน: 5–7 ข้อ (ตัดให้ไม่เกิน 7 เพื่อให้อยู่ในหน้าแรก)
  const extra = (c.courseCode && c.subject === 'steam' && !isSteamProgram(c))
    ? [`บูรณาการแบบสหวิทยาการด้าน${courseShortTh(c)}`, `บูรณาการทักษะวิชาชีพด้าน${courseShortTh(c)}`] : S.extra;
  const integ = ['บูรณาการคุณลักษณะที่พึงประสงค์ในการเรียนรู้ในศตวรรษที่ 21', 'บูรณาการโดยใช้โครงการในทางกิจกรรมค่ายเป็นลักษณะภารกิจในระหว่างกิจกรรม', ...extra,
    'บูรณาการกระบวนการกลุ่มและทักษะความเป็นผู้นำ (Collaborative and Leadership Skills)', 'บูรณาการทักษะการเรียนรู้และนวัตกรรม (Learning and Innovation Skills)', 'บูรณาการทักษะการสื่อสาร (Communication Tactic)'].slice(0, 7);
  const m = plan.meals, main = m.b + m.l + m.d;
  const parts = [m.b && `อาหารเช้า ${m.b} มื้อ`, m.l && `อาหารกลางวัน ${m.l} มื้อ`, m.d && `อาหารเย็น ${m.d} มื้อ`].filter(Boolean).join(' ');
  const staff = staffText(c.students);
  const autoBudget = [
    c.nights > 0 && `ค่าที่พัก ${c.nights} คืน ${c.venue}`, main > 0 && `ค่าอาหาร ${main} มื้อ (${parts})`, m.s > 0 && `ค่าอาหารว่าง ${m.s} มื้อ`,
    'ค่าห้องประชุมสัมมนารองรับการทำกิจกรรม', `ค่าวิทยากรและทีมงาน จำนวน ${staff} ท่าน`, 'ค่าเดินทางวิทยากร',
    plan.hasTrip && 'ค่ากิจกรรมทัศนศึกษาแหล่งเรียนรู้', 'ค่าอุปกรณ์การจัดค่ายทั้งหมด'
  ].filter(Boolean) as string[];
  // ทีมแก้รายการเองได้ (ช่องว่างถูกตัดทิ้ง) — ถ้าไม่ได้แก้ ใช้รายการอัตโนมัติ
  const custom = (c.budgetItems || []).map(x => String(x ?? '').trim()).filter(Boolean);
  const budget = custom.length ? custom : autoBudget;
  const total = c.students + c.teachers;
  // แยกชื่อหลักสูตรเป็นไทย + อังกฤษ: ชื่อในคลังอยู่รูป "ชื่อไทย (English Name)" → ไทยบรรทัดบน, อังกฤษในวงเล็บบรรทัดล่าง
  const rawName = course ? course.name : S.titleTh;
  const nm = rawName.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  const nameTh = nm ? nm[1].trim() : rawName;      // ชื่อไทยล้วน (ไม่มีวงเล็บอังกฤษ)
  const enName = nm ? nm[2].trim() : S.en;          // อังกฤษในวงเล็บ (หรือชื่อ EN มาตรฐานของวิชา)
  return {
    titleTh: `หลักสูตร “${nameTh}”`, nameTh: `“${nameTh}”`, titleEn: `( ${enName} )`, objectives, acts, integ, budget, autoBudget, staff,
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
  // กิจกรรมจากคลัง 14 หลักสูตรยัง "รอตรวจ" — เตือน (soft) ให้ทีมยืนยันรายละเอียดก่อนจัดจริง
  const pendingCount = c.activityIds.filter(id => pool.find(a => a.id === id)?.draft).length;
  return [
    { ok: /^PL\s+([A-Z]{2,4}\s+)?\d{3,4}\s*\/\s*\d{4}$/.test(c.docCode.trim()), msg: 'รหัสเอกสารอ้างจากรหัสหลักสูตรจริง (เช่น PL STM 0101/2569)' },
    { ok: !!c.school && !c.school.includes('...'), msg: 'ระบุชื่อโรงเรียนแล้ว' },
    { ok: !!c.dates.trim() && !c.dates.includes('...'), msg: 'ระบุวันที่จัดค่ายแล้ว' },
    { ok: !!c.venue.trim(), msg: 'ระบุสถานที่/โรงแรมแล้ว' },
    { ok: c.students > 0 && c.specialPrice > 0, msg: 'จำนวนคนและราคาพิเศษถูกต้อง' },
    { ok: c.specialPrice <= c.normalPrice, msg: 'ราคาพิเศษไม่เกินราคาปกติ' },
    { ok: c.specialPrice > c.costPerPerson, msg: 'ราคาขายสูงกว่าต้นทุน/ท่าน' },
    { ok: durOK, msg: c.durationMode === 'overnight' ? `พักค้าง ${c.nights} คืน (สอดคล้องกับรูปแบบค่าย)` : `ค่าย${c.durationMode === 'half' ? 'ครึ่งวัน' : 'ไป-กลับ'} — ไม่มีการพักค้าง` },
    { ok: noStrayOvernight, msg: 'กำหนดการสอดคล้องรูปแบบ (ไม่มีรายการพักค้างในค่ายไป-กลับ)' },
    { ok: hasAAR, msg: 'มีกิจกรรมถอดบทเรียน (AAR)' },
    { ok: noGap, msg: 'ทุกช่วงเวลามีกิจกรรมจริง (ไม่มีช่องว่าง)' },
    { ok: unique, soft: true, msg: unique ? `กิจกรรมหลักพอทุกช่องไม่ซ้ำ (ใช้ ${plan.coreSlots} ช่อง · คลังมี ${coreAvail})` : `ค่ายยาว ใช้ ${plan.coreSlots} ช่อง แต่คลังมี ${coreAvail} — ระบบวนใช้ซ้ำแบบติดป้าย “(ต่อยอด)” หรือเพิ่มกิจกรรมเองในแท็บ 3` },
    { ok: pendingCount === 0, soft: true, msg: pendingCount === 0 ? 'ไม่มีกิจกรรมสถานะรอตรวจ' : `⚠ มีกิจกรรม "รอตรวจ" ${pendingCount} รายการ (จากคลัง 14 หลักสูตร) — ทีมต้องยืนยันขั้นตอน/อุปกรณ์/เวลาก่อนจัดจริง` },
    ...(hasCoursePhotos(c.courseCode) && c.actImgs.some(im => im.data) ? [{ ok: false, soft: true, msg: '⚠ ใช้ภาพกิจกรรมจริงจากคลังทีม — สถานะลิขสิทธิ์เผยแพร่ "รอทีมรับรอง" ก่อนส่งให้ลูกค้า' }] : [])
  ];
}
// พร้อมส่งเมื่อผ่านทุกข้อ "แข็ง" (soft ไม่บังคับ)
export const isReady = (checks: { ok: boolean; soft?: boolean }[]) => checks.every(c => c.ok || c.soft);
export const money = (n: number) => Math.round(Number.isFinite(n) ? n : 0).toLocaleString('en-US');

/* ===================== DOCX HELPERS ===================== */
const FONT = { ascii: FONT_NAME, hAnsi: FONT_NAME, cs: FONT_NAME, eastAsia: FONT_NAME };
// ภาษาไทยติดทุก run (w:lang bidi=th-TH) — Word ใช้ตัดคำ/ตรวจตัวสะกด/เลือกฟอนต์ complex-script ถูกชุด ไม่สลับไป Tahoma/Cordia
const LANG = { value: 'th-TH', eastAsia: 'th-TH', bidirectional: 'th-TH' };
const BLUE = '155D90', SKY = '087FC2', NAVY = '0C2A41', W = 9400;
type RO = { b?: boolean; sz?: number; color?: string; strike?: boolean; i?: boolean };
// ล้างอักขระที่ XML 1.0 ไม่รองรับ (NUL/control chars ที่มักติดมาจากการ copy) — กันไฟล์ .docx เสีย/เปิดไม่ได้
// อักขระที่อนุญาต: \t \n \r และ 0x20 ขึ้นไป (ยกเว้น noncharacters)
const XML_BAD = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;
export const xmlSafe = (t: any): string => (t === null || t === undefined ? '' : String(t)).replace(XML_BAD, '');
const R = (text: string, o: RO = {}) => { const sz = (o.sz || 16) * 2; return new TextRun({ text: xmlSafe(text), font: FONT, language: LANG, size: sz, sizeComplexScript: sz, bold: o.b, boldComplexScript: o.b, color: o.color, strike: o.strike, italics: o.i }); };
const P = (t: string | TextRun[], o: RO & { al?: (typeof AlignmentType)[keyof typeof AlignmentType]; before?: number; after?: number; indent?: number; hang?: number; keep?: boolean; pb?: boolean; hd?: (typeof HeadingLevel)[keyof typeof HeadingLevel] } = {}) =>
  new Paragraph({ heading: o.hd, alignment: o.al, spacing: { before: (o.before || 0) * 20, after: (o.after ?? 2) * 20, line: 300 }, indent: o.indent !== undefined ? { left: o.indent * 567, hanging: (o.hang || 0) * 567 } : undefined, keepNext: o.keep, pageBreakBefore: o.pb,
    children: typeof t === 'string' ? [R(t, o)] : t });
const CTR = AlignmentType.CENTER, RGT = AlignmentType.RIGHT;
const code = (t: string) => P(t, { b: true, color: BLUE, al: RGT });
const title = (th: string, en?: string, sz = 20, pb = false) => [P(th, { hd: HeadingLevel.HEADING_1, b: true, sz: th.length > 40 ? Math.min(sz, 17.5) : th.length > 32 ? Math.min(sz, 18.5) : sz, color: '0F3D63', al: CTR, after: 0, pb, keep: true }), ...(en ? [P(en, { b: true, sz: 18, color: SKY, al: CTR, after: 4 })] : [])];
const H = (t: string) => P(t, { hd: HeadingLevel.HEADING_2, b: true, sz: 17, color: BLUE, before: 6, after: 2, keep: true });
const numbered = (a: string[]) => a.map((x, i) => P(`${i + 1}. ${x}`, { indent: 0.9, hang: 0.9, after: 1 }));
const dashed = (a: string[], keep = false) => a.map((x, i) => P(`-\t${x}`, { indent: 0.9, hang: 0.9, after: 1, keep: keep && i < a.length - 1 }));
const NB = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const LB = { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' };
const cell = (kids: Paragraph[], w: number, o: { fill?: string; border?: 'none' | 'line' | 'box' | 'navy'; span?: number } = {}) => {
  const bx = { style: BorderStyle.SINGLE, size: 6, color: '94A3B8' };
  const nv = { style: BorderStyle.SINGLE, size: 8, color: NAVY };
  const bd = o.border === 'navy' ? { top: nv, bottom: nv, left: nv, right: nv } : o.border === 'box' ? { top: bx, bottom: bx, left: bx, right: bx } : o.border === 'line' ? { top: NB, left: NB, right: NB, bottom: LB } : { top: NB, bottom: NB, left: NB, right: NB };
  return new TableCell({ children: kids, width: { size: w, type: WidthType.DXA }, borders: bd, columnSpan: o.span, verticalAlign: VerticalAlign.TOP,
    shading: o.fill ? { type: ShadingType.CLEAR, fill: o.fill, color: 'auto' } : undefined, margins: { top: 50, bottom: 50, left: 100, right: 100 } });
};
const tbl = (rows: TableRow[], cols: number[]) => new Table({ rows, width: { size: W, type: WidthType.DXA }, columnWidths: cols, layout: TableLayoutType.FIXED });
const infoRows = (pairs: [string, string[]][]) => tbl(pairs.map(([k, v]) => new TableRow({ children: [cell([P(k, { b: true, color: BLUE })], 2200), cell(v.map(x => P(x, { after: 0 })), W - 2200)] })), [2200, W - 2200]);
const dayBanner = (t: string) => tbl([new TableRow({ children: [cell([P(t, { b: true, sz: 17, color: 'FFFFFF', after: 0 })], W, { fill: BLUE })] })], [W]);
// ตารางรายวัน: แถบ "วันที่ n" เป็นแถวหัวของตารางเดียวกัน + ทุกแถว keep-with-next → ทั้งวันอยู่หน้าเดียวกัน ไม่มีแถวหลุดไปหน้าถัดไป
const scheduleTable = (d: Day, extra?: boolean, banner?: string) => {
  const cols = extra ? [2250, 4150, 3000] : [2700, W - 2700];
  const n = d.items.length;
  const head = banner ? [new TableRow({ cantSplit: true, children: [cell([P(banner, { b: true, sz: 18, color: 'FFFFFF', after: 0, keep: true })], W, { fill: BLUE, span: cols.length })] })] : [];
  return tbl([...head, ...d.items.map((r, i) => { const k = i < n - 1; return new TableRow({ cantSplit: true, children: [
    cell([P(r.time, { sz: 16, after: 0, keep: k })], cols[0], { border: 'none' }),
    cell([P(r.title, { sz: 16, after: 0, keep: k }), ...(r.sub || []).map(s => P(s, { sz: 16, indent: 0.5, after: 0, color: '334155', keep: k }))], cols[1], { border: 'none' }),
    ...(extra ? [cell([P('', { after: 0, keep: k })], cols[2], { border: 'none' })] : [])] }); })], cols);
};
// หน้ากำหนดการ: 1.กำหนดการ 2.ชื่อหลักสูตร(ไทย/อังกฤษ) 3.โรงเรียน 4.วันที่(ถ้ามี) 5.สถานที่(ถ้ามี)
const hasVal = (s?: string) => !!(s && s.trim() && !s.includes('...'));
const scheduleBlock = (c: Camp, plan: Plan, k: ReturnType<typeof compose>, extra = false, pb = false) => [
  // หัวข้อกำหนดการทั้งก้อน = 18 pt ตัวหนา (ตามแบบทีม) · รายละเอียดในตาราง = 16 pt ตัวธรรมดา
  P('กำหนดการ', { hd: HeadingLevel.HEADING_1, b: true, sz: 18, color: '0F3D63', al: CTR, after: 0, pb, keep: true }),
  P(k.nameTh, { b: true, sz: 18, color: '0F3D63', al: CTR, after: 0, keep: true }),
  P(k.titleEn, { b: true, sz: 18, color: SKY, al: CTR, after: 0, keep: true }),
  ...(hasVal(c.school) ? [P(c.school, { b: true, sz: 18, al: CTR, after: 0, keep: true })] : []),
  ...(hasVal(c.dates) ? [P(c.dates, { b: true, sz: 18, al: CTR, after: 0, keep: true })] : []),
  ...(hasVal(c.venue) ? [P(`ณ ${c.venue}`, { b: true, sz: 18, al: CTR, after: 8 })] : [P('', { after: 8 })]),
  ...plan.days.flatMap(d => [P('', { after: 0, sz: 6 }), scheduleTable(d, extra, `วันที่ ${d.day}${extra ? '  (ช่องขวา: ผู้รับผิดชอบ / อุปกรณ์)' : ''}`)]),
  // หมายเหตุปิดท้ายกำหนดการเสมอ (บรรทัดถัดไป) — ตัวปกติ ไม่หนา
  P('หมายเหตุ : กำหนดการอาจจะเปลี่ยนแปลงตามความเหมาะสม', { color: '334155', before: 8, after: 0 })
];
// ราคา + รายละเอียดงบประมาณ — แบบเรียบตามเอกสารจริงของทีม: ไม่มีตาราง/กรอบ
//   ราคาปกติ 6,290 ลดเหลือเพียง 5,290 บ./ท่าน   (ส่วน "ลดเหลือเพียง…" สีแดง)
//   รายละเอียดงบประมาณมีดังนี้
//   -<tab>รายการ …                                  (ทุกรายการแก้ได้ในขั้น "ราคา & งบ" → camp.budgetItems)
// ขึ้นหน้าใหม่เสมอ (ไม่ให้แยกจากกำหนดการแบบครึ่ง ๆ กลาง ๆ)
export const PRICE_RED = 'FF0000';
const priceLine = (c: Camp, pb = false) => P([
  R(`ราคาปกติ ${money(c.normalPrice)} `),
  R(`ลดเหลือเพียง ${money(c.specialPrice)} บ./ท่าน`, { color: PRICE_RED })
], { pb, keep: true, after: 2 });
const priceBudgetSection = (c: Camp, k: ReturnType<typeof compose>): Paragraph[] => [
  priceLine(c, true),
  P('รายละเอียดงบประมาณมีดังนี้', { keep: true, after: 2 }),
  ...dashed(k.budget, true)
];
// ขนาดจริงของภาพจาก header (PNG/JPEG) — ใช้คงสัดส่วนภาพ ไม่ให้ภาพบีบ/ยืด
const imgSize = (d: Uint8Array): { w: number; h: number } | null => {
  if (d[0] === 0x89 && d[1] === 0x50) return { w: (d[16] << 24) | (d[17] << 16) | (d[18] << 8) | d[19], h: (d[20] << 24) | (d[21] << 16) | (d[22] << 8) | d[23] };
  if (d[0] === 0xff && d[1] === 0xd8) {
    let i = 2;
    while (i + 9 < d.length) {
      if (d[i] !== 0xff) { i++; continue; }
      const mk = d[i + 1], len = (d[i + 2] << 8) | d[i + 3];
      if (mk >= 0xc0 && mk <= 0xcf && mk !== 0xc4 && mk !== 0xc8 && mk !== 0xcc) return { h: (d[i + 5] << 8) | d[i + 6], w: (d[i + 7] << 8) | d[i + 8] };
      i += 2 + len;
    }
  }
  return null;
};
// ภาพพอดีกรอบ (กว้างสุด BOX_W, สูงสุด BOX_H) คงสัดส่วนเดิมทุกภาพ → ตารางภาพเรียบร้อยสม่ำเสมอ
// ภาพในกริด: ยึดความกว้างเท่ากันทุกใบ (เต็มครึ่งคอลัมน์) → คอลัมน์ตรงเป็นระเบียบ; จำกัดความสูงสุดกันภาพแนวตั้งล้น
const BOX_W = 312, BOX_H = 234;
const fitBox = (d: Uint8Array) => {
  const s = imgSize(d); if (!s || !s.w || !s.h) return { width: BOX_W, height: Math.round(BOX_W * 0.68) };
  let w = BOX_W, h = Math.round(s.h * BOX_W / s.w);
  if (h > BOX_H) { h = BOX_H; w = Math.round(s.w * BOX_H / s.h); }
  return { width: w, height: h };
};
// กริดภาพ 2 คอลัมน์ (6–8 รูป) — มีกรอบ + หมายเลข + คำบรรยายใต้รูป (ตามสเปกเอกสารราชการ)
const photoGrid = (imgs: Img[], fallbackN: number, label = 'ภาพกิจกรรม') => {
  const list = (imgs.length ? imgs : Array.from({ length: fallbackN }, () => ({ caption: '' } as Img))).slice(0, 8);
  const rows: TableRow[] = [];
  for (let i = 0; i < list.length; i += 2) { const kp = i + 2 < list.length; rows.push(new TableRow({ cantSplit: true, children: [0, 1].map(j => { const im = list[i + j]; const n = i + j + 1; if (!im) return cell([P('', { keep: kp })], W / 2, { border: 'none' }); const cap = im.caption && im.caption.trim() && !im.caption.includes('...') ? im.caption : `${label}ที่ ${n}`; return cell([
    im.data ? new Paragraph({ alignment: CTR, keepNext: true, spacing: { before: 20, after: 8 }, children: [new ImageRun({ type: imgType(im.data), data: im.data, transformation: fitBox(im.data) })] })
      : P('พื้นที่วางภาพ', { al: CTR, color: '94A3B8', before: 70, after: 70, keep: true }),
    new Paragraph({ alignment: CTR, keepNext: kp, spacing: { after: 30 }, children: [R(`${n}  `, { b: true, sz: 13, color: BLUE }), R(cap, { sz: 13, color: '48484A' })] })], W / 2, { border: 'none' }); }) })); }
  return tbl(rows, [W / 2, W / 2]);
};
// ภาพประกอบ STEAM (คอลลาจ) — ใช้ซ้ำได้ทุกเอกสารของค่าย STEAM
const steamGalleryPara = () => new Paragraph({ alignment: CTR, spacing: { before: 40 }, children: [new ImageRun({ type: 'jpg', data: b64bytes(STEAM_GALLERY.b64), transformation: { width: Math.min(520, CONTENT_W_PX), height: Math.round(Math.min(520, CONTENT_W_PX) * STEAM_GALLERY.h / STEAM_GALLERY.w) } })] });
// ภาพประกอบในทุกไฟล์: ภาพกิจกรรม (ของจริงถ้ามี/ไม่งั้นดึงภาพหลักสูตร) + ภาพ STEAM หน้าสุดท้ายถ้าเป็นค่าย STEAM
const photoSection = (c: Camp, opts: { venue?: boolean } = {}): (Paragraph | Table)[] => {
  const acts = c.actImgs.length ? c.actImgs : coursePhotos(c.courseCode, 8);
  // หน้าภาพแยกหน้าชัดเจน (ขึ้นหน้าใหม่) + หัวข้อ "ตัวอย่างภาพกิจกรรม" ตัวหนากึ่งกลางเสมอ
  const out: (Paragraph | Table)[] = [...title('ตัวอย่างภาพกิจกรรม', undefined, 20, true), P('', { after: 2 }), photoGrid(acts, 6, 'ภาพกิจกรรม')];
  // ที่พัก: อยู่หน้าหลังสุด — หัวข้อ "ตัวอย่างภาพบรรยากาศที่พัก <ชื่อที่พัก>" ตัวหนากึ่งกลาง (6–8 รูป: ป้าย/มุมสูง 2 · ห้องพัก 2 · สระ/สิ่งอำนวยความสะดวก 2 · ห้องประชุม 2)
  if (opts.venue && c.venueImgs.some(im => im.data)) { out.push(...title(`ตัวอย่างภาพบรรยากาศที่พัก ${c.venue || ''}`.trim(), undefined, 20, true), P('', { after: 2 }), photoGrid(c.venueImgs, 6, 'ภาพที่พัก')); }
  // ภาพเซ็ต STEAM — เฉพาะหลักสูตร STEAM เท่านั้น (ไม่ใส่ให้ดาราศาสตร์/ธรณี/ทะเล ฯลฯ)
  if (isSteamProgram(c)) { out.push(...title('ตัวอย่างภาพกิจกรรมค่าย STEAM', undefined, 20, true), steamGalleryPara()); }
  return out;
};
const sign = (l: string, who: string) => cell([P('', { after: 18 }), P('ลงชื่อ ....................................................', { al: CTR, after: 0 }), P(`( ${who} )`, { al: CTR, after: 0 }), P(l, { al: CTR, after: 0 })], W / 2);
const thDate = () => { const d = new Date(); return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() + 543}`; };
// base64 → Uint8Array (ทำงานทั้งเบราว์เซอร์และ node)
const b64bytes = (b64: string): Uint8Array => {
  const bin = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u;
};
// ตรวจชนิดรูปจาก magic bytes (docx ImageRun ต้องระบุ type ให้ตรง ไม่งั้นรูปไม่ขึ้น)
const imgType = (d: Uint8Array): 'png' | 'jpg' | 'gif' | 'bmp' => {
  if (d[0] === 0x89 && d[1] === 0x50) return 'png';
  if (d[0] === 0xff && d[1] === 0xd8) return 'jpg';
  if (d[0] === 0x47 && d[1] === 0x49) return 'gif';
  if (d[0] === 0x42 && d[1] === 0x4d) return 'bmp';
  return 'png';
};
const CONTENT_W_PX = 626; // ความกว้างพื้นที่เนื้อหา A4 (9400 twips ≈ 6.53in × 96dpi)
// หัวกระดาษ — ประกอบจากโลโก้ + ข้อความครบ (ชื่อบริษัท + ที่อยู่เต็ม + ติดต่อ) แสดงทุกหน้า ทุกเอกสาร
// (ข้อมูลครบและคมชัดกว่าการ crop ภาพ; รองรับที่อยู่เฉพาะภาคได้ในอนาคตผ่าน BRAND)
// หัวกระดาษ = ภาพฉบับเต็มตามภาค (โลโก้ + ชื่อบริษัท + ที่อยู่สาขา + ติดต่อ) — ภาพเดียวกันทั้ง Word และ PDF ไม่มีตัดบรรทัด/เพี้ยน
export const letterheadFor = (c: Camp) => FULL_HEADERS[c.region || regionOf(c.province)];
const brandHeader = (r: Region): Header => {
  const h = FULL_HEADERS[r];
  return new Header({ children: [new Paragraph({ alignment: CTR, spacing: { after: 0 },
    children: [new ImageRun({ type: 'png', data: b64bytes(h.b64), transformation: { width: CONTENT_W_PX, height: Math.round(CONTENT_W_PX * h.h / h.w) } })] })] });
};
const letterheadFooter = (r: Region): Footer => {
  const lh = LETTERHEADS[r];
  const pn = (child: any) => new TextRun({ children: [child], font: FONT, size: 28, sizeComplexScript: 28, color: '8E8E93' });
  const pnTxt = (t: string) => new TextRun({ text: t, font: FONT, size: 28, sizeComplexScript: 28, color: '8E8E93' });
  return new Footer({ children: [
    new Paragraph({ alignment: CTR, spacing: { after: 20 }, children: [pnTxt('หน้า '), pn(PageNumber.CURRENT), pnTxt(' / '), pn(PageNumber.TOTAL_PAGES)] }),
    new Paragraph({ alignment: CTR, spacing: { before: 0 },
      children: [new ImageRun({ type: 'png', data: b64bytes(lh.footerPng), transformation: { width: CONTENT_W_PX, height: Math.round(CONTENT_W_PX * lh.footerH / lh.footerW) } })] })] });
};

/* ===================== 4 DOCUMENT BUILDERS ===================== */
export function buildDoc(kind: DocKind, c: Camp, planIn?: Plan, k0?: ReturnType<typeof compose>): Document {
  const plan = planIn || buildSchedule(c); const k = k0 || compose(c, plan);
  const total = c.students * c.specialPrice, cost = c.students * c.costPerPerson, profit = total - cost, margin = total ? (profit / total) * 100 : 0;
  let body: (Paragraph | Table)[] = [];
  if (kind === 'program') {
    body = [code(c.docCode), ...title(k.titleTh, k.titleEn), P('', { after: 4 }),
      H('วัตถุประสงค์การเรียนรู้'), ...numbered(k.objectives), P('', { after: 2 }),
      infoRows([['จำนวน', [k.p1, k.p2]], ['วิทยากร', [`${k.staff} คน`]], ['ระยะเวลาอบรม', [k.dur]]]),
      H('กิจกรรมเชิงบูรณาการ'), ...numbered(k.acts), H('บูรณาการการเรียน (integration instruction)'), ...numbered(k.integ),
      ...scheduleBlock(c, plan, k, false, true),
      ...priceBudgetSection(c, k),
      ...photoSection(c, { venue: true })];
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
          cell([P(k.titleTh, { after: 0 }), P(`${k.dur} · ${c.dates}`, { sz: 14, after: 0 }), P(`นักเรียน ${c.level} · รวมที่พัก อาหาร วิทยากร อุปกรณ์ ตามรายละเอียดในโปรแกรม`, { sz: 14, after: 0 })], cols[1], { border: 'box' }),
          cell([P(String(c.students), { al: CTR, after: 0 })], cols[2], { border: 'box' }),
          cell([P(money(c.specialPrice), { al: RGT, after: 0 })], cols[3], { border: 'box' }),
          cell([P(money(total), { al: RGT, after: 0 })], cols[4], { border: 'box' })] }),
        new TableRow({ children: [cell([P('ยอดรวมสุทธิ (บาท)', { b: true, al: RGT, after: 0 })], cols[0] + cols[1] + cols[2] + cols[3], { fill: 'F0F9FF', border: 'box', span: 4 }), cell([P(money(total), { b: true, al: RGT, after: 0 })], cols[4], { fill: 'F0F9FF', border: 'box' })] })], cols),
      P(`ราคาปกติ ${money(c.normalPrice)} บาท/ท่าน ลดเหลือพิเศษ ${money(c.specialPrice)} บาท/ท่าน (ประหยัด ${money(c.normalPrice - c.specialPrice)} บาท/ท่าน)`, { before: 6 }),
      H('รายละเอียดที่รวมอยู่ในราคา'), ...dashed(k.budget, true),
      H('เงื่อนไข'), ...numbered([`ราคานี้ยืนยันภายใน ${c.validDays} วัน นับจากวันที่เสนอราคา`, c.payTerms, 'กำหนดการอาจเปลี่ยนแปลงตามความเหมาะสม โดยไม่กระทบเนื้อหาการเรียนรู้']),
      P('', { after: 6 }), tbl([new TableRow({ children: [sign('ผู้เสนอราคา', c.contactName), sign('ผู้อนุมัติ / ตัวแทนโรงเรียน', `ผู้อำนวยการ${c.school}`)] })], [W / 2, W / 2]),
      ...photoSection(c)];
  } else if (kind === 'booking') {
    const supplier = c.supplierNote || VENUES.find(x => x.name === c.venue)?.note || ''; const m = plan.meals, ppl = c.students + c.teachers;
    body = [code(`BK ${c.docCode.replace(/^PL\s*/, '')}`), ...title('หนังสือขอใบเสนอราคาและยืนยันห้องพัก/ห้องประชุม', 'ACCOMMODATION & MEETING REQUEST'), P(`วันที่ ${thDate()}`, { al: RGT }),
      P(`เรียน  ฝ่ายขาย/ฝ่ายจัดเลี้ยง ${c.venue}`), P(`ด้วยบริษัท อีคิวแคมป์ มีความประสงค์จัด${k.titleTh.replace(/^หลักสูตร\s*/, '')} ให้แก่${c.school} จึงขอความอนุเคราะห์เสนอราคาและตรวจสอบความพร้อมตามรายละเอียดดังนี้`, { indent: 1 }),
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
      P('จึงเรียนมาเพื่อโปรดพิจารณาและตอบกลับ ขอขอบคุณอย่างสูง', { before: 8, indent: 1 }), P('', { after: 6 }), tbl([new TableRow({ children: [cell([P('')], W / 2), sign('ผู้ประสานงาน EQ Camp', c.contactName)] })], [W / 2, W / 2]),
      ...photoSection(c, { venue: true })];
  } else {
    body = [P('[เอกสารภายใน EQ CAMP — ห้ามส่งลูกค้า]', { b: true, color: 'B45309', al: CTR }), code(`RD ${c.docCode.replace(/^PL\s*/, '')}`),
      tbl([new TableRow({ children: [cell([
        P(`ต้นทุน ${money(c.costPerPerson)} บ./ท่าน × ${c.students} = ${money(cost)} บาท`, { sz: 15, after: 0 }),
        P(`ราคาขาย ${money(c.specialPrice)} บ./ท่าน × ${c.students} = ${money(total)} บาท`, { sz: 15, after: 0 }),
        P(`กำไรประเมิน ${money(profit)} บาท (Margin ${margin.toFixed(1)}%)${margin < 20 ? '  ⚠ ต่ำกว่า 20%' : ''}`, { b: true, sz: 16, color: profit < 0 ? 'DC2626' : '15803D', after: 0 }),
        P(`ซัพพลายเออร์/ผู้ติดต่อ: ${c.supplierNote || (VENUES.find(v => v.name === c.venue)?.note ?? '-')}`, { sz: 14, after: 0 })], W, { fill: 'FFFBEB', border: 'box' })] })], [W]),
      P('', { after: 4 }), ...scheduleBlock(c, plan, k, true), ...photoSection(c)];
  }
  const region: Region = c.region || regionOf(c.province);
  return new Document({ creator: 'EQ Camp', title: `${c.docCode} ${k.titleTh}`,
    // สไตล์ชื่อมาตรฐานของ Word: ทีมแก้ต่อใน Word แล้วฟอนต์/ขนาดไม่เพี้ยน (เลือก "ปกติ"/"หัวเรื่อง 1-2" ในแถบสไตล์ได้เลย)
    // ขนาดเนื้อความ 16 pt ตามแนวพิมพ์หนังสือราชการ, หัวเรื่องมี outlineLevel → ขึ้นในบานหน้าต่างนำทาง/สารบัญ
    styles: {
      default: {
        document: { run: { font: FONT, language: LANG, size: 32, sizeComplexScript: 32 }, paragraph: { spacing: { line: 300, after: 40 } } },
        heading1: { run: { font: FONT, language: LANG, bold: true, boldComplexScript: true, size: 40, sizeComplexScript: 40, color: '0F3D63' }, paragraph: { alignment: AlignmentType.CENTER, outlineLevel: 0, keepNext: true, spacing: { line: 300, before: 0, after: 0 } } },
        heading2: { run: { font: FONT, language: LANG, bold: true, boldComplexScript: true, size: 34, sizeComplexScript: 34, color: BLUE }, paragraph: { outlineLevel: 1, keepNext: true, spacing: { line: 300, before: 120, after: 40 } } }
      }
    },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1780, bottom: 1060, left: 1253, right: 1253, header: 360, footer: 280 } } },
      headers: { default: brandHeader(region) },
      footers: { default: letterheadFooter(region) },
      children: body
    }] });
}
export const fileName = (kind: DocKind, c: Camp) => `${c.docCode.replace(/[^\w-]+/g, '_')}_${{ program: 'โปรแกรม', quotation: 'ใบเสนอราคา', booking: 'ขอราคาโรงแรม', runsheet: 'Rundown_INTERNAL' }[kind]}_${c.school.replace(/\s+/g, '')}.docx`;


/* ===================== PACK + EMBED FONT =====================
 * ฝังฟอนต์ TH Sarabun New (regular+bold) ลงไฟล์ .docx — เครื่องที่ไม่ได้ติดตั้งฟอนต์จะไม่ถูกแทนด้วย
 * Leelawadee/Tahoma (ตัวหนา-ใหญ่ทั้งเอกสาร). ใช้ obfuscation มาตรฐาน ECMA-376 (XOR 32 ไบต์แรกกับ GUID กลับลำดับ)
 * ใช้ packDocx() แทน Packer.toBuffer/toBlob ทุกที่ */
const b64ToBytes = (b64: string): Uint8Array => {
  if (typeof atob === 'function') { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
  return new Uint8Array((globalThis as any).Buffer.from(b64, 'base64'));
};
const obfuscate = (font: Uint8Array, guid: string): Uint8Array => {
  const hex = guid.replace(/[{}-]/g, ''); const key: number[] = [];
  for (let i = 0; i < 16; i++) key.push(parseInt(hex.substr(i * 2, 2), 16));
  key.reverse(); const out = new Uint8Array(font);
  for (let i = 0; i < 32; i++) out[i] ^= key[i % 16];
  return out;
};
export async function packDocx(doc: Document): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(await Packer.toBase64String(doc), { base64: true });
  const gR = '{5A1E2C3B-7D4F-4E21-9B6A-1C2D3E4F5A61}', gB = '{6B2F3D4C-8E5A-4F32-AC7B-2D3E4F5A6B72}';
  zip.file('word/fonts/font1.odttf', obfuscate(b64ToBytes(FONT_REG_B64), gR));
  zip.file('word/fonts/font2.odttf', obfuscate(b64ToBytes(FONT_BOLD_B64), gB));
  zip.file('word/_rels/fontTable.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rIdF1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="fonts/font1.odttf"/>' +
    '<Relationship Id="rIdF2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="fonts/font2.odttf"/></Relationships>');
  const ft = await zip.file('word/fontTable.xml')!.async('string');
  const fontEl = `<w:font w:name="${FONT_NAME}"><w:charset w:val="DE"/><w:family w:val="swiss"/><w:pitch w:val="variable"/>` +
    `<w:embedRegular r:id="rIdF1" w:fontKey="${gR}"/><w:embedBold r:id="rIdF2" w:fontKey="${gB}"/></w:font>`;
  zip.file('word/fontTable.xml', ft.replace(/<w:fonts([^>]*?)\/>$/, '<w:fonts$1>' + fontEl + '</w:fonts>').replace(/<\/w:fonts>$/, (m) => ft.endsWith('/>') ? m : fontEl + m));
  let ct = await zip.file('[Content_Types].xml')!.async('string');
  if (!ct.includes('Extension="odttf"')) ct = ct.replace('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">', '$&<Default ContentType="application/vnd.openxmlformats-officedocument.obfuscatedFont" Extension="odttf"/>');
  if (!ct.includes('/word/fontTable.xml')) ct = ct.replace('</Types>', '<Override ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml" PartName="/word/fontTable.xml"/></Types>');
  zip.file('[Content_Types].xml', ct);
  // docx-js ไม่ได้อ้าง fontTable จาก document → Word จะไม่เห็นฟอนต์ที่ฝัง; เพิ่ม relationship ให้
  let dr = await zip.file('word/_rels/document.xml.rels')!.async('string');
  if (!dr.includes('fontTable.xml')) dr = dr.replace('</Relationships>', '<Relationship Id="rIdFontTbl" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable" Target="fontTable.xml"/></Relationships>');
  zip.file('word/_rels/document.xml.rels', dr);
  let st = await zip.file('word/settings.xml')!.async('string');
  if (!st.includes('embedTrueTypeFonts')) st = /<w:displayBackgroundShape\/>/.test(st) ? st.replace(/<w:displayBackgroundShape\/>/, '$&<w:embedTrueTypeFonts/><w:saveSubsetFonts/>') : st.replace(/(<w:settings[^>]*>)/, '$1<w:embedTrueTypeFonts/><w:saveSubsetFonts/>');
  zip.file('word/settings.xml', st);
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
// @font-face สำหรับ PDF/พรีวิวในเบราว์เซอร์ — ฟอนต์เดียวกับที่ฝังใน Word
export const FONT_FACE_CSS = `@font-face{font-family:'EQSarabun';font-weight:400;src:url(data:font/ttf;base64,${FONT_REG_B64}) format('truetype')}` +
  `@font-face{font-family:'EQSarabun';font-weight:700;src:url(data:font/ttf;base64,${FONT_BOLD_B64}) format('truetype')}`;
