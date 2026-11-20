// ความปลอดภัยของศูนย์กลางทีม (รันโค้ด Apps Script จริงในเครื่องจำลอง): ลิงก์ส่วนตัว · บทบาท · ปลอมชื่อ · ปิดสิทธิ์ · สูตรแปลก · ยิงถล่ม · ลบ/บันทึกทับแล้วกู้คืน · โควตา
// รัน: node scripts/qa/gas-security-test.cjs <Code.gs ที่สร้างพร้อมรหัสเจ้าของ>
const fs = require('fs');
const { makeHub } = require('./gas-env.cjs');
const code = fs.readFileSync(process.argv[2], 'utf8');
const H = makeHub(code);
const TEAM = (code.match(/const TEAM_KEY = '([^']+)'/) || [])[1], OWN = (code.match(/const OWNER_CODE = '([^']*)'/) || [])[1];
let fail = 0; const ok = (n, c, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' ' + x)); if (!c) fail++; };
const as = (key, dev = 'd-x', dl = 'Windows · Chrome') => (op, b = {}) => H.handle({ ...b, op, key, dev, dl });
const shared = as(TEAM, 'd-shared', 'iPhone 16 Pro · Safari');
const audit = () => H.files.HUB1 ? (H.files.HUB1.getSheetByName('Audit') || { _g: [] })._g.slice(1) : [];
// 1) ไม่มีรหัส/รหัสผิด
ok('no key → key', H.handle({ op: 'rev' }).error === 'key');
ok('wrong key → key', as('eq-nottherightkey00')('rev').error === 'key');
ok('garbage body → bad', JSON.parse(H.fn.doPost({ postData: { contents: '{not json' } }).s).error === 'bad');
const r0 = shared('rev'); ok('shared link works while open (member, marked shared)', r0.ok && r0.me.shared && r0.me.role === 'member' && r0.me.legacy, JSON.stringify(r0.me));
// 2) รับสิทธิ์แอดมิน
ok('claim with wrong owner code refused', shared('admin.claim', { owner: 'guess' }).error === 'forbidden');
ok('shared link cannot list members', shared('members.list').error === 'forbidden');
const cl = shared('admin.claim', { owner: OWN }); const ADM = as(cl.key, 'd-admin', 'Mac · Safari');
ok('owner claims admin → personal key', cl.ok && cl.member.nick === 'แพนด้า' && cl.member.role === 'admin');
const ml = ADM('members.list'); ok('admin sees members with emails', ml.ok && ml.members.some(m => m.email === 'tata@test.local') && ml.legacy === true, JSON.stringify(ml).slice(0, 300));
// 3) ลิงก์ส่วนตัวของตาต้า
const k1 = ADM('members.key', { id: 'tata' }); const TATA = as(k1.key, 'd-tata-ip', 'iPhone 16 Pro · Safari · iOS 18.2');
ok('admin issues personal link', k1.ok && /^eq-[a-z0-9]{26}$/.test(k1.key));
ok('keys stored hashed (no raw key in Properties)', !JSON.stringify(H.props).includes(k1.key) && !JSON.stringify(H.props).includes(cl.key));
const rt = TATA('rev'); ok('tata identified by server', rt.me.nick === 'ตาต้า' && rt.me.email === 'tata@test.local' && rt.me.role === 'member' && !rt.me.shared, JSON.stringify(rt.me));
TATA('log', { ev: { eid: 'sp1', ts: new Date().toISOString(), school: 'รร.ปลอมชื่อ', byName: 'แพนด้า', by: 'แอบอ้าง' }, by: 'แพนด้า' });
const evs = ADM('events').events; const sp = evs.find(e => e.eid === 'sp1');
ok('spoofed name ignored: event stamped with real member + email + device', sp && sp.byName === 'ตาต้า' && sp.email === 'tata@test.local' && /iPhone 16 Pro/.test(sp.device), JSON.stringify(sp));
for (const op of ['members.list', 'members.save', 'members.key', 'legacy.set', 'audit', 'jobs.trash', 'job.versions', 'job.restore', 'nsr.migrateOT'])
  ok('member forbidden: ' + op, TATA(op, { id: 'panda', member: { id: 'tata', nick: 'ตาต้า', role: 'admin' }, on: false }).error === 'forbidden');
ok('member cannot self-promote (role unchanged)', TATA('rev').me.role === 'member');
// 4) เครื่องใหม่
const n0 = audit().filter(r => r[6] === 'เครื่องใหม่' && r[1] === 'ตาต้า').length;
TATA('rev'); TATA('rev');
const TATA2 = as(k1.key, 'd-tata-pc', 'Windows · Edge'); TATA2('rev');
const nn = audit().filter(r => r[6] === 'เครื่องใหม่' && r[1] === 'ตาต้า');
ok('new device logged once per device (with label)', n0 === 1 && nn.length === 2 && nn.some(r => /Windows · Edge/.test(r[4])), JSON.stringify(nn.map(r => r[4])));
const m2 = ADM('members.list').members.find(m => m.id === 'tata'); ok('admin sees tata devices', m2.devices.length === 2 && m2.lastSeen && m2.hasKey);
const tb = TATA('board'); ok('member board: team without emails/devices list', tb.team.length >= 2 && tb.team.every(m => m.email === undefined && m.devices === undefined));
const ab = ADM('board'); ok('admin board: team with emails', ab.team.some(m => m.email === 'tata@test.local'));
// 5) ปิดสิทธิ์ / ออกลิงก์ใหม่
ok('admin disables tata', ADM('members.save', { member: { id: 'tata', nick: 'ตาต้า', email: 'tata@test.local', role: 'member', active: false } }).ok);
ok('disabled member → revoked', TATA('rev').error === 'revoked' && TATA('log', { ev: { eid: 'x9' } }).error === 'revoked');
const k2 = ADM('members.key', { id: 'tata' }); ok('new link re-enables', as(k2.key)('rev').ok);
ok('old link dead after reissue', TATA('rev').error === 'key');
ok('cannot remove last admin', ADM('members.save', { member: { id: 'panda', nick: 'แพนด้า', role: 'member' } }).error === 'bad');
// 6) ปิดลิงก์รวม
ok('admin closes shared link', ADM('legacy.set', { on: false }).legacy === false);
ok('shared link dead after close', shared('rev').error === 'key');
ok('shared link cannot reopen itself', shared('legacy.set', { on: true }).error === 'key');
// 7) สูตรแปลก/เขียนนอกตาราง
const T2 = as(k2.key, 'd-tata-ip');
ok('nsr.create: dangerous formula refused', T2('nsr.create', { title: 'x@1', rows: [['=IMPORTXML("http://evil","//a")']] }).error === 'bad');
ok('nsr.create: HYPERLINK refused', T2('nsr.create', { title: 'x@2', rows: [['=HYPERLINK("http://x")']] }).error === 'bad');
const okc = T2('nsr.create', { title: 'ปลอดภัย@1', rows: [['ชื่อ', 5], ['=SUM(B1:B1)*2', '=IFERROR(B1/B2,0)'], ['=sum(J3*I3*K3)+(L3*J3)+O3', '=3000*MAX(K3:K9)/D3']] });
ok('nsr.create: team formulas allowed', okc.ok, JSON.stringify(okc));
const tab = H.NSR.getSheetByName('ปลอมชื่อ@x') || H.NSR.getSheetByName('ปลอดภัย@1');
ok('nsr.edit: formula text neutralized', T2('nsr.edit', { title: 'ปลอดภัย@1', edits: [{ r: 1, c: 1, v: '=HYPERLINK("http://evil")', was: 'ชื่อ' }] }).ok && tab._text && tab._text['1:1'] === 1);
ok('nsr.edit outside table refused', T2('nsr.edit', { title: 'ปลอดภัย@1', edits: [{ r: 900, c: 1, v: 'x', was: '' }] }).error === 'bad');
ok('nsr.edit audited with old→new', audit().some(r => r[6] === 'แก้ NSR' && /A1: ชื่อ →/.test(r[8])));
// 8) ยิงถล่ม
let rated = 0; for (let i = 0; i < 45; i++) { const r = T2('log', { ev: { eid: 'fl' + i, ts: new Date().toISOString() } }); if (r.error === 'rate') rated++; }
ok('flood: writes over 40/min rate-limited', rated >= 5, String(rated));
const ADMk = as(cl.key, 'd-admin2'); ok('flood by one person does not block others', ADMk('log', { ev: { eid: 'adm-ok', ts: new Date().toISOString() } }).ok);
// 9) ลบ/บันทึกทับ แล้วกู้คืน
const T3 = as(k2.key, 'd-tata-3');
T3('job.put', { job: { id: 'J1', name: 'งานสำคัญ', school: 'รร.สำคัญ', snap: { camp: { school: 'รร.สำคัญ', students: 120 } } } });
T3('job.put', { job: { id: 'J1', name: 'ขยะ', snap: { camp: { school: '' } } } });           // บันทึกทับด้วยขยะ
const vv = ADM('job.versions', { id: 'J1' }); ok('overwrite keeps previous version', vv.ok && vv.versions.length >= 1 && vv.versions[0].name === 'งานสำคัญ', JSON.stringify(vv).slice(0, 300));
ok('admin restores version', ADM('job.restore', { id: 'J1', at: vv.versions[0].at }).ok);
const jg = ADM('job.get', { id: 'J1' }); ok('restored content back', jg.job.name === 'งานสำคัญ' && jg.job.snap.camp.students === 120, JSON.stringify(jg.job && jg.job.name));
T3('job.del', { id: 'J1' });
const tr = ADM('jobs.trash'); ok('deleted job in trash', tr.deleted.some(j => j.id === 'J1'));
ok('deleted job hidden from board', !T3('board').jobs.some(j => j.id === 'J1'));
ok('admin undeletes', ADM('job.restore', { id: 'J1' }).ok && !ADM('jobs').jobs.find(j => j.id === 'J1').deleted);
ok('oversized job refused', T3('job.put', { job: { id: 'J2', snap: { x: 'y'.repeat(700000) } } }).error === 'bad');
// 10) โควตา Properties: rev ซ้ำ ๆ ไม่อ่าน Properties
ADM('rev'); const p0 = H.pReads(); for (let i = 0; i < 200; i++) as(k2.key, 'd-tata-3')('rev'); const pr = H.pReads() - p0;
ok(`200 polls read Properties ≤ 2 times (got ${pr})`, pr <= 2);
// 11) ประวัติการใช้งาน
const au = ADM('audit', { limit: 500 }); const acts = new Set(au.rows.map(r => r.action));
ok('audit covers claim/key/disable/close-shared/new-device/denied/delete/restore', ['รับสิทธิ์แอดมิน', 'ออกลิงก์ส่วนตัวใหม่', 'แก้สมาชิก', 'ปิดลิงก์รวม', 'เครื่องใหม่', 'ปฏิเสธ', 'ลบงาน', 'กู้คืนงาน', 'รหัสไม่ถูกต้อง'].every(a => acts.has(a)), [...acts].join(','));
ok('audit rows carry email + device', au.rows.some(r => r.email === 'tata@test.local' && /iPhone/.test(r.device)));
console.log(fail ? `${fail} FAIL` : 'security: all pass'); process.exit(fail ? 1 : 0);
