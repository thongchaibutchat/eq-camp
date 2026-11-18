// ทดสอบบรีฟ → NSR (ไม่ต้องใช้เน็ต): อ่านบรีฟ, จำนวนจากกำหนดการ, งานอ้างอิง, ข้อเสนอ AI ต้องมีหลักฐาน
// รัน: node scripts/qa/run-ts.mjs scripts/qa/nsr-brief-test.ts
import fs from 'fs';
import { parseNsrTab, computeNsr, Grid } from '../../src/nsr-core';
import { draftFromBrief, applyAi } from '../../src/nsr-brief';
const raw = JSON.parse(fs.readFileSync('scripts/qa/nsr-fixture.json', 'utf8'));
const hist = Object.entries(raw).map(([t, rows]: any) => parseNsrTab(t, rows.map((r: any) => r.map(([v, f]: any) => ({ v, f: f || undefined }))) as Grid)).filter(Boolean) as any[];
let fail = 0; const ok = (n: string, c: boolean, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' ' + x)); if (!c) fail++; };
const brief = 'โรงเรียนบรีฟวิทยา ค่าย STEM 3 วัน 2 คืน นักเรียน 80 คน ครู 6 คน พักที่ภูผารีสอร์ท ห้องละ 1,600 บาท พัก 4 คน รถบัส 2 คัน ราคา 3,590 บาท/ท่าน เสื้อค่ายตัวละ 180 บาท';
const d = draftFromBrief(brief, hist);
const L = (k: string) => d.job.lines.find(l => l.key === k)!;
ok('participants/teachers/price', d.job.participants === 80 && d.job.teachers === 6 && d.job.price === 3590);
ok('room 1600/4 × 2 nights', L('room').price === 400 && L('room').qty === 2);
ok('meals from schedule', (L('mealHotel').qty || 0) >= 5 && (L('snack').qty || 0) >= 2, `${L('mealHotel').qty}/${L('snack').qty}`);
ok('bus 2 คัน auto formula', L('vehicle').qty === 2 && !!L('vehicle').auto);
ok('shirt from brief 180', L('shirt').price === 180, String(L('shirt').price));
ok('staff from reference job', d.job.staff.reduce((s, x) => s + (x.people || 0), 0) === 7 && d.job.staff.every(x => x.days === 3));
ok('refs found', d.refs.length >= 1 && d.refs[0].tab === 'stem @โรงเรียนทดสอบหนึ่ง');
const c = computeNsr(d.job);
ok('NSR computed', c.pct != null && !!c.tier && c.subtotal > 0);
ok('no unknown fields missing price', !d.fields.some(f => f.src === 'ไม่พบ' && ['participants', 'price'].includes(f.key)));
// AI: ข้อเสนอมีหลักฐาน = ใช้ · ไม่มีหลักฐาน/แก้บรรทัดสูตร/ตัวเลขผิดรูป = ไม่ใช้
const r = applyAi(d, brief, { suggest: [
  { key: 'insurance', price: 15, quote: 'ไม่มีในบรีฟ' },
  { key: 'trainer', price: 999, quote: 'นักเรียน 80 คน' },
  { key: 'snack', price: -5, quote: 'ราคา 3,590' },
  { key: 'teachers', value: 6, quote: 'ครู 6 คน' },
], notes: ['ตรวจราคาอาหาร'] });
ok('AI: only evidenced + valid used', r.used === 1 && r.rejected.length === 3, JSON.stringify(r.rejected));
ok('AI: trainer formula untouched', r.draft.job.lines.find(l => l.key === 'trainer')!.auto === true);
const d2 = draftFromBrief('ค่ายดาราศาสตร์ 2 วัน 1 คืน', []);
ok('no participants → warn, no guess', d2.job.participants == null && d2.warnings.some(w => /ผู้เข้าร่วม/.test(w)) && d2.job.lines.find(l => l.key === 'room')!.price == null);
process.exitCode = fail ? 1 : 0;
