// หน้า "ภาพรวมทีม" (#/team) — เดือนนี้ใครทำโปรแกรม · หลักสูตรที่ทำเยอะสุด · ความเคลื่อนไหวล่าสุด · สถานะการขาย · งานที่กำลังทำ
// ข้อมูลจากศูนย์กลางทีมแบบสด (คำสั่ง board คำสั่งเดียว · ทะเบียนส่งเฉพาะแถวใหม่) — อัปเดตเองเมื่อมีคนสร้างไฟล์/บันทึกงาน/เปลี่ยนสถานะ
import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Users, ExternalLink, AlertTriangle, ChevronRight } from 'lucide-react';
import { hubReady, hubCall, onArea, onHubState, HubState, IN_CLAUDE, LIVE_WEB, hubMe } from './hub';
import TeamAdmin, { ClaimAdmin } from './TeamAdmin';
import { loadLocal, loadTeamEvents, mergeTeam, teamFrom, readTeam, dedupe } from './registry';
import type { LogEv } from './registry';
import { loadTeamJobs, refreshTeamJobs, ago } from './jobs';
import type { TeamJob } from './jobs';
import { normStatus, SALE_STATUS } from '../src/nsr-core';
import type { SaleStatus } from '../src/nsr-core';
import { teamBoard, monthLabel } from './board-data';
import type { TeamMember } from './board-data';

const LS_ST = 'eqcamp.board.status.v1', LS_TEAM = 'eqcamp.board.team.v1';
const loadTeam = (): TeamMember[] => { try { const a = JSON.parse(localStorage.getItem(LS_TEAM) || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } };
const loadSt = (): SaleStatus[] => { try { const a = JSON.parse(localStorage.getItem(LS_ST) || '[]'); return Array.isArray(a) ? a.map(normStatus).filter(Boolean) as SaleStatus[] : []; } catch { return []; } };
const baht = (n: number) => n.toLocaleString('th-TH', { maximumFractionDigits: 0 });
const short = (n: number) => n >= 1e6 ? (n / 1e6).toLocaleString('th-TH', { maximumFractionDigits: 2 }) + ' ล้าน' : baht(n);

export default function Board({ onConnect, onOpenJob, onOpenNsr, onBuild, flash }: { onConnect: () => void; onOpenJob: (id: string) => void; onOpenNsr: (tab: string) => void; onBuild: () => void; flash: (t: string, warn?: boolean) => void }) {
  const [events, setEvents] = useState<LogEv[]>(() => loadTeamEvents());
  const [jobs, setJobs] = useState<TeamJob[]>(() => loadTeamJobs());
  const [st, setSt] = useState<SaleStatus[]>(() => loadSt());
  const [team, setTeam] = useState<TeamMember[]>(() => loadTeam());
  const [load, setLoad] = useState<'idle' | 'loading' | 'ok' | 'err'>(hubReady() ? 'loading' : 'idle');
  const [err, setErr] = useState('');
  const [at, setAt] = useState<Date | null>(null);
  const [hs, setHs] = useState<HubState | null>(null);
  const [month, setMonth] = useState('');
  const [allTime, setAllTime] = useState(false);
  const [, setNow] = useState(0);

  const refresh = async () => {
    if (!hubReady()) { setLoad('idle'); return; }
    setLoad(l => (l === 'ok' ? 'ok' : 'loading'));
    try {
      let j: any;
      try { j = await hubCall('board', { from: teamFrom() }, 40000); }
      catch (e: any) {
        if (e?.code !== 'op') throw e;                                  // ศูนย์กลางรุ่นเก่า → อ่านทีละส่วน
        const [r, jl, sl] = await Promise.all([readTeam(), refreshTeamJobs(), hubCall('status.list', {}, 30000).catch(() => ({ status: [] }))]);
        j = { events: r.events, jobs: jl || [], status: (sl as any).status || [], _legacy: true };
      }
      const ev = j._legacy ? j.events : mergeTeam(j);
      const ss = (j.status || []).map(normStatus).filter(Boolean) as SaleStatus[];
      setEvents(ev); setJobs(j.jobs || []); setSt(ss); if (Array.isArray(j.team)) setTeam(j.team);
      try { localStorage.setItem('eqcamp.jobs.team.v1', JSON.stringify(j.jobs || [])); localStorage.setItem(LS_ST, JSON.stringify(ss)); if (Array.isArray(j.team)) localStorage.setItem(LS_TEAM, JSON.stringify(j.team)); } catch { /* quota */ }
      setLoad('ok'); setErr(''); setAt(new Date());
    } catch (e: any) { setLoad('err'); setErr(e?.message || 'โหลดข้อมูลทีมไม่สำเร็จ'); }
  };
  useEffect(() => { refresh(); const u = onArea(['log', 'job', 'st'], () => refresh()); const u2 = onHubState(setHs); const t = window.setInterval(() => setNow(x => x + 1), 30000); return () => { u(); u2(); window.clearInterval(t); }; }, []);

  const all = useMemo(() => dedupe([...events, ...loadLocal()]), [events]);
  const B = useMemo(() => teamBoard({ events: all, jobs, statuses: st, month: month || undefined, team }), [all, jobs, st, month, team]);
  const me = hs?.me || hubMe(); const isAdmin = me?.role === 'admin';
  const courses = allTime ? B.byCourseAll : B.byCourse;
  const maxP = Math.max(1, ...B.byPerson.map(p => p.programs));
  const maxC = Math.max(1, ...courses.map(c => c.programs));
  const connected = hubReady();
  const diff = B.programs - B.prevPrograms;

  return (
    <div className="space-y-4 pb-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-brand-ink">ภาพรวมทีม</h1>
          <p className="text-[13.5px] text-sub mt-0.5">
            {connected ? (load === 'ok' && at ? <>อัปเดตเองเมื่อมีคนสร้างไฟล์หรือบันทึกงาน · ล่าสุด {at.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.</> : load === 'err' ? 'ใช้ข้อมูลที่โหลดไว้ล่าสุด' : 'กำลังโหลดข้อมูลทีม…') : 'ตอนนี้เห็นเฉพาะงานของเครื่องนี้'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="bm">เดือน</label>
          <select id="bm" value={B.month} onChange={e => setMonth(e.target.value)} className="tap px-3 py-2 rounded-xl border border-brand-mist bg-white text-[14px]">
            {B.months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          <button onClick={refresh} disabled={!connected} aria-label="โหลดข้อมูลทีมใหม่" className="tap p-2.5 rounded-xl border border-brand-mist bg-white enabled:hover:bg-paper disabled:opacity-40"><RefreshCw className={`w-4 h-4 ${load === 'loading' ? 'animate-spin' : ''}`} /></button>
        </div>
      </div>

      {!connected && (
        <div className="rounded-xl border border-amber-300 bg-white px-4 py-3 text-[14px] flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-start gap-2"><Users className="w-4 h-4 mt-0.5 text-amber-600 shrink-0" />{IN_CLAUDE ? 'หน้านี้บน claude.ai ดึงข้อมูลทีมแบบสดไม่ได้ — เปิดเวอร์ชันเว็บด้วยลิงก์ทีมเพื่อดูทั้งทีม' : 'เปิดลิงก์ทีมจากกลุ่มทีมครั้งเดียว แล้วหน้านี้จะแสดงงานของทุกคน'}</span>
          {IN_CLAUDE ? <a href={LIVE_WEB + '#/team'} target="_blank" rel="noopener" className="tap px-3 py-1.5 rounded-lg bg-brand-navy text-white text-[13.5px] font-medium flex items-center gap-1.5">เปิดเวอร์ชันเว็บ<ExternalLink className="w-3.5 h-3.5" /></a>
            : <button onClick={onConnect} className="tap px-3 py-1.5 rounded-lg bg-brand-navy text-white text-[13.5px] font-medium">เชื่อมต่อทีม</button>}
        </div>
      )}
      {connected && me?.shared && (
        <div className="rounded-xl border border-amber-300 bg-white px-4 py-3 text-[13.5px] space-y-2">
          <div className="flex items-start gap-2"><AlertTriangle className="w-4 h-4 mt-0.5 text-amber-600 shrink-0" />เครื่องนี้ใช้ “ลิงก์รวม” — ระบบยังไม่รู้ว่าคุณคือใคร ขอลิงก์ส่วนตัวจากแอดมินทีม</div>
          {me.claimable && <ClaimAdmin flash={flash} onDone={refresh} />}
        </div>
      )}
      {connected && load === 'err' && (
        <div role="alert" className="rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-[13.5px] flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />{err}{hs?.status === 'offline' ? ' (ออฟไลน์)' : ''} — ระบบจะลองใหม่เอง</div>
      )}

      {/* ตัวเลขหลักของเดือน */}
      <section aria-label={`สรุป ${monthLabel(B.month)}`} className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
        <Kpi n={B.programs} l="โปรแกรมที่ทำ" sub={B.prevPrograms || B.programs ? `${diff >= 0 ? '+' : ''}${diff} จากเดือนก่อน` : ''} />
        <Kpi n={B.people} l="คนที่ทำงาน" />
        <Kpi n={B.schools} l="โรงเรียน" />
        <Kpi n={baht(B.students)} l="นักเรียนรวม" />
        <Kpi n={short(B.value)} l="มูลค่าเสนอขาย (บาท)" className="col-span-2 md:col-span-1" />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title={`ใครทำโปรแกรม · ${monthLabel(B.month)}`} hint="นับโปรแกรมละครั้ง แม้สร้างหลายไฟล์">
          {B.byPerson.length ? (
            <ol className="space-y-2.5">
              {B.byPerson.map((p, i) => (
                <li key={p.name}>
                  <div className="flex items-baseline justify-between gap-2 text-[14.5px]">
                    <span className="min-w-0 truncate"><span className="text-sub tabular-nums mr-2">{i + 1}</span><span className="font-medium">{p.name}</span></span>
                    <span className="tabular-nums shrink-0"><b className="font-semibold text-brand-navy">{p.programs}</b> โปรแกรม · {p.files} ไฟล์</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-paper overflow-hidden"><div className="h-full rounded-full bg-brand-navy" style={{ width: `${(p.programs / maxP) * 100}%` }} /></div>
                  <div className="mt-0.5 text-[12.5px] text-sub truncate">{p.files ? <>{p.schools.slice(0, 3).join(' · ')}{p.schools.length > 3 ? ` และอีก ${p.schools.length - 3}` : ''}{p.value ? ` · ${short(p.value)} บาท` : ''} · ล่าสุด {ago(p.last)}</> : <>ยังไม่มีงานเดือนนี้{p.lastSeen ? ` · เปิดระบบล่าสุด ${ago(p.lastSeen)}` : ''}</>}</div>
                  {(p.device || (isAdmin && p.email)) && <div className="text-[12px] text-sub truncate">{[p.device, isAdmin ? p.email : ''].filter(Boolean).join(' · ')}</div>}
                </li>
              ))}
            </ol>
          ) : <Empty text={`ยังไม่มีใครสร้างไฟล์ใน${monthLabel(B.month)}`} action={<button onClick={onBuild} className="tap text-brand-navy font-medium">สร้างเอกสาร</button>} />}
        </Card>

        <Card title="หลักสูตรที่ทำเยอะที่สุด" right={
          <div role="group" aria-label="ช่วงเวลา" className="flex rounded-lg border border-brand-mist overflow-hidden text-[13px]">
            <button onClick={() => setAllTime(false)} aria-pressed={!allTime} className={`tap px-2.5 py-1 ${!allTime ? 'bg-brand-navy text-white' : 'bg-white'}`}>เดือนนี้</button>
            <button onClick={() => setAllTime(true)} aria-pressed={allTime} className={`tap px-2.5 py-1 ${allTime ? 'bg-brand-navy text-white' : 'bg-white'}`}>ทั้งหมด</button>
          </div>}>
          {courses.length ? (
            <ul className="space-y-2.5">
              {courses.slice(0, 10).map(c => (
                <li key={c.course}>
                  <div className="flex items-baseline justify-between gap-2 text-[14.5px]"><span className="min-w-0 truncate font-medium">{c.course}</span><span className="tabular-nums shrink-0"><b className="font-semibold text-brand-navy">{c.programs}</b> · {baht(c.students)} คน</span></div>
                  <div className="mt-1 h-2 rounded-full bg-paper overflow-hidden"><div className="h-full rounded-full bg-accent" style={{ width: `${(c.programs / maxC) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          ) : <Empty text="ยังไม่มีข้อมูลหลักสูตรในช่วงนี้" />}
        </Card>

        <Card title="ความเคลื่อนไหวล่าสุด" hint="ทุกคนในทีม">
          {B.feed.length ? (
            <ul className="divide-y divide-brand-mist -my-1">
              {B.feed.slice(0, 12).map((f, i) => (
                <li key={i}>
                  <button onClick={() => f.jobId && onOpenJob(f.jobId)} disabled={!f.jobId} className="tap w-full text-left py-2 flex items-start gap-3 enabled:hover:bg-paper rounded-lg px-1">
                    <span className="w-8 h-8 shrink-0 rounded-full bg-paper border border-brand-mist grid place-items-center text-[13px] font-semibold text-brand-navy" aria-hidden>{f.who.slice(0, 1)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px]"><b className="font-medium">{f.who}</b> {f.what}</span>
                      <span className="block text-[12.5px] text-sub truncate">{[f.school, f.course].filter(Boolean).join(' · ') || '—'} · {ago(f.ts)}{f.device ? ` · ${f.device.split(' · ').slice(0, 2).join(' · ')}` : ''}</span>
                    </span>
                    {f.jobId && <ChevronRight className="w-4 h-4 text-sub mt-2 shrink-0" />}
                  </button>
                </li>
              ))}
            </ul>
          ) : <Empty text="ยังไม่มีความเคลื่อนไหว" />}
        </Card>

        <Card title="สถานะการขาย" hint="จากหน้า คำนวณ NSR">
          <div className="grid grid-cols-4 gap-2 text-center">
            {SALE_STATUS.map(s => (
              <div key={s.id} className="rounded-lg border border-brand-mist py-2">
                <div className={`text-[20px] font-semibold tabular-nums ${s.id === 'won' ? 'text-emerald-700' : s.id === 'lost' ? 'text-sub' : 'text-brand-navy'}`}>{(B.sales as any)[s.id]}</div>
                <div className="text-[12px] text-sub leading-tight">{s.short}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-[13.5px] text-sub">
            ปิดการขายใน {monthLabel(B.month)} <b className="text-brand-ink font-semibold">{B.sales.wonMonth}</b> งาน{B.sales.wonValueMonth ? <> · <b className="text-brand-ink font-semibold">{short(B.sales.wonValueMonth)}</b> บาท</> : ''}
            {B.sales.closeRate !== null && <> · อัตราปิด <b className="text-brand-ink font-semibold">{Math.round(B.sales.closeRate * 100)}%</b></>}
          </div>
          <h3 className="mt-4 text-[14px] font-semibold">ต้องติดตาม ({B.sales.follow.length})</h3>
          {B.sales.follow.length ? (
            <ul className="mt-1.5 space-y-1">
              {B.sales.follow.map(s => (
                <li key={s.sheetId}><button onClick={() => onOpenNsr(s.title)} className="tap w-full text-left flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-paper text-[14px]">
                  <span className="min-w-0 truncate">{s.name || s.title}</span><span className="shrink-0 text-[12.5px] text-amber-700">{s.followUp ? 'นัด ' + s.followUp.split('-').reverse().slice(0, 2).join('/') : 'เกิน 14 วัน'}{s.by ? ` · ${s.by}` : ''}</span>
                </button></li>
              ))}
            </ul>
          ) : <p className="mt-1 text-[13.5px] text-sub">ไม่มีงานค้างติดตาม</p>}
        </Card>

        {connected && isAdmin && <div className="lg:col-span-2"><TeamAdmin flash={flash} /></div>}
        <Card title="งานที่กำลังทำ (7 วันล่าสุด)" className="lg:col-span-2">
          {B.activeJobs.length ? (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {B.activeJobs.map(j => (
                <li key={j.id}><button onClick={() => onOpenJob(j.id)} className="tap w-full text-left rounded-xl border border-brand-mist px-3 py-2.5 hover:bg-paper">
                  <span className="block text-[14.5px] font-medium truncate">{j.school || j.name}</span>
                  <span className="block text-[12.5px] text-sub truncate">{[j.course, j.duration, j.dates].filter(Boolean).join(' · ')}</span>
                  <span className="block text-[12.5px] text-sub mt-0.5">{j.who} · แก้ {ago(j.savedAt)}{j.files ? ` · ${j.files} ไฟล์` : ''}</span>
                </button></li>
              ))}
            </ul>
          ) : <Empty text={connected ? 'ยังไม่มีงานที่แก้ในสัปดาห์นี้' : 'เชื่อมต่อทีมเพื่อดูงานของทุกคน'} />}
        </Card>
      </div>
    </div>
  );
}

function Kpi({ n, l, sub, className = '' }: { n: React.ReactNode; l: string; sub?: string; className?: string }) {
  return <div className={`rounded-xl bg-white border border-brand-mist px-3 py-3.5 ${className}`}><div className="text-[26px] font-semibold text-brand-navy leading-none tabular-nums">{n}</div><div className="text-[13px] text-sub mt-1.5">{l}</div>{sub && <div className="text-[12px] text-sub mt-0.5">{sub}</div>}</div>;
}
function Card({ title, hint, right, children, className = '' }: { title: string; hint?: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-2xl bg-white border border-brand-mist p-4 ${className}`} aria-label={title}>
      <div className="flex items-center justify-between gap-2 mb-3"><h2 className="text-[16px] font-semibold">{title}{hint && <span className="ml-2 text-[12.5px] font-normal text-sub">{hint}</span>}</h2>{right}</div>
      {children}
    </section>
  );
}
function Empty({ text, action }: { text: string; action?: React.ReactNode }) { return <p className="text-[14px] text-sub py-3">{text}{action && <> · {action}</>}</p>; }
