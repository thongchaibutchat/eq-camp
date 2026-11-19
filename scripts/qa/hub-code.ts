// สร้างโค้ด Apps Script ของศูนย์กลางทีม (แบบผูกชีต NSR) → ไฟล์ · ใช้ทดสอบ/ส่งให้เจ้าของชีต
// รัน: node scripts/qa/run-ts.mjs scripts/qa/hub-code.ts <out.gs> [รหัสทีม]
import fs from 'fs';
(globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { hubAppsScript, newHubKey } = await import('../../web/hub');
const out = process.argv[2] || '/tmp/EQ_Camp_Hub.gs'; const key = process.argv[3] || newHubKey();
fs.writeFileSync(out, hubAppsScript(key));
console.log(out, key);
process.exit(0);
