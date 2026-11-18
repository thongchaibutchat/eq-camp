// หน้า "คำนวณ NSR": เชื่อมชีต (จำลอง Apps Script) → รายการ/ค้นหา/กรอง → เปิดงาน → สูตร/ระดับอนุมัติ → บันทึกแท็บเดิม
// → ชนกัน (มีคนแก้) → งานใหม่ → สร้างแท็บใหม่ → อ่านกลับตรงกัน → อัปเดตต่อเนื่องจากชีต · เดสก์ท็อป + iPhone
// รัน: LANG=C.UTF-8 node scripts/qa/e2e-nsr.cjs  (เว็บที่ http://localhost:8765)  NSR_FIXTURE=<ไฟล์> ใช้ชุดข้อมูลอื่นได้
const { chromium, devices } = require('playwright');
const fs = require('fs');
const { makeStore } = require('./nsr-fake.cjs');
const BASE = process.env.URL || 'http://localhost:8765';
const FIX = process.env.NSR_FIXTURE || __dirname + '/nsr-fixture.json';
const URL_ = 'https://script.google.com/macros/s/TEST/exec';
(async () => {
  const b = await chromium.launch(); const out = [];
  for (const [tag, opt] of [['desktop', { viewport: { width: 1400, height: 950 } }], ['mobile', devices['iPhone 13']]]) {
    const store = makeStore(JSON.parse(fs.readFileSync(FIX, 'utf8')));
    const ctx = await b.newContext({ ...opt }); const pg = await ctx.newPage(); const errs = [];
    pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
    const ok = (n, c, extra = '') => out.push(`${tag} ${c ? 'PASS' : 'FAIL'} ${n}${c ? '' : ' ' + extra}`);
    await pg.route(URL_ + '**', async route => {
      const r = route.request();
      const res = r.method() === 'POST' ? store.handle(JSON.parse(r.postData())) : { ok: true };
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(res) });
    });
    await ctx.addInitScript(([u]) => { try { if (!sessionStorage.getItem('init')) { localStorage.clear(); localStorage.setItem('eqcamp.nsr.url', u); localStorage.setItem('eqcamp.nsr.key', 'nsr-testkey'); sessionStorage.setItem('init', '1'); } } catch {} }, [URL_]);
    await pg.goto(BASE + '/#/nsr'); await pg.waitForTimeout(1500);
    const body = async () => pg.locator('body').innerText();
    let t = await body();
    ok('connected via Apps Script', /เชื่อมชีตแล้ว/.test(t), t.slice(0, 300));
    ok('nav has คำนวณ NSR', (await pg.getByRole('button', { name: 'คำนวณ NSR' }).count()) > 0);
    const list = pg.locator('section[aria-label="งานย้อนหลัง"] li button');
    ok('list shows 5 jobs (copy hidden, master excluded)', (await list.count()) === 5, String(await list.count()));
    await pg.getByLabel('ค้นหางาน').fill('ทดสอบหนึ่ง'); await pg.waitForTimeout(200);
    ok('search narrows to 1', (await list.count()) === 1);
    await pg.getByLabel('ซ่อนแท็บ “Copy of”').uncheck(); await pg.waitForTimeout(200);
    ok('copy shown when unchecked', (await list.count()) === 2);
    await pg.getByLabel('ซ่อนแท็บ “Copy of”').check();
    await list.first().click(); await pg.waitForTimeout(400);
    t = await body();
    const tab = 'stem @โรงเรียนทดสอบหนึ่ง';
    const st = store.tabs.find(x => x.title === tab);
    const priceRow = st.values.findIndex(r => /ราคาขาย \(Selling/.test(r[1])) + 1;
    ok('opened tab, formula steps visible', t.includes(tab) && /ขั้น 3/.test(t) && /รวมต้นทุนก่อนภาษี/.test(t) && /กำไรจริง \/ ท่าน/.test(t));
    ok('audit note shown (SUM range bug)', /ข้อสังเกตจากชีต/.test(t) && /ไม่รวมแถว/.test(t));
    ok('tab link from sheet url (not embedded)', ((await pg.getByRole('link', { name: 'เปิดแท็บนี้' }).getAttribute('href')) || '').includes('TESTSHEET0000000000000000/edit#gid=' + store.tabs.find(x => x.title === 'stem @โรงเรียนทดสอบหนึ่ง').sheetId));
    ok('approval card + fast track', /อนุมัติราคา/.test(t) && /Fast Track 30 นาที/.test(t) && /ยังไม่เปิด Auto Approval/.test(t));
    // แก้ราคา → NSR เปลี่ยนทันที → บันทึกลงแท็บเดิม (1 ช่อง)
    const nsrBefore = await pg.locator('[aria-live="polite"]').filter({ hasText: 'NSR (กำไรจริง' }).innerText();
    await pg.getByLabel('ราคาขายต่อท่าน').fill('5,000'); await pg.waitForTimeout(250);
    const nsrAfter = await pg.locator('[aria-live="polite"]').filter({ hasText: 'NSR (กำไรจริง' }).innerText();
    ok('realtime recompute on typing', nsrBefore !== nsrAfter && /5,000/.test(nsrAfter));
    const saveBtn = pg.getByRole('button', { name: /บันทึกลงแท็บเดิม \(1 ช่อง\)/ });
    ok('in-place save offers 1 cell', (await saveBtn.count()) === 1);
    await saveBtn.click(); await pg.waitForTimeout(800);
    const edit = store.log.filter(x => x.op === 'edit').pop();
    ok('edit sent: price cell only', edit && edit.edits.length === 1 && edit.edits[0].r === priceRow && edit.edits[0].c === 5 && edit.edits[0].v === 5000, JSON.stringify(edit && edit.edits));
    ok('sheet updated', st.values[priceRow - 1][4] === '5000');
    t = await body(); ok('status back to synced', /ตรงกับชีต/.test(t));
    // ชนกัน: คนอื่นแก้ราคาในชีตเป็น 5100 → เราแก้เป็น 5200 → ต้องเตือน
    store.poke(tab, priceRow, 5, 5100);
    await pg.getByLabel('ราคาขายต่อท่าน').fill('5200'); await pg.waitForTimeout(200);
    await pg.getByRole('button', { name: /บันทึกลงแท็บเดิม/ }).click(); await pg.waitForTimeout(800);
    ok('conflict dialog', (await pg.getByRole('dialog', { name: 'ชีตมีการแก้ไขระหว่างนี้' }).count()) === 1);
    await pg.getByRole('button', { name: 'บันทึกทับ' }).click(); await pg.waitForTimeout(800);
    ok('force save writes 5200', st.values[priceRow - 1][4] === '5200');
    // อัปเดตต่อเนื่อง: คนอื่นแก้ในชีต → หน้าเว็บเปลี่ยนเองใน ≤16 วิ (ไม่มีการแก้ค้าง)
    store.poke(tab, priceRow, 5, 4800);
    await pg.waitForTimeout(16500);
    ok('live update from sheet', (await pg.getByLabel('ราคาขายต่อท่าน').inputValue()) === '4800');
    // งานใหม่ → สร้างแท็บใหม่ → อ่านกลับได้ค่าเดียวกัน
    if (tag === 'mobile') { await pg.getByRole('tab', { name: /งานย้อนหลัง/ }).click(); }
    await pg.getByRole('button', { name: 'งานใหม่', exact: true }).first().click(); await pg.waitForTimeout(300);
    await pg.getByLabel('ชื่องานที่จัด').fill('STEM 2วัน1คืน');
    await pg.getByLabel('จำนวนผู้เข้าร่วม').first().fill('100');
    await pg.getByLabel('จำนวนคุณครู').first().fill('8');
    await pg.getByLabel('จำนวนคน ค่าวิทยากรหลัก / นำฐาน').locator('visible=true').first().fill('3');
    for (const r of ['Di Camp', 'ค่าวิทยากรหลัก / นำฐาน', 'ค่าสต๊าฟซีเนียร์', 'ค่าสต๊าฟจูเนียร์', 'ค่าสต๊าฟทั่วไป']) await pg.getByLabel('จำนวนวัน ' + r).locator('visible=true').first().fill('2');
    await pg.getByLabel('ราคา ค่าที่พัก', { exact: true }).fill('450'); await pg.getByLabel('จำนวน ค่าที่พัก', { exact: true }).fill('1');
    await pg.getByLabel('ราคา ค่าอาหาร มื้อโรงแรม', { exact: true }).fill('120'); await pg.getByLabel('จำนวน ค่าอาหาร มื้อโรงแรม', { exact: true }).fill('4');
    await pg.getByLabel('ราคาขายต่อท่าน').fill('3990'); await pg.waitForTimeout(300);
    t = await body();
    ok('auto trainer formula shown', /ใช้สูตร: 13,500 ÷ 100 คน = 135/.test(t), (t.match(/ใช้สูตร:[^\n]*/) || [''])[0]);
    const resBefore = await pg.locator('[aria-live="polite"]').filter({ hasText: 'NSR (กำไรจริง' }).innerText();
    await pg.getByRole('button', { name: 'บันทึกเป็นแท็บใหม่ในชีต' }).click();
    await pg.getByLabel(/ชื่อแท็บ/).fill('STEM@โรงเรียนใหม่ทดสอบ');
    await pg.getByRole('button', { name: 'สร้างแท็บ' }).click(); await pg.waitForTimeout(1200);
    const created = store.tabs.find(x => x.title === 'STEM@โรงเรียนใหม่ทดสอบ');
    ok('tab created in sheet', !!created);
    ok('formulas written (subtotal covers all lines)', created && created.formulas.some(r => r[4] === '=SUM(E5:E23)') && created.formulas.some(r => r[2] === '=M8/D3'), JSON.stringify(created && created.formulas.map(r => r[4]).filter(Boolean).slice(-6)));
    const resAfter = await pg.locator('[aria-live="polite"]').filter({ hasText: 'NSR (กำไรจริง' }).innerText();
    ok('read-back equals web result', resBefore === resAfter, resBefore.slice(0, 120) + ' | ' + resAfter.slice(0, 120));
    t = await body(); ok('now a sheet tab', /แท็บในชีต/.test(t) && t.includes('STEM@โรงเรียนใหม่ทดสอบ'));
    // กรอง "สูตรชีตผิด"
    if (tag === 'mobile') await pg.getByRole('tab', { name: /งานย้อนหลัง/ }).click();
    await pg.getByLabel('ค้นหางาน').fill('');
    await pg.getByRole('button', { name: /^สูตรชีตผิด/ }).click(); await pg.waitForTimeout(200);
    ok('filter audit', (await list.count()) >= 4, String(await list.count()));
    const ov = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    ok('no horizontal overflow', ov <= 1, String(ov));
    ok('no console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(out.join('\n')); const f = out.filter(x => x.includes('FAIL')).length; console.log(`${out.length - f}/${out.length} passed`); process.exit(f ? 1 : 0);
})();
