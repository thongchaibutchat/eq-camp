// หน้าภาพรวมทีม (#/team): ตัวเลขเดือนนี้ · ใครทำโปรแกรม · หลักสูตรยอดฮิต · ความเคลื่อนไหว · สถานะการขาย · อัปเดตเองเมื่อคนอื่นสร้างไฟล์
// รัน: LANG=C.UTF-8 node scripts/qa/e2e-board.cjs (เว็บที่ http://localhost:8765) · ภาพหน้าจอ /tmp/board-*.png
const { chromium, devices } = require('playwright');
const fs = require('fs');
const { makeStore } = require('./nsr-fake.cjs');
const BASE = process.env.URL || 'http://localhost:8765';
const URL_ = 'https://script.google.com/macros/s/TEST/exec';
const iso = (d) => new Date(Date.now() - d * 864e5).toISOString();
const ev = (o) => ({ eid: Math.random().toString(36).slice(2), action: 'word', docKind: 'program', durationMode: 'overnight', days: 2, nights: 1, source: 'เว็บ', ...o });
const seed = () => {
  const store = makeStore(JSON.parse(fs.readFileSync(__dirname + '/nsr-fixture.json', 'utf8')));
  const people = ['พริ้มเพรา', 'ธงชัย', 'แพนด้า'];
  const courses = ['สะเต็มศึกษา (STEM)', 'ภาษาอังกฤษ', 'ดาราศาสตร์', 'วิทยาศาสตร์ทางทะเล'];
  for (let i = 0; i < 14; i++) store.events.push(ev({ ts: iso(i % 9), programId: 'P' + (i % 9), jobId: 'J' + (i % 9), byName: people[i % 3], school: 'โรงเรียนทดสอบ' + (i % 9), course: courses[i % 4], students: 60 + i * 5, specialPrice: 2900, docKind: i % 4 === 1 ? 'quotation' : 'program' }));
  store.jobs.set('J1', { id: 'J1', savedAt: iso(0.1), name: 'โรงเรียนทดสอบ1', school: 'โรงเรียนทดสอบ1', course: 'STEM', duration: '2 วัน 1 คืน', by: 'ธงชัย', dev: 'x', snap: { camp: {} } });
  store.statuses.set('1001', { sheetId: 1001, title: store.tabs[1].title, name: 'งานเสนอค้าง', status: 'quoted', at: iso(20), by: 'แพนด้า' });
  store.statuses.set('1002', { sheetId: 1002, title: store.tabs[2].title, name: 'งานปิดได้', status: 'won', at: iso(0.2), finalPax: 100, finalPrice: 3000, by: 'ธงชัย' });
  return store;
};
(async () => {
  let store;
  const b = await chromium.launch(); const out = []; const errs = [];
  const ok = (n, c, x = '') => out.push(`${c ? 'PASS' : 'FAIL'} ${n}${c ? '' : ' ' + x}`);
  const run = async (opt, tag) => {
    store = seed();
    const ctx = await b.newContext({ ...opt }); const pg = await ctx.newPage();
    pg.on('pageerror', e => errs.push(tag + ': ' + e.message)); pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push(tag + ': ' + m.text()); });
    await ctx.route(URL_ + '**', async route => { const r = route.request(); const res = r.method() === 'POST' ? store.handle(JSON.parse(r.postData())) : { ok: true }; return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(res) }); });
    await ctx.addInitScript(([u]) => { if (!sessionStorage.getItem('i')) { localStorage.clear(); localStorage.setItem('eqcamp.hub.url', u); localStorage.setItem('eqcamp.hub.key', 'nsr-testkey'); localStorage.setItem('eqcamp.hub.name', 'ทดสอบบอร์ด'); sessionStorage.setItem('i', '1'); } }, [URL_]);
    await pg.goto(BASE + '/#/team'); await pg.waitForTimeout(2500);
    const t = await pg.locator('body').innerText();
    ok(tag + ' board opens from #/team', /ภาพรวมทีม/.test(t) && /ใครทำโปรแกรม/.test(t), t.slice(0, 200));
    ok(tag + ' people ranked', /พริ้มเพรา/.test(t) && /ธงชัย/.test(t) && /แพนด้า/.test(t));
    ok(tag + ' top courses', /หลักสูตรที่ทำเยอะที่สุด/.test(t) && /สะเต็มศึกษา/.test(t));
    ok(tag + ' feed + who', /ความเคลื่อนไหวล่าสุด/.test(t) && /สร้าง ใบเสนอราคา|สร้าง โปรแกรมค่าย/.test(t));
    ok(tag + ' sales + follow-up', /ปิดการขาย/.test(t) && /งานเสนอค้าง/.test(t), (t.match(/ต้องติดตาม[^\n]*/) || [''])[0]);
    ok(tag + ' active job', /งานที่กำลังทำ/.test(t) && /โรงเรียนทดสอบ1/.test(t));
    const n0 = Number((await pg.locator('section[aria-label^="สรุป"] .tabular-nums').first().innerText()).trim());
    ok(tag + ' KPI programs = 9', n0 === 9, String(n0));
    await pg.screenshot({ path: `/tmp/board-${tag}.png`, fullPage: true });
    // คนอื่นสร้างไฟล์ใหม่ → บอร์ดขึ้นเอง
    store.handle({ op: 'log', key: 'nsr-testkey', ev: ev({ ts: new Date().toISOString(), programId: 'NEW-' + tag, byName: 'คนใหม่' + tag, school: 'โรงเรียนสดใหม่' + tag, course: 'ภาษาจีน', students: 70, specialPrice: 1500 }) });
    let seen = false; for (let i = 0; i < 20 && !seen; i++) { await pg.waitForTimeout(1000); seen = (await pg.locator('body').innerText()).includes('โรงเรียนสดใหม่' + tag); }
    ok(tag + ' live: new event appears without reload', seen);
    const n1 = Number((await pg.locator('section[aria-label^="สรุป"] .tabular-nums').first().innerText()).trim());
    ok(tag + ' KPI updated to 10', n1 === 10, String(n1));
    const lastEv = store.log.filter(r => r.op === 'board').slice(-1)[0];
    ok(tag + ' incremental: board asks only new rows', lastEv && Number(lastEv.from) > 0, JSON.stringify(lastEv && lastEv.from));
    // ไม่มีวนโหลดซ้ำเอง: นิ่ง 8 วิ ต้องไม่ถามบอร์ดซ้ำ ๆ
    const c0 = store.log.filter(r => r.op === 'board').length; await pg.waitForTimeout(8000); const c1 = store.log.filter(r => r.op === 'board').length;
    ok(tag + ' idle: no reload loop', c1 - c0 <= 1, String(c1 - c0));
    const ov = await pg.evaluate(() => Math.max(document.documentElement.scrollWidth - window.innerWidth, ...[...document.querySelectorAll('section button')].map(e => Math.round(e.getBoundingClientRect().right - window.innerWidth))));
    ok(tag + ' no horizontal overflow', ov <= 1, String(ov));
    // เปิดงานจากบอร์ด → ไปหน้าสร้างเอกสาร
    { const jb = pg.locator('section[aria-label^="งานที่กำลังทำ"] button', { hasText: 'โรงเรียนทดสอบ1' }); await jb.scrollIntoViewIfNeeded(); await pg.waitForTimeout(800);
      if (process.env.DBG) { const bb = await jb.boundingBox(); console.log(tag, JSON.stringify(bb), await pg.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return (e ? e.outerHTML.slice(0, 160) : 'null') + ' scrollY=' + scrollY + ' ih=' + innerHeight; }, [bb.x + bb.width / 2, bb.y + bb.height / 2])); } }
    await pg.locator('section[aria-label^="งานที่กำลังทำ"] button', { hasText: 'โรงเรียนทดสอบ1' }).click({ timeout: 8000 }).catch(e => out.push('FAIL click ' + String(e.message).split('\n').slice(-3).join(' '))); await pg.waitForTimeout(1500);
    ok(tag + ' open job from board → builder', /#\/build/.test(pg.url()), pg.url());
    await ctx.close();
  };
  await run({ viewport: { width: 1360, height: 900 } }, 'desktop');
  await run(devices['iPhone 13'], 'iphone');
  // ไม่ได้เชื่อมต่อทีม → เห็นข้อความชวนเชื่อม (ไม่พัง)
  { const ctx = await b.newContext(); const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push('off: ' + e.message));
    await pg.goto(BASE + '/#/team'); await pg.waitForTimeout(1200); const t = await pg.locator('body').innerText();
    ok('not connected: shows join hint', /เชื่อมต่อทีม/.test(t) && /ภาพรวมทีม/.test(t)); await ctx.close(); }
  ok('no console errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close();
  console.log(out.join('\n')); const f = out.filter(x => x.startsWith('FAIL')).length; console.log(`${out.length - f}/${out.length} passed`); process.exit(f ? 1 : 0);
})();
