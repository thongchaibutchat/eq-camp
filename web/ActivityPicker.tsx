// เลือกกิจกรรมเข้าโปรแกรม — คลังกิจกรรมจริงทุกหลักสูตร แยกหมวด (CAT_ACTS) · ติ๊กแล้วระบบดึงลงกำหนดการให้ (applyPicks ใน core)
import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, X, Search } from 'lucide-react';
import {
  CAT_ACTS, CAT_COURSES, GROUP_LABEL, GROUP_ORDER, pickName, pickMinutes, pickTargets, findInPlan, buildSchedule,
} from '../src/eqcamp-core';
import type { Camp, ActPick, CatAct, CatGroup, PickPlace } from '../src/eqcamp-core';
import { usePastIndex } from './PastLibrary';
import { realUseOf, shortDate, courseName } from './past-library';
import type { RealAct } from './past-library';
import { hubReady } from './hub';

type Plan = ReturnType<typeof buildSchedule>;
const norm = (s: string) => String(s || '').toLowerCase().replace(/[๐-๙]/g, d => String('๐๑๒๓๔๕๖๗๘๙'.indexOf(d))).replace(/[\s\-–.,:;“”"'()/&]+/g, '');
const courseLabel = (code: string) => CAT_COURSES.find(c => c.c === code)?.label || code;
const minText = (m: number) => m ? `${m} นาที` : '';
const realText = (a: CatAct) => a.r === 'S' ? `ใช้จริง ${a.p} โปรแกรม` : a.r === 'C' ? 'เคยอยู่เฉพาะหน้าปก' : 'ยังไม่เคยลงโปรแกรมจริง';

export function placeText(pl?: PickPlace): string {
  if (!pl) return '';
  const at = pl.day ? `วันที่ ${pl.day} · ${pl.time}` : '';
  switch (pl.how) {
    case 'exists': return `มีในกำหนดการแล้ว · ${at}`;
    case 'replace': return `${at} · แทน “${short(pl.target)}”`;
    case 'filler': return `${at} · แทนช่วงต่อยอด`;
    case 'auto': return `${at} · แทนช่องที่ระบบเติม (“${short(pl.target)}”)`;
    case 'split': return `${at} · แบ่งเวลาจากช่วงยาว`;
    case 'insert': return `${at} · แทรกแล้วเลื่อนเวลา (เลิกช้าลง)`;
    case 'missing': return 'หาช่วงที่เลือกไม่เจอ — เลือกช่วงใหม่';
  }
}
const short = (s?: string) => { const x = String(s || '').replace(/\s+/g, ' ').trim(); return x.length > 42 ? x.slice(0, 40) + '…' : x; };

export default function ActivityPicker({ camp, plan, set }: { camp: Camp; plan: Plan; set: (p: Partial<Camp>) => void }) {
  const picks = camp.picks || [];
  const [course, setCourse] = useState<string>(camp.courseCode && CAT_COURSES.some(c => c.c === camp.courseCode) ? camp.courseCode : CAT_COURSES[0].c);
  useEffect(() => { if (camp.courseCode && CAT_COURSES.some(c => c.c === camp.courseCode)) setCourse(camp.courseCode); }, [camp.courseCode]);
  const [q, setQ] = useState('');
  const [typed, setTyped] = useState('');
  const [shut, setShut] = useState<Partial<Record<CatGroup, boolean>>>({ sub: true });

  const idx = usePastIndex();
  const counts = useMemo(() => { const m: Record<string, number> = {}; for (const a of CAT_ACTS) m[a.c] = (m[a.c] || 0) + 1; return m; }, []);
  const order = useMemo(() => { const own = camp.courseCode; return [...CAT_COURSES].sort((a, b) => (a.c === own ? -1 : b.c === own ? 1 : 0)); }, [camp.courseCode]);
  const words = norm(q) ? q.trim().split(/\s+/).map(norm).filter(Boolean) : [];
  const list = words.length
    ? CAT_ACTS.filter(a => { const hay = norm(`${a.n} ${(a.a || []).join(' ')} ${courseLabel(a.c)} ${a.c}`); return words.every(w => hay.includes(w)); })
    : CAT_ACTS.filter(a => a.c === course);
  const groups = GROUP_ORDER.map(g => ({ g, items: list.filter(a => a.g === g) })).filter(x => x.items.length);
  // กิจกรรมจากงานจริงที่ยังไม่อยู่ในคลังเว็บ (อ่านจากโปรแกรม Word ที่ทีมส่งแล้ว — หน้างานเก่า)
  const realNew: RealAct[] = words.length
    ? Object.values(idx.newByCourse).flat().filter(a => { const hay = norm(`${a.n} ${courseName(a.c)} ${a.c}`); return words.every(w => hay.includes(w)); })
    : (idx.newByCourse[course] || []);
  const nameIdx = (n: string) => picks.findIndex(p => !p.id && p.name === n);
  const toggleReal = (a: RealAct) => { const i = nameIdx(a.n); set({ picks: i >= 0 ? picks.filter((_, j) => j !== i) : [...picks, { name: a.n, ...(a.min ? { min: a.min } : {}) }] }); };
  const [realOpen, setRealOpen] = useState(true);

  const idxOf = (id: string) => picks.findIndex(p => p.id === id);
  const toggle = (a: CatAct) => { const i = idxOf(a.i); set({ picks: i >= 0 ? picks.filter((_, j) => j !== i) : [...picks, { id: a.i }] }); };
  const upd = (i: number, patch: Partial<ActPick> | null) => {
    const next = [...picks];
    if (patch === null) next.splice(i, 1); else next[i] = { ...next[i], ...patch };
    set({ picks: next.length ? next.map(p => { const o: ActPick = { ...p }; if (!o.at) delete o.at; if (!o.min) delete o.min; return o; }) : undefined });
  };
  const move = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= picks.length) return; const next = [...picks]; [next[i], next[j]] = [next[j], next[i]]; set({ picks: next }); };
  const addTyped = () => { const n = typed.replace(/\s+/g, ' ').trim(); if (!n) return; set({ picks: [...picks, { name: n }] }); setTyped(''); };
  const targets = pickTargets(plan);
  const placeOf = (i: number) => (plan.picks || []).find(x => x.idx === i);

  return (
    <div className="bg-white border border-brand-mist rounded-xl p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-[15.5px] font-semibold">เลือกกิจกรรมเข้าโปรแกรม</div>
        <div className="text-[13px] text-sub">คลังกิจกรรมจริง {CAT_ACTS.length} รายการ · 14 หลักสูตร</div>
      </div>
      <p className="text-[13px] text-sub mt-0.5">ติ๊กกิจกรรมที่ต้องการ ระบบใส่ลงกำหนดการให้ในขั้นถัดไป เลือกได้ว่าจะแทนช่วงไหน หรือพิมพ์ชื่อกิจกรรมเองก็ได้</p>

      {picks.length > 0 && (
        <div className="mt-3 border border-brand-mist rounded-xl overflow-hidden" aria-label="กิจกรรมที่จะดึงเข้าโปรแกรม">
          <div className="bg-paper px-3 py-2 text-[13.5px] font-semibold flex items-center justify-between">
            <span>ดึงเข้าโปรแกรม {picks.length} กิจกรรม</span>
            <button onClick={() => set({ picks: undefined })} className="tap text-[12.5px] font-normal text-sub underline">ล้างทั้งหมด</button>
          </div>
          <ol className="divide-y divide-slate-100">
            {picks.map((p, i) => {
              const pl = placeOf(i); const name = pickName(p); const a = p.id ? CAT_ACTS.find(x => x.i === p.id) : undefined; const real = !a && p.name ? Object.values(idx.newByCourse).flat().find(x => x.n === p.name) : undefined;
              const own = p.at && !targets.some(t => `${t.day}|${t.key}` === p.at);
              const warn = pl && (pl.how === 'insert' || pl.how === 'missing');
              return (
                <li key={(p.id || p.name || '') + i} className="px-3 py-2.5 flex gap-2" data-pick={name}>
                  <div className="flex flex-col shrink-0">
                    <button onClick={() => move(i, -1)} disabled={i === 0} aria-label={`เลื่อน ${name} ขึ้น`} className="text-slate-400 disabled:opacity-30 hover:text-brand-ink"><ChevronUp size={16} /></button>
                    <button onClick={() => move(i, 1)} disabled={i === picks.length - 1} aria-label={`เลื่อน ${name} ลง`} className="text-slate-400 disabled:opacity-30 hover:text-brand-ink"><ChevronDown size={16} /></button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-semibold leading-snug">{name}
                      <span className="ml-1.5 text-[12px] font-normal text-sub">{a ? courseLabel(a.c) : real ? `${courseName(real.c)} · จากงานจริง` : 'พิมพ์เอง'}</span></div>
                    <div className={`text-[12.5px] mt-0.5 ${warn ? 'text-amber-700' : 'text-sub'}`}>{placeText(pl) || 'กำลังจัด…'}</div>
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      <select value={p.at || ''} onChange={e => upd(i, { at: e.target.value })} aria-label={`ตำแหน่งของ ${name}`}
                        className="max-w-full min-w-0 flex-1 border border-brand-mist rounded-lg px-2 py-1.5 text-[13px] bg-white">
                        <option value="">ใส่อัตโนมัติ</option>
                        {own && <option value={p.at}>{pl && pl.day ? `วันที่ ${pl.day} · ${pl.time} · แทน “${short(pl.target)}”` : 'ช่วงที่เลือกไว้เดิม'}</option>}
                        {targets.map(t => <option key={`${t.day}|${t.key}`} value={`${t.day}|${t.key}`}>{`แทน วันที่ ${t.day} · ${t.time} · ${short(t.title)}`}</option>)}
                      </select>
                      {!p.at && pl?.how !== 'exists' && (
                        <select value={pickMinutes(p)} onChange={e => upd(i, { min: +e.target.value })} aria-label={`ความยาวของ ${name}`}
                          className="border border-brand-mist rounded-lg px-2 py-1.5 text-[13px] bg-white">
                          {Array.from(new Set([30, 45, 60, 90, 120, pickMinutes(p)])).sort((x, y) => x - y).map(m => <option key={m} value={m}>{m} นาที</option>)}
                        </select>)}
                    </div>
                  </div>
                  <button onClick={() => upd(i, null)} aria-label={`เอา ${name} ออก`} className="tap self-start shrink-0 p-1 rounded-md text-slate-400 hover:text-rose-600"><X size={16} /></button>
                </li>);
            })}
          </ol>
          {(plan.pickWarn || []).map(w => <div key={w} className="text-[13px] text-amber-800 bg-amber-50 px-3 py-2 border-t border-amber-100">{w}</div>)}
        </div>
      )}

      <div className="mt-3 relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหากิจกรรมทุกหลักสูตร เช่น rocket, ดาว, ปาร์ตี้" aria-label="ค้นหากิจกรรม"
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-brand-mist bg-white text-[15px] focus:outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15" />
      </div>

      {!words.length && (
        <div className="mt-2.5 -mx-1 px-1 flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="หลักสูตร">
          {order.map(c => { const on = c.c === course; return (
            <button key={c.c} role="tab" aria-selected={on} onClick={() => setCourse(c.c)}
              className={`tap shrink-0 px-3 py-1.5 rounded-lg text-[13px] border ${on ? 'bg-brand-navy text-white border-brand-navy' : 'border-brand-mist text-brand-ink hover:bg-paper'}`}>
              {c.label} <span className={on ? 'text-white/75' : 'text-sub'}>{counts[c.c] || 0}</span>{c.c === camp.courseCode && <span className={`ml-1 text-[11px] ${on ? 'text-white/75' : 'text-sub'}`}>· งานนี้</span>}
            </button>); })}
        </div>
      )}

      <div className="mt-2 text-[13px] text-sub">
        {words.length
          ? <>พบ <b className="text-brand-ink">{list.length}</b> กิจกรรม{list.length ? ` จาก ${new Set(list.map(a => a.c)).size} หลักสูตร` : ''}</>
          : <><b className="text-brand-ink">{CAT_COURSES.find(c => c.c === course)?.name}</b> — {list.length} กิจกรรม · {groups.map(g => `${GROUP_LABEL[g.g].split(' / ')[0]} ${g.items.length}`).join(' · ')}</>}
      </div>

      <div className="mt-2 space-y-2">
        {groups.map(({ g, items }) => {
          const closed = !words.length && !!shut[g];
          return (
            <section key={g} className="border border-slate-200 rounded-xl">
              <button onClick={() => setShut(s => ({ ...s, [g]: !closed }))} aria-expanded={!closed}
                className="tap w-full flex items-center justify-between px-3 py-2 text-[14px] font-semibold">
                <span>{GROUP_LABEL[g]} <span className="text-sub font-normal">{items.length}</span></span>
                {closed ? <ChevronDown size={16} className="text-sub" /> : <ChevronUp size={16} className="text-sub" />}
              </button>
              {!closed && (
                <ul className="border-t border-slate-100 divide-y divide-slate-100">
                  {items.map(a => {
                    const on = idxOf(a.i) >= 0; const inPlan = !on && findInPlan(a.n, plan);
                    return (
                      <li key={a.i}>
                        <label className={`flex items-start gap-2.5 px-3 py-2 cursor-pointer ${on ? 'bg-paper' : 'hover:bg-slate-50'}`}>
                          <input type="checkbox" checked={on} onChange={() => toggle(a)} className="mt-1 w-4 h-4 accent-[#0C2A41] shrink-0" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-[14px] leading-snug">{a.n}
                              {words.length > 0 && <span className="ml-1.5 text-[12px] text-sub">{courseLabel(a.c)}</span>}
                              {inPlan && <span className="ml-1.5 inline-block px-1 rounded bg-brand-mist text-brand-navy text-[11px] font-semibold align-middle">มีในกำหนดการ</span>}
                            </span>
                            <span className="block text-[12px] text-sub">{(() => { const u = realUseOf(a, idx); return [minText(a.m), u ? `งานจริงปีนี้ ${u.progs} งาน · ล่าสุด ${shortDate(u.last)}` : realText(a), a.a && a.a.length ? `เรียกอีกอย่าง ${a.a.slice(0, 2).join(', ')}` : '', a.d || ''].filter(Boolean).join(' · '); })()}</span>
                          </span>
                        </label>
                      </li>);
                  })}
                </ul>)}
            </section>);
        })}
        {realNew.length > 0 && (
          <section className="border border-slate-200 rounded-xl" aria-label="กิจกรรมจากงานจริงที่ยังไม่อยู่ในคลัง">
            <button onClick={() => setRealOpen(v => !v)} aria-expanded={realOpen} className="tap w-full flex items-center justify-between px-3 py-2 text-[14px] font-semibold">
              <span>จากงานจริงที่ทีมส่งแล้ว (ยังไม่อยู่ในคลัง) <span className="text-sub font-normal">{realNew.length}</span></span>
              {realOpen ? <ChevronUp size={16} className="text-sub" /> : <ChevronDown size={16} className="text-sub" />}
            </button>
            {realOpen && (
              <ul className="border-t border-slate-100 divide-y divide-slate-100">
                {realNew.slice(0, 60).map(a => { const on = nameIdx(a.n) >= 0; const inPlan = !on && findInPlan(a.n, plan); return (
                  <li key={a.c + a.k}>
                    <label className={`flex items-start gap-2.5 px-3 py-2 cursor-pointer ${on ? 'bg-paper' : 'hover:bg-slate-50'}`}>
                      <input type="checkbox" checked={on} onChange={() => toggleReal(a)} className="mt-1 w-4 h-4 accent-[#0C2A41] shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] leading-snug">{a.n}
                          {words.length > 0 && <span className="ml-1.5 text-[12px] text-sub">{courseName(a.c)}</span>}
                          {inPlan && <span className="ml-1.5 inline-block px-1 rounded bg-brand-mist text-brand-navy text-[11px] font-semibold align-middle">มีในกำหนดการ</span>}</span>
                        <span className="block text-[12px] text-sub">{[a.min ? `${a.min} นาที` : '', `ใช้ในงานจริง ${a.progs} งาน · ล่าสุด ${shortDate(a.last)}`].filter(Boolean).join(' · ')}</span>
                      </span>
                    </label>
                  </li>); })}
              </ul>)}
          </section>
        )}
        {!groups.length && !realNew.length && <div className="text-[13.5px] text-sub px-1 py-3">ไม่พบกิจกรรมที่ตรงคำค้น — พิมพ์ชื่อเองด้านล่างได้</div>}
        {!idx.programs && hubReady() && !words.length && <div className="text-[12.5px] text-sub px-1">ยังไม่ได้ดึงกิจกรรมจากโปรแกรมจริงของทีม — <a href="#/past" className="text-brand-navy underline underline-offset-2">ไปหน้างานเก่า แล้วกด “อ่านทุกงาน”</a></div>}
      </div>

      <div className="mt-3 flex gap-2">
        <input value={typed} onChange={e => setTyped(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addTyped(); }} placeholder="พิมพ์ชื่อกิจกรรมเอง" aria-label="พิมพ์ชื่อกิจกรรมเอง"
          className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-brand-mist bg-white text-[15px] focus:outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15" />
        <button onClick={addTyped} disabled={!typed.trim()} className="tap shrink-0 px-4 py-2.5 rounded-xl text-[14px] font-semibold bg-brand-navy text-white disabled:opacity-40">เพิ่ม</button>
      </div>
    </div>
  );
}
