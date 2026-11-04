#!/usr/bin/env bash
# สร้าง bundle เว็บ + ไฟล์ standalone (เปิดได้ด้วยการดับเบิลคลิก)
set -e
npx esbuild web/entry.tsx --bundle --outfile=web/bundle.js --format=iife \
  --loader:.tsx=tsx --define:process.env.NODE_ENV='"production"' --inject:./web/shim.js
# ฝัง bundle เป็น inline script — ใช้ "ฟังก์ชัน replacement" เท่านั้น
# (ถ้าใช้สตริงธรรมดา ตัว $& ในโค้ด React เช่น "$&/" จะถูกตีความเป็น "ข้อความที่ match"
#  = <script src=./bundle.js></script> ทำให้มี </script> โผล่กลางสคริปต์ หน้าเว็บพังกลายเป็นโชว์โค้ด)
node -e "const fs=require('fs');const h=fs.readFileSync('web/index.html','utf8');const j=fs.readFileSync('web/bundle.js','utf8');const out=h.replace('<script src=\"./bundle.js\"></script>',()=>'<script>\n'+j+'\n</script>');if(out.split('</script>').length-1!==(h.split('</script>').length-1))throw new Error('inline guard: จำนวน </script> ไม่ตรง — อาจมีการ inject ผิด');fs.writeFileSync('EQ_Camp_Generator.html',out);console.log('built EQ_Camp_Generator.html');"
