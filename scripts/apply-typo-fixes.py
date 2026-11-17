# -*- coding: utf-8 -*-
"""แก้คำผิด (data/typo-fixes.json) ในไฟล์ข้อมูลที่ generate แล้ว โดยไม่ต้อง regen ภาพ
รัน: python3 scripts/apply-typo-fixes.py   (idempotent — รันซ้ำได้)"""
import json, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
F = json.load(open(os.path.join(ROOT, 'data', 'typo-fixes.json'), encoding='utf-8'))
def fix(s):
    for a, b in F['fixes']: s = s.replace(a, b)
    for p, r in F['regex']: s = re.sub(p, r, s)
    return s
for rel in ['src/course-templates-data.ts', 'src/eqcamp-data.ts', 'src/notion-activities-data.ts', 'data/course-templates.raw.json']:
    p = os.path.join(ROOT, rel); s = open(p, encoding='utf-8').read(); t = fix(s)
    print(f'{rel}: {"แก้แล้ว" if t != s else "ไม่มีคำผิด"}'); open(p, 'w', encoding='utf-8').write(t)
