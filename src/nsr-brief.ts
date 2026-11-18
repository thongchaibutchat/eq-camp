// บรีฟ → ตารางคำนวณ NSR ทั้งก้อน (รับจบในครั้งเดียว)
// ลำดับความเชื่อถือ (ทุกช่องบอกที่มา — ไม่เดา):
//   1) บรีฟ: จำนวนคน/ครู/ระยะเวลา/ราคาขาย/จังหวัด/ที่พัก + อัตราที่บรีฟระบุ (ห้องละ…พัก…, มื้อละ…, รถ…คัน, เสื้อ…)
//   2) กำหนดการจริงของค่าย (buildSchedule): จำนวนคืน · มื้อหลัก · อาหารว่าง → "จำนวน" ของแต่ละบรรทัด
//   3) งานจริงที่ใกล้ที่สุดในชีต NSR (หลักสูตรเดียวกัน · จำนวนวันเท่ากัน · จำนวนคนใกล้กัน): ราคาต่อหน่วยกลาง (มัธยฐาน) + องค์ประกอบทีมวิทยากร
//   4) สูตรของทีม (หมายเหตุคอลัมน์ F): วิทยากร/เบี้ยเลี้ยง/เดินทาง/ที่พักวิทยากร/ครู — อัปเดตเองเมื่อข้อมูลเปลี่ยน
//   ไม่มีทั้ง 4 ทาง → ว่าง + เตือน "ไม่พบ" (ห้ามเดาตัวเลข)
// AI (ถ้ามี) ทำได้แค่ "เสนอค่า" ที่ต้องอ้างข้อความในบรีฟหรือชื่องานอ้างอิงได้จริง — ตัวคำนวณยังเป็นสูตรเดิมทั้งหมด
import { Camp, blankCamp, readBrief, buildSchedule, courseLabel, detectCourse, staffText, cleanBrief } from './eqcamp-core';
import { NsrJob, CostLine, LineKey, newJob, keyOf, staffSum, computeNsr, DEFAULT_STAFF, Num } from './nsr-core';

export type Src = 'บรีฟ' | 'กำหนดการ' | 'งานอ้างอิง' | 'สูตร' | 'AI' | 'ไม่พบ';
export interface DraftField { key: string; label: string; value: string; src: Src; note?: string }
export interface DraftRef { tab: string; course: string; days: number; participants: number; pct: number | null; score: number }
export interface NsrDraft { job: NsrJob; tabName: string; fields: DraftField[]; refs: DraftRef[]; warnings: string[]; camp: Camp }

const z = (n: Num | undefined) => (typeof n === 'number' && Number.isFinite(n) ? n : 0);
const median = (a: number[]) => { const s = a.filter(x => x > 0).sort((x, y) => x - y); if (!s.length) return null; const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const fmtN = (n: number) => n.toLocaleString('th-TH', { maximumFractionDigits: 2 });

// งานอ้างอิง: หลักสูตรเดียวกัน (+50) · วันเท่ากัน (+30) · คนใกล้กัน (+0..20) · ไม่ใช่ "Copy of" · ต้องมีราคาขาย
export function similarJobs(history: NsrJob[], courseCode: string, days: number, participants: number, max = 5): { job: NsrJob; ref: DraftRef }[] {
  const out: { job: NsrJob; ref: DraftRef }[] = [];
  for (const j of history) {
    if (!j.tab || /^copy of/i.test(j.tab) || !(z(j.price) > 0)) continue;
    const code = detectCourse(`${j.tab} ${j.name}`)?.code || '';
    const d = staffSum(j.staff).days || 0;
    const n = z(j.participants);
    let score = 0;
    if (courseCode && code === courseCode) score += 50;
    if (days && d === days) score += 30;
    if (participants && n) score += Math.max(0, 20 - Math.abs(n - participants) / Math.max(participants, 1) * 40);
    if (score < 50) continue;                         // ต้องตรงหลักสูตร หรือ ตรงจำนวนวัน + คนใกล้กันมาก
    const c = computeNsr(j);
    out.push({ job: j, ref: { tab: j.tab, course: code ? courseLabel(code) : '', days: d, participants: n, pct: c.pct, score: Math.round(score) } });
  }
  return out.sort((a, b) => b.ref.score - a.ref.score).slice(0, max);
}

// อัตราที่บรีฟระบุเอง (ตัวเลขจากบรีฟเท่านั้น)
function briefRates(text: string) {
  const t = cleanBrief(text).ar;
  const n = (s: string) => Number(s.replace(/,/g, ''));
  const r: Partial<Record<LineKey, { price?: number; qty?: number; quote: string }>> = {};
  let m: RegExpMatchArray | null;
  if ((m = t.match(/ห้อง(?:ละ|พัก(?:ละ)?|คืนละ)?\s*([\d,]{3,6})\s*(?:บาท)?[^\d]{0,20}?(?:พัก|นอน)\s*(\d)\s*(?:คน|ท่าน)/))) r.room = { price: Math.round(n(m[1]) / n(m[2]) * 100) / 100, quote: m[0] };
  else if ((m = t.match(/ที่พัก[^\d]{0,15}?([\d,]{2,5})\s*บาท\s*(?:\/|ต่อ)\s*(?:คน|ท่าน)/))) r.room = { price: n(m[1]), quote: m[0] };
  if ((m = t.match(/(?:อาหาร|มื้อ)[^\d]{0,15}?(?:มื้อ|ละ)\s*([\d,]{2,4})\s*บาท/))) r.mealHotel = { price: n(m[1]), quote: m[0] };
  if ((m = t.match(/(?:อาหารว่าง|เบรก|coffee\s*break)[^\d]{0,12}?([\d,]{2,3})\s*บาท/i))) r.snack = { price: n(m[1]), quote: m[0] };
  if ((m = t.match(/(?:รถ\s*บัส|รถบัส|รถตู้|รถ)\s*(\d{1,2})\s*คัน(?:[^\d]{0,12}?(?:คันละ|ละ)\s*([\d,]{4,6}))?/))) r.vehicle = { qty: n(m[1]), price: m[2] ? n(m[2]) : undefined, quote: m[0] };
  if ((m = t.match(/เสื้อ[^\d]{0,12}?([\d,]{2,4})\s*บาท/))) r.shirt = { price: n(m[1]), quote: m[0] };
  if ((m = t.match(/ประกัน[^\d]{0,15}?([\d,]{1,4})\s*บาท/))) r.insurance = { price: n(m[1]), quote: m[0] };
  if ((m = t.match(/(?:ครู|อาจารย์)\s*ต่างชาติ\s*(\d{1,2})\s*(?:คน|ท่าน)/))) r.foreign = { qty: n(m[1]), quote: m[0] };
  if ((m = t.match(/ห้องประชุม[^\d]{0,15}?([\d,]{3,6})\s*บาท/))) r.meeting = { price: n(m[1]), quote: m[0] }; // ราคาเต็ม → หารจำนวนคนตอนใช้
  return r;
}

export function draftFromCamp(c: Camp, history: NsrJob[], briefText = ''): NsrDraft {
  const warnings: string[] = []; const fields: DraftField[] = [];
  const F = (key: string, label: string, value: string, src: Src, note?: string) => fields.push({ key, label, value, src, note });
  const job = newJob();
  const overnight = c.durationMode === 'overnight';
  const days = c.durationMode === 'half' ? 1 : Math.max(1, c.days || 1);
  const nights = overnight ? (c.nights || 0) : 0;
  const course = c.courseCode ? courseLabel(c.courseCode) : '';
  const durTxt = c.durationMode === 'half' ? 'ครึ่งวัน' : overnight ? `${days}วัน${nights}คืน` : `${days}วัน`;
  job.name = [course || 'ค่าย', durTxt].join(' ');
  job.province = c.province || '';
  job.participants = c.students || null;
  job.teachers = c.teachers || null;
  job.price = c.specialPrice || c.normalPrice || null;
  F('participants', 'ผู้เข้าร่วม', job.participants ? `${job.participants} คน` : 'ไม่พบ', job.participants ? 'บรีฟ' : 'ไม่พบ');
  F('teachers', 'คุณครู', job.teachers ? `${job.teachers} คน` : 'ไม่พบ', job.teachers ? 'บรีฟ' : 'ไม่พบ');
  F('duration', 'ระยะเวลา', durTxt, 'บรีฟ');
  F('price', 'ราคาขาย / ท่าน', job.price ? `${fmtN(job.price)} บาท` : 'ไม่พบ', job.price ? 'บรีฟ' : 'ไม่พบ', job.price ? undefined : 'ดูราคาขั้นต่ำที่ระบบคำนวณให้');
  if (!job.participants) warnings.push('บรีฟไม่มีจำนวนผู้เข้าร่วม — ใส่ก่อน สูตรต่อหัวจึงคำนวณได้');
  // ── จำนวนจากกำหนดการจริง ──
  let meals = { b: 0, l: 0, d: 0, s: 0 };
  try { meals = buildSchedule(c).meals; } catch { warnings.push('สร้างกำหนดการไม่สำเร็จ — ใส่จำนวนมื้อเอง'); }
  const main = meals.b + meals.l + meals.d;
  const L = (k: LineKey) => job.lines.find(l => (l.key || keyOf(l.label)) === k)!;
  if (overnight) { L('room').qty = nights; L('mealHotel').qty = main; L('mealOut').qty = 0; }
  else { L('room').qty = 0; L('mealHotel').qty = 0; L('mealOut').qty = main; }
  L('snack').qty = meals.s;
  F('qty', 'จำนวนจากกำหนดการ', `${nights} คืน · มื้อหลัก ${main} (เช้า ${meals.b} กลางวัน ${meals.l} เย็น ${meals.d}) · อาหารว่าง ${meals.s}`, 'กำหนดการ');
  if (c.venue) { L('room').label = overnight ? `ค่าที่พัก (${c.venue})` : L('room').label; }
  // ── งานอ้างอิง ──
  const sims = similarJobs(history, c.courseCode || '', days, z(job.participants));
  const refs = sims.map(s => s.ref);
  const refLine = (k: LineKey) => median(sims.map(s => { const l = s.job.lines.find(x => (x.key || keyOf(x.label)) === k); return l ? z(l.price) : 0; }));
  const priceKeys: LineKey[] = overnight ? ['room', 'mealHotel', 'snack', 'equip', 'shirt', 'insurance'] : ['mealOut', 'snack', 'equip', 'shirt', 'insurance'];
  const rates = briefRates(briefText);
  for (const k of priceKeys) {
    const l = L(k) || (() => { const nl: CostLine = { label: k === 'insurance' ? 'ค่าประกันอุบัติเหตุ' : k === 'shirt' ? 'ค่าเสื้อ' : k, price: null, qty: 1, key: k }; job.lines.push(nl); return nl; })();
    const br = rates[k];
    if (br && br.price != null) { l.price = br.price; F(k, l.label, `${fmtN(br.price)} บาท/หน่วย`, 'บรีฟ', `“${br.quote.trim()}”`); continue; }
    if ((k === 'room' && !nights) || ((k === 'mealHotel' || k === 'mealOut') && !main) || (k === 'snack' && !meals.s)) continue;
    const v = refLine(k);
    if (v != null && (k !== 'shirt' && k !== 'insurance' || sims.some(s => z(s.job.lines.find(x => (x.key || keyOf(x.label)) === k)?.price) > 0))) {
      l.price = Math.round(v * 100) / 100; F(k, l.label, `${fmtN(l.price)} บาท/หน่วย`, 'งานอ้างอิง', `มัธยฐานจาก ${sims.length} งาน`);
    } else if (['room', 'mealHotel', 'mealOut', 'snack'].includes(k)) F(k, l.label, 'ไม่พบ', 'ไม่พบ', 'ใส่ราคาต่อหน่วยเอง');
  }
  // อัตราอื่นที่บรีฟบอก
  if (rates.vehicle) { const l = L('vehicle'); l.qty = rates.vehicle.qty ?? 1; if (rates.vehicle.price != null && job.participants) { l.price = Math.round(rates.vehicle.price * days / z(job.participants) * 100) / 100; l.auto = false; } else l.auto = true; F('vehicle', 'ยานพาหนะ', `${l.qty} คัน${rates.vehicle.price ? ` · คันละ ${fmtN(rates.vehicle.price)}` : ' · สูตร 8,000/คัน/วัน'}`, 'บรีฟ', `“${rates.vehicle.quote.trim()}”`); }
  if (rates.foreign) { const l = L('foreign'); l.qty = rates.foreign.qty ?? 1; l.auto = true; F('foreign', 'ครูต่างชาติ', `${l.qty} คน · สูตร 3,000/วัน`, 'บรีฟ', `“${rates.foreign.quote.trim()}”`); }
  if (rates.meeting && job.participants) { const l = L('meeting'); l.price = Math.round(rates.meeting.price! / z(job.participants) * 100) / 100; l.qty = 1; F('meeting', 'ห้องประชุม', `${fmtN(rates.meeting.price!)} ÷ ${job.participants} คน`, 'บรีฟ', `“${rates.meeting.quote.trim()}”`); }
  // ── ทีมวิทยากร: วัน = จำนวนวันค่าย · จำนวนคนต่อบทบาท = งานอ้างอิงที่จำนวนคนใกล้ที่สุด (ไม่มี → ว่าง + บอกสูตรทีม) ──
  const withStaff = (l: NsrJob[]) => l.filter(j => staffSum(j.staff).people > 0);
  const near = (l: NsrJob[]) => [...l].sort((a, b) => (Math.abs(staffSum(a.staff).days - days) * 1000 + Math.abs(z(a.participants) - z(job.participants))) - (Math.abs(staffSum(b.staff).days - days) * 1000 + Math.abs(z(b.participants) - z(job.participants))))[0];
  const nj = near(withStaff(sims.map(s => s.job))) || near(withStaff(history.filter(h => h.tab && !/^copy of/i.test(h.tab))));
  const nearest = nj ? { job: nj, ref: { tab: nj.tab || '' } } : undefined;
  job.staff = DEFAULT_STAFF.map(s => {
    const ref = nearest?.job.staff.find(x => x.role.replace(/\s+/g, '') === s.role.replace(/\s+/g, ''));
    return { ...s, days, people: ref ? ref.people : s.role === 'Di Camp' ? 1 : null, rate: ref?.rate ?? s.rate, advance: ref?.advance ?? s.advance };
  });
  const team = staffSum(job.staff).people;
  const rule = job.participants ? staffText(z(job.participants)) : '';
  if (nearest && nearest.job.staff.length) F('staff', 'ทีมวิทยากร', `${team} คน × ${days} วัน`, 'งานอ้างอิง', `องค์ประกอบจาก “${nearest.ref.tab}”${rule ? ` · สูตรทีม ${rule} คน` : ''}`);
  else { F('staff', 'ทีมวิทยากร', `วัน = ${days}`, 'ไม่พบ', `ใส่จำนวนคนต่อบทบาท${rule ? ` (สูตรทีม ${rule} คน)` : ''}`); warnings.push(`ยังไม่มีงานอ้างอิงที่ตรงกัน — ใส่จำนวนทีมวิทยากรเอง${rule ? ` (สูตรทีม ${rule} คน)` : ''}`); }
  if (rule && team) { const [lo, hi] = rule.split('–').map(x => Number(x.trim())); if (team < lo || team > hi) warnings.push(`ทีมวิทยากร ${team} คน ไม่อยู่ในสูตรทีม ${rule} คน (สำหรับ ${job.participants} คน)`); }
  // ── สูตรทีม (อัปเดตเอง) ──
  for (const k of ['trainer', 'allowance', 'trainerTravel', 'trainerRoom', 'teacher'] as LineKey[]) { const l = L(k); l.auto = true; l.qty = 1; }
  if (!overnight) { L('trainerRoom').auto = false; L('trainerRoom').price = 0; }
  if (!job.teachers) { L('teacher').auto = false; L('teacher').price = 0; }
  F('formula', 'วิทยากร · เบี้ยเลี้ยง · เดินทาง · ที่พักวิทยากร · ครู', 'คำนวณตามสูตรทีม', 'สูตร', 'อัปเดตเองเมื่อแก้จำนวนคน/ราคา');
  // ชื่อแท็บแบบทีม: หลักสูตร@โรงเรียน
  const school = (c.school || '').replace(/\.{2,}|…/g, '').replace(/^โรงเรียน/, '').trim();
  const tabName = `${course || 'ค่าย'}@${school || 'ไม่ระบุโรงเรียน'}`;
  return { job, tabName, fields, refs, warnings, camp: c };
}

export function draftFromBrief(brief: string, history: NsrJob[], base?: Camp): NsrDraft {
  const r = readBrief(brief, base || blankCamp());
  const d = draftFromCamp(r.camp, history, brief);
  if (!r.found.includes('duration')) d.warnings.unshift('บรีฟไม่ระบุระยะเวลา — ใช้ค่าเริ่มต้น ตรวจจำนวนวัน/คืน');
  if (!r.found.includes('course')) d.warnings.push('บรีฟไม่ระบุหลักสูตร — งานอ้างอิงเทียบได้เฉพาะจำนวนวัน/คน');
  return d;
}

// ── AI ช่วยเติม (ข้อเสนอเท่านั้น) ──
export interface AiSuggest { key: LineKey | 'participants' | 'teachers' | 'price'; price?: number; qty?: number; value?: number; quote: string; reason?: string }
export function aiPrompt(brief: string, d: NsrDraft): string {
  const lines = d.job.lines.map(l => ({ key: l.key || keyOf(l.label), label: l.label, price: l.price, qty: l.qty, auto: !!l.auto }));
  return `คุณช่วยฝ่ายขายค่ายวิชาการ EQ Camp เติมตารางต้นทุน NSR จากบรีฟ ตอบเป็น JSON เท่านั้น
กติกา (ห้ามฝ่าฝืน):
- เสนอค่าเฉพาะที่ "บรีฟระบุชัด" เท่านั้น และต้องคัดลอกข้อความจากบรีฟที่เป็นหลักฐานมาใส่ quote ตรงตัว
- ห้ามเดาราคา ห้ามคิดสูตรเอง (ระบบคำนวณ VAT/กำไร/NSR เอง) ห้ามแก้บรรทัดที่ auto=true ยกเว้น qty ของ vehicle/foreign
- ราคาทุกบรรทัดเป็น "บาทต่อผู้เข้าร่วม 1 คน ต่อหน่วย" — ถ้าบรีฟให้ราคาห้อง ให้หารจำนวนคนต่อห้อง, ราคาเหมาให้หารจำนวนผู้เข้าร่วม
- ไม่มีอะไรเพิ่มจากที่ระบบอ่านได้แล้ว → {"suggest":[],"notes":[]}
รูปแบบ: {"suggest":[{"key":"room|mealHotel|mealOut|snack|meeting|equip|vehicle|foreign|visit|shipping|decor|band|shirt|insurance|participants|teachers|price","price":number?,"qty":number?,"value":number?,"quote":"ข้อความจากบรีฟ","reason":"สั้น ๆ"}],"notes":["ข้อสังเกตสั้น ๆ"]}
บรีฟ:
"""${brief.slice(0, 4000)}"""
ระบบอ่านได้แล้ว: ผู้เข้าร่วม ${d.job.participants ?? 'ไม่พบ'} · ครู ${d.job.teachers ?? 'ไม่พบ'} · ราคา ${d.job.price ?? 'ไม่พบ'} · ${d.fields.find(f => f.key === 'qty')?.value || ''}
บรรทัดปัจจุบัน: ${JSON.stringify(lines)}`;
}
// ตรวจข้อเสนอ AI: ต้องมีหลักฐานในบรีฟจริง + ตัวเลขสมเหตุผล → ใช้ได้เฉพาะที่ผ่าน
export function applyAi(d: NsrDraft, brief: string, raw: any): { draft: NsrDraft; used: number; rejected: string[]; notes: string[] } {
  const norm = (s: string) => cleanBrief(s).ar.replace(/\s+/g, '');
  const B = norm(brief); const rejected: string[] = []; let used = 0;
  const job: NsrJob = JSON.parse(JSON.stringify(d.job)); const fields = [...d.fields];
  const list: AiSuggest[] = Array.isArray(raw?.suggest) ? raw.suggest : [];
  for (const s of list.slice(0, 20)) {
    const q = String(s?.quote || '');
    if (!q || !B.includes(norm(q))) { rejected.push(`${s?.key}: ไม่พบหลักฐานในบรีฟ`); continue; }
    const ok = (v: any, lo: number, hi: number) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
    if (s.key === 'participants' || s.key === 'teachers') { if (!ok(s.value, 1, 5000)) { rejected.push(`${s.key}: ตัวเลขไม่สมเหตุผล`); continue; } (job as any)[s.key] = s.value; used++; fields.push({ key: s.key, label: s.key === 'participants' ? 'ผู้เข้าร่วม' : 'คุณครู', value: `${s.value} คน`, src: 'AI', note: `“${q}”` }); continue; }
    if (s.key === 'price') { if (!ok(s.value, 100, 100000)) { rejected.push('price: ตัวเลขไม่สมเหตุผล'); continue; } job.price = s.value!; used++; fields.push({ key: 'price', label: 'ราคาขาย / ท่าน', value: `${fmtN(s.value!)} บาท`, src: 'AI', note: `“${q}”` }); continue; }
    let l = job.lines.find(x => (x.key || keyOf(x.label)) === s.key);
    if (!l) { l = { label: s.key, price: null, qty: 1, key: s.key as LineKey }; job.lines.push(l); }
    if (l.auto && !(['vehicle', 'foreign'].includes(String(s.key)) && s.price == null)) { rejected.push(`${s.key}: บรรทัดนี้ใช้สูตรทีม`); continue; }
    if (s.price != null && !ok(s.price, 0, 50000)) { rejected.push(`${s.key}: ราคาไม่สมเหตุผล`); continue; }
    if (s.qty != null && !ok(s.qty, 0, 100)) { rejected.push(`${s.key}: จำนวนไม่สมเหตุผล`); continue; }
    if (s.price != null) l.price = Math.round(s.price * 100) / 100;
    if (s.qty != null) l.qty = s.qty;
    used++; fields.push({ key: String(s.key), label: l.label, value: [s.price != null ? `${fmtN(s.price)} บาท` : '', s.qty != null ? `× ${s.qty}` : ''].filter(Boolean).join(' '), src: 'AI', note: `“${q}”${s.reason ? ' — ' + s.reason : ''}` });
  }
  const notes = (Array.isArray(raw?.notes) ? raw.notes : []).map((x: any) => String(x).slice(0, 200)).slice(0, 5);
  return { draft: { ...d, job, fields }, used, rejected, notes };
}
