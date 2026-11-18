// สร้างแถบท้ายกระดาษ "Explore for Learning." ความละเอียดสูง → src/footer-data.ts (รัน: node scripts/gen-footer.cjs)
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const f = (n) => fs.readFileSync(require.resolve('@fontsource/ibm-plex-sans-thai/files/' + n)).toString('base64');
const W = 1250, H = 52, SCALE = 2.4;
const html = `<!doctype html><html><head><meta charset=utf8><style>
@font-face{font-family:P;font-weight:400;src:url(data:font/woff2;base64,${f('ibm-plex-sans-thai-latin-400-normal.woff2')}) format('woff2')}
*{margin:0;padding:0}html,body{width:${W}px;height:${H}px;background:#fff}
.bar{position:absolute;left:0;right:0;top:8px;height:38px;background:linear-gradient(90deg,#3BB8E8 0%,#00A6E6 30%,#0077C8 70%,#0C2A41 100%);display:flex;align-items:center;justify-content:center}
.t{font-family:P;font-weight:400;font-size:24px;letter-spacing:1.5px;color:#fff}
</style></head><body><div class="bar"><div class="t">Explore for Learning.</div></div></body></html>`;
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: SCALE });
  await pg.setContent(html, { waitUntil: 'load' }); await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(200);
  const buf = await pg.screenshot({ clip: { x: 0, y: 0, width: W, height: H } }); await b.close();
  fs.writeFileSync(path.join(__dirname, '..', 'src', 'footer-data.ts'), `// AUTO-GENERATED (scripts/gen-footer.cjs) — แถบท้ายกระดาษความละเอียดสูง ${W * SCALE}×${H * SCALE}\nexport const FOOTER_BAR = { w: ${W * SCALE}, h: ${H * SCALE}, b64: "${buf.toString('base64')}" };\n`);
  console.log('footer', buf.length);
})();
