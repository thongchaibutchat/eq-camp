// ค้นหางานครบทุกแท็บ (กรณี "ชุมแสง" มีหลายงานแต่ค้นเจอ 1) + สถานะการขายข้ามเครื่อง + เส้นราคาที่ต้องขออนุมัติ
// ชุดข้อมูลสังเคราะห์ 60 แท็บ (โครงแท็บจริง ชื่อ/ตัวเลขสมมติ) งาน "ชุมแสง" อยู่ท้ายชีต · ศูนย์กลางเตรียมทีละ 15 แท็บ (จำลองครั้งแรก)
// รัน: LANG=C.UTF-8 node scripts/qa/e2e-sales.cjs  (เว็บที่ http://localhost:8765)
const { chromium, devices } = require('playwright');
const fs = require('fs');
const { makeStore } = require('./nsr-fake.cjs');
const BASE = process.env.URL || 'http://localhost:8765';
const URL_ = 'https://script.google.com/macros/s/TEST/exec';
const base = JSON.parse(fs.readFileSync(__dirname + '/nsr-fixture.json', 'utf8'));
const tpl = Object.entries(base).find(([t]) => !/Copy of|ตารางคำนวน/.test(t))[1];
function make(n, names) {
  const fx = {}; const master = Object.keys(base).find(t => /ตารางคำนวน/.test(t)); if (master) fx[master] = base[master];
  const withName = (rows, name) => rows.map(r => (/รายละเอียดงาน/.test((r[0] || [''])[0]) ? r.map((c, j) => (j === 1 ? [name, ''] : c)) : r));
  for (let i = 0; i < n; i++) fx[`งานทั่วไป ${i + 1}@โรงเรียนสมมติ${i + 1}`] = withName(tpl, `ค่ายทั่วไป โรงเรียนสมมติ${i + 1}`);
  for (const [tab, name] of names) fx[tab] = withName(tpl, name);
  return fx;
}
const CHUM = [['ค่าย Pre-Genius Camp @โรงเรียนชุมแสง', 'Pre-Genius Camp 2025 โรงเรียนชุมแสงชินูทิศ'], [' ค่ายนิติวิทย์ ชุมแสงชนูทิศ Diana', ' ค่ายนิติวิทย์ ชุมแสงชนูทิศ'], ['ค่ายนิติวิทย์ ชุมแสงชนูทิศ Kasalong', ' ค่ายนิติวิทย์ ชุมแสงชนูทิศ'], ['ค่ายดาราศาสตร์ ชุมแสงชนูทิศ เชียงใหม่', 'ค่ายดาราศาสตร์ ชุมแสงชนูทิศ เชียงใหม่'], ['Chinese ชุมแสง', 'Chinese ชุมแสง']];

(async () => {
  const b = await chromium.launch(); const out = [];
  const ok = (tag, n, c, extra = '') => out.push(`${tag} ${c ? 'PASS' : 'FAIL'} ${n}${c ? '' : ' ' + extra}`);
  const open = async (store, opt, tag) => {
    const ctx = await b.newContext({ ...opt }); const pg = await ctx.newPage(); const errs = [];
    pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
    await pg.route(URL_ + '**', async route => { const r = route.request(); const res = r.method() === 'POST' ? store.handle(JSON.parse(r.postData())) : { ok: true };
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(res) }); });
    await ctx.addInitScript(([u, name]) => { try { if (!sessionStorage.getItem('init')) { localStorage.clear(); localStorage.setItem('eqcamp.hub.url', u); localStorage.setItem('eqcamp.hub.key', 'nsr-testkey'); localStorage.setItem('eqcamp.hub.name', name); sessionStorage.setItem('init', '1'); } } catch {} }, [URL_, tag]);
    await pg.goto(BASE + '/#/nsr');
    return { ctx, pg, errs };
  };
  const list = pg => pg.locator('section[aria-label="งานย้อนหลัง"] li button');
  const waitLoaded = async pg => { for (let i = 0; i < 40; i++) { const t = await pg.locator('[role="status"]').first().innerText().catch(() => ''); if (/เชื่อมชีตแล้ว/.test(t) && !/กำลังโหลด/.test(t)) return true; await pg.waitForTimeout(500); } return false; };

  // ── 1) ศูนย์กลางรุ่นใหม่ (nsr.all) เตรียมทีละ 15 แท็บ ──
  const store = makeStore(make(55, CHUM), { buildPer: 15 });
  const A = await open(store, { viewport: { width: 1400, height: 950 } }, 'คอม');
  ok('คอม', 'all tabs loaded progressively', await waitLoaded(A.pg));
  const calls = store.log.filter(r => r.op === 'nsr.all').length;
  ok('คอม', 'loaded with few calls (no per-tab reads)', calls >= 4 && calls <= 6 && !store.log.some(r => r.op === 'nsr.read'), `nsr.all=${calls} read=${store.log.filter(r => r.op === 'nsr.read').length}`);
  await A.pg.getByLabel('ค้นหางาน').fill('ชุมแสง'); await A.pg.waitForTimeout(300);
  ok('คอม', 'search ชุมแสง finds all 5 (incl. last tabs)', (await list(A.pg).count()) === 5, String(await list(A.pg).count()));
  const first = await list(A.pg).first().innerText();
  ok('คอม', 'row title = ชื่องาน, tab shown second', /ชุมแสง/.test(first) && /แท็บ /.test(first), first);
  await A.pg.getByLabel('ค้นหางาน').fill('นิติ ชุมแสง'); await A.pg.waitForTimeout(200);
  ok('คอม', 'multi-word search narrows to 2 variants', (await list(A.pg).count()) === 2);
  await A.pg.getByLabel('ค้นหางาน').fill('ชุมเเสง'); await A.pg.waitForTimeout(200);   // เขียน แ เป็น เ+เ ไม่ต้องเจอ (ไม่เดา) — แค่ต้องไม่พัง
  await A.pg.getByLabel('ค้นหางาน').fill('นิติ ชุมแสง'); await A.pg.waitForTimeout(200);
  await list(A.pg).first().click(); await A.pg.waitForTimeout(500);
  let t = await A.pg.locator('body').innerText();
  ok('คอม', 'siblings (same job other tab) shown', /งานเดียวกันในแท็บอื่น/.test(t));
  ok('คอม', 'approval price lines under price', /ราคาต่ำกว่า [\d,]+ บาท\/ท่าน.*ต้องให้ แพนด้า อนุมัติ/s.test(t) && /ต้องให้ พี่นก อนุมัติ/.test(t));
  ok('คอม', 'approval table in card', /เส้นราคาที่ต้องขออนุมัติ/.test(t));
  // ราคาต่ำ → ต้องขออนุมัติ
  const price = A.pg.getByLabel('ราคาขายต่อท่าน'); const p0 = await price.inputValue();
  await price.fill('500'); await price.blur(); await A.pg.waitForTimeout(300);
  t = await A.pg.locator('body').innerText();
  ok('คอม', 'low price → must request approval', /ต้องขออนุมัติจาก (พี่นก|แพนด้า) ก่อนเสนอราคา/.test(t), t.match(/ลดราคาได้อีก[^\n]*/)?.[0] || '');
  await price.fill(p0); await price.blur(); await A.pg.waitForTimeout(200);
  // สถานะ: ไม่ได้งานต้องมีเหตุผล
  await A.pg.getByRole('button', { name: 'ไม่ได้งาน', exact: true }).click();
  ok('คอม', 'lost needs a reason', await A.pg.getByRole('button', { name: /บันทึก “ไม่ได้งาน”/ }).isDisabled());
  await A.pg.getByRole('button', { name: 'เลือกแบบอื่นของงานเดียวกัน' }).click();
  await A.pg.getByRole('button', { name: /บันทึก “ไม่ได้งาน”/ }).click(); await A.pg.waitForTimeout(600);
  const lostId = String(store.tabs.find(x => x.title === ' ค่ายนิติวิทย์ ชุมแสงชนูทิศ Diana').sheetId);
  ok('คอม', 'lost saved to hub with reason', store.statuses.get(lostId)?.status === 'lost' && store.statuses.get(lostId)?.reason === 'เลือกแบบอื่นของงานเดียวกัน' && store.statuses.get(lostId)?.by === 'คอม', JSON.stringify([...store.statuses.values()]));
  // เปิดอีกแบบ → ปิดการขาย
  await A.pg.getByRole('button', { name: /Kasalong/ }).first().click(); await A.pg.waitForTimeout(400);
  await A.pg.getByRole('button', { name: 'ปิดการขายแล้ว', exact: true }).click();
  await A.pg.getByLabel('จำนวนผู้เข้าร่วมจริง').fill('88');
  await A.pg.getByRole('button', { name: /บันทึก “ปิดการขายแล้ว”/ }).click(); await A.pg.waitForTimeout(600);
  const wonId = String(store.tabs.find(x => x.title === 'ค่ายนิติวิทย์ ชุมแสงชนูทิศ Kasalong').sheetId);
  ok('คอม', 'won saved with final pax', store.statuses.get(wonId)?.status === 'won' && Number(store.statuses.get(wonId)?.finalPax) === 88, JSON.stringify(store.statuses.get(wonId)));
  t = await A.pg.locator('body').innerText();
  ok('คอม', 'overview: win rate + value', /ปิดได้ 50% ของงานที่รู้ผล \(1\/2\)/.test(t) && /มูลค่าที่ปิดได้/.test(t), (t.match(/สถานะการขาย[\s\S]{0,200}/) || [''])[0]);

  // ── 2) อีกเครื่อง (มือถือ) เห็นสถานะเองแบบเรียลไทม์ ──
  const B = await open(store, devices['iPhone 13'], 'มือถือ');
  ok('มือถือ', 'loaded', await waitLoaded(B.pg));
  await B.pg.getByLabel('ค้นหางาน').fill('ชุมแสง'); await B.pg.waitForTimeout(300);
  let bt = await B.pg.locator('section[aria-label="งานย้อนหลัง"]').innerText();
  ok('มือถือ', 'sees statuses from other device', /ปิดการขาย/.test(bt) && /ไม่ได้งาน/.test(bt) && /โดย คอม/.test(bt), bt.slice(0, 400));
  // คอมเปลี่ยนสถานะ → มือถือเห็นภายในไม่กี่วินาที (rev)
  await A.pg.getByRole('button', { name: /ดาราศาสตร์/ }).first().click().catch(() => {});
  await A.pg.getByLabel('ค้นหางาน').fill('ดาราศาสตร์ ชุมแสง'); await A.pg.waitForTimeout(200); await list(A.pg).first().click(); await A.pg.waitForTimeout(300);
  await A.pg.getByRole('button', { name: 'เสนอราคาแล้ว', exact: true }).click();
  await A.pg.getByRole('button', { name: /บันทึก “เสนอราคาแล้ว”/ }).click();
  let seen = false; for (let i = 0; i < 24 && !seen; i++) { await B.pg.waitForTimeout(500); bt = await B.pg.locator('section[aria-label="งานย้อนหลัง"]').innerText(); seen = /เสนอแล้ว/.test(bt.split('ทุกสถานะ')[1] || '') && /เสนอแล้ว 1/.test(bt); }
  ok('มือถือ', 'status change from desktop appears ≤12s', seen, bt.slice(0, 300));
  await B.pg.getByRole('button', { name: /^ปิดการขาย 1$/ }).click(); await B.pg.waitForTimeout(200);
  ok('มือถือ', 'filter by status (ปิดการขาย)', (await list(B.pg).count()) === 1);
  const ov = await B.pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
  ok('มือถือ', 'no horizontal overflow', ov);
  // ชีตถูกแก้ (คนพิมพ์ในชีต) → ทั้งสองเครื่องเห็นค่าใหม่ ไม่ต้องโหลดทั้งชีต
  const before = store.log.filter(r => r.op === 'nsr.all' && r.since === 0).length;
  const tg = store.tabs.find(x => x.title === 'Chinese ชุมแสง'); const ri = tg.values.findIndex(r => /รายละเอียดงาน/.test(r[0]));
  store.poke('Chinese ชุมแสง', ri + 1, 2, 'Chinese ชุมแสง รอบ 2');
  await B.pg.getByRole('button', { name: /^ปิดการขาย 1$/ }).click(); await B.pg.getByLabel('ค้นหางาน').fill('รอบ 2');
  let upd = false; for (let i = 0; i < 24 && !upd; i++) { await B.pg.waitForTimeout(500); upd = (await list(B.pg).count()) === 1; }
  ok('มือถือ', 'sheet edit reaches phone (incremental)', upd && store.log.filter(r => r.op === 'nsr.all' && r.since === 0).length === before);
  ok('คอม', 'no console errors', !A.errs.length, A.errs.join(' | ')); ok('มือถือ', 'no console errors', !B.errs.length, B.errs.join(' | '));
  await A.ctx.close(); await B.ctx.close();

  // ── 3) ศูนย์กลางรุ่นเก่า (ไม่มี nsr.all) → อ่านแบบเดิมพร้อมกันหลายชุด ยังค้นเจอครบ ──
  const old = makeStore(make(55, CHUM), { legacy: true });
  const C = await open(old, { viewport: { width: 1400, height: 950 } }, 'รุ่นเก่า');
  ok('รุ่นเก่า', 'loads all tabs', await waitLoaded(C.pg));
  await C.pg.getByLabel('ค้นหางาน').fill('ชุมแสง'); await C.pg.waitForTimeout(300);
  ok('รุ่นเก่า', 'search finds all 5', (await list(C.pg).count()) === 5);
  ok('รุ่นเก่า', 'tells team to update script', /ศูนย์กลางทีมยังเป็นรุ่นเก่า/.test(await C.pg.locator('body').innerText()));
  await C.ctx.close();

  await b.close();
  console.log(out.join('\n')); const f = out.filter(x => /FAIL/.test(x)).length; console.log(`${out.length - f}/${out.length} passed`); process.exitCode = f ? 1 : 0;
})();
