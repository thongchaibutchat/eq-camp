#!/usr/bin/env python3
"""สร้าง src/venue-catalog-data.ts จาก data/activity-catalog/out/eqcamp-catalog.json
= รายชื่อที่พัก/สถานที่จัดงานที่ทีมเคยใช้ (19) + ภาพแยกหมวดตามมาตรฐานทีม
  ป้าย/มุมสูง (ภายนอก+ล็อบบี้) · ห้องพัก · สระ/สิ่งอำนวยความสะดวก (สระ/ห้องอาหาร/อื่น ๆ) · ห้องประชุม
เฉพาะภาพที่ทีมติดป้าย "ใช้ได้"/"ตรวจสิทธิ์" (ภาพ "ห้ามใช้" ไม่เอา) — ไม่มีราคา/ต้นทุน/เบอร์ติดต่อใหม่
ใช้: python3 scripts/catalog/gen-venue-data.py [catalog.json] [out.ts]"""
import json, sys

src = sys.argv[1] if len(sys.argv) > 1 else 'data/activity-catalog/out/eqcamp-catalog.json'
out = sys.argv[2] if len(sys.argv) > 2 else 'src/venue-catalog-data.ts'
d = json.load(open(src, encoding='utf8'))

CAT = {'venue_exterior': 'ext', 'venue_lobby': 'ext', 'venue_room': 'room', 'venue_pool': 'fac', 'venue_dining': 'fac', 'venue_facility': 'fac', 'venue_meeting': 'meet'}
ORDER = ['ext', 'room', 'fac', 'meet']
photos = {}
for p in d['photos']:
    if p.get('kind') != 'ที่พัก' or not p.get('venue'): continue
    if p.get('use') == 'ห้ามใช้' or p.get('duplicate_of'): continue
    c = CAT.get(p.get('session'), 'fac')
    photos.setdefault(p['venue'], []).append({'id': p['id'], 'c': c, 's': p.get('scene', ''), **({'chk': 1} if p.get('use') == 'ตรวจสิทธิ์' else {})})

rows = []
for v in d['venues']:
    ph = sorted(photos.get(v['name'], []), key=lambda x: ORDER.index(x['c']))
    prov = '' if v.get('province') in ('ไม่ระบุในไฟล์', None) else v['province']
    rows.append({'name': v['name'], 'province': prov, 'area': v.get('area') or '', 'courses': v.get('courses') or [], 'progs': len(v.get('programs') or []), 'photos': ph})
rows.sort(key=lambda r: (-len(r['photos']), r['province'] or 'ฮ', r['name']))
ts = ['// สร้างอัตโนมัติจาก data/activity-catalog/out/eqcamp-catalog.json ด้วย scripts/catalog/gen-venue-data.py — ห้ามแก้มือ',
      '// ที่พัก/สถานที่จัดงานที่ทีมเคยใช้ + ภาพแยกหมวด c: ext ป้าย/มุมสูง · room ห้องพัก · fac สระ/สิ่งอำนวยความสะดวก · meet ห้องประชุม · chk = ภาพรอตรวจสิทธิ์',
      "export type VenuePhotoCat = 'ext' | 'room' | 'fac' | 'meet';",
      'export interface VenueCat { name: string; province: string; area: string; courses: string[]; progs: number; photos: { id: string; c: VenuePhotoCat; s: string; chk?: 1 }[] }',
      'export const VENUE_CAT: VenueCat[] = [']
for r in rows: ts.append('  ' + json.dumps(r, ensure_ascii=False) + ',')
ts.append('];')
open(out, 'w', encoding='utf8').write('\n'.join(ts) + '\n')
print(len(rows), 'venues,', sum(len(r['photos']) for r in rows), 'photos →', out)
