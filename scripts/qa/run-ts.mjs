// รันสคริปต์ .ts (bundle ด้วย esbuild) — node scripts/qa/run-ts.mjs <file.ts> [args]
import { build } from 'esbuild'; import { pathToFileURL } from 'url'; import fs from 'fs';
const [, , entry, ...rest] = process.argv; const out = '.qa.' + Date.now() + '.mjs';
await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error', external: ['docx', 'playwright'] });
process.argv = [process.argv[0], entry, ...rest];
process.on('exit', () => { try { fs.unlinkSync(out); } catch {} });
await import(pathToFileURL(process.cwd() + '/' + out).href);
