"""ตรวจชุดข้อมูลกิจกรรมกับต้นฉบับแบบนับใหม่ทั้งหมด (ไม่ใช้โค้ดของตัวสร้าง)"""
import csv, json, os, sys
R = os.path.join(os.path.dirname(__file__), '..', '..')
O = os.path.join(R, 'data/activity-catalog/out')
raw = json.load(open(os.path.join(R, 'data/course-templates.raw.json')))
miss = json.load(open(os.path.join(R, 'data/activity-catalog/missing-programs.json')))['programs']
lists = json.load(open(os.path.join(R, 'data/activity-catalog/drive-activity-lists.json')))
rows = list(csv.DictReader(open(os.path.join(O, '02_activity_rows_all.csv'), encoding='utf-8-sig')))
fails = 0
def chk(ok, msg):
    global fails; print(('PASS ' if ok else 'FAIL ') + msg); fails += (not ok)
progs = [t for v in raw.values() for a in v.values() for t in a] + miss
manifest = list(csv.DictReader(open(os.path.join(R, 'data/activity-catalog/drive-manifest.tsv')), delimiter='\t'))
chk(len(progs) == len(manifest) == 46, f'โปรแกรม {len(progs)} = ไฟล์ Drive {len(manifest)} = 46')
sched = sum(len(d['rows']) for t in progs for d in t['days'])
chk(sum(r['อยู่ที่'] == 'กำหนดการ' for r in rows) == sched, f'แถวกำหนดการครบ {sched}')
subs = sum(1 for t in progs for d in t['days'] for r in d['rows'] for s in (r.get('subs') or []) if s.strip())
notes = sum(1 for t in progs for d in t['days'] for r in d['rows'] for s in (r.get('subs') or []) if s.strip().startswith(('Note', 'หมายเหตุ', 'ถึง ณ')))
got = sum(r['อยู่ที่'].startswith('กำหนดการ (') for r in rows)
chk(got == subs - notes, f'รายการย่อยครบ {got} (+{notes} บรรทัดหมายเหตุ/ต่อจากแถวเดินทาง ที่ไม่ใช่กิจกรรม = {subs})')
cover = sum(len(s['items']) for t in progs for s in t['sections'] if 'กิจกรรม' in s.get('h', '') and s.get('items'))
chk(sum(r['อยู่ที่'].startswith('หน้าปก') for r in rows) == cover, f'ข้อบนหน้าปกครบ {cover}')
chk(len({r['โปรแกรม'] for r in rows}) == 46, 'ทุกโปรแกรมมีแถวในชุดข้อมูล')
d4 = list(csv.DictReader(open(os.path.join(O, '04_activity_lists_drive.csv'), encoding='utf-8-sig')))
n_lists = sum(len(g['items']) for k, v in lists.items() if not k.startswith('_') for g in v.get('groups', [])) + \
          sum(len(v['images']['items']) for k, v in lists.items() if not k.startswith('_') and 'images' in v) + \
          sum(len(v.get('detailCards', [])) for k, v in lists.items() if not k.startswith('_'))
chk(len(d4) == n_lists, f'รายชื่อกิจกรรมจาก Drive ครบ {n_lists}')
master = list(csv.DictReader(open(os.path.join(O, '03_activity_master.csv'), encoding='utf-8-sig')))
names = {(m['รหัสหลักสูตร'], n.strip()) for m in master for n in ([m['ชื่อกิจกรรม']] + m['ชื่อเรียกอื่นที่พบ'].split('; ')) if n.strip()}
lost = [(r['รหัสหลักสูตร'], r['ชื่อกิจกรรม']) for r in d4 if (r['รหัสหลักสูตร'], r['ชื่อกิจกรรม']) not in names]
chk(not lost, f'ทุกรายชื่อจาก Drive อยู่ในรายการรวม ({len(lost)} หาย: {lost[:5]})')
act_rows = [r for r in rows if r['ระดับ'] in ('หลัก', 'รอง') and r['อยู่ที่'] == 'กำหนดการ']
lost2 = [(r['รหัสหลักสูตร'], r['ชื่อกิจกรรม']) for r in act_rows if (r['รหัสหลักสูตร'], r['ชื่อกิจกรรม']) not in names]
chk(not lost2, f'ทุกแถวกิจกรรมหลัก/รองในกำหนดการอยู่ในรายการรวม ({len(lost2)} หาย: {lost2[:5]})')
ph = list(csv.DictReader(open(os.path.join(O, '05_photos.csv'), encoding='utf-8-sig')))
files = [f for f in os.listdir(os.path.join(R, 'web/photos')) if not f.startswith('t_')]
chk(len(ph) == len(files) == 218, f'ภาพครบ {len(ph)} = ไฟล์ {len(files)}')
chk(all(p['เซสชัน'] for p in ph), 'ทุกภาพมีเซสชัน')
chk(all(os.path.exists(os.path.join(R, 'web', p['ไฟล์'])) for p in ph), 'ทุกภาพมีไฟล์จริง')
vn = list(csv.DictReader(open(os.path.join(O, '06_venues.csv'), encoding='utf-8-sig')))
chk(sum(int(v['จำนวนภาพ']) for v in vn) == sum(p['ชนิด'] == 'ที่พัก' for p in ph), 'ภาพที่พักทุกรูปผูกกับที่พัก')
sys.exit(1 if fails else 0)
