import { Packer } from 'docx';
import * as fs from 'fs';
import { packDocx, buildDoc, blankCamp, defaultActs, defaultCourseActs, parseBrief, buildSchedule, coursePhotos, subjectPool, Camp, DocKind, COURSES } from '../src/eqcamp-core';

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
configs.push({ name:'photos_CUR014', camp: (()=>{ const c=mk({courseCode:'PL ENG 0104', school:'ร.ร.ภาพ', students:110, teachers:8, durationMode:'overnight', days:2, nights:1, venue:'ว', venueVisit:'x', normalPrice:4000, specialPrice:3000, costPerPerson:1800}); c.actImgs=coursePhotos('PL ENG 0104',4); return c; })() });

let fail = 0, ok = 0;
(async () => {
  const manifest: string[] = [];
  for (const cfg of configs) {
    for (const kind of kinds) {
      const fn = `${cfg.name}__${kind}.docx`;
      try {
        const plan = buildSchedule(cfg.camp);
        // ตรวจ: ทุกวันต้องมีอย่างน้อย 1 แถว (ตารางว่าง = docx พัง)
        for (const d of plan.days) if (!d.items.length) throw new Error(`day ${d.day} has 0 rows`);
        const buf = Buffer.from(await packDocx(buildDoc(kind, cfg.camp, plan)));
        if (!buf || buf.length < 500) throw new Error('buffer too small');
        if (!(buf[0]===0x50 && buf[1]===0x4b)) throw new Error('not a zip (PK)');
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
