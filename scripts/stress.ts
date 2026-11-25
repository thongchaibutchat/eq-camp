import JSZip from 'jszip';
import { Packer } from 'docx';
import * as fs from 'fs';
import { packDocx, buildDoc, blankCamp, defaultActs, defaultCourseActs, parseBrief, buildSchedule, compose, check, photoIdsFor, photoCaption, subjectPool, actInSchedule, joinedCodes, TITLE_TH, TITLE_EN, dayEndOf, parseHM, moveRow, CAT_ACTS, catActsOf, pickTargets, pickTitle, Camp, DocKind, COURSES, TEMPLATES, Img } from '../src/eqcamp-core';
// คำผิดที่รู้จัก — รายการกลาง data/typo-fixes.json
const TYPO_JSON = JSON.parse(fs.readFileSync('data/typo-fixes.json', 'utf8'));
const TYPO_BAD: string[] = TYPO_JSON.fixes.map((f: string[]) => f[0]).filter((w: string) => w.trim().length > 1);
const TYPO_RE: RegExp[] = TYPO_JSON.regex.map((r: string[]) => new RegExp(r[0]));

const OUT = '/tmp/stress'; fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const kinds: DocKind[] = ['program', 'quotation', 'booking', 'runsheet'];

function mk(partial: Partial<Camp>): Camp {
  const c = blankCamp();
  Object.assign(c, partial);
  if (c.courseCode) c.activityIds = defaultCourseActs(c.courseCode);
  else if (!c.activityIds.length) c.activityIds = defaultActs(c.subject);
  return c;
}

const configs: { name: string; camp: Camp }[] = [];
// 1. ทุก duration mode × วิชา
for (const subj of ['math','steam','english','ai','chinese','leadership'] as const) {
  configs.push({ name:`half_${subj}`, camp: mk({ subject:subj, school:'ร.ร.ทดสอบ', students:40, teachers:3, durationMode:'half', days:1, nights:0, dates:'1 ม.ค. 2570', province:'เลย', venue:'โรงแรมทดสอบ', normalPrice:2000, specialPrice:1500, costPerPerson:900, startTime:'08.00', travelHours:2 }) });
  configs.push({ name:`day_${subj}`, camp: mk({ subject:subj, school:'ร.ร.ทดสอบ', students:60, teachers:4, durationMode:'day', days:1, nights:0, dates:'1 ม.ค. 2570', province:'ระยอง', venue:'โรงแรมทดสอบ', normalPrice:3000, specialPrice:2200, costPerPerson:1200, startTime:'06.30', travelHours:3 }) });
  configs.push({ name:`over_${subj}`, camp: mk({ subject:subj, school:'ร.ร.ทดสอบ', students:120, teachers:8, durationMode:'overnight', days:3, nights:2, dates:'1-3 ม.ค. 2570', province:'ชลบุรี', venue:'โรงแรมทดสอบ', venueVisit:'แหล่งเรียนรู้ทดสอบ', normalPrice:5000, specialPrice:3500, costPerPerson:2000, startTime:'07.00', travelHours:4 }) });
}
// 2. ทุกหลักสูตรจริง (14) overnight + day
for (const co of COURSES) {
  const base = { courseCode: co.code, school:'ร.ร.หลักสูตร', students:100, teachers:7, dates:'1-2 ม.ค. 2570', province:'นครนายก', venue:'โรงแรมหลักสูตร', venueVisit:'แหล่งเรียนรู้', normalPrice:4000, specialPrice:3000, costPerPerson:1800, startTime:'07.00', travelHours:3 };
  configs.push({ name:`CUR_${co.code}_over`, camp: mk({ ...base, durationMode:'overnight', days:2, nights:1 }) });
  configs.push({ name:`CUR_${co.code}_day`, camp: mk({ ...base, durationMode:'day', days:1, nights:0 }) });
  configs.push({ name:`CUR_${co.code}_half`, camp: mk({ ...base, durationMode:'half', days:1, nights:0 }) });
}
// 3. extreme / แย่ที่สุด
configs.push({ name:'zero_activities', camp: (()=>{ const c=blankCamp(); Object.assign(c,{subject:'chinese', school:'ร.ร.ว่าง', students:30, teachers:2, durationMode:'overnight', days:4, nights:3, dates:'x', venue:'ว', normalPrice:1000, specialPrice:800, costPerPerson:500}); c.activityIds=[]; return c; })() });
configs.push({ name:'zero_students', camp: mk({ subject:'math', school:'ร.ร.', students:0, teachers:0, durationMode:'day', days:1, nights:0, venue:'ว', normalPrice:0, specialPrice:0, costPerPerson:0 }) });
configs.push({ name:'weird_time', camp: mk({ subject:'ai', school:'ร.ร.', students:300, teachers:16, durationMode:'overnight', days:2, nights:1, venue:'ว', startTime:'เช้า', travelHours:NaN as any, normalPrice:9, specialPrice:9, costPerPerson:9 }) });
configs.push({ name:'special_chars', camp: mk({ subject:'steam', school:'ร.ร. <A&B> "คำ" \u0000x', level:'ม.1&2', students:50, teachers:3, durationMode:'half', days:1, nights:0, venue:'โรงแรม <tag> & "ชื่อ"', venueVisit:'a<b>&c', normalPrice:2000, specialPrice:1500, costPerPerson:900 }) });
configs.push({ name:'long_overnight_7d', camp: mk({ subject:'english', school:'ร.ร.ยาว', students:80, teachers:6, durationMode:'overnight', days:7, nights:6, venue:'ว', venueVisit:'x', normalPrice:9000, specialPrice:7000, costPerPerson:4000, startTime:'05.00', travelHours:8 }) });
const withPhotos = (c: Camp): Camp => { c.actImgs = photoIdsFor(c).map((id, i): Img => ({ data: new Uint8Array(fs.readFileSync('web/photos/' + id + '.jpg')), caption: photoCaption(c, i), src: id })); return c; };
configs.push({ name:'photos_CUR014', camp: withPhotos(mk({courseCode:'PL ENG 0104', school:'ร.ร.ภาพ', students:110, teachers:8, durationMode:'overnight', days:2, nights:1, venue:'ว', venueVisit:'x', normalPrice:4000, specialPrice:3000, costPerPerson:1800})) });
// 4. แม่แบบจริงทุกชุด (45) — บังคับเลือกด้วย templateId · ทั้งแบบมี/ไม่มีชื่อโรงเรียน-ที่พัก (ทดสอบตัวแปร ⟦…⟧)
for (const t of TEMPLATES) {
  const dm = t.dur.startsWith('day') ? 'day' : 'overnight';
  const days = dm === 'day' ? +t.dur.slice(3) : +t.dur.charAt(1), nights = dm === 'day' ? 0 : +t.dur.slice(2);
  const tag = t.id.replace(/\s+/g, '_');
  configs.push({ name:`TPL_${tag}`, camp: withPhotos(mk({ courseCode:t.code, templateId:t.id, school:'โรงเรียนทดสอบแม่แบบ', students:95, teachers:7, durationMode:dm as any, days, nights, dates:'วันที่ 1 – 3 กุมภาพันธ์ 2570', province:'นครนายก', venue:'โรงแรมทดสอบ', normalPrice:4000, specialPrice:3000, costPerPerson:1800, startTime:'06.30' })) });
  configs.push({ name:`TPLblank_${tag}`, camp: mk({ courseCode:t.code, templateId:t.id, school:'', students:40, teachers:0, durationMode:dm as any, days, nights, dates:'', province:'', venue:'', normalPrice:0, specialPrice:0, costPerPerson:0, startTime:'' }) });
}

// 5. กิจกรรมเสริม (Add-on): ทุกแม่แบบ + engine ครึ่งวัน/ไป-กลับ/พักค้าง × อังกฤษ+จีน+คณิต (มี/ไม่มีราคาเพิ่ม)
const ADD_ALL = [{ code:'PL ENG 0104', price:300 }, { code:'PL CHI 0109', minutes:90 }, { code:'PL MAT 0107', price:0 }];
for (const t of TEMPLATES) {
  const dm = t.dur.startsWith('day') ? 'day' : 'overnight';
  const days = dm === 'day' ? +t.dur.slice(3) : +t.dur.charAt(1), nights = dm === 'day' ? 0 : +t.dur.slice(2);
  configs.push({ name:`ADD_${t.id.replace(/\s+/g, '_')}`, camp: mk({ courseCode:t.code, templateId:t.id, school:'โรงเรียนทดสอบเสริม', students:60, teachers:4, durationMode:dm as any, days, nights, dates:'x', province:'', venue:'ว', normalPrice:4000, specialPrice:3000, costPerPerson:1800, addons: ADD_ALL } as any) });
}
for (const [dm, d, n] of [['half',1,0],['day',1,0],['day',3,0],['overnight',2,1],['overnight',4,3]] as const)
  configs.push({ name:`ADDeng_${dm}${d}${n}`, camp: mk({ courseCode:'PL STM 0101', templateId:'engine', school:'ร.ร.', students:40, teachers:2, durationMode:dm as any, days:d, nights:n, venue:'ว', normalPrice:3000, specialPrice:2500, costPerPerson:1000, addons: [{ code:'PL ENG 0104', ids:['__missing__'] }, { code:'PL CHI 0109', price:250 }] } as any) });

// 6. ธีมรายวัน (mix หลักสูตร): ทุกแม่แบบ × หลักสูตรอื่นหมุนเวียนในวันที่ 2+ (+ Add-on บางชุด) · engine ครึ่งวัน/ไป-กลับ/พักค้าง
TEMPLATES.forEach((t, k) => {
  const dm = t.dur.startsWith('day') ? 'day' : 'overnight';
  const days = dm === 'day' ? +t.dur.slice(3) : +t.dur.charAt(1), nights = dm === 'day' ? 0 : +t.dur.slice(2);
  if (days < 2) return;
  const others = COURSES.filter(x => x.code !== t.code);
  const dc = Array.from({ length: days }, (_, i) => i === 0 ? '' : others[(k + i) % others.length].code);
  configs.push({ name:`MIX_${t.id.replace(/\s+/g, '_')}`, camp: mk({ courseCode:t.code, templateId:t.id, school:'โรงเรียนทดสอบผสม', students:70, teachers:5, durationMode:dm as any, days, nights, dates:'x', province:'', venue:'ว', normalPrice:4000, specialPrice:3200, costPerPerson:1800, dayCourses: dc, addons: k % 3 === 0 ? [{ code:'PL CHI 0109', price:200 }] : undefined } as any) });
});
for (const [dm, d, n] of [['day',2,0],['day',3,0],['overnight',2,1],['overnight',3,2],['overnight',4,3]] as const)
  configs.push({ name:`MIXeng_${dm}${d}${n}`, camp: mk({ courseCode:'PL ENG 0104', templateId:'engine', school:'ร.ร.', students:40, teachers:2, durationMode:dm as any, days:d, nights:n, venue:'ว', normalPrice:3000, specialPrice:2500, costPerPerson:1000, dayCourses: ['', 'PL SEA 0103', 'PL STM 0101', 'not-a-course'] } as any) });

// 7. ธีมปาร์ตี้ + แก้ไขแถว + แก้รายการกิจกรรมเอง (พักค้างทุกแม่แบบ)
TEMPLATES.filter(t => t.dur.startsWith('o')).forEach((t, k) => {
  const days = +t.dur.charAt(1), nights = +t.dur.slice(2);
  const base = mk({ courseCode:t.code, templateId:t.id, school:'โรงเรียนทดสอบแก้ไข', students:60, teachers:4, durationMode:'overnight', days, nights, dates:'x', province:'', venue:'ว', normalPrice:4000, specialPrice:3000, costPerPerson:1800 });
  const p0 = buildSchedule(base); const r0 = p0.days[0].items[1];
  configs.push({ name:`EDIT_${t.id.replace(/\s+/g, '_')}`, camp: { ...base, partyTheme: ['Under The Sea', 'ย้อนยุค 90s', 'Hawaii <Night> & "Fun"'][k % 3], rowEdits: [{ day: 1, from: r0.title, to: 'กิจกรรม “ทดสอบแก้ไขแถว”', time: '09.15 – 10.00 น.' }, { day: days, from: p0.days[days - 1].items[0].title, to: '' }, { day: 9, from: 'ไม่มี' }],
    actsOverride: k % 2 ? ['กิจกรรม “ทดสอบแก้ไขแถว”', '', 'ข้อความที่ไม่มีในกำหนดการ'] : undefined } as any });
});

// 8. ขยายเวลาเลิก + เพิ่มช่วงเวลาเอง: ทุกแม่แบบ (วันสุดท้ายจบ 16.00/17.00) + engine ไป-กลับ/พักค้าง + ค่าแย่ (เวลาเดิม/อ่านไม่ได้/วันไม่มี)
TEMPLATES.forEach((t, k) => {
  const dm = t.dur.startsWith('o') ? 'overnight' : t.dur === 'half' ? 'half' : 'day';
  const days = dm === 'overnight' ? +t.dur.charAt(1) : dm === 'day' ? (+t.dur.slice(3) || 1) : 1, nights = dm === 'overnight' ? +t.dur.slice(2) : 0;
  configs.push({ name:`EXT_${t.id.replace(/\s+/g, '_')}`, camp: mk({ courseCode:t.code, templateId:t.id, school:'โรงเรียนทดสอบขยาย', students:60, teachers:4, durationMode:dm as any, days, nights, dates:'x', province:'', venue:'ว', normalPrice:4000, specialPrice:3000, costPerPerson:1800,
    dayExtends: [{ day: days, end: k % 2 ? '17.00' : '16.00' }, { day: 9, end: '16.00' }],
    rowAdds: [{ day: 1, time: '10.00 – 10.15 น.', title: 'ถ่ายภาพหมู่ <ทั้งค่าย> & "ทีม"' }, { day: 1, time: 'ไม่ระบุ', title: 'รายการท้ายวัน' }, { day: 1, time: '', title: '' }] } as any) });
});
for (const [dm, d, n] of [['day', 1, 0], ['day', 2, 0], ['overnight', 2, 1], ['overnight', 3, 2]] as const)
  configs.push({ name:`EXTeng_${dm}${d}${n}`, camp: mk({ courseCode:'PL STM 0101', templateId:'engine', school:'ร.ร.', students:40, teachers:2, durationMode:dm as any, days:d, nights:n, venue:'ว', normalPrice:3000, specialPrice:2500, costPerPerson:1000,
    dayExtends: [{ day: d, end: '16.30' }, { day: 1, end: '07.00' }, { day: 1, end: 'xx' }], addons: [{ code:'PL ENG 0104' }] } as any) });

// 9. ลากย้ายช่วง + เวลาเลิกเร็วขึ้น (24 พ.ย. 2569): ทุกแม่แบบ — วันที่ 1 ย้ายแถว 4 → 2 · วันสุดท้ายเลิกเร็วขึ้น 90 นาที
TEMPLATES.forEach(t => {
  const dm = t.dur.startsWith('o') ? 'overnight' : t.dur === 'half' ? 'half' : 'day';
  const days = dm === 'overnight' ? +t.dur.charAt(1) : dm === 'day' ? (+t.dur.slice(3) || 1) : 1, nights = dm === 'overnight' ? +t.dur.slice(2) : 0;
  const base = mk({ courseCode:t.code, templateId:t.id, school:'โรงเรียนทดสอบลาก', students:60, teachers:4, durationMode:dm as any, days, nights, dates:'x', province:'', venue:'ว', normalPrice:4000, specialPrice:3000, costPerPerson:1800 } as any);
  const p0 = buildSchedule(base); const dl = p0.days[days - 1]; const e = dayEndOf(dl); const em = parseHM(e);
  const end = em !== null ? `${String(Math.floor((em - 90) / 60)).padStart(2, '0')}.${String((em - 90) % 60).padStart(2, '0')}` : '';
  const dayOrders = p0.days[0].items.length > 4 ? moveRow(base, p0, 1, 3, 1) : undefined;
  configs.push({ name:`MOVE_${t.id.replace(/\s+/g, '_')}`, camp: { ...base, dayOrders, ...(end ? { dayExtends: [{ day: days, end }] } : {}) } as any, base, short: end ? { day: days, end, was: e } : undefined } as any);
});

// 10. เลือกกิจกรรมจากคลังแยกหมวด (25 พ.ย. 2569): ทุกแม่แบบ + engine — ติ๊ก 3 จากหลักสูตรเดียวกัน + 1 จากหลักสูตรอื่น + พิมพ์เอง 1 + แทนช่วงที่ 2 + ตำแหน่งที่หาไม่เจอ
TEMPLATES.forEach((t, k) => {
  const dm = t.dur.startsWith('o') ? 'overnight' : t.dur === 'half' ? 'half' : 'day';
  const days = dm === 'overnight' ? +t.dur.charAt(1) : dm === 'day' ? (+t.dur.slice(3) || 1) : 1, nights = dm === 'overnight' ? +t.dur.slice(2) : 0;
  const own = catActsOf(t.code).filter(a => a.g === 'learn'), other = CAT_ACTS.filter(a => a.c !== t.code && a.g === 'learn');
  const base = mk({ courseCode:t.code, templateId: k % 5 === 4 ? 'engine' : t.id, school:'โรงเรียนทดสอบคลัง', students:60, teachers:4, durationMode:dm as any, days, nights, dates:'x', province:'', venue:'ว', normalPrice:4000, specialPrice:3000, costPerPerson:1800 } as any);
  const tg = pickTargets(buildSchedule(base))[1];
  const picks = [...own.slice(k % 3, k % 3 + 3).map(a => ({ id: a.i })), { id: other[(k * 7) % other.length].i }, { name: 'กิจกรรมพิมพ์เอง <ทดสอบ> & "ทีม"' }, ...(tg ? [{ id: other[(k * 11 + 3) % other.length].i, at: `${tg.day}|${tg.key}` }] : []), { name: 'ตำแหน่งหาย', at: '1|ไม่มีแถวนี้' }];
  configs.push({ name:`PICK_${t.id.replace(/\s+/g, '_')}`, camp: { ...base, picks } as any, picks: true } as any);
});

let fail = 0, ok = 0;
(async () => {
  const manifest: string[] = [];
  for (const cfg of configs) {
    for (const kind of kinds) {
      const fn = `${cfg.name}__${kind}.docx`;
      try {
        const plan = buildSchedule(cfg.camp);
        // ตรวจ: ห้ามมีตัวแปรแม่แบบค้าง/ชื่องานเดิมค้าง ในข้อความทุกส่วน
        const k = compose(cfg.camp, plan);
        const txt = JSON.stringify([plan.days, k.cover, k.budget, k.titleTh, k.titleEn]);
        const leaked = [/\{[SVPY]\}/, /[⟦⟧]/, /Kiangtalay|Aurora Resort|Flora May|Khanom Sunrise|Phumork|Chiangkhan River|BCP Hotel Rayong|Bella Villa|Kasalong|จันทรา รีสอร์ท|ธรรมวิทยามูลนิธิ|วัดราชบพิธ|สิงห์บุรี|เลยพิทยาคม|สายธรรมจันทร์|สิงห์สมุทร|ดอนเมืองทหารอากาศ|กาญจนาภิเษก|หนองแค|ชะอวด/]
          .filter(re => re.test(txt) && !(cfg.camp.venue && re.test(cfg.camp.venue)));
        if (leaked.length) throw new Error('template leak: ' + leaked.map(String).join(' '));
        if (plan.tpl && plan.tpl.exact && cfg.camp.durationMode !== 'overnight' && plan.days.some(d => d.items.some(r => /เช็คอิน|อาหารเย็น|พักผ่อนฝันดี|อาหารเช้า/.test(r.title)))) throw new Error('overnight row in day camp');
        void check(cfg.camp, plan);
        // ตรวจ: ทุกวันต้องมีอย่างน้อย 1 แถว (ตารางว่าง = docx พัง)
        for (const d of plan.days) if (!d.items.length) throw new Error(`day ${d.day} has 0 rows`);
        // ธีมรายวัน: ทุกวันต้องมีแถว + plan.mix ครบทุกวัน + เลขมื้อไม่ซ้ำ/เรียงต่อเนื่อง
        if ((cfg.camp as any).dayCourses && plan.mix) {
          if (plan.mix.length !== plan.days.length) throw new Error('mix length mismatch');
          const nums = plan.days.flatMap(d => d.items).map(r => r.title.match(/(?:รับประทานอาหาร(?:เช้า|กลางวัน|เที่ยง|เย็น)|Have \w+|Time for (?:lunch|breakfast|dinner))\S*\s*\((\d+)\)/i)).filter(Boolean).map(m => +m![1]);
          nums.forEach((v, i) => { if (v !== i + 1) throw new Error('meal numbering broken: ' + nums.join(',')); });
        }
        // กิจกรรมเชิงบูรณาการบนหน้าปกต้องตรงกับกำหนดการทุกข้อ (ยกเว้นทีมแก้เอง ซึ่งหน้าตรวจจะเตือนแทน)
        if (!(cfg.camp.actsOverride && cfg.camp.actsOverride.some(Boolean))) { const miss = k.acts.filter(a => !actInSchedule(a, plan)); if (miss.length) throw new Error('cover act not in schedule: ' + miss[0]); }
        if (cfg.camp.partyTheme && plan.days.some(d => d.items.some(r => r.party)) && !plan.days.some(d => d.items.some(r => r.party && r.title.includes(String(cfg.camp.partyTheme).trim())))) throw new Error('party theme not applied');
        // ชื่อค่ายรวมวิชา: มี Add-on/ธีมรายวัน → ชื่อไทยหรืออังกฤษต้องมีวิชาที่ร่วม · หน้าปกห้ามต่อท้ายบรรทัดระยะเวลา/สถานที่
        for (const code of joinedCodes(cfg.camp, plan)) {
          const both = `${k.titleTh} ${k.titleEn}`.replace(/\s+/g, '');
          if (!both.includes(TITLE_TH[code].replace(/\s+/g, '')) && !new RegExp(TITLE_EN[code], 'i').test(both)) throw new Error(`joined title missing ${code}: ${k.titleTh} ${k.titleEn}`);
        }
        for (const sec of k.cover) for (const r of sec.rows || []) if (/ระยะเวลา|สถานที่/.test(r[0]) && /กิจกรรมเสริม|วันที่ \d/.test(r[1].join(' '))) throw new Error('cover duration/venue line has add-on/mix note: ' + r[1].join(' '));
        // ขยายเวลาเลิก: วันที่ขยายต้องเลิกตรงเวลาที่ตั้ง · มีช่วงที่ขยาย · เวลาเริ่มไม่ย้อน · ช่วงที่เพิ่มเองต้องอยู่ในกำหนดการ
        for (const x of ((cfg.camp as any).dayExtends || []) as { day: number; end: string }[]) {
          const d = plan.days[x.day - 1]; if (!d || !/^\d{2}\.\d{2}$/.test(x.end)) continue;
          const before = buildSchedule({ ...cfg.camp, dayExtends: undefined } as any).days[x.day - 1];
          const tm = (s: string) => { const m = s.match(/(\d{1,2})[.:](\d{2})/); return m ? +m[1] * 60 + +m[2] : -1; };
          if (tm(dayEndOf(before)) + 15 > tm(x.end)) continue;            // เวลาที่ตั้งไม่เกินเวลาเดิม → ต้องไม่เปลี่ยน (เตือน)
          if (dayEndOf(d) !== x.end) throw new Error(`extend day ${x.day}: ends ${dayEndOf(d)} not ${x.end}`);
          if (!d.items.some(r => r.ext)) throw new Error(`extend day ${x.day}: no added rows`);
          let prev = -1; for (const r of d.items) { const v = tm(r.time); if (v < 0) continue; if (v + 1 < prev) throw new Error(`extend day ${x.day}: time goes back at ${r.time} ${r.title}`); prev = v; }
        }
        // ลากย้าย: วันที่ย้ายเลิกเวลาเดิม · เวลาไม่ย้อน · มีแถวติด "ย้ายแล้ว" · เลิกเร็วขึ้น: ตรงเวลาที่ตั้ง (หรือเตือนว่าเร็วเกิน)
        if ((cfg as any).base) {
          const tm2 = (s: string) => { const m = s.match(/(\d{1,2})[.:](\d{2})/); return m ? +m[1] * 60 + +m[2] : -1; };
          const sh = (cfg as any).short, b0 = buildSchedule({ ...(cfg as any).base, dayExtends: undefined } as any);
          if ((cfg.camp as any).dayOrders && !(sh && sh.day === 1)) {
            if (dayEndOf(plan.days[0]) !== dayEndOf(b0.days[0])) throw new Error(`move: day 1 end ${dayEndOf(b0.days[0])} → ${dayEndOf(plan.days[0])}`);
            if (!plan.days[0].items.some(r => r.moved)) throw new Error('move: no moved row');
          }
          const mono = (items: any[]) => { let prev = -1; for (const r of items) { const v = tm2(r.time); if (v < 0) continue; if (v + 1 < prev) return r; prev = v; } return null; };
          for (const d of plan.days) { if (mono(b0.days[d.day - 1]?.items || [])) continue;   // ต้นฉบับเวลาย้อนเอง = ไม่ใช่ผลของการลาก/ย่อ
            const bad = mono(d.items); if (bad) throw new Error(`move/short day ${d.day}: time goes back at ${bad.time} ${bad.title}`); }
          if (sh) { const got = dayEndOf(plan.days[sh.day - 1]); if (got !== sh.end && !(plan.extWarn || []).some(w => /เร็วเกินไป/.test(w))) throw new Error(`short day ${sh.day}: ${sh.was} → want ${sh.end} got ${got}`); }
        }
        // เลือกจากคลัง: ทุกรายการต้องมีผล · ที่ไม่ใช่ missing/exists ต้องมีแถวในกำหนดการ (ชื่อตรง) · ตำแหน่งที่หาไม่เจอ = แจ้ง ไม่เดา · เวลาเริ่มไม่ย้อนเพราะแถวที่แทรก
        if ((cfg as any).picks) {
          const ps = plan.picks || []; const want = ((cfg.camp as any).picks || []).length;
          if (ps.length !== want) throw new Error(`picks: ${ps.length}/${want} placed`);
          for (const p of ps) {
            if (p.how === 'missing' || p.how === 'exists') continue;
            if (!plan.days.some(d => d.items.some(r => r.picked === p.idx && r.title === p.title))) throw new Error('pick row missing: ' + p.title);
          }
          if (!ps.some(p => p.how === 'missing') || !(plan.pickWarn || []).some(w => /ไม่พบช่วงที่เลือก/.test(w))) throw new Error('missing target not warned');
          if (ps.some(p => p.how === 'replace') === false && ((cfg.camp as any).picks || []).some((x: any) => x.at && x.at !== '1|ไม่มีแถวนี้')) throw new Error('replace target not applied');
          for (const d of plan.days) { let prev = -1; for (const r of d.items) { const m = r.time.match(/(\d{1,2})[.:](\d{2})/); if (!m) continue; const v = +m[1] * 60 + +m[2]; if (r.picked !== undefined && v + 1 < prev) throw new Error(`pick time goes back day ${d.day}: ${r.time} ${r.title}`); prev = Math.max(prev, v); } }
        }
        for (const a of ((cfg.camp as any).rowAdds || []) as { day: number; title: string }[]) if (a.title && a.day <= plan.days.length && !plan.days[a.day - 1].items.some(r => r.title === a.title.trim())) throw new Error('rowAdd missing: ' + a.title);
        if (/ตัวอย่างกิจกรรม/.test(JSON.stringify(k.budget))) throw new Error('budget has stray heading');
        // Add-on: แถวเสริมต้องลงกำหนดการจริง · เวลาไม่ย้อนกลับในวัน (เริ่ม ≥ เริ่มแถวก่อนหน้า)
        if ((cfg.camp as any).addons) {
          const rows = plan.days.flatMap(d => d.items.filter(r => r.addon));
          if (!rows.length && (plan.addons || []).some(a => a.titles.length)) throw new Error('addon rows missing');
          for (const d of plan.days) { let prev = -1; for (const r of d.items) { const m = r.time.match(/(\d{1,2})[.:](\d{2})/); if (!m) continue; const v = +m[1] * 60 + +m[2]; if (r.addon && v < prev) throw new Error(`addon time goes back day ${d.day}: ${r.time}`); prev = Math.max(prev, v); } }
        }
        const buf = Buffer.from(await packDocx(buildDoc(kind, cfg.camp, plan)));
        if (!buf || buf.length < 500) throw new Error('buffer too small');
        if (!(buf[0]===0x50 && buf[1]===0x4b)) throw new Error('not a zip (PK)');
        const xml = await (await JSZip.loadAsync(buf)).file('word/document.xml')!.async('string');
        // เช็คลิสต์อุปกรณ์ Notion = เอกสารภายในเท่านั้น — ห้ามหลุดไปเอกสารลูกค้า/โรงแรม
        if (kind !== 'runsheet' && /เช็คลิสต์อุปกรณ์|มาตรฐานจาก Notion|ต้นทุน|กำไร/.test(xml)) throw new Error('internal content leaked into customer doc');
        // ตรวจข้อความทั้งเอกสาร: คำผิดที่รู้จัก (data/typo-fixes.json) + ค่าโปรแกรมหลุด (undefined/NaN/null/[object) + ตัวแปรแม่แบบค้าง
        const text = xml.replace(/<w:tab\/>/g, ' ').replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '');
        const bad = TYPO_BAD.filter(w => text.includes(w));
        if (bad.length) throw new Error('typo in doc: ' + bad.join(', '));
        if (TYPO_RE.some(re => re.test(text))) throw new Error('Thai text glued to "(" + English');
        const junk = text.match(/undefined|NaN|\bnull\b|\[object|\{[SVPY]\}|⟦|⟧/);
        if (junk) throw new Error('junk text in doc: ' + junk[0]);
        fs.writeFileSync(`${OUT}/${fn}`, buf);
        manifest.push(`${OUT}/${fn}`);
        ok++;
      } catch (e:any) { console.log(`FAIL ${fn}: ${e.message}`); fail++; }
    }
  }
  fs.writeFileSync(`${OUT}/_manifest.txt`, manifest.join('\n'));
  console.log(`\n=== docx build: ok=${ok} fail=${fail} (configs=${configs.length} × 4) ===`);
  if (fail > 0) process.exit(1);
})();
