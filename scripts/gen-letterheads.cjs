// สร้างหัวกระดาษรายภาค → src/letterhead-full-data.ts  (รัน: node scripts/gen-letterheads.cjs)
// ต้องมี @fontsource/kanit (npm i --no-save @fontsource/kanit) + playwright
const { chromium } = require('playwright'); const fs=require('fs'); const path=require('path');
const A=(f)=>path.join(__dirname,'letterhead-assets',f);
const KF=(f)=>require.resolve('@fontsource/kanit/files/'+f);
const d=(p)=>fs.readFileSync(p).toString('base64');
const kThai4=d(KF('kanit-thai-400-normal.woff2'));
const kThai7=d(KF('kanit-thai-700-normal.woff2'));
const kLat4=d(KF('kanit-latin-400-normal.woff2'));
const kLat7=d(KF('kanit-latin-700-normal.woff2'));
const logo=d(A('LOGO.png')); const icons=d(A('ICONSTRIP.png'));
const ADDR={
  central:'523 ม.4 แขวงบางปะกอก เขตราษฎร์บูรณะ กรุงเทพมหานคร 10140',
  isan:'289/69 ไพรเวท พาร์ค วิลล์ ม.4 ต.หนองบัว อ.เมือง จ.อุดรธานี 41000',
  north:'62 ม.10 ต.ป่าไผ่ อ.สันทราย จ.เชียงใหม่ 50210',
  south:'118/73 ตึก C ม.1 ถ.วิชิตสงคราม ต.กะทู้ จ.ภูเก็ต 83120',
};
const page=(addr)=>`<!doctype html><html><head><meta charset=utf8><style>
@font-face{font-family:K;font-weight:400;src:url(data:font/woff2;base64,${kThai4}) format('woff2'),url(data:font/woff2;base64,${kLat4}) format('woff2')}
@font-face{font-family:K;font-weight:700;src:url(data:font/woff2;base64,${kThai7}) format('woff2'),url(data:font/woff2;base64,${kLat7}) format('woff2')}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1250px;height:155px}
.wrap{width:1250px;height:155px;position:relative;background:#fff;font-family:K}
.row{position:absolute;left:24px;right:20px;top:10px;height:118px;display:flex;align-items:center}
.logo{height:112px;flex:0 0 auto}
.name{margin-left:16px}
.name .t{font-weight:700;font-size:29px;color:#1b1b1b;line-height:1.05;letter-spacing:.3px}
.name .a{font-weight:400;font-size:17px;color:#333;margin-top:3px}
.contact{margin-left:auto;display:flex;align-items:center;gap:10px}
.clines{text-align:right;font-weight:400;font-size:15px;color:#333;line-height:1.55}
.icons{height:70px}
.line{position:absolute;left:0;right:0;bottom:8px;height:3px;background:#155D90}
</style></head><body><div class="wrap">
<div class="row">
<img class="logo" src="data:image/png;base64,${logo}">
<div class="name"><div class="t">อีคิวแคมป์ (EQ CAMP)</div><div class="a">${addr}</div></div>
<div class="contact"><div class="clines">065 4919415 / 099 2394747<br>www.eqgroup.co.th<br>info.eqgroup@gmail.com</div>
<img class="icons" src="data:image/png;base64,${icons}"></div>
</div><div class="line"></div></div></body></html>`;
(async()=>{
  const b=await chromium.launch(); const out={};
  for(const r of ['central','isan','north','south']){
    const pg=await b.newPage({viewport:{width:1250,height:155},deviceScaleFactor:2});
    await pg.setContent(page(ADDR[r]),{waitUntil:'load'}); await pg.evaluate(()=>document.fonts.ready); await pg.waitForTimeout(300);
    const buf=await pg.screenshot({clip:{x:0,y:0,width:1250,height:155}});
    out[r]=buf.toString('base64'); await pg.close();
    
  }
  await b.close();
  const body=Object.entries(out).map(([k,v])=>`  ${k}: { w: 2500, h: 310, b64: "${v}" },`).join('\n');
  const ts=`// AUTO-GENERATED — หัวกระดาษฉบับเต็มตามภาค (โลโก้+ไอคอน EQ CAMP + ชื่อบริษัท/ที่อยู่/ติดต่อ ฟอนต์ Kanit) เส้นคั่นน้ำเงินเต็มความกว้าง (ไม่ขาด)
// ที่อยู่: กลาง = 523 ม.4 แขวงบางปะกอก เขตราษฎร์บูรณะ กรุงเทพมหานคร 10140 (จากเอกสารจริงที่ทีมส่ง)
//        อีสาน(สนญ.) = 289/69 ไพรเวท พาร์ค วิลล์ ม.4 ต.หนองบัว อ.เมือง จ.อุดรธานี 41000
//        เหนือ = 62 ม.10 ต.ป่าไผ่ อ.สันทราย จ.เชียงใหม่ 50210
//        ใต้ = 118/73 ตึก C ม.1 ถ.วิชิตสงคราม ต.กะทู้ จ.ภูเก็ต 83120 (จากภาพหัวกระดาษภาคใต้ของทีมใน Drive)
import type { Region } from './letterheads-data';
export const FULL_HEADERS: Record<Region, { b64: string; w: number; h: number }> = {
${body}
};
`;
  fs.writeFileSync(path.join(__dirname,'..','src','letterhead-full-data.ts'),ts);
  console.log('written, sizes:', Object.fromEntries(Object.entries(out).map(([k,v])=>[k,v.length])));
})().catch(e=>{console.error('FATAL',e.message);process.exit(1)});
