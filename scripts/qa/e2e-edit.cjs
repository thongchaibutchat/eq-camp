const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const out = [];
  for (const [tag, opt] of [['desktop', { viewport: { width: 1360, height: 900 } }], ['mobile', devices['iPhone 13']]]) {
    const ctx = await b.newContext(opt); const pg = await ctx.newPage(); const errs = [];
    pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    const ok = (n, c) => out.push(`${tag} ${c ? 'PASS' : 'FAIL'} ${n}`);
    const prev = () => pg.locator('.doc-preview').innerText();
    await pg.goto('' + (process.env.URL || 'http://localhost:8765') + '/#/build'); await pg.waitForTimeout(600);
    await pg.locator('textarea').first().fill('โรงเรียนสตรีวิทยา ม.2 จำนวน 80 คน ครู 6 คน ค่าย STEM 3 วัน 2 คืน ปาร์ตี้ธีม Under The Sea วันที่ 20-21 ม.ค. 2570 ณ โรงแรมจันทรา รีสอร์ท ราคา 3990 บาท');
    await pg.getByRole('button', { name: /เริ่มงานใหม่/ }).first().click(); await pg.waitForTimeout(2500);
    ok('brief party theme read', /ธีมปาร์ตี้[\s\S]{0,10}Under The Sea/.test(await pg.locator('body').innerText()));
    ok('preview party row', /กิจกรรมปาร์ตี้ธีม “Under The Sea”/.test(await prev()));
    // step 3 activities: ActsEditor
    for (let i = 0; i < 2; i++) { await pg.getByRole('button', { name: /^ถัดไป:/ }).click(); await pg.waitForTimeout(500); }
    let body = await pg.locator('body').innerText();
    ok('acts editor shown, all match', /กิจกรรมเชิงบูรณาการ \(หน้าปก\)/.test(body) && !/ไม่พบในกำหนดการ/.test(body));
    await pg.getByRole('button', { name: 'แก้รายการเอง' }).click(); await pg.waitForTimeout(300);
    await pg.getByLabel('กิจกรรมข้อ 1').fill('กิจกรรม “อะไรก็ไม่รู้”'); await pg.waitForTimeout(300);
    ok('acts editor flags mismatch', /1 ข้อไม่พบในกำหนดการ/.test(await pg.locator('body').innerText()));
    ok('cover preview uses edited acts', /อะไรก็ไม่รู้/.test(await prev()));
    const sel = pg.getByLabel('เพิ่มกิจกรรมจากกำหนดการ'); const optVal = await sel.locator('option').nth(1).getAttribute('value'); await sel.selectOption(optVal); await pg.waitForTimeout(300);
    ok('add from schedule', (await prev()).includes(optVal.replace(/^กิจกรรม\s*/, '').slice(0, 12)));
    await pg.getByRole('button', { name: 'กลับเป็นอัตโนมัติ' }).click(); await pg.waitForTimeout(300);
    ok('reset auto', !/อะไรก็ไม่รู้/.test(await prev()));
    // step 4 schedule: party panel + row edit
    await pg.getByRole('button', { name: /^ถัดไป:/ }).click(); await pg.waitForTimeout(500);
    await pg.getByRole('button', { name: 'Spy Night Party' }).click(); await pg.waitForTimeout(400);
    ok('party theme switch', /กิจกรรมปาร์ตี้ธีม “Spy Night Party”/.test(await prev()));
    await pg.getByRole('button', { name: 'พิมพ์ธีมเอง' }).click(); await pg.getByRole('textbox', { name: 'ธีมปาร์ตี้' }).fill('ย้อนยุค 90s'); await pg.waitForTimeout(400);
    ok('custom party theme', /ย้อนยุค 90s/.test(await prev()));
    await pg.getByRole('button', { name: /^แก้ไขแถว .*STEM Mission/ }).first().click(); await pg.waitForTimeout(300);
    await pg.getByLabel('ชื่อรายการ').fill('กิจกรรม “Rocket Mission”'); await pg.getByRole('button', { name: 'บันทึก', exact: true }).click(); await pg.waitForTimeout(500);
    let pv = await prev(); ok('row edit in schedule', /Rocket Mission/.test(pv));
    ok('cover still all match after edit', !/ไม่พบในกำหนดการ/.test(await pg.locator('body').innerText()));
    await pg.getByRole('button', { name: /^แก้ไขแถว .*Rocket Mission/ }).first().click(); await pg.getByRole('button', { name: 'คืนค่าเดิม' }).click(); await pg.waitForTimeout(400);
    ok('row revert', !/Rocket Mission/.test(await prev()));
    const ow = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); ok('no overflow ' + ow, ow <= 0);
    await pg.screenshot({ path: `/tmp/edit_${tag}.png` });
    ok('no errors', errs.length === 0); if (errs.length) out.push(...errs.slice(0, 3));
    await ctx.close();
  }
  console.log(out.join('\n')); await b.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
