#!/usr/bin/env bash
# สร้าง bundle เว็บ + ไฟล์ standalone (เปิดได้ด้วยการดับเบิลคลิก)
set -e
npx esbuild web/entry.tsx --bundle --outfile=web/bundle.js --format=iife \
  --loader:.tsx=tsx --define:process.env.NODE_ENV='"production"' --inject:./web/shim.js
node -e "const fs=require('fs');const h=fs.readFileSync('web/index.html','utf8');const j=fs.readFileSync('web/bundle.js','utf8');fs.writeFileSync('EQ_Camp_Generator.html',h.replace('<script src=\"./bundle.js\"></script>','<script>\n'+j+'\n</script>'));console.log('built EQ_Camp_Generator.html');"
