// ตัวอ่านโปรแกรมเก่า (คลังงานเก่า) — ชุดทดสอบจากโครงไฟล์จริง 2 แบบ (ชื่อโรงเรียน/ที่พักสมมติ)
import { readFileSync } from 'fs';
import { parsePastProgram, classifyPast, pastForSchool } from '../../src/past-import';
import { buildSchedule, compose, buildDoc, migrateCamp, packDocx } from '../../src/eqcamp-core';
let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, info: unknown = '') => { if (cond) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name, typeof info === 'string' ? info : JSON.stringify(info).slice(0, 400)); } };
const txt = (f: string) => readFileSync('scripts/qa/fixtures/' + f, 'utf8');
const all = (p: any) => p.days.flatMap((d: any) => d.items.map((r: any) => r.title + ' ' + (r.sub || []).join(' '))).join('\n');

(async () => {
  // 1) อังกฤษ 3 วัน 2 คืน (Day n · ชื่อแถวอังกฤษ · escape จากตัวเชื่อม)
  const e = parsePastProgram(txt('past-eng.txt'), { fileId: 'F1', fileName: 'English Camp ตัวอย่าง.docx', folderName: '691204 English Camp โรงเรียนอนุบาลตัวอย่างวิทยา 3 วัน 2 คืน' });
  ok('eng: course', e.camp.courseCode === 'PL ENG 0104', e.camp.courseCode);
  ok('eng: 3 วัน 2 คืน', e.camp.durationMode === 'overnight' && e.camp.days === 3 && e.camp.nights === 2, [e.camp.days, e.camp.nights]);
  ok('eng: นักเรียน/ครู', e.camp.students === 90 && e.camp.teachers === 6, [e.camp.students, e.camp.teachers]);
  ok('eng: ราคา', e.camp.normalPrice === 1790 && e.camp.specialPrice === 990, [e.camp.normalPrice, e.camp.specialPrice]);
  ok('eng: โรงเรียน', /อนุบาลตัวอย่างวิทยา/.test(e.camp.school), e.camp.school);
  ok('eng: 3 วัน', e.stats.days === 3, e.stats);
  ok('eng: แถววันที่ 1 = 11', e.tpl.days[0].length === 11, e.tpl.days[0].map(r => r.x));
  ok('eng: แถวย่อย Activity ใต้ Play & Learn', (e.tpl.days[0][2].s || []).join('|') === 'Activity 1 : Left or Right.|Activity 2 : 20 Questions.', e.tpl.days[0][2]);
  ok('eng: escape ถอดแล้ว (#1 / Best Match!)', e.tpl.days[0][2].x.includes('#1') && e.tpl.days.flat().every(r => !r.x.includes('\\')) && e.tpl.days[0].some(r => r.x.includes('Best Match!')), e.tpl.days[0][2].x);
  ok('eng: เวลาไม่มี น. คงไว้ + 10:30 → 10.30', e.tpl.days[2].some(r => r.t.startsWith('10.30 – 13.30')), e.tpl.days[2].map(r => r.t));
  ok('eng: "20.30 onward."', e.tpl.days[1].some(r => /^20\.30 onward/.test(r.t)), e.tpl.days[1].map(r => r.t));
  ok('eng: หน้าปก 4 หัวข้อ + info', e.tpl.secs.filter(s => s.k === 'list').length === 3 && e.tpl.secs.filter(s => s.k === 'info').length === 3, e.tpl.secs.map(s => s.h || s.label));
  ok('eng: วัตถุประสงค์ 4 ข้อ ไม่มีเลขนำ', (e.tpl.secs[0].items || []).length === 4 && !/^\d/.test(e.tpl.secs[0].items![0]), e.tpl.secs[0].items);
  ok('eng: งบ 3 รายการ', e.tpl.budget.length === 3, e.tpl.budget);
  ok('eng: ชื่อค่ายปี → {Y}', e.tpl.titles.some(t => /Camp \{Y\}/.test(t)), e.tpl.titles);
  ok('eng: ไม่พบ = ว่าง', e.missing.length === 0, e.missing);
  // ใช้กับงานจริง: กำหนดการ = โปรแกรมเดิม · เปลี่ยนโรงเรียนแล้วไม่ค้างชื่อเดิม
  const c2 = migrateCamp({ ...e.camp, school: 'โรงเรียนใหม่ทดสอบ' });
  const p2 = buildSchedule(c2);
  ok('eng: ใช้แม่แบบงานเดิม', p2.tpl?.id === 'past:F1' && p2.tpl.exact, p2.tpl);
  ok('eng: กำหนดการตรงโปรแกรมเดิม', /Run Read & Write/.test(all(p2)) && /Performance Night/.test(all(p2)) && /Word Chain Relay/.test(all(p2)), all(p2).slice(0, 300));
  const k2 = compose(c2, p2);
  const js = JSON.stringify(k2);
  ok('eng: ไม่มีชื่อโรงเรียนเดิมค้าง', !/อนุบาลตัวอย่างวิทยา/.test(js) && !/\{[SVPY]\}/.test(js), js.match(/.{40}อนุบาลตัวอย่าง.{20}/)?.[0]);
  ok('eng: ชื่อค่าย 2026 + วัตถุประสงค์จากงานเดิม', /English Camp 2026/.test(js) && /นักสื่อสาร/.test(js), k2.titleEn);
  const doc = await buildDoc('program', c2); const buf = await packDocx(doc, 'buffer' as any);
  ok('eng: ออกไฟล์ Word ได้', buf && (buf as any).length > 20000, (buf as any)?.length);
  // เปลี่ยนระยะเวลา → กลับไปใช้แม่แบบทีม (โปรแกรมเดิมเป็นของ 3 วัน 2 คืน)
  const p3 = buildSchedule(migrateCamp({ ...c2, days: 2, nights: 1 }));
  ok('eng: เปลี่ยนเป็น 2 วัน 1 คืน → ไม่ใช้โปรแกรมเดิม', p3.tpl?.id !== 'past:F1', p3.tpl?.id);
  // 2) ไทย ตารางคั่นแท็บ · "วันที่ n" · ณ ที่พัก · ชื่อโรงเรียนในแถวเดินทาง
  const s = parsePastProgram(txt('past-sea.txt'), { fileId: 'F2', fileName: 'Sea ตัวอย่าง.docx' });
  ok('sea: course', s.camp.courseCode === 'PL SEA 0103', s.camp.courseCode);
  ok('sea: 2 วัน 1 คืน · 2 วัน', s.camp.days === 2 && s.camp.nights === 1 && s.stats.days === 2, [s.camp.days, s.camp.nights, s.stats]);
  ok('sea: นักเรียน 120 ครู 8', s.camp.students === 120 && s.camp.teachers === 8, [s.camp.students, s.camp.teachers]);
  ok('sea: ที่พัก/จังหวัด', /ซีวิว/.test(s.camp.venue) && s.camp.province === 'ชลบุรี', [s.camp.venue, s.camp.province]);
  ok('sea: แท็บ → เวลา + ชื่อ', s.tpl.days[0][0].t === '07.00 – 11.00 น.' && /^ออกเดินทางจาก\{S\}/.test(s.tpl.days[0][0].x), s.tpl.days[0][0]);
  ok('sea: ที่พักในแถว → {V}', s.tpl.days[0][1].x.includes('{V}'), s.tpl.days[0][1]);
  ok('sea: แถวย่อย - …', (s.tpl.days[0][3].s || []).length === 2, s.tpl.days[0][3]);
  ok('sea: เวลาอยู่บรรทัดเดียว ชื่ออยู่บรรทัดถัดไป', s.tpl.days[1][1].x === 'กิจกรรม “ปลูกป่าชายเลน”', s.tpl.days[1][1]);
  ok('sea: งบ ณ ที่พัก → {V}', s.tpl.budget[0].includes('{V}'), s.tpl.budget);
  const ps = buildSchedule(s.camp);
  ok('sea: ใช้โปรแกรมเดิม + มื้ออาหารนับได้', ps.tpl?.id === 'past:F2' && ps.meals.l + ps.meals.d + ps.meals.b >= 3, ps.meals);
  // 3) ข้อความพัง/ว่าง → ไม่ throw + รายการไม่พบ
  const z = parsePastProgram('อะไรก็ไม่รู้\nไม่มีโครง');
  ok('junk: ไม่ throw + ไม่พบหลายช่อง', z.missing.length >= 4 && !buildSchedule(z.camp).tpl?.id.startsWith('past:'), z.missing);
  // 3b) ราคารวมทั้งงาน (ไม่มี "ท่าน") → ไม่ใส่เป็นราคาต่อท่าน + เตือนยอดรวม · วันที่ค่าเริ่มต้นของแอปไม่นับว่าพบ
  { const L = parsePastProgram('PL 0304/2569\nหลักสูตร ทัศนศึกษา “แกะรอยมังกร”\nจำนวนผู้เข้ารับการอบรม\tนักเรียน จำนวน 41 ท่าน\nระยะเวลาอบรม\t1 วัน\nกำหนดการ\nโรงเรียนตัวอย่างวิทยา\n08.00 – 09.00 น.\tกิจกรรม A\n15.30 – 16.30 น.\tเดินทางกลับ\nราคาปกติ 79,900 บาท ลดเหลือ 60,000 บาท\nรายละเอียดงบประมาณมีดังนี้\n- ค่าอาหาร');
    ok('lump: ไม่ใส่ราคาต่อท่าน + เตือนยอดรวม ≈ ต่อหัว', !L.found.some(([k]) => k === 'ราคา') && L.missing.includes('ราคาต่อท่าน') && L.warnings.some(w => /60,000/.test(w) && /1,463/.test(w)) && !L.tpl.price, [L.missing, L.warnings]);
    ok('date placeholder ไม่นับว่าพบ', !L.found.some(([k]) => k === 'วันที่') && !L.camp.dates, L.camp.dates);
    const P = parsePastProgram('หลักสูตร X\nกำหนดการ\n08.00 – 09.00 น.\tกิจกรรม A\nราคาปกติ 3,500 บาท ลดเหลือ 2,990 บาท/ท่าน\nรายละเอียดงบประมาณมีดังนี้\n- ค่าอาหาร');
    ok('per-head: ราคาต่อท่านยังอ่านได้', P.camp.specialPrice === 2990 && P.camp.normalPrice === 3500, [P.camp.normalPrice, P.camp.specialPrice]); }
  // 3c) รูปแบบจากโปรแกรมจริง: "1เพื่อ" / ไม่มีเลขข้อ / "การบูรณาการการเรียน" / "สถานที่ ณ จังหวัด" / "ราคาพิเศษ ท่านละ … จากราคาปกติ …" / งบไม่มีขีด + หัว "โดยรวมรายละเอียดราคา"
  { const V = parsePastProgram(readFileSync('scripts/qa/fixtures/past-variants.txt', 'utf8'), { fileId: 'V' });
    const sec = (h: RegExp) => V.tpl.secs.find(x => h.test(x.h || ''));
    ok('variants: วัตถุประสงค์ 2 ข้อ (1เพื่อ + ไม่มีเลข)', sec(/วัตถุประสงค์/)?.items?.length === 2, sec(/วัตถุประสงค์/));
    ok('variants: หัวข้อ "การบูรณาการการเรียน" 2 ข้อ', sec(/บูรณาการการเรียน/)?.items?.length === 2, V.tpl.secs);
    ok('variants: ราคาพิเศษ ท่านละ 10,000 จากปกติ 12,990', V.camp.normalPrice === 12990 && V.camp.specialPrice === 10000, [V.camp.normalPrice, V.camp.specialPrice]);
    ok('variants: งบ 3 รายการ (ไม่มีขีด + เลขข้อ + บรรทัดต่อ)', V.tpl.budget.length === 3 && /Foreigner Teacher/.test(V.tpl.budget[1]) && V.tpl.budget[2] === 'ค่าที่พัก จำนวน 1 คืน', V.tpl.budget);
    ok('variants: จังหวัดจากบรรทัดสถานที่ · ไม่มีบรรทัดถูกข้าม', V.camp.province === 'ชลบุรี' && !V.warnings.some(w => /ไม่ได้นำเข้า/.test(w)), [V.camp.province, V.warnings]); }
  // 3d) หัววันเป็นวันที่จริง ("วันที่ 12 กรกฎาคม 2569") → แยกวันถูก · ช่วงวันที่ในหัวยังอ่านเป็นวันที่ค่าย
  { const D = parsePastProgram('หลักสูตร X Camp\nระยะเวลาอบรม\t3 วัน 2 คืน\nกำหนดการ\nโรงเรียนตัวอย่างวิทยา\nวันที่ 12 – 14 กรกฎาคม 2569\nวันที่ 12 กรกฎาคม 2569\n08.00 – 09.00 น.\tกิจกรรม A\nวันที่ 13 กรกฎาคม 2569\n09.00 – 10.00 น.\tกิจกรรม B\nวันจันทร์ที่ 14 กรกฎาคม 2569\n09.00 – 10.00 น.\tกิจกรรม C\nราคาปกติ 3,000 ลดเหลือ 2,500 บ./ท่าน');
    ok('date-days: 3 วัน ไม่มีเตือนระยะเวลา', D.stats.days === 3 && !D.warnings.some(w => /ระยะเวลาบนหน้าปก/.test(w)), [D.stats, D.warnings]);
    ok('date-days: วันที่ค่ายจากหัว', /12\s*[–-]\s*14\s*กรกฎาคม/.test(D.camp.dates), D.camp.dates);
    const S = parsePastProgram('หลักสูตร Y\nกำหนดการ\nวันที่ 12 กรกฎาคม 2569\n08.00 – 09.00 น.\tกิจกรรม A\n09.00 – 10.00 น.\tกิจกรรม B');
    ok('date-days: วันที่เดียว = หัวกำหนดการ ไม่ใช่หัววัน', S.stats.days === 1 && S.stats.rows === 2 && /12 กรกฎาคม/.test(S.camp.dates), [S.stats, S.camp.dates]); }
  // 3e) เลือกไฟล์ Word: ชื่อบอกว่าเป็นโปรแกรมมาก่อน รายชื่อ/หนังสือไปท้าย · ไฟล์ล็อก ~$ ไม่นับ
  { const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const J = classifyPast({ id: 'C', name: '691201 ค่ายตัวอย่าง โรงเรียนตัวอย่าง', files: [
      { id: 'a', n: 'รายชื่อนักเรียน.docx', m: DOCX, s: 30000 }, { id: 'b', n: '~$หลักสูตร ค่ายตัวอย่าง.docx', m: DOCX, s: 162 },
      { id: 'c', n: 'หลักสูตร ค่ายตัวอย่าง.docx', m: DOCX, s: 900000 }, { id: 'd', n: 'หลักสูตร ใหญ่.docx', m: DOCX, s: 150e6 }] });
    ok('docx: โปรแกรมมาก่อน · ~$ ไม่นับ · ไฟล์ >48MB ไม่นับ', J.programDocx?.id === 'c' && J.docxs.map(x => x.id).join() === 'c,a' && J.canOpen, J.docxs.map(x => x.id));
    const B = classifyPast({ id: 'E', name: '691201 ค่าย โรงเรียนใหญ่', files: [{ id: 'd', n: 'หลักสูตร ใหญ่.docx', m: DOCX, s: 150e6 }] });
    ok('docx: มีแต่ไฟล์ใหญ่ → เปิดแก้ไม่ได้ + bigDocx', !B.canOpen && B.bigDocx?.id === 'd', B); }
  // 3f) จำนวนผู้เข้าร่วม: ไม่มีคำว่านักเรียน → อ่านได้ · เป็นช่วง → ไม่เดา + เตือน
  { const A1 = parsePastProgram('หลักสูตร X\nผู้เข้าร่วม จำนวน 45 ท่าน\nวิทยากร จำนวน 7 ท่าน\nกำหนดการ\n08.00 – 09.00 น.\tกิจกรรม A');
    ok('students: ผู้เข้าร่วม จำนวน 45 ท่าน', A1.camp.students === 45, A1.camp.students);
    const A2 = parsePastProgram('หลักสูตร X\nข้อมูลผู้เข้าร่วม จำนวน 80 – 90 คน\nกำหนดการ\n08.00 – 09.00 น.\tกิจกรรม A');
    ok('students: ช่วง 80–90 → ไม่เดา + เตือน', !A2.camp.students && A2.missing.includes('จำนวนนักเรียน') && A2.warnings.some(w => /80–90/.test(w)), [A2.camp.students, A2.warnings]); }
  // 4) จัดชนิดจากชื่อโฟลเดอร์
  const j1 = classifyPast({ id: 'A', name: '691204 “ค่ายบูรณาการวิชาการภาษาอังกฤษ” (English Camp 2026) โรงเรียนอนุบาลตัวอย่างวิทยา   โปรแกรม 3 วัน 2 คืน', files: [
    { id: '1', n: 'English Camp ตัวอย่าง.pdf', m: 'application/pdf' }, { id: '2', n: 'English Camp ตัวอย่าง.docx', m: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
    { id: '3', n: 'ใบเสนอราคา English Camp.pdf', m: 'application/pdf' }, { id: '4', n: 'ยืนยัน ใบเสนอราคา English.pdf', m: 'application/pdf' }] });
  ok('folder: วันที่/ชนิด/หลักสูตร/ระยะเวลา', j1.date === '2026-12-04' && j1.kind === 'camp' && j1.courseCode === 'PL ENG 0104' && j1.duration === '3 วัน 2 คืน', j1);
  ok('folder: ไฟล์ Word/ใบเสนอ/ยืนยัน', j1.programDocx?.id === '2' && j1.quotes.length === 1 && j1.confirmed && j1.canOpen, j1);
  ok('folder: โรงเรียน', j1.school === 'โรงเรียนอนุบาลตัวอย่างวิทยา', j1.school);
  const j2 = classifyPast({ id: 'B', name: '691114 บริษัท ตัวอย่างไฟเบอร์ จำกัด Team Building “Boost Up & Teamwork”', files: [{ id: '9', n: 'TB.pdf', m: 'application/pdf' }] });
  ok('folder: องค์กร เปิดแก้ไม่ได้', j2.kind === 'corp' && !j2.canOpen, j2);
  ok('เคยจัดกับโรงเรียนนี้', pastForSchool([j1, j2], 'อนุบาลตัวอย่างวิทยา').length === 1 && pastForSchool([j1, j2], 'โรงเรียนอื่น').length === 0);
  // 5) ไปกลับ: ไฟล์ Word ที่ระบบสร้างจากงานเก่า → ศูนย์กลางแตกข้อความ (gas-past-test) → อ่านใหม่ = โครงเดิม
  let rt = ''; try { rt = readFileSync('/tmp/eq-past-text.txt', 'utf8'); } catch {}
  if (rt) {
    const r = parsePastProgram(rt, { fileId: 'RT' });
    ok('roundtrip: course/วัน/นักเรียน/ราคา', r.camp.courseCode === 'PL ENG 0104' && r.camp.days === 3 && r.camp.nights === 2 && r.camp.students === 90 && r.camp.specialPrice === 990, [r.camp.courseCode, r.camp.days, r.camp.students, r.camp.specialPrice, r.missing]);
    ok('roundtrip: แถวกำหนดการครบ', r.stats.days === 3 && r.stats.rows === e.stats.rows, [r.stats, e.stats]);
    ok('roundtrip: กิจกรรมเดิมอยู่ครบ', /Run Read & Write/.test(JSON.stringify(r.tpl.days)) && /Performance Night/.test(JSON.stringify(r.tpl.days)), '');
  } else console.log('SKIP roundtrip (รัน gas-past-test ก่อน)');
  console.log(`past-parse: ${pass} pass, ${fail} fail`); if (fail) process.exit(1);
})();
