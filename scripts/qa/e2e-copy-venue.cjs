// สำเนางานไม่ทับกัน + งานทั้งหมด (ค้าง) + ที่พักพิมพ์ชื่อแล้วดึงภาพแยกหมวด (25 พ.ย. 2569) — คอม + iPhone
// เคสผู้ใช้: ทำสำเนา 1 แล้วสำเนา 2 → แก้สำเนา 2 กลับไปบันทึกลงสำเนา 1 (ทับกัน)
const { chromium, devices } = require('playwright');
const BASE = process.env.URL || 'http://localhost:8765';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch(); const out = [];
  for (const [tag, opt] of [['desktop', { viewport: { width: 1360, height: 900 } }], ['iphone', devices['iPhone 13']]]) {
    const ctx = await b.newContext(opt);
    await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('init') && !localStorage.getItem('qa.keep')) { localStorage.clear(); } sessionStorage.setItem('init', '1'); } catch (e) {} });
    const pg = await ctx.newPage(); const errs = [];
    pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
    const ok = (n, c, extra = '') => out.push(`${tag} ${c ? 'PASS' : 'FAIL'} ${n}${c ? '' : ' ' + String(extra).slice(0, 300)}`);
    const jobs = () => pg.evaluate(() => JSON.parse(localStorage.getItem('eqcamp.jobs.v1') || '[]').map(j => ({ id: j.id, name: j.name, dates: j.snap?.camp?.dates, done: !!j.done, copy: j.snap?.copyOf?.no || 0 })));
    const cur = () => pg.evaluate(() => (document.querySelector('[data-current-job]') || {}).getAttribute?.('data-current-job') || '');
    const setDates = async v => { await pg.getByRole('button', { name: /^2\s*หลักสูตร/ }).first().click().catch(() => {}); await sleep(300);
      const f = pg.locator('label:has-text("วันที่จัดค่าย")').locator('xpath=..').locator('input').first(); await f.fill(v); await sleep(1500); };
    await pg.goto(BASE + '/#/build'); await sleep(1200);
    await pg.locator('textarea').first().fill('โรงเรียนต้นฉบับทดสอบ ม.2 จำนวน 60 คน ค่าย STEM 2 วัน 1 คืน วันที่ 1 ธันวาคม 2569');
    await pg.getByRole('button', { name: /เริ่มงานใหม่/ }).first().click(); await sleep(2500);
    let J = await jobs();
    ok('original saved', J.length === 1 && J[0].name === 'โรงเรียนต้นฉบับทดสอบ', JSON.stringify(J));
    const orig = J[0].id;
    // สำเนา 1 จากต้นฉบับ (ปุ่มในรายการงาน ขั้นบรีฟ)
    await pg.getByRole('button', { name: /^1\s*บรีฟ/ }).first().click().catch(() => {}); await sleep(400);
    await pg.getByRole('button', { name: 'ทำสำเนา โรงเรียนต้นฉบับทดสอบ', exact: true }).click(); await sleep(1500);
    ok('copy 1 opened + named', (await cur()) === 'โรงเรียนต้นฉบับทดสอบ (สำเนา 1)', await cur());
    await setDates('วันที่ 5 ธันวาคม 2569');
    J = await jobs(); const c1 = J.find(j => j.copy === 1);
    ok('copy 1 edit saved to copy 1 only', c1 && /5 ธันวาคม/.test(c1.dates) && J.find(j => j.id === orig).dates.includes('1 ธันวาคม') && c1.name === 'โรงเรียนต้นฉบับทดสอบ (สำเนา 1)', JSON.stringify(J));
    // สำเนา 2 (จากสำเนา 1 ที่เปิดอยู่) ผ่านหน้าต่างงานทั้งหมด
    await pg.getByRole('button', { name: /^งานทั้งหมด/ }).click(); await sleep(500);
    const dlg = pg.getByRole('dialog', { name: 'งานทั้งหมด' });
    ok('all-jobs dialog lists all', (await dlg.locator('li').count()) === 2, await dlg.locator('li').count());
    await dlg.getByRole('button', { name: 'ทำสำเนา โรงเรียนต้นฉบับทดสอบ (สำเนา 1)', exact: true }).click(); await sleep(1500);
    ok('copy 2 opened + numbered', (await cur()) === 'โรงเรียนต้นฉบับทดสอบ (สำเนา 2)', await cur());
    await setDates('วันที่ 9 ธันวาคม 2569');
    J = await jobs();
    const a = J.find(j => j.id === orig), x1 = J.find(j => j.copy === 1), x2 = J.find(j => j.copy === 2);
    ok('copy 2 edit does NOT touch copy 1', x2 && /9 ธันวาคม/.test(x2.dates) && /5 ธันวาคม/.test(x1.dates) && /1 ธันวาคม/.test(a.dates), JSON.stringify(J));
    ok('3 distinct jobs', J.length === 3 && new Set(J.map(j => j.name)).size === 3, JSON.stringify(J.map(j => j.name)));
    // เปิดต้นฉบับแล้วแก้ → บันทึกลงต้นฉบับ
    await pg.getByRole('button', { name: /^งานทั้งหมด/ }).click(); await sleep(400);
     await dlg.getByRole('button', { name: /^ทั้งหมด 3/ }).click(); await sleep(200);
    await dlg.locator('li[data-job="โรงเรียนต้นฉบับทดสอบ"]').getByRole('button', { name: /เปิดทำต่อ/ }).click(); await sleep(1200);
    ok('reopen original', (await cur()) === 'โรงเรียนต้นฉบับทดสอบ', await cur());
    await setDates('วันที่ 2 ธันวาคม 2569');
    J = await jobs();
    ok('original edit saved to original only', /2 ธันวาคม/.test(J.find(j => j.id === orig).dates) && /9 ธันวาคม/.test(J.find(j => j.copy === 2).dates) && /5 ธันวาคม/.test(J.find(j => j.copy === 1).dates), JSON.stringify(J));
    // ค้าง vs เสร็จ: หน้าต่างเริ่มที่ "กำลังทำ"
    await pg.getByRole('button', { name: /^งานทั้งหมด/ }).click(); await sleep(400);
    ok('dialog starts at กำลังทำ', (await dlg.getByRole('button', { name: /^กำลังทำ 3/ }).getAttribute('aria-pressed')) === 'true');
    await dlg.getByRole('button', { name: 'ปิด', exact: true }).click(); await sleep(300);
    // สองแท็บ: อีกแท็บแก้งานเดียวกัน → เตือน
    await pg.evaluate(() => localStorage.setItem('qa.keep', '1'));
    const p2 = await ctx.newPage(); await p2.goto(BASE + '/#/build'); await sleep(1500);
    await p2.getByRole('button', { name: /^2\s*หลักสูตร/ }).first().click().catch(() => {}); await sleep(300);
    await p2.locator('label:has-text("วันที่จัดค่าย")').locator('xpath=..').locator('input').first().fill('วันที่ 3 ธันวาคม 2569'); await sleep(1800);
    ok('other-tab warning', /ถูกแก้จากอีกแท็บ/.test(await pg.locator('body').innerText()));
    await p2.close();
    // ที่พัก: พิมพ์ชื่อเล่นไทย → เลือก → จังหวัด + ภาพแยกหมวด
    await pg.getByRole('button', { name: /^2\s*หลักสูตร/ }).first().click().catch(() => {}); await sleep(300);
    const vb = pg.getByRole('combobox', { name: 'ที่พัก / สถานที่จัดงาน' }).first();
    await vb.fill('กาสะลอง'); await sleep(400);
    const vopt = pg.getByRole('option').first(); const optText = await vopt.innerText();
    ok('venue suggest by Thai alias', /Kasalong Resort and Spa/.test(optText) && /ป้าย\/มุมสูง \d/.test(optText), optText);
    await vopt.locator('button').click(); await sleep(2500);
    const prov = await pg.locator('label:text-is("จังหวัด")').locator('xpath=..').locator('input').first().inputValue();
    ok('province filled', prov === 'ชลบุรี', prov);
    const cats = await pg.locator('[data-venue-cats]').first().innerText();
    ok('venue photo categories shown', /ป้าย \/ มุมสูง/.test(cats) && /ห้องพัก/.test(cats) && /ห้องประชุม 0 · ขาด 2/.test(cats), cats);
    const vimgs = await pg.evaluate(() => JSON.parse(localStorage.getItem('eqcamp.jobs.v1') || '[]').length);
    await vb.fill('โคราช'); await sleep(400);
    ok('venue search by area', (await pg.getByRole('option').allInnerTexts()).some(t => /Fountain Tree/.test(t)));
    await vb.fill('กาสะลอง'); await sleep(300); await vb.press('Enter'); await sleep(2500);   // พิมพ์แล้วกด Enter = เลือกรายการแรก
    // ขั้นภาพ: ภาพที่พักติดป้ายหมวด
    await pg.getByRole('button', { name: /^6\s*ภาพ/ }).first().click(); await sleep(1500);
    const imgText = await pg.locator('body').innerText(); 
    ok('photo step labels categories', /ป้าย \/ มุมสูง/.test(imgText) && /ห้องพัก/.test(imgText) && (imgText.match(/สระ \/ สิ่งอำนวยความสะดวก/g) || []).length >= 1, '');
    // ค้นหาทั้งระบบ: พิมพ์ชื่อกิจกรรม → Enter = ใส่ในงานนี้ · พิมพ์ชื่อที่พัก → Enter = ใช้กับงานนี้
    await pg.keyboard.press('Escape'); await pg.evaluate(() => (document.activeElement && document.activeElement.blur && document.activeElement.blur()));
    await pg.getByRole('button', { name: /ค้นหาทั้งระบบ/ }).click(); await sleep(400);
    await pg.keyboard.type('titanic'); await sleep(500);
    const sr = await pg.getByRole('listbox').innerText();
    ok('search shows catalog activity', /Titanic/.test(sr) && /ใส่ในงานนี้/.test(sr), sr.slice(0, 200));
    await pg.keyboard.press('Enter'); await sleep(1200);
    const pk = await pg.evaluate(() => { const j = JSON.parse(localStorage.getItem('eqcamp.jobs.v1') || '[]')[0]; return (j && j.snap && j.snap.camp && j.snap.camp.picks || []).length; });
    ok('search Enter adds pick', pk >= 1 && /ดึงเข้าโปรแกรม 1 กิจกรรม/.test(await pg.locator('body').innerText()), pk);
    await pg.getByRole('button', { name: /ค้นหาทั้งระบบ/ }).click(); await sleep(400);
    await pg.keyboard.type('loei palace'); await sleep(500); await pg.keyboard.press('Enter'); await sleep(2500);
    const prov2 = await pg.locator('label:text-is("จังหวัด")').locator('xpath=..').locator('input').first().inputValue();
    ok('search Enter uses venue', prov2 === 'เลย' && (await pg.getByRole('combobox', { name: 'ที่พัก / สถานที่จัดงาน' }).first().inputValue()) === 'Loei Palace Hotel', prov2);
    const w = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    ok('no horizontal overflow', w <= 1, w);
    ok('no console errors', !errs.length, errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(out.join('\n')); const f = out.filter(x => / FAIL /.test(x)).length; console.log(`${out.length - f}/${out.length} passed`); process.exit(f ? 1 : 0);
})();
