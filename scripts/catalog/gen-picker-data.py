#!/usr/bin/env python3
"""สร้าง src/activity-catalog-data.ts จาก data/activity-catalog/out/eqcamp-catalog.json
= รายชื่อกิจกรรมไม่ซ้ำต่อหลักสูตร (392) สำหรับหน้า "เลือกกิจกรรมเข้าโปรแกรม" แยกหมวด
ใช้ชื่อ/ระดับ/หมวด/นาที ตามต้นฉบับเท่านั้น (ไม่เติม ไม่เดา) — ไม่มีราคา/ต้นทุน
ใช้: python3 scripts/catalog/gen-picker-data.py [catalog.json] [out.ts]"""
import json, sys, hashlib, re

src = sys.argv[1] if len(sys.argv) > 1 else 'data/activity-catalog/out/eqcamp-catalog.json'
out = sys.argv[2] if len(sys.argv) > 2 else 'src/activity-catalog-data.ts'
d = json.load(open(src, encoding='utf8'))

def group(level, cat):
    cats = [c.strip() for c in (cat or '').split(';') if c.strip()]
    has = lambda k: any(k in c for c in cats)
    if level == 'ย่อย': return 'sub'
    if has('ภาคสนาม'): return 'field'
    if level == 'หลัก':
        if has('ภาคค่ำ') and not has('ฐาน'): return 'night'
        if cats and all('ภาคค่ำ' in c for c in cats): return 'night'
        return 'learn'
    # รอง
    if has('สรุป'): return 'sum'
    if has('พิธีเปิด'): return 'open'
    if has('ภาคค่ำ'): return 'night'
    if has('สันทนาการ'): return 'rec'
    return 'rec'

def num(x):
    m = re.match(r'\s*(\d+)', str(x or ''))
    return int(m.group(1)) if m else 0

detail = {}
for x in d.get('driveLists', []):
    dt = (x.get('detail') or '').strip()
    if not dt: continue
    try:
        o = json.loads(dt)
        if isinstance(o, dict):   # {"learn","level","hours","place"} จากเอกสารรายชื่อกิจกรรมของทีม
            dt = ' · '.join(v for v in [('เรียนรู้ ' + o['learn'].replace(',', ', ')) if o.get('learn') else '', o.get('level', ''), o.get('hours', '')] if v)
    except Exception: pass
    if dt: detail[(x['code'], x['name'].strip().lower())] = dt

# คำผิดที่ทีมยืนยันแล้ว (รายการกลาง data/typo-fixes.json) — แก้ตอนสร้างเหมือนแม่แบบ
try:
    _tf = json.load(open('data/typo-fixes.json', encoding='utf8'))
    FIXES = [tuple(x) for x in _tf.get('fixes', [])]; RX = [(re.compile(a), b) for a, b in _tf.get('regex', [])]
except Exception:
    FIXES, RX = [], []
def fix(t):
    for a, b in FIXES: t = t.replace(a, b)
    for r, b in RX: t = r.sub(b, t)
    return t
for k in list(detail): detail[k] = fix(detail[k])

# ฐานกิจกรรม Station (หมุนเวียน) ตามเอกสารรายชื่อกิจกรรมของทีม — กลุ่มที่ชื่อมีคำว่า Station
station = {}
for x in d.get('driveLists', []):
    if 'Station' in (x.get('group') or ''):
        station.setdefault(x['code'], []).append((fix(x['name'].strip()), x['group'].strip()))
st_names = {c: {n.lower(): g for n, g in v} for c, v in station.items()}
_k = lambda s: re.sub(r'[\s\W_]+', '', s.lower())
def st_group(code, name):
    m = st_names.get(code) or {}
    k = _k(name)
    for n, g in m.items():
        if len(_k(n)) >= 3 and (_k(n) == k or (_k(n) in k and len(k) - len(_k(n)) <= 3)): return g
    return None

rows, seen = [], set()
for a in d['activities']:
    name = fix((a.get('name') or '').strip())
    if not name: continue
    key = (a['code'], name)
    if key in seen: continue
    seen.add(key)
    hid = 'cat-' + hashlib.sha1(f"{a['code']}|{name}".encode('utf8')).hexdigest()[:10]
    alt = [fix(s.strip()) for s in (a.get('alt') or '').split(';') if s.strip() and s.strip() != name][:4]
    rr = {'อยู่ในกำหนดการ': 'S', 'เฉพาะหน้าปก': 'C'}.get(a.get('in_real', ''), 'N')
    item = {'i': hid, 'c': a['code'], 'n': name, 'g': group(a.get('level'), a.get('category')), 'l': {'หลัก': 'H', 'รอง': 'R', 'ย่อย': 'S'}.get(a.get('level'), 'H'),
            'm': num(a.get('minutes')), 'r': rr, 'p': int(a.get('progs') or 0)}
    if alt: item['a'] = alt
    sg = st_group(a['code'], name)
    if sg and item['l'] != 'R':
        item['g'] = 'station'
        if not detail.get((a['code'], name.lower())): detail[(a['code'], name.lower())] = f'ฐานหมุนเวียนใน{sg.replace("กิจกรรม ", "ช่วงกิจกรรม ")} (ตามเอกสารรายชื่อกิจกรรมของทีม)'
    elif 'Station' in name and station.get(a['code']) and not re.search(r'Creative Learning|สรุป', name) and item['l'] == 'H':
        sci, mat = re.search(r'Science|วิทย์', name), re.search(r'Math|คณิต', name)
        lst = [n for n, g in station[a['code']] if (not sci or 'วิทยาศาสตร์' in g or (mat and 'คณิต' in g)) and (not mat or sci or 'วิทยาศาสตร์' not in g)]
        if lst: detail.setdefault((a['code'], name.lower()), 'ฐานที่หมุนเวียน ' + str(len(lst)) + ' ฐาน: ' + ', '.join(lst))
    dt = detail.get((a['code'], name.lower()))
    if dt: item['d'] = dt[:240]
    rows.append(item)

courses = [{'c': c['code'], 'label': c['label'], 'name': c['name']} for c in d['courses']]
ts = ['// สร้างอัตโนมัติจาก data/activity-catalog/out/eqcamp-catalog.json ด้วย scripts/catalog/gen-picker-data.py — ห้ามแก้มือ',
      '// กิจกรรมไม่ซ้ำต่อหลักสูตร (ชื่อ/ระดับ/หมวด/นาที ตามต้นฉบับ) · g = หมวด · l = ระดับ H หลัก / R รอง / S ย่อย · m = นาทีมัธยฐาน (0 = ไม่ระบุ)',
      '// r = อยู่ในโปรแกรมจริง S กำหนดการ / C เฉพาะหน้าปก / N ไม่พบ · p = จำนวนโปรแกรมจริงที่ใช้',
      'export interface CatAct { i: string; c: string; n: string; g: CatGroup; l: \'H\' | \'R\' | \'S\'; m: number; r: \'S\' | \'C\' | \'N\'; p: number; a?: string[]; d?: string }',
      "export type CatGroup = 'learn' | 'field' | 'night' | 'rec' | 'open' | 'sum' | 'sub' | 'station';",
      f'export const CAT_GENERATED = {json.dumps(d.get("generated", ""))};',
      f'export const CAT_COURSES: {{ c: string; label: string; name: string }}[] = {json.dumps(courses, ensure_ascii=False)};',
      'export const CAT_ACTS: CatAct[] = [']
for r in rows: ts.append('  ' + json.dumps(r, ensure_ascii=False) + ',')
ts.append('];')
open(out, 'w', encoding='utf8').write('\n'.join(ts) + '\n')
from collections import Counter
print(len(rows), 'activities →', out, dict(Counter(r['g'] for r in rows)))
