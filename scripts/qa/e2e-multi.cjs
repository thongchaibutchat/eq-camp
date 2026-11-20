// หลายคนใช้พร้อมกัน + ส่งใบเสนอราคาเข้า SME Move
// · 8 เครื่อง (คอม 4 + iPhone 4) ทำงาน+สร้างไฟล์พร้อมกัน บนศูนย์กลางจำลองที่ "ช้า" (0.3–1.2 วิ) และ "ไม่ว่าง" สุ่ม 25% (ตอบ HTML แบบโควตาเต็ม / busy)
//   → งาน 8 + ทะเบียน 8 ต้องถึงครบ ไม่ซ้ำ ไม่หาย คิวว่าง ไม่มี error ค้างบนจอ · บอร์ดเห็นครบ 8 คน
// · เปิด 3 แท็บในเบราว์เซอร์เดียว → ถาม rev แท็บเดียว · 8 เครื่องนิ่ง 20 วิ ถาม rev ไม่เกินเพดาน
// · แผง SME Move: ข้อมูลถูก คัดลอกทั้งชุดได้ ไม่มีต้นทุน/กำไร
// รัน: LANG=C.UTF-8 node scripts/qa/e2e-multi.cjs (เว็บที่ http://localhost:8765)
const { chromium, devices } = require('playwright');
const fs = require('fs');
const { makeStore } = require('./nsr-fake.cjs');
const BASE = process.env.URL || 'http://localhost:8765';
const URL_ = 'https://script.google.com/macros/s/TEST/exec';
const N = Number(process.env.N || 8);
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const store = makeStore(JSON.parse(fs.readFileSync(__dirname + '/nsr-fixture.json', 'utf8')));
  const stats = { busyHtml: 0, busyJson: 0, calls: 0, maxConc: 0 }; let conc = 0;
  const b = await chromium.launch(); const out = []; const errs = [];
  const ok = (n, c, x = '') => out.push(`${c ? 'PASS' : 'FAIL'} ${n}${c ? '' : ' ' + x}`);
  const hook = async (ctx, tag, chaos = true) => {
    await ctx.route(URL_ + '**', async route => {
      const r = route.request(); if (r.method() !== 'POST') return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
      const req = JSON.parse(r.postData()); stats.calls++; conc++; stats.maxConc = Math.max(stats.maxConc, conc);
      await sleep(chaos ? 300 + Math.random() * 900 : 50);
      conc--;
      const roll = Math.random();
      if (chaos && roll < (req.op === 'rev' ? 0.1 : 0.25)) {
        if (roll < 0.12) { stats.busyHtml++; return route.fulfill({ status: 200, contentType: 'text/html', body: '<!DOCTYPE html><html><body>Service invoked too many times: There are too many scripts running simultaneously for this Google user account.</body></html>' }); }
        stats.busyJson++; return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'busy' }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(store.handle(req)) });
    });
  };
  const mk = async (i) => {
    const opt = i % 2 ? devices['iPhone 13'] : { viewport: { width: 1360, height: 900 } };
    const ctx = await b.newContext({ ...opt, acceptDownloads: true }); const tag = (i % 2 ? 'iPhone' : 'คอม') + i;
    await hook(ctx, tag);
    await ctx.addInitScript(([u, name]) => { if (!sessionStorage.getItem('i')) { localStorage.clear(); localStorage.setItem('eqcamp.hub.url', u); localStorage.setItem('eqcamp.hub.key', 'nsr-testkey'); localStorage.setItem('eqcamp.hub.name', name); localStorage.setItem('eqcamp.hub.seeded:' + u, 'x'); sessionStorage.setItem('i', '1'); } }, [URL_, 'ผู้ใช้' + i]);
    const pg = await ctx.newPage();
    pg.on('pageerror', e => errs.push(tag + ': ' + e.message)); pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push(tag + ': ' + m.text()); });
    return { ctx, pg, tag, i };
  };
  const U = await Promise.all(Array.from({ length: N }, (_, i) => mk(i)));
  // ทุกคนทำงานพร้อมกัน
  await Promise.all(U.map(async u => {
    await u.pg.goto(BASE + '/#/build'); await u.pg.waitForTimeout(800);
    const bt = u.pg.getByRole('button', { name: /บรีฟ/ }).first(); if (!(await u.pg.locator('textarea').count()) && await bt.count()) { await bt.click(); await u.pg.waitForTimeout(300); }
    await u.pg.locator('textarea').first().fill(`โรงเรียนพร้อมกัน${u.i}วิทยา ม.2 จำนวน ${80 + u.i} คน ค่าย STEM 2 วัน 1 คืน วันที่ 20-21 ม.ค. 2570 ราคา 2900 บาท`);
    await u.pg.getByRole('button', { name: /เริ่มงานใหม่/ }).first().click(); await u.pg.waitForTimeout(1200);
    const dl = u.pg.getByRole('button', { name: /^ดาวน์โหลด/ }).first();
    if (u.i % 2) { await dl.click(); await u.pg.waitForTimeout(2500); }
    else await Promise.all([u.pg.waitForEvent('download', { timeout: 60000 }), dl.click()]);
  }));
  // รอคิวส่งครบ (ช้า+ไม่ว่าง → ลองใหม่เอง)
  let left = 1; for (let t = 0; t < 60 && left; t++) { await sleep(1000); left = (await Promise.all(U.map(u => u.pg.evaluate(() => (JSON.parse(localStorage.getItem('eqcamp.hub.queue.v1') || '[]')).length)))).reduce((a, b) => a + b, 0); }
  const schools = U.map(u => `โรงเรียนพร้อมกัน${u.i}วิทยา`);
  const jobsOk = schools.filter(s => [...store.jobs.values()].some(j => j.school === s || j.name === s));
  const evOk = schools.filter(s => store.events.some(e => e.school === s));
  ok(`all queues drained (${N} devices)`, left === 0, String(left));
  ok(`all ${N} jobs reached hub despite busy/slow`, jobsOk.length === N, `${jobsOk.length}/${N}`);
  ok(`all ${N} file events reached hub`, evOk.length === N, `${evOk.length}/${N}`);
  ok('no duplicate events', new Set(store.events.map(e => e.eid)).size === store.events.length);
  ok('events carry the right person', U.every(u => store.events.some(e => e.school === schools[u.i] && e.byName === 'ผู้ใช้' + u.i)));
  ok('chaos actually injected', stats.busyHtml > 0 && stats.busyJson > 0, JSON.stringify(stats));
  const stuck = (await Promise.all(U.map(u => u.pg.locator('[role="alert"]').allInnerTexts()))).flat().filter(t => /ผิดรูปแบบ|ไม่สำเร็จ|ไม่ว่าง/.test(t));
  ok('no error stuck on screen', stuck.length === 0, stuck.slice(0, 2).join(' | '));
  // บอร์ดเห็นครบทุกคน
  await U[0].pg.goto(BASE + '/#/team'); let seen = 0;
  for (let t = 0; t < 25 && seen < N; t++) { await sleep(1000); const tx = await U[0].pg.locator('body').innerText(); seen = U.filter(u => tx.includes('ผู้ใช้' + u.i)).length; }
  ok(`board shows all ${N} people`, seen === N, `${seen}/${N}`);
  // นิ่ง 20 วิ: นับ rev (เพดาน = N เครื่อง × 20/5 × 1.35)
  const r0 = store.log.filter(x => x.op === 'rev').length; await sleep(20000); const r1 = store.log.filter(x => x.op === 'rev').length;
  ok(`idle polling within budget (${r1 - r0} rev calls / 20s, ${N} devices)`, r1 - r0 <= Math.ceil(N * 4 * 1.35), String(r1 - r0));
  // 3 แท็บเบราว์เซอร์เดียว → แท็บเดียวถาม
  const ctx3 = await b.newContext(); await hook(ctx3, 'tabs', false);
  await ctx3.addInitScript(u => { localStorage.setItem('eqcamp.hub.url', u); localStorage.setItem('eqcamp.hub.key', 'nsr-testkey'); localStorage.setItem('eqcamp.hub.seeded:' + u, 'x'); }, URL_);
  const tabs = []; for (let i = 0; i < 3; i++) { const p = await ctx3.newPage(); await p.goto(BASE + '/#/team'); tabs.push(p); }
  const dev = await tabs[0].evaluate(() => localStorage.getItem('eqcamp.hub.device'));
  await sleep(2000); const a0 = store.log.filter(x => x.op === 'rev' && x.dev === dev).length; await sleep(20000); const a1 = store.log.filter(x => x.op === 'rev' && x.dev === dev).length;
  ok(`3 tabs share one poller (${a1 - a0} rev calls / 20s)`, a1 - a0 <= 6, String(a1 - a0));
  // อีกแท็บรู้การเปลี่ยนแปลงแม้ไม่ได้ถามเอง
  store.handle({ op: 'log', key: 'nsr-testkey', ev: { eid: 'tab-test', ts: new Date().toISOString(), programId: 'TT', byName: 'คนแท็บ', school: 'โรงเรียนข้ามแท็บ', course: 'STEM', action: 'word', docKind: 'program' } });
  let tabsSeen = 0; for (let t = 0; t < 15 && tabsSeen < 3; t++) { await sleep(1000); tabsSeen = (await Promise.all(tabs.map(p => p.locator('body').innerText()))).filter(x => x.includes('โรงเรียนข้ามแท็บ')).length; }
  ok('all 3 tabs update from one poller', tabsSeen === 3, String(tabsSeen));
  await ctx3.close();
  // SME Move
  const sctx = await b.newContext({ viewport: { width: 1360, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] }); const sp = await sctx.newPage();
  sp.on('pageerror', e => errs.push('sme: ' + e.message));
  await sp.goto(BASE + '/#/build'); await sp.waitForTimeout(800);
  { const bt = sp.getByRole('button', { name: /บรีฟ/ }).first(); if (!(await sp.locator('textarea').count()) && await bt.count()) { await bt.click(); await sp.waitForTimeout(300); } }
  await sp.locator('textarea').first().fill('โรงเรียนเอสเอ็มอีมูฟวิทยา ม.3 จำนวน 120 คน ค่ายดาราศาสตร์ 2 วัน 1 คืน วันที่ 5-6 ก.พ. 2570 ราคาปกติ 3,290 ลดเหลือ 2,990 บาท');
  await sp.getByRole('button', { name: /เริ่มงานใหม่/ }).first().click(); await sp.waitForTimeout(1200);
  await sp.getByRole('button', { name: /ราคา & งบ/ }).first().click(); await sp.waitForTimeout(500);
  const panel = sp.locator('section[aria-label="ส่งเข้า SME Move"]');
  const pt = await panel.innerText();
  ok('SME panel shown in price step', /ส่งใบเสนอราคาเข้า SME Move/.test(pt));
  ok('SME customer + qty + unit price + discount', /โรงเรียนเอสเอ็มอีมูฟวิทยา/.test(pt) && /\n120\n|120/.test(pt) && /3,290/.test(pt) && /300/.test(pt) && /358,800/.test(pt), pt.slice(0, 600));
  ok('SME missing address flagged, not guessed', /บรีฟไม่มีที่อยู่/.test(pt));
  await panel.getByRole('button', { name: 'คัดลอกทั้งชุด' }).click(); await sp.waitForTimeout(300);
  const clip = await sp.evaluate(() => navigator.clipboard.readText());
  ok('SME copy-all text', /ใบเสนอราคา \(สำหรับกรอกใน SME Move\)/.test(clip) && /โรงเรียนเอสเอ็มอีมูฟวิทยา/.test(clip) && /358,800/.test(clip), clip.slice(0, 200));
  ok('SME text has no cost/profit', !/ต้นทุน|กำไร/.test(clip + pt));
  await panel.getByRole('button', { name: /คัดลอก ราคาต่อหน่วย/ }).click(); await sp.waitForTimeout(200);
  ok('SME copy single field', (await sp.evaluate(() => navigator.clipboard.readText())) === '3,290');
  await sctx.close();
  const mctx = await b.newContext(devices['iPhone 13']); const mp = await mctx.newPage();
  await mp.goto(BASE + '/#/build'); await mp.waitForTimeout(800);
  { const bt = mp.getByRole('button', { name: /บรีฟ/ }).first(); if (!(await mp.locator('textarea').count()) && await bt.count()) { await bt.click(); await mp.waitForTimeout(300); } }
  await mp.locator('textarea').first().fill('โรงเรียนมือถือวิทยา จำนวน 60 คน ค่ายภาษาอังกฤษ 1 วัน ราคา 890 บาท');
  await mp.getByRole('button', { name: /เริ่มงานใหม่/ }).first().click(); await mp.waitForTimeout(1000);
  await mp.getByRole('button', { name: /ราคา & งบ/ }).first().click(); await mp.waitForTimeout(500);
  await mp.locator('section[aria-label="ส่งเข้า SME Move"]').scrollIntoViewIfNeeded();
  const ov = await mp.evaluate(() => Math.max(document.documentElement.scrollWidth - innerWidth, ...[...document.querySelectorAll('section[aria-label="ส่งเข้า SME Move"] *')].map(e => Math.round(e.getBoundingClientRect().right - innerWidth))));
  ok('SME panel fits iPhone width', ov <= 1, String(ov));
  await mp.screenshot({ path: '/tmp/sme-iphone.png' });
  await mctx.close();
  ok('no console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log('stats', JSON.stringify(stats));
  await b.close();
  console.log(out.join('\n')); const f = out.filter(x => x.startsWith('FAIL')).length; console.log(`${out.length - f}/${out.length} passed`); process.exit(f ? 1 : 0);
})();
