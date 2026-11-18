// ตรวจตัวอ่าน/ตัวคำนวณ NSR กับแท็บงานจริง (ไฟล์ดิบจากชีต — ไม่อยู่ใน repo เพราะมีต้นทุนจริง)
// รัน: node scripts/qa/run-ts.mjs scripts/qa/nsr-audit.ts /tmp/nsr/p1.json
import fs from 'fs';
import { parseNsrTab, computeNsr, jobToGrid, diffForTab, Grid } from '../../src/nsr-core';
const file = process.argv[2] || '/tmp/nsr/p1.json';
const raw: Record<string, [string, string][][]> = JSON.parse(fs.readFileSync(file, 'utf8'));
const over30: string[] = [], auditList: string[] = []; let ok = 0, parsed = 0, fail: string[] = [], mism: string[] = [], audits = 0, warns = 0; const tiers: Record<string, number> = {};
const near = (a: number | null | undefined, b: number | null) => a == null || b == null || Math.abs(a - b) <= 1.01;
for (const [t, rows] of Object.entries(raw)) {
  const grid: Grid = rows.map(r => r.map(([v, f]) => ({ v, f: f || undefined })));
  const j = parseNsrTab(t, grid);
  if (!j) { fail.push(t); continue; }
  parsed++;
  const c = computeNsr(j);
  warns += j.warnings.length; if (c.audit.length) audits++;
  if (c.pct != null && c.pct > 0.3) over30.push(`${t} ${(c.pct*100).toFixed(1)}%`);
  if (c.audit.length) auditList.push(t + ': ' + c.audit.join(' | '));
  if (c.tier) tiers[c.tier.id] = (tiers[c.tier.id] || 0) + 1;
  // กำไรจริงของชีต = ราคา − ต้นทุนรวม(ชีต) → เทียบเฉพาะเมื่อผลรวมชีตตรงกับเรา
  const subOk = near(j.sheet?.subtotal, c.subtotal);
  const vatOk = near(j.sheet?.vat, c.vat);
  if (subOk && vatOk && !near(j.sheet?.profit, c.profit) && !c.audit.some(a => a.includes('กำไรจริง'))) mism.push(`${t}: profit ชีต ${j.sheet?.profit} เรา ${c.profit}`);
  else if (subOk && vatOk) ok++;
  // แท็บใหม่สร้างได้ / ไม่แก้อะไร = ไม่มี edit
  const g = jobToGrid(j, 'x'); if (!g.length) fail.push(t + ' (grid)');
  const d = diffForTab(j, j); if (!d.ok || d.edits.length) fail.push(t + ' (diff ' + (d.ok ? d.edits.length : d.reason) + ')');
}
console.log(JSON.stringify({ tabs: Object.keys(raw).length, parsed, matchSheet: ok, auditFlagged: audits, warnings: warns, tiers, fail: fail.slice(0, 10), mism: mism.slice(0, 10), over30: over30.length, over30s: over30.slice(0,8), auditList }, null, 1));
if (fail.length || mism.length) process.exitCode = 1;
