// อ่านโปรแกรมค่ายที่ทีมเคยส่งจริง (ไฟล์ Word ในโฟลเดอร์งานของแต่ละปี) → งานใหม่ที่แก้ต่อได้ในเว็บ
// ข้อความเข้า = ทีละย่อหน้า (ศูนยกลางทีมแตกจาก word/document.xml; แถวตาราง = ช่องคั่นด้วยแท็บ) หรือข้อความจากตัวเชื่อม Drive
// ผลออก = แม่แบบในงาน (camp.pastTpl) โครงเดียวกับแม่แบบทีม (TEMPLATES) → ใช้ทุกฟังก์ชันเดิมได้: แก้กำหนดการ/ขยายเวลา/Add-on/ราคา/ภาพ/ออกไฟล์
// กติกา: ไม่เดา — อะไรอ่านไม่ได้ = รายการ "ไม่พบ" ให้คนตรวจ · ชื่อโรงเรียน/ที่พักเดิมในข้อความ → ตัวแปร {S}/{V} (ไม่ค้างไปงานใหม่)
import { Camp, blankCamp, readBrief, detectCourse, docCodeFor, durKeyOf, defaultCourseActs, migrateCamp, Subject } from './eqcamp-core';
import type { CourseTemplate, TplRow, TplSec } from './course-templates-data';

export type PastRef = NonNullable<Camp['pastRef']>;
export interface PastParse {
  camp: Camp; tpl: CourseTemplate;
  /** ช่องที่อ่านได้ (ชื่อช่อง → ค่า) */ found: [string, string][];
  /** ช่องที่อ่านไม่ได้ — คนต้องกรอก/ตรวจ */ missing: string[];
  warnings: string[];
  stats: { days: number; rows: number; coverSecs: number; budget: number };
}

const MONTH = /มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม|ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\./;
// แถวเวลา: "09.00 – 10.30 น. ชื่อ" · "19.00 Sweet dreams" · "20.30 onward. …" · "21.30 น. เป็นต้นไป …" · "10:30 – 13:30 …"
const TIME_ROW = /^((?:\d{1,2}[.:]\d{2})(?:\s*(?:[–—\-]|ถึง)\s*\d{1,2}[.:]\d{2})?(?:\s*น\.)?(?:\s*(?:เป็นต้นไป|onward\.?|onwards\.?))?)\s*(?:\t+|\s+|$)(.*)$/i;
const DAY_MARK = /^(?:Day\s*(\d+)|วันที่\s*(\d+)(?=\s*$|\s*[(\[:：]|\s+(?:วัน)?(?:จันทร์|อังคาร|พุธ|พฤหัส|ศุกร์|เสาร์|อาทิตย์)))/i;
// หัววันแบบวันที่จริง: "วันที่ 12 กรกฎาคม 2569" · "วันจันทร์ที่ 12 ก.ค. 69" (วันเดียว ไม่ใช่ช่วง "12 – 14")
const DAY_DATE = new RegExp('^(?:วัน(?:จันทร์|อังคาร|พุธ|พฤหัสบดี|พฤหัส|ศุกร์|เสาร์|อาทิตย์)?\\s*)?(?:ที่\\s*)?\\d{1,2}\\s*(?:' + MONTH.source + ')\\s*(?:พ\\.ศ\\.\\s*)?\\d{2,4}\\s*(?:\\(.*\\))?$');
const H_OBJ = /^วัตถุประสงค์/, H_REASON = /^หลักการและเหตุผล/, H_ACTS = /^(?:การ)?กิจกรรมเชิงบูรณาการ/, H_INT = /^(?:การ)?บูรณาการ(?:การเรียน|การจัดการเรียน|การสอน|ทางการเรียน)/, H_STYLE = /^ลักษณะ(?:ของ)?กิจกรรม/;
const H_SCHED = /^กำหนดการ\s*$|^กำหนดการ(?:ค่าย|กิจกรรม)?\s*$/;
const INFO = /^(ข้อมูลผู้เข้าร่วม|ผู้เข้าร่วม|ผู้เข้ารับการอบรม|จำนวน|คุณครู|ครูผู้|คณะครู|วิทยากร|ระยะเวลา|สถานที่|ระดับชั้น|กลุ่มเป้าหมาย)/;
const NOTE = /^หมายเหตุ/;
const PRICE = /ราคา/;
const BUDGET_H = /^(?:รายละเอียด(?:งบประมาณ|ค่าใช้จ่าย)|(?:โดย)?รวมรายละเอียด|ราคา(?:นี้)?(?:รวม|ดังกล่าวรวม))/;
const END = /^(Photo|ภาพกิจกรรม|ตัวอย่างภาพ|ภาพบรรยากาศ)/i;

/** ข้อความจากตัวเชื่อม Drive มีเครื่องหมาย escape แบบ markdown (\# \! \- \*) — ถอดออก */
export const cleanPastText = (raw: string): string[] => String(raw || '')
  .replace(/\r/g, '').replace(/ /g, ' ')
  .split('\n')
  .map(l => l.replace(/\\([#!\-*_.()[\]+>`|~])/g, '$1').replace(/[ ​]+$/g, '').replace(/^\s+/, ''))
  .map(l => l.replace(/^[*_]{1,2}(.+?)[*_]{1,2}$/, '$1'))          // **ตัวหนา** ทั้งบรรทัด
  .filter(l => l.trim() !== '');

const numItem = (l: string) => { const m = l.match(/^\(?(\d{1,2})(?:\s*[.)]\s*|(?=[ก-ฮเแโใไ]))(.+)$/); return m && !/^\d/.test(m[2]) ? m[2].trim() : null; };
const bulletItem = (l: string) => { const m = l.match(/^[-•●▪◦·]\s*(.+)$/); return m ? m[1].trim() : null; };
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** อ่านข้อความโปรแกรมเดิม → งาน + แม่แบบในงาน */
export function parsePastProgram(raw: string, ref: PastRef = {}, base: Camp = blankCamp()): PastParse {
  const L = cleanPastText(raw);
  const warnings: string[] = [], missing: string[] = [];
  let i = 0;
  // 1) รหัสเอกสารเดิม (เก็บไว้อ้างอิง ไม่ใช้เป็นรหัสงานใหม่)
  let docOrig = '';
  if (L[0] && /^PL\s*[A-Z]{0,4}\s*\d{3,4}\s*\/\s*\d{4}$/i.test(L[0].trim())) { docOrig = L[0].trim(); i = 1; }
  // 2) ชื่อหลักสูตร = บรรทัดก่อนหัวข้อแรกของหน้าปก
  const titles: string[] = [];
  while (i < L.length && !H_OBJ.test(L[i]) && !H_REASON.test(L[i]) && !INFO.test(L[i]) && !H_SCHED.test(L[i]) && titles.length < 3) titles.push(L[i++].trim());
  if (!titles.length) missing.push('ชื่อหลักสูตร');
  // 3) หน้าปก
  const secs: TplSec[] = []; const infoLines: string[] = []; const skipped: string[] = [];
  let cur: TplSec | null = null;
  const push = (s: TplSec) => { secs.push(s); cur = s; };
  for (; i < L.length && !H_SCHED.test(L[i].trim()); i++) {
    const l = L[i].trim();
    if (H_OBJ.test(l)) { push({ k: 'list', h: l.replace(/\s+/g, ' '), items: [] }); continue; }
    if (H_REASON.test(l)) { push({ k: 'para', h: 'หลักการและเหตุผล', items: [] }); continue; }
    if (H_ACTS.test(l)) { push({ k: 'list', h: 'กิจกรรมเชิงบูรณาการ', acts: true, items: [] }); continue; }
    if (H_INT.test(l)) { push({ k: 'list', h: 'บูรณาการการเรียน (Instruction Integration)', items: [] }); continue; }
    if (H_STYLE.test(l)) { push({ k: 'bullets', h: l.replace(/\s*:\s*$/, ''), items: [] }); continue; }
    if (INFO.test(l)) {
      infoLines.push(l);
      const label = /^(ผู้เข้าร่วม|ผู้เข้ารับการอบรม|จำนวน)/.test(l) ? 'จำนวน' : /^วิทยากร/.test(l) ? 'วิทยากร' : /^ระยะเวลา/.test(l) ? 'ระยะเวลาอบรม' : '';
      if (label && !secs.some(s => s.k === 'info' && s.label === label)) push({ k: 'info', label });
      cur = null; continue;
    }
    const n = numItem(l), b = bulletItem(l);
    const c = cur as TplSec | null;
    if (c && c.k === 'list' && n !== null) { c.items!.push(n); continue; }
    if (c && c.k === 'list' && b !== null) { c.items!.push(b); continue; }
    if (c && c.k === 'list' && (!c.items!.length || /^(?:เพื่อ|กิจกรรม|บูรณาการ|ฐาน)/.test(l))) { c.items!.push(l); continue; }
    if (c && c.k === 'bullets') { c.items!.push(b !== null ? '- ' + b : l); continue; }
    if (c && c.k === 'para') { c.items!.push(l); continue; }
    if (c && c.k === 'list' && c.items!.length) { c.items![c.items!.length - 1] += ' ' + l; continue; }   // บรรทัดต่อของข้อเดิม
    skipped.push(l);
  }
  if (skipped.length) warnings.push(`หน้าปก: ไม่ได้นำเข้า ${skipped.length} บรรทัดที่ไม่อยู่ใต้หัวข้อที่รู้จัก เช่น ${skipped.slice(0, 2).map(x => `"${x.replace(/\t+/g, ' ').slice(0, 40)}"`).join(', ')}`);
  if (!secs.some(s => s.acts)) warnings.push('หน้าปกไม่มีหัวข้อ "กิจกรรมเชิงบูรณาการ" — ระบบจะสรุปจากกำหนดการให้');
  if (!secs.some(s => s.h && H_OBJ.test(s.h))) missing.push('วัตถุประสงค์');
  // 4) หัวกำหนดการ (ชื่อ/โรงเรียน/วันที่/สถานที่) → แถวรายวัน
  if (i >= L.length) missing.push('กำหนดการ');
  i++;
  // ตารางที่ขึ้นแต่ละวันด้วยวันที่จริง (≥ 2 บรรทัด) → ใช้เป็นหัววัน
  const isEnd = (l: string) => NOTE.test(l) || BUDGET_H.test(l) || END.test(l);
  let dateDays = 0; for (let k = i; k < L.length && !isEnd(L[k].trim()); k++) if (DAY_DATE.test(L[k].trim())) dateDays++;
  const isDay = (l: string) => DAY_MARK.test(l) || (dateDays >= 2 && DAY_DATE.test(l));
  const head: string[] = [];
  while (i < L.length && !isDay(L[i].trim()) && !TIME_ROW.test(L[i].trim())) head.push(L[i++].trim());
  const days: TplRow[][] = []; let day: TplRow[] | null = null; let last: TplRow | null = null;
  let stopAt = L.length;
  for (; i < L.length; i++) {
    const l = L[i].trim();
    if (NOTE.test(l) || BUDGET_H.test(l) || (PRICE.test(l) && /\d/.test(l) && /บาท|บ\.|ลดเหลือ|ปกติ/.test(l)) || END.test(l)) { stopAt = i; break; }
    if (isDay(l)) { day = []; days.push(day); last = null; continue; }
    const m = l.match(TIME_ROW);
    if (m) {
      if (!day) { day = []; days.push(day); }
      const t = m[1].replace(/\s*[–—\-]\s*/, ' – ').replace(/:/g, '.').replace(/\s+/g, ' ').trim();
      let x = m[2].replace(/^\t+/, '').split('\t').map(s => s.trim()).filter(Boolean).join(' ');
      if (!x && i + 1 < L.length && !TIME_ROW.test(L[i + 1].trim()) && !isDay(L[i + 1].trim())) x = L[++i].trim();
      if (!x) { warnings.push(`วันที่ ${days.length} ${t}: ไม่มีชื่อรายการ — ไม่ได้นำเข้าแถวนี้`); last = null; continue; }
      last = { t: /น\.|onward|เป็นต้นไป/i.test(t) ? t : t + ' น.', x };
      day.push(last); continue;
    }
    if (last) { (last.s = last.s || []).push(l.replace(/\t+/g, ' ')); continue; }
    if (day) warnings.push(`วันที่ ${days.length}: บรรทัดก่อนแถวแรก "${l.slice(0, 50)}" ไม่ได้นำเข้า`);
  }
  if (!days.length || !days.some(d => d.length)) missing.push('แถวกำหนดการ');
  // 5) ราคา + งบประมาณ
  const tail = L.slice(stopAt);
  let price: { n: number; s: number } | undefined;
  const pl = tail.find(l => PRICE.test(l) && /\d/.test(l));
  if (pl) {
    const num = (s?: string) => s ? +s.replace(/,/g, '') : 0;
    const a = pl.match(/ปกติ\s*([\d,]+)/), b = pl.match(/(?:ลดเหลือ(?:เพียง)?|พิเศษ|เหลือ)[^\d]{0,20}?([\d,]+)/), one = pl.match(/ราคา[^\d]*([\d,]+)/);
    const n = num(a?.[1]) || num(one?.[1]), s = num(b?.[1]) || n;
    if (n > 0 && s > 0) price = { n, s };
  }
  // ราคารวมทั้งงาน (ไม่มี "ท่าน/คน/ต่อ" และตัวเลขสูงเกินราคาต่อหัว) → ไม่ใส่เป็นราคาต่อท่าน (ไม่เดา) แต่บอกยอดรวมให้ตรวจ
  let lump = 0;
  if (price && pl && !/ท่าน|คน|ต่อ\s*(?:หัว|ราย)|\/\s*(?:ท่าน|คน)|per/i.test(pl) && price.s >= 15000) { lump = price.s; price = undefined; }
  const bi = tail.findIndex(l => BUDGET_H.test(l));
  const budget: string[] = [];
  if (bi >= 0) for (const l0 of tail.slice(bi + 1)) {
    const l = l0.replace(/\t+/g, ' ').trim();
    if (END.test(l) || NOTE.test(l)) break;
    const b = bulletItem(l) ?? numItem(l);
    if (b) budget.push(b);
    else if (/^ค่า/.test(l)) budget.push(l);
    else if (budget.length && !PRICE.test(l)) budget[budget.length - 1] += ' ' + l;
  }
  if (!budget.length) missing.push('รายการงบประมาณ');
  // 6) ข้อมูลค่ายจากหัวกำหนดการ + บรรทัดข้อมูล + ราคา (ใช้ตัวอ่านบรีฟเดิม — ไม่เดา)
  const briefText = [...titles, ...head, ...infoLines, pl || '', ref.folderName || ''].filter(Boolean).join('\n');
  const rb = readBrief(briefText, base);
  const camp: Camp = { ...rb.camp };
  const course = detectCourse([...titles, ...head.slice(0, 2), ref.fileName || '', ref.folderName || ''].join(' '));
  if (course) { camp.courseCode = course.code; camp.subject = course.family as Subject; camp.activityIds = defaultCourseActs(course.code); }
  else missing.push('หลักสูตร (เลือกเองในขั้นหลักสูตร)');
  // ระยะเวลา: บรรทัด "ระยะเวลาอบรม" > จำนวนวันในกำหนดการ
  const durLine = infoLines.find(l => /^ระยะเวลา/.test(l)) || '';
  const dn = durLine.match(/(\d+)\s*วัน(?:\s*(\d+)\s*คืน)?/);
  const half = /ครึ่งวัน/.test(durLine);
  if (half) { camp.durationMode = 'half'; camp.days = 1; camp.nights = 0; }
  else if (dn) { camp.days = +dn[1]; camp.nights = dn[2] ? +dn[2] : 0; camp.durationMode = camp.nights > 0 ? 'overnight' : 'day'; }
  else if (days.length) { camp.days = days.length; camp.nights = days.length > 1 && /check\s*in|เช็คอิน|เข้าห้องพัก|sweet|ฝันดี|พักผ่อนตามอัธยาศัย/i.test(days.flat().map(r => r.x).join(' ')) ? days.length - 1 : 0; camp.durationMode = camp.nights ? 'overnight' : 'day'; warnings.push('ไม่พบบรรทัด "ระยะเวลาอบรม" — นับจากจำนวนวันในกำหนดการ'); }
  if (days.length && camp.days && days.length !== camp.days && camp.durationMode !== 'half') warnings.push(`ระยะเวลาบนหน้าปก ${camp.days} วัน แต่กำหนดการมี ${days.length} วัน — ตรวจก่อนใช้`);
  if (price) { camp.normalPrice = price.n; camp.specialPrice = price.s; }
  else if (lump) { missing.push('ราคาต่อท่าน'); warnings.push(`โปรแกรมเดิมระบุราคารวมทั้งงาน ${lump.toLocaleString()} บาท (ไม่ใช่ราคาต่อท่าน)${camp.students ? ` ≈ ${Math.round(lump / camp.students).toLocaleString()} บาท/ท่าน ที่ ${camp.students} คน` : ''} — กรอกราคาต่อท่านเองในขั้นราคา`); }
  else missing.push('ราคา');
  // ค่าเริ่มต้นของแอป ("วันที่ ...") ไม่ใช่ข้อมูลจากโปรแกรมเดิม
  if (/^\s*(?:วันที่)?\s*\.{2,}\s*$/.test(String(camp.dates || ''))) camp.dates = '';
  if (!String(camp.school || '').trim()) missing.push('ชื่อโรงเรียน');
  // "ผู้เข้าร่วม จำนวน 45 ท่าน" (ไม่มีคำว่านักเรียน) → นักเรียน · เป็นช่วง "80 – 90 คน" → ไม่เดา บอกให้กรอก
  const rangeLine = infoLines.map(l => l.replace(/\t+/g, ' ')).find(l => /^(?:ข้อมูล)?(?:ผู้เข้าร่วม|ผู้เข้ารับการอบรม|จำนวน)/.test(l) && /\d{1,4}\s*[–—-]\s*\d{1,4}\s*(?:คน|ท่าน)/.test(l) && !/^(?:วิทยากร|ครู)/.test(l));
  const rm = rangeLine?.match(/(\d{1,4})\s*[–—-]\s*(\d{1,4})\s*(?:คน|ท่าน)/);
  if (rm && (camp.students === +rm[1] || camp.students === +rm[2])) camp.students = 0;   // ช่วงจำนวน — ตัวอ่านบรีฟหยิบตัวเลขใดตัวหนึ่ง = เดา
  if (!camp.students) {
    const pl2 = infoLines.map(l => l.replace(/\t+/g, ' ')).find(l => /^(?:ข้อมูล)?(?:ผู้เข้าร่วม|ผู้เข้ารับการอบรม)/.test(l) && !/ครู|วิทยากร/.test(l.replace(/^[^จ]*จำนวน/, '')));
    const pm = pl2?.match(/จำนวน\s*(\d{1,4})(?:\s*[–—-]\s*(\d{1,4}))?\s*(?:คน|ท่าน)/);
    if (pm && !pm[2]) camp.students = +pm[1];
    else if (pm) warnings.push(`จำนวนผู้เข้าร่วมเดิมเป็นช่วง ${pm[1]}–${pm[2]} คน — กรอกจำนวนจริงในขั้นข้อมูลค่าย`);
  }
  if (!camp.students) missing.push('จำนวนนักเรียน');
  // 7) ชื่อโรงเรียน/ที่พักเดิมในข้อความ → ตัวแปร (งานใหม่ไม่ค้างชื่องานเดิม) · ปี ค.ศ. ในชื่อค่าย → {Y}
  const subs: [RegExp, string][] = [];
  const school = String(camp.school || '').trim(), venue = String(camp.venue || '').trim();
  if (school.length > 6) { subs.push([new RegExp(esc(school), 'g'), '{S}']); const bare = school.replace(/^โรงเรียน/, ''); if (bare.length > 4) subs.push([new RegExp('โรงเรียน\\s*' + esc(bare), 'g'), '{S}']); }
  if (venue.length > 4) subs.push([new RegExp(esc(venue), 'g'), '{V}']);
  const sub = (s: string) => subs.reduce((a, [re, v]) => a.replace(re, v), s);
  const T = (s: string) => sub(s);
  const tTitles = titles.map(t => sub(t).replace(/((?:Camp|CAMP|camp)\s*)20\d\d/g, '$1{Y}'));
  const tSecs = secs.map(s => ({ ...s, items: s.items ? s.items.map(T) : s.items }));
  const tDays = days.filter(d => d.length).map(d => d.map(r => ({ ...r, x: T(r.x), ...(r.s ? { s: r.s.map(T) } : {}) })));
  const tBudget = budget.map(T);
  const code = camp.courseCode || '';
  const id = 'past:' + (ref.fileId || hash(raw));
  const tpl: CourseTemplate = {
    id, code, dur: durKeyOf(camp), variant: 'past', source: ref.fileName || ref.folderName || 'งานเก่า',
    titles: tTitles, secs: tSecs, days: tDays, budget: tBudget, photos: [], ownPhotos: 0,
    area: camp.province ? [camp.province] : [], ...(price ? { price } : {}), ...(venue ? { venue } : {})
  };
  camp.templateId = id;
  camp.pastTpl = tpl;
  camp.pastRef = { ...ref, docCode: docOrig || ref.docCode, importedAt: new Date().toISOString() };
  camp.docCode = code ? docCodeFor(code) : camp.docCode;
  const found: [string, string][] = [];
  const f = (k: string, v: unknown) => { if (v !== undefined && v !== null && String(v).trim() !== '' && v !== 0) found.push([k, String(v)]); };
  f('ชื่อหลักสูตร', titles.join(' ')); f('หลักสูตร', course ? `${course.code} ${course.name}` : ''); f('โรงเรียน', camp.school);
  f('นักเรียน', camp.students); f('ครู', camp.teachers); f('ระยะเวลา', camp.durationMode === 'half' ? 'ครึ่งวัน' : `${camp.days} วัน${camp.nights ? ` ${camp.nights} คืน` : ''}`);
  f('วันที่', camp.dates); f('สถานที่', camp.venue); f('จังหวัด', camp.province);
  f('ราคา', price ? `ปกติ ${price.n.toLocaleString()} · พิเศษ ${price.s.toLocaleString()} บาท/ท่าน` : '');
  f('รหัสเอกสารเดิม', docOrig);
  const rows = tDays.reduce((a, d) => a + d.length, 0);
  return { camp: migrateCamp(camp), tpl, found, missing, warnings, stats: { days: tDays.length, rows, coverSecs: tSecs.length, budget: tBudget.length } };
}

const hash = (s: string): string => { let h = 5381; for (let k = 0; k < s.length; k++) h = ((h << 5) + h + s.charCodeAt(k)) | 0; return (h >>> 0).toString(36); };

/* ===================== คลังงานเก่า: แยกชนิด/วันที่/หลักสูตรจากชื่อโฟลเดอร์ (ไม่เปิดไฟล์) ===================== */
export interface PastFile { id: string; n: string; m: string; s?: number; u?: string }
export interface PastFolder { id: string; name: string; updated?: string; files: PastFile[] }
export type PastFileKind = 'program' | 'quote' | 'confirm' | 'other';
export const pastFileKind = (f: PastFile): PastFileKind => {
  const n = f.n || '';
  // ไฟล์ล็อกชั่วคราวของ Word (~$ชื่อไฟล์.docx ขนาด ~162 ไบต์) ไม่ใช่โปรแกรม
  if (/^~\$|(?:^|\/)~\$/.test(n) || (f.s !== undefined && f.s < 2000 && /\.(docx?|pdf)$/i.test(n))) return 'other';
  if (/^ยืนยัน|ยืนยันใบเสนอ|confirm/i.test(n)) return 'confirm';
  if (/ใบเสนอราคา|quotation/i.test(n)) return 'quote';
  if (/\.(docx?|pdf)$/i.test(n) || /wordprocessingml|msword|pdf|google-apps\.document/.test(f.m)) return 'program';
  return 'other';
};
const isDocx = (f: PastFile) => /\.docx$/i.test(f.n) || /wordprocessingml/.test(f.m);
export interface PastJob {
  id: string; name: string; date: string; dateLabel: string; kind: 'camp' | 'corp';
  school: string; courseCode: string; courseName: string; duration: string;
  program?: PastFile; programDocx?: PastFile; /** ไฟล์ Word ทั้งหมดที่อาจเป็นโปรแกรม เรียงจากน่าจะใช่ที่สุด */ docxs: PastFile[]; quotes: PastFile[]; confirms: PastFile[]; others: PastFile[]; files: PastFile[];
  confirmed: boolean; canOpen: boolean; search: string;
  /** ไฟล์ Word ใหญ่เกินที่ศูนย์กลางอ่านได้ (Apps Script จำกัด 50 MB — มักมีภาพฝัง) → ดูใน Drive ได้อย่างเดียว */
  bigDocx?: PastFile;
}
const TH_MONTH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const CORP = /team\s*building|บริษัท|จำกัด|rally|outing|bni|isuzu|happiness|องค์กร|ธนาคาร|คลินิก|hotel|มหาชน|สมาคม|เวชกรรม|charity/i;
export function classifyPast(f: PastFolder): PastJob {
  const name = String(f.name || '').replace(/\s+/g, ' ').trim();
  const dm = name.match(/^(\d{2})(\d{2})(\d{2})\b/);
  let date = '', dateLabel = '';
  if (dm) { const y = 2500 + +dm[1], mo = +dm[2], d = +dm[3]; if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) { date = `${y - 543}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`; dateLabel = `${d} ${TH_MONTH[mo - 1]} ${String(y).slice(2)}`; } }
  const rest = name.replace(/^\d{6}\s*/, '');
  const kind: 'camp' | 'corp' = /โรงเรียน|school|academy|วิทยา|ศึกษา|สาธิต/i.test(rest) && !/บริษัท|จำกัด/.test(rest) ? 'camp' : CORP.test(rest) ? 'corp' : 'camp';
  const sm = rest.match(/(โรงเรียน\s*[^\s@“”"(]+(?:\s+(?!โปรแกรม|Day|day|DAY|\d|@|ม\.|ปลาย|ต้น)[^\s@“”"(]+){0,3})/);
  const school = sm ? sm[1].replace(/\s+(?:จังหวัด|จ\.)\S*$/, '').trim() : (rest.match(/(บริษัท\s*[^(“"]+?)(?:\s+(?:Team|จำกัด)|$)/)?.[1] || '').trim();
  const course = kind === 'camp' ? detectCourse(rest) : undefined;
  const dvn = rest.match(/(\d)\s*วัน\s*(\d)\s*คืน/);
  const du = dvn ? `${dvn[1]} วัน ${dvn[2]} คืน` : /day\s*camp/i.test(rest) ? 'Day Camp' : (rest.match(/(\d)\s*วัน/)?.[0] || '');
  const files = (f.files || []).slice().sort((a, b) => a.n.localeCompare(b.n, 'th'));
  const kinds = files.map(x => ({ x, k: pastFileKind(x) }));
  const programs = kinds.filter(o => o.k === 'program').map(o => o.x);
  const PAST_MAX = 48e6;   // Apps Script อ่านไฟล์ได้ไม่เกิน 50 MB
  // ชื่อไฟล์บอกว่าเป็นโปรแกรม (หลักสูตร/โปรแกรม/ค่าย/กำหนดการ) มาก่อน · รายชื่อ/หนังสือ/ใบงาน ไปท้าย
  const rank = (x: PastFile) => (/หลักสูตร|โปรแกรม|ค่าย|camp|กำหนดการ/i.test(x.n) ? 0 : 2) + (/รายชื่อ|ลงชื่อ|หนังสือ|ที่\s*ศธ|ใบงาน|แบบประเมิน|เกียรติบัตร|คำสั่ง|ครูผู้ควบคุม|บันทึก/.test(x.n) ? 4 : 0) + (x.n.includes('/') ? 1 : 0);
  const docxs = programs.filter(x => isDocx(x) && !(x.s && x.s > PAST_MAX)).sort((a, b) => rank(a) - rank(b));
  const programDocx = docxs[0];
  const bigDocx = programDocx ? undefined : programs.find(x => isDocx(x) && !!x.s && x.s > PAST_MAX);
  const program = programDocx || programs[0];
  const quotes = kinds.filter(o => o.k === 'quote').map(o => o.x), confirms = kinds.filter(o => o.k === 'confirm').map(o => o.x), others = kinds.filter(o => o.k === 'other').map(o => o.x);
  const job: PastJob = { id: f.id, name, date, dateLabel, kind, school, courseCode: course?.code || '', courseName: course?.name || '', duration: du,
    program, programDocx, docxs, quotes, confirms, others, files, confirmed: confirms.length > 0, canOpen: kind === 'camp' && !!programDocx, search: '', ...(bigDocx ? { bigDocx } : {}) };
  job.search = [name, school, course?.name || '', course?.code || '', du, job.confirmed ? 'ยืนยันแล้ว' : '', kind === 'corp' ? 'องค์กร team building' : 'ค่าย', dateLabel, ...files.map(x => x.n)].join(' ');
  return job;
}
/** งานเก่าของโรงเรียนเดียวกัน (ใช้เตือนตอนอ่านบรีฟ) — เทียบชื่อแบบไม่สนเว้นวรรค/คำนำ "โรงเรียน" */
export const schoolKey = (s: string) => String(s || '').replace(/^โรงเรียน/, '').replace(/[\s()“”"'.,-]/g, '').toLowerCase();
export function pastForSchool(jobs: PastJob[], school: string): PastJob[] {
  const k = schoolKey(school); if (k.length < 3) return [];
  return jobs.filter(j => { const jk = schoolKey(j.school); return jk.length >= 3 && (jk === k || jk.includes(k) || k.includes(jk)); })
    .sort((a, b) => b.date.localeCompare(a.date));
}
