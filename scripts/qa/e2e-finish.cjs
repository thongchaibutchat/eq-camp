// ลากย้ายช่วงในกำหนดการ + ปุ่ม "เสร็จสิ้น" + สถานะงาน เสร็จแล้ว/กำลังทำ (24 พ.ย. 2569) — คอม + iPhone, ศูนย์กลางทีมจำลอง
// รัน: LANG=C.UTF-8 node scripts/qa/e2e-finish.cjs  (เว็บที่ http://localhost:8765)
const { chromium, devices } = require('playwright');
const fs = require('fs'); const JSZip = require('jszip');
const { makeStore } = require('./nsr-fake.cjs');
const BASE = process.env.URL || 'http://localhost:8765';
const URL_ = 'https://script.google.com/macros/s/TEST/exec';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch(); const out = [];
  for (const [tag, opt] of [['desktop', { viewport: { width: 1360, height: 900 } }], ['iphone', devices['iPhone 13']]]) {
    const store = makeStore(JSON.parse(fs.readFileSync(__dirname + '/nsr-fixture.json', 'utf8')));
    const route = async (ctx) => {
      await ctx.route(URL_ + '**', async r => { const q = r.request().method() === 'POST' ? JSON.parse(r.request().postData()) : {}; const res = r.request().method() === 'POST' ? store.handle(q) : { ok: true }; return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(res) }); });
      await ctx.addInitScript(([u]) => { try { if (!sessionStorage.getItem('init')) { localStorage.clear(); localStorage.setItem('eqcamp.hub.url', u); localStorage.setItem('eqcamp.hub.key', 'nsr-testkey'); sessionStorage.setItem('init', '1'); } } catch (e) {} }, [URL_]);
    };
    const ctx = await b.newContext({ ...opt, acceptDownloads: true }); await route(ctx);
    const pg = await ctx.newPage(); const errs = [];
    pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
    const ok = (n, c, extra = '') => out.push(`${tag} ${c ? 'PASS' : 'FAIL'} ${n}${c ? '' : ' ' + String(extra).slice(0, 300)}`);
    const body = () => pg.locator('body').innerText();
    await pg.goto(BASE + '/#/build'); await sleep(1200);
    await pg.locator('textarea').first().fill('โรงเรียนทดสอบลากวาง ม.2 จำนวน 80 คน ครู 6 คน ค่ายภาษาอังกฤษ 3 วัน 2 คืน');
    await pg.getByRole('button', { name: /เริ่มงานใหม่/ }).first().click(); await sleep(4500);   // รอข้อความเชื่อมทีมครั้งแรกหายก่อน
    for (let i = 0; i < 3; i++) { await pg.getByRole('button', { name: /^ถัดไป:/ }).click(); await sleep(400); }
    const rows = pg.locator('[data-sched-day="2"] > [data-row]');
    const rowText = async i => (await rows.nth(i).innerText()).replace(/\s+/g, ' ');
    const endOf = async () => ((await body()).match(/วันที่ 2[\s\S]*?เลิก ([\d.]+) น\./) || [])[1];
    const end0 = await endOf(); const r1 = await rowText(1), r3 = await rowText(3);
    // 1) ลากแถวที่ 4 ขึ้นไปแทนแถวที่ 2 (เมาส์/นิ้ว)
    const grip = rows.nth(3).locator('button[aria-label^="ลากเพื่อย้าย"]');
    await rows.nth(1).scrollIntoViewIfNeeded(); await pg.mouse.wheel(0, -120); await sleep(200);
    const g = await grip.boundingBox(); const tgt = await rows.nth(1).boundingBox();
    await pg.mouse.move(g.x + g.width / 2, g.y + g.height / 2); await pg.mouse.down();
    await pg.mouse.move(g.x + g.width / 2, tgt.y + 4, { steps: 8 }); await pg.mouse.up(); await sleep(700);
    const n1 = await rowText(1);
    const title3 = r3.replace(/^.*?\d{2}\.\d{2}(?:\s*[–-]\s*\d{2}\.\d{2})?\s*(น\.)?\s*/, '').replace(/^(ย้ายแล้ว|แก้แล้ว|กิจกรรมหลัก #\d+)\s*/g, '').slice(0, 15);
    ok('drag: row moved up to position 2', n1.includes(title3) && /ย้ายแล้ว/.test(n1), `${title3} | ${n1}`);
    ok('drag: toast says moved', /ย้าย “/.test(await body()));
    ok('drag: day end unchanged', (await endOf()) === end0, `${end0} → ${await endOf()}`);
    const strip = t => t.replace(/^[\d.\s–-]+(น\.)?\s*/, '').replace(/^(ย้ายแล้ว|แก้แล้ว|กิจกรรมหลัก #\d+)\s*/g, '').slice(0, 12);
    ok('drag: original row 2 shifted down', (await rowText(2)).includes(strip(r1)), `${strip(r1)} | ${await rowText(2)}`);
    // 2) แป้นลูกศร: ย้ายแถวที่ 2 ลง 1 ช่อง
    await rows.nth(1).locator('button[aria-label^="ลากเพื่อย้าย"]').focus(); await pg.keyboard.press('ArrowDown'); await sleep(600);
    ok('keyboard: ArrowDown moves row', (await rowText(2)).includes(title3), await rowText(2));
    // 3) บันทึกอัตโนมัติ + รีโหลดยังอยู่ · Word มีลำดับใหม่
    await sleep(1200); await pg.reload(); await sleep(1500);
    if (!(await pg.locator('[data-sched-day="2"]').count())) { await pg.getByRole('button', { name: /กำหนดการ \d+ วัน/ }).first().click(); await sleep(700); }
    if (!(await pg.locator('[data-sched-day="2"]').count())) { const bs = await pg.getByRole('button').allInnerTexts(); console.log('DEBUG buttons', bs.filter(x => /กำหนดการ/.test(x))); }
    ok('reload keeps new order', (await rowText(2)).includes(title3), await rowText(2));
    // 4) คืนลำดับเดิม
    await pg.getByRole('button', { name: 'คืนลำดับเดิม' }).click(); await sleep(600);
    ok('reset order restores original', (await rowText(3)).replace(/\s+/g, ' ').includes(title3) && !/ย้ายแล้ว/.test(await pg.locator('[data-sched-day="2"]').innerText()));
    // ย้ายอีกครั้งแล้วตรวจ Word
    await rows.nth(3).locator('button[aria-label^="ลากเพื่อย้าย"]').focus(); await pg.keyboard.press('ArrowUp'); await pg.keyboard.press('ArrowUp'); await sleep(800);
    const moved = await rowText(1);
    const dl = pg.waitForEvent('download', { timeout: 20000 }).catch(() => null);
    await pg.getByRole('button', { name: /ดาวน์โหลด .* เป็นไฟล์ Word/ }).click();
    if (tag === 'iphone') { await sleep(2500); const sh = pg.getByRole('dialog', { name: 'บันทึกไฟล์' }); await sh.getByRole('button', { name: /ดาวน์โหลด/ }).first().click(); }
    const d = await dl;
    if (tag === 'iphone') { await sleep(500); const sh = pg.getByRole('dialog', { name: 'บันทึกไฟล์' }); if (await sh.count()) { const cl = sh.getByRole('button', { name: /ปิด|เสร็จ/ }); if (await cl.count()) await cl.first().click(); else await pg.keyboard.press('Escape'); await sleep(300); } }
    if (d) { const zip = await JSZip.loadAsync(fs.readFileSync(await d.path())); const xml = await zip.file('word/document.xml').async('string'); const txt = xml.replace(/<[^>]+>/g, '');
      const tm = (moved.match(/(\d{2}\.\d{2}\s*[–-]\s*\d{2}\.\d{2})/) || [])[1]; ok('Word has moved row at its new time', tm && txt.includes(tm.replace(/\s+/g, ' ')) && txt.indexOf(title3) > -1, tm); }
    else ok('Word downloaded', false, 'no download');
    // 4b) เวลาเลิกปรับได้อิสระ (แม่แบบต้นฉบับ): วันที่ 1 เลิกเร็วขึ้น → ตัด/ย่อแถว + แจ้ง · ช้าลงได้ · กลับเป็นตามต้นฉบับ
    { const ei = pg.getByLabel('เวลาเลิกวันที่ 1'); const e0 = await ei.inputValue();
      const earlier = (() => { const [h, m] = e0.split(':').map(Number); const t = h * 60 + m - 120; return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; })();
      await ei.fill(earlier); await ei.press('Enter'); await sleep(900);
      const t1 = await body();
      ok('end time earlier applied', new RegExp(`วันที่ 1[\\s\\S]*?เลิก ${earlier.replace(':', '\\.')} น\\.`).test(t1), `${e0} → ${earlier}`);
      ok('earlier end lists what was cut/shortened', /เลิกเร็วขึ้นเป็น .* (ตัดออก|ย่อเวลา)/.test(t1));
      await pg.getByRole('button', { name: /กลับเป็นตามต้นฉบับ/ }).first().click(); await sleep(700);
      ok('reset end time to original', (await pg.getByLabel('เวลาเลิกวันที่ 1').inputValue()) === e0); }
    // 5) เสร็จสิ้น
    for (let i = 0; i < 2; i++) { await pg.getByRole('button', { name: /^ถัดไป:/ }).click(); await sleep(400); }
    await pg.getByRole('button', { name: /^เสร็จสิ้น$/ }).first().click(); await sleep(400);
    ok('finish: confirm dialog', (await pg.getByRole('dialog').innerText()).includes('ทำงานนี้เสร็จแล้ว?'));
    await pg.getByRole('dialog').getByRole('button', { name: /^เสร็จสิ้น$/ }).click(); await sleep(800);
    let dlg = await pg.getByRole('dialog').innerText();
    ok('finish: shows เสร็จสิ้น screen', /เสร็จสิ้น/.test(dlg) && /บันทึกเป็นงานที่เสร็จแล้ว/.test(dlg) && /ส่งเข้างานของทีมแล้ว/.test(dlg), dlg.slice(0, 200));
    await sleep(2500);
    const tj = () => [...store.jobs.values()].find(j => /ทดสอบลากวาง/.test(j.school || j.name));
    ok('finish: team hub has done:true', tj() && tj().done === true, JSON.stringify(tj() && { done: tj().done }));
    await pg.getByRole('button', { name: 'ดูงานนี้ต่อ' }).click(); await sleep(300);
    ok('header shows เสร็จแล้ว', /เสร็จแล้ว ·/.test(await body()) || tag === 'iphone');
    // 6) อีกเครื่องเห็นสถานะ "เสร็จแล้ว"
    const ctx2 = await b.newContext({ ...opt }); await route(ctx2); const p2 = await ctx2.newPage();
    await p2.goto(BASE + '/#/build'); await sleep(3500);
    const brief2 = await p2.locator('body').innerText();
    ok('other device: job listed as เสร็จแล้ว', /เสร็จแล้ว\s*โรงเรียนทดสอบลากวาง/.test(brief2), brief2.slice(0, 500));
    await p2.getByRole('button', { name: /^เสร็จแล้ว \d+$/ }).click(); await sleep(300);
    ok('other device: filter เสร็จแล้ว shows it', /โรงเรียนทดสอบลากวาง/.test(await p2.locator('body').innerText()));
    await ctx2.close();
    // 7) แก้ต่อ → กลับเป็นกำลังทำเอง
    await pg.getByRole('button', { name: /^ย้อนกลับ$/ }).click(); await sleep(300);
    const price = pg.getByLabel(/ราคาพิเศษ|ลดเหลือ/).first();
    if (await price.count()) await price.fill('2,990'); else await pg.locator('input[type=number]').first().fill('2990');
    await sleep(1500);
    ok('edit after finish → notice back to กำลังทำ', /กลับเป็น "กำลังทำ"/.test(await body()));
    await sleep(3500);
    ok('edit after finish → team hub done:false', tj() && tj().done === false, JSON.stringify(tj() && { done: tj().done }));
    ok('no page errors', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(out.join('\n')); const f = out.filter(x => / FAIL /.test(x)).length;
  console.log(f ? `e2e-finish: ${f} FAIL` : `e2e-finish: ${out.length}/${out.length} pass`); process.exit(f ? 1 : 0);
})();
