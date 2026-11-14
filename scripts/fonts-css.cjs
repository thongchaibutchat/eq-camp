// สร้าง @font-face ฝัง base64 (IBM Plex Sans Thai = หน้าจอ, Sarabun = พรีวิวเอกสาร) — ฟอนต์ OFL ใช้/แจกจ่ายได้
const fs = require('fs'), path = require('path');
const nm = path.join(__dirname, '..', 'node_modules', '@fontsource');
const faces = [];
const add = (fam, pkg, file, w, range) => {
  const b = fs.readFileSync(path.join(nm, pkg, 'files', file)).toString('base64');
  faces.push(`@font-face{font-family:'${fam}';font-style:normal;font-weight:${w};font-display:swap;src:url(data:font/woff2;base64,${b}) format('woff2');unicode-range:${range}}`);
};
const TH = 'U+0E01-0E5B,U+200C-200D,U+25CC', LAT = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
for (const w of [400, 500, 600]) { add('IBM Plex Sans Thai', 'ibm-plex-sans-thai', `ibm-plex-sans-thai-thai-${w}-normal.woff2`, w, TH); add('IBM Plex Sans Thai', 'ibm-plex-sans-thai', `ibm-plex-sans-thai-latin-${w}-normal.woff2`, w, LAT); }
for (const w of [400, 600]) { add('Sarabun', 'sarabun', `sarabun-thai-${w}-normal.woff2`, w, TH); add('Sarabun', 'sarabun', `sarabun-latin-${w}-normal.woff2`, w, LAT); }
process.stdout.write(faces.join('\n'));
