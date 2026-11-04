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
npm install && npm run build && npm run samples && npm run validate && npm run stress
```
ตรวจ Word จริง: `soffice --headless --convert-to pdf samples/xxx.docx` แล้วดูหน้า
`npm run stress` = สร้าง .docx 4 ชนิด × 66 คอนฟิก (half/day/overnight × วิชา/14 หลักสูตร + เคสแย่สุด) → ต้องไม่ throw / เป็น zip / ทุกวันมีแถว; ไฟล์ออกที่ /tmp/stress (ตรวจ XML เพิ่ม: `xmllint --noout`)

## กฎเหล็ก (invariants — ห้ามพลาด)
1. โครงเอกสารคงที่ (objectives ข้อ 3-4, integration ข้อ 1-2 + 3 ท้าย, AAR ปิดท้าย, ลำดับหัวข้อ, โครงกำหนดการ/ราคา/งบ, ฟอนต์ TH SarabunPSK) — ห้ามแก้ตามใจ
2. ตัวแปรตามบรีฟ: รหัส/โรงเรียน/จำนวน/วิชา/durationMode/วันที่/สถานที่/ราคา/กิจกรรม
3. durationMode: `half` | `day` | `overnight` → overnight เท่านั้นที่ nights>0; half/day ห้ามมีเช็คอิน/อาหารเย็น/กิจกรรมกลางคืน/พักผ่อนฝันดี
4. กำหนดการต้องเติมกิจกรรมจริงทุกช่อง ห้ามเว้นว่าง; ยาวเกินคลัง → วนซ้ำติดป้าย "(ต่อยอด)"
5. เอกสารภายใน (runsheet) และต้นทุน/กำไร **ห้ามหลุดไปฉบับลูกค้า**; หนังสือโรงแรมห้ามโชว์ราคาขาย/ต้นทุน
6. ห้าม `Number(null)` coercion; ค่าที่อ่านไม่ได้ต้องเป็น "missing" + เตือน ไม่เดา
7. ภาพ: ใช้ภาพที่มีสิทธิ์ (ของทีม/สื่อทางการโรงแรม) — ห้าม auto-ฝังภาพลิขสิทธิ์จากเว็บ

## รอบล่าสุด (หัวกระดาษ/กำหนดการตรงหลักสูตร/จัดหน้า)
- **หัวกระดาษรายภาค = ภาพเต็มแผ่น** `src/letterhead-full-data.ts` (FULL_HEADERS[region]) — north = 62 ม.10 ต.ป่าไผ่ อ.สันทราย จ.เชียงใหม่ 50210; central/isan/south ใช้ที่อยู่ สนญ. อุดรธานี (ยังไม่มีที่อยู่สาขากลาง/ใต้ — ห้ามเดา). `letterheadFor(c)` ใช้ทั้ง Word และ PDF
- **กำหนดการยึดหลักสูตรที่เลือกเสมอ**: กิจกรรมกลางคืน/นันทนาการเลือกจากกิจกรรมของหลักสูตรนั้นก่อน (เช่น ดาราศาสตร์ → ส่องกล้องดูดาว) ตัด opening/closing ออกจากการจับคีย์เวิร์ด; Day 1 ปรับตามเวลาถึง (ไม่มีช่วงว่าง); ไม่มีแหล่งทัศนศึกษา → เติมกิจกรรมหลักแทน
- `isSteamProgram(c)` — ถ้อยคำ/คอลลาจ STEAM เฉพาะ PL STM 0101 (หรือ subject steam ไม่ผูกหลักสูตร) เท่านั้น
- **ตัวหนาเฉพาะหัวข้อหลัก** — เนื้อหา/เวลา/รายการกำหนดการ/รายการราคาไม่หนา
- **จัดหน้า**: ใช้ pageBreakBefore (ไม่มี PageBreak paragraph → ไม่มีหน้าว่าง), หัวตารางกำหนดการเป็นแถว banner + keepNext, กริดภาพ keep รักษาสัดส่วน (กล่อง 290×178)
- ภาพจริงมี 11/14 หลักสูตร (ขาด GEO 0112, FOR 0110, PRE 0105)

## ทำงานร่วมกับ ChatGPT/Codex
branch → commit → PR เข้า main; ก่อนเริ่ม `git pull`. แก้ `src/eqcamp-core.ts` หรือ `schema.json` ต้องระบุชัดใน PR (ดู AI_HANDOFF.md)

## สถานะปัจจุบัน (อัปเดตเมื่อเปลี่ยน)
- ลิงก์เว็บทดสอบ (artifact): มี AI extraction (capability sample) + ดาวน์โหลด .docx (capability downloads)
- **หัวกระดาษ (ใหม่ — ข้อความครบ)**: `brandHeader()` ประกอบจากโลโก้ + ชื่อบริษัท + ที่อยู่เต็ม + ติดต่อ จาก `src/brand-data.ts` (BRAND: อีคิวแคมป์ EQ CAMP / 289/69 ไพรเวท พาร์ค วิลล์ ม.4 ต.หนองบัว อ.เมือง จ.อุดรธานี 41000 / โทร 065 4919415,099 2394747 / www.eqgroup.co.th / info.eqgroup@gmail.com) + เส้นคั่นน้ำเงิน — เลิกใช้ภาพ crop ที่ไม่ครบ. ท้ายกระดาษยังใช้แถบ "Explore for Learning" (letterheads-data footer)
- **ชื่อหลักสูตรไทย/อังกฤษ**: compose แยกชื่อในคลัง "ไทย (English)" → ไทยบรรทัดบน + "( English )" บรรทัดล่าง (k.nameTh ไม่มีคำว่า "หลักสูตร" ใช้ในหน้ากำหนดการ)
- **หน้ากำหนดการครบ 5 อย่าง**: กำหนดการ / ชื่อหลักสูตร(ไทย+อังกฤษ) / โรงเรียน / วันที่(ถ้ามี) / สถานที่(ถ้ามี) — ฟิลด์ที่ว่างไม่ขึ้น
- **ปุ่ม "บันทึก PDF"** (printPDF): สร้างไฟล์ PDF จริงในเบราว์เซอร์ด้วย html2canvas+jsPDF (CDN ใน web/index.html) → เซฟผ่าน downloads capability เดียวกับ Word (ทำงานในกล่อง sandbox ได้ — เลิกใช้ iframe.print() ที่ถูกบล็อก). เรนเดอร์หน้า 1 (ปก) + หน้ากำหนดการแยก section, หัวกระดาษ/เลย์เอาต์ตรงกับ Word. ยืนยัน: PDF 3 หน้า A4 เปิดได้
- **ดาวน์โหลดได้เสมอ**: ปุ่มไม่ถูก disable เมื่อข้อมูลไม่ครบ (โหลดฉบับร่างได้) + anchorDownload มี fallback window.open กรณีโฮสต์บล็อก
- **สูตรทีมงาน (ตายตัว)**: staffText() — 25-50→4-5 · 50-120→6-8 · 120-180→8-12 · 180-300→10-16
- **หน้า "ฐานข้อมูลค่าย"** (แท็บใน UI): เลือก CUR → เห็นเฉพาะข้อมูลที่ผูกกับค่ายนั้น (วัตถุประสงค์/กิจกรรมแยก kind/ภาพ thumbnail) + ปุ่ม "ใช้หลักสูตรนี้". core helper = `courseDataset(code)`
- **กรองตามหลักสูตร**: ผูก courseCode แล้ว แท็บกิจกรรม/เมนูรายช่วง/select-all/ภาพ ดึงเฉพาะของ CUR นั้น (subjectPool course-only อยู่แล้ว); header มีแบนเนอร์ "ผูกหลักสูตร"; เอกสารตัดช่องภาพ placeholder เหลือ 2 (จาก 4)
- **เลือกกิจกรรมรายช่วง (per-slot)**: `camp.coreSlotIds[]` (ดัชนี = ช่องกิจกรรมหลักในกำหนดการ, ค่า = id กิจกรรม, ''=อัตโนมัติ) — UI แท็บ 4 มี dropdown ต่อช่อง; buildSchedule ใช้ pick ก่อน ไม่งั้นเติมอัตโนมัติ; Row.slot ติดดัชนีให้ UI
- **ภาพกิจกรรมจริง**: `src/course-photos-data.ts` (COURSE_PHOTOS) ย่อ/บีบอัดจาก Drive โฟลเดอร์รวม 04b — ปัจจุบันมีเฉพาะ PL STM 0101 (STEAM), PL ENG 0104 (อังกฤษ). coursePhotos(code)/hasCoursePhotos(code) ใน core; เลือกหลักสูตร→ฝัง actImgs อัตโนมัติ; ปุ่ม "ดึงภาพจริงของหลักสูตร" ในแท็บ 6. **สิทธิ์เผยแพร่: รอทีมรับรอง** → check() มี soft warning
- buildSchedule กัน of(k)[0] undefined ด้วย pick1()+FALLBACK (opening/night/recreation/closing) — หลักสูตรที่ไม่มี night ไม่พังอีก
- **กันไฟล์ .docx เสีย (XML valid เสมอ)**: `xmlSafe()` ล้างอักขระควบคุม (NUL/0x00–0x1F) ออกจากทุกข้อความใน R() — กัน Word เปิดไม่ได้/ต้อง repair; `money()` กัน NaN; buildSchedule กัน startTime/travelHours NaN (ไม่ให้เวลาเป็น "NaN.NaN"). ยืนยันด้วย stress 264 ไฟล์ + xmllint 792 ไฟล์ ผ่านหมด
- **ปุ่ม "ครบชุด 4 ไฟล์"** (downloadAll): สร้างทั้ง 4 เอกสารด้วยข้อมูลชุดเดียวในคลิกเดียว
- **รหัสหลักสูตรจริง (ทะเบียน EQ Camp)**: `code` = PL STM 0101/LEA 0102/SEA 0103/ENG 0104/PRE 0105/ENV 0106/MAT 0107/AST 0108/CHI 0109/FOR 0110/COD 0111/GEO 0112/ITD 0113/TI 0116 (แทน CUR-xxx เดิม — ห้ามเดา/มั่ว ตามชีตจริง). docCode อ้างจากรหัสนี้อัตโนมัติ `docCodeFor(code)` = "<code>/2569"
- **Day Camp (ไป-กลับ จัดที่โรงเรียน)**: แพทเทิร์นตายตัว 08.30–16.00 (ลงทะเบียน→เปิด→พื้นฐาน STEM 5STEPs+EDP→ว่าง→STEAM Mission EP.1→กลางวัน→EP.2→ว่าง→สรุป+AAR) ไม่มีเดินทาง/พักค้าง — ดู branch `durationMode==='day'` ใน buildSchedule
- **หน้าแรกเอกสารโปรแกรม**: พอดีหน้าเดียว — กิจกรรมเชิงบูรณาการ ยึด "กิจกรรมของหลักสูตรที่เลือก" เป็นหลัก (เรียง core/night ก่อน) จับคู่ 2/บรรทัด สูงสุด 8 กิจกรรม → ~4 บรรทัด + AAR (คล้ายต้นฉบับ ไม่ตัดจนหมด); บูรณาการการเรียน 5–7 ข้อ
- **ภาพเซ็ต STEAM หน้าสุดท้าย**: `src/steam-gallery-data.ts` (STEAM_GALLERY) — ค่าย subject='steam' วางคอลลาจหน้าสุดท้ายเสมอ
- **ภาพประกอบในทุกไฟล์**: helper `photoSection(c,{venue?})` ต่อท้ายทั้ง 4 เอกสาร (program/quotation/booking/runsheet) + ใน PDF — ใช้ actImgs ถ้ามี ไม่งั้น coursePhotos(courseCode) + STEAM gallery ถ้าเป็น steam
- **จัดวางมืออาชีพ (ส่งราชการ)**: line spacing 300 (กระชับ ไม่ยืด), หัวข้อ H() before6/after2, กิจกรรมเชิงบูรณาการใช้ `numberedBold()` (ตัวเข้มสีน้ำเงินเข้ม ให้เด่น), ฟอนต์ TH SarabunPSK ทั้งเอกสาร
- คลังกิจกรรม: **seed จาก Google Drive MASTER จริงแล้ว** — `src/eqcamp-data.ts` = 14 หลักสูตร (รหัส PL จริง) + 267 กิจกรรม (รหัส ref-) ทุกรายการสถานะ "รอตรวจ" (draft) ติดธงเตือนในเว็บ
- เลือกได้ 2 ทาง: (ก) หลักสูตรจริง (courseCode = PL xxx จริง) ดึงกิจกรรมเฉพาะธีม + วัตถุประสงค์จริง 2 ข้อ (ข) วิชา (subject) ใช้ชุดมาตรฐานเดิม
- subject families: math/steam/english/ai/chinese/leadership
- parseBrief + AI extraction ตรวจจับ courseCode จากธีมบรีฟอัตโนมัติ (detectCourse / COURSE_KEYS)
- แหล่งข้อมูลกลาง: Drive โฟลเดอร์ 17d75FUovLeWHvKNfvijYad3496ok0Y6M + MASTER sheet 1kwqjXHOLremaVI-j61J296G7K6o6-ZMLkCtaWHHNi00

## ช่องว่างที่ยังรู้อยู่ (known gaps)
- กิจกรรม 267 รายการ "รอตรวจ" ทั้งหมด — หลายรายการมีแค่ชื่อ ยังไม่มีขั้นตอน/อุปกรณ์/เวลา/ระดับชั้น (ห้ามเดา ต้องให้ทีมเติมใน MASTER tab 02 แล้ว re-seed)
- ยังไม่ดึงราคา/ต้นทุน/โรงแรมจริงจาก Drive (ยังไม่พบตารางราคาในชุดนี้) — VENUES ยัง hard-code 6 แห่ง
- ภาพ 32 ไฟล์รวมในโฟลเดอร์ 04b (id 1kG8FbCQJzgMOk6VNuBWNI2DEak2lSGfd) — บีบอัด 6 รูปเข้า bundle แล้ว (CUR-013/014) **แต่ยังรอทีมรับรองสิทธิ์เผยแพร่**; หลักสูตรอื่นยังไม่มีภาพในชุดนี้
- re-gen ภาพ: ดึง copy/src จาก images.json → บีบอัด (PIL, maxW 760, q70) → เขียน src/course-photos-data.ts (ดู scratchpad/gen_photos.py)
- เวลาเริ่ม/เดินทางจากบรีฟยังไม่ parse ครบ (ครึ่งวัน session window เป็นค่าประมาณ)
- ยังไม่มีหน้า review "ยืนยันก่อนออกไฟล์" เต็มรูปแบบ (เป็นแถบสรุป applied/missing + soft warning)
- 03_งานค่ายจริง_EXPORT_JSON ใน Drive ใช้ schema "รุ่น4" (ของทีม) ยังไม่ reconcile กับ schema.json (_v2 ของ repo)
- re-seed: ดึง MASTER ใหม่ → รัน generator สร้าง src/eqcamp-data.ts (ดู หมายเหตุใน eqcamp-data.ts)
