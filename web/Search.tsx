import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search as SearchIcon, X, CornerDownLeft, BookOpen, Puzzle, Building2, FileText, Calculator, ClipboardList, Star, FolderOpen } from 'lucide-react';
import { readPastCache, pastJobs } from './past-data';
import { COURSES, LIB, NOTION_ACTIVITIES, courseLabel, actStandard, CAT_ACTS, GROUP_LABEL, venueDirectory } from '../src/eqcamp-core';
import { indexRow, pctText, NsrJob } from '../src/nsr-core';
import type { Job, TeamJob } from './jobs';
import { loadLocal, loadTeamEvents, summarize, dedupe, readTeam } from './registry';
import { hubReady } from './hub';
import { ago } from './jobs';

/* ค้นหาทั้งระบบ (กด / หรือ Ctrl+K): หลักสูตร · กิจกรรม 392 (Enter = ใส่ในงานนี้) · มาตรฐานกิจกรรม · ที่พัก · งานของทีม · ทะเบียนโปรแกรม · งาน NSR ทุกแท็บ
 * พิมพ์หลายคำได้ (ต้องพบครบทุกคำ) · เลขไทย/อารบิกเท่ากัน · ไม่สนเว้นวรรค · ↑↓ เลือก · Enter เปิด · กรองตามชนิด */
export type Go = { t: 'course' | 'useCourse' | 'job' | 'nsr' | 'stats' | 'past' | 'pick' | 'venue'; id: string } | { t: 'hub'; sec: string; q?: string };
type Kind = 'job' | 'past' | 'nsr' | 'program' | 'course' | 'activity' | 'standard' | 'venue';
interface Item { k: Kind; id: string; title: string; sub: string; badge?: string; tone?: string; when?: string; hay: string; tn: string; go: Go; alt?: { label: string; go: Go } }
const KIND: Record<Kind, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  job: { label: 'งาน', icon: FileText }, past: { label: 'งานเก่า', icon: FolderOpen }, nsr: { label: 'NSR', icon: Calculator }, program: { label: 'โปรแกรมที่สร้าง', icon: ClipboardList },
  course: { label: 'หลักสูตร', icon: BookOpen }, activity: { label: 'กิจกรรม', icon: Puzzle }, standard: { label: 'มาตรฐานกิจกรรม', icon: Star }, venue: { label: 'ที่พัก', icon: Building2 }
};
const ORDER: Kind[] = ['job', 'past', 'nsr', 'program', 'course', 'activity', 'standard', 'venue'];
const TH = '๐๑๒๓๔๕๖๗๘๙';
export const normQ = (s: string) => String(s || '').toLowerCase().replace(/[๐-๙]/g, d => String(TH.indexOf(d))).replace(/[\s​"“”'‘’.,()\-–_/@#]+/g, '');
const RECENT = 'eqcamp.search.recent';
const lsGet = (k: string) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };

function buildIndex(jobs: Job[], team: TeamJob[]): Item[] {
  const out: Item[] = [];
  const add = (it: Omit<Item, 'hay' | 'tn'> & { extra?: string }) => { const { extra, ...rest } = it; out.push({ ...rest, tn: normQ(it.title), hay: normQ([it.title, it.sub, /งานนี้$/.test(it.badge || '') ? '' : it.badge, extra].join(' ')) }); };
  // งาน (เครื่องนี้ + ทีม)
  const seen = new Set<string>();
  for (const j of jobs) { seen.add(j.id); const c = j.snap?.camp || {}; add({ k: 'job', id: j.id, title: j.name, sub: [j.course, j.duration, j.dates, c.docCode].filter(Boolean).join(' · '), when: j.savedAt, go: { t: 'job', id: j.id }, extra: [c.venue, c.province, c.level, j.school].join(' ') }); }
  for (const t of team) if (!t.deleted && !seen.has(t.id)) add({ k: 'job', id: t.id, title: t.name, sub: [t.course, t.duration, t.dates, t.docCode, t.by && 'โดย ' + t.by].filter(Boolean).join(' · '), badge: 'ทีม', when: t.savedAt, go: { t: 'job', id: t.id }, extra: t.school });
  // งานเก่า (โปรแกรมที่เคยส่งจริงจากโฟลเดอร์ของปี — สำเนาล่าสุดในเครื่อง)
  for (const j of pastJobs(readPastCache())) add({ k: 'past', id: j.id, title: j.name.replace(/^\d{6}\s*/, ''), sub: [j.dateLabel, j.courseCode ? courseLabel(j.courseCode) : '', j.duration, j.confirmed ? 'ยืนยันแล้ว' : ''].filter(Boolean).join(' · '), badge: j.kind === 'corp' ? 'องค์กร' : undefined, when: j.date, go: { t: 'past', id: (j.school || j.name).replace(/^โรงเรียน/, '') }, extra: j.search });
  // NSR ทุกแท็บ (จากข้อมูลล่าสุดที่โหลด)
  const nsr: NsrJob[] = (lsGet('eqcamp.nsr.cache.v1')?.jobs || []) as NsrJob[];
  for (const j of nsr) { try { const r = indexRow(j); add({ k: 'nsr', id: j.tab || j.id, title: j.tab || j.name, sub: [j.name !== j.tab ? j.name : '', j.province, j.participants ? `${j.participants} คน` : '', j.price ? `${j.price.toLocaleString('th-TH')} บ./ท่าน` : ''].filter(Boolean).join(' · '), badge: pctText(r.pct), tone: r.tier, go: { t: 'nsr', id: j.tab || '' } }); } catch { /* แท็บเสีย */ } }
  // ทะเบียนโปรแกรม
  const S = summarize(dedupe([...loadTeamEvents(), ...loadLocal()]));
  for (const p of S.programs.slice(0, 2000)) add({ k: 'program', id: p.programId, title: p.school || 'ไม่ระบุโรงเรียน', sub: [p.docCode, p.course, p.dur, p.dates, p.venue, p.by.join(', ')].filter(Boolean).join(' · '), when: p.last, go: p.jobId ? { t: 'job', id: p.jobId } : { t: 'stats', id: '' }, extra: p.province });
  // หลักสูตร / กิจกรรม / มาตรฐาน / ที่พัก
  for (const c of COURSES) add({ k: 'course', id: c.code, title: c.name, sub: `${c.code} · ${courseLabel(c.code)}`, go: { t: 'course', id: c.code }, alt: { label: 'สร้างเอกสาร', go: { t: 'useCourse', id: c.code } }, extra: c.obj1 + ' ' + c.obj2 });
  // กิจกรรม: คลังจากโปรแกรมจริง (392, แยกหมวด) — Enter = ใส่ในงานที่เปิดอยู่ทันที · คลัง MASTER ที่ชื่อไม่ซ้ำแสดงต่อท้าย
  const catNames = new Set<string>();
  for (const a of CAT_ACTS) { catNames.add(normQ(a.n)); add({ k: 'activity', id: a.i, title: a.n, sub: [courseLabel(a.c), GROUP_LABEL[a.g].split(' / ')[0], a.m ? `${a.m} นาที` : '', a.r === 'S' ? `ใช้จริง ${a.p} โปรแกรม` : ''].filter(Boolean).join(' · '), badge: 'ใส่ในงานนี้', go: { t: 'pick', id: a.i }, alt: { label: 'ดูในคลัง', go: { t: 'hub', sec: 'activities', q: a.n } }, extra: [...(a.a || []), a.d || '', a.c].join(' ') }); }
  for (const a of LIB) if (a.courseCode && !catNames.has(normQ(a.title))) add({ k: 'activity', id: a.id, title: a.title, sub: [courseLabel(a.courseCode), a.id].join(' · '), go: { t: 'hub', sec: 'activities', q: a.title }, extra: a.desc });
  for (const n of NOTION_ACTIVITIES) { const st = actStandard(n); add({ k: 'standard', id: n.id, title: n.name, sub: [n.cats.join(', '), n.status].filter(Boolean).join(' · '), badge: st.level, go: { t: 'hub', sec: 'standard' } }); }
  // ที่พัก: ทำเนียบทั้งหมด — Enter = ใช้กับงานที่เปิดอยู่ (เติมจังหวัด/ทัศนศึกษา/ผู้ติดต่อ + ภาพแยกหมวด)
  for (const v of venueDirectory()) add({ k: 'venue', id: v.name, title: v.name, sub: [v.province, v.area && v.area !== v.province ? v.area : '', v.photos.length ? `ภาพ ${v.photos.length}` : 'ยังไม่มีภาพ', v.visit].filter(Boolean).join(' · '), badge: 'ใช้กับงานนี้', go: { t: 'venue', id: v.name }, alt: { label: 'ดูในคลัง', go: { t: 'hub', sec: 'venues' } }, extra: [v.aliases.join(' '), v.note].join(' ') });
  return out;
}

function score(it: Item, toks: string[]): number {
  let s = 0;
  for (const t of toks) {
    if (!it.hay.includes(t)) return -1;
    s += it.tn.startsWith(t) ? 40 : it.tn.includes(t) ? 25 : 8;
  }
  if (it.when) { const d = (Date.now() - new Date(it.when).getTime()) / 86400000; s += Math.max(0, 10 - d / 3); }   // งานล่าสุดขึ้นก่อน
  return s;
}
const Hl = ({ text, toks }: { text: string; toks: string[] }) => {
  // ไฮไลต์คำแรกที่พบ (เทียบแบบไม่สนตัวพิมพ์)
  const low = text.toLowerCase(); let at = -1, len = 0;
  for (const t of toks) { const i = low.indexOf(t); if (i >= 0 && (at < 0 || i < at)) { at = i; len = t.length; } }
  if (at < 0) return <>{text}</>;
  return <>{text.slice(0, at)}<mark className="bg-amber-100 text-inherit rounded-sm">{text.slice(at, at + len)}</mark>{text.slice(at + len)}</>;
};

export default function SearchPalette({ onClose, go, jobs, teamJobs }: { onClose: () => void; go: (g: Go) => void; jobs: Job[]; teamJobs: TeamJob[] }) {
  const [q, setQ] = useState('');
  const [f, setF] = useState<Kind | ''>('');
  const [sel, setSel] = useState(0);
  const inp = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [fresh, setFresh] = useState(0);
  useEffect(() => { if (hubReady()) readTeam().then(r => { if (r.ok) setFresh(n => n + 1); }); }, []);   // ทะเบียนทีมล่าสุด
  const idx = useMemo(() => buildIndex(jobs, teamJobs), [jobs, teamJobs, fresh]);
  const toks = useMemo(() => q.trim().split(/\s+/).map(normQ).filter(Boolean), [q]);
  const rawToks = useMemo(() => q.trim().toLowerCase().split(/\s+/).filter(Boolean), [q]);
  const res = useMemo(() => {
    if (!toks.length) return [] as Item[];
    return idx.map(it => ({ it, s: score(it, toks) })).filter(x => x.s >= 0).sort((a, b) => b.s - a.s).map(x => x.it);
  }, [idx, toks]);
  const counts = useMemo(() => { const c: Partial<Record<Kind, number>> = {}; for (const r of res) c[r.k] = (c[r.k] || 0) + 1; return c; }, [res]);
  // จัดกลุ่ม: ชนิดที่ผลดีที่สุดขึ้นก่อน · ต่อกลุ่ม 6 รายการ (กรองชนิดเดียว = 60)
  const groups = useMemo(() => {
    const by = new Map<Kind, Item[]>();
    for (const r of res) { if (f && r.k !== f) continue; const a = by.get(r.k) || []; if (a.length < (f ? 60 : 6)) a.push(r); by.set(r.k, a); }
    const firstAt = (k: Kind) => res.findIndex(r => r.k === k);
    return [...by.entries()].sort((a, b) => firstAt(a[0]) - firstAt(b[0]));
  }, [res, f]);
  const flat = groups.flatMap(([, a]) => a);
  useEffect(() => { setSel(0); }, [q, f]);
  useEffect(() => { inp.current?.focus(); }, []);
  useEffect(() => { const el = listRef.current?.querySelector(`[data-i="${sel}"]`) as HTMLElement | null; el?.scrollIntoView({ block: 'nearest' }); }, [sel]);
  const recent: string[] = (lsGet(RECENT) || []).slice(0, 6);
  const open = (it: Item, alt = false) => {
    try { const r = [q.trim(), ...recent.filter(x => x !== q.trim())].filter(Boolean).slice(0, 8); localStorage.setItem(RECENT, JSON.stringify(r)); } catch { /* */ }
    go(alt && it.alt ? it.alt.go : it.go);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(flat.length - 1, s + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(0, s - 1)); }
    else if (e.key === 'Enter' && flat[sel]) { e.preventDefault(); open(flat[sel], e.metaKey || e.ctrlKey); }
  };
  const stats = useMemo(() => ORDER.map(k => [k, idx.filter(i => i.k === k).length] as const).filter(([, n]) => n > 0), [idx]);
  let i = -1;
  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-start justify-center sm:pt-[10vh]" role="dialog" aria-modal="true" aria-label="ค้นหาทั้งระบบ" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white w-full sm:max-w-2xl h-full sm:h-auto sm:max-h-[75vh] sm:rounded-2xl shadow-lift flex flex-col overflow-hidden" onKeyDown={onKey}>
        <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-brand-mist pt-[max(0.75rem,env(safe-area-inset-top))]">
          <SearchIcon className="w-5 h-5 text-sub shrink-0" />
          <input ref={inp} value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหางาน โรงเรียน หลักสูตร กิจกรรม ที่พัก NSR…" aria-label="คำค้นหา"
            role="combobox" aria-expanded={flat.length > 0} aria-controls="search-results" aria-activedescendant={flat[sel] ? `sr-${sel}` : undefined}
            className="flex-1 min-w-0 text-[16px] py-1.5 focus:outline-none bg-transparent" enterKeyHint="search" />
          {q && <button onClick={() => { setQ(''); inp.current?.focus(); }} aria-label="ล้างคำค้น" className="tap p-1 rounded-md text-sub hover:text-brand-ink"><X className="w-4 h-4" /></button>}
          <button onClick={onClose} className="tap text-[13px] text-sub px-2 py-1 rounded-md hover:bg-paper">ปิด</button>
        </div>
        {toks.length > 0 && (
          <div className="shrink-0 flex items-center gap-1.5 px-4 py-2 border-b border-brand-mist overflow-x-auto noscrollbar" role="group" aria-label="กรองตามชนิด">
            {([['', `ทั้งหมด ${res.length}`], ...ORDER.filter(k => counts[k]).map(k => [k, `${KIND[k].label} ${counts[k]}`])] as [Kind | '', string][]).map(([k, l]) => (
              <button key={k || 'all'} onClick={() => setF(k)} aria-pressed={f === k} className={`tap shrink-0 px-2.5 py-1 rounded-full text-[12.5px] border ${f === k ? 'bg-brand-navy text-white border-brand-navy' : 'bg-white border-brand-mist text-sub'}`}>{l}</button>
            ))}
          </div>
        )}
        <div ref={listRef} id="search-results" role="listbox" className="flex-1 overflow-y-auto">
          {!toks.length ? (
            <div className="p-4 text-[14px]">
              {recent.length > 0 && (<>
                <div className="text-[12.5px] text-sub mb-1.5">ค้นหาล่าสุด</div>
                <div className="flex flex-wrap gap-1.5 mb-4">{recent.map(r => <button key={r} onClick={() => setQ(r)} className="tap px-2.5 py-1 rounded-full border border-brand-mist text-[13px] hover:bg-paper">{r}</button>)}</div>
              </>)}
              <div className="text-[12.5px] text-sub mb-1.5">ค้นได้ทั้งหมด</div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13.5px]">{stats.map(([k, n]) => { const I = KIND[k].icon; return <span key={k} className="flex items-center gap-1.5"><I className="w-4 h-4 text-sub" />{KIND[k].label} <b className="font-semibold tabular-nums">{n.toLocaleString('th-TH')}</b></span>; })}</div>
              <div className="text-[12.5px] text-sub mt-4">พิมพ์หลายคำได้ เช่น “stem ภูเก็ต” · “ทะเล 80” · “PL SEA” · “ปะการัง” — ↑↓ เลือก · Enter เปิด · Ctrl+Enter ทางเลือกที่สอง</div>
            </div>
          ) : !flat.length ? (
            <div className="p-6 text-[14px] text-sub">ไม่พบ “{q}” — ลองคำสั้นลง หรือสะกดแบบอื่น (ชื่อโรงเรียนไม่ต้องพิมพ์คำว่า โรงเรียน)</div>
          ) : groups.map(([k, items]) => (
            <div key={k} role="group" aria-label={KIND[k].label}>
              <div className="px-4 pt-3 pb-1 text-[12px] font-semibold text-sub">{KIND[k].label}{!f && (counts[k] || 0) > items.length ? <button onClick={() => setF(k)} className="tap ml-2 font-normal text-brand-navy underline underline-offset-2">ดูทั้งหมด {counts[k]}</button> : null}</div>
              {items.map(it => { i++; const me = i; const I = KIND[it.k].icon; return (
                <div key={it.k + it.id} id={`sr-${me}`} data-i={me} role="option" aria-selected={sel === me} onMouseMove={() => setSel(me)} onClick={() => open(it)}
                  className={`mx-2 px-2.5 py-2 rounded-lg flex items-center gap-3 cursor-pointer ${sel === me ? 'bg-paper' : ''}`}>
                  <I className="w-4 h-4 text-sub shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[14.5px] truncate"><Hl text={it.title} toks={rawToks} /></div>
                    <div className="text-[12.5px] text-sub truncate">{it.sub}{it.when ? ` · ${ago(it.when)}` : ''}</div>
                  </div>
                  {it.badge && <span className={`shrink-0 text-[12px] px-1.5 py-0.5 rounded-md border ${it.tone === 'lt10' ? 'text-red-700 border-red-200 bg-red-50' : it.tone === '10-15' ? 'text-amber-800 border-amber-200 bg-amber-50' : it.tone === 'gt20' ? 'text-emerald-700 border-emerald-200 bg-emerald-50' : 'text-sub border-brand-mist'}`}>{it.badge}</span>}
                  {it.alt && <button onClick={e => { e.stopPropagation(); open(it, true); }} className="tap shrink-0 text-[12.5px] px-2 py-1 rounded-md border border-brand-mist hover:bg-white">{it.alt.label}</button>}
                  {sel === me && <CornerDownLeft className="w-4 h-4 text-sub shrink-0 hidden sm:block" />}
                </div>); })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
