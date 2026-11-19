const { chromium } = require('playwright');
const K = 'eq-abcdefgh12345678', U = 'https://script.google.com/macros/s/AKfycbxLIYQHufbhDLnpF_bCwXhs8ZaCqAZeVNVZJRmNshaS3jDsu7zCh8lEB_wxKcQ-k1L6KA/exec';
const full = Buffer.from(JSON.stringify({ u: U, k: K })).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const B = 'http://localhost:8765/index.html';
(async () => {
  const br = await chromium.launch(); let pass = 0, fail = 0;
  const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
  const fresh = async () => { const ctx = await br.newContext(); const p = await ctx.newPage();
    await p.route(/script\.google\.com/, r => { let k = ''; try { k = JSON.parse(r.request().postData() || '{}').key; } catch {} r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(k === K ? { ok: true, rev: 1, tabs: [], items: [], jobs: [], events: [], left: 0 } : { ok: false, error: 'key' }) }); });
    return p; };
  for (const [name, url] of [['short #/t/', `${B}#/t/${K}`], ['full #/join/', `${B}#/join/${full}`], ['encoded %23', `${B}#%2Ft%2F${K}`], ['query ?t=', `${B}?t=${K}`], ['LINE external ?openExternalBrowser=1#/t/', `${B}?openExternalBrowser=1#/t/${K}`]]) {
    const p = await fresh(); await p.goto(url); await p.waitForTimeout(1500);
    const st = await p.evaluate(() => ({ k: localStorage.getItem('eqcamp.hub.key'), h: location.hash, s: location.search }));
    ok(st.k === K && st.h === '#/nsr', `${name} → key set, lands on NSR (${st.h}${st.s})`); await p.context().close();
  }
  // วางในช่อง
  for (const [name, text, expect] of [['paste code only', K, true], ['paste short link', `https://thongchaibutchat.github.io/eq-camp/#/t/${K}`, true], ['paste %23 link', `https://thongchaibutchat.github.io/eq-camp/%23/t/${K}`, true], ['paste link with spaces/newline', `  เปิดลิงก์นี้\nhttps://thongchaibutchat.github.io/eq-camp/#/join/${full}  `, true], ['paste plain site link', 'https://thongchaibutchat.github.io/eq-camp/', false]]) {
    const p = await fresh(); await p.goto(B + '#/nsr'); await p.waitForTimeout(800);
    await p.evaluate(() => localStorage.setItem('eqcamp.hub.key', 'eq-WRONGWRONG1')); await p.reload(); await p.waitForTimeout(800);
    await p.locator('button:has-text("ทีม")').first().click().catch(() => {});
    await p.waitForTimeout(400);
    const inp = p.getByLabel('วางลิงก์ทีมหรือรหัสทีม');
    if (!(await inp.count())) { ok(false, name + ' — join box not found'); await p.context().close(); continue; }
    await inp.fill(text); const en = await p.getByRole('button', { name: 'เข้าร่วม' }).isEnabled(); await p.getByRole('button', { name: 'เข้าร่วม' }).click(); await p.waitForTimeout(600);
    const k = await p.evaluate(() => localStorage.getItem('eqcamp.hub.key')); const body = await p.evaluate(() => document.body.innerText);
    ok(en && (expect ? k === K : (k !== K && /ลิงก์เว็บธรรมดา/.test(body))), `${name} → ${expect ? 'joined' : 'clear message'} (button enabled=${en})`);
    await p.context().close();
  }
  console.log(`${pass}/${pass + fail} passed`); await br.close(); process.exit(fail ? 1 : 0);
})();
