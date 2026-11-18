// สร้างหัวกระดาษรายภาค → src/letterhead-full-data.ts  (รัน: node scripts/gen-letterheads.cjs)
// ต้องมี @fontsource/kanit (npm i --no-save @fontsource/kanit) + playwright
const { chromium } = require('playwright'); const fs=require('fs'); const path=require('path');
const A=(f)=>path.join(__dirname,'letterhead-assets',f);
const KF=(f)=>require.resolve('@fontsource/kanit/files/'+f);
const d=(p)=>fs.readFileSync(p).toString('base64');
// ฟอนต์เดียวกับเนื้อเอกสาร (TH Sarabun New จาก src/font-data.ts) — ทั้งไทย/อังกฤษ/ตัวเลข ไม่มีฟอนต์สำรองแปลก ๆ
const FD=fs.readFileSync(path.join(__dirname,'..','src','font-data.ts'),'utf8');
const fb=(n)=>{ const i=FD.indexOf('export const '+n); const a=FD.indexOf('"',i)+1; return FD.slice(a, FD.indexOf('"',a)); };
const sReg=fb('FONT_REG_B64'), sBold=fb('FONT_BOLD_B64');
// โลโก้/ไอคอนความละเอียดสูง (ครอปจากไฟล์หัวกระดาษทีม BRD-002 ใน Drive 04_ภาพและแบรนด์) — คมชัดเมื่อพิมพ์
const logo=d(A('logo_full.png')); const icP=d(A('ic_phone.png')), icW=d(A('ic_web.png')), icM=d(A('ic_mail.png'));
const ADDR={
  central:'523 ม.4 แขวงบางปะกอก เขตราษฎร์บูรณะ กรุงเทพมหานคร 10140',
  isan:'289/69 ไพรเวท พาร์ค วิลล์ ม.4 ต.หนองบัว อ.เมือง จ.อุดรธานี 41000',
  north:'62 ม.10 ต.ป่าไผ่ อ.สันทราย จ.เชียงใหม่ 50210',
  south:'118/73 ตึก C ม.1 ถ.วิชิตสงคราม ต.กะทู้ จ.ภูเก็ต 83120',
};
// 1250 css px = ความกว้างพื้นที่เนื้อหา (≈470 pt) → 1 pt ≈ 2.66 px · เรนเดอร์ 2.4 เท่า = 3000 px (≈ 460 dpi เมื่อพิมพ์)
const SCALE=2.4, W=1250, H=150;
const page=(addr)=>`<!doctype html><html><head><meta charset=utf8><style>
@font-face{font-family:K;font-weight:400;src:url(data:font/ttf;base64,${sReg}) format('truetype')}
@font-face{font-family:K;font-weight:700;src:url(data:font/ttf;base64,${sBold}) format('truetype')}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;background:#fff}
.wrap{width:${W}px;height:${H}px;position:relative;font-family:K;color:#1D1D1F}
.row{position:absolute;left:6px;right:4px;top:6px;height:118px;display:flex;align-items:center}
.logo{height:108px;flex:0 0 auto}
.name{margin-left:20px;padding-left:20px;border-left:2px solid #D6DCE3;height:92px;display:flex;flex-direction:column;justify-content:center}
.name .t{font-weight:700;font-size:48px;color:#0C2A41;line-height:1.02;letter-spacing:.2px} /* 18 pt */
.name .a{font-weight:400;font-size:36px;color:#3A3A3C;margin-top:4px;white-space:nowrap;line-height:1.05} /* ≈13.5 pt */
.contact{margin-left:auto;display:grid;grid-template-columns:auto auto;column-gap:10px;row-gap:3px;align-items:center}
.contact img{height:27px;width:27px;object-fit:contain;justify-self:center}
.contact span{font-size:33px;line-height:1.02;color:#3A3A3C;white-space:nowrap} /* ≈12.5 pt */
.rule{position:absolute;left:0;right:0;bottom:14px;height:4px;background:#0C2A41}
.rule2{position:absolute;left:0;right:0;bottom:9px;height:1.5px;background:#5B9BD5}
</style></head><body><div class="wrap">
<div class="row">
<img class="logo" src="data:image/png;base64,${logo}">
<div class="name"><div class="t">อีคิวแคมป์ (EQ CAMP)</div><div class="a">${addr}</div></div>
<div class="contact">
<img src="data:image/png;base64,${icP}"><span>065 4919415 / 099 2394747</span>
<img src="data:image/png;base64,${icW}"><span>www.eqgroup.co.th</span>
<img src="data:image/png;base64,${icM}"><span>info.eqgroup@gmail.com</span>
</div></div><div class="rule"></div><div class="rule2"></div></div></body></html>`;
(async()=>{
  const b=await chromium.launch(); const out={};
  for(const r of ['central','isan','north','south']){
    const pg=await b.newPage({viewport:{width:W,height:H},deviceScaleFactor:SCALE});
    await pg.setContent(page(ADDR[r]),{waitUntil:'load'}); await pg.evaluate(()=>document.fonts.ready); await pg.waitForTimeout(300);
    const buf=await pg.screenshot({clip:{x:0,y:0,width:W,height:H}});
    out[r]=buf.toString('base64'); await pg.close();
    
  }
  await b.close();
  const body=Object.entries(out).map(([k,v])=>`  ${k}: { w: ${W*SCALE}, h: ${H*SCALE}, b64: "${v}" },`).join('\n');
  const ts=`// AUTO-GENERATED — หัวกระดาษฉบับเต็มตามภาค (โลโก้+ไอคอน EQ CAMP + ชื่อบริษัท/ที่อยู่/ติดต่อ ฟอนต์ TH Sarabun New เดียวกับเนื้อเอกสาร) เส้นคั่นน้ำเงินเต็มความกว้าง (ไม่ขาด)
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
