#!/usr/bin/env bash
# สร้างไฟล์เว็บไฟล์เดียว EQ_Camp_Generator.html — ทุกอย่างอยู่ในไฟล์ (CSS/ฟอนต์/jsPDF/html2canvas/แอป)
# ไม่ดึงอะไรจากเว็บอื่น → ใช้ได้ทุกเครื่อง/ทุกเบราว์เซอร์ เครือข่ายที่บล็อก CDN และออฟไลน์ (หลังเปิดครั้งแรกบน GitHub Pages)
set -e
# target es2019 + safari13: รองรับ iPhone/iPad iOS 13+ และ Android รุ่นเก่า (แปลง ?. ?? ให้)
npx esbuild web/entry.tsx --bundle --minify --outfile=web/bundle.js --format=iife --target=es2019,safari13,chrome70,firefox68 \
  --loader:.tsx=tsx --define:process.env.NODE_ENV='"production"' --inject:./web/shim.js --log-level=warning
npx tailwindcss -c web/tailwind.config.cjs -i web/styles.css -o web/out.css --minify 2>/dev/null
node scripts/fonts-css.cjs > web/fonts.css
# ฝังด้วย "ฟังก์ชัน replacement" เท่านั้น (สตริงธรรมดา $& ในโค้ด React จะถูกตีความผิด → หน้าเว็บพัง)
node -e "
const fs=require('fs');
const h=fs.readFileSync('web/index.html','utf8');
const css=fs.readFileSync('web/fonts.css','utf8')+'\n'+fs.readFileSync('web/out.css','utf8');
const libs=[fs.readFileSync('node_modules/jspdf/dist/jspdf.umd.min.js','utf8'),fs.readFileSync('node_modules/html2canvas/dist/html2canvas.min.js','utf8')];
const j=fs.readFileSync('web/bundle.js','utf8');
const esc=s=>s.replace(/<\/script/gi,'<\\\\/script');
let out=h.replace('<!--INLINE_CSS-->',()=>'<style>'+css+'</style>')
  .replace('<!--INLINE_LIBS-->',()=>libs.map(l=>'<script>'+esc(l)+'</script>').join('\n'))
  .replace('<script src=\"./bundle.js\"></script>',()=>'<script>\n'+esc(j)+'\n</script>');
const n=s=>(s.match(/<\/script>/g)||[]).length;
if(n(out)!==n(h)+2) throw new Error('inline guard: จำนวน </script> ไม่ตรง ('+n(out)+' vs '+(n(h)+2)+')');
if(/<script[^>]+src=\\s*[\"']?https?:|<link[^>]+href=\\s*[\"']?https?:/i.test(out)) throw new Error('ยังมีการโหลดไฟล์จากเว็บภายนอก');
fs.writeFileSync('EQ_Camp_Generator.html',out);
console.log('built EQ_Camp_Generator.html', (out.length/1048576).toFixed(2)+' MB');
"
