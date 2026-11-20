// ทดสอบการคำนวณบอร์ดภาพรวมทีม · รัน: node scripts/qa/run-ts.mjs scripts/qa/board-test.ts
(globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { teamBoard, monthOf, monthLabel } = await import('../../web/board-data');
let fail = 0; const ok = (n: string, c: boolean, x: any = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' ' + JSON.stringify(x))); if (!c) fail++; };
const E = (o: any) => ({ eid: Math.random().toString(36).slice(2), action: 'word', docKind: 'program', programId: 'p1', jobId: '', docCode: '', school: '', courseCode: '', course: '', dayThemes: '', addons: '', partyTheme: '', durationMode: 'overnight', days: 2, nights: 1, dates: '', venue: '', province: '', region: '', students: 0, teachers: 0, normalPrice: 0, specialPrice: 0, source: 'เว็บ', by: '', byName: '', ...o });
const now = new Date('2026-11-21T10:00:00+07:00');
const ev = [
  E({ ts: '2026-11-03T03:00:00Z', programId: 'A', byName: 'พริ้ม', school: 'รร.ก', course: 'STEM', students: 100, specialPrice: 3000 }),
  E({ ts: '2026-11-03T03:05:00Z', programId: 'A', byName: 'พริ้ม', school: 'รร.ก', course: 'STEM', students: 120, specialPrice: 3000, docKind: 'quotation' }),   // โปรแกรมเดิม แก้จำนวน
  E({ ts: '2026-11-03T03:06:00Z', programId: 'A', byName: 'พริ้ม', action: 'pdf', school: 'รร.ก', course: 'STEM', students: 120, specialPrice: 3000 }),
  E({ ts: '2026-11-10T04:00:00Z', programId: 'B', byName: 'ธงชัย', school: 'รร.ข', course: 'STEM', students: 50, specialPrice: 1000 }),
  E({ ts: '2026-11-12T04:00:00Z', programId: 'C', byName: 'พริ้ม', school: 'โรงเรียนค', course: 'ภาษาอังกฤษ', students: 80, specialPrice: 900 }),
  E({ ts: '2026-11-12T04:00:00Z', programId: 'D', byName: '', school: 'รร.ง', course: 'ดาราศาสตร์', students: 40, specialPrice: 1000 }),
  E({ ts: '2026-10-20T04:00:00Z', programId: 'Z', byName: 'ธงชัย', school: 'รร.ซ', course: 'ดาราศาสตร์', students: 30, specialPrice: 1000 }),
  E({ ts: '2026-10-31T18:30:00Z', programId: 'TZ', byName: 'ธงชัย', school: 'รร.เวลา', course: 'STEM' })   // 01:30 น. 1 พ.ย. เวลาไทย
];
const dup = { ...ev[0] };   // เหตุการณ์ซ้ำ (eid เดียวกัน) ต้องนับครั้งเดียว
const b = teamBoard({ events: [...ev, dup], now, statuses: [
  { sheetId: 1, title: 't1', status: 'won', at: '2026-11-15T02:00:00Z', finalPax: 120, finalPrice: 2900 } as any,
  { sheetId: 2, title: 't2', status: 'lost', at: '2026-11-16T02:00:00Z' } as any,
  { sheetId: 3, title: 't3', status: 'quoted', at: '2026-10-01T02:00:00Z' } as any,                 // เสนอเกิน 14 วัน → ต้องตาม
  { sheetId: 4, title: 't4', status: 'quoted', at: '2026-11-20T02:00:00Z', followUp: '2026-11-30' } as any
], jobs: [
  { id: 'j1', savedAt: '2026-11-20T02:00:00Z', name: 'งาน 1', by: 'พริ้ม' } as any,
  { id: 'j2', savedAt: '2026-11-01T02:00:00Z', name: 'เก่า', by: 'ธงชัย' } as any,
  { id: 'j3', savedAt: '2026-11-21T01:00:00Z', name: 'ลบแล้ว', deleted: true } as any
] });
ok('thai month boundary', monthOf('2026-10-31T18:30:00Z') === '2026-11' && monthLabel('2026-11') === 'พ.ย. 2569');
ok('month = current', b.month === '2026-11' && b.months[0] === '2026-11' && b.months.includes('2026-10'), b.months);
ok('programs this month (dedupe by programId)', b.programs === 5, b.programs);
ok('files this month', b.files === 7 && b.pdf === 1, [b.files, b.pdf]);
ok('prev month programs', b.prevPrograms === 1, b.prevPrograms);
ok('people incl. unnamed', b.people === 3 && b.byPerson.some(p => p.name === 'ไม่ระบุชื่อ'), b.byPerson.map(p => p.name));
const prim = b.byPerson[0];
ok('top person = พริ้ม: 2 programs, 4 files, value uses latest students', prim.name === 'พริ้ม' && prim.programs === 2 && prim.files === 4 && prim.value === 120 * 3000 + 80 * 900, prim);
ok('ธงชัย counts tz-shifted program in Nov', b.byPerson.find(p => p.name === 'ธงชัย')!.programs === 2);
ok('top course this month = STEM (3 programs)', b.byCourse[0].course === 'STEM' && b.byCourse[0].programs === 3, b.byCourse);
ok('all-time course list includes Oct course', b.byCourseAll.find(c => c.course === 'ดาราศาสตร์')!.programs === 2);
ok('value this month', b.value === 120 * 3000 + 50 * 1000 + 80 * 900 + 40 * 1000, b.value);
ok('schools normalized (โรงเรียน prefix)', b.schools === 5, b.schools);
ok('feed newest first + labels', b.feed[0].ts >= b.feed[1].ts && b.feed.some(f => f.what === 'สร้าง ใบเสนอราคา') && b.feed.some(f => f.what === 'บันทึก PDF โปรแกรมค่าย'));
ok('sales counts', b.sales.won === 1 && b.sales.lost === 1 && b.sales.quoted === 2 && b.sales.closeRate === 0.5, b.sales);
ok('won this month value', b.sales.wonMonth === 1 && b.sales.wonValueMonth === 120 * 2900);
ok('follow-up list = stale quote only', b.sales.follow.length === 1 && b.sales.follow[0].sheetId === 3, b.sales.follow);
ok('active jobs: last 7 days, not deleted', b.activeJobs.length === 1 && b.activeJobs[0].id === 'j1' && b.activeJobs[0].who === 'พริ้ม', b.activeJobs);
const o = teamBoard({ events: ev, now, month: '2026-10' });
ok('pick previous month', o.month === '2026-10' && o.programs === 1 && o.byPerson[0].name === 'ธงชัย');
const e0 = teamBoard({ events: [], now });
ok('empty data safe', e0.programs === 0 && e0.byPerson.length === 0 && e0.sales.closeRate === null && e0.months[0] === '2026-11');
ok('bad rows ignored', teamBoard({ events: [null as any, { eid: 'x' } as any, E({ ts: 'not-a-date' })], now }).files === 0);
console.log(fail ? `${fail} FAIL` : 'board: all pass');
process.exit(fail ? 1 : 0);
