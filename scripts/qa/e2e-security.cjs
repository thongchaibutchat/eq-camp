// ทีม 4 คน + ความปลอดภัย บนเว็บจริง โดยใช้ "โค้ดศูนย์กลางจริง" ในเครื่องจำลอง Apps Script (gas-env.cjs)
// เจ้าของเปิดลิงก์รวม → รับสิทธิ์แอดมินด้วยรหัสเจ้าของ → ออกลิงก์ส่วนตัวให้ตาต้า → ตาต้า (iPhone) ทำงานโดยพยายามปลอมชื่อ → ศูนย์กลางบันทึกชื่อ/อีเมล/เครื่องจริง
// → ตาต้าไม่เห็นส่วนแอดมิน/อีเมล → ลบงานแล้วแอดมินกู้คืน → ปิดลิงก์รวม (ลิงก์ในกลุ่มใช้ไม่ได้) → ปิดสิทธิ์ตาต้า (งานค้างไม่หาย) → ประวัติการใช้งานครบ
// รัน: LANG=C.UTF-8 node scripts/qa/e2e-security.cjs (เว็บที่ http://localhost:8765)
const { chromium, devices } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const { makeHub } = require('./gas-env.cjs');
const BASE = process.env.URL || 'http://localhost:8765';
const HUB = 'https://script.google.com/macros/s/AKfycbxLIYQHufbhDLnpF_bCwXhs8ZaCqAZeVNVZJRmNshaS3jDsu7zCh8lEB_wxKcQ-k1L6KA/exec';   // = HUB_URL ที่ฝังในเว็บ
const TEAM = 'eq-sharedgroup0001', OWN = 'own-sec-test-77';
execFileSync('node', ['scripts/qa/run-ts.mjs', 'scripts/qa/hub-code.ts', '/tmp/hub-e2e.gs', TEAM, OWN], { cwd: __dirname + '/../..' });
const H = makeHub(fs.readFileSync('/tmp/hub-e2e.gs', 'utf8'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch(); const out = []; const errs = [];
  const ok = (n, c, x = '') => out.push(`${c ? 'PASS' : 'FAIL'} ${n}${c ? '' : ' ' + x}`);
  const mk = async (opt, tag) => {
    const ctx = await b.newContext({ ...opt, acceptDownloads: true }); const pg = await ctx.newPage();
    pg.on('dialog', d => d.accept());
    pg.on('pageerror', e => errs.push(tag + ': ' + e.message)); pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push(tag + ': ' + m.text()); });
    await ctx.route(HUB + '**', async route => { const r = route.request(); const res = r.method() === 'POST' ? H.handle(JSON.parse(r.postData())) : { ok: true }; return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(res) }); });
    return { ctx, pg };
  };
  const body = p => p.locator('body').innerText();
  const audit = () => (H.files.HUB1.getSheetByName('Audit') || { _g: [] })._g.slice(1);
  // ── เจ้าของ (คอม) เปิดลิงก์รวม แล้วรับสิทธิ์แอดมิน ──
  const A = await mk({ viewport: { width: 1360, height: 900 } }, 'A');
  await A.pg.goto(`${BASE}/#/t/${TEAM}`); await sleep(1500);
  await A.pg.keyboard.press('Escape'); await A.pg.goto(BASE + '/#/team'); await sleep(2500);
  let t = await body(A.pg);
  ok('shared link: board warns identity unknown', /ลิงก์รวม/.test(t) && /ขอลิงก์ส่วนตัว/.test(t), t.slice(0, 300));
  ok('shared link: no admin panel', !/จัดการทีม & ความปลอดภัย/.test(t));
  await A.pg.getByRole('button', { name: /ฉันเป็นเจ้าของระบบ/ }).click();
  await A.pg.getByLabel(/รหัสเจ้าของ/).fill('wrong-code'); await A.pg.getByRole('button', { name: 'รับสิทธิ์แอดมิน' }).click(); await sleep(800);
  { let w = ''; for (let i = 0; i < 10 && !/รหัสเจ้าของไม่ถูกต้อง/.test(w); i++) { await sleep(300); w = await body(A.pg); } ok('wrong owner code refused', /รหัสเจ้าของไม่ถูกต้อง/.test(w), (w.match(/[^\n]*(รหัส|ไม่สำเร็จ|แอดมิน)[^\n]*/g) || []).slice(0, 4).join(' | ')); }
  await A.pg.getByLabel(/รหัสเจ้าของ/).fill(OWN); await A.pg.getByRole('button', { name: 'รับสิทธิ์แอดมิน' }).click(); await sleep(3000);
  t = await body(A.pg);
  ok('owner becomes admin (แพนด้า) → admin panel', /จัดการทีม & ความปลอดภัย/.test(t) && /แพนด้า/.test(t), t.slice(0, 400));
  ok('admin key stored only in this browser', (await A.pg.evaluate(() => localStorage.getItem('eqcamp.hub.key'))) !== TEAM);
  ok('team of 4 listed with emails (admin)', ['แพนด้า', 'ตาต้า', 'พี่กิ่ง', 'พี่นก'].every(n => t.includes(n)) && /tata@test\.local/.test(t));
  // ออกลิงก์ส่วนตัวให้ตาต้า
  const row = A.pg.locator('section[aria-label="จัดการทีมและความปลอดภัย"] li', { hasText: 'ตาต้า' }).first();
  await row.getByRole('button', { name: /ออกลิงก์ส่วนตัว/ }).click(); await sleep(1500);
  const tataLink = await A.pg.getByLabel('ลิงก์ส่วนตัวของ ตาต้า').inputValue();
  ok('personal link issued (#/t/eq-…)', /#\/t\/eq-[a-z0-9]{26}$/.test(tataLink), tataLink);
  // แอดมินตั้งบัญชี SME Move ของทีม
  await A.pg.getByRole('tab', { name: 'บัญชี SME Move' }).click(); await sleep(1200);
  const blueIn = A.pg.getByLabel(/ใบเสนอราคาสีฟ้า/); ok('admin sees seeded SME accounts', (await blueIn.inputValue()) === 'blue@test.local');
  await blueIn.fill('blue2@test.local'); await A.pg.getByRole('button', { name: 'บันทึก', exact: true }).click(); await sleep(1500);
  ok('admin saved SME account', H.handle({ op: 'config.get', key: TEAM }).config.sme.blue.email === 'blue2@test.local');
  await A.pg.getByRole('tab', { name: /สมาชิก/ }).click(); await sleep(800);
  // ── ตาต้า (iPhone) เปิดลิงก์ส่วนตัว + พยายามปลอมชื่อเป็นแพนด้า ──
  const B = await mk(devices['iPhone 13'], 'B');
  await B.ctx.addInitScript(() => { if (!sessionStorage.getItem('i')) { localStorage.setItem('eqcamp.hub.name', 'แพนด้า'); sessionStorage.setItem('i', '1'); } });
  await B.pg.goto(tataLink.replace(/^https?:\/\/[^/]+\/?[^#]*/, BASE + '/')); await sleep(2500);
  t = await body(B.pg);
  ok('tata: dialog shows own identity', /ลิงก์ส่วนตัวของ/.test(t) && /ตาต้า/.test(t) && /tata@test\.local/.test(t), t.slice(0, 300));
  await B.pg.getByRole('button', { name: 'ปิด' }).first().click().catch(() => {});
  await B.pg.goto(BASE + '/#/build'); await sleep(800);
  { const bt = B.pg.getByRole('button', { name: /บรีฟ/ }).first(); if (!(await B.pg.locator('textarea').count()) && await bt.count()) { await bt.click(); await sleep(300); } }
  await B.pg.locator('textarea').first().fill('โรงเรียนตาต้าทดสอบวิทยา ม.2 จำนวน 70 คน ค่าย STEM 2 วัน 1 คืน ราคา 2900 บาท');
  await B.pg.getByRole('button', { name: /เริ่มงานใหม่/ }).first().click(); await sleep(1500);
  await B.pg.getByRole('button', { name: /^ดาวน์โหลด/ }).first().click(); await sleep(4000);
  { const dlg = B.pg.locator('[role=dialog][aria-label="บันทึกไฟล์"]'); if (await dlg.count()) { await dlg.getByRole('button', { name: /ปิด|เสร็จ/ }).first().click().catch(() => {}); await B.pg.keyboard.press('Escape').catch(() => {}); await sleep(500); } }
  // ตาต้าเห็นบัญชีของใบเสนอราคาสีฟ้าในขั้นราคา
  await B.pg.getByRole('button', { name: /ราคา & งบ/ }).first().click(); await sleep(1200);
  const sp = B.pg.locator('section[aria-label="ส่งเข้า SME Move"]');
  ok('member sees team SME account on blue card', /blue2@test\.local/.test(await sp.innerText()));
  const ev = (H.handle({ op: 'events', key: TEAM }).events || []);
  const evAdmin = H.handle({ op: 'events', key: (await A.pg.evaluate(() => localStorage.getItem('eqcamp.hub.key'))) }).events.find(e => /ตาต้าทดสอบ/.test(e.school));
  ok('spoofed name ignored: event = ตาต้า + email + iPhone', evAdmin && evAdmin.byName === 'ตาต้า' && evAdmin.email === 'tata@test.local' && /iPhone/.test(evAdmin.device), JSON.stringify(evAdmin));
  void ev;
  const job = [...H.files.HUB1.getSheetByName('Jobs')._g].find(r => /ตาต้าทดสอบ/.test(String(r[4])));
  ok('job saved under ตาต้า', job && job[10] === 'ตาต้า', JSON.stringify(job && job.slice(0, 12)));
  await B.pg.goto(BASE + '/#/team'); await sleep(2500); t = await body(B.pg);
  ok('member board: no admin panel, no emails', !/จัดการทีม & ความปลอดภัย/.test(t) && !/@test\.local/.test(t));
  ok('member board: team of 4 + device shown', ['แพนด้า', 'ตาต้า', 'พี่กิ่ง', 'พี่นก'].every(n => t.includes(n)) && /iPhone/.test(t));
  // ตาต้าลบงาน → แอดมินกู้คืน
  await B.pg.goto(BASE + '/#/build'); await sleep(800);
  { const bt = B.pg.getByRole('button', { name: /บรีฟ/ }).first(); if (await bt.count()) { await bt.click(); await sleep(400); } }
  const jid = job && job[0];
  H.handle({ op: 'job.del', key: tataLink.split('#/t/')[1], id: jid, dev: 'x', dl: 'iPhone' });   // ลบ (แทนการกดในรายการงาน)
  ok('deleted job flagged', H.files.HUB1.getSheetByName('Jobs')._g.find(r => r[0] === jid)[12] === true);
  await A.pg.getByRole('tab', { name: 'กู้คืนงาน' }).click(); await sleep(1500);
  const trow = A.pg.locator('section[aria-label="จัดการทีมและความปลอดภัย"] li', { hasText: 'ตาต้าทดสอบ' }).first();
  ok('admin sees deleted job', await trow.count() > 0);
  await trow.getByRole('button', { name: /กู้คืน/ }).click(); await sleep(1500);
  ok('admin restored job', H.files.HUB1.getSheetByName('Jobs')._g.find(r => r[0] === jid)[12] === false);
  // ปิดลิงก์รวม → คนที่ยังใช้ลิงก์ในกลุ่มเข้าไม่ได้
  await A.pg.getByRole('tab', { name: /สมาชิก/ }).click(); await sleep(1200);
  await A.pg.getByRole('button', { name: 'ปิดลิงก์รวม' }).click(); await sleep(1500);
  ok('shared link closed', /ปิดลิงก์รวมแล้ว/.test(await body(A.pg)));
  const C = await mk({ viewport: { width: 1200, height: 850 } }, 'C');
  await C.pg.goto(`${BASE}/#/t/${TEAM}`); await sleep(3000);
  t = await body(C.pg);
  ok('old group link no longer works', /ลิงก์ในเครื่องนี้ใช้ไม่ได้แล้ว/.test(t), t.slice(0, 300));
  // ปิดสิทธิ์ตาต้า → งานค้างไม่หาย
  const r2 = A.pg.locator('section[aria-label="จัดการทีมและความปลอดภัย"] li', { hasText: 'ตาต้า' }).first();
  await r2.getByRole('button', { name: 'ปิดสิทธิ์' }).click(); await sleep(1500);
  await B.pg.goto(BASE + '/#/build'); await sleep(6000);
  const st = await B.pg.evaluate(() => JSON.parse(localStorage.getItem('eqcamp.hub.queue.v1') || '[]').length);
  await B.pg.locator('textarea').first().fill('โรงเรียนหลังถูกปิดสิทธิ์ จำนวน 50 คน ค่าย STEM 1 วัน ราคา 990 บาท').catch(() => {});
  await B.pg.getByRole('button', { name: /เริ่มงานใหม่/ }).first().click().catch(() => {}); await sleep(5000);
  const q2 = await B.pg.evaluate(() => JSON.parse(localStorage.getItem('eqcamp.hub.queue.v1') || '[]').length);
  ok('revoked member: work kept in local queue (not lost, not sent)', q2 >= 1 && !H.files.HUB1.getSheetByName('Jobs')._g.some(r => /หลังถูกปิดสิทธิ์/.test(String(r[4]))), `${st}→${q2}`);
  // ประวัติการใช้งาน
  await A.pg.getByRole('tab', { name: 'ประวัติการใช้งาน' }).click(); await sleep(1500); t = await body(A.pg);
  ok('audit shows new device / closed shared / disable / restore', /เครื่องใหม่/.test(t) && /ปิดลิงก์รวม/.test(t) && /แก้สมาชิก/.test(t) && /กู้คืนงาน/.test(t) && /รับสิทธิ์แอดมิน/.test(t), t.slice(0, 500));
  ok('audit rows carry email + iPhone', audit().some(r => r[2] === 'tata@test.local' && /iPhone/.test(r[4])));
  await A.pg.getByRole('button', { name: 'ต้องระวัง' }).click(); await sleep(300); t = await body(A.pg);
  ok('risk filter: denied/new-device only', /เครื่องใหม่|ปฏิเสธ|รหัสไม่ถูกต้อง/.test(t) && !/กู้คืนงาน/.test(t.split('ต้องระวัง')[1] || ''));
  await A.pg.screenshot({ path: '/tmp/sec-admin.png', fullPage: true });
  const ov = await B.pg.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok('iPhone no horizontal overflow', ov <= 1, String(ov));
  ok('no console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close();
  console.log(out.join('\n')); const f = out.filter(x => x.startsWith('FAIL')).length; console.log(`${out.length - f}/${out.length} passed`); process.exit(f ? 1 : 0);
})();
