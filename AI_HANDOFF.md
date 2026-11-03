# EQ Camp — คู่มือทำงานร่วมกันระหว่างเอเจนต์ AI (Claude + ChatGPT/Codex)

เอกสารนี้คือ "สัญญากลาง" ให้ AI ทุกตัวพัฒนาต่อแบบเชื่อมกันได้ โดยไม่ทับงานกัน
ส่งไฟล์ในโฟลเดอร์นี้ทั้งชุดให้ ChatGPT/Codex เป็น context ได้เลย

## 1) จุดกลางที่ต้อง "ขึ้นคลาวด์" — ใช้ Git repository (แนะนำ GitHub)
Git repo คือแหล่งความจริงเดียว (single source of truth) ที่ทั้ง Claude Code และ ChatGPT/Codex อ่าน-เขียนผ่าน commit/PR ได้

โครงไฟล์ที่ push ขึ้น repo:
```
eq-camp/
├─ src/
│  └─ eqcamp-core.ts     ← ตรรกะทั้งหมด (แกนกลาง ห้ามแตกเป็นหลายก๊อป)
├─ web/
│  ├─ App.tsx            ← UI (React)
│  ├─ entry.tsx  index.html  shim.js
├─ schema.json           ← สัญญาข้อมูล (ไฟล์ export JSON ต้องตรงนี้)
├─ samples/              ← ไฟล์ .docx + .json ตัวอย่าง (regression)
├─ AI_HANDOFF.md         ← ไฟล์นี้
└─ README.md             ← วิธี build/test
```
ทั้งคู่ทำงานแบบ: แตก branch → commit → เปิด PR → อีกฝ่าย (หรือคน) review → merge
> ข้อมูล "งานจริง" (ค่ายแต่ละงาน) ไม่ต้องอยู่ใน repo — ส่งผ่านไฟล์ `*.export.json` ตาม schema.json

## 2) สัญญาข้อมูล (data contract) — ทั้งสอง AI ต้องยึด `schema.json`
ไฟล์ที่ปุ่ม "ส่งออก JSON" สร้าง = รูปแบบแลกเปลี่ยนข้อมูลกลาง ตรวจผ่าน JSON Schema draft 2020-12 แล้ว
- อ่านไฟล์นี้ → ได้ข้อมูลค่าย 1 งานครบ (บรีฟ, ทุกฟิลด์, กิจกรรมที่เลือก, กิจกรรม/สถานที่ที่เพิ่มเอง, ภาพ base64)
- เขียนไฟล์นี้ → อีกเครื่องมือเปิดต่อได้ทันที
- กฎ: เพิ่มฟิลด์ได้ (backward-compatible) / ถ้าเปลี่ยนโครงต้องเพิ่ม `_v` และอัปเดต schema.json พร้อมกัน

## 3) ขอบเขต API ของแกนกลาง (`eqcamp-core.ts`) — ส่วนที่ห้ามเขียนทับกัน
ฟังก์ชัน/ข้อมูลสาธารณะที่ทุก UI/เอเจนต์เรียกใช้ร่วม:
| สิ่งที่ export | หน้าที่ |
|---|---|
| `parseBrief(text, base) → Camp` | แปลงบรีฟเป็นข้อมูลค่าย |
| `buildSchedule(camp) → Plan` | จัดกำหนดการ (เติมทุกช่อง) |
| `compose(camp, plan)` | ร้อยประโยควัตถุประสงค์/กิจกรรม/งบ |
| `check(camp, plan)` / `isReady()` | ตรวจความถูกต้องก่อนออกไฟล์ |
| `buildDoc(kind, camp) → docx Document` | สร้างเอกสาร 4 ชนิด (program/quotation/booking/runsheet) |
| `LIB`, `VENUES`, `SUBJECTS`, `DOC_TYPES`, `PRESETS` | คลังข้อมูลตั้งต้น |
| `blankCamp()`, `fromPreset(id)` | ตัวตั้งต้น |

**หลักแบ่งงาน:** แกน `eqcamp-core.ts` เป็นของกลาง แก้ที่เดียว; ChatGPT/Claude ต่างคนต่างต่อ "ชั้นบน" ได้ (UI อื่น, ตัวเชื่อม Google Sheets, ตัวนำเข้าไฟล์เก่า, API service) โดย import แกนกลางนี้ ไม่ก๊อปตรรกะไปเขียนใหม่

## 4) โครง "เหมือน/ต่าง" ที่ทั้งคู่ต้องเคารพ
ดู `วิเคราะห์โครงสร้างโปรแกรม_เหมือน-ต่าง.md` — โครงคงที่ (objectives 3-4, integration, AAR, โครงกำหนดการ/ราคา/งบ) ห้ามแก้ตามอำเภอใจ; ตัวแปรตามบรีฟคือสิ่งที่ปรับได้

## 5) วิธี build/test (ให้ทั้งคู่รันก่อน merge)
```bash
# สร้าง bundle เว็บ
npx esbuild web/entry.tsx --bundle --outfile=web/bundle.js --format=iife \
  --loader:.tsx=tsx --inject:./web/shim.js
# ทดสอบเอกสาร → PDF เพื่อดูหน้าจริง
node build-samples.js && soffice --headless --convert-to pdf samples/*.docx
# ตรวจ export ตาม schema
npx ajv validate -s schema.json -d "samples/*.export.json"
```

## 6) จุดต่อยอดที่เหมาะให้ ChatGPT/Codex ทำ (ไม่ชนกับงาน Claude)
- ตัวเชื่อม Google Sheets/Drive → แปลงเป็น `*.export.json` ตาม schema
- ตัวนำเข้าไฟล์ค่ายเก่า (Word/Excel) → เติมคลัง `LIB`/`VENUES`
- Backend API ที่ห่อ `buildDoc` ให้เรียกผ่าน HTTP
ทั้งหมดนี้ import `eqcamp-core.ts` ตัวเดียวกัน จึงพัฒนาคู่ขนานได้โดยข้อมูลไม่หลุดจากสัญญา
