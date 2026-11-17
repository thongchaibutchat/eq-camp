// สร้างไฟล์ .docx ตัวอย่าง + sample.export.json ลงโฟลเดอร์ samples/
// รันผ่าน: npm run samples  (bundle ด้วย esbuild แล้วรันด้วย node)
import { Packer } from 'docx';
import * as fs from 'fs';
import * as path from 'path';
import { packDocx,
  buildDoc, fromPreset, blankCamp, defaultActs, parseBrief, DocKind, Camp,
  buildSchedule, subjectPool, photoIdsFor, photoCaption, venuePhotoSetFor, venueCaption, Img, TEMPLATES
} from '../src/eqcamp-core';
// ภาพจากไฟล์ของค่ายนั้น (web/photos) — เหมือนที่เว็บโหลดให้
const withPhotos = (c: Camp): Camp => {
  const rd = (id: string) => new Uint8Array(fs.readFileSync(path.resolve(process.cwd(), 'web/photos', id + '.jpg')));
  const act: Img[] = photoIdsFor(c).map((id, i) => ({ data: rd(id), caption: photoCaption(c, i), src: id }));
  const vs = venuePhotoSetFor(c.venue);
  const ven: Img[] = vs ? vs.photos.map((id, i) => ({ data: rd(id), caption: venueCaption(vs.name, i), src: id })) : [];
  return { ...c, actImgs: act, venueImgs: ven };
};

const OUT = path.resolve(process.cwd(), 'samples');

async function write(name: string, kind: DocKind, camp: Camp) {
  fs.writeFileSync(path.join(OUT, name), Buffer.from(await packDocx(buildDoc(kind, camp))));
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

  // 10: หลักสูตรจริง CUR-014 (อังกฤษ) — ฝังภาพจริงของทีม + เลือกกิจกรรมรายช่วง (per-slot override)
  const eng = parseBrief('PL 0150/2569 โรงเรียนสาธิตนานาชาติ ม.1-3 จำนวน 110 คน ครู 8 คน ค่ายภาษาอังกฤษ English Camp 2 วัน 1 คืน วันที่ 20 – 21 มกราคม 2570 ณ โรงแรมเชียงคานฮิลล์รีสอร์ท จังหวัดเลย ราคาปกติ 3,900 ลดเหลือเพียง 2,990', blankCamp());
  Object.assign(eng, withPhotos(eng)); // ภาพจากไฟล์โปรแกรมจริงของค่ายอังกฤษ
  // เลือกกิจกรรมช่องแรกด้วยมือ: หยิบ core ตัวที่ 2 ในคลังมาใส่ช่อง #1 (พิสูจน์ per-slot picker)
  const cores = subjectPool(eng).filter(a => a.kind === 'core');
  if (cores[1]) eng.coreSlotIds = [cores[1].id];
  await write('10_program_CUR014_english_photos_slot.docx', 'program', eng);

  // 11-14: แม่แบบจริงของทีม (หลักสูตร + ระยะเวลาตรง) — ข้อมูลบรีฟแทนชื่อโรงเรียน/ที่พัก/ปีของงานเดิม + ภาพจากไฟล์ของค่ายนั้น
  const t1 = parseBrief('โรงเรียนบ้านหนองแวง ม.1-3 จำนวน 80 คน ครู 6 คน ค่ายคณิตศาสตร์ Math Camp 2 วัน 1 คืน วันที่ 10 – 11 กุมภาพันธ์ 2570 ณ โรงแรมพัทยาบีช จังหวัดชลบุรี', blankCamp());
  await write('11_program_TEMPLATE_MAT_2d1n.docx', 'program', withPhotos(t1));
  const t2 = parseBrief('โรงเรียนกาญจนานุเคราะห์ ม.4-5 จำนวน 72 คน ครู 6 คน ค่ายธรณีวิทยา 3 วัน 2 คืน วันที่ 3 – 5 มีนาคม 2570 ณ ออโรร่า รีสอร์ท จังหวัดกาญจนบุรี ราคาปกติ 5,290 ลดเหลือเพียง 4,590', blankCamp());
  await write('12_program_TEMPLATE_GEO_3d2n.docx', 'program', withPhotos(t2));
  const t3 = parseBrief('โรงเรียนสาธิตชลบุรี ม.1-3 จำนวน 60 คน ครู 5 คน ค่ายภาษาจีน 1 วัน ไป-กลับ วันที่ 20 มกราคม 2570 ราคาปกติ 1,290 ลดเหลือเพียง 990', blankCamp());
  await write('13_program_TEMPLATE_CHI_day.docx', 'program', withPhotos(t3));
  const t4 = parseBrief('โรงเรียนพัทยาวิทยา ม.1-3 จำนวน 90 คน ครู 7 คน ค่ายวิทยาศาสตร์และสิ่งแวดล้อมทางทะเล 2 วัน 1 คืน วันที่ 15 – 16 มกราคม 2570 ณ Bella Villa Cabana Pattaya จังหวัดชลบุรี ราคาปกติ 3,190 ลดเหลือเพียง 2,590', blankCamp());
  await write('14_program_TEMPLATE_SEA_pattaya.docx', 'program', withPhotos(t4));
  await write('14b_booking_TEMPLATE_SEA_pattaya.docx', 'booking', withPhotos(t4));
  // 15: บรีฟจริงแบบเขียนอิสระ (เครื่องหมายคำพูด, ขึ้นบรรทัดกลางวลี, เลขไทยในชื่อโรงเรียน, "จัดที่", "ราคาขายปกติ", ชื่อโรงแรมภาษาไทย → ภาพโรงแรมในไฟล์ทีม)
  const t5 = parseBrief(`"โรงเรียนบดินทรเดชา (สิงห์ สิงหเสนี) ๔ "  ส่วนนี้คือชื่อโรงเรียน
ต้องการติดต่อจัด "ค่าย Robotics Camp ให้นักเรียนห้องเรียนพิเศษ เป็นเวลา 3
วัน 2 คืน " ค่ะ
" นักเรียนจำนวน 18 คน และครูผู้ควบคุม 3 คน " ค่ ะ
จัดกิจกรรมไว้ประมาณ " วันที่ 14-16 ธ.ค. 2569 "
จัดที่ " โรงแรมกาสะรองรีสอร์ทพัทยา "
" ราคาขายปกติ 5990 ลดเหลือเพียง 4790 บาทต่อท่าน "`, blankCamp());
  await write('15_program_BRIEF_freeform_robotics.docx', 'program', withPhotos(t5));
  // 16: ค่ายหลัก STEM 2 วัน 1 คืน + กิจกรรมเสริมภาษาอังกฤษ (+300 บ./ท่าน) และภาษาจีน (รวมในราคา) — อ่านจากบรีฟ
  const t6 = parseBrief('โรงเรียนสตรีวิทยา ม.2 จำนวน 80 คน ครู 6 คน ค่าย STEM 2 วัน 1 คืน วันที่ 20-21 ม.ค. 2570 ณ โรงแรมจันทรา รีสอร์ท จังหวัดนครนายก ราคาปกติ 4590 ลดเหลือ 3790 บาท เสริมภาษาอังกฤษ และภาษาจีน', blankCamp());
  t6.addons = (t6.addons || []).map(a => a.code === 'PL ENG 0104' ? { ...a, price: 300 } : a);
  await write('16_program_ADDON_STEM_eng_chi.docx', 'program', withPhotos(t6));
  await write('16b_quotation_ADDON_STEM_eng_chi.docx', 'quotation', t6);
  // 17: ธีมรายวัน — วันที่ 1 ภาษาอังกฤษ · วันที่ 2 วิทยาศาสตร์ทางทะเล (อ่านจากบรีฟ) + เสริมภาษาจีน
  const t7 = parseBrief('โรงเรียนสตรีวิทยา ม.2 จำนวน 80 คน ครู 6 คน ค่าย 2 วัน 1 คืน วันแรกภาษาอังกฤษ วันที่ 2 วิทยาศาสตร์ทะเล วันที่ 20-21 ม.ค. 2570 ณ โรงแรมกาสะรองรีสอร์ทพัทยา ราคาปกติ 4590 ลดเหลือ 3790 บาท เสริมภาษาจีน', blankCamp());
  await write('17_program_MIX_ENG_SEA.docx', 'program', withPhotos(t7));
  await write('17b_runsheet_MIX_ENG_SEA.docx', 'runsheet', t7);
  console.log('  (แม่แบบทั้งหมด', TEMPLATES.length, 'ชุด)');

  // sample.export.json (ตาม schema.json)
  const snap = { _app: 'EQ Camp Generator', _v: 2, savedAt: new Date().toISOString(),
    camp: { ...pl, actImgs: [], venueImgs: [] }, customVenues: [], brief: '' };
  fs.writeFileSync(path.join(OUT, 'sample.export.json'), JSON.stringify(snap, null, 2));
  console.log('  ✓ sample.export.json');
  console.log('เสร็จ');
})();
