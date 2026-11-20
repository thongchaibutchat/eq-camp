// ศูนย์กลางทีมแบบเรียลไทม์ข้ามเครื่อง: คอม (A) + iPhone (B) ใช้ศูนย์กลางจำลองชุดเดียวกัน
// ลิงก์เชิญ → งานของทีมซิงก์ → ทะเบียนโปรแกรมซิงก์ → ค้นหาทั้งระบบ (งาน/กิจกรรม/NSR) → ออฟไลน์แล้วส่งตามหลัง → แจ้งเมื่องานถูกแก้จากอีกเครื่อง
// รัน: LANG=C.UTF-8 node scripts/qa/e2e-hub.cjs (เว็บที่ http://localhost:8765)
const { chromium, devices } = require('playwright');
const fs = require('fs');
const { makeStore } = require('./nsr-fake.cjs');
const BASE = process.env.URL || 'http://localhost:8765';
const URL_ = 'https://script.google.com/macros/s/TEST/exec';
(async () => {
  const net = { down: false };
  const store = makeStore(JSON.parse(fs.readFileSync(__dirname + '/nsr-fixture.json', 'utf8')));
  const b = await chromium.launch(); const out = []; const errs = [];
  const ok = (n, c, extra = '') => out.push(`${c ? 'PASS' : 'FAIL'} ${n}${c ? '' : ' ' + extra}`);
  const mk = async (opt, tag) => {
    const ctx = await b.newContext({ ...opt, acceptDownloads: true }); const pg = await ctx.newPage();
    pg.on('pageerror', e => errs.push(tag + ': ' + e.message)); pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push(tag + ': ' + m.text()); });
    await ctx.route(URL_ + '**', async route => { if (net.down && tag === 'A') return route.abort('internetdisconnected'); const r = route.request(); const res = r.method() === 'POST' ? store.handle(JSON.parse(r.postData())) : { ok: true }; return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(res) }); });
    return { ctx, pg };
  };
  const A = await mk({ viewport: { width: 1400, height: 950 } }, 'A');
  const B = await mk(devices['iPhone 13'], 'B');
  const body = p => p.locator('body').innerText();
  // A = เจ้าของ: ทำงานไว้ก่อนเชื่อม (ต้องถูกส่งเข้าทีมทีหลัง) → เปิดลิงก์ติดตั้ง → วางที่อยู่ Web app
  await A.ctx.addInitScript(() => { if (!sessionStorage.getItem('i')) { localStorage.clear(); localStorage.setItem('eqcamp.hub.name', 'คอมฝ่ายขาย'); sessionStorage.setItem('i', '1'); } });
  await A.pg.goto(BASE + '/#/build'); await A.pg.waitForTimeout(800);
  { const bt0 = A.pg.getByRole('button', { name: /บรีฟ/ }).first(); if (!(await A.pg.locator('textarea').count()) && await bt0.count()) { await bt0.click(); await A.pg.waitForTimeout(300); } }
  await A.pg.locator('textarea').first().fill('โรงเรียนก่อนเชื่อมวิทยา จำนวน 60 คน ค่ายภาษาอังกฤษ 1 วัน ราคา 890 บาท');
  await A.pg.getByRole('button', { name: /เริ่มงานใหม่/ }).first().click(); await A.pg.waitForTimeout(1500);
  const b64 = Buffer.from('nsr-testkey').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  await A.pg.goto(BASE + '/#/setup/' + b64); await A.pg.waitForTimeout(800);
  ok('setup link: owner tab + key prefilled', (await A.pg.getByLabel(/รหัสทีม/).inputValue()) === 'nsr-testkey');
  await A.pg.getByLabel('ที่อยู่ Web app').fill(URL_);
  await A.pg.getByRole('button', { name: 'เชื่อมต่อ', exact: true }).click(); await A.pg.waitForTimeout(3500);
  ok('seed: earlier local job pushed to hub', [...store.jobs.values()].some(j => /ก่อนเชื่อม/.test(j.name)), JSON.stringify([...store.jobs.values()].map(j => j.name)));
  const invite = await A.pg.getByLabel('ลิงก์เชิญ').inputValue();
  ok('A: invite link created', /#\/join\/[\w-]{20,}$/.test(invite), invite.slice(0, 80));
  ok('A: connected live', /เชื่อมต่อแล้ว/.test(await body(A.pg)));
  await A.pg.getByRole('button', { name: 'ปิด' }).first().click();
  // B = มือถือ: แตะลิงก์เชิญ
  await B.pg.goto(invite.replace(/^https?:\/\/[^/]+\/?/, BASE + '/')); await B.pg.waitForTimeout(1500);
  ok('B: joined from invite link', (await B.pg.evaluate(() => localStorage.getItem('eqcamp.hub.key'))) === 'nsr-testkey' && !(await B.pg.evaluate(() => location.hash)).includes('join'));
  await B.pg.getByLabel(/ชื่อของคุณ/).fill('มือถือพริ้มเพรา'); await B.pg.getByLabel(/ชื่อของคุณ/).blur();
  await B.pg.getByRole('button', { name: 'ปิด' }).first().click();
  // A สร้างงานจากบรีฟ → ทีมเห็น
  await A.pg.goto(BASE + '/#/build'); await A.pg.waitForTimeout(800);
  const bt = A.pg.getByRole('button', { name: /บรีฟ/ }).first(); if (!(await A.pg.locator('textarea').count()) && await bt.count()) { await bt.click(); await A.pg.waitForTimeout(300); }
  await A.pg.locator('textarea').first().fill('โรงเรียนซิงก์ทีมวิทยา ม.2 จำนวน 90 คน ค่าย STEM 2 วัน 1 คืน วันที่ 20-21 ม.ค. 2570 ราคา 3990 บาท');
  await A.pg.getByRole('button', { name: /เริ่มงานใหม่/ }).first().click(); await A.pg.waitForTimeout(4500);
  ok('hub received job', [...store.jobs.values()].some(j => /ซิงก์ทีม/.test(j.name) && j.snap && j.by === 'คอมฝ่ายขาย'), JSON.stringify([...store.jobs.values()].map(j => j.name)));
  await B.pg.goto(BASE + '/#/build'); await B.pg.waitForTimeout(800);
  const bt2 = B.pg.getByRole('button', { name: /บรีฟ/ }).first(); if (await bt2.count()) { await bt2.click(); await B.pg.waitForTimeout(300); }
  await B.pg.waitForTimeout(6000);
  let tb = await body(B.pg);
  ok('B: sees team job (realtime)', /โรงเรียนซิงก์ทีมวิทยา/.test(tb) && /จากทีม/.test(tb) && /โดย คอมฝ่ายขาย/.test(tb), tb.slice(0, 200));
  await B.pg.getByRole('button', { name: 'เปิดทำต่อ' }).first().click(); await B.pg.waitForTimeout(1500);
  ok('B: opened team job', (await B.pg.evaluate(() => JSON.parse(localStorage.getItem('eqcamp.db.v1') || '{}').camp?.school)) === 'โรงเรียนซิงก์ทีมวิทยา');
  // A สร้างไฟล์ Word → ทะเบียนทีม
  await Promise.all([A.pg.waitForEvent('download'), A.pg.getByRole('button', { name: /^ดาวน์โหลด/ }).first().click()]); await A.pg.waitForTimeout(1200);
  ok('hub received log event', store.events.some(e => e.school === 'โรงเรียนซิงก์ทีมวิทยา' && e.byName === 'คอมฝ่ายขาย' && e.jobId));
  // A แก้งานเดียวกัน → B ได้รับแจ้ง
  await A.pg.getByRole('button', { name: /หลักสูตร|ข้อมูลค่าย/ }).first().click().catch(() => {});
  await A.pg.waitForTimeout(300);
  const st = A.pg.getByLabel(/จำนวนนักเรียน|นักเรียน/).first();
  if (await st.count()) { await st.fill('95'); }
  await A.pg.waitForTimeout(14000);
  tb = await body(B.pg);
  if (process.env.DBG) { console.log('jobs', JSON.stringify([...store.jobs.values()].map(j => [j.id, j.savedAt, j.dev, j.name]))); console.log('last ops', store.log.slice(-25).map(r => r.op + ':' + (r.dev || '').slice(-4)).join(' ')); console.log('B local', await B.pg.evaluate(() => localStorage.getItem('eqcamp.jobs.v1')?.slice(0, 400))); }
  ok('B: notified job changed on other device', /ถูกแก้จากเครื่องอื่น/.test(tb), (tb.match(/งานนี้[^\n]*/) || [''])[0]);
  // B ค้นหาทั้งระบบ
  await B.pg.goto(BASE + '/#/nsr'); await B.pg.waitForTimeout(2500);   // โหลดแคช NSR
  await B.pg.getByRole('button', { name: /ค้นหาทั้งระบบ/ }).click(); await B.pg.waitForTimeout(300);
  await B.pg.getByLabel('คำค้นหา').fill('ซิงก์ทีม'); await B.pg.waitForTimeout(300);
  let sr = await B.pg.getByRole('listbox').innerText();
  ok('search: team job + program', /โรงเรียนซิงก์ทีมวิทยา/.test(sr) && /โปรแกรมที่สร้าง/.test(sr), sr.slice(0, 200));
  await B.pg.getByLabel('คำค้นหา').fill('ทดสอบสอง'); await B.pg.waitForTimeout(300);
  sr = await B.pg.getByRole('listbox').innerText();
  ok('search: NSR tab', /Environment@โรงเรียนทดสอบสอง/.test(sr), sr.slice(0, 200));
  await B.pg.keyboard.press('Enter'); await B.pg.waitForTimeout(1200);
  ok('search Enter opens NSR tab (deep link)', decodeURIComponent(await B.pg.evaluate(() => location.hash)) === '#/nsr/Environment@โรงเรียนทดสอบสอง' && /Environment@โรงเรียนทดสอบสอง/.test(await body(B.pg)));
  await B.pg.getByRole('button', { name: /ค้นหาทั้งระบบ/ }).click();
  await B.pg.getByLabel('คำค้นหา').fill('ทะเล'); await B.pg.waitForTimeout(300);
  sr = await B.pg.getByRole('listbox').innerText();
  ok('search: courses/activities (Thai)', /หลักสูตร/.test(sr) && /กิจกรรม/.test(sr), sr.slice(0, 150));
  await B.pg.getByLabel('คำค้นหา').fill('PL SEA'); await B.pg.waitForTimeout(300);
  ok('search: course code', /Sea & Science/.test(await B.pg.getByRole('listbox').innerText()));
  await B.pg.keyboard.press('Escape');
  // ออฟไลน์: A บันทึกงานตอนไม่มีเน็ต → รอส่ง → ออนไลน์แล้วส่งเอง
  const before = [...store.jobs.values()].length;
  net.down = true;
  await A.pg.goto(BASE + '/#/build'); await A.pg.waitForTimeout(500);
  const bt3 = A.pg.getByRole('button', { name: /บรีฟ/ }).first(); if (!(await A.pg.locator('textarea').count()) && await bt3.count()) { await bt3.click(); await A.pg.waitForTimeout(300); }
  await A.pg.locator('textarea').first().fill('โรงเรียนออฟไลน์ศึกษา จำนวน 40 คน ค่ายดาราศาสตร์ 2 วัน 1 คืน ราคา 2990 บาท');
  await A.pg.getByRole('button', { name: /เริ่มงานใหม่/ }).first().click(); await A.pg.waitForTimeout(4000);
  ok('offline: queued (รอส่ง)', /รอส่ง/.test(await A.pg.locator('header').innerText()));
  net.down = false; await A.pg.evaluate(() => window.dispatchEvent(new Event('online'))); await A.pg.waitForTimeout(4000);
  ok('online: queue flushed to hub', [...store.jobs.values()].some(j => /ออฟไลน์ศึกษา/.test(j.name)) && [...store.jobs.values()].length > before && !/รอส่ง/.test(await A.pg.locator('header').innerText()));
  for (const [t, p] of [['A', A.pg], ['B', B.pg]]) { const ov = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); ok(`${t}: no horizontal overflow`, ov <= 1, String(ov)); }
  ok('no console/page errors', errs.length === 0, errs.slice(0, 4).join(' | '));
  await b.close();
  console.log(out.join('\n')); const f = out.filter(x => x.startsWith('FAIL')).length; console.log(`${out.length - f}/${out.length} passed`); process.exit(f ? 1 : 0);
})();
