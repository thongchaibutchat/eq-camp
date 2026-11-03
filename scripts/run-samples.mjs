// bundle scripts/build-samples.ts ด้วย esbuild แล้วรันด้วย node (รองรับ TypeScript + ESM)
import { build } from 'esbuild';
import { pathToFileURL } from 'url';
import fs from 'fs';
const tmp = '.samples.bundle.mjs';
await build({ entryPoints: ['scripts/build-samples.ts'], bundle: true, platform: 'node', format: 'esm',
  outfile: tmp, logLevel: 'error', external: ['docx'] });
await import(pathToFileURL(process.cwd() + '/' + tmp).href);
process.on('exit', () => { try { fs.unlinkSync(tmp); } catch {} });
