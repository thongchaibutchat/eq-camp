# CLAUDE.md — โปรเจกต์เมมโมรี EQ Camp

ไฟล์นี้ถูกโหลดอัตโนมัติทุกครั้งที่ Claude ทำงานบน repo นี้ อ่านก่อนเริ่มเสมอ

## โปรเจกต์นี้คือ
ระบบสร้างเอกสารกระบวนการขายค่ายวิชาการเป็นไฟล์ Word (.docx) จากบรีฟ ภายใน ~30 นาที
4 เอกสาร: โปรแกรมค่าย (PL) · ใบเสนอราคา · หนังสือขอราคาโรงแรม · Run-down ภายใน

## สถาปัตยกรรม (แก้ที่เดียว)
- `src/eqcamp-core.ts` = แกนกลางทั้งหมด (parser, schedule engine, compose, validation, docx builders, คลังข้อมูล). **ทุกส่วนต่อยอดต้อง import ตัวนี้ ห้ามก๊อปตรรกะ**
- `web/App.tsx` = UI React (adapter: เรียก core + sample/downloads capability)
- `schema.json` = สัญญาข้อมูลกลาง (JSON Schema 2020-12) ของไฟล์ `*.export.json` — เปลี่ยนโครงต้องเพิ่ม `_v` + migration พร้อมกัน
- `scripts/` = build-samples.ts (สร้าง .docx), validate.mjs (ตรวจ schema)

## คำสั่ง (ต้องผ่านก่อน commit)
```bash
npm install && npm run build && npm run samples && npm run validate
```
ตรวจ Word จริง: `soffice --headless --convert-to pdf samples/xxx.docx` แล้วดูหน้า

## กฎเหล็ก (invariants — ห้ามพลาด)
1. โครงเอกสารคงที่ (objectives ข้อ 3-4, integration ข้อ 1-2 + 3 ท้าย, AAR ปิดท้าย, ลำดับหัวข้อ, โครงกำหนดการ/ราคา/งบ, ฟอนต์ TH SarabunPSK) — ห้ามแก้ตามใจ
2. ตัวแปรตามบรีฟ: รหัส/โรงเรียน/จำนวน/วิชา/durationMode/วันที่/สถานที่/ราคา/กิจกรรม
3. durationMode: `half` | `day` | `overnight` → overnight เท่านั้นที่ nights>0; half/day ห้ามมีเช็คอิน/อาหารเย็น/กิจกรรมกลางคืน/พักผ่อนฝันดี
4. กำหนดการต้องเติมกิจกรรมจริงทุกช่อง ห้ามเว้นว่าง; ยาวเกินคลัง → วนซ้ำติดป้าย "(ต่อยอด)"
5. เอกสารภายใน (runsheet) และต้นทุน/กำไร **ห้ามหลุดไปฉบับลูกค้า**; หนังสือโรงแรมห้ามโชว์ราคาขาย/ต้นทุน
6. ห้าม `Number(null)` coercion; ค่าที่อ่านไม่ได้ต้องเป็น "missing" + เตือน ไม่เดา
7. ภาพ: ใช้ภาพที่มีสิทธิ์ (ของทีม/สื่อทางการโรงแรม) — ห้าม auto-ฝังภาพลิขสิทธิ์จากเว็บ

## ทำงานร่วมกับ ChatGPT/Codex
branch → commit → PR เข้า main; ก่อนเริ่ม `git pull`. แก้ `src/eqcamp-core.ts` หรือ `schema.json` ต้องระบุชัดใน PR (ดู AI_HANDOFF.md)

## สถานะปัจจุบัน (อัปเดตเมื่อเปลี่ยน)
- ลิงก์เว็บทดสอบ (artifact): มี AI extraction (capability sample) + ดาวน์โหลด .docx (capability downloads)
- คลังกิจกรรม: **seed จาก Google Drive MASTER จริงแล้ว** — `src/eqcamp-data.ts` = 14 หลักสูตร (CUR-001..014) + 267 กิจกรรม (รหัส ref-) ทุกรายการสถานะ "รอตรวจ" (draft) ติดธงเตือนในเว็บ
- เลือกได้ 2 ทาง: (ก) หลักสูตรจริง (courseCode = CUR-xxx) ดึงกิจกรรมเฉพาะธีม + วัตถุประสงค์จริง 2 ข้อ (ข) วิชา (subject) ใช้ชุดมาตรฐานเดิม (คณิต/STEAM จาก PL0109/0110; อังกฤษ/AI มาตรฐาน)
- subject families: math/steam/english/ai/chinese/leadership
- parseBrief + AI extraction ตรวจจับ courseCode จากธีมบรีฟอัตโนมัติ (detectCourse / COURSE_KEYS)
- แหล่งข้อมูลกลาง: Drive โฟลเดอร์ 17d75FUovLeWHvKNfvijYad3496ok0Y6M + MASTER sheet 1kwqjXHOLremaVI-j61J296G7K6o6-ZMLkCtaWHHNi00

## ช่องว่างที่ยังรู้อยู่ (known gaps)
- กิจกรรม 267 รายการ "รอตรวจ" ทั้งหมด — หลายรายการมีแค่ชื่อ ยังไม่มีขั้นตอน/อุปกรณ์/เวลา/ระดับชั้น (ห้ามเดา ต้องให้ทีมเติมใน MASTER tab 02 แล้ว re-seed)
- ยังไม่ดึงราคา/ต้นทุน/โรงแรมจริงจาก Drive (ยังไม่พบตารางราคาในชุดนี้) — VENUES ยัง hard-code 6 แห่ง
- ภาพ 32 ไฟล์ใน Drive ยังไม่รับรองสิทธิ์เผยแพร่ ยังไม่ได้ฝัง
- เวลาเริ่ม/เดินทางจากบรีฟยังไม่ parse ครบ (ครึ่งวัน session window เป็นค่าประมาณ)
- ยังไม่มีหน้า review "ยืนยันก่อนออกไฟล์" เต็มรูปแบบ (เป็นแถบสรุป applied/missing + soft warning)
- 03_งานค่ายจริง_EXPORT_JSON ใน Drive ใช้ schema "รุ่น4" (ของทีม) ยังไม่ reconcile กับ schema.json (_v2 ของ repo)
- re-seed: ดึง MASTER ใหม่ → รัน generator สร้าง src/eqcamp-data.ts (ดู หมายเหตุใน eqcamp-data.ts)
