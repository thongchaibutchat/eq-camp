// Regression stress: build .docx ทั้ง 4 ชนิด × หลายคอนฟิก แล้วตรวจว่าไม่ throw / เป็น zip ถูกต้อง / ทุกวันมีแถว
// รัน: npm run stress  (ผลไฟล์อยู่ /tmp/stress)
import { build } from 'esbuild';
import { pathToFileURL } from 'url';
import fs from 'fs';
const tmp = '.stress.bundle.mjs';
await build({ entryPoints: ['scripts/stress.ts'], bundle: true, platform: 'node', format: 'esm', outfile: tmp, logLevel: 'error', external: ['docx'] });
await import(pathToFileURL(process.cwd() + '/' + tmp).href);
process.on('exit', () => { try { fs.unlinkSync(tmp); } catch {} });
