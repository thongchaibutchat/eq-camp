// กวาดหาบั๊กทุกหน้า × 5 ขนาดจอ: error ใน console · หน้าล้นแนวนอน · ภาพเสีย · ปุ่ม/ช่องกรอกไม่มีชื่อ (โปรแกรมอ่านหน้าจอ) · ปุ่มเล็กเกินแตะ (มือถือ)
// รัน: LANG=C.UTF-8 node scripts/qa/e2e-sweep.cjs (เว็บที่ http://localhost:8765) · รายงาน /tmp/sweep.json
const { chromium, devices } = require('playwright');
const fs = require('fs');
const BASE = process.env.URL || 'http://localhost:8765';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const VIEWS = [
  ['desktop-1920', { viewport: { width: 1920, height: 1080 } }],
  ['laptop-1366', { viewport: { width: 1366, height: 768 } }],
  ['ipad-768', { viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true }],
  ['iphone-390', devices['iPhone 13']],
  ['android-360', { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }],
];
const BRIEF = 'โรงเรียนสวนกุหลาบวิทยาลัย ม.3 จำนวน 120 คน ครู 8 คน ค่าย STEM 3 วัน 2 คืน วันที่ 14-16 มกราคม 2570 ณ Kasalong Resort and Spa ราคาปกติ 5,900 ลดเหลือ 4,990 บาท';
(async () => {
  const b = await chromium.launch(); const issues = []; const seen = new Set();
  const add = (view, page, kind, detail) => { const k = `${kind}|${page}|${detail}`; if (seen.has(k + view)) return; seen.add(k + view); issues.push({ view, page, kind, detail }); };
  for (const [view, opt] of VIEWS) {
    const ctx = await b.newContext({ ...opt, acceptDownloads: true });
    await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('init')) { localStorage.clear(); sessionStorage.setItem('init', '1'); } } catch (e) {} });
    const pg = await ctx.newPage(); let cur = 'boot';
    pg.on('pageerror', e => add(view, cur, 'js-error', e.message.slice(0, 160)));
    pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|favicon/.test(m.text())) add(view, cur, 'console-error', m.text().slice(0, 160)); });
    const mobile = (opt.viewport || {}).width < 800;
    const audit = async (name) => {
      cur = name; await sleep(600);
      const r = await pg.evaluate((mobile) => {
        const out = { overflow: document.documentElement.scrollWidth - innerWidth, broken: [], noname: [], small: [], clipped: [] };
        for (const im of document.images) if (im.complete && im.naturalWidth === 0 && im.src && !im.src.startsWith('data:image/gif')) out.broken.push(im.src.slice(-60));
        const vis = el => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0; };
        for (const el of document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=tab]')) {
          if (!vis(el)) continue;
          const lab = (el.getAttribute('aria-label') || el.getAttribute('title') || el.innerText || el.value || el.getAttribute('placeholder') || '').trim()
            || (el.id && document.querySelector(`label[for="${el.id}"]`)?.innerText) || el.closest('label')?.innerText || '';
          if (!lab.trim()) out.noname.push(el.tagName.toLowerCase() + (el.type ? `[${el.type}]` : '') + ' ' + (el.className || '').toString().slice(0, 50));
          if (mobile && /^(BUTTON|A|SELECT)$/.test(el.tagName)) { const r = el.getBoundingClientRect(); if (r.height < 24 || r.width < 24) out.small.push(((el.getAttribute('aria-label') || el.innerText || '').trim().slice(0, 30) || el.tagName) + ` ${Math.round(r.width)}×${Math.round(r.height)}`); }
          const r = el.getBoundingClientRect(); const inScroll = (() => { for (let a = el.parentElement; a; a = a.parentElement) { const o = getComputedStyle(a).overflowX; if ((o === 'auto' || o === 'scroll') && a.scrollWidth > a.clientWidth) return true; } return false; })(); if (r.right > innerWidth + 1 && !inScroll) out.clipped.push(((el.getAttribute('aria-label') || el.innerText || '').trim().slice(0, 30) || el.tagName) + ` right=${Math.round(r.right)}`);
        }
        return out;
      }, mobile);
      if (r.overflow > 1) add(view, name, 'overflow-x', `${r.overflow}px`);
      r.broken.forEach(x => add(view, name, 'broken-image', x));
      [...new Set(r.noname)].slice(0, 8).forEach(x => add(view, name, 'no-accessible-name', x));
      [...new Set(r.small)].slice(0, 8).forEach(x => add(view, name, 'tap-target-small', x));
      [...new Set(r.clipped)].slice(0, 5).forEach(x => add(view, name, 'off-screen-control', x));
    };
    await pg.goto(BASE + '/#/'); await sleep(1500); await audit('home');
    await pg.goto(BASE + '/#/data'); await audit('data');
    for (const tab of await pg.getByRole('tab').all()) { const n = (await tab.innerText()).trim().split('\n')[0]; if (!n) continue; await tab.click().catch(() => {}); await audit('data:' + n.slice(0, 20)); }
    await pg.goto(BASE + '/#/nsr'); await audit('nsr');
    await pg.goto(BASE + '/#/past'); await audit('past');
    await pg.goto(BASE + '/#/team'); await audit('team');
    await pg.goto(BASE + '/#/build'); await sleep(800); await audit('build:brief(empty)');
    await pg.locator('textarea').first().fill(BRIEF);
    await pg.getByRole('button', { name: /เริ่มงานใหม่/ }).first().click(); await sleep(2500); await audit('build:brief(read)');
    for (let i = 0; i < 5; i++) {
      const nx = pg.getByRole('button', { name: /^ถัดไป:/ }); if (!(await nx.count())) break;
      const label = (await nx.innerText()).replace('ถัดไป:', '').trim(); await nx.click(); await sleep(900); await audit('build:' + label);
    }
    // ค้นหาทั้งระบบ
    await pg.keyboard.press('/'); await sleep(500); const sb = pg.getByRole('dialog');
    if (await sb.count()) { await pg.keyboard.type('stem'); await sleep(800); await audit('search'); await pg.keyboard.press('Escape'); }
    // งานทั้งหมด
    const all = pg.getByRole('button', { name: /งานทั้งหมด/ }).first(); if (await all.count()) { await all.click().catch(() => {}); await audit('jobs-modal'); await pg.keyboard.press('Escape'); }
    await ctx.close();
  }
  fs.writeFileSync('/tmp/sweep.json', JSON.stringify(issues, null, 1));
  const by = {}; for (const i of issues) by[i.kind] = (by[i.kind] || 0) + 1;
  console.log(JSON.stringify(by)); for (const i of issues.slice(0, 120)) console.log(`${i.view} | ${i.page} | ${i.kind} | ${i.detail}`);
  await b.close();
})();
