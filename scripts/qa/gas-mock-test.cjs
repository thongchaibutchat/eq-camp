// ทดสอบโค้ด Apps Script ของศูนย์กลางทีมในสภาพแวดล้อมจำลอง (scripts/qa/gas-env.cjs)
// รัน: node scripts/qa/gas-mock-test.cjs <Code.gs>
const fs = require('fs');
const { makeHub } = require('./gas-env.cjs');
const code = fs.readFileSync(process.argv[2], 'utf8');
const H = makeHub(code); const { fn, props, cache, files, triggers, NSR, t1 } = H;
const KEY = (code.match(/const TEAM_KEY = '([^']+)'/) || [])[1];
const call = (op, body = {}) => JSON.parse(fn.doPost({ postData: { contents: JSON.stringify({ ...body, op, key: KEY }) } }).s);
let fail = 0; const ok = (n, c, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' ' + x)); if (!c) fail++; };
ok('wrong key rejected', JSON.parse(fn.doPost({ postData: { contents: JSON.stringify({ op: 'rev', key: 'nope' }) } }).s).error === 'key');
const r0 = call('rev'); ok('rev', r0.ok && typeof r0.rev === 'string', JSON.stringify(r0));
const l = call('nsr.list'); ok('nsr.list', l.ok && l.tabs.length === 2 && /spreadsheets/.test(l.url), JSON.stringify(l).slice(0, 200));
const rd = call('nsr.read', { tabs: ['stem@ทดสอบ', 'ไม่มี'] }); ok('nsr.read', rd.tabs[0].values[1][1] === 'STEM' && rd.tabs[1].missing);
const cr = call('nsr.create', { title: 'ใหม่@ทดสอบ', index: 1, rows: [['a', 'b'], ['=1+1', 3]], fmt: { boldRows: [1], moneyCols: [3], pctCells: [[2, 3]], staffCols: [3, 8] } });
ok('nsr.create', cr.ok && NSR.getSheetByName('ใหม่@ทดสอบ') && NSR._sheets[1].getName() === 'ใหม่@ทดสอบ', JSON.stringify(cr));
ok('nsr.create duplicate refused', call('nsr.create', { title: 'ใหม่@ทดสอบ', rows: [['x']] }).error === 'exists');
ok('rev changed after write', call('rev').rev !== r0.rev);
const e1 = call('nsr.edit', { title: 'stem@ทดสอบ', edits: [{ r: 2, c: 4, v: 90, was: '80' }] }); ok('nsr.edit', e1.ok && t1._g[1][3] === 90);
const e2 = call('nsr.edit', { title: 'stem@ทดสอบ', edits: [{ r: 2, c: 4, v: 95, was: '80' }] }); ok('nsr.edit conflict', e2.error === 'conflict' && e2.conflicts[0].now === '90');
// v13: ส่งซ้ำ (เช่น หมดเวลาแล้วลองใหม่) — ช่องเป็นค่าใหม่อยู่แล้ว = สำเร็จ ไม่ใช่ชนกัน
const e2b = call('nsr.edit', { title: 'stem@ทดสอบ', edits: [{ r: 2, c: 4, v: 90, was: '80' }] }); ok('nsr.edit retry after timeout = ok (idempotent)', e2b.ok && t1._g[1][3] === 90, JSON.stringify(e2b));
const e2c = call('nsr.edit', { title: 'stem@ทดสอบ', edits: [{ r: 2, c: 4, v: 95, was: '90' }] }); ok('nsr.edit normal edit after retry', e2c.ok && t1._g[1][3] === 95);
const since = Date.now() - 60000;
const ch = call('nsr.changes', { since }); ok('nsr.changes lists edited tabs', ch.ids.includes(t1.getSheetId()), JSON.stringify(ch));
fn.onEdit({ range: { getSheet: () => t1 } }); ok('onEdit bumps rev', call('rev').rev.split('.')[1] !== '0');
ok('triggers installed (edit + warm cache)', triggers.some(t => t.getHandlerFunction() === 'warmCache' && t.every === 4) && (/NSR_ID = '';/.test(code) || triggers.some(t => t.getHandlerFunction() === 'onEdit')));
const lg = call('log', { ev: { eid: 'e1', ts: '2026-11-18', school: 'รร.ก', students: 80 } }); ok('log', lg.ok);
ok('log dedupe', call('log', { ev: { eid: 'e1' } }).dup === true);
const lm = call('log.many', { events: [{ eid: 'e1' }, { eid: 'e2', school: 'รร.ข' }, { eid: 'e3' }] }); ok('log.many adds new only', lm.added === 2, JSON.stringify(lm));
const ev = call('events'); ok('events', ev.events.length === 3 && ev.events.some(e => e.school === 'รร.ข'));
const big = { camp: { school: 'x'.repeat(120000) } };
const jp = call('job.put', { job: { id: 'j1', name: 'งาน 1', snap: big }, dev: 'd1', by: 'ก' }); ok('job.put big (chunked)', jp.ok);
const jg = call('job.get', { id: 'j1' }); ok('job.get roundtrip (shared link name marked)', jg.job && jg.job.snap.camp.school.length === 120000 && jg.job.by === 'ก (ลิงก์รวม)', JSON.stringify(jg.job && jg.job.by));
call('job.put', { job: { id: 'j1', name: 'งาน 1 แก้', snap: { a: 1 } }, dev: 'd2' });
const jg2 = call('job.get', { id: 'j1' }); ok('job.put overwrite shrinks', jg2.job.name === 'งาน 1 แก้' && jg2.job.snap.a === 1);
// v14: สถานะงาน (เสร็จแล้ว/กำลังทำ) แท็บแยก JobState — ไม่แตะคอลัมน์ Jobs
ok('job not done by default (no JobState tab yet)', call('jobs', {}).jobs.find(j => j.id === 'j1').done === false);
call('job.put', { job: { id: 'j1', name: 'งาน 1 แก้', snap: { a: 1 }, done: true }, dev: 'd2', base: jg2.job.savedAt });
{ const l = call('jobs', {}).jobs.find(j => j.id === 'j1'); ok('job.put done:true → list shows done + doneAt', l.done === true && /^\d{4}-/.test(l.doneAt), JSON.stringify(l)); }
{ const g = call('job.get', { id: 'j1' }); ok('job.get carries done + snap intact', g.job.done === true && g.job.snap.a === 1); }
{ const b = call('board', {}); ok('board jobs carry done', b.jobs.find(j => j.id === 'j1').done === true); }
call('job.put', { job: { id: 'j1', name: 'งาน 1 แก้', snap: { a: 2 }, done: false }, dev: 'd2', base: call('job.get', { id: 'j1' }).job.savedAt });
{ const l = call('jobs', {}).jobs.find(j => j.id === 'j1'); ok('job.put done:false → back to in progress', l.done === false && !l.doneAt); }
call('job.put', { job: { id: 'j1', name: 'งาน 1 แก้', snap: { a: 3 } }, dev: 'd2', base: call('job.get', { id: 'j1' }).job.savedAt });
ok('job.put without done (old web) keeps state', call('jobs', {}).jobs.find(j => j.id === 'j1').done === false && call('job.get', { id: 'j1' }).job.snap.a === 3);
const js = call('jobs'); ok('jobs list no snap', js.jobs.length === 1 && !js.jobs[0].snap);
call('job.del', { id: 'j1' }); ok('job.del soft', call('jobs').jobs[0].deleted === true);
ok('hub spreadsheet created once', H.created() === 1 && files.HUB1.getSheetByName('Log') && files.HUB1.getSheetByName('Jobs'));
// ── nsr.all: ภาพรวมทุกแท็บคำสั่งเดียว + แคช ──
const a1 = call('nsr.all'); const tabsN = NSR._sheets.length;
ok('nsr.all first build = all tabs with data', a1.ok && a1.tabs.length === tabsN && a1.tabs.every(t => t.d && !t.pending) && a1.built === tabsN && a1.left === 0, JSON.stringify(a1).slice(0, 300));
const d1 = JSON.parse(a1.tabs.find(t => t.title === 'stem@ทดสอบ').d); ok('nsr.all data = values+formulas trimmed', d1.v[1][1] === 'STEM' && d1.v[1].length === 5 && Array.isArray(d1.f), JSON.stringify(d1));
const lt = NSR.insertSheet('12/2025'); lt.getRange(1, 1, 1, 1).setValues([['x'.repeat(35000)]]);
const a1b = call('nsr.all', { since: a1.at + 999999 }); const a1c = call('nsr.all', { since: a1.at + 999999 });
ok('oversize tab: served live, not cached, no crash', a1b.ok && a1b.tabs.find(t => t.title === '12/2025').d && a1c.tabs.find(t => t.title === '12/2025').d && files.HUB1.getSheetByName('NsrCache')._g.some(r => r[1] === '12/2025' && r[3] === '' && r[2] === 1));
NSR.deleteSheet(lt);
ok('nsr.all cache sheet', files.HUB1.getSheetByName('NsrCache').getLastRow() === tabsN + 2);
const a2 = call('nsr.all', { since: a1.at + 999999 }); ok('nsr.all incremental: nothing changed → no data, no rebuild', a2.built === 0 && a2.tabs.every(t => !t.d) && a2.tabs.length === tabsN, JSON.stringify(a2).slice(0, 300));
const a3 = call('nsr.all'); ok('nsr.all full again from cache (no rebuild)', a3.built === 0 && a3.tabs.every(t => t.d) && a3.tm.miss === 0, JSON.stringify(a3.tm));
for (const k of Object.keys(cache)) delete cache[k];
const a3b = call('nsr.all'); ok('cache evicted → served from NsrCache tab + refilled', a3b.tabs.every(t => t.d) && a3b.tm.miss > 0 && Object.keys(cache).length >= a3b.tabs.length - 1, JSON.stringify(a3b.tm));
for (const k of Object.keys(cache)) delete cache[k]; fn.warmCache(); ok('warmCache refills cache', Object.keys(cache).length >= a3b.tabs.length - 1);
props['t:' + t1.getSheetId()] = String(Date.now() + 1); t1._g[1][1] = 'STEM แก้';
while (Date.now() <= Number(props['t:' + t1.getSheetId()])) {}
const a4 = call('nsr.all', { since: a3.at }); const c4 = a4.tabs.filter(t => t.d);
ok('nsr.all after edit → rebuilds only that tab', a4.built === 1 && c4.length === 1 && JSON.parse(c4[0].d).v[1][1] === 'STEM แก้', JSON.stringify(a4).slice(0, 300));
const nt = NSR.insertSheet('ใหม่ล่าสุด@ทดสอบ'); nt.getRange(1, 1, 1, 2).setValues([['a', 'b']]);
const a5 = call('nsr.all', { since: a4.at + 999999 }); ok('nsr.all new tab built + returned', a5.built === 1 && a5.tabs.some(t => t.title === 'ใหม่ล่าสุด@ทดสอบ' && t.d), JSON.stringify(a5).slice(0, 600));
const a6 = call('nsr.all'); ok('nsr.all full read after mixed writes', a6.tabs.length === NSR._sheets.length && a6.tabs.every(t => t.d) && JSON.parse(a6.tabs.find(t => t.title === 'stem@ทดสอบ').d).v[1][1] === 'STEM แก้');
// ── สถานะการขาย ──
const r1 = call('rev').rev;
const s1 = call('status.set', { st: { sheetId: t1.getSheetId(), title: 'stem@ทดสอบ', status: 'quoted', price: 3290 }, by: 'ธงชัย', dev: 'd1' });
ok('status.set', s1.ok && call('rev').rev !== r1);
call('status.set', { st: { sheetId: t1.getSheetId(), title: 'stem@ทดสอบ', status: 'won', finalPax: 85, finalPrice: 3200 }, by: 'พริ้ม' });
const sl = call('status.list'); ok('status.list = latest per tab', sl.status.length === 1 && sl.status[0].status === 'won' && sl.status[0].by === 'พริ้ม (ลิงก์รวม)' && String(sl.status[0].finalPax) === '85', JSON.stringify(sl));
ok('status history kept', files.HUB1.getSheetByName('StatusLog').getLastRow() === 3);
ok('status.set bad refused', call('status.set', { st: { title: 'x' } }).error === 'bad');
ok('nsr.all carries status', call('nsr.all', { since: Date.now() + 1e9 }).status.length === 1);
// ── เติมช่องค่าล่วงเวลาให้แท็บเดิม ──
const ot = NSR.insertSheet('ot@ทดสอบ');
ot.getRange(1, 8, 7, 6).setValues([
  ['การคำนวน', '', '', '', '', ''],
  ['ประเภท', 'ค่าตอบแทนต่อวัน', 'จำนวนคน', 'จำนวนวัน', 'ค่าเดินทางล่วงหน้า', 'ค่าตอบแทนที่จะต้องจ่าย'],
  ['Di Camp', 2000, 1, 3, 500, '=sum(J3*I3*K3)+L3'],
  ['ค่าวิทยากรหลัก', 1250, 2, 3, 500, '=sum(J4*I4*K4)+(L4*J4)'],
  ['ค่าสต๊าฟทั่วไป', 500, 1, 3, 250, 1750],
  ['', '', '', '', '', ''],
  ['รวม', '', '=SUM(J3:J7)', '', '', '=SUM(M3:M7)']]);
const busy = NSR.insertSheet('busy@ทดสอบ'); busy.getRange(1, 8, 4, 8).setValues([['', '', '', '', '', '', '', ''], ['ประเภท', '', '', '', '', '', 'โน้ตของทีม', ''], ['Di Camp', 2000, 1, 1, 0, 2000, '', ''], ['รวม', '', '', '', '', 2000, '', '']]);
ok('migrateOT refused for non-admin', call('nsr.migrateOT').error === 'forbidden');
const OWN = (code.match(/const OWNER_CODE = '([^']*)'/) || [])[1]; const cl = call('admin.claim', { owner: OWN }); const AK = cl.key;
ok('owner claims admin', cl.ok && /^eq-/.test(AK) && cl.member.role === 'admin', JSON.stringify(cl));
const acall = (op, body = {}) => JSON.parse(fn.doPost({ postData: { contents: JSON.stringify({ ...body, op, key: AK }) } }).s);
const m1 = acall('nsr.migrateOT');
const G = ot._g;
ok('migrateOT: headers N/O', m1.ok && G[1][13] === 'คืนล่วงเวลา' && G[1][14] === 'ค่าล่วงเวลา (25%/คืน)', JSON.stringify(m1));
ok('migrateOT: N=0, O formula, M += O (formula kept)', G[2][13] === 0 && G[2][14] === '=I3*25%*J3*N3' && G[2][12] === '=(sum(J3*I3*K3)+L3)+O3' && G[3][12] === '=(sum(J4*I4*K4)+(L4*J4))+O4', JSON.stringify(G.slice(2, 5).map(r => r.slice(12, 15))));
ok('migrateOT: plain number M → formula keeps value', G[4][12] === '=1750+O5');
ok('migrateOT: blank row untouched, total O', G[5][13] === '' && G[5][14] === '' && G[6][14] === '=SUM(O3:O6)', JSON.stringify(G.slice(5, 7).map(r => r.slice(12, 15))));
ok('migrateOT: busy N:O tab refused', m1.bad.some(b => /busy@ทดสอบ/.test(b)) && busy._g[1][14] === '');
ok('migrateOT: touches tab (cache rebuild) + rev bump', Number(props['t:' + ot.getSheetId()]) > 0);
const m2 = acall('nsr.migrateOT'); ok('migrateOT: second run skips (idempotent)', m2.skip >= 1 && G[2][12] === '=(sum(J3*I3*K3)+L3)+O3', JSON.stringify(m2));
const rd15 = call('nsr.read', { tabs: ['ot@ทดสอบ'] }); ok('nsr.read returns 15 columns (A..O)', rd15.tabs[0].values[0].length === 15);
// ── v8: หลายคนพร้อมกัน ──
const o0 = H.opens(); const rv = call('rev'); ok('rev fast path: no spreadsheet opened + areas', H.opens() === o0 && rv.areas && ['nsr', 'log', 'job', 'st'].every(k => k in rv.areas), JSON.stringify(rv));
const ar0 = call('rev').areas; call('log', { ev: { eid: 'e9', school: 'รร.ค' } }); const ar1 = call('rev').areas;
ok('log bumps only log area', ar1.log !== ar0.log && ar1.job === ar0.job && ar1.nsr === ar0.nsr && ar1.st === ar0.st, JSON.stringify([ar0, ar1]));
const en = call('events'); const ef = call('events', { from: en.n - 1 });
ok('events incremental (from) returns only new rows', en.n >= 4 && ef.events.length === 1 && ef.events[0].eid === 'e9' && ef.n === en.n, JSON.stringify(ef).slice(0, 200));
ok('events from > n clamps', call('events', { from: 9999 }).events.length === 0);
const bd = call('board'); ok('board = events + jobs + status in one call', bd.ok && bd.events.length === en.n && Array.isArray(bd.jobs) && Array.isArray(bd.status) && bd.areas, JSON.stringify(bd).slice(0, 200));
const o1 = H.opens(); call('board'); call('jobs'); call('events'); ok('team reads do not open NSR sheet', H.opens() === o1);
H.lock.free = false;
ok('write while lock held → busy (retryable)', call('log', { ev: { eid: 'e10' } }).error === 'busy');
ok('reads still work while lock held', call('events').ok && call('jobs').ok && call('rev').ok);
H.lock.free = true; ok('write after lock frees', call('log', { ev: { eid: 'e10' } }).ok);
// v13: การอ่านแท็บใหม่ (nsr.all) ใช้ล็อกของตัวเอง — ระหว่างนั้นบันทึกได้ · ล็อกค้างหมดอายุเอง
H.cache.allRun = '1';
const ar = call('nsr.all', {}); ok('nsr.all while another refresh runs: answers without rebuilding', ar.ok && ar.built === 0, JSON.stringify({ built: ar.built, left: ar.left }));
const e2d = call('nsr.edit', { title: 'stem@ทดสอบ', edits: [{ r: 2, c: 4, v: 96, was: '95' }] }); ok('save works while refresh holds its own lock', e2d.ok);
delete H.cache.allRun;
const ar2 = call('nsr.all', {}); ok('nsr.all rebuilds after refresh lock frees + releases it', ar2.ok && ar2.built >= 1 && !H.cache.allRun, JSON.stringify({ built: ar2.built }));
ok('doGet', JSON.parse(fn.doGet().s).ok);
ok('unknown op', call('zzz').error === 'op');
process.exitCode = fail ? 1 : 0;
