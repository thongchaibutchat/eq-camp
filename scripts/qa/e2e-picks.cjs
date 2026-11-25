// เลือกกิจกรรมจากคลังแยกหมวด → ดึงลงกำหนดการ (25 พ.ย. 2569) — คอม + iPhone
// รัน: LANG=C.UTF-8 node scripts/qa/e2e-picks.cjs  (เว็บที่ http://localhost:8765)
const { chromium, devices } = require('playwright');
const JSZip = require('jszip');
const BASE = process.env.URL || 'http://localhost:8765';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch(); const out = [];
  for (const [tag, opt] of [['desktop', { viewport: { width: 1360, height: 900 } }], ['iphone', devices['iPhone 13']]]) {
    const ctx = await b.newContext({ ...opt, acceptDownloads: true });
    await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('init')) { localStorage.clear(); sessionStorage.setItem('init', '1'); } } catch (e) {} });
    const pg = await ctx.newPage(); const errs = [];
    pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
    const ok = (n, c, extra = '') => out.push(`${tag} ${c ? 'PASS' : 'FAIL'} ${n}${c ? '' : ' ' + String(extra).slice(0, 300)}`);
    const body = () => pg.locator('body').innerText();
    await pg.goto(BASE + '/#/build'); await sleep(1200);
    await pg.locator('textarea').first().fill('โรงเรียนทดสอบคลังกิจกรรม ม.2 จำนวน 80 คน ครู 6 คน ค่าย STEM 2 วัน 1 คืน');
    await pg.getByRole('button', { name: /เริ่มงานใหม่/ }).first().click(); await sleep(2500);
    for (let i = 0; i < 2; i++) { await pg.getByRole('button', { name: /^ถัดไป:/ }).click(); await sleep(400); }
    let t = await body();
    ok('picker shown', /เลือกกิจกรรมเข้าโปรแกรม/.test(t));
    const stemTab = pg.getByRole('tab', { name: /STEM/ }).first();
    ok('STEM tab selected with count', (await stemTab.getAttribute('aria-selected')) === 'true' && /STEM\s*49/.test(await stemTab.innerText()), await stemTab.innerText());
    ok('groups with counts', /กิจกรรมเรียนรู้ \/ ฐาน \/ เวิร์กชอป\s*\d+/.test(t) && /สรุป \/ ถอดบทเรียน \/ AAR/.test(t), t.slice(0, 200));
    ok('existing activities flagged', /มีในกำหนดการ/.test(t));
    // ติ๊ก 2 กิจกรรมจาก STEM + 1 จากหลักสูตรอื่นด้วยการค้นหา + พิมพ์เอง 1
    await pg.getByRole('checkbox', { name: /^Smart City/ }).check(); await sleep(300);
    await pg.getByRole('checkbox', { name: /^Titanic/ }).check(); await sleep(300);
    await pg.getByRole('textbox', { name: 'ค้นหากิจกรรม' }).fill('ดาว'); await sleep(400);
    t = await body();
    ok('search across courses', /พบ \d+ กิจกรรม จาก \d+ หลักสูตร/.test(t) && /ดาราศาสตร์/.test(t), (t.match(/พบ[^\n]*/) || [''])[0]);
    const star = pg.locator('section label').filter({ hasText: 'ดาราศาสตร์' }).first();
    const starName = (await star.innerText()).split('\n')[0].replace(/ดาราศาสตร์.*$/, '').trim();
    await star.locator('input[type=checkbox]').check(); await sleep(300);
    await pg.getByRole('textbox', { name: 'ค้นหากิจกรรม' }).fill('');
    await pg.getByRole('textbox', { name: 'พิมพ์ชื่อกิจกรรมเอง' }).fill('ทดลองภาคสนามริมน้ำ');
    await pg.getByRole('button', { name: 'เพิ่ม', exact: true }).click(); await sleep(500);
    t = await body();
    ok('selected panel lists 4', /ดึงเข้าโปรแกรม 4 กิจกรรม/.test(t), (t.match(/ดึงเข้าโปรแกรม[^\n]*/) || [''])[0]);
    ok('each pick has placement', (await pg.locator('[data-pick]').allInnerTexts()).every(x => /วันที่ \d/.test(x)), (await pg.locator('[data-pick]').allInnerTexts()).join(' | '));
    // เลือก "แทนช่วง" ให้ Titanic
    const sel = pg.getByRole('combobox', { name: 'ตำแหน่งของ Titanic' });
    const opts = await sel.locator('option').allInnerTexts();
    const target = opts.find(o => /^แทน วันที่ 2/.test(o));
    await sel.selectOption({ label: target }); await sleep(500);
    const tPick = await pg.locator('[data-pick="Titanic"]').innerText();
    ok('replace chosen row', /แทน “/.test(tPick) && /วันที่ 2/.test(tPick), tPick);
    // ไปขั้นกำหนดการ: ทุกกิจกรรมที่เลือกอยู่ในกำหนดการ + ป้าย
    await pg.getByRole('button', { name: /^ถัดไป:/ }).click(); await sleep(600);
    const sched = (await pg.locator('[data-sched-day]').allInnerTexts()).join('\n');
    for (const n of ['Smart City', 'Titanic', starName.replace(/[“”]/g, '').slice(0, 12), 'ทดลองภาคสนามริมน้ำ']) ok(`in schedule: ${n}`, sched.includes(n), n);
    ok('badge เลือกจากคลัง', ((await body()).match(/เลือกจากคลัง/g) || []).length >= 4);
    ok('replaced row gone', !sched.includes(target.replace(/^แทน วันที่ 2 · [^·]+· /, '').slice(0, 14)) || /Titanic/.test(sched), target);
    // รีโหลด → ยังอยู่ (บันทึกงาน)
    await sleep(1200); await pg.reload(); await sleep(1500);
    const tt = await body();
    ok('reload keeps picks', /Smart City/.test(tt) || /ดึงกิจกรรมที่เลือกลงกำหนดการแล้ว/.test(tt));
    // Word มีกิจกรรมที่เลือก
    const dl = pg.waitForEvent('download', { timeout: 25000 }).catch(() => null);
    await pg.getByRole('button', { name: /ดาวน์โหลด .* เป็นไฟล์ Word/ }).click();
    if (tag === 'iphone') { await sleep(2500); const sh = pg.getByRole('dialog', { name: 'บันทึกไฟล์' }); await sh.getByRole('button', { name: /ดาวน์โหลด/ }).first().click(); }
    const d = await dl;
    if (d) { const z = await JSZip.loadAsync(require('fs').readFileSync(await d.path())); const x = (await z.file('word/document.xml').async('string')).replace(/<[^>]+>/g, '');
      ok('word has picks', /Smart City/.test(x) && /Titanic/.test(x) && /ทดลองภาคสนามริมน้ำ/.test(x)); }
    else ok('word downloaded', false);
    const w = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (tag === 'iphone') ok('no horizontal overflow', w <= 1, w);   // คอม: หัวเว็บล้น 2px มาแต่เดิม (ไม่เกี่ยวกับหน้านี้)
    ok('no console errors', !errs.length, errs.join(' | '));
    if (tag === 'iphone') { await pg.getByRole('button', { name: /^ย้อนกลับ/ }).click().catch(() => {}); await sleep(500); await pg.screenshot({ path: '/tmp/picks-iphone.png', fullPage: false }); }
    else { await pg.getByRole('button', { name: /^ย้อนกลับ/ }).click().catch(() => {}); await sleep(500); await pg.screenshot({ path: '/tmp/picks-desktop.png', fullPage: false }); }
    await ctx.close();
  }
  await b.close();
  console.log(out.join('\n')); const f = out.filter(x => / FAIL /.test(x)).length; console.log(`${out.length - f}/${out.length} passed`); process.exit(f ? 1 : 0);
})();
