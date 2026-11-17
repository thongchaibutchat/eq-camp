// ฐานข้อมูลกิจกรรม STEM ของทีม (Notion) — ถอดจากหน้า Notion จริงทีละหน้า วันที่ 17 พ.ย. 2569
// ต้นทาง: https://app.notion.com/p/3aadd28fb875801ca857dd8e33dbc073  (data source collection://3aadd28f-b875-80d3-bed4-000b667fea2c)
// กติกา: คัดลอกตามต้นฉบับ (รวมคำสะกดเดิม) — ห้ามเดา/เติมสิ่งที่หน้า Notion ไม่มี
//   - หน้าที่มีแต่หัวข้อแม่แบบเปล่า (ความเป็นมา/การวิเคราะห์/…) = empty: true
//   - lab = มีฐาน "Sheet lab" หรือไฟล์ใบงานแนบในหน้า (ชื่อไฟล์ใบงานดึงไม่ได้ด้วยสิทธิ์ Notion ปัจจุบัน)
//   - perGroup = "อุปกรณ์ต่อกลุ่ม/ประจำทีม" · shared = "อุปกรณ์ส่วนกลาง (ใช้ร่วมกัน)"
// ข้อมูลนี้เป็นเครื่องมือภายใน (เช็คลิสต์อุปกรณ์) — ไม่มีราคา/ต้นทุน ใช้ในเอกสารภายใน (Run-down) เท่านั้น
// อัปเดต: เปิดหน้ากิจกรรมใน Notion → แก้ไฟล์นี้ให้ตรง (หรือให้ Claude ดึงใหม่ผ่าน Notion connector) → npm run stress

export type NotionStatus = 'เสร็จ' | 'กำลังดำเนินการ' | 'ยังไม่ได้เริ่ม';
export type NotionCat = 'STEM' | 'Math camp' | 'Science' | 'Technology';
export interface Equip { name: string; qty: string }
export interface NotionActivity {
  id: string;            // id หน้า Notion
  name: string;          // ชื่อกิจกรรมตาม Notion (ตัดอีโมจิ)
  cats: NotionCat[];
  status: NotionStatus;
  edited: string;        // แก้ไขล่าสุด (YYYY-MM-DD)
  slides: string[];      // ลิงก์สไลด์ Canva
  lab: boolean;          // มี Sheet lab / ใบงาน
  perGroup: Equip[];
  shared: Equip[];
  aliases?: string[];    // ชื่อที่ใช้ในคลังกิจกรรม/แม่แบบโปรแกรม (สำหรับจับคู่)
  empty?: boolean;       // หน้ายังเป็นแม่แบบเปล่า
  note?: string;         // ข้อสังเกตจากการตรวจข้อมูล
}
export const NOTION_DB_URL = 'https://app.notion.com/p/3aadd28fb875801ca857dd8e33dbc073';
export const NOTION_SYNCED = '17 พ.ย. 2569';
const q = (name: string, qty = ''): Equip => ({ name, qty });

const CITY_KIT: Equip[] = [q('ฟิวเจอร์บอร์ด A3', '1 แผ่น'), q('หลอดไฟ LED 3V', '4 ดวง'), q('โฟโต้บอร์ด', '1 อัน'), q('รางถ่าน', '2 อัน'), q('ถ่าน AA', '4 ก้อน'), q('สวิตช์ไฟ 2 ขา', '2 อัน'), q('สายไฟดำแดง', '4 เส้น'), q('มอเตอร์ 3V', '1 ตัว'), q('ใบพัด 4 แฉก', '1 อัน'), q('โมเดลสัตว์ ต้นไม้ บ้าน', 'กลุ่มละ 5 ตัว'), q('ดินน้ำมัน', '2 ก้อน'), q('ขนมจาจาโฮม', '1 ซอง'), q('ตะเกียบ', '10 คู่'), q('ไม้ไอติม', '1 แพ็ค'), q('กระดาษลัง A4', '1 อัน'), q('ลูกปัด', '10 เม็ด'), q('กาวลาเท็กซ์', '1 กระป๋อง'), q('กระดาษน้ำตาล A4', '2 แผ่น'), q('สก็อตไบร์ท', '2 ชิ้น'), q('กระดาษฟอยล์สีเงิน A5', '1 แผ่น'), q('ลวดดัด DIY หลากสี', '12 เส้น')];
const CITY_SHARED: Equip[] = [q('ปืนกาว', 'ทั้งหมด'), q('ไส้กาวร้อน', 'ละ 3 แท่ง')];

export const NOTION_ACTIVITIES: NotionActivity[] = [
  { id: '3aadd28fb875809c8b5ae0361455f540', name: '3D Wonder', cats: ['Science'], status: 'ยังไม่ได้เริ่ม', edited: '2026-09-21', slides: [], lab: false, perGroup: [], shared: [], empty: true },
  { id: '3aadd28fb875805ea095edf6da200e8e', name: 'Alien food', cats: ['STEM'], status: 'ยังไม่ได้เริ่ม', edited: '2026-09-21', slides: [], lab: false, perGroup: [], shared: [], empty: true },
  { id: '3aadd28fb87580d09f85e5d784c7b448', name: 'Baking rocket', cats: ['STEM'], status: 'เสร็จ', edited: '2026-09-21', slides: [], lab: false, aliases: ['Baking Rocket'],
    perGroup: [q('เบกกิ้งโซดา', '1 กระปุก (เก็บครึ่งกระปุก)'), q('เทปพันสายไฟ', '1 ม้วน'), q('ฟิวเจอร์บอร์ด A4', '1 แผ่น'), q('ขวดบีบใส่น้ำส้มสายชู', '1 ขวด (มีน้ำส้มสายชูเต็มขวด)'), q('กระดาษทิชชู่', '6 แผ่น'), q('ถุงมือยาง', '1 คู่'), q('เทปหนังไก่', '1 ม้วน'), q('หนังยางวง', '5 วง'), q('ถุงซิปล็อค', '1 ถุง'), q('ตะเกียบ', '2 คู่'), q('ขวดน้ำอัดลม', '1 ขวด'), q('ช้อนพลาสติก', '1 อัน'), q('กระดาษสี A4', '2 แผ่น')],
    shared: [q('ถังขยะ / กะละมัง', '1 ใบ'), q('กรวยใส่น้ำส้มสายชู', '1 อัน'), q('น้ำส้มสายชู', '1 แกลลอน'), q('ฐานปล่อย (ฟิวเจอร์บอร์ดวงกลมติดกับต้าย 3 เมตร)', '1 ชุด')] },
  { id: '3aadd28fb87580a6b4b8dec19415023d', name: 'Bridge building', cats: ['STEM', 'Math camp'], status: 'เสร็จ', edited: '2026-09-21', slides: ['https://canva.link/0gtk4dgvy0yq1j2'], lab: true, aliases: ['Bridge Building'],
    perGroup: [q('ตะเกียบ', '50 คู่'), q('เทปหนังไก่', '2 ม้วน'), q('เชือกขาว', '3 ม้วน'), q('ตระกร้า', '1 อัน/การทดลอง'), q('ตะขอตัว S', '1 อัน/การทดลอง'), q('ขวดน้ำดื่ม 600 ml', '12 ขวด/การทดลอง')], shared: [] },
  { id: '3aadd28fb87580308410c09831cc7ca3', name: 'Bubble machine', cats: ['STEM'], status: 'เสร็จ', edited: '2026-09-30', slides: ['https://canva.link/rcgt1l1ds979sd5'], lab: true, aliases: ['Bubble Machine'],
    perGroup: [q('ฟิวเจอร์บอร์ด A4', '1 แผ่น'), q('สายไฟดำ', '2 เส้น'), q('สายไฟแดง', '2 เส้น'), q('สวิตช์ไฟ 2 ขา', '1 อัน'), q('รางถ่าน', '2 อัน'), q('มอเตอร์ 3V', '1 อัน'), q('มอเตอร์ 6V', '1 อัน'), q('ใบพัด', '1 อัน'), q('หลอด', '4 อัน'), q('ฝาขวด', '1 อัน'), q('ห่วงฝาขวด (เฉพาะวงกลม)', '8 อัน'), q('ถ่าน AA', '4 ก้อน')],
    shared: [q('ปืนกาว', 'ทั้งหมด'), q('ไส้ปืนกาว', 'ทั้งหมด'), q('กล่องพลาสติกใสแนวนอน', 'ทั้งหมด'), q('น้ำยาทำฟองสบู่', 'ทั้งหมด')] },
  { id: '3aadd28fb875807197c9cb819326e8e5', name: 'Bungee jump', cats: ['STEM', 'Math camp'], status: 'ยังไม่ได้เริ่ม', edited: '2026-09-21', slides: [], lab: false, perGroup: [], shared: [], empty: true, aliases: ['Bungee Jump'] },
  { id: '3aadd28fb87580f09078d4acbd465706', name: 'Burglar Alarm', cats: ['Technology'], status: 'ยังไม่ได้เริ่ม', edited: '2026-09-21', slides: [], lab: false, perGroup: [], shared: [], empty: true },
  { id: '3aadd28fb8758063926dc859047ebd69', name: 'Cotton candy', cats: ['STEM'], status: 'กำลังดำเนินการ', edited: '2026-09-21', slides: ['https://canva.link/oa1bynlj7t0qe1b', 'https://canva.link/41z5dqan40ehto8'], lab: true, perGroup: [], shared: [], aliases: ['Cotton Candy'] },
  { id: '3aadd28fb875807198ced1eb6316ded6', name: 'Earth quake', cats: ['STEM'], status: 'เสร็จ', edited: '2026-09-21', slides: ['https://canva.link/56xrtwgf0xzfqmx', 'https://canva.link/40m492p6m5k89q5'], lab: true, aliases: ['Earthquake', 'แผ่นดินไหว'],
    perGroup: [q('ตะเกียบไม้ไผ่', '50 คู่'), q('หลอดดูดน้ำแบบมีข้องอ', '20 อัน'), q('เทปหนังไก่', '1 ม้วน'), q('กาวร้อน (ขวด)', '1 ขวด'), q('ดินน้ำมัน', '3 ก้อน'), q('เชือก', '1 ม้วน')],
    shared: [q('เครื่องสั่นออกกำลังกาย', '1 เครื่อง'), q('ฟิวเจอร์บอร์ด A3 สีชมพู', '1 อัน'), q('ไม้กระดาน A3', '1 อัน')] },
  { id: '3aadd28fb87580819798eaaabbdcbfbb', name: 'Hoover power', cats: ['STEM'], status: 'เสร็จ', edited: '2026-09-21', slides: ['https://canva.link/38tvs4pcizn5lrc'], lab: true, aliases: ['Hoover Power'],
    perGroup: [q('ขวดน้ำพลาสติกขนาด 1.5 ลิตร', '1 ขวด'), q('ท่อเฟล็ก', '1 ท่อ'), q('ผ้าตสข่าย', '1 ผืน'), q('มอเตอร์12V', '1 ชิ้น'), q('ใบพัด', '1 ใบ'), q('สายไฟแดง', '4 เส้น'), q('สายไฟดำ', '4 เส้น'), q('หัวแปลงDC ตัวเมีย', '1 ตัว'), q('ตะเกียบ', '2 คู่')],
    shared: [q('Adaptor', 'ทั้งหมด'), q('ปืนกาว', 'ทั้งหมด'), q('ไส้ปืนกาว', 'ทั้งหมด'), q('หัวแร้งพร้อมขาตั้ง', 'ทั้งหมด'), q('กระดาษฝุ่น'), q('ครีมปลอกสายไฟ')] },
  { id: '3aadd28fb87580dfaec9f0888386c9cc', name: 'Hydrolic arms', cats: ['STEM'], status: 'ยังไม่ได้เริ่ม', edited: '2026-10-14', slides: [], lab: false, perGroup: [], shared: [], empty: true, aliases: ['Hydraulic arm'] },
  { id: '3aadd28fb87580fe9187d82d1cbaa0a2', name: 'Minilab Activities', cats: ['Science'], status: 'กำลังดำเนินการ', edited: '2026-08-25', slides: ['https://canva.link/nx8rscrsnzncoe7', 'https://canva.link/s524losmu4qmhjo'], lab: true, perGroup: [], shared: [] },
  { id: '3aadd28fb8758050a009dc66479d742c', name: 'Roller box', cats: ['STEM'], status: 'เสร็จ', edited: '2026-09-21', slides: ['https://canva.link/6k0ii5q070e1499'], lab: true,
    perGroup: [q('กล่องลัง', '1 กล่อง'), q('ดินน้ำมัน', '3 ก้อน'), q('ไม้ไอติม', '2 แพ็ค'), q('ตะเกียบ', '5 คู่'), q('ไม้เสียบลูกชิ้น', '10 อัน'), q('หนังยางเล็ก', '5 เส้น'), q('ไซริงค์ขนาด', '8 อัน'), q('สายออกซิเจนขนาด', '4 เส้น'), q('เทปใส', '1 อัน'), q('เทปหนังไก่', '1 อัน'), q('กาวร้อน (ขวด)', '1 ขวด')], shared: [] },
  { id: '3aadd28fb87580e0abb7eede82126a1e', name: 'Roller coaster', cats: ['STEM'], status: 'เสร็จ', edited: '2026-09-21', slides: [], lab: false, aliases: ['Roller Coaster'],
    perGroup: [q('ฉนวนหุ้มท่อแอร์สีดำ', '2 เส้น'), q('เทปพันสายไฟ', '1 ม้วน'), q('เทปใส', '1 ม้วน'), q('ตะเกียบ', '8 คู่'), q('เทปหนังไก่', '1 ม้วน'), q('ไม้บรรทัด', '1 อัน'), q('ลูกแก้ว', '2 ลูก'), q('sheet lab', '1 ชุด')], shared: [],
    note: 'เช็คลิสต์มี "sheet lab 1 ชุด" แต่ยังไม่มีไฟล์ใบงานในหน้า Notion' },
  { id: '3aadd28fb87580e0bf13f95f0c16c54c', name: 'Slurpee', cats: ['Science'], status: 'กำลังดำเนินการ', edited: '2026-09-21', slides: ['https://canva.link/o34m7fjglr90ek4'], lab: true,
    perGroup: [q('น้ำอัดลม', '1 ขวด'), q('เกลือ', '1 แก้ว'), q('ถัง', '1 ถัง')], shared: [q('น้ำแข็ง')] },
  { id: '3aadd28fb8758065b8bdc16a11abe526', name: 'Smart city', cats: ['STEM'], status: 'เสร็จ', edited: '2026-09-16', slides: ['https://canva.link/nxpytjs96pol5bn'], lab: true, perGroup: CITY_KIT, shared: CITY_SHARED },
  { id: '3aadd28fb8758075a582c9ad7e65474a', name: 'Smart farm', cats: ['STEM', 'Math camp', 'Technology'], status: 'เสร็จ', edited: '2026-09-16', slides: ['https://canva.link/ajz361msnef1ovc'], lab: true, perGroup: CITY_KIT, shared: CITY_SHARED,
    note: 'รายการอุปกรณ์ตรงกับ Smart city ทุกข้อ (ภาพเช็คลิสต์ไฟล์เดียวกัน) — ควรตรวจใน Notion ว่าคัดลอกมาหรือใช้ชุดเดียวกันจริง' },
  { id: '3c0dd28fb875800c9e8dd55d8750fe0f', name: 'Titanic', cats: ['STEM'], status: 'ยังไม่ได้เริ่ม', edited: '2026-09-21', slides: [], lab: false, perGroup: [], shared: [], empty: true },
  { id: '3aadd28fb8758003b21ac32450455b0b', name: 'Wonderful light', cats: ['STEM'], status: 'เสร็จ', edited: '2026-09-21', slides: ['https://canva.link/ohk6cm6l0d3isjc', 'https://canva.link/4lnh6p9mrska6j5'], lab: true, aliases: ['Wonderful Light'],
    perGroup: [q('สวิตช์ไฟ 2 ขา', '1 อัน'), q('สายไฟดำแดง', '4 ชุด'), q('เทปใส', '2 ม้วน'), q('หุ่นไม้', '2 ตัว'), q('กล่องลัง/กระดาษ', '1 อัน'), q('ผ้าขาวบาง', '1 อัน'), q('คีมปอกสายไฟ', '1 อัน'), q('สายรุ้งตกแต่ง', '1 เส้น'), q('โมเดลตกแต่ง', 'จัดเซ็ตตามชิ้น (ต้นไม้/รั้ว/บ้าน ฯลฯ)'), q('หัวแปลง DC ตัวเมีย', '1 อัน')], shared: [] },
  { id: '3aadd28fb8758010b09bc6e0d4ca7ff1', name: 'รถแข่งพลังไฟฟ้าสถิต', cats: ['STEM'], status: 'เสร็จ', edited: '2026-09-21', slides: [], lab: false,
    perGroup: [q('ท่อ PVC', '1 ท่อน'), q('กระป๋องน้ำอัดลม', '1 กระป๋อง'), q('ไม้บัลซ่า', '4 อัน'), q('ไม้เสียบลูกชิ้น', '6 ไม้'), q('หลอดดูดยาว', '4 หลอด'), q('เทปหนังไก่', '1 ม้วน'), q('ฝาขวด', '2 ฝา'), q('ฟิวเจอร์บอร์ด A4', '1 แผ่น'), q('ลูกโป่ง', '1 ลูก'), q('ผ้าเช็ดหน้าแห้ง', '1 ผืน')],
    shared: [q('เทปกาวสีแดง (สำหรับทำสนามแข่งขัน)', '1 ม้วน')] },
  { id: '3aadd28fb8758063ab56e1fe93c0a92f', name: 'ลูกโป่งน้ำ ล้มโดมิโน่', cats: ['Science'], status: 'ยังไม่ได้เริ่ม', edited: '2026-07-27', slides: [], lab: false, perGroup: [], shared: [], empty: true, aliases: ['ลูกโป่งน้ำล้มโดมิโน่'] }
];
