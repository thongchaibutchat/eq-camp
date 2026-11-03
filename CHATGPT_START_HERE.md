# เริ่มที่นี่ (สำหรับ ChatGPT / Codex)

คุณคือเอเจนต์พัฒนา (Codex) ที่จะพัฒนาโปรเจกต์นี้ต่อ **ร่วมกับ Claude** โดยไม่ทำงานทับซ้อนกัน
อ่านไฟล์นี้ + `AI_HANDOFF.md` + `README.md` ให้จบก่อนเริ่มงานใด ๆ

## โปรเจกต์นี้คืออะไร
เว็บ (เปิดไฟล์เดียว `EQ_Camp_Generator.html` ได้เลย ไม่ต้องมีเซิร์ฟเวอร์) รับ "บรีฟภาษาไทย" ของค่ายวิชาการ
แล้วสร้างเอกสารขายเป็นไฟล์ **Word (.docx)** 4 ชนิดจากข้อมูลชุดเดียวกัน:
1. โปรแกรมค่าย (PL xxxx/2569)
2. ใบเสนอราคา
3. หนังสือขอราคา/จองโรงแรม (ไม่โชว์ราคาขาย/ต้นทุน)
4. Run-down ทีมงาน + ต้นทุน (ภายใน)

เป้าหมาย: ทีมขายทำเอกสารเสร็จพร้อมเสนอใน ~30 นาที

## รันได้ทันที
```bash
npm install
npm run build      # → สร้าง EQ_Camp_Generator.html (เปิดในเบราว์เซอร์ได้เลย)
npm run samples    # → สร้างไฟล์ .docx ตัวอย่างใหม่ลง samples/
npm run validate   # → ตรวจ samples/*.export.json ตาม schema.json
```

## โครงสร้าง
| ไฟล์/โฟลเดอร์ | หน้าที่ |
|---|---|
| `src/eqcamp-core.ts` | **แกนกลาง** — parser บรีฟ, เครื่องจัดกำหนดการ, ตัวร้อยประโยค, ตัวตรวจ, ตัวสร้าง 4 เอกสาร (docx) + คลังข้อมูล |
| `web/` | UI React (App.tsx, entry.tsx, index.html, shim.js) |
| `schema.json` | สัญญาข้อมูลกลาง (JSON Schema 2020-12) สำหรับไฟล์ export JSON |
| `scripts/` | build-samples.ts (สร้าง .docx), validate.mjs (ตรวจ schema) |
| `samples/` | .docx ตัวอย่าง + sample.export.json |
| `docs/` | วิเคราะห์ "เหมือน/ต่าง" ของแต่ละโปรแกรม |

## กฎทำงานร่วมกัน (ห้ามพลาด)
1. `src/eqcamp-core.ts` เป็นแกนกลาง **แก้ที่เดียว** — ส่วนต่อยอดให้ `import` ตัวนี้ ห้ามก๊อปตรรกะไปเขียนใหม่
2. ข้อมูลงานจริงแลกกันผ่านไฟล์ `*.export.json` ตาม `schema.json` เท่านั้น ไม่ hard-code
3. เปลี่ยนโครงข้อมูล → เพิ่มเลข `_v` และอัปเดต `schema.json` ในคอมมิตเดียวกัน
4. Workflow: `git pull origin main` ก่อนเริ่มเสมอ → แตก branch `feature/chatgpt-*` → commit → เปิด PR เข้า `main` → รีวิวก่อน merge
5. แก้ไฟล์ร่วม (`src/eqcamp-core.ts` หรือ `schema.json`) ต้องระบุชัดใน PR

## โครง "เหมือน/ต่าง" ที่ต้องเคารพ (รายละเอียดใน `docs/`)
- **เหมือนทุกโปรแกรม (คงที่):** รูปแบบรหัส PL, หัว 3 หัวข้อ, วัตถุประสงค์ข้อ 3-4, integration ข้อ 1-2 และ 3 ข้อท้าย, AAR ปิดท้าย, โครงกำหนดการ/ราคา/งบ/ภาพ, ฟอนต์ TH SarabunPSK, A4
- **แก้ตามบรีฟ (ตัวแปร):** รหัส/โรงเรียน/จำนวนคน, วิชา (math/steam/english/ai), วัน-คืน, วันที่/เวลา, สถานที่/จังหวัด/ทัศนศึกษา, ราคา, กิจกรรมที่เลือก, ภาพ
- **กฎกำหนดการ:** เติมกิจกรรมจริงทุกช่องเวลา ห้ามเว้นว่าง; ค่ายยาวเกินคลัง → วนใช้ซ้ำติดป้าย "(ต่อยอด)"

## ข้อควรระวังเทคนิค
- docx-js: ตารางต้องมี `columnWidths` (table) + `width` DXA (ทุก cell); ใช้ `ShadingType.CLEAR`; `PageBreak` ใน `Paragraph`; ตั้งฟอนต์ไทยทุก run (`font` + `size` + `sizeComplexScript`)
- เว็บ: ดาวน์โหลด .docx ผ่าน `Packer.toBlob` (fallback `toBase64String`) + shim `window.Buffer` จาก package `buffer`
- ภาพ: ระบบสร้างคำค้นตามบรีฟ แต่ให้ผู้ใช้เลือกภาพที่มีสิทธิ์ใช้เอง (ห้าม auto-ฝังภาพลิขสิทธิ์จากเว็บลงเอกสารขาย)

## งานที่เหมาะให้ Codex ทำก่อน (ไม่ชนกับ Claude)
- **A)** ตัวนำเข้า Google Sheets/Drive → แปลงเป็น `*.export.json` ตาม `schema.json`
- **B)** ตัวนำเข้าไฟล์ค่ายเก่า (Word/Excel) → เติมคลัง `LIB`/`VENUES`
- **C)** Backend API ห่อ `buildDoc` ให้เรียกผ่าน HTTP

ทั้งหมด `import` `src/eqcamp-core.ts` ตัวเดียวกัน → พัฒนาคู่ขนานกับ Claude ได้
เริ่มจากเปิด PR เล็ก ๆ หนึ่งอัน (เช่นงาน A) เพื่อตั้งรูปแบบการทำงานร่วมกันก่อน

## public API ของแกนกลาง (`src/eqcamp-core.ts`)
```ts
parseBrief(text, baseCamp) → Camp          // แปลงบรีฟเป็นข้อมูลค่าย
buildSchedule(camp) → Plan                 // จัดกำหนดการ (เติมทุกช่อง)
compose(camp, plan)                        // ร้อยประโยค objectives/activities/budget
check(camp, plan) / isReady(checks)        // ตรวจก่อนออกไฟล์
buildDoc(kind, camp) → docx Document       // kind: 'program'|'quotation'|'booking'|'runsheet'
blankCamp() / fromPreset(id) / defaultActs(subject)
LIB, VENUES, SUBJECTS, DOC_TYPES, PRESETS  // คลังข้อมูลตั้งต้น
```
