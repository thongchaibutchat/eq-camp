// สร้างโค้ด Apps Script ของศูนย์กลางทีม (แบบผูกชีต NSR) → ไฟล์ · ใช้ทดสอบ/ส่งให้เจ้าของชีต
// รัน: node scripts/qa/run-ts.mjs scripts/qa/hub-code.ts <out.gs> [รหัสทีม] [รหัสเจ้าของ (ทดสอบ: ใส่สมาชิกตัวอย่าง 2 คน)]
import fs from 'fs';
(globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { hubAppsScript, newHubKey } = await import('../../web/hub');
const out = process.argv[2] || '/tmp/EQ_Camp_Hub.gs'; const key = process.argv[3] || newHubKey();
const owner = process.argv[4] || '';
const seed = owner ? [{ id: 'panda', nick: 'แพนด้า', name: 'ทดสอบ ก', email: 'panda@test.local', role: 'admin' as const }, { id: 'tata', nick: 'ตาต้า', name: 'ทดสอบ ข', email: 'tata@test.local', role: 'member' as const }, { id: 'king', nick: 'พี่กิ่ง', name: 'ทดสอบ ค', email: 'king@test.local', role: 'member' as const }, { id: 'nok', nick: 'พี่นก', name: 'ทดสอบ ง', email: 'nok@test.local', role: 'member' as const }] : [];
const config = owner ? { sme: { blue: { email: 'blue@test.local' }, orange: { email: 'orange@test.local' }, url: 'https://app.smemove.com/' } } : {};
fs.writeFileSync(out, hubAppsScript(key, '', { owner, seed, config }));
console.log(out, key);
process.exit(0);
