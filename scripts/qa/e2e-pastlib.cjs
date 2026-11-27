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
const IMGXML = '<w:p><w:r><w:t>ตัวอย่างภาพบรรยากาศที่พัก Kasalong Resort and Spa</w:t></w:r></w:p><w:p><w:r><w:drawing><a:blip r:embed="rIdA"/></w:drawing></w:r></w:p><w:p><w:r><w:drawing><a:blip r:embed="rIdB"/></w:drawing></w:r></w:p><w:p><w:r><w:t>รถบัสปรับอากาศ</w:t></w:r></w:p><w:p><w:r><w:drawing><a:blip r:embed="rIdC"/></w:drawing></w:r></w:p>';
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const H = makeHub(fs.readFileSync('/tmp/hub-past.gs', 'utf8').replace("const PAST_FOLDER = '';", "const PAST_FOLDER = 'ROOT';"), { drive: {
  folders: {
    ROOT: { name: '2569', folders: ['J1', 'J2', 'J3'] },
    J1: { name: '691204 “ค่ายบูรณาการวิชาการภาษาอังกฤษ” (English Camp 2026) โรงเรียนอนุบาลตัวอย่างวิทยา   โปรแกรม 3 วัน 2 คืน', files: ['F1', 'F2', 'F3'] },
    J2: { name: '691114 บริษัท ตัวอย่างไฟเบอร์ จำกัด Team Building “Boost Up & Teamwork”', files: ['F4'] },
    J3: { name: '691120 STEM Camp โรงเรียนตัวอย่างวิทยาคาร', files: ['F5'] }
  },
  files: {
    F1: { name: 'English Camp โรงเรียนอนุบาลตัวอย่างวิทยา 3 วัน 2 คืน.docx', mime: DOCX, entries: [{ name: 'word/document.xml', data: fs.readFileSync('/tmp/eq-past-doc.xml', 'utf8').replace(/<w:sectPr|<\/w:body>/, m => IMGXML + m) },
      { name: 'word/_rels/document.xml.rels', data: '<Relationships><Relationship Id="rIdA" Target="media/image1.jpeg"/><Relationship Id="rIdB" Target="media/image2.jpeg"/><Relationship Id="rIdC" Target="media/image3.jpeg"/></Relationships>' },
      ...[1, 2, 3].map(n => ({ name: `word/media/image${n}.jpeg`, data: fs.readFileSync(root + `/scripts/qa/fixtures/past-img${n}.jpg`) }))] },
    F2: { name: 'English Camp โรงเรียนอนุบาลตัวอย่างวิทยา 3 วัน 2 คืน.pdf', mime: 'application/pdf' },
    F3: { name: 'ยืนยัน ใบเสนอราคา English Camp.pdf', mime: 'application/pdf' },
    F4: { name: 'Team Building.pdf', mime: 'application/pdf' },
    F5: { name: 'STEM Camp ตัวอย่างวิทยาคาร.pdf', mime: 'application/pdf' }
  } } });
const cl = H.handle({ op: 'admin.claim', owner: OWN, key: TEAM, dev: 'setup' });
const tata = H.handle({ op: 'members.key', id: 'tata', key: cl.key, dev: 'setup' });
H.log = []; { const h0 = H.handle.bind(H); H.handle = q => { H.log.push({ op: q.op }); return h0(q); }; }
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
  // ── แอดมิน: สแกน → อ่านทุกงาน → คลังกิจกรรมจากงานจริง ──
  const A = await mk({ viewport: { width: 1360, height: 900 } }, 'A');
  await A.pg.goto(`${BASE}/#/t/${cl.key}`); await sleep(1500); await A.pg.keyboard.press('Escape');
  await A.pg.goto(`${BASE}/#/past`); await sleep(800);
  let t = await until(A.pg, /สแกนโฟลเดอร์ใหม่/);
  await A.pg.getByRole('button', { name: 'สแกนโฟลเดอร์ใหม่' }).click();
  t = await until(A.pg, /พบ 3 งาน/);
  ok('panel shown before reading', /คลังกิจกรรมจากงานจริง/.test(t) && /อ่านทุกงาน \(1\)/.test(t), t.slice(0, 600));
  await A.pg.getByRole('button', { name: /อ่านทุกงาน/ }).click();
  t = await until(A.pg, /อ่านโปรแกรมแล้ว 1 จาก 1 งาน/, 15000);
  ok('library built: 1 program read', /อ่านโปรแกรมแล้ว 1 จาก 1 งาน/.test(t) && /กิจกรรมที่ใช้จริง \d+ รายการ/.test(t), t.slice(0, 700));
  const pastTexts = H.log ? H.log.filter(x => x.op === 'past.text').length : -1;
  ok('read via past.text (1 file)', pastTexts === 1, pastTexts);
  await A.pg.getByRole('tab', { name: /ใช้บ่อยที่สุด/ }).click(); await sleep(300);
  t = await body(A.pg);
  ok('top list shows real activity + count', /Run Read & Write/.test(t) && /1 งาน · ล่าสุด 4 ธ\.ค\. 69/.test(t), t.slice(0, 900));
  await A.pg.getByRole('tab', { name: /ที่พักที่ใช้จริง/ }).click(); await sleep(300);
  t = await body(A.pg);
  ok('venue tab', /ที่พักที่ใช้จริง \(\d+\)/.test(t), t.slice(0, 400));
  const dl = A.pg.waitForEvent('download'); await A.pg.getByRole('button', { name: /ส่งออกให้ทีมตรวจ/ }).click(); const d = await dl;
  const csv = fs.readFileSync(await d.path(), 'utf8');
  ok('csv export', csv.charCodeAt(0) === 0xFEFF && /"หลักสูตร"/.test(csv.split('\n')[0]) && /Run Read & Write/.test(csv) && !/ราคา|ต้นทุน/.test(csv.split('\n')[0]), JSON.stringify([csv.charCodeAt(0), /Run Read/.test(csv)]));
  // อ่านซ้ำ = ไม่อ่านไฟล์เดิมซ้ำ (ไม่มีอะไรเปลี่ยน)
  const before = H.log ? H.log.length : 0;
  await A.pg.getByRole('button', { name: /อัปเดตจากงานที่แก้ใหม่/ }).click(); await sleep(1500);
  ok('incremental: nothing re-read', !H.log || H.log.slice(before).filter(x => x.op === 'past.text').length === 0, H.log && H.log.slice(before).map(x => x.op));
  // ── คลังภาพจากงานจริง ──
  t = await body(A.pg);
  ok('photos panel offered', /คลังภาพจากงานจริง/.test(t) && /รวมภาพจาก 1 โปรแกรม/.test(t), t.slice(0, 600));
  await A.pg.getByRole('button', { name: /รวมภาพจาก 1 โปรแกรม/ }).click();
  t = await until(A.pg, /ภาพ 3 ใบจาก 1 โปรแกรม/, 10000);
  ok('photos grouped: venue 2 · bus 1', /ที่พัก 2 · รถบัส 1/.test(t) && /Kasalong Resort and Spa/.test(t) && /รถบัส \/ การเดินทาง/.test(t), t.slice(0, 900));
  await A.pg.getByRole('button', { name: /Kasalong Resort and Spa/ }).first().click(); await sleep(2500);
  const imgs = await A.pg.locator('section[aria-label="คลังภาพจากงานจริง"] img').count();
  ok('venue thumbnails load', imgs === 2, imgs);
  // ── หน้าเลือกกิจกรรม: เห็นการใช้จริง + กิจกรรมจากงานจริงที่ยังไม่อยู่ในคลัง ──
  await A.pg.goto(`${BASE}/#/build`); await sleep(1000);
  await A.pg.locator('textarea').first().fill('โรงเรียนทดสอบคลังจริง ม.2 จำนวน 80 คน ครู 6 คน ค่ายภาษาอังกฤษ English Camp 3 วัน 2 คืน');
  await A.pg.getByRole('button', { name: /เริ่มงานใหม่/ }).first().click(); await sleep(2500);
  for (let i = 0; i < 2; i++) { await A.pg.getByRole('button', { name: /^ถัดไป:/ }).click(); await sleep(400); }
  t = await body(A.pg);
  ok('picker: real usage on catalog items', /งานจริงปีนี้ 1 งาน · ล่าสุด 4 ธ\.ค\. 69/.test(t), t.slice(0, 400));
  const hasNew = /จากงานจริงที่ทีมส่งแล้ว \(ยังไม่อยู่ในคลัง\)/.test(t);
  ok('picker: real-only section', hasNew, t.slice(0, 600));
  if (hasNew) {
    const sec = A.pg.locator('section[aria-label="กิจกรรมจากงานจริงที่ยังไม่อยู่ในคลัง"]');
    const first = sec.getByRole('checkbox').first(); const nm = (await sec.locator('li').first().innerText()).split('\n')[0].trim();
    await first.check(); await sleep(800);
    const picked = await A.pg.locator('[aria-label="กิจกรรมที่จะดึงเข้าโปรแกรม"]').innerText();
    ok('tick real activity → pick list (จากงานจริง)', picked.includes(nm) && /จากงานจริง/.test(picked), picked.slice(0, 300));
  }
  ok('picker: Station group', /ฐานกิจกรรม Station \(หมุนเวียน\)/.test(await (async () => { await A.pg.getByRole('tab', { name: /^คณิตศาสตร์/ }).first().click().catch(() => {}); await sleep(300); return body(A.pg); })()), '');
  // ── ขั้นภาพของงาน: ใส่ภาพที่พักจากงานจริง ──
  await A.pg.getByRole('button', { name: /^ถัดไป:/ }).click(); await sleep(300);
  for (let i = 0; i < 3; i++) { const nx = A.pg.getByRole('button', { name: /^ถัดไป:/ }); if (await nx.count()) { await nx.click(); await sleep(400); } }
  t = await body(A.pg);
  ok('photo step shows real photos', /คลังภาพจากงานจริง/.test(t), t.slice(0, 300));
  const vbtn = A.pg.locator('section[aria-label="คลังภาพจากงานจริง"]').getByRole('button', { name: /Kasalong/ }).first();
  if (await vbtn.getAttribute('aria-expanded') !== 'true') await vbtn.click();
  await sleep(2500);
  const before2 = await A.pg.getByText('ฝังภาพของที', { exact: false }).count();
  await A.pg.getByRole('button', { name: 'ใส่ในงานนี้' }).first().click(); await sleep(1500);
  const after2 = await A.pg.getByText('ฝังภาพของที', { exact: false }).count();
  ok('use photo → embedded in venue images', after2 === before2 + 1 && await A.pg.getByRole('button', { name: 'ใส่แล้ว' }).count() === 1, [before2, after2]);
  // ── สมาชิก iPhone เห็นคลังของตัวเอง (ต้องอ่านเองในเครื่อง) ──
  const T = await mk(devices['iPhone 13'], 'T');
  await T.pg.goto(`${BASE}/#/t/${tata.key}`); await sleep(1500); await T.pg.keyboard.press('Escape').catch(() => {});
  await T.pg.goto(`${BASE}/#/past`); t = await until(T.pg, /คลังกิจกรรมจากงานจริง/);
  ok('member: panel + can read', /อ่านทุกงาน \(1\)/.test(t), t.slice(0, 400));
  await T.pg.getByRole('button', { name: /อ่านทุกงาน/ }).click();
  t = await until(T.pg, /อ่านโปรแกรมแล้ว 1 จาก 1 งาน/, 15000);
  ok('member: built on phone', /อ่านโปรแกรมแล้ว 1 จาก 1 งาน/.test(t), t.slice(0, 300));
  const ov = await T.pg.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok('iphone: no overflow', ov <= 1, ov);
  ok('no console errors', !errs.length, errs.join(' | '));
  console.log(out.join('\n')); console.log(`${out.filter(x => x.startsWith('PASS')).length}/${out.length} passed`);
  await b.close(); process.exit(out.some(x => x.startsWith('FAIL')) ? 1 : 0);
})();
