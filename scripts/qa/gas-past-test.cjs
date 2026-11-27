// คลังงานเก่าในศูนย์กลาง (รันโค้ด Apps Script จริงในเครื่องจำลอง): สแกนโฟลเดอร์ · รายการ · แตกข้อความ Word · สิทธิ์ · สแกนต่อจากจุดเดิม
// รัน: node scripts/qa/gas-past-test.cjs <Code.gs ที่สร้างพร้อมรหัสเจ้าของ> <document.xml จาก past-docxml.ts>
const fs = require('fs');
const { makeHub } = require('./gas-env.cjs');
const code0 = fs.readFileSync(process.argv[2], 'utf8').replace(/const PAST_FOLDER = '[^']*';/, "const PAST_FOLDER = 'ROOT';");
const XML = fs.readFileSync(process.argv[3], 'utf8');
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const TBL = '<w:document><w:body><w:p><w:r><w:t>กำหนดการ</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>08.00 – 09.00 น.</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t xml:space="preserve">กิจกรรม &quot;A&quot; &amp; B</w:t></w:r></w:p><w:p><w:r><w:t>- ย่อย 1</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:p><w:r><w:t>ราคา</w:t></w:r><w:r><w:tab/><w:t>990</w:t></w:r></w:p><w:sectPr/></w:body></w:document>';
const drive = () => ({
  folders: {
    ROOT: { name: '2569', folders: ['J1', 'J2', 'J3', 'J4'] },
    J1: { name: '691204 English Camp โรงเรียนตัวอย่าง 3 วัน 2 คืน', files: ['F1', 'F2', 'F3'], folders: ['S1'] },
    S1: { name: 'ภาพ', files: ['F9'] },
    J2: { name: '691114 บริษัท ตัวอย่าง จำกัด Team Building', files: ['F4'] },
    J3: { name: '691120 STEM Camp ตัวอย่างวิทยาคาร', files: ['F5', 'F7'] },
    J4: { name: '691201 Math Camp ตัวอย่าง', files: [] }
  },
  files: {
    F1: { name: 'English Camp ตัวอย่าง.docx', mime: DOCX, entries: [{ name: '[Content_Types].xml', data: '<x/>' }, { name: 'word/document.xml', data: XML }] },
    F2: { name: 'English Camp ตัวอย่าง.pdf', mime: 'application/pdf' },
    F3: { name: 'ยืนยัน ใบเสนอราคา English.pdf', mime: 'application/pdf' },
    F4: { name: 'Team Building.pdf', mime: 'application/pdf' },
    F5: { name: 'STEM ตาราง.docx', mime: DOCX, entries: [{ name: 'word/document.xml', data: TBL }] },
    F7: { name: 'STEM ภาพ.docx', mime: DOCX, entries: [
      { name: 'word/document.xml', data: '<w:document><w:body><w:p><w:r><w:t>กำหนดการ</w:t></w:r></w:p><w:p><w:r><w:t>ตัวอย่างภาพบรรยากาศที่พัก Kasalong Resort</w:t></w:r></w:p><w:p><w:r><w:drawing><a:blip r:embed="rId7"/></w:drawing></w:r><w:r><w:drawing><a:blip r:embed="rId8"/></w:drawing></w:r></w:p><w:p><w:r><w:t>รถบัสปรับอากาศ 2 ชั้น</w:t></w:r></w:p><w:p><w:r><w:drawing><a:blip r:embed="rId9"/></w:drawing></w:r></w:p><w:p><w:r><w:drawing><a:blip r:embed="rId7"/></w:drawing></w:r></w:p><w:sectPr/></w:body></w:document>' },
      { name: 'word/_rels/document.xml.rels', data: '<Relationships><Relationship Id="rId7" Type="image" Target="media/image1.jpeg"/><Relationship Id="rId8" Type="image" Target="media/image2.png"/><Relationship Id="rId9" Type="image" Target="/word/media/image3.jpg"/><Relationship Id="rId2" Type="styles" Target="styles.xml"/></Relationships>' },
      { name: 'word/media/image1.jpeg', data: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]) },
      { name: 'word/media/image2.png', data: Buffer.from([0x89, 0x50, 0x4e, 0x47]) },
      { name: 'word/media/image3.jpg', data: Buffer.from([0xff, 0xd8, 9, 9]) }] },
    F9: { name: 'ภาพ 1.jpg', mime: 'image/jpeg' },
    OUT: { name: 'ไฟล์นอกคลัง.docx', mime: DOCX, entries: [{ name: 'word/document.xml', data: XML }] }
  }
});
let fail = 0; const ok = (n, c, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' ' + String(x).slice(0, 400))); if (!c) fail++; };
const setup = (opt = {}) => {
  const H = makeHub(code0, { drive: drive(), ...opt });
  const TEAM = (code0.match(/const TEAM_KEY = '([^']+)'/) || [])[1], OWN = (code0.match(/const OWNER_CODE = '([^']*)'/) || [])[1];
  const as = (key, dev = 'd-x') => (op, b = {}) => H.handle({ ...b, op, key, dev, dl: 'Mac · Safari' });
  const shared = as(TEAM, 'd-sh'); const cl = shared('admin.claim', { owner: OWN }); const ADM = as(cl.key, 'd-adm');
  const TATA = as(ADM('members.key', { id: 'tata' }).key, 'd-tata');
  return { H, ADM, TATA, shared };
};
// 1) สิทธิ์ + สแกน
{ const { H, ADM, TATA, shared } = setup();
  ok('list before scan = empty', TATA('past.list').folders.length === 0);
  ok('member cannot scan', TATA('past.scan').error === 'forbidden');
  const a0 = TATA('rev').areas.past;
  const s1 = ADM('past.scan'); ok('admin scan: 4 folders', s1.ok && s1.n === 4 && s1.changed === 4 && !s1.left, JSON.stringify(s1));
  ok('daily trigger installed once', H.triggers.filter(t => t.getHandlerFunction() === 'pastDaily').length === 1);
  ok('area past bumped', TATA('rev').areas.past !== a0);
  const L = TATA('past.list').folders; const j1 = L.find(f => f.id === 'J1');
  ok('list: files incl. subfolder prefixed', j1 && j1.files.length === 4 && j1.files.some(f => f.n === 'ภาพ/ภาพ 1.jpg') && j1.files.find(f => f.id === 'F1').m === DOCX, JSON.stringify(j1));
  ok('shared link can list (member)', shared('past.list').ok);
  const s2 = ADM('past.scan'); ok('rescan unchanged → 0 changed', s2.ok && s2.changed === 0, JSON.stringify(s2));
  H.drive.folders.J4.name = '691201 Math Camp ตัวอย่าง (แก้ชื่อ)'; H.drive.folders.ROOT.folders.push('J5'); H.drive.folders.J5 = { name: '691230 ใหม่', files: [] };
  const s3 = ADM('past.scan'); ok('rename + new → 2 changed, no duplicate', s3.changed === 2 && TATA('past.list').folders.length === 5, JSON.stringify(s3));
  // 2) ข้อความ Word
  const t1 = TATA('past.text', { fileId: 'F1' });
  ok('text: docx in index', t1.ok && /English Camp/.test(t1.text) && /วัตถุประสงค์/.test(t1.text), JSON.stringify(t1).slice(0, 200));
  ok('text: schedule rows keep time + tab + title', /^\d{2}\.\d{2}[^\n]*\t[^\n]*Warm up/m.test(t1.text), t1.text.slice(0, 600));
  ok('text: no XML left', !/<w:|&amp;|&lt;/.test(t1.text));
  fs.writeFileSync('/tmp/eq-past-text.txt', t1.text);   // ให้ past-parse-test อ่านต่อ (ไฟล์ Word → ข้อความจากศูนย์กลาง → ตัวอ่าน)
  const reads = H.driveReads(); const t2 = TATA('past.text', { fileId: 'F1' });
  ok('text: cached second time (no Drive read)', t2.cached && H.driveReads() === reads);
  ok('text: pdf refused', TATA('past.text', { fileId: 'F2' }).error === 'type');
  ok('text: file outside index refused (no arbitrary Drive read)', TATA('past.text', { fileId: 'OUT' }).error === 'missing' && TATA('past.text', {}).error === 'missing');
  const tb = TATA('past.text', { fileId: 'F5' }).text;
  ok('text: table row → cells joined by tab + extra paragraphs + entities', tb === 'กำหนดการ\n08.00 – 09.00 น.\tกิจกรรม "A" & B\n- ย่อย 1\nราคา\t990', JSON.stringify(tb));
  ok('audit: scan logged', (H.files.HUB1.getSheetByName('Audit')._g || []).some(r => r.includes('สแกนคลังงานเก่า')));
}
// 3) สแกนต่อจากจุดเดิม (งบเวลา 20 วิ) — นาฬิกาเร่ง
{ const { H, ADM, TATA } = setup({ fastClock: 8000 });
  let r = ADM('past.scan'), k = 0; const first = r.left;
  while (r.ok && r.left && k++ < 20) r = ADM('past.scan');
  ok('resumable scan: stops early then completes', first === true && r.ok && !r.left && TATA('past.list').folders.length === 4, JSON.stringify(r));
  ok('resumable scan: no duplicate rows', new Set(TATA('past.list').folders.map(f => f.id)).size === 4);
}
// 5) ล็อกเฉพาะการสแกน — สแกนค้างอยู่ ทีมยังบันทึกงานได้ · สแกนซ้อน = busy · ค้างเกิน 6 นาที = ปล่อย
{ const { H, ADM, TATA } = setup();
  H.props.pastRun = String(Date.now());
  ok('scan running → 2nd scan busy', ADM('past.scan').error === 'busy');
  const jp = TATA('job.put', { job: { id: 'jx', name: 'ระหว่างสแกน', snap: { camp: { school: 'รร.ทดสอบ' } } } });
  ok('scan running → team job save still works', jp.ok, JSON.stringify(jp));
  H.props.pastRun = String(Date.now() - 7 * 60000);
  const r = ADM('past.scan'); ok('stale scan lock (7 min) released', r.ok && r.n === 4, JSON.stringify(r));
  ok('scan lock cleared after scan', !H.props.pastRun);
  H.fn.pastDaily(); ok('pastDaily clears scan lock', !H.props.pastRun);
}
// 4) ไม่ได้ตั้งโฟลเดอร์
{ const H = makeHub(fs.readFileSync(process.argv[2], 'utf8').replace(/const PAST_FOLDER = '[^']*';/, "const PAST_FOLDER = '';")); const T = (code0.match(/const TEAM_KEY = '([^']+)'/) || [])[1], O = (code0.match(/const OWNER_CODE = '([^']*)'/) || [])[1];
  const cl = H.handle({ op: 'admin.claim', owner: O, key: T, dev: 'a' }); const r = H.handle({ op: 'past.scan', key: cl.key, dev: 'a' });
  ok('no PAST_FOLDER → nopast', r.error === 'nopast', JSON.stringify(r)); }
// รุ่น 15: ภาพในไฟล์ Word ของงานเก่า (รายการ + หัวข้อก่อนหน้า + อ่านทีละภาพ)
{ const { ADM, TATA, H } = setup();
  ADM('past.scan');
  const m = TATA('past.media', { fileId: 'F7' });
  ok('media: 3 unique images in order', m.ok && m.media.length === 3 && m.media.map(x => x.name).join(',') === 'media/image1.jpeg,media/image2.png,media/image3.jpg', JSON.stringify(m));
  ok('media: ctx = heading before image', /ที่พัก Kasalong/.test(m.media[0].ctx) && /รถบัส/.test(m.media[2].ctx) && !/รถบัส/.test(m.media[0].ctx), JSON.stringify(m.media));
  ok('media: sizes', m.media[0].size === 7 && m.media[1].size === 4, JSON.stringify(m.media));
  ok('media: cached second time', TATA('past.media', { fileId: 'F7' }).cached === true);
  const im = TATA('past.img', { fileId: 'F7', name: 'media/image2.png' });
  ok('img: png base64', im.ok && im.mime === 'image/png' && Buffer.from(im.data, 'base64').equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])), JSON.stringify(im));
  ok('img: path traversal refused', TATA('past.img', { fileId: 'F7', name: '../word/document.xml' }).error === 'bad' && TATA('past.img', { fileId: 'F7', name: 'media/../document.xml' }).error === 'bad');
  ok('img: file outside catalog refused', TATA('past.img', { fileId: 'OUT', name: 'media/image1.jpeg' }).error === 'missing' && TATA('past.media', { fileId: 'OUT' }).error === 'missing');
  ok('media: non-docx refused', TATA('past.media', { fileId: 'F9' }).error === 'type');
  ok('media: needs key', H.handle({ op: 'past.media', fileId: 'F7', key: 'eq-wrong', dev: 'x' }).ok === false);
}

console.log(fail ? `past-hub: ${fail} FAIL` : 'past-hub: all pass'); process.exit(fail ? 1 : 0);
