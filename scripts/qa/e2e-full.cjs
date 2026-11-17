// ตรวจทุกฟังก์ชันในเว็บ: บรีฟ → 6 ขั้น (เปลี่ยนหลักสูตร/แม่แบบ/กิจกรรม/ช่องรายช่วง/Add-on/ธีมรายวัน/ราคา/งบ/ภาพ) → พรีวิว 4 เอกสาร → ดาวน์โหลดทุกแบบ → ส่งออก/นำเข้า → คลังข้อมูลทุกแท็บ → หน้าแรก
const { chromium, devices } = require('playwright');
const fs = require('fs');
const BRIEF = 'โรงเรียนสตรีวิทยา ม.2 จำนวน 80 คน ครู 6 คน ค่าย 2 วัน 1 คืน วันแรกภาษาอังกฤษ วันที่ 2 วิทยาศาสตร์ทะเล วันที่ 20-21 ม.ค. 2570 ณ โรงแรมกาสะรองรีสอร์ทพัทยา ราคาปกติ 4590 ลดเหลือ 3790 บาท เสริมภาษาจีน';
(async () => {
  const b = await chromium.launch(); const report = [];
  for (const [tag, opt] of [['desktop', { viewport: { width: 1360, height: 900 } }], ['mobile', devices['iPhone 13']]]) {
    const ctx = await b.newContext({ ...opt, acceptDownloads: true }); const pg = await ctx.newPage(); const errs = [];
    pg.on('pageerror', e => errs.push('pageerror ' + e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push('console ' + m.text()); });
    const dls = []; pg.on('download', d => dls.push(d.suggestedFilename()));
    let maxOw = 0; const ow = async (where) => { const v = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); if (v > maxOw) { maxOw = v; report.push(`${tag} overflow ${v}px @ ${where}`); } };
    const ok = (name, cond) => report.push(`${tag} ${cond ? 'PASS' : 'FAIL'} ${name}`);
    const closeSheet = async () => { const sh = pg.locator('[aria-label="บันทึกไฟล์"]'); if (await sh.count()) { await sh.getByRole('button', { name: /^ดาวน์โหลด/ }).first().click(); await pg.waitForTimeout(1500); await sh.getByRole('button', { name: 'ปิด' }).first().click(); } };
    await pg.goto('' + (process.env.URL || 'http://localhost:8765') + '/#/'); await pg.waitForTimeout(800); await ow('home');
    ok('home renders courses', (await pg.locator('text=PL SEA 0103').count()) > 0);
    await pg.goto('' + (process.env.URL || 'http://localhost:8765') + '/#/build'); await pg.waitForTimeout(600);
    await pg.locator('textarea').first().fill(BRIEF);
    await pg.getByRole('button', { name: /เริ่มงานใหม่/ }).first().click(); await pg.waitForTimeout(2500); await ow('brief');
    const rep = await pg.locator('body').innerText();
    ok('brief: ธีมรายวัน read', /ธีมรายวัน[\s\S]{0,40}วันที่ 1 ภาษาอังกฤษ · วันที่ 2 วิทยาศาสตร์ทางทะเล/.test(rep));
    ok('brief: add-on read', /กิจกรรมเสริม[\s\S]{0,20}ภาษาจีน/.test(rep));
    ok('brief: venue photos', /\d รูป \(Kasalong/.test(rep));
    const prev = async () => (await pg.locator('.doc-preview').innerText());
    // step 2..6
    for (let i = 0; i < 5; i++) {
      const nx = pg.getByRole('button', { name: /^ถัดไป:/ }); await nx.click(); await pg.waitForTimeout(700); await ow('step ' + (i + 2));
      const body = await pg.locator('body').innerText();
      if (i === 1) { // กิจกรรม
        ok('activities: add-on panel shows ภาษาจีน on', /✓ ภาษาจีน/.test(body));
        await pg.getByRole('button', { name: /\+ คณิตศาสตร์/ }).click(); await pg.waitForTimeout(400);
        ok('activities: add math add-on → preview row', /กิจกรรมเสริมคณิตศาสตร์/.test(await prev()));
        await pg.getByRole('button', { name: /✓ คณิตศาสตร์/ }).click(); await pg.waitForTimeout(300);
      }
      if (i === 2) { // กำหนดการ
        ok('schedule: day mix panel', /ธีมรายวัน \(Mix หลักสูตร\)/.test(body));
        const sel = pg.locator('select').filter({ hasText: 'วิทยาศาสตร์ทางทะเล' }).nth(1);
        await sel.selectOption('PL STM 0101'); await pg.waitForTimeout(500);
        const pv = await prev(); ok('schedule: switch day2 → STEM changes preview', /STEM/.test(pv) && /วันที่ 2 STEM/.test(pv));
        await sel.selectOption('PL SEA 0103'); await pg.waitForTimeout(400);
      }
      if (i === 3) { // ราคา
        const pv = await prev(); ok('price: preview shows 3,790 (no paid add-on)', /ลดเหลือเพียง 3,790/.test(pv));
      }
    }
    // preview each doc kind
    for (const k of ['ใบเสนอราคา', 'ขอราคาโรงแรม', 'Run-down', 'โปรแกรม']) {
      const btn = pg.getByRole('button', { name: new RegExp(k) }).first(); if (await btn.count()) { await btn.click(); await pg.waitForTimeout(400); }
    }
    const pvAll = await prev();
    ok('preview: no typo เปิดประตู่', !/ประตู่/.test(pvAll));
    ok('preview: no undefined/NaN', !/undefined|NaN/.test(pvAll));
    // downloads
    if (tag === 'desktop') {
      await pg.getByRole('button', { name: /ดาวน์โหลดครบชุด 4 ไฟล์/ }).click(); await pg.waitForTimeout(4000);
      ok('download all 4 Word', dls.filter(x => x.endsWith('.docx')).length >= 4);
      await Promise.all([pg.waitForEvent('download', { timeout: 120000 }), pg.getByRole('button', { name: /บันทึกโปรแกรมค่ายเป็น PDF/ }).click()]);
      ok('download PDF', dls.some(x => x.endsWith('.pdf')));
      // export / import
      const [d] = await Promise.all([pg.waitForEvent('download', { timeout: 20000 }), pg.getByRole('button', { name: 'ส่งออกงาน' }).click()]);
      const p = '/tmp/full_export.json'; await d.saveAs(p); const j = JSON.parse(fs.readFileSync(p, 'utf8'));
      ok('export json has dayCourses+addons', JSON.stringify(j).includes('dayCourses') && JSON.stringify(j).includes('PL CHI 0109'));
    } else {
      await pg.getByRole('button', { name: /^PDF$/ }).first().click(); await pg.getByText('ไฟล์พร้อมแล้ว').waitFor({ timeout: 120000 }); await closeSheet();
      ok('mobile PDF via sheet', dls.some(x => x.endsWith('.pdf')));
      await pg.getByRole('button', { name: /ดาวน์โหลดครบชุด 4 ไฟล์/ }).click(); await pg.getByText('ไฟล์พร้อมแล้ว').waitFor({ timeout: 60000 });
      await pg.getByRole('button', { name: /ดาวน์โหลดทั้ง 4 ไฟล์/ }).click(); await pg.waitForTimeout(3000);
      ok('mobile 4 Word via sheet', dls.filter(x => x.endsWith('.docx')).length >= 4);
      await pg.getByRole('button', { name: 'ปิด' }).first().click();
    }
    // data hub tabs
    await pg.goto('' + (process.env.URL || 'http://localhost:8765') + '/#/data'); await pg.waitForTimeout(600);
    for (const t of ['หลักสูตร', 'กิจกรรม', 'มาตรฐานกิจกรรม', 'ที่พัก', 'ราคา', 'บริษัท']) {
      const btn = pg.getByRole('button', { name: new RegExp('^' + t) }).first(); if (await btn.count()) { await btn.click(); await pg.waitForTimeout(350); await ow('hub ' + t); }
    }
    ok('hub: no typo', !/ประตู่|STROM|ศาศตร์/.test(await pg.locator('body').innerText()));
    ok('no console/page errors', errs.length === 0); if (errs.length) report.push(...errs.slice(0, 5).map(e => '   ' + e));
    report.push(`${tag} downloads: ${dls.join(' | ')}`);
    await ctx.close();
  }
  console.log(report.join('\n')); await b.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
