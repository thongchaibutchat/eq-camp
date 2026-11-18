const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1360, height: 900 }, acceptDownloads: true }); const pg = await ctx.newPage();
  await pg.goto('http://localhost:8765/#/build'); await pg.waitForTimeout(800);
  await pg.locator('textarea').first().fill(process.argv[2] || 'โรงเรียนสตรีวิทยา ม.2 จำนวน 80 คน ครู 6 คน ค่ายวิทยาศาสตร์ทางทะเล 2 วัน 1 คืน วันที่ 20-21 ม.ค. 2570 ณ โรงแรมกาสะรองรีสอร์ท ราคาปกติ 4590 ลดเหลือ 3790 บาท');
  await pg.getByRole('button', { name: /เริ่มงานใหม่/ }).first().click(); await pg.waitForTimeout(3500);
  const [d] = await Promise.all([pg.waitForEvent('download', { timeout: 180000 }), pg.getByRole('button', { name: /บันทึกโปรแกรมค่ายเป็น PDF/ }).click()]);
  await d.saveAs(process.argv[3] || '/tmp/cap.pdf');
  const [w] = await Promise.all([pg.waitForEvent('download', { timeout: 60000 }), pg.getByRole('button', { name: /ดาวน์โหลดครบชุด 4 ไฟล์/ }).first().click()]).catch(() => [null]);
  if (w) await w.saveAs((process.argv[3] || '/tmp/cap.pdf').replace('.pdf', '.docx'));
  await b.close();
})();
