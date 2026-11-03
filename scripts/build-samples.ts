// สร้างไฟล์ .docx ตัวอย่าง + sample.export.json ลงโฟลเดอร์ samples/
// รันผ่าน: npm run samples  (bundle ด้วย esbuild แล้วรันด้วย node)
import { Packer } from 'docx';
import * as fs from 'fs';
import * as path from 'path';
import {
  buildDoc, fromPreset, blankCamp, defaultActs, parseBrief, DocKind, Camp
} from '../src/eqcamp-core';

const OUT = path.resolve(process.cwd(), 'samples');

async function write(name: string, kind: DocKind, camp: Camp) {
  fs.writeFileSync(path.join(OUT, name), await Packer.toBuffer(buildDoc(kind, camp)));
  console.log('  ✓', name);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  console.log('สร้างไฟล์ตัวอย่าง →', OUT);

  // 1-4: ชุด PL0109 (คณิต) ครบ 4 เอกสาร
  const pl = fromPreset('pl0109');
  await write('1_program_PL0109_math.docx', 'program', pl);
  await write('2_quotation_PL0109.docx', 'quotation', pl);
  await write('3_hotel-request_PL0109.docx', 'booking', pl);
  await write('4_runsheet_internal_PL0109.docx', 'runsheet', pl);

  // 5: ค่าย AI 3 วัน (เติมกิจกรรมเต็มทุกช่อง)
  const ai = blankCamp();
  Object.assign(ai, { subject: 'ai', docCode: 'PL 0115/2569', school: 'โรงเรียนเทคโนโลยีสาธิต', level: 'ม.2-3',
    students: 80, teachers: 6, days: 3, nights: 2, dates: 'วันที่ 2 – 4 ธันวาคม 2569',
    province: 'ระยอง', venue: 'โรงแรมโกลเด้น ซิตี้ ระยอง', venueVisit: 'ศูนย์การเรียนรู้ด้านพลังงาน / สถานแสดงพันธุ์สัตว์น้ำระยอง',
    startTime: '07.00', travelHours: 3.5, normalPrice: 4290, specialPrice: 3190, costPerPerson: 1950 });
  ai.activityIds = defaultActs('ai');
  await write('5_program_AI_fully-filled.docx', 'program', ai);

  // 6: ค่ายอังกฤษ 4 วัน (มีกิจกรรม "(ต่อยอด)")
  const en = blankCamp();
  Object.assign(en, { subject: 'english', docCode: 'PL 0116/2569', school: 'โรงเรียนนานาชาติวิทย์', level: 'ม.1-3',
    students: 60, teachers: 5, days: 4, nights: 3, dates: 'วันที่ 8 – 11 ธันวาคม 2569',
    province: 'เลย', venue: 'โรงแรมเชียงคานฮิลล์รีสอร์ท', venueVisit: 'ถนนวัฒนธรรมเชียงคาน / ชมวิวทะเลหมอก ณ ภูทอก',
    startTime: '06.30', travelHours: 7, normalPrice: 5990, specialPrice: 4590, costPerPerson: 2800 });
  en.activityIds = defaultActs('english');
  await write('6_program_English_4days.docx', 'program', en);

  // 7-8: จากบรีฟที่มีสถานที่ใหม่ (พิสูจน์สถานที่ตามบรีฟ)
  const b = parseBrief('PL 0130/2569 โรงเรียนบ้านหนองแวง ม.4-5 จำนวน 100 คน ครู 8 คน ค่าย STEAM 2 วัน 1 คืน วันที่ 5 – 6 มกราคม 2570 ณ ภูเรือระเบียงดาว รีสอร์ท จังหวัดเลย ราคาปกติ 3,900 ลดเหลือเพียง 2,990', blankCamp());
  await write('7_program_brief-new-venue.docx', 'program', b);
  await write('8_hotel-request_brief-new-venue.docx', 'booking', b);

  // 9: หลักสูตรจริงจากคลัง — ค่ายวิทยาศาสตร์ทางทะเล (CUR-003) กิจกรรมจริงเฉพาะธีม
  const sea = parseBrief('PL 0140/2569 โรงเรียนสาธิตชลบุรี ม.1-3 จำนวน 90 คน ครู 7 คน ค่ายวิทยาศาสตร์และสิ่งแวดล้อมทางทะเล 2 วัน 1 คืน วันที่ 15 – 16 มกราคม 2570 ณ โรงแรมพัทยาบีช จังหวัดชลบุรี ราคาปกติ 3,900 ลดเหลือเพียง 2,990', blankCamp());
  await write('9_program_CUR003_marine.docx', 'program', sea);

  // sample.export.json (ตาม schema.json)
  const snap = { _app: 'EQ Camp Generator', _v: 2, savedAt: new Date().toISOString(),
    camp: { ...pl, actImgs: [], venueImgs: [] }, customVenues: [], brief: '' };
  fs.writeFileSync(path.join(OUT, 'sample.export.json'), JSON.stringify(snap, null, 2));
  console.log('  ✓ sample.export.json');
  console.log('เสร็จ');
})();
