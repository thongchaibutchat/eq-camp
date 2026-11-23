// งานเก่า (คลังโปรแกรมที่เคยส่งจริง) บนเว็บจริง + โค้ดศูนย์กลางจริงในเครื่องจำลอง (Drive จำลอง: โฟลเดอร์ปี → งาน → ไฟล์ Word/PDF)
// แอดมินสแกน → รายการ/ค้นหา/กรอง → เปิดโปรแกรมเดิมมาแก้ → งานใหม่ใช้กำหนดการเดิม เปลี่ยนโรงเรียนแล้วไม่ค้างชื่อเดิม → ดาวน์โหลด Word
// บรีฟโรงเรียนเดิม → เตือน "เคยจัดกับโรงเรียนนี้" · ค้นหาทั้งระบบเจอ · สมาชิก (iPhone) เปิดได้ ไม่มีปุ่มสแกน · ไม่ได้เชื่อมทีม = ไม่เห็นข้อมูล
// รัน: LANG=C.UTF-8 node scripts/qa/e2e-past.cjs (เว็บที่ http://localhost:8765)
const { chromium, devices } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const JSZip = require('jszip');
const { makeHub } = require('./gas-env.cjs');
const BASE = process.env.URL || 'http://localhost:8765';
const HUB = 'https://script.google.com/macros/s/AKfycbxLIYQHufbhDLnpF_bCwXhs8ZaCqAZeVNVZJRmNshaS3jDsu7zCh8lEB_wxKcQ-k1L6KA/exec';
const TEAM = 'eq-sharedgroup0002', OWN = 'own-past-test-1';
const root = __dirname + '/../..';
execFileSync('node', ['scripts/qa/run-ts.mjs', 'scripts/qa/hub-code.ts', '/tmp/hub-past.gs', TEAM, OWN], { cwd: root });
execFileSync('node', ['scripts/qa/run-ts.mjs', 'scripts/qa/past-docxml.ts', '/tmp/eq-past-doc.xml'], { cwd: root });
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const H = makeHub(fs.readFileSync('/tmp/hub-past.gs', 'utf8').replace("const PAST_FOLDER = '';", "const PAST_FOLDER = 'ROOT';"), { drive: {
  folders: {
    ROOT: { name: '2569', folders: ['J1', 'J2', 'J3'] },
    J1: { name: '691204 “ค่ายบูรณาการวิชาการภาษาอังกฤษ” (English Camp 2026) โรงเรียนอนุบาลตัวอย่างวิทยา   โปรแกรม 3 วัน 2 คืน', files: ['F1', 'F2', 'F3'] },
    J2: { name: '691114 บริษัท ตัวอย่างไฟเบอร์ จำกัด Team Building “Boost Up & Teamwork”', files: ['F4'] },
    J3: { name: '691120 STEM Camp โรงเรียนตัวอย่างวิทยาคาร', files: ['F5'] }
  },
  files: {
    F1: { name: 'English Camp โรงเรียนอนุบาลตัวอย่างวิทยา 3 วัน 2 คืน.docx', mime: DOCX, entries: [{ name: 'word/document.xml', data: fs.readFileSync('/tmp/eq-past-doc.xml', 'utf8') }] },
    F2: { name: 'English Camp โรงเรียนอนุบาลตัวอย่างวิทยา 3 วัน 2 คืน.pdf', mime: 'application/pdf' },
    F3: { name: 'ยืนยัน ใบเสนอราคา English Camp.pdf', mime: 'application/pdf' },
    F4: { name: 'Team Building.pdf', mime: 'application/pdf' },
    F5: { name: 'STEM Camp ตัวอย่างวิทยาคาร.pdf', mime: 'application/pdf' }
  } } });
const cl = H.handle({ op: 'admin.claim', owner: OWN, key: TEAM, dev: 'setup' });
const tata = H.handle({ op: 'members.key', id: 'tata', key: cl.key, dev: 'setup' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch(); const out = []; const errs = [];
  const ok = (n, c, x = '') => out.push(`${c ? 'PASS' : 'FAIL'} ${n}${c ? '' : ' ' + String(x).slice(0, 300)}`);
  const mk = async (opt, tag, hub = true) => {
    const ctx = await b.newContext({ ...opt, acceptDownloads: true }); const pg = await ctx.newPage();
    pg.on('dialog', d => d.accept());
    pg.on('pageerror', e => errs.push(tag + ': ' + e.message)); pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push(tag + ': ' + m.text()); });
    if (hub) await ctx.route(HUB + '**', async route => { const r = route.request(); const res = r.method() === 'POST' ? H.handle(JSON.parse(r.postData())) : { ok: true }; return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(res) }); });
    return { ctx, pg };
  };
  const body = p => p.locator('body').innerText();
  const until = async (p, re, ms = 8000) => { let t = ''; for (let i = 0; i < ms / 250; i++) { t = await body(p); if (re.test(t)) return t; await sleep(250); } return t; };
  // ── ไม่ได้เชื่อมทีม ──
  { const N = await mk({ viewport: { width: 1360, height: 900 } }, 'N', false);
    await N.pg.goto(BASE + '/#/past'); const t = await until(N.pg, /เชื่อมต่อทีม/);
    ok('not connected: asks to connect, no data', /เชื่อมต่อทีมด้วยลิงก์ส่วนตัว/.test(t) && !/อนุบาลตัวอย่าง/.test(t), t.slice(0, 300));
    await N.ctx.close(); }
  // ── แอดมิน (คอม) ──
  const A = await mk({ viewport: { width: 1360, height: 900 } }, 'A');
  await A.pg.goto(`${BASE}/#/t/${cl.key}`); await sleep(1500); await A.pg.keyboard.press('Escape');
  await A.pg.getByRole('button', { name: 'งานเก่า' }).first().click();
  let t = await until(A.pg, /สแกนโฟลเดอร์ใหม่/);
  ok('nav: งานเก่า page (#/past)', /#\/past/.test(A.pg.url()) && /ยังไม่มีรายการ/.test(t), t.slice(0, 300));
  await A.pg.getByRole('button', { name: 'สแกนโฟลเดอร์ใหม่' }).click();
  t = await until(A.pg, /พบ 3 งาน/);
  ok('admin scan → 3 jobs listed', /พบ 3 งาน/.test(t) && /โปรแกรมที่ทีมเคยส่งจริง 3 งาน/.test(t), t.slice(0, 500));
  ok('job row: date + course + duration + confirmed', /4 ธ\.ค\. 69/.test(t) && /ภาษาอังกฤษ/.test(t) && /3 วัน 2 คืน/.test(t) && /ยืนยันแล้ว/.test(t), t.slice(0, 600));
  ok('grouped by month', /ธันวาคม 2569/.test(t) && /พฤศจิกายน 2569/.test(t));
  ok('corp + pdf-only: view only', /ดูไฟล์ได้อย่างเดียว/.test(t) && /มีแต่ PDF/.test(t));
  ok('drive links to files/folder', (await A.pg.locator('a[href^="https://drive.google.com/file/d/F1"]').count()) === 1 && (await A.pg.locator('a[href="https://drive.google.com/drive/folders/J1"]').count()) === 1);
  await A.pg.getByRole('button', { name: /องค์กร \/ Team Building/ }).click(); t = await until(A.pg, /พบ 1 งาน/);
  ok('filter: corp', /พบ 1 งาน/.test(t) && /ตัวอย่างไฟเบอร์/.test(t));
  await A.pg.getByRole('button', { name: /^ทั้งหมด/ }).click();
  await A.pg.getByPlaceholder(/ค้นหาโรงเรียน/).fill('อนุบาล ตัวอย่าง'); t = await until(A.pg, /พบ 1 งาน/);
  ok('search multiword', /พบ 1 งาน/.test(t) && /อนุบาลตัวอย่างวิทยา/.test(t));
  // เปิดมาแก้
  await A.pg.getByRole('button', { name: 'เปิดมาแก้', exact: true }).click();
  t = await until(A.pg, /ตรวจผลอ่านโปรแกรมเดิม/);
  ok('review: found fields', /3 วัน · \d+ แถวกำหนดการ/.test(t) && /PL ENG 0104/.test(t) && /90/.test(t) && /990/.test(t), t.slice(0, 800));
  await A.pg.getByRole('button', { name: 'สร้างงานใหม่จากโปรแกรมนี้' }).click();
  t = await until(A.pg, /ดึงโปรแกรมเดิมมาเป็นงานใหม่แล้ว/);
  ok('opened as new job in builder', /#\/build/.test(A.pg.url()) && /ดึงโปรแกรมเดิมมาเป็นงานใหม่แล้ว/.test(t), t.slice(0, 300));
  let pv = await A.pg.locator('.doc-preview').innerText();
  ok('preview uses old program', /Run Read & Write/.test(pv) && /Performance Night/.test(pv) && /นักสื่อสาร/.test(pv), pv.slice(0, 600));
  await A.pg.locator('div:has(> label:text-is("ชื่อโรงเรียน")) input').first().fill('โรงเรียนใหม่ทดสอบ'); await sleep(1200);
  pv = await A.pg.locator('.doc-preview').innerText();
  ok('change school → preview: no old school, no placeholders', !/อนุบาลตัวอย่าง/.test(pv) && !/\{[SVPY]\}/.test(pv), JSON.stringify([/โรงเรียนใหม่ทดสอบ/.test(pv), (pv.match(/.{0,40}อนุบาลตัวอย่าง.{0,20}/) || [''])[0], (pv.match(/.{0,30}\{[SVPY]\}.{0,30}/) || [''])[0]]));
  const [dl] = await Promise.all([A.pg.waitForEvent('download', { timeout: 30000 }), A.pg.locator('header').getByRole('button', { name: /^ดาวน์โหลด/ }).first().click()]);
  const zip = await JSZip.loadAsync(fs.readFileSync(await dl.path()));
  const xml = (await zip.file('word/document.xml').async('string')).replace(/<[^>]+>/g, '');
  ok('Word: new school + old activities, old school gone', /โรงเรียนใหม่ทดสอบ/.test(xml) && /Word Chain Relay/.test(xml) && !/อนุบาลตัวอย่าง/.test(xml), dl.suggestedFilename());
  // บรีฟโรงเรียนเดิม → เตือนเคยจัด
  await A.pg.goto(BASE + '/#/build'); await sleep(600);
  await A.pg.getByRole('button', { name: /^(\d\s*)?บรีฟ$/ }).first().click(); await sleep(400);
  await A.pg.locator('textarea').first().fill('โรงเรียนอนุบาลตัวอย่างวิทยา ขอค่ายวิทยาศาสตร์ 1 วัน นักเรียน 60 คน');
  await A.pg.getByRole('button', { name: /เริ่มงานใหม่/ }).first().click();
  t = await until(A.pg, /เคยจัดกับโรงเรียนนี้/);
  ok('brief: worked with this school before', /เคยจัดกับโรงเรียนนี้ 1 งาน/.test(t) && /ภาษาอังกฤษ · 3 วัน 2 คืน · ยืนยันแล้ว/.test(t), t.slice(0, 400));
  await A.pg.getByRole('button', { name: /ดูงานเก่า/ }).click(); t = await until(A.pg, /พบ 1 งาน/);
  ok('hint → past page filtered', /#\/past/.test(A.pg.url()) && /พบ 1 งาน/.test(t));
  // ค้นหาทั้งระบบ
  await A.pg.keyboard.press('/'); await A.pg.keyboard.type('ไฟเบอร์'); t = await until(A.pg, /งานเก่า/);
  ok('global search finds past job', /ตัวอย่างไฟเบอร์/.test(t) && /องค์กร/.test(t));
  await A.pg.keyboard.press('Escape');
  // ── สมาชิก (iPhone) ──
  const T = await mk(devices['iPhone 13'], 'T');
  await T.pg.goto(`${BASE}/#/t/${tata.key}`); await sleep(1500); await T.pg.keyboard.press('Escape');
  await T.pg.goto(BASE + '/#/past'); t = await until(T.pg, /พบ 3 งาน/);
  ok('member: list visible, no scan button', /พบ 3 งาน/.test(t) && !(await T.pg.getByRole('button', { name: 'สแกนโฟลเดอร์ใหม่' }).count()), t.slice(0, 300));
  const ow = await T.pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok('mobile: no horizontal overflow', ow <= 1, String(ow));
  await T.pg.getByRole('button', { name: 'เปิดมาแก้', exact: true }).click(); t = await until(T.pg, /สร้างงานใหม่จากโปรแกรมนี้/);
  ok('member: can open old program', /ตรวจผลอ่านโปรแกรมเดิม/.test(t));
  ok('server: member scan forbidden', H.handle({ op: 'past.scan', key: tata.key, dev: 'x' }).error === 'forbidden');
  ok('no console errors', !errs.length, errs.join(' | '));
  console.log(out.join('\n')); const f = out.filter(x => x.startsWith('FAIL')).length;
  console.log(f ? `e2e-past: ${f} FAIL` : `e2e-past: ${out.length}/${out.length} pass`);
  await b.close(); process.exit(f ? 1 : 0);
})();
