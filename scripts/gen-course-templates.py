# -*- coding: utf-8 -*-
"""แม่แบบเอกสารจริงของทีม (Drive: 1C5XXMbaIZa5lhSCxhbGszSCITXn_qQU8) → src/course-templates-data.ts + web/photos/

รัน:  python3 scripts/gen-course-templates.py data/course-templates.raw.json <โฟลเดอร์ภาพต้นฉบับ ph/>
- data/course-templates.raw.json = ผลแกะเอกสาร (ข้อความ+ลำดับหัวข้อ+กำหนดการ+ราคา+งบ+รายการภาพ) จาก extract/tpl/build_ds
- ภาพ: เฉพาะภาพที่อยู่ในไฟล์ PDF/Word ของค่ายนั้น (ไม่ดึงจากเว็บ) → บีบอัด web/photos/<id>.jpg (กว้าง ≤ 860) + t_<id>.jpg (≤ 360)

กฎที่ใช้ (ห้ามเดา):
- ชื่อโรงเรียน/โรงแรมของงานเดิม → ตัวแปร {S}/{V} (ช่วงในวงเล็บ ⟦ ⟧ ตัดทิ้งได้ถ้าบรีฟไม่มีค่า)
- แถวที่ผูกกับสถานที่ (ทัศนศึกษา/เกาะ/อุทยาน ฯลฯ) ติดธง loc → เว็บเตือนถ้าพื้นที่บรีฟไม่ตรงกับพื้นที่แม่แบบ
- แถวที่ต้นฉบับเว้นว่าง (มีแต่เวลา) → ตัดทิ้ง ไม่เติมเอง
- แก้เฉพาะคำผิดที่ชัดเจน (TYPO) — รายการอยู่ด้านล่าง
"""
import sys, json, re, os, io
from PIL import Image

RAW, PH = sys.argv[1], sys.argv[2]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_TS = os.path.join(ROOT, 'src', 'course-templates-data.ts')
OUT_PH = os.path.join(ROOT, 'web', 'photos')
os.makedirs(OUT_PH, exist_ok=True)
T = json.load(open(RAW))

TYPO = [('ํา', 'ำ'), ('ท้กษะ', 'ทักษะ'), ('กิจกรรมมแข่งขัน', 'กิจกรรมแข่งขัน'), ('STROM', 'STORM'),
        ('ของของ', 'ของ'), ('Integretion', 'Integration'), ('จิตสำนัก', 'จิตสำนึก'), (' ', ' ')]
def fix(s):
    for a, b in TYPO: s = s.replace(a, b)
    return re.sub(r'[ \t]+', ' ', s).strip()

def tidy(t):  # เหมือน tidyTitle() ใน core: เครื่องหมายคำพูดไทย “ ” ไม่มีช่องว่างเกิน
    n = [0]
    def q(_):
        n[0] += 1
        return '“' if n[0] % 2 == 1 else '”'
    s = re.sub(r'"', q, t)
    s = re.sub(r'“\s+', '“', s); s = re.sub(r'\s+”', '”', s)
    s = re.sub(r'([^\s(])“', r'\1 “', s); s = re.sub(r'”(?=[^\s.,)])', '” ', s)
    s = re.sub(r'\s*EP\.\s*(\d+)', r' EP.\1', s, flags=re.I)
    return re.sub(r'\s{2,}', ' ', s).strip()

SCHOOLS = ['โรงเรียนกาญจนาภิเษกวิทยาลัย สุพรรณบุรี', 'โรงเรียนดอนเมืองทหารอากาศบำรุง', 'โรงเรียนสิงห์สมุทร', 'โรงเรียนเลยพิทยาคม จังหวัดเลย',
           'โรงเรียนเลยพิทยาคม', 'โรงเรียนบ้านสวน(จั่นอนุสรณ์)', 'โรงเรียนสายธรรมจันทร์', 'โรงเรียนหนองแค “สรกิจพิทยา”', 'โรงเรียนชะอวดวิทยาคาร',
           'โรงเรียนชะอวด', 'โรงเรียนสิงห์บุรี', 'โรงเรียนวัดราชบพิธ', 'โรงเรียนธรรมวิทยามูลนิธิ', 'โรงเรียนสมุทรปราการ',
           'โรงเรียน จังหวัดนครราชสีมา', 'โรงเรียนตะกั่วป่า “เสนานุกูล”', 'โรงเรียนเทศบาล 2 (วัดชนาธิปเฉลิม)']
# โรงแรมในแม่แบบ → จังหวัด (เฉพาะที่ยืนยันได้จากเอกสาร/ชื่อสถานที่จริง; ไม่รู้ = '')
VENUE_AREA = {
    'Kiangtalay Resort Rayong': 'ระยอง', 'Aurora Resort Kanchanaburi': 'กาญจนบุรี', 'ออโรร่า รีสอร์ท กาญจนบุรี': 'กาญจนบุรี',
    'Fountain Tree Resort': 'นครราชสีมา', 'Chiangkhan River Mountain Resort.': 'เลย', 'Chiangkhan River Mountain Resort': 'เลย',
    'Phumork Village Khao Kho': 'เพชรบูรณ์', 'BCP Hotel Rayong': 'ระยอง', 'Bella Villa Cabana Pattaya.': 'ชลบุรี',
    'Bella Villa Cabana Pattaya': 'ชลบุรี', 'Kasalong Resort and Spa': 'ชลบุรี', 'Khanom Sunrise Beach Resort': 'นครศรีธรรมราช',
    'The Flora May Resort.': '', 'The Flora May Resort': '', 'โรงแรมจันทรา รีสอร์ท': '', 'Fortune Hotel Korat': 'นครราชสีมา',
    'Loei Palace Hotel': 'เลย'}
VENUES = sorted(VENUE_AREA, key=len, reverse=True)
OVERNIGHT = re.compile(r'รับประทานอาหารเช้า|รับประทานอาหารเย็น|เช็คอิน|Check ?In|เช็คเอาท์|Check ?Out|พักผ่อนฝันดี', re.I)
LOC = re.compile(r'ทัศนศึกษา|แหล่งเรียนรู้ ณ|อุทยาน|ฟาร์ม|พิพิธภัณฑ์|ถ้ำ|เกาะ|ท่าเรือ|ท่าเทียบเรือ|ด้วยเรือ|ดำน้ำ|ปะการัง|สถาบันวิทยาศาสตร์ทางทะเล|ทางรถไฟ')

def subst(s, found):
    s = s.replace('จาก โรงเรียน', 'จากโรงเรียน').replace('กลับ โรงเรียน', 'กลับโรงเรียน')
    s = s.replace('เดินทางออกจากโรงเรียน ไปยัง จังหวัด นครราชสีมา', 'เดินทางออกจาก{S}⟦ ไปยังจังหวัด{P}⟧')
    for sc in sorted(SCHOOLS, key=len, reverse=True):
        if sc in s: s = s.replace(sc, '{S}'); found['school'] = True
    for v in VENUES:
        if v in s:
            found.setdefault('venues', set()).add(v)
            def rep(m):
                pre = m.group(1) or ''
                if 'ณ' in pre: return '⟦' + pre.rstrip() + ' {V}⟧'
                if 'ที่พัก' in pre: return pre.rstrip() + '⟦ {V}⟧'
                return '⟦ {V}⟧'
            s = re.sub(r'((?:\s*ถึง)?\s*ณ\s*|\s*ที่พัก\s+)?' + re.escape(v), rep, s)
    return re.sub(r'\s{2,}', ' ', s).strip()

def norm_items(items, numbered_hint):
    """ตัดเลขนำ, รวมบรรทัดที่ขึ้นบรรทัดใหม่กลางข้อ (ไม่มีเลข) เข้าข้อก่อนหน้า"""
    has_num = any(re.match(r'^\s*\d+\s*[.)]', x) for x in items)
    out = []
    for x in items:
        x = fix(x)
        if not x: continue
        m = re.match(r'^\s*\d+\s*[.)]\s*(.*)$', x)
        if m: out.append(m.group(1).strip())
        elif has_num and out: out[-1] = out[-1] + ' ' + x
        else: out.append(x)
    return out

def kijakam(x):
    x = tidy(x)
    x = re.sub(r'^กิจกรรม(?=[A-Za-z“])', 'กิจกรรม ', x)
    if x.startswith('กิจกรรม'): return x
    if x.startswith('กระบวนการกิจกรรม'): return 'กิจกรรม' + x[len('กระบวนการกิจกรรม'):]
    return 'กิจกรรม' + x

def cur_year_title(t):
    return re.sub(r'\b20\d\d\b', '{Y}', t)

photos_used, venue_sets = {}, {}
out = []
for code in sorted(T):
    for dk in sorted(T[code]):
        for t in T[code][dk]:
            found = {}
            titles = [cur_year_title(fix(tidy(x))) for x in t['titles']][:2]
            secs = []
            for s in t['sections']:
                h = s['h']
                if h == '_info':
                    secs.append({'k': 'info', 'label': fix(s['label'])})
                    if s['label'].startswith('สถานที่'):
                        for v in VENUES:
                            if v in s['value']: found.setdefault('venues', set()).add(v)
                        if 'ชลบุรี' in s['value']: found['areaText'] = 'ชลบุรี'
                    continue
                if h == '_text':
                    continue   # บรรทัดต่อของ "จำนวน" (คุณครู … รวม … คน) — บรีฟแทนที่ทั้งหมด
                hh = fix(re.sub(r'\s+', ' ', h))
                if re.match(r'^(การ)?บูรณาการการเรียน', hh):
                    secs.append({'k': 'list', 'h': 'บูรณาการการเรียน (Instruction Integration)', 'items': norm_items(s['items'], True)})
                elif hh.startswith('กิจกรรมเชิงบูรณาการ'):
                    secs.append({'k': 'list', 'h': 'กิจกรรมเชิงบูรณาการ', 'acts': True, 'items': [kijakam(x) for x in norm_items(s['items'], True)]})
                elif hh.startswith('วัตถุประสงค์'):
                    secs.append({'k': 'list', 'h': hh, 'items': norm_items(s['items'], True)})
                elif hh.startswith('หลักการและเหตุผล'):
                    secs.append({'k': 'para', 'h': hh, 'items': [fix(x) for x in s['items'] if fix(x)]})
                else:
                    secs.append({'k': 'bullets', 'h': hh, 'items': [fix(x) for x in s['items'] if fix(x)]})
            # กำหนดการ
            days, dropped = [], []
            for d in t['days']:
                rows = []
                for r in d['rows']:
                    title = subst(fix(tidy(r['title'])), found)
                    if not title:
                        dropped.append(f"วันที่ {d['day']} {r['time']} (ต้นฉบับไม่มีชื่อรายการ)"); continue
                    if dk.startswith('day') and OVERNIGHT.search(title):   # ค่ายไป-กลับห้ามมีรายการพักค้าง (กฎเหล็กข้อ 3)
                        dropped.append(f"วันที่ {d['day']} {r['time']} {title} (ค่ายไป-กลับ)"); continue
                    subs = [subst(fix(tidy(x)), found) for x in r['subs']]
                    row = {'t': r['time'], 'x': title}
                    subs = [x for x in subs if x]
                    if subs: row['s'] = subs
                    if LOC.search(title) or any(LOC.search(x) for x in subs): row['loc'] = 1
                    rows.append(row)
                # แถวเดินทางกลับที่เวลาซ้ำกับแถวก่อนหน้า (พิมพ์ซ้ำในต้นฉบับ) → "<เวลาจบ> น. เป็นต้นไป"
                if len(rows) >= 2 and rows[-1]['x'].startswith('เดินทางกลับ') and rows[-1]['t'] == rows[-2]['t']:
                    ends = re.findall(r'(\d{1,2}\.\d{2})', rows[-2]['t'])
                    if ends: rows[-1]['t'] = ends[-1] + ' น. เป็นต้นไป'
                days.append(rows)
            for s in secs:
                if s.get('acts'):
                    s['loc'] = [i for i, x in enumerate(s['items']) if LOC.search(x)]
            for s in t['schedHead']:
                subst(fix(s), found)
            budget = [subst(fix(x), found) for x in t['budget'] if fix(x)]
            areas = sorted(set(VENUE_AREA[v] for v in found.get('venues', set()) if VENUE_AREA[v]) | ({found['areaText']} if found.get('areaText') else set()))
            # ภาพกิจกรรม: ของไฟล์นี้ก่อน (ไม่เกิน 8) — ถ้า < 6 เติมจากไฟล์อื่นของค่ายเดียวกันให้ถึง 6
            own = list(dict.fromkeys(t['photos']))[:8]
            photos = list(own)
            if len(photos) < 6:
                for dk2 in sorted(T[code]):
                    for t2 in T[code][dk2]:
                        for h in t2['photos']:
                            if len(photos) < 6 and h not in photos: photos.append(h)
            for h in photos: photos_used[h] = True
            ven = None
            for vname, hs in t['venuePhotos'].items():
                nm = re.sub(r'^(ภาพ)?ที่พัก\s*', '', vname).strip().rstrip('.')
                venue_sets.setdefault(nm, {'name': nm, 'province': VENUE_AREA.get(nm, VENUE_AREA.get(nm + '.', '')), 'photos': [], 'source': t['source']})
                for h in hs:
                    if h not in venue_sets[nm]['photos']: venue_sets[nm]['photos'].append(h)
                ven = nm
            pr = t.get('price') or None
            item = {'id': t['source'], 'code': code, 'dur': dk, 'variant': t['variant'], 'source': t['source'],
                    'titles': titles, 'secs': secs, 'days': days, 'budget': budget, 'photos': photos, 'ownPhotos': len(own),
                    'area': areas}
            if pr and pr.get('normal') and pr.get('special'): item['price'] = {'n': pr['normal'], 's': pr['special']}
            if ven: item['venue'] = ven
            if dropped: item['dropped'] = dropped
            out.append(item)

# ภาพ → web/photos
meta = {}
def save(h, big=True):
    im = Image.open(os.path.join(PH, h + '.jpg')).convert('RGB')
    w, hh = im.size
    a = im.copy(); a.thumbnail((860, 860 * 3)); a.save(os.path.join(OUT_PH, h + '.jpg'), quality=78, optimize=True, progressive=True)
    b = im.copy(); b.thumbnail((360, 360 * 3)); b.save(os.path.join(OUT_PH, 't_' + h + '.jpg'), quality=72, optimize=True, progressive=True)
    meta[h] = [a.size[0], a.size[1]]
for h in photos_used: save(h)
for v in venue_sets.values():
    for h in v['photos']: save(h)

ts = ['// AUTO-GENERATED by scripts/gen-course-templates.py — อย่าแก้ด้วยมือ (แก้ที่เอกสารต้นฉบับใน Drive แล้วรันใหม่)',
      '// แม่แบบโปรแกรมจริงของทีม 14 หลักสูตร × ระยะเวลา (ครึ่งวัน/1–2 วัน/2 วัน 1 คืน/3 วัน 2 คืน) + ภาพจากไฟล์ของค่ายนั้นเท่านั้น',
      '// ตัวแปรในข้อความ: {S}=โรงเรียน {V}=ที่พัก {P}=จังหวัด {Y}=ปี ค.ศ. ของค่าย · ⟦…⟧ = ตัดทิ้งได้ถ้าบรีฟไม่มีค่า',
      'export interface TplRow { t: string; x: string; s?: string[]; loc?: 1 }',
      "export interface TplSec { k: 'list' | 'para' | 'bullets' | 'info'; h?: string; label?: string; items?: string[]; acts?: boolean; loc?: number[] }",
      'export interface CourseTemplate { id: string; code: string; dur: string; variant: string; source: string; titles: string[]; secs: TplSec[]; days: TplRow[][]; budget: string[]; photos: string[]; ownPhotos: number; area: string[]; price?: { n: number; s: number }; venue?: string; dropped?: string[] }',
      'export const TEMPLATES: CourseTemplate[] = ' + json.dumps(out, ensure_ascii=False) + ';',
      'export const PHOTO_META: Record<string, [number, number]> = ' + json.dumps(meta) + ';',
      'export const VENUE_PHOTOS: { name: string; province: string; photos: string[]; source: string }[] = ' + json.dumps(list(venue_sets.values()), ensure_ascii=False) + ';', '']
open(OUT_TS, 'w').write('\n'.join(ts))
tot = sum(os.path.getsize(os.path.join(OUT_PH, f)) for f in os.listdir(OUT_PH))
print('templates', len(out), 'photos', len(meta), 'web/photos MB', round(tot / 1e6, 1), 'ts KB', os.path.getsize(OUT_TS) // 1000)
