// ตรวจไฟล์ samples/*.export.json ตาม schema.json (JSON Schema draft 2020-12)
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import fs from 'fs';
import path from 'path';
const schema = JSON.parse(fs.readFileSync('schema.json', 'utf8'));
const ajv = new Ajv2020.default({ allErrors: true, strict: false });
addFormats.default(ajv);
const validate = ajv.compile(schema);
const dir = 'samples';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.export.json'));
if (!files.length) { console.log('ไม่พบไฟล์ *.export.json ใน samples/'); process.exit(0); }
let ok = true;
for (const f of files) {
  const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const valid = validate(data);
  console.log((valid ? '✓' : '✗') + ' ' + f);
  if (!valid) { ok = false; console.log(JSON.stringify(validate.errors, null, 2)); }
}
process.exit(ok ? 0 : 1);
