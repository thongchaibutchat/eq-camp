// ขยายเวลาเลิก + เพิ่มช่วงเวลา + งานของฉัน (บันทึก/เปิดทำต่อ) — เดสก์ท็อป + iPhone
const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const out = [];
  for (const [tag, opt] of [['desktop', { viewport: { width: 1360, height: 900 } }], ['mobile', devices['iPhone 13']]]) {
    const ctx = await b.newContext(opt); const pg = await ctx.newPage(); const errs = [];
    pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    const ok = (n, c) => out.push(`${tag} ${c ? 'PASS' : 'FAIL'} ${n}`);
    const prev = () => pg.locator('.doc-preview').innerText();
    const URL = (process.env.URL || 'http://localhost:8765') + '/#/build';
    await pg.goto(URL); await pg.waitForTimeout(600);
    await pg.locator('textarea').first().fill('โรงเรียนสตรีวิทยา ม.2 จำนวน 80 คน ครู 6 คน ค่ายคณิตศาสตร์ 2 วัน 1 คืน วันที่ 20-21 ม.ค. 2570 ณ โรงแรมกาสะรองรีสอร์ท ราคาปกติ 4590 ลดเหลือ 3790 บาท');
    await pg.getByRole('button', { name: /เริ่มงานใหม่/ }).first().click(); await pg.waitForTimeout(2500);
    ok('preview default return 11.00', /11\.00 น\. เป็นต้นไป/.test(await prev()));
    for (let i = 0; i < 3; i++) { await pg.getByRole('button', { name: /^ถัดไป:/ }).click(); await pg.waitForTimeout(500); }
    // ขยายวันที่ 2 ถึง 16.00
    await pg.getByLabel('ขยายเวลาเลิกวันที่ 2').selectOption('16.00'); await pg.waitForTimeout(700);
    let pv = await prev(); let body = await pg.locator('body').innerText();
    ok('day2 now ends 16.00', /16\.00 น\. เป็นต้นไป/.test(pv) && /เลิก 16\.00 น\./.test(body));
    ok('extended rows badge', /ช่วงที่ขยาย/.test(body));
    ok('lunch added on day 2', /วันที่ 2[\s\S]*อาหารกลางวัน/.test(pv));
    ok('closing moved before return', /15\.00 – 16\.00 น\.\s*กิจกรรม “The Next Step”/.test(pv));
    // เพิ่มช่วงเวลาเอง วันที่ 1
    await pg.getByRole('button', { name: '+ เพิ่มช่วงเวลา' }).first().click(); await pg.waitForTimeout(300);
    const box = pg.locator('input[type=time]'); await box.nth(0).fill('20:00'); await box.nth(1).fill('20:30');
    await pg.getByPlaceholder('เลือกกิจกรรมของหลักสูตร หรือพิมพ์เอง').fill('กิจกรรมดูดาวรอบกองไฟ');
    await pg.getByRole('button', { name: 'เพิ่มลงกำหนดการ' }).click(); await pg.waitForTimeout(500);
    pv = await prev(); ok('custom slot in preview', /20\.00 – 20\.30 น\.\s*กิจกรรมดูดาวรอบกองไฟ/.test(pv));
    ok('custom slot badge', /เพิ่มเอง/.test(await pg.locator('body').innerText()));
    // แก้ช่วงที่เพิ่มเอง → ลบ
    await pg.getByRole('button', { name: /^แก้ไขแถว 20\.00 – 20\.30/ }).click(); await pg.getByRole('button', { name: 'ลบแถวนี้' }).click(); await pg.waitForTimeout(400);
    ok('custom slot removed', !/กิจกรรมดูดาวรอบกองไฟ/.test(await prev()));
    // งานของฉัน: โหลดหน้าใหม่ → งานยังอยู่ · เริ่มงานใหม่ → เปิดงานเดิมทำต่อ
    await pg.waitForTimeout(1200); await pg.reload(); await pg.waitForTimeout(1500);
    ok('after reload still extended', /16\.00 น\. เป็นต้นไป/.test(await prev()));
    await pg.getByRole('button', { name: /^งานของฉัน/ }).click(); await pg.waitForTimeout(400);
    body = await pg.locator('body').innerText(); ok('jobs list has job', /งานของฉัน[\s\S]*โรงเรียนสตรีวิทยา[\s\S]*กำลังทำอยู่/.test(body));
    await pg.locator('textarea').first().fill('โรงเรียนบ้านใหม่ จำนวน 40 คน ค่ายภาษาอังกฤษ 1 วัน วันที่ 5 ก.พ. 2570 ราคา 990 บาท');
    await pg.getByRole('button', { name: /เริ่มงานใหม่/ }).first().click(); await pg.waitForTimeout(2000);
    body = await pg.locator('body').innerText(); ok('two jobs listed', /โรงเรียนบ้านใหม่/.test(body) && /โรงเรียนสตรีวิทยา/.test(body));
    await pg.getByRole('button', { name: 'เปิดทำต่อ' }).first().click(); await pg.waitForTimeout(1500);
    pv = await prev(); ok('reopened old job intact', /สตรีวิทยา/.test(pv) && /16\.00 น\. เป็นต้นไป/.test(pv));
    const ow = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); ok('no overflow ' + ow, ow <= 0);
    await pg.screenshot({ path: `/tmp/extend_${tag}.png`, fullPage: false });
    ok('no errors', errs.length === 0); if (errs.length) out.push(...errs.slice(0, 3));
    await ctx.close();
  }
  await b.close(); console.log(out.join('\n')); console.log(out.filter(x => /PASS/.test(x)).length + '/' + out.filter(x => / (PASS|FAIL) /.test(x)).length);
})();
