// สร้าง word/document.xml จริงจากไฟล์ Word ที่ระบบสร้าง (โปรแกรมจากโครงงานเก่าตัวอย่าง) → ใช้ทดสอบตัวแตกข้อความของศูนย์กลาง
import { readFileSync, writeFileSync } from 'fs';
import JSZip from 'jszip';
import { parsePastProgram } from '../../src/past-import';
import { buildDoc, packDocx } from '../../src/eqcamp-core';
const out = process.argv[2] || '/tmp/eq-past-doc.xml';
const p = parsePastProgram(readFileSync('scripts/qa/fixtures/past-eng.txt', 'utf8'), { fileId: 'X' });
const buf: any = await packDocx(await buildDoc('program', p.camp), 'buffer' as any);
const zip = await JSZip.loadAsync(buf);
writeFileSync(out, await zip.file('word/document.xml')!.async('string'));
console.log(out); process.exit(0);
