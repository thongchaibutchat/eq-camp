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
