import json, re, collections
from pythainlp.tokenize import word_tokenize
from pythainlp.corpus import thai_words
D = set(thai_words())
T = json.load(open('/tmp/qa-texts.json'))
COMMON = set('ที่ และ ใน การ ของ ให้ ได้ มี เป็น จาก ด้วย ต่อ แต่ หรือ กับ คน วัน คืน ท่าน มื้อ ชุด ไป มา ทุก ตาม ซึ่ง ไม่ นำ ใช้ ทาง แบบ ต้น ปี ณ ฯ ๆ ตัว อัน ม้วน คู่ ก้อน เส้น แผ่น ขวด ใบ ลูก ถุง กล่อง แท่ง ดวง ชิ้น ผืน ท่อ อย่าง เพื่อ จะ ความ ภาย หลัง ก่อน ถึง แก่ ค่า ราย ฐาน ฝึก ทำ เกม เล่น สร้าง เด็ก ครู ผู้ ร่วม ทั้ง กัน เอง นี้ นั้น ช่วง ตอน รอบ ดู ลง ขึ้น ออก เข้า ห้อง ส่วน กลาง กลุ่ม ทีม จับ วาง ตั้ง ปิด เปิด รับ ส่ง พัก ว่าง เย็น เช้า สาย บ่าย ค่ำ น้ำ ไฟ ลม ดิน ฟ้า ดาว จีน ไทย โลก เรือ รถ คณะ ระดับ ชั้น ป. ม. ฯลฯ'.split())
ctx = collections.defaultdict(collections.Counter)
for x in T:
    for seg in re.findall(r'[฀-๿]+', x['t']):
        toks = word_tokenize(seg, engine='newmm', keep_whitespace=False)
        for i, w in enumerate(toks):
            if len(w) <= 3 and w not in COMMON:
                ctx[w][seg[:40]] += 1
for w in sorted(ctx, key=lambda w: -sum(ctx[w].values())):
    c = ctx[w]
    print(f'{w}\t{sum(c.values())}\t' + ' | '.join(list(c)[:3]))
