import {
  Document, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType,
  ShadingType, BorderStyle, ImageRun, LineRuleType, PageBreak, VerticalAlign, Header, Footer, PageNumber, HeadingLevel, TableLayoutType, TabStopType, Tab, UnderlineType
} from 'docx';
import { LETTERHEADS, regionOf, Region } from './letterheads-data';
export { LETTERHEADS, regionOf } from './letterheads-data';
export type { Region } from './letterheads-data';

/* ===================== TYPES ===================== */
import { COURSES, REF_ACTIVITIES, Course } from './eqcamp-data';
import { EXTRA_REF_ACTIVITIES, MERGED_ACTIVITY_IDS } from './extra-activities-data';
export { EXTRA_REF_ACTIVITIES, MERGED_ACTIVITY_IDS } from './extra-activities-data';
export { COURSES } from './eqcamp-data';
export type { Course } from './eqcamp-data';
// แม่แบบโปรแกรมจริงของทีม + ภาพจากไฟล์ของค่ายนั้นเท่านั้น (สร้างจาก scripts/gen-course-templates.py)
import { TEMPLATES, PHOTO_META, VENUE_PHOTOS } from './course-templates-data';
import type { CourseTemplate, TplSec } from './course-templates-data';
export { TEMPLATES, PHOTO_META, VENUE_PHOTOS } from './course-templates-data';
export type { CourseTemplate } from './course-templates-data';
import { STEAM_GALLERY } from './steam-gallery-data';
import { FRESH_PHOTOS } from './fresh-photos-data';
export { STEAM_GALLERY } from './steam-gallery-data';
import { BRAND } from './brand-data';
import { FULL_HEADERS } from './letterhead-full-data';
import { FOOTER_BAR } from './footer-data';
import { FONT_NAME, FONT_REG_B64, FONT_BOLD_B64 } from './font-data';
import { NOTION_ACTIVITIES, NOTION_DB_URL, NOTION_SYNCED } from './notion-activities-data';
import type { NotionActivity } from './notion-activities-data';
export { NOTION_ACTIVITIES, NOTION_DB_URL, NOTION_SYNCED } from './notion-activities-data';
export type { NotionActivity, Equip } from './notion-activities-data';
import JSZip from 'jszip';
import { Packer } from 'docx';
export { BRAND } from './brand-data';
export type Subject = 'math' | 'steam' | 'english' | 'ai' | 'chinese' | 'leadership';
export type DocKind = 'program' | 'quotation' | 'booking' | 'runsheet';
// รูปแบบระยะเวลา: half = ครึ่งวัน, day = ไป-กลับเต็มวัน, overnight = พักค้าง
export type DurationMode = 'half' | 'day' | 'overnight';
// src = id ภาพจากไฟล์ต้นฉบับของค่าย (web/photos/<id>.jpg) ที่ระบบดึงให้ · ไม่มี src = ภาพที่ทีมอัปโหลดเอง
export interface Img { data?: Uint8Array; caption: string; src?: string }
// slot = ดัชนีช่อง "กิจกรรมหลัก" (core) ทั่วทั้งกำหนดการ (0..N-1) ใช้ผูกกับ coreSlotIds เพื่อเลือกกิจกรรมรายช่วง
export interface Row { time: string; title: string; sub?: string[]; slot?: number; addon?: string; orig?: string; party?: boolean; added?: number; ext?: boolean }
export interface Day { day: number; items: Row[] }
export interface Camp {
  docCode: string; subject: Subject; courseCode?: string; school: string; level: string;
  /** รายการงบประมาณที่ทีมแก้เอง (ว่าง = ระบบสร้างอัตโนมัติจากที่พัก/มื้ออาหาร/ทีมงาน) */
  budgetItems?: string[];
  /** แสดงครูผู้ดูแลในเอกสาร — ไม่ระบุ = อัตโนมัติ (พักค้าง: แสดง · Day Camp/ครึ่งวัน: ตัดออก เพราะไม่ต้องดูแลครู) */
  includeTeachers?: boolean;
  students: number; teachers: number; days: number; nights: number; durationMode: DurationMode;
  dates: string; province: string; region?: Region; venue: string; venueVisit: string; startTime: string; travelHours: number;
  normalPrice: number; specialPrice: number; costPerPerson: number;
  contactName: string; supplierNote: string; validDays: number; payTerms: string;
  /** แม่แบบเอกสารจริงที่เลือกเอง (id) · ว่าง = อัตโนมัติ (หลักสูตร+ระยะเวลา+พื้นที่) · 'engine' = ไม่ใช้แม่แบบ */
  templateId?: string;
  /** ชุดภาพกิจกรรมที่เลือกทั้งชุด (photoSetsFor().id) · ว่าง = ชุดใหม่ล่าสุดของหลักสูตร (ถ้ามี) ไม่งั้นภาพจากไฟล์ค่าย */
  photoSet?: string;
  /** ขยายเวลาเลิกรายวัน (เพิ่มช่วงกิจกรรม/อาหารกลางวัน/อาหารว่าง แล้วเลื่อนพิธีปิด-เดินทางกลับไปท้าย) */
  dayExtends?: DayExtend[];
  /** ช่วงเวลาที่เพิ่มเอง */
  rowAdds?: RowAdd[];
  // ข้อมูลลูกค้าสำหรับใบเสนอราคาในโปรแกรมบัญชี (SME Move) — ไม่ใช้ในเอกสาร Word · ว่าง = ให้กรอกเอง (ห้ามเดา)
  quoteCustomer?: { address?: string; taxId?: string; branch?: string; contact?: string; phone?: string; email?: string; vat?: 'include' | 'exclude' | 'none'; smeNo?: string };
  activityIds: string[]; coreSlotIds?: string[]; actImgs: Img[]; venueImgs: Img[];
  extraActivities: Activity[]; // กิจกรรมที่ผู้ใช้เพิ่มเอง (custom) — ผูกกับวิชาปัจจุบัน
  /** กิจกรรมเสริม (Add-on) จากหลักสูตรอื่น (อังกฤษ/จีน/คณิต) แทรกลงกำหนดการค่ายหลัก */
  addons?: AddonSel[];
  /** รายการกิจกรรมเชิงบูรณาการบนหน้าปกที่ทีมแก้เอง (ว่าง = อัตโนมัติ ตรงกับกำหนดการ) */
  actsOverride?: string[];
  /** แก้ไขแถวกำหนดการเอง: วัน + ชื่อแถวเดิม → ชื่อใหม่/เวลาใหม่ */
  rowEdits?: RowEdit[];
  /** ธีมปาร์ตี้ภาคค่ำ (ใช้กับทุกแถวปาร์ตี้/การแสดงภาคค่ำ ยกเว้นแถวที่แก้เอง) */
  partyTheme?: string;
  /** ธีมรายวัน (mix หลักสูตร): ดัชนี = วัน (0 = วันที่ 1), ค่า = รหัสหลักสูตรของวันนั้น · '' / ไม่ระบุ = หลักสูตรหลัก */
  dayCourses?: string[];
  /** โปรแกรมที่ทีมเคยส่งจริง (ดึงจากคลังงานเก่า) = แม่แบบในงาน โครงเดียวกับ TEMPLATES · ใช้เมื่อ templateId ว่างหรือ = pastTpl.id และระยะเวลา/หลักสูตรตรง */
  pastTpl?: CourseTemplate;
  /** ที่มาของงานเก่า (โฟลเดอร์/ไฟล์ใน Drive) — แสดงให้ตรวจ ไม่ใช้ในเอกสาร */
  pastRef?: { folderId?: string; folderName?: string; fileId?: string; fileName?: string; docCode?: string; date?: string; confirmed?: boolean; importedAt?: string };
}
/** code = รหัสหลักสูตรที่เป็น Add-on · ids = กิจกรรมที่เลือก (ว่าง = อัตโนมัติ 1 ช่วง/วัน) · minutes = ความยาว/ช่วง · price = บาท/ท่านที่บวกเพิ่ม (0 = รวมในราคาเดิม) */
export interface RowEdit { day: number; from: string; to?: string; time?: string; sub?: string[] }
/** ช่วงเวลาที่ทีมเพิ่มเอง (แทรกตามเวลาเริ่ม) */
export interface RowAdd { day: number; time: string; title: string; sub?: string[] }
/** ขยายเวลาเลิกของวัน เช่น วันสุดท้าย 2 วัน 1 คืน เดิมกลับ 11.00 → จบ 16.00 (ids = กิจกรรมที่เลือกเอง ตามลำดับ) */
export interface DayExtend { day: number; end: string; ids?: string[] }
export interface AddonSel { code: string; ids?: string[]; minutes?: number; price?: number }

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
  { id: 'm-brain', subjects: ['math'], kind: 'core', title: 'กิจกรรม “BRAIN STORM X2”', desc: '(กระบวนการสันทนาการสร้างสัมพันธ์)' },
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
  ...REF_ACTIVITIES.filter(a => !MERGED_ACTIVITY_IDS[a.id]).map(a => ({ id: a.id, subjects: [a.family as Subject], kind: a.kind as Kind, title: tidyTitle(a.title), courseCode: a.course, draft: true })),
  /* ---------- กิจกรรมจริงจากไฟล์ทีมที่ยังไม่อยู่ในคลัง MASTER (src/extra-activities-data.ts — มีที่มาทุกรายการ) ---------- */
  ...EXTRA_REF_ACTIVITIES.map(a => ({ id: a.id, subjects: [a.family as Subject], kind: a.kind as Kind, title: tidyTitle(a.title), courseCode: a.course, draft: true }))
];
// id กิจกรรมที่ถูกรวมเข้ากับรายการอื่น → id ที่เก็บไว้ (งานเก่าที่เคยเลือกไว้ยังได้กิจกรรมเดิม)
const mergedId = (id: string) => MERGED_ACTIVITY_IDS[id] || id;
const mergeIds = (xs: any) => Array.isArray(xs) ? xs.map((x: any) => typeof x === 'string' ? mergedId(x) : x).filter((x: any, i: number, a: any[]) => !x || a.indexOf(x) === i) : xs;
// หลักสูตร (ธีม) จริง 14 รายการ — ใช้เลือกคลังกิจกรรมเฉพาะธีม
export const courseById = (code?: string): Course | undefined => COURSES.find(c => c.code === code);
// รหัสเอกสารอ้างจากรหัสหลักสูตรจริง (เช่น PL STM 0101 → "PL STM 0101/2569") — ไม่เดา/ไม่มั่ว
export const showTeachers = (c: Pick<Camp, 'includeTeachers' | 'durationMode'>): boolean => c.includeTeachers ?? (c.durationMode === 'overnight');
export const docCodeFor = (code?: string): string => code ? `${code}/2569` : '';
// ภาพกิจกรรมของหลักสูตร = ภาพที่อยู่ในไฟล์ PDF/Word โปรแกรมจริงของค่ายนั้น (ทุกระยะเวลา ไม่ซ้ำ) — ไม่ใช้ภาพจากแหล่งอื่น
export const coursePhotoIds = (code?: string): string[] => {
  const out: string[] = code && FRESH_PHOTOS[code] ? [...FRESH_PHOTOS[code].ids] : [];   // ภาพชุดใหม่ล่าสุดขึ้นก่อน
  for (const t of TEMPLATES) if (t.code === code) for (const h of t.photos) if (!out.includes(h)) out.push(h);
  return out;
};
export const hasCoursePhotos = (code?: string): boolean => coursePhotoIds(code).length > 0;
// สรุป "ฐานข้อมูลของค่าย/หลักสูตร" หนึ่งรายการ — รวมทุกอย่างที่ผูกกับ CUR นั้น (ใช้ในหน้าฐานข้อมูลค่าย)
export interface CourseDataset { course: Course; actsByKind: { kind: Kind; items: Activity[] }[]; total: number; draftCount: number; photoCount: number; photos: string[]; templates: CourseTemplate[] }
export function courseDataset(code: string): CourseDataset | undefined {
  const course = courseById(code); if (!course) return undefined;
  const acts = LIB.filter(a => a.courseCode === code);
  const kinds: Kind[] = ['opening', 'core', 'night', 'recreation', 'closing'];
  const photos = coursePhotoIds(code);
  return {
    course,
    actsByKind: kinds.map(kind => ({ kind, items: acts.filter(a => a.kind === kind) })).filter(g => g.items.length),
    total: acts.length,
    draftCount: acts.filter(a => a.draft).length,
    photoCount: photos.length,
    photos,
    templates: TEMPLATES.filter(t => t.code === code)
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
// สาขา/ที่อยู่รายภาค — แหล่งเดียวกับหัวกระดาษ (ภาคใต้: จากภาพหัวกระดาษภาคใต้ของทีมใน Drive)
export const BRANCHES: { region: string; address: string; phone?: string; note?: string }[] = [
  { region: 'ภาคกลาง (กรุงเทพฯ)', address: '523 ม.4 แขวงบางปะกอก เขตราษฎร์บูรณะ กรุงเทพมหานคร 10140', note: 'จากเอกสารจริงของทีม' },
  { region: 'ภาคอีสาน (สำนักงานใหญ่)', address: '289/69 ไพรเวท พาร์ค วิลล์ ม.4 ต.หนองบัว อ.เมือง จ.อุดรธานี 41000', phone: '065 4919415 / 099 2394747' },
  { region: 'ภาคเหนือ (เชียงใหม่)', address: '62 ม.10 ต.ป่าไผ่ อ.สันทราย จ.เชียงใหม่ 50210' },
  { region: 'ภาคใต้ (ภูเก็ต)', address: '118/73 ตึก C ม.1 ถ.วิชิตสงคราม ต.กะทู้ จ.ภูเก็ต 83120', note: 'จากหัวกระดาษภาคใต้ของทีม' }
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
  const out: Camp = { ...blankCamp(), ...raw, activityIds: Array.isArray(raw?.activityIds) ? mergeIds(raw.activityIds) : blankCamp().activityIds, coreSlotIds: Array.isArray(raw?.coreSlotIds) ? raw.coreSlotIds.map((x: any) => typeof x === 'string' ? mergedId(x) : x) : [], addons: Array.isArray(raw?.addons) ? raw.addons.filter((x: any) => x && typeof x.code === 'string').map((x: any) => Array.isArray(x.ids) ? { ...x, ids: mergeIds(x.ids) } : x) : [], actsOverride: Array.isArray(raw?.actsOverride) ? raw.actsOverride.filter((x: any) => typeof x === 'string') : undefined, rowEdits: Array.isArray(raw?.rowEdits) ? raw.rowEdits.filter((x: any) => x && typeof x.from === 'string' && Number.isFinite(+x.day)).map((x: any) => ({ day: +x.day, from: x.from, ...(typeof x.to === 'string' ? { to: x.to } : {}), ...(typeof x.time === 'string' ? { time: x.time } : {}), ...(Array.isArray(x.sub) ? { sub: x.sub.filter((y: any) => typeof y === 'string') } : {}) })) : undefined, partyTheme: typeof raw?.partyTheme === 'string' ? raw.partyTheme : undefined, dayCourses: Array.isArray(raw?.dayCourses) ? raw.dayCourses.map((x: any) => typeof x === 'string' ? x : '') : [], extraActivities: raw?.extraActivities || [] };
  if (out.durationMode !== 'half' && out.durationMode !== 'day' && out.durationMode !== 'overnight') {
    out.durationMode = Number(out.nights) > 0 ? 'overnight' : (Number(out.days) <= 1 ? 'day' : 'overnight');
  }
  return normalizeDuration(out);
}

/* ===================== BRIEF PARSER ===================== */
// จังหวัด 77 + เมืองท่องเที่ยวที่มักเขียนแทนชื่อจังหวัด (เพื่อหา "พื้นที่" ของค่ายจากชื่อโรงแรม/สถานที่)
const PROVINCES = ['กรุงเทพมหานคร', 'กระบี่', 'กาญจนบุรี', 'กาฬสินธุ์', 'กำแพงเพชร', 'ขอนแก่น', 'จันทบุรี', 'ฉะเชิงเทรา', 'ชลบุรี', 'ชัยนาท', 'ชัยภูมิ', 'ชุมพร', 'เชียงราย', 'เชียงใหม่', 'ตรัง', 'ตราด', 'ตาก', 'นครนายก', 'นครปฐม', 'นครพนม', 'นครราชสีมา', 'นครศรีธรรมราช', 'นครสวรรค์', 'นนทบุรี', 'นราธิวาส', 'น่าน', 'บึงกาฬ', 'บุรีรัมย์', 'ปทุมธานี', 'ประจวบคีรีขันธ์', 'ปราจีนบุรี', 'ปัตตานี', 'พระนครศรีอยุธยา', 'พะเยา', 'พังงา', 'พัทลุง', 'พิจิตร', 'พิษณุโลก', 'เพชรบุรี', 'เพชรบูรณ์', 'แพร่', 'ภูเก็ต', 'มหาสารคาม', 'มุกดาหาร', 'แม่ฮ่องสอน', 'ยโสธร', 'ยะลา', 'ร้อยเอ็ด', 'ระนอง', 'ระยอง', 'ราชบุรี', 'ลพบุรี', 'ลำปาง', 'ลำพูน', 'เลย', 'ศรีสะเกษ', 'สกลนคร', 'สงขลา', 'สตูล', 'สมุทรปราการ', 'สมุทรสงคราม', 'สมุทรสาคร', 'สระแก้ว', 'สระบุรี', 'สิงห์บุรี', 'สุโขทัย', 'สุพรรณบุรี', 'สุราษฎร์ธานี', 'สุรินทร์', 'หนองคาย', 'หนองบัวลำภู', 'อ่างทอง', 'อำนาจเจริญ', 'อุดรธานี', 'อุตรดิตถ์', 'อุทัยธานี', 'อุบลราชธานี'];
const PLACE_PROVINCE: [RegExp, string][] = [
  [/พัทยา|บางแสน|ศรีราชา|สัตหีบ|บางเสร่|pattaya/i, 'ชลบุรี'], [/หัวหิน|ปราณบุรี|hua\s*hin/i, 'ประจวบคีรีขันธ์'], [/ชะอำ|cha[-\s]?am/i, 'เพชรบุรี'],
  [/เขาใหญ่|ปากช่อง|โคราช|korat|khao\s*yai/i, 'นครราชสีมา'], [/เชียงคาน/, 'เลย'], [/เขาค้อ|khao\s*kho/i, 'เพชรบูรณ์'], [/ขนอม|khanom/i, 'นครศรีธรรมราช'],
  [/เสม็ด|แม่รำพึง|rayong/i, 'ระยอง'], [/เกาะช้าง/, 'ตราด'], [/อัมพวา/, 'สมุทรสงคราม'], [/สวนผึ้ง/, 'ราชบุรี'], [/วังน้ำเขียว/, 'นครราชสีมา'],
  [/หาดใหญ่/, 'สงขลา'], [/เกาะสมุย|สมุย/, 'สุราษฎร์ธานี'], [/ปาย\b/, 'แม่ฮ่องสอน'], [/กรุงเทพ|bangkok/i, 'กรุงเทพมหานคร']
];
export const provinceIn = (s: string): string => {
  for (const [re, pv] of PLACE_PROVINCE) if (re.test(s)) return pv;
  const hits = PROVINCES.filter(p => s.includes(p)).sort((a, b) => b.length - a.length);   // ชื่อยาวก่อน (สิงห์บุรี ≠ บุรี)
  return hits[0] || '';
};
const MONTHS = 'มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม|ม\\.ค\\.|ก\\.พ\\.|มี\\.ค\\.|เม\\.ย\\.|พ\\.ค\\.|มิ\\.ย\\.|ก\\.ค\\.|ส\\.ค\\.|ก\\.ย\\.|ต\\.ค\\.|พ\\.ย\\.|ธ\\.ค\\.';
// ทำความสะอาดบรีฟ: ตัดเครื่องหมายคำพูด, รวมบรรทัดที่ขาดกลางวลี ("3\nวัน 2 คืน"), สระ/วรรณยุกต์ที่เผลอเว้นวรรค ("ค่ ะ")
// คืนสองชุดที่ตำแหน่งตัวอักษรตรงกัน: th = คงเลขไทย (ใช้ตัดชื่อเฉพาะ เช่น "…สิงหเสนี) ๔"), ar = เลขอารบิก (ใช้อ่านตัวเลข)
export const cleanBrief = (raw: string): { th: string; ar: string } => {
  const th = String(raw || '').replace(/[“”"«»‘’']/g, ' ').replace(/\r?\n+/g, ' ').replace(/[ \t ​]+/g, ' ')
    .replace(/([ก-ฮ])\s+(?=[ะาำิีึืุู่้๊๋็์ั])/g, '$1').trim();
  return { th, ar: toArabic(th) };
};
export interface BriefField { key: string; label: string; value: string; ok: boolean }
export interface BriefRead { camp: Camp; fields: BriefField[]; found: string[] }
// อ่านบรีฟภาษาคน (ตัวเลขไทย/อารบิก, มีหรือไม่มีเครื่องหมายคำพูด, ขึ้นบรรทัดกลางประโยค) → ข้อมูลค่าย + รายงานรายช่อง
export function readBrief(raw: string, base: Camp): BriefRead {
  const { th, ar: t } = cleanBrief(raw);
  const c = { ...base };
  const found: string[] = [];
  const num = (s: string) => Number(s.replace(/,/g, ''));
  let m: RegExpMatchArray | null;
  // รหัสเอกสาร: รองรับทั้งแบบเก่า (PL 0109/2569) และแบบอ้างรหัสหลักสูตรจริง (PL STM 0101/2569)
  if ((m = t.match(/(PL\s*[A-Z]{2,4}\s*\d{3,4}\s*\/\s*\d{4}|PL\s*\d+\s*\/\s*\d{4})/i))) { c.docCode = m[1].toUpperCase().replace(/\s+/g, ' ').replace(/\s*\/\s*/, '/'); found.push('docCode'); }
  // โรงเรียน: "โรงเรียน" + ชื่อ (รวมวงเล็บ/เลขรุ่น เช่น "บดินทรเดชา (สิงห์ สิงหเสนี) ๔") จนถึงคำที่ไม่ใช่ชื่อ — ตัดจากข้อความที่คงเลขไทย
  const SCHOOL_STOP = /\s*(?:ส่วนนี้|ซึ่ง|ต้องการ|ประสงค์|มีความ|ขอ|ติดต่อ|สนใจ|อยาก|จะจัด|จัด|ม\.\s*\d|ป\.\s*\d|มัธยม|ประถม|ระดับ|ชั้น|จำนวน|นักเรียน|ครู|ค่าย|วันที่|ณ\s|ราคา|เป็นเวลา|รวม|จังหวัด|จ\.\s|อำเภอ|อ\.\s|\d+\s*(?:คน|ท่าน|วัน)|[,;:]|$)/;
  const si = t.search(/โรงเรียน(?=\S)/);
  if (si >= 0) {
    const rest = t.slice(si);
    let cut = rest.length;
    const re = new RegExp(SCHOOL_STOP.source, 'g'); let mm: RegExpExecArray | null;
    re.lastIndex = 'โรงเรียน'.length + 1;
    while ((mm = re.exec(rest))) { if (mm.index > 'โรงเรียน'.length) { cut = mm.index; break; } if (mm[0] === '') { re.lastIndex++; } }
    let name = th.slice(si, si + cut).replace(/[\s.]+$/, '').trim();
    const op = (name.match(/\(/g) || []).length, cl = (name.match(/\)/g) || []).length;
    if (op > cl) name += ')';                                                     // วงเล็บถูกตัดกลาง → ปิดให้
    if (name.length > 'โรงเรียน'.length + 1) { c.school = name.replace(/\s*\(\s*/g, ' (').replace(/\s*\)/g, ')').replace(/\s{2,}/g, ' '); found.push('school'); }
  }
  // ระดับชั้น: ม.1-3 / ป.4-6 / มัธยมศึกษาปีที่ 1-3 / ประถมศึกษาปีที่ 4-6 / มัธยมต้น-ปลาย
  if ((m = t.match(/([มป])\.\s*(\d)(?:\s*[-–]\s*(?:[มป]\.\s*)?(\d))?/))) { c.level = `${m[1]}.${m[2]}${m[3] ? '-' + m[3] : ''}`; found.push('level'); }
  else if ((m = t.match(/(มัธยม|ประถม)ศึกษาปีที่\s*(\d)(?:\s*[-–]\s*(\d))?/))) { c.level = `${m[1] === 'มัธยม' ? 'ม' : 'ป'}.${m[2]}${m[3] ? '-' + m[3] : ''}`; found.push('level'); }
  else if (/มัธยม(?:ศึกษา)?\s*ตอนต้น|ม\.\s*ต้น/.test(t)) { c.level = 'ม.1-3'; found.push('level'); }
  else if (/มัธยม(?:ศึกษา)?\s*ตอนปลาย|ม\.\s*ปลาย/.test(t)) { c.level = 'ม.4-6'; found.push('level'); }
  else if (base.school === 'โรงเรียน...') c.level = '';            // งานใหม่ไม่มีระดับชั้น → ว่าง (ไม่เดา)
  // จำนวนคน
  if ((m = t.match(/นักเรียน[^\d]{0,25}?([\d,]+)\s*(?:คน|ท่าน)/)) || (m = t.match(/จำนวน\s*([\d,]+)\s*คน/))) { c.students = num(m[1]); found.push('students'); }
  else {   // "ม.ต้น 60 คน" — ตัวเลข "…คน" ตัวแรกที่ไม่ได้อยู่หลังคำว่า ครู/อาจารย์/วิทยากร/รวม
    const re = /([\d,]+)\s*คน/g; let x: RegExpExecArray | null;
    while ((x = re.exec(t))) { if (!/(ครู|อาจารย์|วิทยากร|ทีมงาน|รวม)[^\d]{0,15}$/.test(t.slice(Math.max(0, x.index - 20), x.index))) { c.students = num(x[1]); found.push('students'); break; } }
  }
  if ((m = t.match(/(?:ครู|อาจารย์)[^\d]{0,20}?([\d,]+)\s*(?:คน|ท่าน)/))) { c.teachers = num(m[1]); found.push('teachers'); }
  // วันที่: "วันที่ 14-16 ธ.ค. 2569" หรือ "14 – 16 ธันวาคม 2569"
  if ((m = t.match(new RegExp(`(?:วันที่\\s*)?\\d{1,2}(?:\\s*[-–]\\s*\\d{1,2})?\\s*(?:${MONTHS})(?:\\s*[-–]\\s*\\d{1,2}\\s*(?:${MONTHS}))?\\s*(?:พ\\.ศ\\.\\s*)?(?:25|26)\\d\\d`)))
    || (m = t.match(/วันที่\s*\d+[^ณ]*?(?:25\d\d|26\d\d)/))) {
    const d = m[0].trim().replace(/\s*[-–]\s*/g, ' – ');
    c.dates = /^วันที่/.test(d) ? d : 'วันที่ ' + d; found.push('dates');
  }
  const dur = parseDuration(t);
  if (dur.resolved) { c.durationMode = dur.mode; c.days = dur.days; c.nights = dur.nights; found.push('duration'); }
  // ราคา: "ราคาปกติ / ราคาขายปกติ / ปกติ X" · "ลดเหลือ(เพียง) / ราคาพิเศษ / เหลือ / โปร X"
  if ((m = t.match(/(?:ราคา\s*(?:ขาย\s*)?ปกติ|ปกติ)\s*(?:ท่านละ|คนละ|หัวละ)?\s*([\d,]{3,})/))) { c.normalPrice = num(m[1]); found.push('normalPrice'); }
  if ((m = t.match(/(?:ลด\s*เหลือ(?:\s*เพียง)?|ราคา\s*พิเศษ|เหลือ(?:\s*เพียง)?|โปรโมชั่น|โปร)\s*(?:ท่านละ|คนละ|หัวละ)?\s*([\d,]{3,})/))) { c.specialPrice = num(m[1]); found.push('specialPrice'); }
  if (!found.includes('normalPrice') && !found.includes('specialPrice') && (m = t.match(/(?:ราคา(?:ขาย)?|ท่านละ|คนละ|หัวละ)\s*([\d,]{3,})\s*บาท/))) { c.normalPrice = c.specialPrice = num(m[1]); found.push('normalPrice', 'specialPrice'); }
  // ---- สถานที่/โรงแรม: "ณ …" / "จัดที่ …" / "สถานที่ …" / "พักที่ …" / หรือคำว่า โรงแรม…/…รีสอร์ท ----
  const VSTOP = '(?=\\s*(?:ราคา|งบประมาณ|งบ|โทร|ติดต่อ|โดย|จังหวัด|จ\\.|อำเภอ|วันที่|นักเรียน|จำนวน|ครู|เป็นเวลา|ห้อง(?:ละ|พัก)|คืนละ|รถ(?:บัส|ตู้)|ค่ะ|ครับ|นะคะ|$)|[,;])';
  let venueText = '';
  if ((m = t.match(new RegExp(`(?:\\sณ|จัด(?:ค่าย)?(?:ที่|ณ)|สถานที่(?:จัด)?(?:ค่าย)?|ที่พัก(?:คือ)?|พักที่)\\s*:?\\s*(.+?)${VSTOP}`))) && m[1].trim().length >= 3) venueText = m[1];
  else if ((m = t.match(/(?:พัก|นอน)(?:ที่)?\s*([ก-๙A-Za-z]{2,}(?:รีสอร์ท|โรงแรม|resort|hotel)[ก-๙A-Za-z]*)/i))) venueText = m[1];   // "พักภูวิวรีสอร์ท"
  else if ((m = t.match(/([A-Z][\w&'.-]*(?:\s+[A-Z][\w&'.-]*)*\s+(?:Hotel|Resort|Spa|Villa|Inn|Lodge)\b(?:\s+(?:and\s+)?[A-Z][\w&'.-]*)*)/))) venueText = m[1];   // ชื่ออังกฤษ เช่น Fortune Hotel Korat
  else if ((m = t.match(new RegExp(`((?:โรงแรม|รีสอร์ท|resort|hotel)\\S*(?:\\s(?!ราคา|จังหวัด|วันที่)\\S+){0,3}?)${VSTOP}`, 'i')))) venueText = m[1];
  venueText = venueText.replace(/^(ที่|ณ)\s*/, '').replace(/[.\s]+$/, '').trim();
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
    c.supplierNote = c.supplierNote || known.note; found.push('venue');
  } else if (venueText) {
    // โรงแรมใหม่ที่ยังไม่อยู่ในคลัง — ใช้ตามบรีฟ และล้างทัศนศึกษา/ผู้ติดต่อ/จังหวัดของที่เดิมทิ้ง (ให้กรอกเองในแท็บ 2)
    c.venue = venueText; c.venueVisit = ''; c.supplierNote = ''; c.province = ''; found.push('venue');
  }
  // จังหวัด: ระบุชัดในบรีฟ > จากชื่อสถานที่ (พัทยา→ชลบุรี) > ชื่อจังหวัดที่อยู่นอกชื่อโรงเรียน
  const noSchool = c.school && found.includes('school') ? t.replace(toArabic(c.school), ' ') : t;
  if ((m = t.match(/(?:จังหวัด|จ\.)\s*([ก-๙]+)/)) && PROVINCES.includes(m[1])) c.province = m[1];
  else if (venueText && provinceIn(venueText)) c.province = provinceIn(venueText);
  else if (!known && !c.province && provinceIn(noSchool)) c.province = provinceIn(noSchool);
  if (c.province && c.province !== base.province) found.push('province');
  // ตรวจจับหลักสูตร (ธีม) จริงจากบรีฟก่อน — ได้คลังกิจกรรมตรงธีม
  // กิจกรรมเสริม: "เสริม/พ่วง/+/add-on ภาษาอังกฤษ|จีน|คณิต" → addons (ตัดวลีนี้ออกก่อนตรวจหลักสูตรหลัก ไม่ให้ธีมหลักเพี้ยน)
  const SUBJ = '(?:ภาษา)?\\s*(?:อังกฤษ|english|จีน|chinese|คณิต(?:ศาสตร์)?|math)';
  const ADDON_RE = new RegExp(`(?:เสริม|add[\\s-]?on|พ่วง|\\+)\\s*(?:กิจกรรม|ทักษะ)?\\s*(${SUBJ}(?:\\s*(?:และ|กับ|,|/|\\+|&)\\s*${SUBJ})*)`, 'gi');
  const adCodes: string[] = [];
  for (const m of noSchool.matchAll(ADDON_RE)) for (const w0 of m[1].match(/อังกฤษ|english|จีน|chinese|คณิต|math/gi) || []) {
    const w = w0.toLowerCase(); const code = /อังกฤษ|english/.test(w) ? 'PL ENG 0104' : /จีน|chinese/.test(w) ? 'PL CHI 0109' : 'PL MAT 0107';
    if (!adCodes.includes(code)) adCodes.push(code);
  }
  // ธีมรายวัน: "วันแรก ภาษาอังกฤษ วันที่ 2 วิทยาศาสตร์ทะเล" → dayCourses (ไม่นับ "2 วัน 1 คืน" / "วันที่ 14-16 ธ.ค." / "วันที่ 1 ม.ค.")
  const noAdd = noSchool.replace(ADDON_RE, ' ');
  const DAYW: Record<string, number> = { 'แรก': 0, 'หนึ่ง': 0, 'สอง': 1, 'สาม': 2, 'สี่': 3 };
  const MONTH_AFTER = /^\s*(?:ม\.?ค|ก\.?พ|มี\.?ค|เม\.?ย|พ\.?ค|มิ\.?ย|ก\.?ค|ส\.?ค|ก\.?ย|ต\.?ค|พ\.?ย|ธ\.?ค|มกรา|กุมภา|มีนา|เมษา|พฤษภา|มิถุนา|กรกฎา|สิงหา|กันยา|ตุลา|พฤศจิกา|ธันวา)/;
  const dayHits = [...noAdd.matchAll(/วัน(?:ที่)?\s*(แรก|หนึ่ง|สอง|สาม|สี่|สุดท้าย|[1-4](?!\s*[-–]?\s*\d)(?!\s*คืน))/g)];
  const dayMap = new Map<number, string>();
  dayHits.forEach((m, j) => {
    const from = (m.index || 0) + m[0].length, to = j + 1 < dayHits.length ? (dayHits[j + 1].index || 0) : from + 40;
    const seg = noAdd.slice(from, Math.min(to, from + 40));
    if (MONTH_AFTER.test(seg)) return;
    const co = detectCourse(seg); if (!co) return;
    const idx = m[1] === 'สุดท้าย' ? Math.max(0, (c.days || 1) - 1) : m[1] in DAYW ? DAYW[m[1]] : +m[1] - 1;
    if (idx >= 0 && idx < 4 && !dayMap.has(idx)) dayMap.set(idx, co.code);
  });
  const textNoDays = dayMap.size ? dayHits.reduce((t, m) => t.replace(m[0], ' '), noAdd) : noAdd;
  const course = dayMap.size ? (courseById(dayMap.get(0)) || detectCourse(textNoDays) || courseById([...dayMap.values()][0])) : detectCourse(noAdd);
  const prev = c.subject, prevCourse = c.courseCode;
  if (course) { c.courseCode = course.code; c.subject = course.family as Subject; found.push('course'); }
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
  if (c.courseCode !== prevCourse || c.durationMode !== base.durationMode || c.days !== base.days) { c.templateId = undefined; c.budgetItems = undefined; }
  // ธีมปาร์ตี้: "ปาร์ตี้ธีม Under The Sea" / "ธีมปาร์ตี้ ฮาวาย" / "party theme Neon Night"
  const pt = noSchool.match(/(?:ธีม\s*ปาร์ตี้|ปาร์ตี้\s*ธีม|party\s*theme)\s*[:：-]?\s*([A-Za-z][A-Za-z0-9&'\- ]{1,30}?[A-Za-z0-9](?=\s*(?:[\u0E00-\u0E7F,.]|$))|[\u0E00-\u0E7F]+)/i);
  if (pt) { c.partyTheme = pt[1].trim(); found.push('partyTheme'); }
  if (dayMap.size && c.courseCode) { const n = c.durationMode === 'half' ? 1 : Math.max(1, c.days || 1); c.dayCourses = Array.from({ length: n }, (_, i) => { const x = dayMap.get(i); return x && x !== c.courseCode ? x : ''; }); if (!c.dayCourses.some(Boolean)) c.dayCourses = undefined; }
  else if (c.courseCode !== prevCourse) c.dayCourses = undefined;
  if (adCodes.length) { const keep = (base.addons || []).filter(a => adCodes.includes(a.code)); c.addons = adCodes.filter(x => x !== c.courseCode).map(code => keep.find(a => a.code === code) || { code }); }
  return { camp: c, found, fields: briefFields(c, found) };
}
// รายงานผลอ่านบรีฟ (ใช้ทั้งตัวอ่านปกติและ AI) — แสดงให้ฝ่ายขายเห็นว่าระบบเข้าใจบรีฟอย่างไร ก่อนสร้างไฟล์
export function briefFields(c: Camp, found: string[]): BriefField[] {
  const has = (k: string) => found.includes(k);
  const co = c.courseCode ? courseById(c.courseCode) : undefined;
  const vs = venuePhotoSetFor(c.venue);
  const durL = c.durationMode === 'half' ? 'ครึ่งวัน' : c.durationMode === 'day' ? `${c.days} วัน (ไป-กลับ)` : `${c.days} วัน ${c.nights} คืน`;
  return [
    { key: 'school', label: 'โรงเรียน', value: has('school') ? c.school : '', ok: has('school') },
    { key: 'level', label: 'ระดับชั้น', value: has('level') ? c.level : '', ok: has('level') },
    { key: 'students', label: 'นักเรียน', value: has('students') ? `${c.students} คน` : '', ok: has('students') },
    { key: 'teachers', label: 'ครูผู้ดูแล', value: has('teachers') ? `${c.teachers} คน` : '', ok: has('teachers') },
    { key: 'course', label: 'หลักสูตร', value: co ? `${co.code} · ${co.name}` : '', ok: !!co },
    { key: 'duration', label: 'ระยะเวลา', value: has('duration') ? durL : '', ok: has('duration') },
    { key: 'dates', label: 'วันที่', value: has('dates') ? c.dates : '', ok: has('dates') },
    { key: 'venue', label: 'สถานที่/โรงแรม', value: has('venue') ? c.venue : '', ok: has('venue') },
    { key: 'province', label: 'จังหวัด', value: c.province || '', ok: !!c.province },
    { key: 'normalPrice', label: 'ราคาปกติ', value: has('normalPrice') ? `${money(c.normalPrice)} บาท` : '', ok: has('normalPrice') },
    { key: 'specialPrice', label: 'ราคาพิเศษ', value: has('specialPrice') ? `${money(c.specialPrice)} บาท/ท่าน` : '', ok: has('specialPrice') },
    { key: 'venuePhotos', label: 'ภาพโรงแรม', value: vs ? `${vs.photos.length} รูป (${vs.name})` : '', ok: !!vs },
    ...(c.partyTheme ? [{ key: 'partyTheme', label: 'ธีมปาร์ตี้', value: c.partyTheme, ok: true }] : []),
    ...(c.dayCourses && c.dayCourses.some(Boolean) ? [{ key: 'dayCourses', label: 'ธีมรายวัน', value: Array.from({ length: c.durationMode === 'half' ? 1 : c.days }, (_, i) => `วันที่ ${i + 1} ${courseLabel(dayCourseOf(c, i))}`).join(' · '), ok: true }] : []),
    ...(c.addons && c.addons.length ? [{ key: 'addons', label: 'กิจกรรมเสริม', value: c.addons.map(a => addonLabel(a.code)).join(' + '), ok: true }] : [])
  ];
}
export function parseBrief(t: string, base: Camp): Camp { return readBrief(t, base).camp; }
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

export interface Plan { days: Day[]; meals: { b: number; l: number; d: number; s: number }; coreSlots: number; hasTrip: boolean; usedActivityIds: string[]; tpl?: TplInfo; addons?: AddonPlan[]; addonWarn?: string[]; mix?: DayMix[]; editMissed?: number; extWarn?: string[] }
export interface DayMix { day: number; code: string; label: string; source: string }
export interface AddonPlan { code: string; label: string; titles: string[]; price: number }
// สรุปแม่แบบที่ใช้กับค่ายนี้ (แสดงใน UI/ตรวจความถูกต้อง)
export interface TplInfo {
  id: string; source: string; dur: string; exact: boolean; areaOK: boolean | null; area: string[];
  locRows: string[]; dropped: string[]; aar: boolean; depWarn?: string; options: { id: string; label: string }[]; price?: { n: number; s: number }
}
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
/* ===================== แม่แบบโปรแกรมจริงของทีม (TEMPLATES) =====================
 * ที่มา: เอกสาร PL จริงใน Drive (14 หลักสูตร × ระยะเวลา) → scripts/gen-course-templates.py → src/course-templates-data.ts
 * หลักการ: หลักสูตร + ระยะเวลาตรงกับแม่แบบ → ใช้หน้าปก/กิจกรรม/กำหนดการ/งบของแม่แบบนั้น แทนข้อมูลงานเดิมด้วยข้อมูลบรีฟ
 *   (โรงเรียน/ที่พัก/จังหวัด/ปี/จำนวนคน/วิทยากร/คืน/มื้อ) · ไม่มีแม่แบบระยะเวลานั้น → หน้าปกจากแม่แบบใกล้สุด + กำหนดการจัดอัตโนมัติ
 *   แถวที่ผูกพื้นที่ (ทัศนศึกษา/เกาะ/อุทยาน…) ถ้าพื้นที่บรีฟไม่ตรงพื้นที่แม่แบบ → เตือนให้ตรวจ (ไม่เดาสถานที่ใหม่) */
// ระยะเวลาค่าย → คีย์แม่แบบ: half · day1/day2 (ไป-กลับ) · o21/o32 (พักค้าง)
export const durKeyOf = (c: Pick<Camp, 'durationMode' | 'days' | 'nights'>): string =>
  c.durationMode === 'half' ? 'half' : c.durationMode === 'day' ? `day${Math.max(1, c.days || 1)}` : `o${c.days}${c.nights}`;
export const durKeyLabel = (k: string): string => k === 'half' ? 'ครึ่งวัน' : k.startsWith('day') ? `${k.slice(3)} วัน (ไป-กลับ)` : `${k.charAt(1)} วัน ${k.slice(2)} คืน`;
export const templatesOf = (code?: string): CourseTemplate[] => code ? TEMPLATES.filter(t => t.code === code) : [];
export const templateById = (id?: string): CourseTemplate | undefined => id ? TEMPLATES.find(t => t.id === id) : undefined;
const NEAR: Record<string, string[]> = { half: ['day1', 'day2', 'o21', 'o32'], day1: ['day1', 'day2', 'o21', 'o32'], day2: ['day2', 'day1', 'o21', 'o32'], o21: ['o21', 'o32', 'day2', 'day1'], o32: ['o32', 'o21', 'day2', 'day1'] };
const nearOrder = (k: string) => NEAR[k] || (k.startsWith('day') ? ['day2', 'day1', 'o32', 'o21'] : ['o32', 'o21', 'day2', 'day1']);
const placeKey = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9ก-๙]/g, '');
// พื้นที่ค่าย (จังหวัด/สถานที่ในบรีฟ) ตรงกับพื้นที่ของแม่แบบไหม — null = แม่แบบไม่ผูกพื้นที่ / ระบุพื้นที่ไม่ได้
export const areaMatch = (t: CourseTemplate, c: Pick<Camp, 'province' | 'venue' | 'venueVisit'>): boolean | null => {
  if (!t.area.length) return null;
  const hay = `${c.province || ''} ${c.venue || ''} ${c.venueVisit || ''}`;
  if (t.area.some(a => hay.includes(a))) return true;
  return !!(t.venue && placeKey(c.venue).length > 3 && placeKey(c.venue).includes(placeKey(t.venue)));
};
const tplLabel = (t: CourseTemplate) => t.variant === 'past' ? `งานเดิม · ${t.source.replace(/\.docx?$/i, '').slice(0, 70)}` : `${durKeyLabel(t.dur)}${t.area.length ? ` · พื้นที่${t.area.join('/')}` : ''}${t.venue ? ` · ${t.venue}` : ''}`;
export interface TplPick { tpl: CourseTemplate; exact: boolean; areaOK: boolean | null; options: CourseTemplate[] }
export function templateFor(c: Camp): TplPick | undefined {
  if (c.templateId === 'engine') return undefined;
  // งานเก่าที่ดึงมาแก้: ใช้โปรแกรมเดิมเป็นแม่แบบ เมื่อยังไม่ได้เลือกแม่แบบอื่น + ระยะเวลา/หลักสูตรยังตรงกับงานเดิม
  const pt = c.pastTpl;
  if (pt && pt.days && pt.days.length && (!c.templateId || c.templateId === pt.id) && pt.dur === durKeyOf(c) && (!pt.code || pt.code === c.courseCode)) {
    return { tpl: pt, exact: true, areaOK: null, options: [pt, ...templatesOf(c.courseCode).filter(t => t.dur === pt.dur)] };
  }
  if (!c.courseCode) return undefined;
  const all = templatesOf(c.courseCode); if (!all.length) return undefined;
  const key = durKeyOf(c);
  const exactList = all.filter(t => t.dur === key);
  let tpl = c.templateId ? exactList.find(t => t.id === c.templateId) : undefined;
  if (!tpl && exactList.length) {
    // หลายแม่แบบระยะเวลาเดียวกัน (เช่น ทะเล 2 วัน 1 คืน มีแบบทั่วไป/แบบพัทยา-เกาะขาม) → พื้นที่ตรงก่อน → ไม่ผูกพื้นที่ → อื่น ๆ
    const sc = (t: CourseTemplate) => { const m = areaMatch(t, c); return m === true ? 0 : m === null ? 1 : 2; };
    tpl = exactList.map((t, i) => ({ t, i })).sort((a, b) => sc(a.t) - sc(b.t) || a.i - b.i)[0].t;
  }
  if (tpl) return { tpl, exact: true, areaOK: areaMatch(tpl, c), options: exactList };
  for (const k of nearOrder(key)) { const t = all.find(x => x.dur === k); if (t) return { tpl: t, exact: false, areaOK: null, options: [] }; }
  return undefined;
}
// ปี ค.ศ. ของค่าย (ใช้แทนปีในชื่อหลักสูตร เช่น "Math CAMP 2025") — จากวันที่ในบรีฟ → รหัสเอกสาร → ปีปัจจุบัน
export const campYear = (c: Pick<Camp, 'dates' | 'docCode'>): number => {
  const m = String(c.dates || '').match(/25\d\d/); if (m) return +m[0] - 543;
  const d = String(c.docCode || '').match(/\/(\d{4})\s*$/); if (d) return +d[1] > 2400 ? +d[1] - 543 : +d[1];
  return new Date().getFullYear();
};
// เติมตัวแปรแม่แบบ {S}{V}{P}{Y} ด้วยข้อมูลบรีฟ · ⟦…⟧ ตัดทิ้งเมื่อบรีฟไม่มีค่านั้น (ไม่ปล่อยชื่องานเดิมค้าง)
export const fillTpl = (s: string, c: Pick<Camp, 'school' | 'venue' | 'province' | 'dates' | 'docCode'>): string => {
  const v: Record<string, string> = { S: hasVal(c.school) ? c.school.trim() : '', V: hasVal(c.venue) ? c.venue.trim() : '', P: (c.province || '').trim(), Y: String(campYear(c)) };
  const out = s.replace(/⟦([^⟧]*)⟧/g, (_: string, inner: string) => ((inner.match(/\{[SVPY]\}/g) || []).some(k => !v[k.charAt(1)]) ? '' : inner))
    .replace(/\{S\}/g, v.S || 'โรงเรียน').replace(/\{V\}/g, v.V || 'ที่พัก').replace(/\{P\}/g, v.P).replace(/\{Y\}/g, v.Y);
  return out.replace(/\s{2,}/g, ' ').trim();
};
const tmins = (t: string): number[] => { const out: number[] = []; const re = /(\d{1,2})[.:](\d{2})/g; let m: RegExpExecArray | null; while ((m = re.exec(t))) out.push(+m[1] * 60 + +m[2]); return out; };
const MEAL_MAIN = /รับประทานอาหาร(เช้า|กลางวัน|เที่ยง|เย็น)/, MEAL_SNACK = /อาหารว่าง/;
// แม่แบบภาษาอังกฤษ (ENG) ใช้ชื่อแถวอังกฤษ — "Have Lunch / Time for Lunch / Have breakfast / Have Dinner" = มื้อหลัก
//   "Take a Break / Time for Break" = อาหารว่าง เฉพาะช่วงสั้น ≤ 30 นาที หรือมีเลขมื้อ (ช่วงยาว เช่น 16.30–18.00 = เวลาว่าง ไม่ใช่มื้อ)
const MEAL_MAIN_EN = /\b(?:Have|Time for)\s+(breakfast|lunch|dinner)\b/i, MEAL_SNACK_EN = /\b(?:Take a|Time for)\s+Break\b/i;
export function mealKind(title: string, time = ''): 'b' | 'l' | 'd' | 's' | null {
  const th = title.match(MEAL_MAIN); if (th) return th[1] === 'เช้า' ? 'b' : th[1] === 'เย็น' ? 'd' : 'l';
  if (MEAL_SNACK.test(title)) return 's';
  const en = title.match(MEAL_MAIN_EN); if (en) { const w = en[1].toLowerCase(); return w === 'breakfast' ? 'b' : w === 'dinner' ? 'd' : 'l'; }
  if (MEAL_SNACK_EN.test(title)) { const t = tmins(time); if (/\(\d+\)/.test(title) || (t.length >= 2 && t[1] - t[0] <= 30)) return 's'; }
  return null;
}
const isMealRow = (x: string) => MEAL_MAIN.test(x) || MEAL_SNACK.test(x) || MEAL_MAIN_EN.test(x) || MEAL_SNACK_EN.test(x);
// ใส่เลขมื้อใหม่หลังคำมื้อ (ไทย/อังกฤษ) — ตัดเลขเดิมทั้งหมดก่อน
const renumMeal = (t: string, n: number) => { const parts = t.replace(/\s*\(\d+\)/g, '').trim().match(/^(.*?(?:รับประทานอาหาร\S*|อาหารว่าง\S*|(?:Have|Time for)\s+\w+\.?|Take a Break\.?))(.*)$/i); return parts ? `${parts[1]} (${n})${parts[2]}` : `${t} (${n})`; };
const tplInfo = (p: TplPick, extra: Partial<TplInfo> = {}): TplInfo => {
  const acts = p.tpl.secs.find(x => x.acts);
  return {
    id: p.tpl.id, source: p.tpl.source, dur: p.tpl.dur, exact: p.exact, areaOK: p.areaOK, area: p.tpl.area, locRows: [], dropped: p.tpl.dropped || [],
    aar: !!acts && (acts.items || []).some(x => /AAR|After Action Review/i.test(x)),
    options: p.options.map(t => ({ id: t.id, label: tplLabel(t) })), price: p.tpl.price, ...extra
  };
};
function planFromTemplate(c: Camp, p: TplPick): Plan {
  const t = p.tpl;
  const meals = { b: 0, l: 0, d: 0, s: 0 }; let main = 0;
  // ต้นฉบับบางไฟล์ใส่เลขมื้อ (1)(2)… ไม่ต่อเนื่อง → ถ้ามีเลข ให้เรียงใหม่ (มื้อหลัก/มื้อว่างนับแยก เหมือนระบบ)
  const numbered = t.days.some(d => d.some(r => isMealRow(r.x) && /\(\d+\)\s*$/.test(r.x)));
  const locRows: string[] = [];
  const days: Day[] = t.days.map((rows, i) => ({ day: i + 1, items: rows.map(r => {
    let title = fillTpl(r.x, c);
    const sub = (r.s || []).map(x => fillTpl(x, c)).filter(Boolean);
    const mk = mealKind(title, r.t);
    if (mk && mk !== 's') { meals[mk]++; main++; if (numbered) title = renumMeal(title, main); }
    else if (mk === 's') { meals.s++; if (numbered) title = renumMeal(title, meals.s); }
    if (r.loc) locRows.push(`วันที่ ${i + 1} ${r.t} ${title}`);
    const row: Row = { time: r.t, title }; if (sub.length) row.sub = sub; return row;
  }) }));
  // เวลาออกเดินทาง: ใช้เวลาตามบรีฟ ถึงเวลาเริ่มรายการถัดไปของแม่แบบ (เวลากิจกรรมทั้งหมดคงตามแม่แบบของทีม)
  let depWarn: string | undefined;
  const d1 = days[0] ? days[0].items : [];
  const dep = d1.findIndex(r => /^(ออกเดินทาง|เดินทางออก)/.test(r.title));
  if (dep >= 0 && dep + 1 < d1.length && hasVal(c.startTime)) {
    const st = tmins(c.startTime)[0], arrive = tmins(d1[dep + 1].time)[0];
    if (st !== undefined && arrive !== undefined) {
      if (st < arrive) d1[dep] = { ...d1[dep], time: rng(st, arrive) };
      else depWarn = `เวลาออกเดินทาง ${c.startTime} น. ช้ากว่ากำหนดการของแม่แบบ (${fmt(arrive)} น.) — ปรับเวลาในไฟล์ Word`;
    }
  }
  const actSec = t.secs.find(x => x.acts);
  if (actSec && actSec.loc) for (const i of actSec.loc) if (actSec.items && actSec.items[i]) locRows.push(`หน้าปก: ${fillTpl(actSec.items[i], c)}`);
  return { days, meals, coreSlots: 0, hasTrip: locRows.length > 0, usedActivityIds: [], tpl: tplInfo(p, { locRows, depWarn }) };
}
// งบประมาณจากแม่แบบ: คงถ้อยคำทีม แต่คำนวณใหม่จากบรีฟ/กำหนดการจริง — คืนที่พัก · มื้ออาหาร · อาหารว่าง · จำนวนวิทยากร · จำนวนรถบัส
// (ต้นฉบับหลายไฟล์ตัวเลขไม่ตรงกับกำหนดการของตัวเอง จึงห้ามคัดลอกตัวเลขตรง ๆ)
function budgetFromTemplate(lines: string[], c: Camp, plan: Plan, staff: string): string[] {
  const m = plan.meals, main = m.b + m.l + m.d;
  const parts = [m.b && `อาหารเช้า ${m.b} มื้อ`, m.l && `อาหารกลางวัน ${m.l} มื้อ`, m.d && `อาหารเย็น ${m.d} มื้อ`].filter(Boolean).join(' ');
  const ppl = (c.students || 0) + (c.teachers || 0);
  const out: string[] = [];
  for (const raw of lines) {
    if (/^ค่าที่พัก/.test(raw)) {
      if (!(c.nights > 0)) continue;
      let tail = raw.replace(/^ค่าที่พัก\s*(\d+\s*คืน|หนึ่งคืน|สองคืน|สามคืน)?/, '').replace(/⟦[^⟧]*⟧/g, '').replace(/\{V\}/g, '').replace(/^\s*ณ\s*/, '').trim();
      if (/^เทียบเท่า$/.test(tail)) tail = 'หรือเทียบเท่า';
      out.push(`ค่าที่พัก ${c.nights} คืน${hasVal(c.venue) ? ' ' + c.venue.trim() : ''}${tail ? ' ' + tail : ''}`); continue;
    }
    if (/^(ค่า)?อาหาร(อาหาร)?\s*\d+\s*มื้อ/.test(raw) && !/^(ค่า)?อาหารว่าง/.test(raw)) { if (main > 0) out.push(`ค่าอาหาร ${main} มื้อ (${parts})`); continue; }
    if (/^(ค่า)?(พัก)?อาหารว่าง\s*\d+\s*มื้อ/.test(raw)) {
      if (m.s > 0) { const desc = (raw.match(/\([^()]*\)/) || [''])[0]; out.push(`ค่าอาหารว่าง ${m.s} มื้อ${desc && !/มื้อ/.test(desc) ? ' ' + desc.replace(/\(\s*/, '(').replace(/\s*\)/, ')') : ''}`); }
      continue;
    }
    if (/^\(.*มื้อ.*\)$/.test(raw.trim())) continue;
    if (/^ตัวอย่าง(ภาพ)?กิจกรรม/.test(raw.trim())) continue;        // หัวข้อหน้าภาพที่ติดมาตอนแกะต้นฉบับ (SEA/STM) ไม่ใช่รายการงบ               // เศษบรรทัดต่อของมื้ออาหาร (เช่น "( มาม่าคัพ 2 มื้อ )")
    let x = fillTpl(raw, c);
    if (/วิทยากร/.test(x) && /(\d+\s*[-–]\s*\d+|\d+)\s*ท่าน/.test(x)) {
      const before = (x.match(/(\d+\s*[-–]\s*\d+|\d+)\s*ท่าน/) || ['', ''])[1].replace(/\s/g, '').replace('–', '-');
      const same = before === staff.replace(/\s/g, '').replace('–', '-');
      x = x.replace(/(จำนวน\s*)?(\d+\s*[-–]\s*\d+|\d+)\s*ท่าน/, `จำนวน ${staff} ท่าน`);
      if (!same) x = x.replace(/\s*\([^)]*\)\s*$/, '');           // สัดส่วนทีมในวงเล็บของงานเดิมไม่ตรงจำนวนใหม่ → ตัดออก
    }
    const bus = x.match(/รถบัส.*?(?:ความจุ|ขนาด)\s*(\d+)\s*ที่นั่ง/);
    if (bus && /จำนวน\s*\d+\s*คัน/.test(x) && ppl > 0) x = x.replace(/จำนวน\s*\d+\s*คัน/, `จำนวน ${Math.max(1, Math.ceil(ppl / +bus[1]))} คัน`);
    out.push(x);
  }
  return out;
}
// ภาพที่ระบบดึงให้ค่ายนี้: ภาพกิจกรรมจากไฟล์ของแม่แบบที่ใช้ (6–8 รูป) · ภาพที่พักเฉพาะเมื่อที่พักในบรีฟตรงกับโรงแรมในไฟล์ทีม
// (core ไม่โหลดไฟล์เอง — เว็บ fetch จาก photos/<id>.jpg, สคริปต์ node อ่านจาก web/photos)
// ===== ชุดภาพ (ยกทั้งชุด) =====
// ชุดใหม่ล่าสุดของหลักสูตร (FRESH_PHOTOS — ภาพปี 2568–2569 ครอป 4:3 ความละเอียดสูง) + ชุดภาพจากไฟล์โปรแกรมจริงแต่ละระยะเวลา
export interface PhotoSet { id: string; label: string; source: string; ids: string[]; fresh?: boolean }
export const photoSetsFor = (code?: string): PhotoSet[] => {
  if (!code) return [];
  const out: PhotoSet[] = [];
  const f = FRESH_PHOTOS[code];
  if (f && f.ids.length) out.push({ id: 'fresh:' + code, label: 'ภาพกิจกรรมล่าสุด', source: f.source, ids: f.ids, fresh: true });
  const seen = new Set<string>();
  for (const t of templatesOf(code)) {
    const key = t.photos.join(','); if (!t.photos.length || seen.has(key)) continue; seen.add(key);
    out.push({ id: 'tpl:' + t.id, label: `ภาพจากโปรแกรม ${durKeyLabel(t.dur)}${t.variant ? ' · ' + t.variant : ''}`, source: t.source || t.id, ids: t.photos });
  }
  return out;
};
// ชุดเริ่มต้นของหลักสูตร: ชุดใหม่ล่าสุด (ถ้ามี ≥6 รูป) ไม่งั้นภาพจากไฟล์ค่ายตามระยะเวลา (ชุดใหม่ที่มีไม่ถึง 6 → ขึ้นก่อน แล้วเติมจากไฟล์ค่าย)
const defaultPhotoIds = (c: Camp): string[] => {
  const f = c.courseCode ? FRESH_PHOTOS[c.courseCode] : undefined;
  const p = templateFor(c); const tpl = p ? p.tpl.photos : [];
  if (f && f.ids.length >= 6) return f.ids.slice(0, 8);
  const ids = [...(f ? f.ids : [])]; for (const x of tpl) if (ids.length < 8 && !ids.includes(x)) ids.push(x);
  return ids;
};
export const photoIdsFor = (c: Camp): string[] => {
  if (c.photoSet) { const s = photoSetsFor(c.courseCode).find(x => x.id === c.photoSet); if (s) return s.ids.slice(0, 8); }
  if (!isMixed(c)) return defaultPhotoIds(c);
  // ค่าย mix: ภาพจากไฟล์ของทุกหลักสูตรที่ใช้จริงในกำหนดการ สลับกันจนครบ 8
  const codes = Array.from(new Set(Array.from({ length: nDaysOf(c) }, (_, i) => dayCourseOf(c, i))));
  const lists = codes.map(code => defaultPhotoIds(code === c.courseCode ? c : campFor(c, code)));
  const out: string[] = [];
  for (let k = 0; out.length < 8 && lists.some(l => k < l.length); k++) for (const l of lists) if (k < l.length && !out.includes(l[k]) && out.length < 8) out.push(l[k]);
  return out;
};
// ชื่อไทย/สะกดต่างที่ฝ่ายขายใช้บ่อย → โรงแรมในไฟล์ทีม (เช่น "กาสะรอง/กาสะลอง" = Kasalong Resort and Spa)
const VENUE_ALIAS: [RegExp, string][] = [
  [/กาสะ\s*[ลร]อง|kasalong/i, 'Kasalong Resort and Spa'], [/ฟอร์จู?น|fortune/i, 'Fortune Hotel Korat'], [/เลย\s*พาเลซ|loei\s*palace/i, 'Loei Palace Hotel'],
  [/ฟาว(?:น์)?เท(?:่)?น\s*ทรี|fountain\s*tree/i, 'Fountain Tree Resort'], [/บีซีพี|bcp/i, 'BCP Hotel Rayong'], [/เบลล่า\s*วิลล่า|bella\s*villa/i, 'Bella Villa Cabana Pattaya'],
  [/จันทรา\s*รีสอร์ท/, 'โรงแรมจันทรา รีสอร์ท']
];
export const venuePhotoSetFor = (venue?: string) => {
  const v = String(venue || '');
  for (const [re, name] of VENUE_ALIAS) if (re.test(v)) { const hit = VENUE_PHOTOS.find(x => x.name === name); if (hit) return hit; }
  const k = placeKey(v); if (k.length < 5) return undefined;
  return VENUE_PHOTOS.find(x => { const n = placeKey(x.name); return k.includes(n) || n.includes(k); });
};
export const photoCaption = (_c: Camp, _i: number): string => '';
export const venueCaption = (_name: string, _i: number): string => '';
export function buildSchedule(c: Camp): Plan {
  return applyEdits(c, applyExtends(c, applyAddons(c, applyDayMix(c, basePlan(c)))));
}
/* ===================== ขยายเวลาเลิกรายวัน =====================
 * แถวท้ายวันที่ติดกัน (พิธีปิด/สรุป/AAR/ถอดบทเรียน/เดินทางกลับ/พักผ่อน) = "ท้ายวัน" → แทรกช่วงใหม่ก่อนท้ายวัน แล้วเลื่อนท้ายวันออกไปเท่าที่ขยาย
 * ช่วงใหม่: กิจกรรมจริงของหลักสูตรวันนั้นที่ยังไม่อยู่ในกำหนดการ (ห้ามแต่งชื่อใหม่ · หมดคลัง → "(ต่อยอด)") ช่วงละ ≤ 90 นาที
 *           + อาหารกลางวัน (ถ้าวันนั้นยังไม่มีและช่วงคร่อมเที่ยง) + อาหารว่างบ่าย (ถ้ายังไม่มี) → นับมื้อ/งบใหม่ */
const DAY_TAIL = /เดินทางกลับ|ปิดค่าย|พิธีปิด|มอบเกียรติบัตร|มอบของรางวัล|ถอดบทเรียน|สรุป|AAR|After Action|Conclusion|Closing|Wrap.?up|Farewell|Come back|Back to school|Go home|Departure|เป็นต้นไป|พักผ่อน|Sweet dream|ฝันดี|Next Step/i;
const DAY_RETURN = /เดินทางกลับ|Come back|Back to school|Go home|Departure|เป็นต้นไป|พักผ่อน|Sweet dream|ฝันดี/i;
const shiftHM2 = (t: string, d: number) => t.replace(/(\d{1,2})[.:](\d{2})/g, (_m, h, mi) => fmt(+h * 60 + +mi + d));
const rowStart = (r: Row): number => { const t = tmins(r.time); return t.length ? t[0] : -1; };
const rowEnd = (r: Row): number => { const t = tmins(r.time); return t.length ? t[t.length - 1] : -1; };
const rowDur = (r: Row): number => { const t = tmins(r.time); return t.length > 1 ? Math.max(0, t[t.length - 1] - t[0]) : 0; };
// เวลาเลิกของวัน = เวลาออกเดินทางกลับ/เข้าพัก (แถวสุดท้ายเป็นการกลับ/พักผ่อน) ไม่งั้นเวลาจบของแถวสุดท้าย
export const dayEndMin = (d: Day): number => { let i = d.items.length - 1; while (i > 0 && rowStart(d.items[i]) < 0) i--; const r = d.items[i]; if (!r) return -1; return DAY_RETURN.test(r.title) ? rowStart(r) : rowEnd(r); };
export const dayEndOf = (d: Day): string => { const e = dayEndMin(d); return e >= 0 ? fmt(e) : ''; };
export const parseHM = (s?: string): number | null => { const m = String(s || '').match(/(\d{1,2})[.:](\d{2})/); return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 60 + +m[2] : null; };
// กิจกรรมที่ใช้เติมช่วงที่ขยาย: กิจกรรมหลักของหลักสูตรวันนั้น (ไม่รวมภาคค่ำ/ปาร์ตี้) ที่ชื่อยังไม่อยู่ในกำหนดการ
const extPoolAll = (code: string): Activity[] => code ? addonActivities(code).filter(a => a.kind === 'core' && !/ปาร์ตี้|party|ธีม|การแสดง|night|ภาคค่ำ/i.test(a.title)) : [];
export function extendOptions(c: Camp, plan: Plan, dayIdx: number): Activity[] {
  const used = new Set(plan.days.flatMap(d => d.items.map(r => actKey(r.title))));
  return extPoolAll(dayCourseOf(c, dayIdx) || c.courseCode || '').filter(a => !used.has(actKey(addonName(a.title))));
}
function applyExtends(c: Camp, plan: Plan): Plan {
  const exts = (c.dayExtends || []).filter(x => x && x.day >= 1 && x.day <= plan.days.length && parseHM(x.end) !== null);
  if (!exts.length) return plan;
  const days: Day[] = plan.days.map(d => ({ ...d, items: d.items.map(r => ({ ...r })) }));
  const warn: string[] = [...(plan.extWarn || [])];
  for (const x of exts) {
    const d = days[x.day - 1]; const items = d.items; if (!items.length) continue;
    const target = parseHM(x.end)!; const L = items[items.length - 1]; const isRet = DAY_RETURN.test(L.title);
    const cur = dayEndMin(d);
    if (cur < 0) { warn.push(`วันที่ ${x.day}: อ่านเวลาเลิกเดิมไม่ได้ — ขยายเวลาไม่ได้ (แก้เวลาแถวสุดท้ายก่อน)`); continue; }
    if (target - cur < 15) { warn.push(`วันที่ ${x.day}: เวลาเลิกที่ตั้ง ${fmt(target)} น. ไม่เกินเวลาเดิม ${fmt(cur)} น. — ไม่ได้เพิ่มช่วง`); continue; }
    // ท้ายวัน = แถวท้ายที่ติดกัน (ปิด/สรุป/กลับ/พัก + มื้ออาหารที่คั่นอยู่)
    let ti = items.length;
    while (ti > 0 && (DAY_TAIL.test(items[ti - 1].title) || mealKind(items[ti - 1].title, items[ti - 1].time))) ti--;
    while (ti < items.length - 1 && mealKind(items[ti].title, items[ti].time)) ti++;            // ไม่เริ่มท้ายวันด้วยมื้ออาหาร
    if (ti >= items.length) ti = items.length - 1;
    const tail = items.slice(ti);
    const S = Math.max(0, rowStart(tail[0]) >= 0 ? rowStart(tail[0]) : cur);
    const meals = tail.filter(r => mealKind(r.title, r.time) && r !== L);
    const movable = tail.filter(r => !meals.includes(r) && !(isRet && r === L));
    // วางแถวปิด/สรุปย้อนจากเวลาเลิก (คงความยาวเดิม) → แถวกลับ/พัก = เวลาเลิก
    let endC = target; const placed: Row[] = [];
    const suf0 = items.some(r => /น\./.test(r.time)) ? ' น.' : '';
    for (const r of [...movable].reverse()) { const du = rowDur(r); placed.unshift({ ...r, time: du ? `${fmt(endC - du)} – ${fmt(endC)}${suf0}` : `${fmt(endC)}${suf0}` }); endC -= du; }
    const W = endC;
    const fixed = meals.map(r => ({ r, st: rowStart(r), du: rowDur(r) || 60 })).sort((a, b) => a.st - b.st);
    let hasL = items.some(r => mealKind(r.title, r.time) === 'l'), hasS = items.some(r => mealKind(r.title, r.time) === 's' && rowStart(r) >= 13 * 60);
    const code = dayCourseOf(c, x.day - 1) || c.courseCode || '';
    const pool = x.ids && x.ids.length ? x.ids.map(id => LIB.find(a => a.id === mergedId(id))).filter(Boolean) as Activity[] : extendOptions(c, { ...plan, days }, x.day - 1);
    const fb = extPoolAll(code); let pi = 0;
    const nm = (a: Activity) => { const n = tidyTitle(a.title).replace(/\s*[-–]?\s*(Part|EP)\.?\s*\d+\s*$/i, '').replace(/\.\s*$/, '').trim(); const b = n.replace(/^กิจกรรม\s*/, ''); if (/[“”"]/.test(b)) return `กิจกรรม ${b.replace(/\(\s+/g, '(').replace(/\s+\)/g, ')')}`; const pm = b.match(/^(.*?)\s*(\([^()]*\))\s*$/); return pm && pm[1] ? `กิจกรรม “${pm[1]}” ${pm[2]}` : `กิจกรรม “${b}”`; };
    const nextAct = (): string => {
      if (pi < pool.length) return nm(pool[pi++]);
      const f = fb.length ? fb[(pi++ - pool.length) % fb.length] : null;
      return f ? `${nm(f)} (ต่อยอด)` : 'กิจกรรมฐานการเรียนรู้ (ต่อยอด)';
    };
    // ใช้รูปแบบเดียวกับวันนั้น: เวลามี/ไม่มี "น." · แม่แบบภาษาอังกฤษ → ชื่อมื้อภาษาอังกฤษ
    const suf = items.some(r => /น\.?\s*$|น\.\s/.test(r.time)) ? ' น.' : '';
    const en = items.filter(r => /[ก-๙]/.test(r.title)).length * 2 < items.length;
    const LUNCH = en ? 'Have lunch' : 'รับประทานอาหารกลางวัน', SNACK = en ? 'Take a Break' : 'รับประทานอาหารว่าง';
    const add: Row[] = []; let t = S, guard = 0;
    const push = (a: number, b: number, title: string, base?: Row) => add.push(base ? { ...base, time: `${fmt(a)} – ${fmt(b)}${suf}` } : { time: `${fmt(a)} – ${fmt(b)}${suf}`, title, ext: true });
    while (guard++ < 60) {
      const f = fixed[0];
      if (f && f.st <= t + 5) { const a = Math.max(t, f.st); push(a, a + f.du, '', f.r); t = a + f.du; fixed.shift(); continue; }
      if (W - t < 15) break;
      if (!hasL && t >= 705 && t <= 780 && W - t >= 60) { push(t, t + 60, LUNCH); t += 60; hasL = true; continue; }
      if (hasL && !hasS && t >= 840 && t <= 930 && W - t >= 45) { push(t, t + 15, SNACK); t += 15; hasS = true; continue; }
      let lim = W; if (f && f.st < lim) lim = f.st;
      let len = Math.min(90, lim - t);
      if (!hasL && t < 720 && t + len > 720 && 720 - t >= 30 && W - 720 >= 60) len = 720 - t;
      if (hasL && !hasS && t < 870 && t + len > 870 && 870 - t >= 45 && W - 870 >= 45) len = 870 - t;
      if (lim - (t + len) > 0 && lim - (t + len) < 30) len = lim - t;
      if (len < 15) { t = lim; continue; }
      push(t, t + len, nextAct()); t += len;
    }
    for (const f of fixed) add.push(f.r);                          // มื้อที่เหลือ (อยู่หลังช่วงที่ขยาย) คงไว้
    if (t > W + 5) warn.push(`วันที่ ${x.day}: มื้ออาหารเดิมทำให้ช่วงเกินเวลาเลิก — ตรวจเวลาแถวท้ายวัน`);
    const ret = isRet ? [{ ...L, time: shiftHM2(L.time, target - cur) }] : [];
    d.items = [...items.slice(0, ti), ...add, ...placed, ...ret];
  }
  const meals = renumberMeals(days);
  return { ...plan, days, meals, extWarn: warn };
}
/* ===================== ธีมปาร์ตี้ + แก้ไขแถวกำหนดการเอง =====================
 * แถวปาร์ตี้/การแสดงภาคค่ำ (เริ่ม ≥ 17.00 น.) ติดธง party · camp.partyTheme → เปลี่ยนชื่อธีมทุกแถวปาร์ตี้ (คงวงเล็บทักษะท้ายเดิม)
 * camp.rowEdits = แก้ชื่อ/เวลา/ลบ ทีละแถว (อ้างวัน + ชื่อแถวเดิม → ถ้ากำหนดการเปลี่ยนจนหาแถวเดิมไม่เจอ = เตือนในหน้าตรวจ ไม่เดา)
 * ทำเป็นขั้นสุดท้ายของ buildSchedule → หน้าปก (กิจกรรมเชิงบูรณาการ) อ่านจากกำหนดการที่แก้แล้วเสมอ */
export const PARTY_THEMES = ['Netflix Lovers', 'The Talent Show', 'Under The Sea', 'Chinatown Party', 'Bohemian', 'The Mask', 'Spy Night Party', 'Dress As Your Initial', 'The Arcane Magic', 'Sports Fest', 'Networking Night'];
const PARTY_ROW = /ปาร์ตี้|party|การแสดง|talent show|ธีม|netflix|night show/i;
export const isPartyRow = (r: Row): boolean => { const t = tmins(r.time)[0]; return t !== undefined && t >= 17 * 60 && PARTY_ROW.test(r.title) && !/อาหาร|Dinner|พักผ่อน|sweet dream|เดินทาง/i.test(r.title) && !r.addon; };
export const partyTitle = (orig: string, theme: string): string => { const paren = (orig.match(/(\([^()]*\))\s*$/) || [])[1]; const t = theme.trim(); const inner = /^[“"].*[”"]$/.test(t) ? t.slice(1, -1).trim() : t; return `กิจกรรมปาร์ตี้ธีม “${inner}”${paren ? ' ' + paren : ''}`; };
function applyEdits(c: Camp, plan: Plan): Plan {
  const theme = String(c.partyTheme || '').trim(); const edits = (c.rowEdits || []).filter(e => e && e.from && e.day);
  const days: Day[] = plan.days.map(d => ({ ...d, items: d.items.map(r => {
    if (!isPartyRow(r)) return r;
    return theme ? { ...r, party: true, orig: r.title, title: partyTitle(r.title, theme) } : { ...r, party: true };
  }) }));
  let missed = 0;
  for (const e of edits) {
    const d = days.find(x => x.day === e.day); const i = d ? d.items.findIndex(r => (r.orig ?? r.title) === e.from && !(r as any)._e) : -1;
    if (!d || i < 0) { missed++; continue; }
    const r = d.items[i];
    if (e.to === '' && d.items.length > 1) { d.items.splice(i, 1); continue; }      // ลบแถว (ไม่ลบแถวสุดท้ายของวัน)
    const sub = Array.isArray(e.sub) ? e.sub.map(x => String(x ?? '').trim()).filter(Boolean) : r.sub;
    d.items[i] = { ...r, orig: r.orig ?? r.title, title: e.to ? e.to.trim() : r.title, time: e.time ? e.time.trim() : r.time, sub: sub && sub.length ? sub : undefined, _e: true } as Row;
  }
  for (const d of days) d.items = d.items.map(r => { if ((r as any)._e) { const { _e, ...x } = r as any; return x; } return r; });
  // ช่วงเวลาที่เพิ่มเอง → แทรกตามเวลาเริ่ม (เวลาอ่านไม่ได้ = ต่อท้ายวัน)
  (c.rowAdds || []).forEach((a, idx) => {
    if (!a || !String(a.title || '').trim()) return;
    const d = days.find(x => x.day === a.day); if (!d) { missed++; return; }
    const st = tmins(a.time || '')[0];
    const sub = Array.isArray(a.sub) ? a.sub.map(x => String(x ?? '').trim()).filter(Boolean) : [];
    const row: Row = { time: String(a.time || '').trim(), title: String(a.title).trim(), ...(sub.length ? { sub } : {}), added: idx };
    let at = d.items.length;
    // แทรกก่อนแถวที่เริ่มหลังกว่า · แถวพักผ่อน/เดินทางกลับที่เริ่มเวลาเดียวกันหรือก่อนจบช่วงใหม่ → อยู่หลังช่วงใหม่ และเลื่อนเวลาเริ่มไปเท่าเวลาจบ
    if (st !== undefined) { const j = d.items.findIndex(r => { const t0 = tmins(r.time)[0]; return t0 !== undefined && (t0 > st || (t0 === st && DAY_RETURN.test(r.title))); }); if (j >= 0) at = j; }
    d.items.splice(at, 0, row);
    const en = tmins(row.time); const nx = d.items[at + 1];
    if (en.length > 1 && nx && DAY_RETURN.test(nx.title)) { const n0 = tmins(nx.time)[0]; if (n0 !== undefined && n0 < en[en.length - 1]) d.items[at + 1] = { ...nx, time: shiftHM2(nx.time, en[en.length - 1] - n0) }; }
  });
  const touched = edits.length || (c.rowAdds || []).length;
  const meals = touched ? renumberMeals(days.map(d => (d.items = d.items.map(r => ({ ...r })), d))) : plan.meals;
  return { ...plan, days, meals, editMissed: missed };
}
function basePlan(c: Camp): Plan {
  const p = templateFor(c);
  if (p && p.exact) return planFromTemplate(c, p);
  const plan = buildEngineSchedule(c); if (p) plan.tpl = tplInfo(p);
  return plan;
}
/* ===================== ธีมรายวัน (Mix หลักสูตร) =====================
 * เช่น วันที่ 1 ภาษาอังกฤษ · วันที่ 2 วิทยาศาสตร์ทางทะเล — วันที่เลือกหลักสูตรอื่น ใช้กำหนดการ "วันเดียวกัน" ของหลักสูตรนั้น
 * (แม่แบบจริงของทีมระยะเวลาเดียวกัน ถ้ามี · ไม่มีใช้ engine) → โครงวันตรงกันเสมอ (ออกเดินทาง/เช็คอิน/วันกลับ) เพราะใช้ข้อมูลค่ายชุดเดียวกัน
 * แล้วนับ/เรียงเลขมื้ออาหารใหม่ทั้งค่าย · แถวผูกพื้นที่ของวันที่ใช้ → เตือนตามเดิม */
export const COURSE_LABEL: Record<string, string> = {
  'PL STM 0101': 'STEM', 'PL LEA 0102': 'ผู้นำ', 'PL SEA 0103': 'วิทยาศาสตร์ทางทะเล', 'PL ENG 0104': 'ภาษาอังกฤษ', 'PL PRE 0105': 'Pre-genius',
  'PL ENV 0106': 'สิ่งแวดล้อม', 'PL MAT 0107': 'คณิตศาสตร์', 'PL AST 0108': 'ดาราศาสตร์', 'PL CHI 0109': 'ภาษาจีน', 'PL FOR 0110': 'นิติวิทยาศาสตร์',
  'PL COD 0111': 'หุ่นยนต์และโค้ดดิ้ง', 'PL GEO 0112': 'ธรณีวิทยา', 'PL ITD 0113': 'เทคโนโลยีสารสนเทศ', 'PL TI 0116': 'โดรน'
};
export const courseLabel = (code?: string) => (code && COURSE_LABEL[code]) || (courseById(code)?.name.replace(/\s*\([^)]*\)\s*$/, '').replace(/^(หลักสูตร)?ค่าย(บูรณาการ)?(วิชาการ)?/, '').trim()) || String(code || '');
const nDaysOf = (c: Camp) => c.durationMode === 'half' ? 1 : Math.max(1, c.days || 1);
// หลักสูตรของแต่ละวัน (ค่าว่าง = หลักสูตรหลัก) — ตัดค่าที่ไม่ใช่รหัสหลักสูตรจริงทิ้ง
export const dayCourseOf = (c: Camp, i: number): string => { const x = (c.dayCourses || [])[i]; return x && courseById(x) ? x : (c.courseCode || ''); };
export const isMixed = (c: Camp) => !!c.courseCode && Array.from({ length: nDaysOf(c) }, (_, i) => dayCourseOf(c, i)).some(x => x !== c.courseCode);
// ค่ายเสมือนของหลักสูตรอื่น (ข้อมูลค่ายชุดเดียวกัน — โรงเรียน/วันที่/ที่พัก/ระยะเวลา) ใช้สร้างกำหนดการ/ภาพของวันนั้น
const campFor = (c: Camp, code: string): Camp => { const co = courseById(code)!; return { ...c, courseCode: code, subject: co.family as Subject, templateId: undefined, activityIds: defaultCourseActs(code), coreSlotIds: [], dayCourses: undefined, addons: undefined }; };
function renumberMeals(days: Day[]): Plan['meals'] {
  const meals = { b: 0, l: 0, d: 0, s: 0 }; let main = 0;
  // มีวันใดใส่เลขมื้อ → ใส่เลขทุกมื้อทั้งค่าย (วันที่มาจากหลักสูตรอื่นรูปแบบต้องเหมือนกัน)
  const anyNum = days.some(d => d.items.some(r => mealKind(r.title, r.time) && /\(\d+\)/.test(r.title)));
  for (const d of days) for (const r of d.items) {
    const mk = mealKind(r.title, r.time), had = anyNum;
    if (mk && mk !== 's') { meals[mk]++; main++; if (had) r.title = renumMeal(r.title, main); }
    else if (mk === 's') { meals.s++; if (had) r.title = renumMeal(r.title, meals.s); }
  }
  return meals;
}
function applyDayMix(c: Camp, plan: Plan): Plan {
  if (!isMixed(c)) return plan;
  const cache = new Map<string, Plan>();
  const days: Day[] = plan.days.map(d => ({ ...d, items: d.items.map(r => ({ ...r })) }));
  const mix: DayMix[] = []; const used = new Set(plan.usedActivityIds); let hasTrip = plan.hasTrip;
  const replaced = new Set<number>(); const extraLoc: string[] = [];
  days.forEach((d, i) => {
    const code = dayCourseOf(c, i);
    if (code === c.courseCode) { mix.push({ day: i + 1, code, label: courseLabel(code), source: plan.tpl && plan.tpl.exact ? plan.tpl.source : 'คลังกิจกรรม' }); return; }
    let other = cache.get(code); if (!other) { other = basePlan(campFor(c, code)); cache.set(code, other); }
    const src = other.days[i]; if (!src || !src.items.length) { mix.push({ day: i + 1, code: c.courseCode!, label: courseLabel(c.courseCode), source: 'หลักสูตรหลัก (หลักสูตรที่เลือกไม่มีวันนี้)' }); return; }
    days[i] = { day: i + 1, items: src.items.map(r => { const { slot, ...rest } = r; return { ...rest }; }) };
    replaced.add(i + 1); other.usedActivityIds.forEach(x => used.add(x)); hasTrip = hasTrip || other.hasTrip;
    if (other.tpl) extraLoc.push(...other.tpl.locRows.filter(x => x.startsWith(`วันที่ ${i + 1} `)));
    mix.push({ day: i + 1, code, label: courseLabel(code), source: other.tpl && other.tpl.exact ? other.tpl.source : 'คลังกิจกรรม' });
  });
  // เวลาให้รูปแบบเดียวกันทั้งค่าย (แม่แบบอังกฤษไม่มี "น.")
  for (const d of days) for (const r of d.items) if (/\d$/.test(r.time.trim())) r.time = r.time.trim() + ' น.';
  const meals = renumberMeals(days);
  const tpl = plan.tpl ? { ...plan.tpl, locRows: [...plan.tpl.locRows.filter(x => !replaced.has(+(x.match(/^วันที่ (\d+) /) || [])[1])), ...extraLoc] } : plan.tpl;
  return { ...plan, days, meals, usedActivityIds: [...used], hasTrip, tpl, mix };
}
/* ===================== กิจกรรมเสริม (Add-on) =====================
 * ค่ายหลัก + กิจกรรมจากหลักสูตรอังกฤษ/จีน/คณิต แทรกลงกำหนดการจริง (ใช้กิจกรรมในคลังของหลักสูตรนั้นเท่านั้น — ไม่แต่งชื่อใหม่)
 * วิธีแทรกต่อ 1 ช่วง (ค่าเริ่ม 60 นาที):
 *   1) แบ่งช่วงกิจกรรมหลักที่ยาว ≥ ช่วงเสริม+60 นาที (ก่อน 18.00) — ท้ายช่วงเป็นกิจกรรมเสริม เวลาเลิกวันนั้นไม่เปลี่ยน
 *   2) ไม่มีช่วงให้แบ่ง → แทรกก่อน "สรุป/ถอดบทเรียน" (หรือก่อนเดินทางกลับ/ท้ายวัน) แล้วเลื่อนรายการถัดไป
 *      จนเจอช่วงพักผ่อน/เช็คอินที่ยาวพอดูดเวลาไว้ได้ · ถ้าไม่มี วันนั้นเลิกช้าลง → เตือนในหน้าตรวจ */
export const ADDON_COURSES: { code: string; label: string }[] = [
  { code: 'PL ENG 0104', label: 'ภาษาอังกฤษ' }, { code: 'PL CHI 0109', label: 'ภาษาจีน' }, { code: 'PL MAT 0107', label: 'คณิตศาสตร์' }
];
export const addonLabel = (code: string) => (ADDON_COURSES.find(a => a.code === code) || { label: courseLabel(code) }).label;
const ADDON_SKIP = /ระดมสมอง|Creative Learning Station|Morning|นันทนาการ|กลุ่มสัมพันธ์|ถอดบทเรียน|AAR/i;
const addonName = (t: string) => tidyTitle(t).replace(/\s*[-–]?\s*(Part|EP)\.?\s*\d+\s*$/i, '').replace(/^กิจกรรม\s*/, '').replace(/^[“"]\s*|\s*[”"]$/g, '').replace(/\.\s*$/, '').trim();
// กิจกรรมที่ใช้เป็น Add-on ได้ของหลักสูตร (กิจกรรมหลัก/ภาคค่ำ ไม่รวมกระบวนการกลาง) — รวม Part.1/Part.2 เป็นรายการเดียว
export function addonActivities(code: string): Activity[] {
  const seen = new Set<string>(); const out: Activity[] = [];
  for (const a of LIB) {
    if (a.courseCode !== code || !(a.kind === 'core' || a.kind === 'night') || ADDON_SKIP.test(a.title)) continue;
    const k = addonName(a.title).toLowerCase(); if (!k || seen.has(k)) continue;
    seen.add(k); out.push(a);
  }
  return out;
}
export const addonRowTitle = (code: string, a: Activity) => `กิจกรรมเสริม${addonLabel(code)} “${addonName(a.title)}”`;
const activeAddons = (c: Camp): AddonSel[] => (c.addons || []).filter(x => x && x.code && x.code !== c.courseCode && addonActivities(x.code).length);
const NO_SPLIT = /อาหาร|เดินทาง|เช็ค|ลงทะเบียน|พิธี|พักผ่อน|ทำธุระ|สรุป|ถอดบทเรียน|AAR|After Action|ปาร์ตี้|party|นันทนาการ|ละลายพฤติกรรม|กิจกรรมเสริม|ว่าง|5 STEPs|Break|Lunch|Dinner|Breakfast|Registration|Ceremony|Conclusion|Check|Sweet dream|Talent Show|Warm up|Wake up|Recreation|Ice Breaking/i;
const ABSORB = /พักผ่อน|อัธยาศัย|เช็คอิน|ทำธุระ|เตรียมการแสดง|Take a Break|Free time/i;
const shiftTimes = (t: string, d: number) => t.replace(/(\d{1,2})[.:](\d{2})/g, (_m, h, mm) => fmt(+h * 60 + +mm + d));
function insertAddonRow(items: Row[], row: Omit<Row, 'time'>, minutes: number): { items: Row[]; late: number } {
  // 1) แบ่งช่วงยาว (เลือกช่วงที่ยาวที่สุด)
  let best = -1, bestLen = 0;
  items.forEach((r, i) => { const t = tmins(r.time); if (t.length < 2 || NO_SPLIT.test(r.title) || r.addon) return; const len = t[1] - t[0]; if (t[0] < 18 * 60 && len >= minutes + 60 && len > bestLen) { best = i; bestLen = len; } });
  if (best >= 0) {
    const [a, b] = tmins(items[best].time); const cut = b - minutes;
    const out = [...items]; out.splice(best, 1, { ...items[best], time: rng(a, cut) }, { ...row, time: rng(cut, b) });
    return { items: out, late: 0 };
  }
  // 2) แทรกก่อนสรุป / เดินทางกลับ / ท้ายวัน แล้วเลื่อนเวลา
  let at = items.findIndex(r => /สรุป|ถอดบทเรียน|AAR|After Action|Conclusion/i.test(r.title));
  const tail = (r: Row) => /เดินทางกลับ|เป็นต้นไป|Sweet dream|Go back|Return/i.test(r.title + r.time) || tmins(r.time).length === 1;
  if (at < 0 && items.length && tail(items[items.length - 1])) { at = items.length - 1; while (at > 0 && tail(items[at - 1])) at--; }
  if (at < 0) at = items.length;
  const prevEnd = at > 0 ? (tmins(items[at - 1].time).slice(-1)[0] ?? 9 * 60) : 9 * 60;
  const start = at < items.length ? (tmins(items[at].time)[0] ?? prevEnd) : prevEnd;
  const out: Row[] = items.slice(0, at); out.push({ ...row, time: rng(start, start + minutes) });
  let shift = minutes; let late = 0;
  for (let i = at; i < items.length; i++) {
    const r = items[i]; const t = tmins(r.time);
    if (!shift) { out.push(r); continue; }
    if (ABSORB.test(r.title) && t.length >= 2 && t[1] - t[0] - shift >= 30) { out.push({ ...r, time: rng(t[0] + shift, t[1]) }); shift = 0; continue; }
    out.push({ ...r, time: shiftTimes(r.time, shift) });
  }
  late = shift;
  return { items: out, late };
}
function applyAddons(c: Camp, plan: Plan): Plan {
  const sels = activeAddons(c); if (!sels.length) return plan;
  const nDays = plan.days.length || 1;
  const days = plan.days.map(d => ({ ...d, items: [...d.items] }));
  const warn: string[] = []; const addons: AddonPlan[] = [];
  const late: number[] = days.map(() => 0);
  const count = days.map(() => 0);
  // ค่าเริ่ม: พักค้าง = 1 ช่วง/คืน (วันกลับมักสั้น) · ไป-กลับ = 1 ช่วง/วัน · ครึ่งวัน = 1 ช่วง
  const autoN = c.durationMode === 'overnight' ? Math.max(1, c.nights) : c.durationMode === 'half' ? 1 : nDays;
  for (const sel of sels) {
    const pool = addonActivities(sel.code);
    const chosen = (sel.ids && sel.ids.length ? sel.ids.map(id => pool.find(a => a.id === mergedId(id))).filter(Boolean) as Activity[] : pool.slice(0, autoN));
    const minutes = [45, 60, 90, 120].includes(Number(sel.minutes)) ? Number(sel.minutes) : 60;
    const titles: string[] = [];
    for (const a of chosen) {
      const title = addonRowTitle(sel.code, a);
      // เลือกวันที่แทรกแล้ว "ไม่ทำให้เลิกช้า" ก่อน → วันที่มีกิจกรรมเสริมน้อยกว่า → วันแรก ๆ ; ถ้าทุกวันต้องเลื่อน เลือกวันที่เลื่อนน้อยสุด
      const tries = days.map((d, i) => ({ i, r: insertAddonRow(d.items, { title, addon: sel.code }, minutes) }))
        .sort((x, y) => (x.r.late - y.r.late) || (count[x.i] - count[y.i]) || (x.i - y.i));
      const best = tries[0];
      days[best.i].items = best.r.items; late[best.i] += best.r.late; count[best.i]++; titles.push(title);
    }
    addons.push({ code: sel.code, label: addonLabel(sel.code), titles, price: Math.max(0, Number(sel.price) || 0) });
  }
  late.forEach((m, i) => { if (m > 0) warn.push(`วันที่ ${i + 1} เลิกช้าลง ${m} นาทีเพราะแทรกกิจกรรมเสริม — ตรวจเวลาเดินทาง/อาหารในกำหนดการ`); });
  return { ...plan, days, addons, addonWarn: warn };
}
// ราคารวมกิจกรรมเสริม: ราคาที่กรอกในขั้น "ราคา" = ราคาค่ายหลัก · เอกสารแสดงราคารวม Add-on แล้ว (ทำครั้งเดียว ไม่บวกซ้ำ)
const PRICED = new WeakSet<object>();
export const addonPriceSum = (c: Camp) => activeAddons(c).reduce((s, a) => s + Math.max(0, Number(a.price) || 0), 0);
export function withAddonPrice(c: Camp): Camp {
  if (PRICED.has(c)) return c;
  const add = addonPriceSum(c); if (!add) return c;
  const out = { ...c, normalPrice: (c.normalPrice || 0) + add, specialPrice: (c.specialPrice || 0) + add };
  PRICED.add(out); return out;
}
export const addonPriceNote = (c: Camp): string => {
  const xs = activeAddons(c).filter(a => (Number(a.price) || 0) > 0);
  return xs.length ? `(รวมกิจกรรมเสริม ${xs.map(a => `${addonLabel(a.code)} ${money(Number(a.price))} บาท`).join(' · ')} ต่อท่าน)` : '';
};
function buildEngineSchedule(c: Camp): Plan {
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
    // หลักสูตรมีกิจกรรมชนิดนี้หลายรายการ (เช่น ภาคค่ำอังกฤษ Mission Game / The Talent Show) → หมุนตามลำดับ ไม่ซ้ำคืนเดิมทุกคืน
    const owns = (k === 'night' || k === 'recreation') && c.courseCode ? of(k).filter(a => a.courseCode === c.courseCode) : [];
    if (owns.length > 1) { const i = useN[k] || 0; useN[k] = i + 1; return owns[i % owns.length]; }
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
    // Day Camp: รวมกิจกรรมที่แยก Part.1/Part.2/EP ในคลังให้เหลือชื่อฐานเดียว แล้วระบบแบ่ง Part 1 / Part 2 เองตามช่วงเวลา (ไม่ซ้ำข้ามวัน)
    const stripPart = (t: string) => t.replace(/\s*[-–]?\s*(Part|EP)\.?\s*\d+\s*$/i, '').trim();
    const seenBase = new Set<string>();
    // กฎเหล็กข้อ 3: Day Camp ห้ามมีกิจกรรมกลางคืน — ตัดกิจกรรมแนว Night/Party ที่คลังจัดเป็น core ออก
    const coresD = cores.filter(a => !/night|party|ปาร์ตี้|ภาคค่ำ/i.test(a.title)).filter(a => { const k = stripPart(a.title); if (seenBase.has(k)) return false; seenBase.add(k); return true; });
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
        else if (coresD.length) { const a = coresD[coreIdx % coresD.length]; const rep = Math.floor(coreIdx / coresD.length) > 0; coreIdx++; name = rep ? `${stripPart(a.title)}\u00A0(ต่อ\u2060ยอด)` : a.title; act(a); if (!rep) name = stripPart(a.title); }
        else name = 'กิจกรรมฐานการเรียนรู้เชิงบูรณาการ';
        if (isSteam) put(`กิจกรรม ${mission}${label ? ' ' + label : ''}`, dur, [name]);
        else put(name, dur);                                     // หลักสูตรอื่น: ชื่อกิจกรรมของหลักสูตรเป็นหัวข้อช่วงโดยตรง
        items[items.length - 1].slot = slotIdx;
      };
      if (!first) {
        // ===== วันที่ 2 เป็นต้นไป — แพตเทิร์นจากเอกสารจริง (STEM Camp ร.ร.ศรีสองรักษ์วิทยา) =====
        // 09.00 สันทนาการ → กิจกรรม A Part 1 → ว่าง → A Part 2 → กลางวัน → กิจกรรม B Part 1 → ว่าง → B Part 2 → สรุป 16.00–16.30 → (วันสุดท้าย) เดินทางกลับ
        cur = 9 * 60;
        { const a = pick1('recreation'); put(a.title, 30, act(a)); }       // 09.00–09.30
        const twoPart = (d1: number, gapTitle: string | null, gap: number, d2: number) => {
          coreRow('', d1); const row = items[items.length - 1];
          const raw = row.sub && row.sub.length ? row.sub[0] : row.title; const TAG = '\u00A0(ต่อ\u2060ยอด)';
          const ext = raw.includes(TAG); const nm = stripPart(raw.replace(TAG, ''));
          const p1 = `${nm} - Part 1${ext ? TAG : ''}`, p2 = `${nm} - Part 2${ext ? TAG : ''}`;
          if (row.sub && row.sub.length) row.sub = [p1]; else row.title = p1;
          if (gapTitle) put(gapTitle, gap);
          const slot = row.slot;
          if (row.sub && row.sub.length) put(row.title, d2, [p2]); else put(p2, d2);
          items[items.length - 1].slot = slot;
        };
        meals.s++; twoPart(60, `รับประทานอาหารว่าง (${meals.s})`, 15, 75);   // 09.30–10.30 · 10.30–10.45 · 10.45–12.00
        meals.l++; put(`รับประทานอาหารกลางวัน (${++mealNo})`, 60);          // 12.00–13.00
        meals.s++; twoPart(90, `รับประทานอาหารว่าง (${meals.s})`, 30, 60);   // 13.00–14.30 · 14.30–15.00 · 15.00–16.00
        const sumWhat = isSteam ? ` ${mission}` : `ด้าน${topic}`;
        put(last ? `สรุปการเรียนรู้${sumWhat} และถอดบทเรียน (AAR : After Action Review)` : `สรุปการเรียนรู้${sumWhat} ประจำวัน`, 30); // 16.00–16.30
        if (last) items.push({ time: `${fmt(cur)} น. เป็นต้นไป`, title: 'เดินทางกลับโดยสวัสดิภาพ' });
        days.push({ day: d, items });
        continue;
      }
      // วันแรก (ทั้ง 1 วัน และวันแรกของหลายวัน): แพตเทิร์นมาตรฐาน 08.30–16.00 เดิม
      if (first) put('ลงทะเบียน / พิธีเปิด', 30);
      { const a = pick1('opening'); put(a.title, 60, act(a)); }  // 09.00–10.00
      put(introTitle, 20);                                       // 10.00–10.20
      meals.s++; put(`รับประทานอาหารว่าง (${meals.s})`, 15);      // 10.20–10.35
      coreRow('#EP.1', 85);                                      // 10.35–12.00
      meals.l++; put(`รับประทานอาหารกลางวัน (${++mealNo})`, 60);  // 12.00–13.00
      coreRow('#EP.2', 120);                                     // 13.00–15.00
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
export const actBase = (t: string) => tidyTitle(t).replace(/\s*\(ต่อยอด\)\s*$/, '').replace(/\s*[-–]?\s*(EP|Part)\.?\s*\d+\s*$/i, '').replace(/\s*#EP\.?\s*\d+\s*$/i, '').trim();
export const asKijakam = (t: string) => { const x = actBase(t); if (/^กิจกรรม/.test(x)) return x; return /[“"”]/.test(x) ? `กิจกรรม${x}` : `กิจกรรม “${x}”`; };
const baseName = actBase;
/* ===================== กิจกรรมเชิงบูรณาการ ↔ กำหนดการ =====================
 * กฎ (ผู้ใช้กำหนด 17 พ.ย. 2569): รายการกิจกรรมเชิงบูรณาการบนหน้าปก "ต้องตรงกับสิ่งที่มีในกำหนดการเท่านั้น"
 *   - ไล่ตามลำดับกำหนดการจริง (หลังธีมรายวัน/Add-on/แก้ไขแถว) · ถ้าข้อความเดิมของแม่แบบตรงกับแถวนั้น ใช้ถ้อยคำเดิมของทีม ไม่งั้นใช้ชื่อแถว
 *   - ข้อสรุป/AAR ใส่เมื่อกำหนดการมีแถวสรุป/ถอดบทเรียน/AAR จริงเท่านั้น
 *   - จำนวนข้อไม่เกินเดิม (ปกพอดี 1 หน้า) · เลือกสลับวันให้ทุกวันมีตัวแทน · ทุกข้อขึ้นต้น "กิจกรรม"
 *   - ทีมแก้เองได้ (camp.actsOverride) — ข้อที่ไม่พบในกำหนดการ → เตือนในหน้าตรวจ */
const ACT_NOT = /อาหาร|เดินทาง|เช็ค|ลงทะเบียน|พิธี|พักผ่อน|ทำธุระ|สัมภาระ|ถ่ายภาพ|มอบ|ปิดค่าย|ว่าง|สรุป|ถอดบทเรียน|AAR|After Action|Break|Lunch|Dinner|Breakfast|Registration|Ceremony|Conclusion|Check|Sweet dream|เป็นต้นไป/i;
const SUMMARY_ROW = /สรุป|ถอดบทเรียน|AAR|After Action|Conclusion/i;
export const actKey = (s: string): string => String(s || '').toLowerCase().replace(/^\s*กิจกรรม(?:เสริม\S*|ปาร์ตี้|การแสดง)?\s*(?:ธีม)?/, '').replace(/กิจกรรม/g, '').replace(/\([^)]*\)/g, '').replace(/(?:part|ep)\.?\s*\d+|#\s*(?:ep\.?\s*)?\d+|activity\s*\d+\s*:/gi, '').replace(/[^a-z0-9฀-๿]/g, '');
// ชื่อกิจกรรมจากแถวกำหนดการ → "กิจกรรม “ชื่อ” (วงเล็บท้าย)"
export const actName = (t: string): string => {
  const x = actBase(t).replace(/^Activity\s*\d+\s*:\s*/i, '').replace(/\s*\.?\s*#\s*(EP\.?\s*)?\d+\s*(?=”|$)/i, '').replace(/\.\s*(?=\()/g, ' ').replace(/\.\s*(?=”|$)/g, '').trim();
  const m = x.match(/^(.*?)\s*(\([^()]*\))?$/);
  return m && m[2] && !/^กิจกรรม/.test(m[1]) ? `${asKijakam(m[1])} ${m[2]}` : asKijakam(x);
};
export interface SchedAct { day: number; time: string; title: string; name: string; key: string; summary?: boolean; orig?: string }
// แถวกิจกรรมในกำหนดการ (ไม่รวมมื้ออาหาร/เดินทาง/พัก/ลงทะเบียน และแถวกิจกรรมเสริม Add-on ที่มีบรรทัดของตัวเองบนปก)
export function scheduleActs(plan: Plan): SchedAct[] {
  const out: SchedAct[] = [];
  for (const d of plan.days) for (const r of d.items) {
    if (r.addon) continue;
    if (SUMMARY_ROW.test(r.title) && !/เดินทาง|อาหาร/.test(r.title)) { out.push({ day: d.day, time: r.time, title: r.title, name: summaryName(r.title), key: actKey(r.title), summary: true }); continue; }
    if (ACT_NOT.test(r.title)) continue;
    const name = actName(r.title), key = actKey(name); if (key.length < 2) continue;
    out.push({ day: d.day, time: r.time, title: r.title, name, key, orig: r.orig });
  }
  return out;
}
const summaryName = (t: string) => { const x = actBase(t).replace(/\.\s*$/, ''); return (/^กิจกรรม/.test(x) ? x : /^[฀-๿]/.test(x) ? `กิจกรรม${x}` : asKijakam(x)).replace(/^กิจกรรมสรุปกิจกรรม/, 'กิจกรรมสรุป'); };
// ข้อความหนึ่งข้อตรงกับแถวกำหนดการไหม (ใช้ทั้งจัดอัตโนมัติและตรวจข้อที่ทีมแก้เอง)
const lineMatchesRow = (line: string, a: SchedAct): boolean => {
  if (/AAR|After Action/i.test(line)) return !!a.summary && /AAR|After Action|ถอดบทเรียน/i.test(a.title);
  if (/ถอดบทเรียน|สรุปการเรียนรู้|Conclusion/i.test(line)) return !!a.summary;
  const q = (line.match(/“([^”]+)”/) || [])[1];
  const k = actKey(q || line), rk = actKey(a.title);
  if (k.length < 3 || !rk) return false;
  return rk.includes(k) || (rk.length >= 6 && k.includes(rk));
};
export function actInSchedule(line: string, plan: Plan): boolean { return scheduleActs(plan).some(a => lineMatchesRow(line, a)); }
export function alignActs(orig: string[], plan: Plan, max: number): string[] {
  const S = scheduleActs(plan);
  const used = new Set<number>();
  const curated = (a: SchedAct) => { const j = orig.findIndex((l, i) => !used.has(i) && lineMatchesRow(l, a)); if (j >= 0) { used.add(j); return orig[j]; } return a.name; };
  const acts = S.filter(a => !a.summary);
  const sum = [...S].reverse().find(a => a.summary && /AAR|After Action|ถอดบทเรียน/i.test(a.title)) || [...S].reverse().find(a => a.summary);
  const n = Math.max(1, max - (sum ? 1 : 0));
  // เลือก n ข้อตามความสำคัญ: กิจกรรมแรกของค่าย (เปิด/ละลายพฤติกรรม) → ปาร์ตี้ภาคค่ำ → ข้อที่ทีมเขียนไว้ในแม่แบบ → กิจกรรมหลัก → อุ่นเครื่อง/นันทนาการ
  //   ไม่ซ้ำชื่อ · ทุกวันมีตัวแทนถ้าทำได้ · แล้วเรียงตามลำดับกำหนดการ
  const WARM = /นันทนาการ|สันทนาการ|Reboot|Warm up|Wake up|Morning|Boost Up|Recreation|ทบทวน/i;
  const partyRow = (a: SchedAct) => plan.days.some(d => d.day === a.day && d.items.some(r => r.party && r.title === a.title));
  const uniq: SchedAct[] = []; const seen = new Set<string>();
  for (const a of acts) { const kk = actKey(a.name); if (!seen.has(kk)) { seen.add(kk); uniq.push(a); } }
  const curatedHit = (a: SchedAct) => orig.some(l => lineMatchesRow(l, a) || (!!a.orig && lineMatchesRow(l, { ...a, title: a.orig })));   // แถวที่ทีมแก้ชื่อ = ยังเป็นข้อเดิมของแม่แบบ
  const score = (a: SchedAct, i: number) => i === 0 ? 0 : partyRow(a) ? 1 : curatedHit(a) ? 2 : WARM.test(a.title) ? 5 : 3;
  const ranked = uniq.map((a, i) => ({ a, s: score(a, i), i })).sort((x, y) => x.s - y.s || x.i - y.i);
  const pickIdx: SchedAct[] = ranked.slice(0, n).map(x => x.a);
  for (const d of Array.from(new Set(uniq.map(a => a.day)))) {          // วันที่ยังไม่มีตัวแทน → แทนข้อความสำคัญต่ำสุด
    if (pickIdx.some(a => a.day === d)) continue;
    const cand = ranked.find(x => x.a.day === d); if (!cand || pickIdx.length < n) { if (cand) pickIdx.push(cand.a); continue; }
    const counts = (day: number) => pickIdx.filter(a => a.day === day).length;
    const sc = (a: SchedAct) => ranked.find(x => x.a === a)!.s;
    const drop = [...pickIdx].filter(a => counts(a.day) > 1 && sc(a) >= 2).sort((x, y) => sc(y) - sc(x) || pickIdx.indexOf(y) - pickIdx.indexOf(x))[0];
    if (drop) pickIdx.splice(pickIdx.indexOf(drop), 1, cand.a);
  }
  const ordered = acts.filter(a => pickIdx.includes(a));
  const out = ordered.map(curated);
  if (sum) out.push(curated(sum));
  return out;
}
function composeBase(c: Camp, plan: Plan, titleExtraLines = 0) {
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
  // กิจกรรมเชิงบูรณาการ — แพตเทิร์นเอกสารจริงทีม (REA: docs/REA_PROGRAM_LAYOUT.md) เดินตามวงจรการเรียนรู้ 5 ขั้น
  //   1 อุ่นเครื่อง/สร้างสัมพันธ์ → 2 ระดมสมองประลองปัญญา → 3 ฐานการเรียนรู้ของหลักสูตร → (ภาคค่ำ: เฉพาะพักค้าง) → 4 ระดมสมอง ถอดบทเรียน → 5 AAR
  //   ทุกข้อขึ้นต้นด้วยคำว่า "กิจกรรม" เสมอ — ห้ามใส่ชื่อกิจกรรมเปล่า ๆ
  const firstOf = (k: Kind) => ordered.find(a => a.kind === k);
  const warm = firstOf('opening') || firstOf('recreation');
  const warmLine = warm ? (/\(/.test(warm.title) ? asKijakam(warm.title) : `${asKijakam(warm.title)} (กระบวนการสันทนาการสร้างสัมพันธ์)`)
    : 'กิจกรรม “Reboot Your Brain” (กระบวนการสันทนาการสร้างสัมพันธ์)';
  const station = ordered.find(a => a.kind === 'core' && /station|mission|quest|challenge|ฐานการเรียนรู้/i.test(a.title));
  const night = c.nights > 0 ? firstOf('night') : undefined;
  const acts: string[] = [
    warmLine,
    'กิจกรรมระดมสมองประลองปัญญา',
    station ? asKijakam(station.title) : 'กิจกรรม “Creative Learning Station”',
    ...(night ? [asKijakam(night.title)] : []),
    'กิจกรรมระดมสมอง ถอดบทเรียน',
    'กิจกรรมทดสอบหลังการเรียนรู้ (After Action Review : AAR)'
  ];
  const dur = c.durationMode === 'half' ? 'ครึ่งวัน' : c.durationMode === 'day' ? `${c.days} วัน` : `${c.days} วัน ${c.nights} คืน`;
  // กิจกรรมเชิงบูรณาการ = ตรงกับกำหนดการเท่านั้น (alignActs) · ทีมแก้เอง → actsOverride
  //   บรรทัดระยะเวลายาวจนขึ้นบรรทัดใหม่ (ธีมรายวัน + Add-on) → ลดรายการ 1 ข้อ ให้ปกยังพอดี 1 หน้า
  const own = (c.actsOverride || []).map(x => String(x ?? '').trim()).filter(Boolean);
  const mixActs = (orig: string[]): string[] => {
    if (own.length) return own;
    // ชื่อค่ายรวมวิชายาวขึ้นจนเพิ่มบรรทัด → ลดรายการเท่าจำนวนบรรทัดที่เพิ่ม ให้ปกยังพอดี 1 หน้า
    return alignActs(orig, plan, Math.max(3, orig.length - titleExtraLines));
  };
  // บูรณาการการเรียน: 5–7 ข้อ (ตัดให้ไม่เกิน 7 เพื่อให้อยู่ในหน้าแรก)
  const extra = (c.courseCode && c.subject === 'steam' && !isSteamProgram(c))
    ? [`บูรณาการแบบสหวิทยาการด้าน${courseShortTh(c)}`, `บูรณาการทักษะวิชาชีพด้าน${courseShortTh(c)}`] : S.extra;
  const integ = ['บูรณาการคุณลักษณะที่พึงประสงค์ในการเรียนรู้ในศตวรรษที่ 21', 'บูรณาการโดยใช้โครงการในทางกิจกรรมค่ายเป็นลักษณะภารกิจในระหว่างกิจกรรม', ...extra,
    'บูรณาการทักษะการเรียนรู้และนวัตกรรม (Learning and Innovation Skills)', 'บูรณาการทักษะการสื่อสาร (Communication Tactic)'].slice(0, 6);
  const m = plan.meals, main = m.b + m.l + m.d;
  const parts = [m.b && `อาหารเช้า ${m.b} มื้อ`, m.l && `อาหารกลางวัน ${m.l} มื้อ`, m.d && `อาหารเย็น ${m.d} มื้อ`].filter(Boolean).join(' ');
  const staff = staffText(c.students);
  const autoBudget = c.durationMode !== 'overnight' ? [
    'ค่าอุปกรณ์การจัดกิจกรรม', `ค่าวิทยากรและทีมงานผู้เชี่ยวชาญ ${staff} ท่าน`, 'ค่าเดินทางวิทยากร', 'ค่าของรางวัล สำหรับผู้เข้าร่วม', 'ค่าประสานงาน'
  ] : [
    c.nights > 0 && `ค่าที่พัก ${c.nights} คืน ${c.venue}`, main > 0 && `ค่าอาหาร ${main} มื้อ (${parts})`, m.s > 0 && `ค่าอาหารว่าง ${m.s} มื้อ`,
    'ค่าห้องประชุมสัมมนารองรับการทำกิจกรรม', `ค่าวิทยากรและทีมงาน จำนวน ${staff} ท่าน`, 'ค่าเดินทางวิทยากร',
    plan.hasTrip && 'ค่ากิจกรรมทัศนศึกษาแหล่งเรียนรู้', 'ค่าอุปกรณ์การจัดค่ายทั้งหมด'
  ].filter(Boolean) as string[];
  // ทีมแก้รายการเองได้ (ช่องว่างถูกตัดทิ้ง) — ถ้าไม่ได้แก้ ใช้รายการอัตโนมัติ
  const custom = (c.budgetItems || []).map(x => String(x ?? '').trim()).filter(Boolean);
  const budget = custom.length ? custom : autoBudget;
  const total = c.students + (showTeachers(c) ? c.teachers : 0);
  // แยกชื่อหลักสูตรเป็นไทย + อังกฤษ: ชื่อในคลังอยู่รูป "ชื่อไทย (English Name)" → ไทยบรรทัดบน, อังกฤษในวงเล็บบรรทัดล่าง
  const rawName = course ? course.name : S.titleTh;
  const nm = rawName.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  const nameTh = nm ? nm[1].trim() : rawName;      // ชื่อไทยล้วน (ไม่มีวงเล็บอังกฤษ)
  const enName = nm ? nm[2].trim() : S.en;          // อังกฤษในวงเล็บ (หรือชื่อ EN มาตรฐานของวิชา)
  const p1 = `นักเรียนห้องเรียนพิเศษ${c.level ? ` ระดับชั้น ${c.level}` : ''} จำนวน ${c.students} คน`;
  const p2 = showTeachers(c) ? `คุณครูผู้ดูแล ${c.teachers} คน รวม ${total} คน` : '';

  // กิจกรรมเสริม (Add-on): 1 บรรทัด/วิชา = ชื่อกิจกรรมที่ลงกำหนดการจริง · งบอัตโนมัติเพิ่ม "ค่าจัดกิจกรรมเสริม…"
  const addonItems = (plan.addons || []).filter(a => a.titles.length).map(a => `กิจกรรมเสริม${a.label} ${a.titles.map(t => t.replace(/^กิจกรรมเสริม\S*\s*/, '')).join(' ')}`);
  const addonBudget = (plan.addons || []).filter(a => a.titles.length).map(a => `ค่าจัดกิจกรรมเสริม${a.label} (วิทยากรและอุปกรณ์)`);
  // หน้าปก: ไม่ต่อท้ายบรรทัดระยะเวลา/สถานที่ (ทีมไม่ทำกัน — ผู้ใช้ 17 พ.ย.) → วิชาที่ร่วมไปอยู่ในชื่อค่ายแทน (combineTitles)
  const withAddonSec = (cv: CoverSec[]) => cv;
  autoBudget.push(...addonBudget);
  const base = { objectives, acts: mixActs(acts), integ, budget: custom.length ? custom : autoBudget, autoBudget, staff, p1, p2, dur, addonItems };
  // ===== หน้าปกตามแม่แบบจริงของทีม (ลำดับหัวข้อ/ถ้อยคำตามต้นฉบับ แทนค่าด้วยบรีฟ) =====
  const tt = plan.tpl ? (c.pastTpl && plan.tpl.id === c.pastTpl.id ? c.pastTpl : templateById(plan.tpl.id)) : undefined;
  if (tt) {
    const F = (x: string) => fillTpl(x, c);
    const exact = !!plan.tpl!.exact;
    const secOf = (re: RegExp) => tt.secs.find(x => x.k === 'list' && re.test(x.h || ''));
    const tActs = mixActs(exact ? ((tt.secs.find(x => x.acts) || { items: [] as string[] }).items || []).map(F) : acts);
    const tObj = ((secOf(/^วัตถุประสงค์/) || { items: [] as string[] }).items || []).map(F);
    const tInteg = ((secOf(/^บูรณาการ/) || { items: [] as string[] }).items || []).map(F);
    const cover: CoverSec[] = [];
    for (const sec of tt.secs) {
      if (sec.k === 'info') {
        const lab = sec.label || '';
        const val = (/จำนวน|ผู้เข้า|กลุ่มเป้าหมาย/.test(lab) ? [p1, p2] : /วิทยากร/.test(lab) ? [`${staff} ท่าน`] : /ระยะเวลา/.test(lab) ? [dur] : /สถานที่/.test(lab) && hasVal(c.venue) ? [c.venue.trim()] : []).filter(Boolean);
        if (!val.length) continue;
        const last = cover[cover.length - 1];
        if (last && last.k === 'info') last.rows!.push([lab, val]); else cover.push({ k: 'info', rows: [[lab, val]] });
        continue;
      }
      const isObj = sec.k === 'list' && /^วัตถุประสงค์/.test(sec.h || '');
      const items = sec.acts ? tActs : isObj && !tObj.length ? objectives : (sec.items || []).map(F);
      cover.push({ k: sec.k, h: sec.h, items, first: isObj });
    }
    const tBudget = exact ? [...budgetFromTemplate(tt.budget, c, plan, staff), ...addonBudget] : autoBudget;
    const titleTh = F(tt.titles[0] || `หลักสูตร “${nameTh}”`), titleEn = tt.titles[1] ? F(tt.titles[1]) : '';
    return { ...base, objectives: tObj.length ? tObj : objectives, acts: tActs.length ? tActs : base.acts, integ: tInteg.length ? tInteg : integ,
      autoBudget: tBudget, budget: custom.length ? custom : tBudget, titleTh, nameTh: titleTh, titleEn, cover: withAddonSec(cover), source: tt.source };
  }
  const cover: CoverSec[] = [
    { k: 'list', h: 'วัตถุประสงค์การเรียนรู้', items: objectives, first: true },
    { k: 'info', rows: [['จำนวน', [p1, p2].filter(Boolean)], ['วิทยากร', [`${staff} คน`]], ['ระยะเวลาอบรม', [dur]]] },
    { k: 'list', h: 'กิจกรรมเชิงบูรณาการ', items: base.acts },
    { k: 'list', h: 'บูรณาการการเรียน (Instruction Integration)', items: integ }
  ];
  return { ...base, cover: withAddonSec(cover), titleTh: `หลักสูตร “${nameTh}”`, nameTh: `“${nameTh}”`, titleEn: `( ${enName} )`, source: '' };
}
// ===== ชื่อค่ายรวมวิชา (Add-on / ธีมรายวัน) =====
//   ไทย: ต่อ "และ<วิชา>" หลังชื่อไทย เช่น "ค่ายบูรณาการวิชาการสะเต็มศึกษาและภาษาอังกฤษ" (หลายวิชา: "… ภาษาอังกฤษ และภาษาจีน")
//   อังกฤษ: แทรกก่อนคำว่า Camp เช่น "STEM & English Camp 2026" (หลายวิชา: "STEM, English & Chinese Camp")
//   วิชาที่ชื่อเดิมมีอยู่แล้ว → ไม่ซ้ำ · ชื่อที่ไม่มีอักษรไทย/ละติน (ชื่อจีนของ CHI) → คงเดิม
export const TITLE_TH: Record<string, string> = {
  'PL STM 0101': 'สะเต็มศึกษา', 'PL LEA 0102': 'ภาวะผู้นำ', 'PL SEA 0103': 'วิทยาศาสตร์ทางทะเล', 'PL ENG 0104': 'ภาษาอังกฤษ', 'PL PRE 0105': 'คณิตศาสตร์และวิทยาศาสตร์',
  'PL ENV 0106': 'สิ่งแวดล้อม', 'PL MAT 0107': 'คณิตศาสตร์', 'PL AST 0108': 'ดาราศาสตร์', 'PL CHI 0109': 'ภาษาจีน', 'PL FOR 0110': 'นิติวิทยาศาสตร์',
  'PL COD 0111': 'หุ่นยนต์และโค้ดดิ้ง', 'PL GEO 0112': 'ธรณีวิทยา', 'PL ITD 0113': 'เทคโนโลยีสารสนเทศ', 'PL TI 0116': 'เทคโนโลยีโดรน'
};
export const TITLE_EN: Record<string, string> = {
  'PL STM 0101': 'STEM', 'PL LEA 0102': 'Leadership', 'PL SEA 0103': 'Marine Science', 'PL ENG 0104': 'English', 'PL PRE 0105': 'Pre-Genius',
  'PL ENV 0106': 'Environmental', 'PL MAT 0107': 'Math', 'PL AST 0108': 'Astronomy', 'PL CHI 0109': 'Chinese', 'PL FOR 0110': 'Forensic Science',
  'PL COD 0111': 'Robotic Coding', 'PL GEO 0112': 'Geology', 'PL ITD 0113': 'IT Digital', 'PL TI 0116': 'Drone'
};
// รหัสวิชาที่ "ร่วม" กับค่ายหลัก: Add-on ที่ลงกำหนดการจริง + หลักสูตรของวันอื่น (ธีมรายวัน) ไม่ซ้ำ ไม่รวมหลักสูตรหลัก
export function joinedCodes(c: Camp, plan: Plan): string[] {
  const out: string[] = [];
  const add = (x?: string) => { if (x && x !== c.courseCode && !out.includes(x)) out.push(x); };
  for (const m of plan.mix || []) add(m.code);
  for (const a of plan.addons || []) if (a.titles.length) add(a.code);
  return out;
}
const TH_CHAR = /[\u0E00-\u0E7F]/;
const thList = (xs: string[]) => xs.length === 1 ? `และ${xs[0]}` : ` ${xs.slice(0, -1).join(' ')} และ${xs[xs.length - 1]}`;
const enList = (xs: string[]) => xs.length === 1 ? ` & ${xs[0]}` : `, ${xs.slice(0, -1).join(', ')} & ${xs[xs.length - 1]}`;
export function combineTitle(s: string, codes: string[]): string {
  if (!s || !codes.length) return s;
  let out = s;
  // ตัดส่วนที่ชื่อเดิมมีแล้ว (เช่น คณิตศาสตร์และวิทยาศาสตร์ + ชื่อมี "คณิตศาสตร์" → เติมแค่ "วิทยาศาสตร์")
  const has = (w: string) => out.replace(/\s+/g, '').includes(w.replace(/\s+/g, ''));
  const th = codes.map(x => (TITLE_TH[x] || courseLabel(x)).split('และ').filter(w => w && !has(w)).join('และ')).filter(Boolean);
  // ข้ามคำนำ "หลักสูตร" (ชื่อค่ายภาษาอังกฤษล้วน เช่น หลักสูตร “Forensic Science Camp” → ไม่แทรกไทย)
  const pre = (out.match(/^\s*หลักสูตร\s*/) || [''])[0].length;
  let i = -1; for (let j = out.length - 1; j >= pre; j--) if (TH_CHAR.test(out[j])) { i = j; break; }
  if (th.length && i >= 0) out = out.slice(0, i + 1) + thList(th) + out.slice(i + 1);
  const en = codes.map(x => TITLE_EN[x]).filter(x => x && !new RegExp(`\\b${x.replace(/[^A-Za-z ]/g, '')}\\b`, 'i').test(s));
  if (en.length) {
    const m = [...out.matchAll(/\bcamp\b/gi)].pop();
    if (m && m.index !== undefined) {
      const before = out.slice(0, m.index).replace(/\s+$/, '');
      // ชื่อเดิมมี "&" อยู่แล้ว (Drone & Innovation) → ใช้ "and" ไม่ให้ & ซ้อน
      const join = en.length === 1 && /&/.test(before) ? ` and ${en[0]}` : enList(en);
      out = `${before}${join} ${out.slice(m.index)}`;
    } else if (/[A-Za-z]{3,}/.test(out) && !TH_CHAR.test(out)) {
      out = out.replace(/(\S)(\s*[)”"]*\s*)$/, `$1${enList(en)}$2`);
    }
  }
  return out;
}
// ประมาณจำนวนบรรทัดของชื่อ (18 pt หนา ≈ 66 ตัวอักษรฐาน/บรรทัด; ไม่นับสระบน-ล่าง/วรรณยุกต์)
const titleLines = (s: string) => s ? Math.ceil(s.replace(/[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/g, '').length / 66) : 0;
export function compose(c: Camp, plan: Plan) {
  const k0 = composeBase(c, plan);
  const codes = joinedCodes(c, plan);
  if (!codes.length) return k0;
  let titleTh = combineTitle(k0.titleTh, codes), titleEn = combineTitle(k0.titleEn, codes);
  // ชื่อไทย+อังกฤษอยู่บรรทัดเดียว (STM: "…สะเต็มศึกษา STEM Camp 2026") แล้วยาวเกิน 1 บรรทัด → แยกอังกฤษเป็นบรรทัดล่าง "( … Camp 2026 )"
  const sp = !titleEn && titleLines(titleTh) > 1 ? titleTh.match(/^(.*[\u0E00-\u0E7F])\s+([A-Za-z][^\u0E00-\u0E7F]*?)\s*([”"]?)$/) : null;
  if (sp) { titleTh = `${sp[1]}${sp[3]}`; titleEn = `( ${sp[2]} )`; }
  const more = titleLines(titleTh) + titleLines(titleEn) - titleLines(k0.titleTh) - titleLines(k0.titleEn);
  const k = more > 0 ? composeBase(c, plan, more) : k0;
  return { ...k, titleTh, nameTh: k.nameTh === k.titleTh ? titleTh : combineTitle(k.nameTh, codes), titleEn, joined: codes };
}
// หน้าปกเป็นลำดับหัวข้อ (ตามแม่แบบหรือแพตเทิร์นมาตรฐาน) — Word/PDF/พรีวิว เรนเดอร์จากโครงเดียวกัน
//   list = รายการเลข "1.ข้อความ" (first = ย่อหน้าแรกเยื้องแบบวัตถุประสงค์) · para = ย่อหน้า · bullets = "-"/"•" · info = ป้าย<แท็บ>ค่า
export interface CoverSec { k: 'list' | 'para' | 'bullets' | 'info'; h?: string; items?: string[]; rows?: [string, string[]][]; first?: boolean }

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
  const tp = plan.tpl;
  const hasAAR = allItems.some(r => /AAR/.test(r.title)) || !!(tp && tp.aar);
  // กิจกรรมจากคลัง 14 หลักสูตรยัง "รอตรวจ" — เตือน (soft) ให้ทีมยืนยันรายละเอียดก่อนจัดจริง
  // ใช้แม่แบบจริงตรงระยะเวลา → กำหนดการมาจากเอกสารทีม ไม่ได้ใช้คลังกิจกรรม "รอตรวจ"
  const pendingCount = tp && tp.exact ? 0 : c.activityIds.filter(id => pool.find(a => a.id === id)?.draft).length;
  const realActs = c.actImgs.filter(im => im.data).length;
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
    // แม่แบบจริงหลายหลักสูตร (CHI/COD/ENG/FOR/ITD/LEA/TI) ไม่มี AAR ในต้นฉบับ → ยึดแม่แบบทีม แจ้งเป็นข้อสังเกต ไม่ถือว่าผิด
    tp && tp.exact && !hasAAR ? { ok: true, soft: true, msg: 'กิจกรรมตามแม่แบบทีม (ต้นฉบับไม่มี AAR)' } : { ok: hasAAR, msg: 'มีกิจกรรมถอดบทเรียน (AAR)' },
    { ok: noGap, msg: 'ทุกช่วงเวลามีกิจกรรมจริง (ไม่มีช่องว่าง)' },
    { ok: unique, soft: true, msg: unique ? `กิจกรรมหลักพอทุกช่องไม่ซ้ำ (ใช้ ${plan.coreSlots} ช่อง · คลังมี ${coreAvail})` : `ค่ายยาว ใช้ ${plan.coreSlots} ช่อง แต่คลังมี ${coreAvail} — ระบบวนใช้ซ้ำแบบติดป้าย “(ต่อยอด)” หรือเพิ่มกิจกรรมเองในแท็บ 3` },
    { ok: pendingCount === 0, soft: true, msg: pendingCount === 0 ? 'ไม่มีกิจกรรมสถานะรอตรวจ' : `⚠ มีกิจกรรม "รอตรวจ" ${pendingCount} รายการ (จากคลัง 14 หลักสูตร) — ทีมต้องยืนยันขั้นตอน/อุปกรณ์/เวลาก่อนจัดจริง` },
    ...(tp ? [
      { ok: tp.exact, soft: true, msg: tp.exact ? `ใช้แม่แบบจริงของทีม ${tp.source.replace('__', ' · ')} (${durKeyLabel(tp.dur)})` : `ยังไม่มีแม่แบบ ${durKeyLabel(durKeyOf(c))} ของหลักสูตรนี้ — หน้าปกใช้แม่แบบ ${tp.source.replace('__', ' · ')} · กำหนดการจัดอัตโนมัติจากคลังกิจกรรม` },
      ...(tp.locRows.length && tp.areaOK !== true ? [{ ok: false, soft: true, msg: `กำหนดการมีกิจกรรมนอกสถานที่ของแม่แบบ (พื้นที่${tp.area.join('/') || 'เดิม'}) ${tp.locRows.length} รายการ — ตรวจว่าเหมาะกับพื้นที่ค่าย${c.province ? ' จ.' + c.province : ''} ก่อนส่ง: ${tp.locRows.slice(0, 3).join(' · ')}` }] : []),
      ...(tp.depWarn ? [{ ok: false, soft: true, msg: tp.depWarn }] : []),
      ...(tp.dropped.length ? [{ ok: true, soft: true, msg: `ตัดรายการที่ไม่ถูกต้องในต้นฉบับ: ${tp.dropped.join(' · ')}` }] : [])
    ] : []),
    ...((plan.addons || []).map(a => ({ ok: a.titles.length > 0, soft: true, msg: a.titles.length ? `กิจกรรมเสริม${a.label} ${a.titles.length} ช่วงในกำหนดการ${a.price ? ` · +${money(a.price)} บาท/ท่าน` : ' · รวมในราคาเดิม'}` : `กิจกรรมเสริม${a.label} ยังไม่ได้เลือกกิจกรรม` }))),
    ...((plan.addonWarn || []).map(m => ({ ok: false, soft: true, msg: m }))),
    ...((plan.extWarn || []).map(m => ({ ok: false, soft: true, msg: m }))),
    ...(plan.editMissed ? [{ ok: false, soft: true, msg: `แก้ไขกำหนดการ ${plan.editMissed} แถว หาแถวเดิมไม่พบแล้ว (กำหนดการเปลี่ยน) — ตรวจในขั้น "กำหนดการ"` }] : []),
    ...((c.actsOverride || []).map(x => String(x ?? '').trim()).filter(Boolean).map((x, i) => actInSchedule(x, plan) ? null : { ok: false, soft: true, msg: `กิจกรรมเชิงบูรณาการข้อ ${i + 1} "${x.slice(0, 40)}" ไม่พบในกำหนดการ` }).filter(Boolean) as { ok: boolean; msg: string; soft?: boolean }[]),
    ...(plan.mix ? [{ ok: true, soft: true, msg: `ธีมรายวัน: ${plan.mix.map(m => `วันที่ ${m.day} ${m.label}`).join(' · ')}` },
      { ok: false, soft: true, msg: 'ค่าย mix หลักสูตร — ตรวจรายการงบ (อุปกรณ์/ทัศนศึกษา/วิทยากร) ให้ครอบคลุมกิจกรรมทุกวัน' }] : []),
    ...(c.courseCode ? [{ ok: realActs >= 6, soft: true, msg: realActs >= 6 ? `ภาพกิจกรรม ${realActs} รูป จากไฟล์ของค่ายนี้` : `ภาพกิจกรรมมี ${realActs} รูป (ควร 6–8 รูปจากไฟล์ของค่ายนี้)${realActs === 0 ? ' — ภาพยังโหลดไม่เสร็จหรือเปิดแบบออฟไลน์' : ''}` }] : [])
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
type RO = { b?: boolean; sz?: number; color?: string; strike?: boolean; i?: boolean; u?: boolean };
// ล้างอักขระที่ XML 1.0 ไม่รองรับ (NUL/control chars ที่มักติดมาจากการ copy) — กันไฟล์ .docx เสีย/เปิดไม่ได้
// อักขระที่อนุญาต: \t \n \r และ 0x20 ขึ้นไป (ยกเว้น noncharacters)
const XML_BAD = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;
export const xmlSafe = (t: any): string => (t === null || t === undefined ? '' : String(t)).replace(XML_BAD, '');
// ข้อความขึ้นต้นด้วย \t → ใส่แท็บจริงของ Word (<w:tab/>) ไม่ใช่อักขระแท็บในข้อความ
const R = (text: string, o: RO = {}) => { const sz = (o.sz || 16) * 2; const tab = text.startsWith('\t'); const t = xmlSafe(tab ? text.slice(1) : text);
  return new TextRun({ ...(tab ? { children: [new Tab(), t] } : { text: t }), font: FONT, language: LANG, size: sz, sizeComplexScript: sz, bold: o.b, boldComplexScript: o.b, color: o.color, strike: o.strike, italics: o.i, underline: o.u ? { type: UnderlineType.SINGLE } : undefined }); };
const P = (t: string | TextRun[], o: RO & { al?: (typeof AlignmentType)[keyof typeof AlignmentType]; before?: number; after?: number; indent?: number; hang?: number; first?: number; tab?: number; keep?: boolean; pb?: boolean; hd?: (typeof HeadingLevel)[keyof typeof HeadingLevel] } = {}) =>
  new Paragraph({ heading: o.hd, alignment: o.al, spacing: { before: (o.before || 0) * 20, after: (o.after ?? 2) * 20, line: 240, lineRule: LineRuleType.AUTO }, indent: o.indent !== undefined || o.first !== undefined ? { left: (o.indent || 0) * 567, hanging: o.hang ? o.hang * 567 : undefined, firstLine: o.first ? o.first * 567 : undefined } : undefined, tabStops: o.tab ? [{ type: TabStopType.LEFT, position: o.tab }] : undefined, keepNext: o.keep, pageBreakBefore: o.pb,
    children: typeof t === 'string' ? [R(t, o)] : t });
const CTR = AlignmentType.CENTER, RGT = AlignmentType.RIGHT;
const code = (t: string) => P(t, { color: '000000', al: RGT }); // รหัสเอกสารชิดขวา ตัวปกติ สีดำ (ตามเอกสารจริง)
const title = (th: string, en?: string, sz = 20, pb = false) => [P(th, { hd: HeadingLevel.HEADING_1, b: true, sz: th.length > 40 ? Math.min(sz, 17.5) : th.length > 32 ? Math.min(sz, 18.5) : sz, color: '0F3D63', al: CTR, after: 0, pb, keep: true }), ...(en ? [P(en, { b: true, sz: 18, color: SKY, al: CTR, after: 4 })] : [])];
const HK = (t: string) => P(t, { hd: HeadingLevel.HEADING_2, b: true, color: '000000', after: 0, keep: true }); // หัวข้อแบบเอกสารจริง: 16 pt หนา สีดำ
const H = (t: string) => P(t, { hd: HeadingLevel.HEADING_2, b: true, color: '000000', before: 6, after: 2, keep: true });
const numFirst = (a: string[]) => a.map((x, i) => P(`${i + 1}.${x}`, { first: 1.27, after: 0 }));
const numBlock = (a: string[]) => a.map((x, i) => P(`${i + 1}.${x}`, { indent: 1.27, after: 0 }));
const TAB_INFO = 2160; // ระยะแท็บหลังป้าย จำนวน/วิทยากร/ระยะเวลาอบรม (1.5 นิ้ว ตามเอกสารจริง)
const infoTabs = (pairs: [string, string[]][]) => pairs.flatMap(([k, v]) => v.filter(Boolean).map((x, i) => i === 0
  ? P([R(k, { b: true }), R('\t' + x)], { tab: TAB_INFO, indent: TAB_INFO / 567, hang: TAB_INFO / 567, after: 0 })
  : P(x, { indent: TAB_INFO / 567, after: 0 })));
const coverParas = (cover: CoverSec[]): Paragraph[] => cover.flatMap(sec => {
  if (sec.k === 'info') return infoTabs(sec.rows || []);
  const head = sec.h ? [HK(sec.h)] : [];
  const items = sec.items || [];
  if (sec.k === 'list') return [...head, ...(sec.first ? numFirst(items) : numBlock(items))];
  if (sec.k === 'para') return [...head, ...items.map(x => P(x, { first: 1.27, after: 0 }))];
  return [...head, ...items.map(x => {          // bullets: "-" ระดับ 1 · "•" ระดับ 2 (ตามต้นฉบับ)
    const m = x.match(/^([-–•●])\s*(.*)$/);
    if (!m) return P(x, { indent: 1.27, after: 0 });
    const l2 = m[1] === '•' || m[1] === '●';
    return P([R(l2 ? '•' : '-'), R('\t' + m[2])], { indent: l2 ? 2.54 : 1.9, hang: 0.63, after: 0 });
  })];
});
const numbered = (a: string[], keep = false) => a.map((x, i) => P(`${i + 1}. ${x}`, { indent: 0.9, hang: 0.9, after: 1, keep }));
const dashed = (a: string[], keep = false) => a.map((x, i) => P([R('-'), R('\t' + x)], { indent: 1.27, hang: 1.27, after: 0, keep: keep && i < a.length - 1 }));
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
const TAB_SCHED = 2160; // คอลัมน์รายการเริ่มที่ 1.5 นิ้ว (ตามเอกสารจริง)
const schedLines = (d: Day, lastDay = false): Paragraph[] => {
  const out: Paragraph[] = [P([R(`วันที่ ${d.day}`, { u: true })], { keep: true, before: 8, after: 2 })];
  d.items.forEach((r, i) => {
    const keep = lastDay || i < d.items.length - 1; // วันสุดท้าย: ผูกทั้งก้อนกับหมายเหตุ
    out.push(P([R(r.time), R('\t' + r.title)], { tab: TAB_SCHED, indent: TAB_SCHED / 567, hang: TAB_SCHED / 567, after: 0, keep: keep || !!(r.sub && r.sub.length) }));
    (r.sub || []).forEach((x, j) => out.push(P(x, { indent: TAB_SCHED / 567, after: 0, color: '334155', keep: keep || j < r.sub!.length - 1 })));
  });
  return out;
};
const scheduleBlock = (c: Camp, plan: Plan, k: ReturnType<typeof compose>, extra = false, pb = false) => [
  // หัวข้อกำหนดการทั้งก้อน = 18 pt ตัวหนา กึ่งกลาง · รายละเอียด = 16 pt ธรรมดา (ไม่มีตาราง/แถบสี — สุภาพตามเอกสารจริง)
  P('กำหนดการ', { hd: HeadingLevel.HEADING_1, b: true, sz: 18, color: '000000', al: CTR, after: 0, pb, keep: true }),
  P(k.nameTh, { b: true, sz: 18, al: CTR, after: 0, keep: true }),
  ...(k.titleEn ? [P(k.titleEn, { b: true, sz: 18, al: CTR, after: 0, keep: true })] : []),
  ...(hasVal(c.school) ? [P(c.school, { b: true, sz: 18, al: CTR, after: 0, keep: true })] : []),
  ...(hasVal(c.dates) ? [P(c.dates, { b: true, sz: 18, al: CTR, after: 0, keep: true })] : []),
  ...(hasVal(c.venue) ? [P(`ณ ${c.venue}`, { b: true, sz: 18, al: CTR, after: 6 })] : [P('', { after: 6 })]),
  // เอกสารภายใน (runsheet) ยังใช้ตารางที่มีช่องผู้รับผิดชอบ
  ...(extra ? plan.days.flatMap(d => [P('', { after: 0, sz: 6 }), scheduleTable(d, true, `วันที่ ${d.day}  (ช่องขวา: ผู้รับผิดชอบ / อุปกรณ์)`)]) : plan.days.flatMap((d, i) => schedLines(d, i === plan.days.length - 1))),
  // หมายเหตุปิดท้ายกำหนดการเสมอ (บรรทัดถัดไป) — ตัวปกติ สีแดง ตามเอกสารจริง
  P('หมายเหตุ : กำหนดการอาจจะเปลี่ยนแปลงตามความเหมาะสม', { color: PRICE_RED, before: 10, after: 0 })
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
  ...(addonPriceNote(c) ? [P(addonPriceNote(c), { keep: true, after: 2 })] : []),
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
// 7–8 รูป → กรอบเล็กลง (4:3 = 236×177) ให้ทั้งชุดอยู่หน้าเดียว ไม่ล้นไปหน้าถัดไป
const fitBox = (d: Uint8Array, many = false) => {
  const BW = many ? 248 : BOX_W, BH = many ? 186 : BOX_H;
  const s = imgSize(d); if (!s || !s.w || !s.h) return { width: BW, height: Math.round(BW * 0.68) };
  let w = BW, h = Math.round(s.h * BW / s.w);
  if (h > BH) { h = BH; w = Math.round(s.w * BH / s.h); }
  return { width: w, height: h };
};
// กริดภาพ 2 คอลัมน์ (6–8 รูป) — มีกรอบ + หมายเลข + คำบรรยายใต้รูป (ตามสเปกเอกสารราชการ)
// ย่อหน้าที่มีภาพ ต้องใช้ระยะบรรทัด single เสมอ — ถ้าใช้ 1.25 (ค่าเริ่มของเอกสาร) LibreOffice/WPS/Google Docs จะตัดภาพเหลือแถบบาง ๆ
const IMG_SP = { line: 240, lineRule: LineRuleType.AUTO };
// คำบรรยายแสดงเฉพาะที่ทีมพิมพ์เอง — ภาพที่ระบบดึงจากไฟล์ค่ายไม่มีข้อความใต้ภาพ (ตามเอกสารจริงของทีม)
export const realCaption = (c?: string): boolean => !!(c && c.trim() && !c.includes('...') && !/^บรรยากาศ(กิจกรรม|ที่พัก)$/.test(c.trim()));
const photoGrid = (imgs: Img[], fallbackN: number, _label = 'ภาพกิจกรรม') => {
  const list = (imgs.length ? imgs : Array.from({ length: fallbackN }, () => ({ caption: '' } as Img))).slice(0, 8);
  const rows: TableRow[] = [];
  for (let i = 0; i < list.length; i += 2) { const kp = i + 2 < list.length; rows.push(new TableRow({ cantSplit: true, children: [0, 1].map(j => { const im = list[i + j]; const n = i + j + 1; if (!im) return cell([P('', { keep: kp })], W / 2, { border: 'none' }); void n; const cap = realCaption(im.caption) ? im.caption.trim() : ''; return cell([
    im.data ? new Paragraph({ alignment: CTR, keepNext: kp || !!cap, spacing: { before: 40, after: cap ? 8 : 100, ...IMG_SP }, children: [new ImageRun({ type: imgType(im.data), data: im.data, transformation: fitBox(im.data, list.length > 6) })] })
      : P('พื้นที่วางภาพ', { al: CTR, color: '94A3B8', before: 70, after: 70, keep: true }),
    ...(cap ? [new Paragraph({ alignment: CTR, keepNext: kp, spacing: { after: 60, ...IMG_SP }, children: [R(cap, { sz: 14, color: '48484A' })] })] : [])], W / 2, { border: 'none' }); }) })); }
  return tbl(rows, [W / 2, W / 2]);
};
// ภาพประกอบ STEAM (คอลลาจ) — ใช้ซ้ำได้ทุกเอกสารของค่าย STEAM
const steamGalleryPara = () => new Paragraph({ alignment: CTR, spacing: { before: 40, ...IMG_SP }, children: [new ImageRun({ type: 'jpg', data: b64bytes(STEAM_GALLERY.b64), transformation: { width: Math.min(520, CONTENT_W_PX), height: Math.round(Math.min(520, CONTENT_W_PX) * STEAM_GALLERY.h / STEAM_GALLERY.w) } })] });
// ภาพประกอบในทุกไฟล์: ภาพกิจกรรม (ของจริงถ้ามี/ไม่งั้นดึงภาพหลักสูตร) + ภาพ STEAM หน้าสุดท้ายถ้าเป็นค่าย STEAM
const photoSection = (c: Camp, opts: { venue?: boolean } = {}): (Paragraph | Table)[] => {
  const acts = c.actImgs;   // ภาพจากไฟล์ของค่ายนั้น (ระบบดึงให้) หรือที่ทีมอัปโหลดเอง — ไม่มีภาพสำรองจากแหล่งอื่น
  // หน้าภาพแยกหน้าชัดเจน (ขึ้นหน้าใหม่) + หัวข้อ "ตัวอย่างภาพกิจกรรม" ตัวหนากึ่งกลางเสมอ
  // ไม่มีภาพจริง → ไม่ใส่หน้าภาพ (ห้ามใส่กรอบว่าง/ภาพปลอม) — เว็บแจ้งเตือนให้ทีมเติมภาพแทน
  const real = acts.filter(im => im.data);
  const out: (Paragraph | Table)[] = real.length ? [...title('ตัวอย่างภาพกิจกรรม', undefined, 20, true), P('', { after: 2 }), photoGrid(real, 0, 'ภาพกิจกรรม')] : [];
  // ที่พัก: อยู่หน้าหลังสุด — หัวข้อ "ตัวอย่างภาพบรรยากาศที่พัก <ชื่อที่พัก>" ตัวหนากึ่งกลาง (6–8 รูป: ป้าย/มุมสูง 2 · ห้องพัก 2 · สระ/สิ่งอำนวยความสะดวก 2 · ห้องประชุม 2)
  if (opts.venue && c.venueImgs.some(im => im.data)) { out.push(...title(`ตัวอย่างภาพบรรยากาศที่พัก ${c.venue || ''}`.trim(), undefined, 20, true), P('', { after: 2 }), photoGrid(c.venueImgs, 6, 'ภาพที่พัก')); }
  // ภาพเซ็ต STEAM — เฉพาะหลักสูตร STEAM เท่านั้น (ไม่ใส่ให้ดาราศาสตร์/ธรณี/ทะเล ฯลฯ)
  // ค่ายที่มีแม่แบบจริง ใช้ภาพจากไฟล์ของค่ายนั้นเท่านั้น → ไม่เติมคอลลาจ STEAM
  if (isSteamProgram(c) && !templateFor(c)) { out.push(...title('ตัวอย่างภาพกิจกรรมค่าย STEAM', undefined, 20, true), steamGalleryPara()); }
  return out;
};
const sign = (l: string, who: string) => cell([P('', { after: 18, keep: true }), P('ลงชื่อ ....................................................', { al: CTR, after: 0, keep: true }), P(`( ${who} )`, { al: CTR, after: 0, keep: true }), P(l, { al: CTR, after: 0, keep: true })], W / 2);
// ช่องลงนามแบบย่อหน้า + แท็บกึ่งกลาง (ไม่ใช่ตาราง) → "ผูกกับย่อหน้าก่อนหน้า" ได้จริงทั้ง Word/LibreOffice ไม่หลุดไปหน้าเปล่า
const signLines = (cols: ([string, string] | null)[]): Paragraph[] => {
  const stops = [{ type: TabStopType.CENTER, position: Math.round(W / 4) }, { type: TabStopType.CENTER, position: Math.round(W * 3 / 4) }];
  const line = (f: (x: [string, string]) => string, last: boolean) => new Paragraph({ tabStops: stops, keepNext: !last, keepLines: true, spacing: { after: 0, line: 240, lineRule: LineRuleType.AUTO },
    children: cols.map(x => R('\t' + (x ? f(x) : ''))) });   // R() = xmlSafe + ฟอนต์/ภาษาไทย
  return [P('', { after: 18, keep: true }), line(() => 'ลงชื่อ ....................................................', false), line(x => `( ${x[1]} )`, false), line(x => x[0], true)];
};
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
  return new Header({ children: [new Paragraph({ alignment: CTR, spacing: { after: 0, ...IMG_SP },
    children: [new ImageRun({ type: 'png', data: b64bytes(h.b64), transformation: { width: CONTENT_W_PX, height: Math.round(CONTENT_W_PX * h.h / h.w) } })] })] });
};
const letterheadFooter = (_r: Region): Footer => {
  const lh = { footerPng: FOOTER_BAR.b64, footerW: FOOTER_BAR.w, footerH: FOOTER_BAR.h };   // แถบท้ายความละเอียดสูง (scripts/gen-footer.cjs)
  const pn = (child: any) => new TextRun({ children: [child], font: FONT, size: 24, sizeComplexScript: 24, color: '8E8E93' });
  const pnTxt = (t: string) => new TextRun({ text: t, font: FONT, size: 24, sizeComplexScript: 24, color: '8E8E93' });
  return new Footer({ children: [
    new Paragraph({ alignment: CTR, spacing: { after: 0, ...IMG_SP }, children: [pnTxt('หน้า '), pn(PageNumber.CURRENT), pnTxt(' / '), pn(PageNumber.TOTAL_PAGES)] }),
    new Paragraph({ alignment: CTR, spacing: { before: 0, ...IMG_SP },
      children: [new ImageRun({ type: 'png', data: b64bytes(lh.footerPng), transformation: { width: CONTENT_W_PX, height: Math.round(CONTENT_W_PX * lh.footerH / lh.footerW) } })] })] });
};

/* ===================== 4 DOCUMENT BUILDERS ===================== */

// เช็คลิสต์อุปกรณ์จากฐานกิจกรรม Notion — เฉพาะเอกสารภายใน (Run-down) · ไม่เดาจำนวนกลุ่ม (ระบุ "ต่อกลุ่ม" ตามต้นฉบับ)
const equipmentSection = (plan: Plan): Paragraph[] => {
  const acts = notionActsInPlan(plan);
  const head = H('เช็คลิสต์อุปกรณ์กิจกรรม (มาตรฐานจาก Notion)');
  if (!acts.length) return [head, P('กิจกรรมในกำหนดการนี้ยังไม่มีหน้ามาตรฐานใน Notion — ตรวจอุปกรณ์กับผู้รับผิดชอบกิจกรรม', { sz: 14, color: '64748B' })];
  return [head, P(`ดึงจากฐานข้อมูลกิจกรรม STEM ใน Notion (ข้อมูล ณ ${NOTION_SYNCED}) · ตรวจของจริงก่อนออกเดินทางทุกครั้ง`, { sz: 14, color: '64748B', after: 2 }),
    ...acts.flatMap(({ a, when }) => {
      const st = actStandard(a);
      const out: Paragraph[] = [P([R(a.name, { b: true }), R(`  ·  ${st.level} (${st.score}/4) · ${when.join(', ')}`, { sz: 14, color: '64748B' })], { keep: true, before: 4, after: 0 })];
      if (a.perGroup.length) out.push(P('อุปกรณ์ต่อกลุ่ม', { sz: 15, u: true, keep: true, after: 0 }), ...a.perGroup.map((e, i) => P(`${i + 1}. ${e.name}${e.qty ? ' — ' + e.qty : ''}`, { sz: 15, indent: 0.9, hang: 0.6, after: 0 })));
      if (a.shared.length) out.push(P('อุปกรณ์ส่วนกลาง', { sz: 15, u: true, keep: true, after: 0 }), ...a.shared.map((e, i) => P(`${i + 1}. ${e.name}${e.qty ? ' — ' + e.qty : ''}`, { sz: 15, indent: 0.9, hang: 0.6, after: 0 })));
      if (!a.perGroup.length && !a.shared.length) out.push(P('ยังไม่มีเช็คลิสต์อุปกรณ์ใน Notion', { sz: 14, color: 'B45309', after: 0 }));
      if (a.slides.length) out.push(P(`สไลด์: ${a.slides.join(' , ')}`, { sz: 13, color: '64748B', after: 0 }));
      return out;
    })];
};
export function buildDoc(kind: DocKind, c0: Camp, planIn?: Plan, k0?: ReturnType<typeof compose>): Document {
  const c = withAddonPrice(c0); // ราคาในเอกสาร = ค่ายหลัก + กิจกรรมเสริม (ที่กรอกราคาเพิ่ม)
  const plan = planIn || buildSchedule(c); const k = k0 || compose(c, plan);
  const total = c.students * c.specialPrice, cost = c.students * c.costPerPerson, profit = total - cost, margin = total ? (profit / total) * 100 : 0;
  let body: (Paragraph | Table)[] = [];
  if (kind === 'program') {
    // หน้าปก (แพตเทิร์นเอกสารจริง): รหัสชิดขวา → ชื่อหลักสูตร 18 หนากลาง → หัวข้อ 16 หนาสีดำ → รายการ "1.ข้อความ"
    body = [code(c.docCode), P(k.titleTh, { hd: HeadingLevel.HEADING_1, b: true, sz: 18, color: '000000', al: CTR, after: k.titleEn ? 0 : 4 }), ...(k.titleEn ? [P(k.titleEn, { b: true, sz: 18, color: '000000', al: CTR, after: 4 })] : []),
      ...coverParas(k.cover),
      ...scheduleBlock(c, plan, k, false, true),
      ...priceBudgetSection(c, k),
      ...photoSection(c, { venue: true })];
  } else if (kind === 'quotation') {
    const cols = [900, 4100, 1100, 1600, 1700];
    const hd = ['ลำดับ', 'รายการ', 'จำนวน', 'ราคา/ท่าน', 'รวม (บาท)'];
    body = [code(`QT ${c.docCode.replace(/^PL\s*/, '')}`), ...title('ใบเสนอราคา', 'QUOTATION'),
      P(`วันที่ ${thDate()}`, { al: RGT }),
      infoRows([['เรียน', [`ผู้อำนวยการ${c.school}`]], ['เรื่อง', [`เสนอราคา${k.titleTh.replace(/^หลักสูตร\s*/, '')} ${k.titleEn}`]], ['อ้างอิง', [`โปรแกรมเลขที่ ${c.docCode} / ${c.dates}`]], ['สถานที่', [`${c.venue} จังหวัด${c.province}`]]]),
      P('', { after: 4 }),
      tbl([new TableRow({ tableHeader: true, children: hd.map((h, i) => cell([P(h, { b: true, color: 'FFFFFF', al: CTR, after: 0 })], cols[i], { fill: BLUE, border: 'box' })) }),
        new TableRow({ children: [
          cell([P('1', { al: CTR, after: 0 })], cols[0], { border: 'box' }),
          cell([P(k.titleTh, { after: 0 }), P(`${k.dur} · ${c.dates}`, { sz: 14, after: 0 }), ...(k.addonItems.length ? [P(k.addonItems.join(' · ') + (addonPriceNote(c) ? ' ' + addonPriceNote(c) : ''), { sz: 14, after: 0 })] : []), P(`นักเรียน${c.level ? ' ' + c.level : ''} · รวมที่พัก อาหาร วิทยากร อุปกรณ์ ตามรายละเอียดในโปรแกรม`, { sz: 14, after: 0 })], cols[1], { border: 'box' }),
          cell([P(String(c.students), { al: CTR, after: 0 })], cols[2], { border: 'box' }),
          cell([P(money(c.specialPrice), { al: RGT, after: 0 })], cols[3], { border: 'box' }),
          cell([P(money(total), { al: RGT, after: 0 })], cols[4], { border: 'box' })] }),
        new TableRow({ children: [cell([P('ยอดรวมสุทธิ (บาท)', { b: true, al: RGT, after: 0 })], cols[0] + cols[1] + cols[2] + cols[3], { fill: 'F0F9FF', border: 'box', span: 4 }), cell([P(money(total), { b: true, al: RGT, after: 0 })], cols[4], { fill: 'F0F9FF', border: 'box' })] })], cols),
      P(`ราคาปกติ ${money(c.normalPrice)} บาท/ท่าน ลดเหลือพิเศษ ${money(c.specialPrice)} บาท/ท่าน (ประหยัด ${money(c.normalPrice - c.specialPrice)} บาท/ท่าน)`, { before: 6 }),
      H('รายละเอียดที่รวมอยู่ในราคา'), ...dashed(k.budget, true),
      // เงื่อนไข + ช่องลงนามอยู่หน้าเดียวกันเสมอ (ไม่ให้ช่องลงนามหลุดไปอยู่หน้าเปล่า)
      // ทั้งก้อนอยู่ในแถวตารางเดียว (cantSplit, ไม่มีเส้น) → ย้ายหน้าไปด้วยกันเสมอ ทั้ง Word/LibreOffice/Google Docs
      tbl([new TableRow({ cantSplit: true, children: [cell([
        H('เงื่อนไข'), ...numbered([`ราคานี้ยืนยันภายใน ${c.validDays} วัน นับจากวันที่เสนอราคา`, c.payTerms, 'กำหนดการอาจเปลี่ยนแปลงตามความเหมาะสม โดยไม่กระทบเนื้อหาการเรียนรู้'], true),
        ...signLines([['ผู้เสนอราคา', c.contactName], ['ผู้อนุมัติ / ตัวแทนโรงเรียน', `ผู้อำนวยการ${c.school}`]])], W, { border: 'none' })] })], [W]),
      ...photoSection(c)];
  } else if (kind === 'booking') {
    const supplier = c.supplierNote || VENUES.find(x => x.name === c.venue)?.note || ''; const m = plan.meals, tch = showTeachers(c) ? c.teachers : 0, ppl = c.students + tch;
    body = [code(`BK ${c.docCode.replace(/^PL\s*/, '')}`), ...title('หนังสือขอใบเสนอราคาและยืนยันห้องพัก/ห้องประชุม', 'ACCOMMODATION & MEETING REQUEST'), P(`วันที่ ${thDate()}`, { al: RGT }),
      P(`เรียน  ฝ่ายขาย/ฝ่ายจัดเลี้ยง ${c.venue}`), P(`ด้วยบริษัท อีคิวแคมป์ มีความประสงค์จัด${k.titleTh.replace(/^หลักสูตร\s*/, '')} ให้แก่${c.school} จึงขอความอนุเคราะห์เสนอราคาและตรวจสอบความพร้อมตามรายละเอียดดังนี้`, { indent: 1 }),
      infoRows([['วันที่เข้าพัก', [c.dates]], ['ระยะเวลา', [k.dur]], ['จำนวนผู้เข้าพัก', [`นักเรียน ${c.students} คน ${tch ? `ครู ${tch} คน ` : ''} ทีมวิทยากร ${k.staff} คน (รวมผู้เข้าร่วมประมาณ ${ppl} คน)`]],
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
      H('รายละเอียดกำหนดการสำหรับห้องประชุมและมื้ออาหาร'), ...plan.days.flatMap((d, di) => { const rows = d.items.filter(r => /อาหาร|กิจกรรม|พิธี|AAR/.test(r.title)); const lastDay = di === plan.days.length - 1;
        return [P([R(`วันที่ ${d.day}`, { u: true })], { keep: true, before: 4, after: 0 }), ...rows.map((r, i) => P([R(r.time, { sz: 14 }), R('\t' + r.title, { sz: 14 })], { tab: 567 + TAB_SCHED, indent: 1 + TAB_SCHED / 567, hang: TAB_SCHED / 567, after: 0, keep: lastDay ? i >= rows.length - 3 : i < rows.length - 1 }))]; }),
      P('จึงเรียนมาเพื่อโปรดพิจารณาและตอบกลับ ขอขอบคุณอย่างสูง', { before: 8, first: 1.27, keep: true }), ...signLines([null, ['ผู้ประสานงาน EQ Camp', c.contactName]]),
      ...photoSection(c, { venue: true })];
  } else {
    body = [P('[เอกสารภายใน EQ CAMP — ห้ามส่งลูกค้า]', { b: true, color: 'B45309', al: CTR }), code(`RD ${c.docCode.replace(/^PL\s*/, '')}`),
      tbl([new TableRow({ children: [cell([
        P(`ต้นทุน ${money(c.costPerPerson)} บ./ท่าน × ${c.students} = ${money(cost)} บาท`, { sz: 15, after: 0 }),
        P(`ราคาขาย ${money(c.specialPrice)} บ./ท่าน × ${c.students} = ${money(total)} บาท`, { sz: 15, after: 0 }),
        P(`กำไรประเมิน ${money(profit)} บาท (Margin ${margin.toFixed(1)}%)${margin < 20 ? '  ⚠ ต่ำกว่า 20%' : ''}`, { b: true, sz: 16, color: profit < 0 ? 'DC2626' : '15803D', after: 0 }),
        P(`ซัพพลายเออร์/ผู้ติดต่อ: ${c.supplierNote || (VENUES.find(v => v.name === c.venue)?.note ?? '-')}`, { sz: 14, after: 0 })], W, { fill: 'FFFBEB', border: 'box' })] })], [W]),
      P('', { after: 4 }), ...scheduleBlock(c, plan, k, true), ...equipmentSection(plan), ...photoSection(c)];
  }
  const region: Region = c.region || regionOf(c.province);
  return new Document({ creator: 'EQ Camp', title: `${c.docCode} ${k.titleTh}`,
    // สไตล์ชื่อมาตรฐานของ Word: ทีมแก้ต่อใน Word แล้วฟอนต์/ขนาดไม่เพี้ยน (เลือก "ปกติ"/"หัวเรื่อง 1-2" ในแถบสไตล์ได้เลย)
    // ขนาดเนื้อความ 16 pt ตามแนวพิมพ์หนังสือราชการ, หัวเรื่องมี outlineLevel → ขึ้นในบานหน้าต่างนำทาง/สารบัญ
    styles: {
      default: {
        document: { run: { font: FONT, language: LANG, size: 32, sizeComplexScript: 32 }, paragraph: { spacing: { line: 240, lineRule: LineRuleType.AUTO, after: 40 } } },
        heading1: { run: { font: FONT, language: LANG, bold: true, boldComplexScript: true, size: 40, sizeComplexScript: 40, color: '0F3D63' }, paragraph: { alignment: AlignmentType.CENTER, outlineLevel: 0, keepNext: true, spacing: { line: 240, lineRule: LineRuleType.AUTO, before: 0, after: 0 } } },
        heading2: { run: { font: FONT, language: LANG, bold: true, boldComplexScript: true, size: 34, sizeComplexScript: 34, color: BLUE }, paragraph: { outlineLevel: 1, keepNext: true, spacing: { line: 240, lineRule: LineRuleType.AUTO, before: 60, after: 0 } } }
      }
    },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1600, bottom: 980, left: 1253, right: 1253, header: 300, footer: 200 } } },
      headers: { default: brandHeader(region) },
      footers: { default: letterheadFooter(region) },
      children: body
    }] });
}
export const fileName = (kind: DocKind, c: Camp) => `${c.docCode.replace(/[^\w-]+/g, '_')}_${{ program: 'โปรแกรม', quotation: 'ใบเสนอราคา', booking: 'ขอราคาโรงแรม', runsheet: 'Rundown_INTERNAL' }[kind]}_${c.school.replace(/\s+/g, '')}.docx`;



/* ===================== มาตรฐานกิจกรรม (ฐานข้อมูล Notion ของทีม) =====================
 * โครงมาตรฐาน 1 กิจกรรม = ชื่อ · หมวด · สถานะ · สไลด์ · Sheet lab · อุปกรณ์ต่อกลุ่ม · อุปกรณ์ส่วนกลาง
 * "พร้อมใช้" = ครบ 4 ข้อ: สถานะ "เสร็จ" + มีสไลด์ + มี Sheet lab + มีเช็คลิสต์อุปกรณ์
 * วัตถุประสงค์/ขั้นตอน/เวลา/ระดับชั้น ยังไม่มีใน Notion → แสดงว่า "ยังไม่มี" ห้ามเติมเอง
 * ใช้ในเอกสารภายใน (Run-down) เท่านั้น — ไม่ขึ้นเอกสารลูกค้า */
export const notionUrl = (a: NotionActivity) => `https://app.notion.com/p/${a.id}`;
const nkey = (s: string) => String(s || '').toLowerCase().replace(/part\.?\s*\d+/g, '').replace(/[^a-z0-9฀-๿]+/g, '');
export type StdLevel = 'พร้อมใช้' | 'บางส่วน' | 'ยังไม่มีข้อมูล';
export function actStandard(a: NotionActivity): { checks: { label: string; ok: boolean }[]; score: number; level: StdLevel } {
  const checks = [
    { label: 'สถานะ "เสร็จ" ใน Notion', ok: a.status === 'เสร็จ' },
    { label: 'สไลด์กิจกรรม', ok: a.slides.length > 0 },
    { label: 'Sheet lab / ใบงาน', ok: a.lab },
    { label: 'เช็คลิสต์อุปกรณ์', ok: a.perGroup.length + a.shared.length > 0 }
  ];
  const score = checks.filter(c => c.ok).length;
  return { checks, score, level: score === 4 ? 'พร้อมใช้' : (a.empty || score === 0) ? 'ยังไม่มีข้อมูล' : 'บางส่วน' };
}
// จับคู่ชื่อในกำหนดการ/คลังกิจกรรม → กิจกรรมมาตรฐานใน Notion (คีย์ยาวสุดชนะ กัน Roller box ↔ Roller coaster สับกัน)
const NOTION_KEYS = NOTION_ACTIVITIES.flatMap(a => [a.name, ...(a.aliases || [])].map(n => ({ k: nkey(n), a }))).filter(x => x.k.length >= 5).sort((x, y) => y.k.length - x.k.length);
export function notionActFor(title: string): NotionActivity | null {
  const t = nkey(title); if (!t) return null;
  for (const { k, a } of NOTION_KEYS) if (t.includes(k)) return a;
  return null;
}
// กิจกรรมในกำหนดการที่มีมาตรฐาน Notion (ไม่ซ้ำ) + เวลาที่ใช้
export function notionActsInPlan(plan: Plan): { a: NotionActivity; when: string[] }[] {
  const m = new Map<string, { a: NotionActivity; when: string[] }>();
  for (const d of plan.days) for (const r of d.items) {
    const a = notionActFor(r.title); if (!a) continue;
    const e = m.get(a.id) || { a, when: [] }; e.when.push(`วันที่ ${d.day} ${r.time}`); m.set(a.id, e);
  }
  return [...m.values()];
}

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
