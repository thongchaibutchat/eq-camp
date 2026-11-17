// ทะเบียนโปรแกรม: สร้างไฟล์ → นับโปรแกรม (ตัดซ้ำ) → ตั้งค่าชีตทีม (จำลอง Apps Script) → ส่ง/อ่านรวม → CSV/สำรอง
const { chromium, devices } = require('playwright');
const BASE = process.env.URL || 'http://localhost:8765';
(async () => {
  const b = await chromium.launch(); const out = [];
  for (const [tag, opt] of [['desktop', { viewport: { width: 1360, height: 900 } }], ['mobile', devices['iPhone 13']]]) {
    const ctx = await b.newContext({ ...opt, acceptDownloads: true }); const pg = await ctx.newPage(); const errs = [];
    pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    const ok = (n, c) => out.push(`${tag} ${c ? 'PASS' : 'FAIL'} ${n}`);
    // จำลอง Apps Script ของทีม
    const sheet = [{ eid: 'remote-1', ts: '2026-10-02T03:00:00.000Z', action: 'word', docKind: 'program', programId: 'premote', docCode: 'PL SEA 0103/2569', school: 'โรงเรียนจากเครื่องอื่น', course: 'วิทยาศาสตร์ทางทะเล', durationMode: 'overnight', days: 2, nights: 1, students: 40, specialPrice: 3500 }];
    let posts = 0;
    await pg.route('https://script.google.com/macros/s/TEST/exec**', async route => {
      const r = route.request();
      if (r.method() === 'POST') { posts++; sheet.push(JSON.parse(r.postData())); return route.fulfill({ status: 200, body: '{"ok":true}' }); }
      const key = new URL(r.url()).searchParams.get('key');
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(key === 'eq-testkey' ? { ok: true, events: sheet } : { ok: false, error: 'key' }) });
    });
    const sheetClose = async () => { const sh = pg.locator('[aria-label="บันทึกไฟล์"]'); if (await sh.count()) await sh.getByRole('button', { name: 'ปิด' }).first().click(); };
    const make = async (brief) => {
      await pg.goto(BASE + '/#/build'); await pg.reload(); await pg.waitForTimeout(700);
      const bt = pg.getByRole('button', { name: /บรีฟ/ }).first(); if (!(await pg.locator('textarea').count()) && await bt.count()) { await bt.click(); await pg.waitForTimeout(300); }
      await pg.locator('textarea').first().fill(brief); await pg.getByRole('button', { name: /เริ่มงานใหม่/ }).first().click(); await pg.waitForTimeout(2000);
    };
    const word = async () => { if (tag === 'desktop') { await Promise.all([pg.waitForEvent('download'), pg.getByRole('button', { name: /^ดาวน์โหลด/ }).first().click()]); } else { await pg.getByRole('button', { name: /^ดาวน์โหลด/ }).first().click(); await pg.getByText('ไฟล์พร้อมแล้ว').waitFor(); await sheetClose(); } await pg.waitForTimeout(400); };
    await make('โรงเรียนสตรีวิทยา ม.2 จำนวน 80 คน ค่าย STEM 2 วัน 1 คืน วันที่ 20-21 ม.ค. 2570 ราคา 3990 บาท');
    await word(); await word();                                     // งานเดียวกัน 2 ครั้ง = 1 โปรแกรม
    await make('โรงเรียนเตรียมอุดมศึกษา ม.4 จำนวน 120 คน ค่ายดาราศาสตร์ 3 วัน 2 คืน วันที่ 5-7 ก.พ. 2570 ราคา 4590 บาท');
    await word();
    await pg.goto(BASE + '/#/build'); await pg.waitForTimeout(500);
    await pg.getByRole('button', { name: /ทะเบียนโปรแกรม/ }).first().click(); await pg.waitForTimeout(800);
    let body = await pg.locator('body').innerText();
    ok('local: 2 programs, 3 files', /2\s*\n?\s*โปรแกรม/.test(body) && /3\s*\n?\s*ไฟล์ที่สร้าง/.test(body));
    ok('lists both schools', body.includes('โรงเรียนสตรีวิทยา') && body.includes('โรงเรียนเตรียมอุดมศึกษา'));
    // ตั้งค่าชีตทีม
    await pg.getByRole('button', { name: 'ตั้งค่าชีตบันทึกของทีม' }).click();
    await pg.getByLabel('ที่อยู่ Web app').fill('https://script.google.com/macros/s/TEST/exec');
    await pg.getByLabel('รหัสทีม').fill('eq-testkey');
    await pg.getByRole('button', { name: 'บันทึกและเชื่อมต่อ' }).click(); await pg.waitForTimeout(1500);
    body = await pg.locator('body').innerText();
    ok('team sheet merged (3 programs)', /3\s*\n?\s*โปรแกรม/.test(body) && body.includes('โรงเรียนจากเครื่องอื่น'));
    // สร้างอีกงาน → ต้องส่งเข้าชีต
    await make('โรงเรียนบางมด ม.1 จำนวน 50 คน ค่ายภาษาจีน 1 วัน วันที่ 9 ธ.ค. 2569 ราคา 1500 บาท'); await word();
    ok('POST sent to team sheet', posts >= 1);
    await pg.getByRole('button', { name: /ทะเบียนโปรแกรม/ }).first().click(); await pg.waitForTimeout(1200);
    ok('4 programs after new one', /4\s*\n?\s*โปรแกรม/.test(await pg.locator('body').innerText()));
    await pg.getByLabel('ค้นหาโปรแกรม').fill('บางมด'); await pg.waitForTimeout(300);
    ok('search filters', /รายการโปรแกรม \(1\)/.test(await pg.locator('body').innerText()));
    if (tag === 'desktop') { const [d] = await Promise.all([pg.waitForEvent('download'), pg.getByRole('button', { name: /Excel \(CSV\)/ }).click()]); ok('csv download ' + d.suggestedFilename(), /\.csv$/.test(d.suggestedFilename())); }
    const ow = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); ok('no overflow', ow <= 0);
    await pg.screenshot({ path: `/tmp/reg_${tag}.png`, fullPage: false });
    ok('no errors', errs.length === 0); if (errs.length) out.push(...errs.slice(0, 3));
    await ctx.close();
  }
  console.log(out.join('\n')); await b.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
