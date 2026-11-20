#!/usr/bin/env python3
"""สร้าง "ชุดข้อมูลกิจกรรม/ภาพ/ที่พัก" (EQ Camp Activity Catalog) จากของจริงทั้งหมด

แหล่งข้อมูล (ทุกแหล่งอ่านตามต้นฉบับ ไม่เดา):
  1. data/course-templates.raw.json  — โปรแกรมจริง 45 ไฟล์ (แกะจาก Drive 1C5XXMbaIZa5lhSCxhbGszSCITXn_qQU8)
  2. data/activity-catalog/missing-programs.json — โปรแกรมจริงที่ยังไม่ถูกแกะเข้าระบบ (อ่านจาก Drive 21 พ.ย. 2569)
  3. data/activity-catalog/drive-activity-lists.json — โฟลเดอร์ "รายชื่อกิจกรรม" ใน Drive (docx + การ์ดภาพ OCR)
  4. /tmp/dump.json (จาก src/*.ts) — คลัง MASTER 267 กิจกรรม · มาตรฐาน Notion 21 · ภาพชุดใหม่ · ภาพที่พัก · VENUES
  5. data/activity-catalog/photo-tags.tsv — ป้ายเซสชันภาพที่ตรวจด้วยตาทีละรูป (218 รูป)
  6. data/activity-catalog/drive-manifest.tsv — รายการไฟล์โปรแกรมทั้งหมดใน Drive (46 ไฟล์)

ผลลัพธ์: data/activity-catalog/out/*.csv + eqcamp-catalog.json
"""
import csv, json, os, re, sys
from collections import defaultdict, OrderedDict

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CAT = os.path.join(ROOT, 'data', 'activity-catalog')
OUT = os.path.join(CAT, 'out')
os.makedirs(OUT, exist_ok=True)

raw = json.load(open(os.path.join(ROOT, 'data', 'course-templates.raw.json')))
missing = json.load(open(os.path.join(CAT, 'missing-programs.json')))
lists = json.load(open(os.path.join(CAT, 'drive-activity-lists.json')))
dump = json.load(open(sys.argv[1] if len(sys.argv) > 1 else '/tmp/dump.json'))
typo = json.load(open(os.path.join(ROOT, 'data', 'typo-fixes.json')))
manifest = list(csv.DictReader(open(os.path.join(CAT, 'drive-manifest.tsv')), delimiter='\t'))
sheet_index = json.load(open(os.path.join(CAT, 'photo-index.json')))
tags = {int(r['n']): r for r in csv.DictReader(open(os.path.join(CAT, 'photo-tags.tsv')), delimiter='\t')}

COURSE_NAME = {c['code']: c['name'] for c in dump['courses']}
LABEL = dump['courseLabel']
DUR_LABEL = {'half': 'ครึ่งวัน', 'day1': 'Day Camp 1 วัน', 'day2': 'Day Camp 2 วัน', 'o21': '2 วัน 1 คืน', 'o32': '3 วัน 2 คืน'}
VARIANT_DUR = {'day': 'day1', 'day1': 'day1', 'day2': 'day2', 'o21': 'o21', 'o21sea': 'o21', 'o32': 'o32'}

def fix_typos(s: str) -> str:
    for f in typo.get('fixes', []):
        a, b = (f['from'], f['to']) if isinstance(f, dict) else (f[0], f[1])
        s = s.replace(a, b)
    for f in typo.get('regex', []):
        a, b = (f['pattern'], f['to']) if isinstance(f, dict) else (f[0], f[1])
        s = re.sub(a, b, s)
    return s

# ---------- จัดประเภทแถวกำหนดการ ----------
MEAL = re.compile(r'พักเบรก|รับประทาน|อาหาร(เช้า|กลางวัน|เย็น|ว่าง)|Have (Breakfast|Lunch|Dinner)|Time for (Breakfast|Lunch|Dinner|Break)|Take a [Bb]reak|Coffee Break|^พักรับประทาน', re.I)
TRAVEL = re.compile(r'ออกเดินทาง|เดินทาง(กลับ|ถึง|เข้า|ไป|สู่|มา|ด้วย)|Departure|Arrive|Travel|ถึงที่พัก|ล้อหมุน|Come Back Safely|good trip', re.I)
CHECK = re.compile(r'Check[- ]?(in|out)|เช็คอิน|เช็คเอาท์|เข้าห้องพัก|เก็บสัมภาระ|เตรียมสัมภาระ|รับกุญแจ', re.I)
REG = re.compile(r'ลงทะเบียน|Registration', re.I)
REST = re.compile(r'พักผ่อน|Free time|เวลาว่าง|ทำธุระส่วนตัว|อาบน้ำ|Sweet ?dream|ฝันดี|Good ?night|เข้านอน|Rest', re.I)
CEREMONY = re.compile(r'พิธีเปิด|พิธีปิด|Opening Ceremony|Closing Ceremony|มอบเกียรติบัตร|ปิดค่าย|Farewell', re.I)
RECREATION = re.compile(r'สันทนาการ|นันทนาการ|ละลายพฤติกรรม|Ice ?Breaking|Warm ?up|Reboot|Game Inspiration|เปิดประตู|Morning Fun|Morning Fresh|Lift-Off|ออกกำลังกาย|Morning Exercise|Energizer|Brain ?Gym', re.I)
SUMMARY = re.compile(r'สรุป|ถอดบทเรียน|AAR|After Action|Conclusion|Wrap[- ]?up|ทบทวน|Reflection|Feedback|ตอบคำถาม', re.I)
PARTY = re.compile(r'ปาร์ตี้|Party|การแสดง|Talent|Night ?Show|Netflix|Show ?Time|ธีม', re.I)
FIELD = re.compile(r'ทัศนศึกษา|ศึกษาดูงาน|เยี่ยมชม|ดำน้ำ|ข้ามเกาะ|เกาะ|อุทยาน|พิพิธภัณฑ์|ถ้ำ|ฟาร์ม|สถาบันวิทยาศาสตร์|หอดูดาว|ท้องฟ้าจำลอง|ภาคสนาม|เดินป่า|ศึกษาธรรมชาติ|Field ?Trip|Excursion|Snorkel|ล่องเรือ|Kayak|คายัค|ชายหาด|ป่าชายเลน|Mangrove', re.I)

def mins(t: str):
    m = re.findall(r'(\d{1,2})[.:](\d{2})', t or '')
    if len(m) >= 2:
        a = int(m[0][0]) * 60 + int(m[0][1]); b = int(m[1][0]) * 60 + int(m[1][1])
        return (a, b - a if b > a else None)
    if len(m) == 1: return (int(m[0][0]) * 60 + int(m[0][1]), None)
    return (None, None)

def classify(title: str, time: str):
    """คืน (ระดับ, หมวด) — ระดับ: หลัก · รอง · โลจิสติกส์"""
    start, _ = mins(time)
    t = title.strip()
    if not name_of(t): return ('ไม่มีชื่อ', 'ต้นฉบับไม่มีชื่อกิจกรรม')
    if MEAL.search(t) and not re.search(r'กิจกรรม|Activity|Workshop', t, re.I): return ('โลจิสติกส์', 'มื้ออาหาร/อาหารว่าง')
    if REG.search(t) and not CEREMONY.search(t): return ('โลจิสติกส์', 'ลงทะเบียน')
    if CHECK.search(t): return ('โลจิสติกส์', 'เช็คอิน/เช็คเอาท์')
    if TRAVEL.search(t) and (re.match(r'\s*(ออก)?เดินทาง|Come Back', t) or not FIELD.search(t)): return ('โลจิสติกส์', 'เดินทาง')
    if REST.search(t) and not re.search(r'กิจกรรม', t): return ('โลจิสติกส์', 'พักผ่อน')
    if CEREMONY.search(t) or (REG.search(t)): return ('รอง', 'พิธีเปิด/ปิด')
    if RECREATION.search(t): return ('รอง', 'สันทนาการ/ละลายพฤติกรรม')
    if SUMMARY.search(t) and not re.search(r'Next Step', t, re.I): return ('รอง', 'สรุป/ถอดบทเรียน/AAR')
    if PARTY.search(t) and (start is None or start >= 17 * 60): return ('รอง', 'ภาคค่ำ/ปาร์ตี้')
    if FIELD.search(t): return ('หลัก', 'ภาคสนาม/ทัศนศึกษา')
    if start is not None and start >= 18 * 60: return ('หลัก', 'ภาคค่ำ (กิจกรรมเรียนรู้)')
    return ('หลัก', 'กิจกรรมเรียนรู้/ฐาน/เวิร์กชอป')

def name_of(title: str) -> str:
    """ชื่อกิจกรรมแบบอ่านง่าย: ตัดคำนำ 'กิจกรรม' + เครื่องหมายคำพูด (เก็บถ้อยคำเดิมไว้อีกช่อง)"""
    s = re.sub(r'^\s*\d+\s*[.)]\s*', '', title)
    s = re.sub(r'^(กิจกรรม|Activity\s*\d*\s*:)\s*', '', s, flags=re.I)
    s = s.replace('“', '"').replace('”', '"').replace('"', '').strip(' :–-')
    return re.sub(r'\s+', ' ', s).strip()

def key_of(title: str) -> str:
    s = name_of(title).lower()
    s = re.sub(r'\((?:[^()]*)\)', ' ', s)              # ตัดวงเล็บ (ทักษะ/คำอธิบาย)
    s = re.sub(r'\b(part|ep|episode)\s*\.?\s*\d+', ' ', s)
    s = re.sub(r'#\s*ep\.?\s*\d+|\bep\.?\s*\d+|#\s*\d+', ' ', s)
    s = re.sub(r'^\s*the\s+', '', s.strip())                 # The Hawk Eye = Hawk Eye
    s = re.sub(r'\s+games?\s*[.!]*$', '', s)                  # Charade Game = Charades · Crossword Game = Crossword
    s = re.sub(r'[\s"“”\'‘’.,:;!?–\-_/|&+#()]+', '', s)
    if re.fullmatch(r'[a-z0-9]{5,}s', s): s = s[:-1]           # คำอังกฤษล้วนพหูพจน์ (Run for Words / Charades)
    return s

def sub_kind(s: str) -> str:
    """รายการใต้แถวกำหนดการ: 'named' = กิจกรรมย่อยที่มีชื่อ · 'skill' = วงเล็บบอกทักษะ · 'topic' = หัวข้อเนื้อหา · 'note' = หมายเหตุ (ไม่ใช่กิจกรรม)"""
    t = re.sub(r'^[-–•●]\s*', '', s).strip()
    if re.match(r'(Note|หมายเหตุ)\s*:|ถึง ณ ', t, re.I): return 'note'
    if not name_of(t): return 'blank'
    if any(k and len(k) >= 4 and k in key_of(t) for k in KNOWN): return 'named'
    if t.startswith('('): return 'skill'
    if re.search(r'Activity\s*\d|Activity\s*:|ฐาน(ที่)?\s*\d|^ที่\s*\d|Station|Mission|Game|Challenge|เกม', t, re.I): return 'named'
    if not re.search(r'[\u0E00-\u0E7F]', re.sub(r'\([^)]*\)', '', t)) and len(t) <= 45: return 'named'
    return 'topic'

KNOWN = set()
for _c, _v in lists.items():
    if _c.startswith('_'): continue
    for _g in _v.get('groups', []):
        for _it in _g['items']: KNOWN.add(key_of(_it['name'] if isinstance(_it, dict) else _it))
    for _nm in _v.get('images', {}).get('items', []): KNOWN.add(key_of(_nm))
    for _cd in _v.get('detailCards', []): KNOWN.add(key_of(_cd['name']))
for _a in dump['acts']:
    _k = key_of(_a['title'])
    if len(_k) <= 30: KNOWN.add(_k)   # เฉพาะชื่อสั้น (ชื่อเกม/ฐาน) ไม่เอาประโยคยาว

# ---------- โปรแกรมทั้งหมด ----------
programs = []
for code, durs in raw.items():
    for dk, arr in durs.items():
        for t in arr:
            programs.append({'code': code, 'dur': VARIANT_DUR.get(t['variant'], dk), 'variant': t['variant'], 'src': 'raw', 't': t})
for t in missing['programs']:
    programs.append({'code': t['code'], 'dur': t['dur'], 'variant': t['variant'], 'src': 'missing', 't': t})

# จับคู่ไฟล์ Drive ↔ โปรแกรม
DRIVE_DUR = {'Day Camp': None, '2 วัน 1 คืน': 'o21', '3 วัน 2 คืน': 'o32'}
def drive_dur(row):
    d = DRIVE_DUR[row['durFolder']]
    if d: return d
    return 'day2' if re.search(r'2\s*วัน', row['title']) else 'day1'
def drive_for(p):
    cands = [r for r in manifest if r['course'] == p['code'] and drive_dur(r) == p['dur']]
    if p['code'] == 'PL SEA 0103' and p['dur'] == 'o21':
        cands = [r for r in cands if ('ลงทะเล' in r['title']) == (p['variant'] == 'o21sea')]
    if p['src'] == 'missing':
        cands = [r for r in manifest if r['fileId'] == p['t']['fileId']]
    if p['code'] == 'PL CHI 0109' and p['dur'] == 'day2':
        cands = [r for r in cands if 'English & Chinese' in r['title']]
    if p['code'] == 'PL CHI 0109' and p['dur'] == 'day1':
        cands = [r for r in manifest if r['course'] == 'PL CHI 0109' and 'Day Camp 1 วัน' in r['title']]
    return cands
for p in programs:
    c = drive_for(p)
    if len(c) != 1: raise SystemExit(f"จับคู่ไฟล์ Drive ไม่ได้: {p['code']} {p['variant']} → {[x['title'] for x in c]}")
    p['drive'] = c[0]
used = {p['drive']['fileId'] for p in programs}
unmatched = [r for r in manifest if r['fileId'] not in used]
if unmatched: raise SystemExit('ไฟล์ Drive ที่ไม่มีในชุดข้อมูล: ' + ', '.join(r['title'] for r in unmatched))

def pid(p): return f"{p['code']}__{p['variant']}"

# ---------- 1) ทุกแถวกิจกรรมในโปรแกรมจริง ----------
occ = []   # ทุกการปรากฏ
for p in programs:
    t = p['t']; prog = pid(p)
    cover = []
    for s in t['sections']:
        if 'กิจกรรม' in s.get('h', '') and s.get('items'):
            cover = s['items']
    for i, it in enumerate(cover, 1):
        title = fix_typos(it)
        lv, cat = classify(title, '')
        if re.search(r'AAR|After Action|ทดสอบหลังการเรียนรู้|ถอดบทเรียน', title): lv, cat = 'รอง', 'สรุป/ถอดบทเรียน/AAR'
        occ.append(dict(program=prog, code=p['code'], dur=p['dur'], where='หน้าปก (กิจกรรมเชิงบูรณาการ)', day='', time='', minutes='',
                        level=lv, category=cat, title=title, name=name_of(title), parent='', order=i))
    for d in t['days']:
        for j, r in enumerate(d['rows'], 1):
            title = fix_typos(r['title']); _, dur = mins(r['time'])
            lv, cat = classify(title, r['time'])
            occ.append(dict(program=prog, code=p['code'], dur=p['dur'], where='กำหนดการ', day=d['day'], time=r['time'], minutes=dur or '',
                            level=lv, category=cat, title=title, name=name_of(title), parent='', order=j))
            for k, sub in enumerate(r.get('subs') or [], 1):
                s2 = fix_typos(sub).strip()
                if not s2: continue
                sk = sub_kind(s2)
                if sk == 'note': continue   # หมายเหตุกำหนดการที่ติดมาใต้แถวสุดท้าย — ไม่ใช่กิจกรรม
                if sk == 'blank':
                    occ.append(dict(program=prog, code=p['code'], dur=p['dur'], where='กำหนดการ (รายการย่อย)', day=d['day'], time=r['time'], minutes='',
                                    level='ไม่มีชื่อ', category='ต้นฉบับไม่มีชื่อกิจกรรม', title=s2, name='', parent=name_of(title), order=f'{j}.{k}'))
                    continue
                occ.append(dict(program=prog, code=p['code'], dur=p['dur'], where='กำหนดการ (รายการย่อย)', day=d['day'], time='', minutes='',
                                level='ย่อย', category={'named': 'กิจกรรมย่อย (มีชื่อ)', 'skill': 'ทักษะที่ระบุ (วงเล็บ)', 'topic': 'หัวข้อย่อย/เนื้อหา'}[sk], title=s2,
                                name=name_of(re.sub(r'^[-–•●]\s*', '', s2)), parent=name_of(title), order=f'{j}.{k}'))

# ---------- 2) รายชื่อกิจกรรมจาก Drive / MASTER / Notion ----------
extra = []
for code, v in lists.items():
    if code.startswith('_'): continue
    for g in v.get('groups', []):
        for it in g['items']:
            nm = it['name'] if isinstance(it, dict) else it
            extra.append(dict(source='Drive รายชื่อกิจกรรม', code=code, group=g['group'], name=nm,
                              detail=json.dumps({k: v2 for k, v2 in it.items() if k != 'name'}, ensure_ascii=False) if isinstance(it, dict) else '',
                              file=v.get('file') or ''))
    if 'images' in v:
        for nm in v['images']['items']:
            extra.append(dict(source='Drive การ์ดภาพกิจกรรม (OCR)', code=code, group='การ์ด STEM/STEAM 1–2', name=nm, detail='', file='; '.join(v['images']['files'])))
    for cd in v.get('detailCards', []):
        extra.append(dict(source='Drive การ์ดรายละเอียด (OCR)', code=code, group='รายละเอียดกิจกรรม', name=cd['name'],
                          detail=json.dumps({k: v2 for k, v2 in cd.items() if k != 'name'}, ensure_ascii=False), file='รายละเอียดกิจกรรม/' + cd['cards']))
for a in dump['acts']:
    extra.append(dict(source='คลัง MASTER', code=a['course'], group=a['kind'], name=name_of(fix_typos(a['title'])), detail=a['id'], file='MASTER sheet 1kwqjXHOLremaVI-j61J296G7K6o6-ZMLkCtaWHHNi00'))

# ---------- 3) รวมเป็นรายชื่อกิจกรรมไม่ซ้ำ ต่อหลักสูตร ----------
master = OrderedDict()
def bucket(code, nm):
    k = (code, key_of(nm))
    if k not in master:
        master[k] = dict(code=code, course=LABEL.get(code, code), name=nm, names=set(), level=set(), category=set(), programs=set(), durs=set(),
                         where=set(), minutes=[], sources=set(), parents=set(), notion='', notion_status='', plevel=set())
    return master[k]
for o in occ:
    if o['level'] == 'โลจิสติกส์': continue
    if o['level'] in ('ย่อย', 'ไม่มีชื่อ') and o['category'] != 'กิจกรรมย่อย (มีชื่อ)': continue  # หัวข้อเนื้อหา เก็บในไฟล์ occurrences
    b = bucket(o['code'], o['name']); b['names'].add(o['name']); b['level'].add(o['level']); b['plevel'].add(o['level']); b['category'].add(o['category'])
    b['programs'].add(o['program']); b['durs'].add(DUR_LABEL[o['dur']]); b['where'].add(o['where']); b['sources'].add('โปรแกรมจริง')
    if o['minutes']: b['minutes'].append(o['minutes'])
    if o['parent']: b['parents'].add(o['parent'])
for e in extra:
    if not e['name'] or e['code'] not in LABEL: continue
    b = bucket(e['code'], e['name']); b['names'].add(e['name']); b['sources'].add(e['source'])
    if e['source'] == 'คลัง MASTER':
        b['category'].add({'core': 'กิจกรรมเรียนรู้/ฐาน/เวิร์กชอป', 'night': 'ภาคค่ำ (กิจกรรมเรียนรู้)', 'opening': 'สันทนาการ/ละลายพฤติกรรม', 'closing': 'สรุป/ถอดบทเรียน/AAR'}.get(e['group'], e['group']))
        b['level'].add('รอง' if e['group'] in ('opening', 'closing') else 'หลัก')
    else:
        b['level'].add('หลัก'); b['category'].add('กิจกรรมฐาน/สถานี (จากรายชื่อทีม)')

# Notion: จับคู่ด้วยคีย์ชื่อ (≥5 อักษร คีย์ยาวสุดชนะ เหมือน notionActFor ใน core)
def nstatus(n):
    if n.get('empty'): return 'ยังไม่มีข้อมูล'
    ok = sum([n.get('status') == 'เสร็จสิ้น', bool(n.get('slides')), bool(n.get('lab')), bool(n.get('perGroup') or n.get('shared'))])
    return 'พร้อมใช้' if ok == 4 else 'บางส่วน'
nkeys = sorted(((key_of(n['name']), n) for n in dump['notion']), key=lambda x: -len(x[0]))
notion_hit = defaultdict(set)
for (code, k), b in master.items():
    for nk, n in nkeys:
        if len(nk) >= 5 and nk in k:
            b['notion'] = n['name']; b['notion_status'] = nstatus(n); notion_hit[n['name']].add(code); break

# ---------- 4) ภาพ ----------
order = sheet_index['order']; srcmap = sheet_index['src']
DUP = {137: 123, 138: 124, 139: 125, 140: 126, 143: 127, 144: 128, 27: 22, 205: 104}
SESSION_TH = {
    'group': 'ภาพหมู่', 'opening': 'พิธีเปิด/บรรยายรวม', 'recreation': 'สันทนาการ/ละลายพฤติกรรม', 'station': 'ฐานกิจกรรม/เกม',
    'workshop': 'เวิร์กชอป/ลงมือทำ/ทดลอง', 'competition': 'แข่งขัน/ภารกิจ', 'culture': 'กิจกรรมวัฒนธรรม', 'field': 'ภาคสนาม/ทัศนศึกษา (มีผู้เข้าร่วม)',
    'field_site': 'สถานที่ทัศนศึกษา (ไม่มีผู้เข้าร่วม)', 'night': 'ภาคค่ำ', 'party': 'ปาร์ตี้/การแสดง', 'summary': 'นำเสนอ/สรุปผล', 'award': 'มอบรางวัล/เกียรติบัตร',
    'result': 'ผลงานนักเรียน', 'equipment': 'อุปกรณ์/สื่อ (ภาพใกล้)', 'stock': 'ภาพประกอบลักษณะสต็อก', 'promo': 'ภาพโปรโมต (มีข้อความทับ)',
    'venue_exterior': 'ที่พัก: ภายนอก/ป้าย/มุมสูง', 'venue_lobby': 'ที่พัก: ล็อบบี้', 'venue_room': 'ที่พัก: ห้องพัก', 'venue_pool': 'ที่พัก: สระว่ายน้ำ',
    'venue_meeting': 'ที่พัก: ห้องประชุม', 'venue_dining': 'ที่พัก: ห้องอาหาร', 'venue_facility': 'ที่พัก: สิ่งอำนวยความสะดวก'}
FLAG_TH = {'mask': 'มีหน้ากากอนามัย (ภาพยุคเก่า)', 'stock_suspect': 'ลักษณะภาพสต็อก — ตรวจสิทธิ์ก่อนใช้', 'watermark': 'มีลายน้ำเว็บอื่น — ห้ามใช้',
           'not_own': 'ไม่ใช่ภาพที่ทีมถ่าย — ตรวจสิทธิ์ก่อนใช้'}
photos = []
for n, pid_ in enumerate(order, 1):
    tg = tags[n]; s = tg['session']; flags = [f for f in tg['flags'].split(',') if f]
    srcs = srcmap[pid_]
    codes = sorted({x.split('|')[0] for x in srcs})
    progs = sorted({x.split('|')[0] + '__' + x.split('|')[1] for x in srcs if x.split('|')[1] != 'fresh'})
    venue = sorted({x.split('venue:')[1].replace('ภาพที่พัก ', '').replace('ที่พัก ', '').rstrip('.') for x in srcs if 'venue:' in x})
    fresh = [x.split('|')[2] for x in srcs if x.split('|')[1] == 'fresh']
    use = 'ห้ามใช้' if 'watermark' in flags else ('ตรวจสิทธิ์ก่อน' if set(flags) & {'stock_suspect', 'not_own'} else 'ใช้ได้')
    if s.startswith('venue_') and not venue: venue = ['?']
    photos.append(dict(no=n, id=pid_, file=f'photos/{pid_}.jpg', thumb=f'photos/t_{pid_}.jpg', kind='ที่พัก' if s.startswith('venue_') else 'กิจกรรม',
                       session=s, session_th=SESSION_TH[s], scene=tg['scene'], courses=codes, programs=progs, venue=venue[0] if venue else '',
                       set=('ชุดใหม่ ' + fresh[0]) if fresh else 'จากไฟล์โปรแกรม', flags=[FLAG_TH[f] for f in flags], use=use,
                       duplicate_of=order[DUP[n] - 1] if n in DUP else ''))

# ---------- 5) ที่พัก / สถานที่ ----------
VENUE_META = {v['name']: v for v in dump['venuePhotos']}
venues = OrderedDict()
def vbucket(name, province=''):
    if name not in venues: venues[name] = dict(name=name, province=province, area='', programs=set(), courses=set(), photos=[], composition=defaultdict(int), source=set(), note='')
    return venues[name]
for v in dump['venuePhotos']:
    b = vbucket(v['name'].rstrip('.'), v['province']); b['source'].add('ภาพในไฟล์โปรแกรม')
for p in photos:
    if p['kind'] == 'ที่พัก':
        b = vbucket(p['venue']); b['photos'].append(p['id']); b['composition'][p['session_th'].replace('ที่พัก: ', '')] += 1
        b['courses'].update(p['courses']); b['programs'].update(p['programs'])
# สถานที่ที่โปรแกรมจริงระบุ (มี/ไม่มีภาพ)
VENUE_RX = re.compile(r'(Fortune Hotel Korat|Loei Palace Hotel|Fountain Tree Resort|BCP Hotel Rayong|Bella Villa Cabana Pattaya|Kasalong Resort and Spa|โรงแรมจันทรา รีสอร์ท|Phumork Village Khao Kho|Chiangkhan River Mountain Resort|The Flora May Resort|Khanom Sunrise Beach Resort|Kiangtalay Resort Rayong|Aurora Resort Kanchanaburi|ออโรร่า รีสอร์ท กาญจนบุรี)')
PROVINCE = {'Fortune Hotel Korat': 'นครราชสีมา', 'Loei Palace Hotel': 'เลย', 'Fountain Tree Resort': 'นครราชสีมา', 'BCP Hotel Rayong': 'ระยอง',
            'Bella Villa Cabana Pattaya': 'ชลบุรี', 'Kasalong Resort and Spa': 'ชลบุรี', 'โรงแรมจันทรา รีสอร์ท': '', 'Phumork Village Khao Kho': 'เพชรบูรณ์',
            'Chiangkhan River Mountain Resort': 'เลย', 'The Flora May Resort': '', 'Khanom Sunrise Beach Resort': 'นครศรีธรรมราช',
            'Kiangtalay Resort Rayong': 'ระยอง', 'Aurora Resort Kanchanaburi': 'กาญจนบุรี'}
AREA = {'Fortune Hotel Korat': 'โคราช (ตัวเมือง)', 'Fountain Tree Resort': 'เขาใหญ่/ปากช่อง', 'Loei Palace Hotel': 'เลย (ตัวเมือง)', 'BCP Hotel Rayong': 'ระยอง',
        'Bella Villa Cabana Pattaya': 'พัทยา', 'Kasalong Resort and Spa': 'บางแสน/ศรีราชา', 'Phumork Village Khao Kho': 'เขาค้อ', 'Chiangkhan River Mountain Resort': 'เชียงคาน',
        'Khanom Sunrise Beach Resort': 'ขนอม', 'Kiangtalay Resort Rayong': 'ระยอง (ริมทะเล)', 'Aurora Resort Kanchanaburi': 'กาญจนบุรี'}
for p in programs:
    txt = json.dumps(p['t'], ensure_ascii=False)
    for m in set(VENUE_RX.findall(txt)):
        nm = 'Aurora Resort Kanchanaburi' if m.startswith('ออโรร่า') else m
        b = vbucket(nm); b['programs'].add(pid(p)); b['courses'].add(p['code']); b['source'].add('ระบุในกำหนดการ/งบ')
for nm, b in venues.items():
    b['province'] = b['province'] or PROVINCE.get(nm, ''); b['area'] = AREA.get(nm, '')
    if nm in VENUE_META and not b['province']: b['province'] = VENUE_META[nm]['province']
for v in dump['venues']:
    b = vbucket(v['name'], v['province']); b['source'].add('VENUES ในระบบ (hard-code)'); b['note'] = (v.get('visit') or '') + (' · ' + v['note'] if v.get('note') else '')
STD = {'ภายนอก/ป้าย/มุมสูง': 2, 'ห้องพัก': 2, 'สระว่ายน้ำ': 2, 'ห้องประชุม': 2}
def gap(b):
    c = b['composition']; have = {'ภายนอก/ป้าย/มุมสูง': c.get('ภายนอก/ป้าย/มุมสูง', 0) + c.get('ล็อบบี้', 0), 'ห้องพัก': c.get('ห้องพัก', 0),
                                  'สระว่ายน้ำ': c.get('สระว่ายน้ำ', 0) + c.get('สิ่งอำนวยความสะดวก', 0) + c.get('ห้องอาหาร', 0), 'ห้องประชุม': c.get('ห้องประชุม', 0)}
    return '; '.join(f'{k} ขาด {n - have[k]}' for k, n in STD.items() if have[k] < n) or 'ครบ'

# สถานที่ทัศนศึกษา (field sites) จากกำหนดการ
SITE_RX = re.compile(r'(สถาบันวิทยาศาสตร์ทางทะเล[^,"(]*|อุทยานแห่งชาติ[^\s,"(]+|พิพิธภัณฑ์[^,"(]{0,40}|ถ้ำ[^\s,"(]+|เกาะ[^\s,"(]+|ฟาร์ม[^,"(]{0,40}|หอดูดาว[^,"(]{0,40}|ท้องฟ้าจำลอง[^,"(]{0,30}|ป่าชายเลน[^,"(]{0,30}|ศูนย์[^,"(]{3,40})')
sites = defaultdict(lambda: dict(programs=set(), courses=set()))
for o in occ:
    if o['level'] == 'โลจิสติกส์' and o['category'] != 'เดินทาง': continue
    for m in SITE_RX.findall(o['title']):
        m = m.strip(' .-–');
        if len(m) < 5: continue
        sites[m]['programs'].add(o['program']); sites[m]['courses'].add(o['code'])

# ---------- เขียนไฟล์ ----------
def wcsv(name, rows, cols):
    with open(os.path.join(OUT, name), 'w', newline='', encoding='utf-8-sig') as f:
        w = csv.writer(f); w.writerow([c[1] for c in cols])
        for r in rows: w.writerow([('; '.join(sorted(r[c[0]])) if isinstance(r[c[0]], (set, list)) else r[c[0]]) for c in cols])

prog_rows = []
for p in programs:
    t = p['t']; pr = t.get('price') or {}
    o = [x for x in occ if x['program'] == pid(p)]
    prog_rows.append(dict(id=pid(p), code=p['code'], course=LABEL.get(p['code'], ''), dur=DUR_LABEL[p['dur']], variant=p['variant'],
                          title=' '.join(t['titles']), days=len(t['days']), normal=pr.get('normal', ''), special=pr.get('special', ''),
                          main=sum(x['level'] == 'หลัก' and x['where'] == 'กำหนดการ' for x in o), second=sum(x['level'] == 'รอง' and x['where'] == 'กำหนดการ' for x in o),
                          sub=sum(x['level'] == 'ย่อย' for x in o), logi=sum(x['level'] == 'โลจิสติกส์' for x in o), cover=sum(x['where'].startswith('หน้าปก') for x in o),
                          photos=len(t.get('photos', [])), vphotos=sum(len(v) for v in (t.get('venuePhotos') or {}).values()),
                          file=p['drive']['title'], link=f"https://drive.google.com/file/d/{p['drive']['fileId']}/view", status='ยังไม่อยู่ในเว็บ (แกะเพิ่ม 21 พ.ย.)' if p['src'] == 'missing' else 'อยู่ในเว็บแล้ว'))
prog_rows.sort(key=lambda r: (r['code'], ['Day Camp 1 วัน', 'Day Camp 2 วัน', '2 วัน 1 คืน', '3 วัน 2 คืน'].index(r['dur']), r['variant']))
wcsv('01_programs.csv', prog_rows, [('id', 'รหัสโปรแกรม'), ('code', 'รหัสหลักสูตร'), ('course', 'หลักสูตร'), ('dur', 'ระยะเวลา'), ('variant', 'แบบ'), ('title', 'ชื่อโปรแกรม (ตามไฟล์)'),
    ('days', 'จำนวนวัน'), ('normal', 'ราคาปกติ'), ('special', 'ราคาพิเศษ'), ('main', 'แถวกิจกรรมหลัก'), ('second', 'แถวกิจกรรมรอง'), ('sub', 'รายการย่อย'), ('logi', 'แถวโลจิสติกส์'),
    ('cover', 'ข้อบนหน้าปก'), ('photos', 'ภาพกิจกรรมในไฟล์'), ('vphotos', 'ภาพที่พักในไฟล์'), ('file', 'ไฟล์ต้นฉบับ'), ('link', 'ลิงก์ Drive'), ('status', 'สถานะในเว็บ')])

occ.sort(key=lambda o: (o['code'], o['program'], 0 if o['where'].startswith('หน้าปก') else 1, o['day'] or 0, str(o['order'])))
wcsv('02_activity_rows_all.csv', occ, [('code', 'รหัสหลักสูตร'), ('program', 'โปรแกรม'), ('dur', 'ระยะเวลา'), ('where', 'อยู่ที่'), ('day', 'วันที่'), ('time', 'เวลา'), ('minutes', 'นาที'),
    ('level', 'ระดับ'), ('category', 'หมวด'), ('title', 'ข้อความตามต้นฉบับ'), ('name', 'ชื่อกิจกรรม'), ('parent', 'อยู่ใต้กิจกรรม'), ('order', 'ลำดับ')])

mrows = []
for (code, k), b in master.items():
    L = b['plevel'] or b['level']   # ระดับจากกำหนดการจริงมาก่อน คลัง/รายชื่อใช้เมื่อไม่พบในโปรแกรม
    lv = 'หลัก' if 'หลัก' in L else ('รอง' if 'รอง' in L else 'ย่อย')
    inreal = 'อยู่ในกำหนดการ' if any(w.startswith('กำหนดการ') for w in b['where']) else ('เฉพาะหน้าปก' if b['where'] else 'ไม่พบในโปรแกรมจริง')
    mm = sorted(b['minutes']); med = mm[len(mm) // 2] if mm else ''
    mrows.append(dict(code=code, course=b['course'], name=sorted(b['names'], key=len)[0] if b['names'] else b['name'], alt='; '.join(sorted(b['names'])) if len(b['names']) > 1 else '',
                      level=lv, category='; '.join(sorted(b['category'])), progs=len(b['programs']), durs=b['durs'], where=b['where'], minutes=med,
                      sources=b['sources'], in_real=inreal, parents=b['parents'],
                      notion=b['notion'], notion_status=b['notion_status'] or ('—' if not b['notion'] else ''), programs=b['programs']))
mrows.sort(key=lambda r: (r['code'], {'หลัก': 0, 'รอง': 1, 'ย่อย': 2}[r['level']], -r['progs'], r['name']))
wcsv('03_activity_master.csv', mrows, [('code', 'รหัสหลักสูตร'), ('course', 'หลักสูตร'), ('name', 'ชื่อกิจกรรม'), ('alt', 'ชื่อเรียกอื่นที่พบ'), ('level', 'ระดับ'), ('category', 'หมวด'),
    ('progs', 'พบในกี่โปรแกรม'), ('durs', 'ระยะเวลาที่ใช้'), ('minutes', 'นาที (มัธยฐาน)'), ('where', 'พบที่'), ('in_real', 'อยู่ในโปรแกรมจริง'), ('sources', 'แหล่งข้อมูล'),
    ('parents', 'เป็นกิจกรรมย่อยของ'), ('notion', 'มาตรฐาน Notion'), ('notion_status', 'ความพร้อม Notion'), ('programs', 'โปรแกรมที่ใช้')])

wcsv('04_activity_lists_drive.csv', [e for e in extra if e['source'] != 'คลัง MASTER'],
     [('code', 'รหัสหลักสูตร'), ('source', 'แหล่ง'), ('group', 'กลุ่ม'), ('name', 'ชื่อกิจกรรม'), ('detail', 'รายละเอียด'), ('file', 'ไฟล์')])

prow = [dict(p, courses='; '.join(p['courses']), programs='; '.join(p['programs']), flags='; '.join(p['flags'])) for p in photos]
wcsv('05_photos.csv', prow, [('no', 'ลำดับ'), ('id', 'รหัสภาพ'), ('file', 'ไฟล์'), ('thumb', 'ภาพย่อ'), ('kind', 'ชนิด'), ('session', 'เซสชัน (รหัส)'), ('session_th', 'เซสชัน'),
    ('scene', 'ในภาพ'), ('courses', 'หลักสูตร'), ('programs', 'อยู่ในไฟล์โปรแกรม'), ('venue', 'ที่พัก'), ('set', 'ชุดภาพ'), ('use', 'การใช้งาน'), ('flags', 'ข้อควรระวัง'), ('duplicate_of', 'ซ้ำกับภาพ')])

vrows = []
for nm, b in venues.items():
    vrows.append(dict(name=nm, province=b['province'] or 'ไม่ระบุในไฟล์', area=b['area'], photos=len(b['photos']), comp='; '.join(f'{k} {n}' for k, n in b['composition'].items()),
                      gap=gap(b) if b['photos'] else 'ไม่มีภาพในระบบ', courses=b['courses'], programs=b['programs'], source=b['source'], ids='; '.join(b['photos']), note=b['note']))
vrows.sort(key=lambda r: (r['province'], -r['photos'], r['name']))
wcsv('06_venues.csv', vrows, [('province', 'จังหวัด'), ('area', 'พื้นที่'), ('name', 'ที่พัก'), ('photos', 'จำนวนภาพ'), ('comp', 'องค์ประกอบภาพ'), ('gap', 'เทียบมาตรฐาน 8 รูป'),
    ('courses', 'หลักสูตรที่ใช้'), ('programs', 'โปรแกรมที่ระบุ'), ('source', 'ที่มา'), ('ids', 'รหัสภาพ'), ('note', 'หมายเหตุ/จุดเที่ยว')])

srows = [dict(site=k, programs=v['programs'], courses=v['courses'], photos='; '.join(str(p['no']) for p in photos if p['session'] in ('field', 'field_site', 'promo') and set(p['programs']) & v['programs'])) for k, v in sorted(sites.items())]
wcsv('07_field_sites.csv', srows, [('site', 'สถานที่ทัศนศึกษา (ตามกำหนดการ)'), ('courses', 'หลักสูตร'), ('programs', 'โปรแกรม'), ('photos', 'ภาพภาคสนามของหลักสูตรนี้ (ลำดับ)')])

json.dump(dict(
    generated='2026-11-21', note='ชุดข้อมูลกิจกรรม/ภาพ/ที่พัก EQ Camp — สร้างจาก scripts/catalog/build-catalog.py',
    sessions=SESSION_TH,
    courses=[dict(code=c['code'], label=LABEL.get(c['code']), name=c['name']) for c in dump['courses']],
    programs=prog_rows, activities=mrows, rows=occ,
    driveLists=[e for e in extra if e['source'] != 'คลัง MASTER'], photos=photos,
    venues=[dict(r, courses=sorted(r['courses']), programs=sorted(r['programs']), source=sorted(r['source']), ids=r['ids'].split('; ') if r['ids'] else []) for r in vrows],
    fieldSites=[dict(r, programs=sorted(r['programs']), courses=sorted(r['courses'])) for r in srows],
    issues='see 08_issues_for_team.csv',
), open(os.path.join(OUT, 'eqcamp-catalog.json'), 'w'), ensure_ascii=False, indent=1, default=lambda x: sorted(x) if isinstance(x, set) else str(x))

# ---------- 8) ประเด็นให้ทีมยืนยัน (ห้ามเดา) ----------
issues = []
def I(pri, topic, what, where, action): issues.append(dict(pri=pri, topic=topic, what=what, where=where, action=action))
for p in programs:
    if p['src'] == 'missing':
        I('สูง', 'โปรแกรมตกหล่น', 'โปรแกรมจริงใน Drive ยังไม่อยู่ในเว็บ: ' + p['drive']['title'], p['drive']['title'], 'แกะเพิ่มเป็นแม่แบบในเว็บ (รวมไว้ในชุดข้อมูลนี้แล้ว) · ' + p['t'].get('note', ''))
for o in occ:
    if o['level'] == 'ไม่มีชื่อ':
        I('สูง', 'ต้นฉบับไม่มีชื่อกิจกรรม', f"วันที่ {o['day']} เวลา {o['time']} " + (f"ใต้ '{o['parent']}' " if o['parent'] else '') + f"ไม่มีชื่อกิจกรรม (ข้อความในไฟล์: '{o['title']}')", o['program'], 'ทีมเติมชื่อในไฟล์ต้นฉบับ')
I('กลาง', 'การ์ดกิจกรรม', 'การ์ดภาษาอังกฤษ Conversation Gang (22.jpg) ใส่ขั้นตอนของ Pictionary', 'English Camp/รายชื่อกิจกรรม/รายละเอียดกิจกรรม/22.jpg', 'แก้การ์ดให้ตรงฉบับไทย (21.jpg)')
I('ต่ำ', 'อ่านภาพไม่ชัด', "ภาพรวม English Camp ข้อ 3 'Pictionary (…)' ข้อความในวงเล็บอ่านไม่ออก", 'Activity English Camp 1.jpg', 'ทีมยืนยันข้อความในวงเล็บ')
I('กลาง', 'รายชื่อไม่ตรงกัน', "กิจกรรม 'Silence Tale' มีการ์ดรายละเอียด แต่ไม่อยู่ในภาพรวม 23 กิจกรรม", 'English Camp/รายชื่อกิจกรรม', 'ยืนยันว่ายังใช้อยู่ไหม')
I('กลาง', 'รายชื่อไม่ตรงกัน', 'การ์ด STEM 20 กิจกรรม มี 5 รายการที่ไม่อยู่ใน กิจกรรม STEM.docx (เครื่องกดน้ำ, รถไฟฟ้าพลังงานสถิตย์, สว่างไสวด้วยสายน้ำ, ลูกแก้วแสนกล, กาลักน้ำ) และ docx มี 3 รายการที่ไม่อยู่ในการ์ด (Static Electricity Racers, Roller box, Earthquake)', 'STEM Camp/รายชื่อกิจกรรม', 'รวมเป็นรายการเดียว (รถไฟฟ้าพลังงานสถิตย์ อาจ = Static Electricity Racers — ให้ทีมยืนยัน)')
I('ต่ำ', 'ไฟล์ว่าง', "โฟลเดอร์ 'รายชื่อกิจกรรม' ของ Leadership Camp ว่าง", 'Leadership Camp/รายชื่อกิจกรรม', 'เติมรายชื่อกิจกรรม/การ์ด')
for w, why in [('Insect staff', 'อาจหมายถึง Insect stuff/Insect study'), ('You know on not', 'อาจหมายถึง You know or not'), ('Chinese of Crossword', 'อาจหมายถึง Chinese Crossword'),
               ('มหัศจรรย์ของใส', 'ความหมายไม่ชัด (ของเหลว/ของใส?)'), ('Chinese Worlds Quest', 'ไฟล์รายชื่อใช้ Worlds แต่โปรแกรมใช้ Word/World')]:
    I('ต่ำ', 'คำที่อาจพิมพ์ผิด', f"'{w}' — {why}", 'ชื่อกิจกรรม', 'ทีมยืนยันก่อนแก้ (ยังไม่แก้ในข้อมูล)')
for p in photos:
    if p['use'] == 'ห้ามใช้':
        I('สูง', 'ภาพ', f"ภาพ #{p['no']} ({p['id']}) มีลายน้ำเว็บอื่น แต่ยังถูกใส่ในเอกสารอัตโนมัติ: {p['scene']}", '; '.join(p['programs']), 'เอาออกจากชุดภาพของโปรแกรม')
n_chk = [p for p in photos if p['use'] == 'ตรวจสิทธิ์ก่อน']
I('สูง', 'ภาพ', f"ภาพ {len(n_chk)} รูป ลักษณะภาพสต็อก/ภาพโปรโมต/สถานที่ ไม่ใช่ภาพที่ทีมถ่าย: #" + ', #'.join(str(p['no']) for p in n_chk), 'หลายโปรแกรม (ดู 05_photos.csv)', 'ยืนยันสิทธิ์ หรือแทนด้วยภาพค่ายจริง')
n_mask = [p for p in photos if any('หน้ากาก' in f for f in p['flags'])]
I('ต่ำ', 'ภาพ', f"ภาพยุคใส่หน้ากากอนามัย {len(n_mask)} รูป: #" + ', #'.join(str(p['no']) for p in n_mask), 'ดู 05_photos.csv', 'ทยอยแทนด้วยภาพชุดใหม่')
dups = [p for p in photos if p['duplicate_of']]
I('ต่ำ', 'ภาพ', f"ภาพซ้ำ {len(dups)} คู่ (ภาพเดียวกันคนละไฟล์ เช่น Math/Pre-Genius ใช้ภาพชุดเดียวกัน, ITD/Drone ใช้ภาพแท็บเล็ตเดียวกัน)", 'ดูคอลัมน์ ซ้ำกับภาพ', 'เลือกเก็บภาพเดียว')
for r in vrows:
    if r['photos'] == 0 and r['programs']:
        I('กลาง', 'ภาพที่พัก', f"{r['name']} อยู่ในโปรแกรมจริงแต่ไม่มีภาพที่พักในระบบ", '; '.join(sorted(r['programs'])), 'ขอภาพทางการจากโรงแรม 8 รูป (ภายนอก 2 · ห้องพัก 2 · สระ/สิ่งอำนวยความสะดวก 2 · ห้องประชุม 2)')
    elif r['photos'] and r['gap'] != 'ครบ':
        I('ต่ำ', 'ภาพที่พัก', f"{r['name']} ภาพ {r['photos']} รูป ยังไม่ครบมาตรฐาน: {r['gap']}", '', 'เติมภาพให้ครบ 8')
    if r['province'] == 'ไม่ระบุในไฟล์':
        I('กลาง', 'ข้อมูลที่พัก', f"{r['name']} ไฟล์ไม่ระบุจังหวัด", '; '.join(sorted(r['programs'])), 'ทีมยืนยันจังหวัด/พื้นที่')
for n in dump['notion']:
    if n['name'] not in notion_hit:
        I('ต่ำ', 'มาตรฐาน Notion', f"กิจกรรมใน Notion '{n['name']}' ไม่ตรงกับชื่อกิจกรรมในหลักสูตรใด", 'Notion ฐานข้อมูลกิจกรรม STEM', 'ผูกกับหลักสูตร/ตั้งชื่อให้ตรงกัน')
unused = [r for r in mrows if r['in_real'] == 'ไม่พบในโปรแกรมจริง']
coveronly = [r for r in mrows if r['in_real'] == 'เฉพาะหน้าปก']
I('กลาง', 'หน้าปกไม่ตรงกำหนดการ', f"{len(coveronly)} กิจกรรมอยู่บนหน้าปก (กิจกรรมเชิงบูรณาการ) ของไฟล์ต้นฉบับ แต่ไม่มีในกำหนดการ เช่น " + ', '.join(sorted({r['name'] for r in coveronly})[:6]), 'ดู 03_activity_master.csv คอลัมน์ อยู่ในโปรแกรมจริง = เฉพาะหน้าปก', 'เว็บแก้ให้อัตโนมัติแล้ว (กฎ 17 พ.ย.) — ทีมแก้ไฟล์ต้นฉบับให้ตรง')
I('กลาง', 'กิจกรรมที่ไม่เคยลงโปรแกรม', f"{len(unused)} กิจกรรมมีในรายชื่อ/คลัง แต่ไม่อยู่ในโปรแกรมจริงไฟล์ใด", 'ดู 03_activity_master.csv คอลัมน์ อยู่ในโปรแกรมจริง', 'ตัดสินใจ: เก็บไว้เป็นตัวเลือก หรือ ตัดออกจากคลัง')
PRI = {'สูง': 0, 'กลาง': 1, 'ต่ำ': 2}
issues.sort(key=lambda r: (PRI[r['pri']], r['topic']))
for i, r in enumerate(issues, 1): r['no'] = i
wcsv('08_issues_for_team.csv', issues, [('no', 'ลำดับ'), ('pri', 'ความสำคัญ'), ('topic', 'เรื่อง'), ('what', 'รายละเอียด'), ('where', 'อยู่ที่'), ('action', 'สิ่งที่ต้องทำ')])

# ---------- สรุปเพื่อตรวจ ----------
print('programs', len(programs), '(drive files', len(manifest), ')')
print('rows', len(occ), {lv: sum(o['level'] == lv for o in occ) for lv in ('หลัก', 'รอง', 'ย่อย', 'โลจิสติกส์')})
print('unique activities', len(mrows), {lv: sum(r['level'] == lv for r in mrows) for lv in ('หลัก', 'รอง', 'ย่อย')})
print('in schedule/cover-only/none', {k: sum(r['in_real'] == k for r in mrows) for k in ('อยู่ในกำหนดการ', 'เฉพาะหน้าปก', 'ไม่พบในโปรแกรมจริง')})
print('photos', len(photos), {k: sum(p['kind'] == k for p in photos) for k in ('กิจกรรม', 'ที่พัก')}, 'use', {u: sum(p['use'] == u for p in photos) for u in ('ใช้ได้', 'ตรวจสิทธิ์ก่อน', 'ห้ามใช้')})
print('venues', len(vrows), 'with photos', sum(r['photos'] > 0 for r in vrows))
print('notion matched', len(notion_hit), 'of', len(dump['notion']))
