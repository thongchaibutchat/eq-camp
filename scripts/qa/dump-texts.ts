// รัน: npx tsx scripts/qa/dump-texts.ts && python3 scripts/qa/spell-unknown.py (ต้อง pip install pythainlp) — ใช้หาคำผิดใหม่แล้วเพิ่มใน data/typo-fixes.json
// รวมข้อความทุกแหล่งที่ขึ้นเอกสาร: แม่แบบ, คลังกิจกรรม, หลักสูตร, Notion, + ข้อความในไฟล์ core
import { TEMPLATES, LIB, COURSES, NOTION_ACTIVITIES, SUBJECTS, VENUES } from '../../src/eqcamp-core';
import * as fs from 'fs';
const out: { src: string; t: string }[] = [];
const walk = (o: any, src: string) => { if (typeof o === 'string') { if (/[฀-๿]/.test(o)) out.push({ src, t: o }); } else if (Array.isArray(o)) o.forEach((x, i) => walk(x, src)); else if (o && typeof o === 'object') for (const k of Object.keys(o)) { if (k === 'photos') continue; walk(o[k], src); } };
TEMPLATES.forEach(t => walk(t, 'TPL ' + t.id)); LIB.forEach(a => walk(a.title, 'LIB ' + a.id)); walk(COURSES, 'COURSES'); walk(NOTION_ACTIVITIES, 'NOTION'); walk(SUBJECTS, 'SUBJECTS'); walk(VENUES, 'VENUES');
const core = fs.readFileSync('src/eqcamp-core.ts', 'utf8').split('\n');
core.forEach((l, i) => { if (/^\s*\/\//.test(l)) return; for (const m of l.matchAll(/(['"`])((?:(?!\1).)*[฀-๿](?:(?!\1).)*)\1/g)) out.push({ src: 'core:' + (i + 1), t: m[2] }); });
fs.writeFileSync('/tmp/qa-texts.json', JSON.stringify(out));
console.log(out.length);
