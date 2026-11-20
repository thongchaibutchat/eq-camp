"""รวมชุดข้อมูลเป็นไฟล์ .xlsx เดียว (หลายชีต) สำหรับประชุม/นำเข้า Claude Sheets"""
import csv, json, os, sys
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter
O = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'activity-catalog', 'out')
WEB = 'https://thongchaibutchat.github.io/eq-camp/'
cat = json.load(open(os.path.join(O, 'eqcamp-catalog.json')))
rd = lambda f: list(csv.reader(open(os.path.join(O, f), encoding='utf-8-sig')))
wb = Workbook(); HDR = PatternFill('solid', fgColor='E8EEF4'); BOLD = Font(bold=True)

def sheet(name, rows, widths, wrap=(), link=None, first=False):
    ws = wb.active if first else wb.create_sheet(name)
    ws.title = name
    for r in rows: ws.append([(None if v == '' else (int(v) if isinstance(v, str) and v.isdigit() and len(v) < 9 else v)) for v in r])
    for c in ws[1]: c.fill = HDR; c.font = BOLD
    ws.freeze_panes = 'A2'
    for i, w in enumerate(widths, 1): ws.column_dimensions[get_column_letter(i)].width = w
    for col in wrap:
        for c in ws[col][1:]: c.alignment = Alignment(wrap_text=True, vertical='top')
    if link:
        col, fn = link
        for c in ws[col][1:]:
            if c.value: c.hyperlink = fn(c.value); c.font = Font(color='155D90', underline='single')
    return ws

# 1 สรุป
lv = {}
for r in cat['rows']: lv[r['level']] = lv.get(r['level'], 0) + 1
acts = cat['activities']; ph = cat['photos']
summary = [['หัวข้อ', 'จำนวน', 'หมายเหตุ'],
    ['โปรแกรมจริง (ไฟล์ใน Drive)', 46, 'ตรงกับไฟล์ใน Drive ครบทุกไฟล์ · 1 ไฟล์ยังไม่อยู่ในเว็บ (English & Chinese Day Camp 2 วัน)'],
    ['แถวที่แกะได้ทั้งหมด', len(cat['rows']), 'ทุกบรรทัดของหน้าปก + กำหนดการ + รายการย่อย (ชีต ทุกแถว)'],
    ['  กิจกรรมหลัก (แถว)', lv.get('หลัก', 0), 'กิจกรรมเรียนรู้/ฐาน/เวิร์กชอป · ภาคสนาม · ภาคค่ำเรียนรู้'],
    ['  กิจกรรมรอง (แถว)', lv.get('รอง', 0), 'สันทนาการ · พิธีเปิด/ปิด · สรุป/AAR · ปาร์ตี้'],
    ['  รายการย่อย (แถว)', lv.get('ย่อย', 0), 'กิจกรรมย่อยที่มีชื่อ · หัวข้อเนื้อหา · ทักษะในวงเล็บ'],
    ['  โลจิสติกส์ (แถว)', lv.get('โลจิสติกส์', 0), 'อาหาร · เดินทาง · เช็คอิน · พักผ่อน (ไม่ใช่กิจกรรม เก็บไว้ให้ครบ)'],
    ['  ต้นฉบับไม่มีชื่อ', lv.get('ไม่มีชื่อ', 0), 'ดูชีต ประเด็นให้ทีมยืนยัน'],
    ['กิจกรรมไม่ซ้ำ (ชีต กิจกรรมรวม)', len(acts), f"หลัก {sum(a['level']=='หลัก' for a in acts)} · รอง {sum(a['level']=='รอง' for a in acts)} · ย่อยที่มีชื่อ {sum(a['level']=='ย่อย' for a in acts)}"],
    ['  อยู่ในกำหนดการจริง', sum(a['in_real'] == 'อยู่ในกำหนดการ' for a in acts), ''],
    ['  อยู่เฉพาะหน้าปก (ไม่มีในกำหนดการ)', sum(a['in_real'] == 'เฉพาะหน้าปก' for a in acts), 'ข้อบนหน้าปกของไฟล์ต้นฉบับที่ไม่ตรงกำหนดการ'],
    ['  ไม่เคยลงโปรแกรมจริง', sum(a['in_real'] == 'ไม่พบในโปรแกรมจริง' for a in acts), 'มีในรายชื่อทีม/คลัง MASTER แต่ไม่อยู่ในไฟล์โปรแกรมใด'],
    ['ภาพทั้งหมด', len(ph), f"กิจกรรม {sum(p['kind']=='กิจกรรม' for p in ph)} · ที่พัก {sum(p['kind']=='ที่พัก' for p in ph)}"],
    ['  ใช้ได้', sum(p['use'] == 'ใช้ได้' for p in ph), ''],
    ['  ตรวจสิทธิ์ก่อนใช้', sum(p['use'] == 'ตรวจสิทธิ์ก่อน' for p in ph), 'ลักษณะภาพสต็อก/โปรโมต/สถานที่ ไม่ใช่ภาพที่ทีมถ่าย'],
    ['  ห้ามใช้', sum(p['use'] == 'ห้ามใช้' for p in ph), 'มีลายน้ำเว็บอื่น'],
    ['ที่พัก', len(cat['venues']), f"มีภาพ {sum(v['photos']>0 for v in cat['venues'])} แห่ง"],
    ['สถานที่ทัศนศึกษา', len(cat['fieldSites']), ''],
    ['ประเด็นให้ทีมยืนยัน', len(rd('08_issues_for_team.csv')) - 1, 'เรียงตามความสำคัญ'],
    ['', '', ''],
    ['แหล่งข้อมูล', '', 'Drive 1C5XXMbaIZa5lhSCxhbGszSCITXn_qQU8 (โปรแกรม + รายชื่อกิจกรรม) · MASTER 267 · Notion 21 · ภาพในระบบ 218 รูป (ตรวจด้วยตาทีละรูป)'],
    ['ตรวจซ้ำ', '12/12', 'นับใหม่เทียบต้นฉบับ: โปรแกรม 46 · แถวกำหนดการ 976 · รายการย่อย 190 · ข้อหน้าปก 216 · รายชื่อ Drive 113 · ภาพ 218 ครบ'],
    ['อัปเดต', '2026-11-21', '']]
sheet('สรุป', summary, [34, 12, 100], first=True)
sheet('ประเด็นให้ทีมยืนยัน', rd('08_issues_for_team.csv'), [7, 10, 22, 80, 34, 46], wrap=('D', 'E', 'F'))
m = rd('03_activity_master.csv')
sheet('กิจกรรมรวม', m, [14, 18, 40, 34, 8, 30, 10, 26, 10, 26, 12, 34, 30, 22, 14, 40], wrap=('C', 'D', 'P'))
p = rd('01_programs.csv')
sheet('โปรแกรม', p, [24, 13, 18, 15, 12, 50, 8, 10, 10, 10, 10, 10, 10, 10, 10, 10, 40, 30, 22], wrap=('F',), link=('R', lambda v: v))
pr = rd('05_photos.csv'); pr[0].append('เปิดภาพ')
for r in pr[1:]: r.append(WEB + r[2])
sheet('ภาพ', pr, [7, 15, 24, 24, 9, 14, 26, 36, 22, 30, 22, 26, 14, 30, 15, 14], wrap=('H', 'N'), link=('P', lambda v: v))
v = rd('06_venues.csv')
sheet('ที่พัก', v, [16, 18, 32, 9, 44, 34, 22, 36, 30, 40, 40], wrap=('E', 'F', 'H', 'J', 'K'))
sheet('สถานที่ทัศนศึกษา', rd('07_field_sites.csv'), [48, 16, 40, 30], wrap=('A', 'C'))
sheet('รายชื่อจาก Drive', rd('04_activity_lists_drive.csv'), [14, 28, 30, 34, 70, 40], wrap=('E',))
sheet('ทุกแถว', rd('02_activity_rows_all.csv'), [13, 24, 8, 22, 6, 22, 7, 11, 26, 50, 40, 30, 7], wrap=())
out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/eqcamp-catalog.xlsx'
wb.save(out); print(out, [ws.title + ':' + str(ws.max_row) for ws in wb])
