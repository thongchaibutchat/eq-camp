// กิจกรรมจริงของทีมที่ยังไม่อยู่ในคลัง MASTER (src/eqcamp-data.ts ที่ generate จากชีต MASTER)
// ที่มา = ไฟล์ของทีมใน Drive (1C5XXMbaIZa5lhSCxhbGszSCITXn_qQU8) ตามที่ถอดไว้ใน data/activity-catalog/
//   · drive-activity-lists.json → "Activity English Camp 1/2.jpg" (ภาพรวม 23 กิจกรรม) + การ์ดรายละเอียด 1–28.jpg
//   · course-templates.raw.json → โปรแกรมจริง PL ENG 0104 (3 วัน 2 คืน)
// ชื่อคัดลอกตามต้นฉบับทุกตัวอักษร — ห้ามแต่งชื่อใหม่ ห้ามแก้คำสะกด (แก้ได้เฉพาะผ่าน data/typo-fixes.json)
// เพิ่ม 23 พ.ย. 2569: ผู้ใช้แจ้งว่ากิจกรรมภาษาอังกฤษในเว็บน้อย ค่ายยาวซ้ำกันเยอะ (คลัง MASTER มี 16 รายการ ซ้ำกันเอง 1)

export interface ExtraActivity {
  id: string; course: string; family: string; kind: 'opening' | 'core' | 'night' | 'recreation' | 'closing';
  title: string;
  /** แหล่งที่พบในไฟล์ทีม (ไว้ตรวจย้อน) */
  src: string;
  /** เวลาที่การ์ดรายละเอียดระบุ (นาที) — ไม่มีการ์ด = ว่าง */
  minutes?: string;
  /** ประเด็นที่ทีมควรยืนยัน */
  note?: string;
}

const ENG_LIST = 'Drive: English Camp/รายชื่อกิจกรรม (ภาพรวม 23 กิจกรรม)';
const ENG_CARD = (n: string) => `Drive: English Camp/รายชื่อกิจกรรม/รายละเอียดกิจกรรม ${n}.jpg`;
const ENG_O32 = 'โปรแกรมจริง PL ENG 0104 3 วัน 2 คืน';

export const EXTRA_REF_ACTIVITIES: ExtraActivity[] = [
  { id: 'ref-english-x-whoami', course: 'PL ENG 0104', family: 'english', kind: 'core', title: 'Who am I?', src: `${ENG_LIST} · ${ENG_CARD('23/24')}`, minutes: '25 - 30' },
  { id: 'ref-english-x-theline', course: 'PL ENG 0104', family: 'english', kind: 'core', title: 'The Line', src: ENG_LIST },
  { id: 'ref-english-x-leftright', course: 'PL ENG 0104', family: 'english', kind: 'core', title: 'Left or Right', src: `${ENG_LIST} · ${ENG_CARD('25/26')}`, minutes: '40 - 60' },
  { id: 'ref-english-x-runreadwrite', course: 'PL ENG 0104', family: 'english', kind: 'core', title: 'Run Read & Write', src: `${ENG_LIST} · ${ENG_CARD('7/8')}`, minutes: '25 - 30' },
  { id: 'ref-english-x-davinci', course: 'PL ENG 0104', family: 'english', kind: 'core', title: 'Davinci', src: ENG_LIST },
  { id: 'ref-english-x-snakes', course: 'PL ENG 0104', family: 'english', kind: 'core', title: 'Snakes and Ladders Game', src: `${ENG_LIST} · ${ENG_CARD('27/28')}`, minutes: '40 - 60' },
  { id: 'ref-english-x-sentence', course: 'PL ENG 0104', family: 'english', kind: 'core', title: 'Sentence Survival', src: ENG_LIST },
  { id: 'ref-english-x-gearth', course: 'PL ENG 0104', family: 'english', kind: 'core', title: 'Google Earth', src: ENG_LIST },
  { id: 'ref-english-x-gmap', course: 'PL ENG 0104', family: 'english', kind: 'core', title: 'Google Map', src: ENG_LIST },
  { id: 'ref-english-x-bingo', course: 'PL ENG 0104', family: 'english', kind: 'core', title: 'Bingo', src: ENG_LIST },
  { id: 'ref-english-x-wordhunt', course: 'PL ENG 0104', family: 'english', kind: 'core', title: 'Word Hunt', src: ENG_LIST },
  { id: 'ref-english-x-silence', course: 'PL ENG 0104', family: 'english', kind: 'core', title: 'Silence Tale', src: ENG_CARD('17/18'), minutes: '25 - 30', note: 'มีการ์ดรายละเอียด แต่ไม่อยู่ในภาพรวม 23 กิจกรรม — ให้ทีมยืนยันว่ายังใช้อยู่' },
  // ภาคค่ำ/สันทนาการ ที่อยู่ในโปรแกรมจริงแต่ไม่อยู่ในคลัง MASTER — ให้ค่ายที่จัดอัตโนมัติใช้กิจกรรมจริงแทน "English Night Show" กลางซ้ำทุกคืน
  { id: 'ref-english-x-mission', course: 'PL ENG 0104', family: 'english', kind: 'night', title: 'Mission Game (Critical Thinking)', src: `${ENG_O32} (คืนที่ 1)` },
  { id: 'ref-english-x-talent', course: 'PL ENG 0104', family: 'english', kind: 'night', title: '“The Talent Show” (Collaborative and Leadership Skills.)', src: `${ENG_O32} (คืนสุดท้าย) · 2 วัน 1 คืน` },
  { id: 'ref-english-x-reboot', course: 'PL ENG 0104', family: 'english', kind: 'recreation', title: 'Reboot Your Brain.', src: `${ENG_O32} (เช้าวันที่ 2)` }
];

// รายการในคลัง MASTER ที่เป็นกิจกรรมเดียวกัน (ชื่อต่างกันเล็กน้อย) → รวมเป็นรายการเดียว (id เดิม → id ที่เก็บไว้)
// "Crossword." กับ "Crossword Game." = กิจกรรม Crossword เดียวกัน (การ์ด 3/4) — เก็บ "Crossword Game." ที่โปรแกรมจริงใช้
export const MERGED_ACTIVITY_IDS: Record<string, string> = {
  'ref-english-7d2dd69231': 'ref-english-de375cdace'
};
