import json, re, collections
from pythainlp.tokenize import word_tokenize
from pythainlp.corpus import thai_words
D = set(thai_words())
T = json.load(open('/tmp/qa-texts.json'))
cnt = collections.Counter(); where = {}
# structural anomalies
pat = [(r'([่-๋])[่-๋]', 'double tone'), (r'เเ', 'sara-e x2'), (r'ํา', 'nikhahit+aa'), (r'([ัิ-ฺ็-๎])\1', 'dup mark'), (r'^[ะ-ฺ็-๎]', 'lead mark'), (r' [ะ-ฺ็-๎]', 'mark after space')]
anom = collections.defaultdict(set)
for x in T:
    s = x['t']
    for p, n in pat:
        if re.search(p, s): anom[n].add((x['src'], s[:90]))
    for seg in re.findall(r'[฀-๿]+', s):
        for w in word_tokenize(seg, engine='newmm', keep_whitespace=False):
            if len(w) >= 2 and w not in D:
                cnt[w] += 1; where.setdefault(w, (x['src'], s[:80]))
for n, v in anom.items():
    print('==', n, len(v))
    for a in list(v)[:12]: print('   ', a)
print('== unknown tokens', len(cnt))
for w, c in sorted(cnt.items(), key=lambda z: -z[1]):
    print(f'{c:4} {w}\t{where[w][0]}\t{where[w][1]}')
