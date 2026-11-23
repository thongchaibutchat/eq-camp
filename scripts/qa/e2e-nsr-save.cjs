// บันทึก NSR ให้ได้จากทุกอุปกรณ์ ไม่ค้างนาน (23 พ.ย. 2569): จำลองศูนย์กลางทีมที่ "โหลดรายการไม่ผ่าน / ตอบช้า / คำตอบหาย / ไม่มีเน็ต"
// รัน: LANG=C.UTF-8 node scripts/qa/e2e-nsr-save.cjs  (เว็บที่ http://localhost:8765)
const { chromium, devices } = require('playwright');
const fs = require('fs');
const { makeStore } = require('./nsr-fake.cjs');
const BASE = process.env.URL || 'http://localhost:8765';
const URL_ = 'https://script.google.com/macros/s/TEST/exec';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch(); const out = [];
  for (const [tag, opt] of [['desktop', { viewport: { width: 1400, height: 950 } }], ['iphone', devices['iPhone 13']]]) {
    const store = makeStore(JSON.parse(fs.readFileSync(__dirname + '/nsr-fixture.json', 'utf8')));
    const mode = { allFail: 0, editDelay: 0, dropEditReply: 0, offline: false };
    const ctx = await b.newContext({ ...opt }); const pg = await ctx.newPage(); const errs = [];
    pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_INTERNET_DISCONNECTED|net::/.test(m.text())) errs.push(m.text()); });
    const ok = (n, c, extra = '') => out.push(`${tag} ${c ? 'PASS' : 'FAIL'} ${n}${c ? '' : ' ' + String(extra).slice(0, 300)}`);
    await pg.route(URL_ + '**', async route => {
      const r = route.request(); const q = r.method() === 'POST' ? JSON.parse(r.postData()) : {};
      if (mode.offline) return route.abort('internetdisconnected');
      if (q.op === 'nsr.all' && mode.allFail > 0) { mode.allFail--; return route.fulfill({ status: 503, contentType: 'text/html', body: '<html>Service unavailable. Try again later.</html>' }); }
      const res = r.method() === 'POST' ? store.handle(q) : { ok: true };      // ชีตบันทึกจริงตอนรับคำสั่ง (เหมือน Google)
      if (q.op === 'nsr.edit' && mode.dropEditReply > 0) { mode.dropEditReply--; return route.abort('connectionreset'); }   // บันทึกแล้วแต่คำตอบหาย
      if (q.op === 'nsr.edit' && mode.editDelay) { const d = mode.editDelay; mode.editDelay = 0; await sleep(d); }
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(res) }).catch(() => {});
    });
    await ctx.addInitScript(([u]) => { try { if (!sessionStorage.getItem('init')) { localStorage.clear(); localStorage.setItem('eqcamp.hub.url', u); localStorage.setItem('eqcamp.hub.key', 'nsr-testkey'); sessionStorage.setItem('init', '1'); } } catch (e) {} }, [URL_]);
    const body = () => pg.locator('body').innerText();
    const tab = 'stem @โรงเรียนทดสอบหนึ่ง'; const st = store.tabs.find(x => x.title === tab);
    const priceRow = st.values.findIndex(r => /ราคาขาย \(Selling/.test(r[1])) + 1;
    const price = () => st.values[priceRow - 1][4];
    const edits = () => store.log.filter(x => x.op === 'nsr.edit').length;
    const openTab = async () => { await pg.getByLabel('ค้นหางาน').fill('ทดสอบหนึ่ง'); await sleep(300); await pg.locator('section[aria-label="งานย้อนหลัง"] li button').first().click(); await sleep(500); };
    const setPrice = async v => { await pg.getByLabel('ราคาขายต่อท่าน').fill(String(v)); await sleep(250); };
    const save = () => pg.getByRole('button', { name: /บันทึกลงแท็บเดิม/ }).click();

    // 0) เข้าครั้งแรก (รายการเก็บในเครื่อง)
    await pg.goto(BASE + '/#/nsr'); await sleep(2000);
    // 1) โหลดรายการไม่ผ่าน 2 ครั้ง (Google ไม่ว่าง) → ยังเปิดงานจากรายการในเครื่องและบันทึกได้ · โหลดใหม่เอง
    mode.allFail = 2; await pg.reload(); await sleep(2500);
    let t = await body();
    ok('list fails: page still connected (not offline)', /เชื่อมชีตแล้ว/.test(t) && !/เชื่อมต่อทีมก่อน/.test(t), t.slice(0, 400));
    ok('list fails: says it retries by itself', /กำลังลองโหลดใหม่เอง/.test(t) || mode.allFail === 0, t.slice(0, 400));
    await openTab(); await setPrice(5000);
    const btn = pg.getByRole('button', { name: /บันทึกลงแท็บเดิม/ });
    ok('save button enabled while list still loading', await btn.isEnabled());
    let t0 = Date.now(); await save(); await sleep(1500);
    ok('saved while list was failing', price() === '5000', price());
    ok('success message', /บันทึกลงแท็บ/.test(await body()));
    await sleep(12000); t = await body();
    ok('list recovered by itself', !/กำลังลองโหลดใหม่เอง/.test(t) && /เชื่อมชีตแล้ว/.test(t), t.slice(0, 300));

    // 2) บันทึกสำเร็จแต่คำตอบหาย (สัญญาณหลุด) → ลองใหม่เอง → ไม่ขึ้น "ชนกัน" · ชีตถูกต้อง
    mode.dropEditReply = 1; const e0 = edits();
    await setPrice(5100); await save(); await sleep(3500);
    ok('reply lost → auto retry → success, no conflict dialog', price() === '5100' && (await pg.getByRole('dialog', { name: 'ชีตมีการแก้ไขระหว่างนี้' }).count()) === 0 && edits() - e0 >= 2, `${price()} edits=${edits() - e0}`);
    ok('reply lost → success message', /บันทึกลงแท็บ/.test(await body()));

    // 3) Google ตอบช้า 40 วิ → หน้าจอไม่ค้างเกิน ~25 วิ · ทำต่อเบื้องหลัง · สุดท้ายบันทึกถูก ไม่ชนกัน
    mode.editDelay = 40000;
    await setPrice(5200); t0 = Date.now(); await save();
    await pg.waitForFunction(() => !/กำลังบันทึก…/.test(document.body.innerText), null, { timeout: 35000 }).catch(() => {});
    const waited = Date.now() - t0;
    ok('slow Google: screen free within 27s', waited < 27000, waited);
    ok('slow Google: tells user it continues in background', /ระบบจะบันทึกลงชีตเอง/.test(await body()));
    await sleep(20000);
    ok('slow Google: sheet has the new price', price() === '5200', price());
    ok('slow Google: no conflict dialog', (await pg.getByRole('dialog', { name: 'ชีตมีการแก้ไขระหว่างนี้' }).count()) === 0);
    ok('slow Google: queue empty', await pg.evaluate(() => JSON.parse(localStorage.getItem('eqcamp.hub.queue.v1') || '[]').length === 0));

    // 4) ไม่มีอินเทอร์เน็ต → เก็บในเครื่อง → กลับมาออนไลน์ → ส่งเอง
    await ctx.setOffline(true); mode.offline = true;
    await setPrice(5300); await save(); await sleep(2500);
    t = await body();
    ok('offline: kept on device, clear message', /ไม่มีอินเทอร์เน็ต|สัญญาณไม่ดี/.test(t) && /เก็บการแก้/.test(t), t.slice(0, 300));
    ok('offline: pending note under save', /มีการแก้รอส่งเข้าชีต/.test(t));
    ok('offline: sheet unchanged yet', price() === '5200');
    await ctx.setOffline(false); mode.offline = false; await pg.evaluate(() => window.dispatchEvent(new Event('online')));
    await sleep(8000);
    ok('back online: pending edit saved to sheet', price() === '5300', price());
    t = await body();
    ok('back online: pending note gone', !/มีการแก้รอส่งเข้าชีต/.test(t));

    // 5) ชนกันจริง (คนอื่นแก้ช่องเดียวกัน) ยังเตือนเหมือนเดิม + บันทึกทับได้
    store.poke(tab, priceRow, 5, 5400);
    await setPrice(5500); await save(); await sleep(1500);
    ok('real conflict still detected', (await pg.getByRole('dialog', { name: 'ชีตมีการแก้ไขระหว่างนี้' }).count()) === 1);
    await pg.getByRole('button', { name: 'บันทึกทับ' }).click(); await sleep(1500);
    ok('overwrite (บันทึกทับ) works', price() === '5500', price());
    ok('no page errors', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(out.join('\n')); const f = out.filter(x => / FAIL /.test(x)).length;
  console.log(f ? `e2e-nsr-save: ${f} FAIL` : `e2e-nsr-save: ${out.length}/${out.length} pass`); process.exit(f ? 1 : 0);
})();
