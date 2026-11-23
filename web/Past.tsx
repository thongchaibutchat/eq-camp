// หน้า "งานเก่า" (#/past) — โปรแกรมที่ทีมเคยส่งจริงทุกงานในโฟลเดอร์ของปี (เช่น 2569) · ค้นหา · เปิดไฟล์ใน Drive · เปิดโปรแกรมเดิมมาแก้เป็นงานใหม่
// ข้อมูลมาจากศูนย์กลางทีม (ต้องเชื่อมต่อทีม) · ไฟล์ต้นฉบับใน Drive ไม่ถูกแก้ — งานที่เปิดมาเป็นสำเนาในเว็บ
import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, ExternalLink, FileText, FolderOpen, AlertTriangle, CheckCircle2, X, Search as SearchIcon } from 'lucide-react';
import { hubReady, onArea, IN_CLAUDE, LIVE_WEB, hubMe } from './hub';
import { readPastCache, loadPast, scanPast, openPast, pastJobs, driveUrl } from './past-data';
import type { PastJob, PastParse } from '../src/past-import';
import type { Camp } from '../src/eqcamp-core';
import { courseLabel } from '../src/eqcamp-core';
import { normQ } from './Search';

type F = 'all' | 'camp' | 'corp' | 'confirmed' | 'open';
const FILTERS: { id: F; label: string }[] = [{ id: 'all', label: 'ทั้งหมด' }, { id: 'camp', label: 'ค่ายโรงเรียน' }, { id: 'corp', label: 'องค์กร / Team Building' }, { id: 'confirmed', label: 'ยืนยันแล้ว' }, { id: 'open', label: 'เปิดมาแก้ได้' }];
const TH_M = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const monthOfJob = (j: PastJob) => j.date ? `${TH_M[+j.date.slice(5, 7) - 1]} ${+j.date.slice(0, 4) + 543}` : 'ไม่ระบุวันที่';
const short = (s: string) => s.replace(/\.(docx?|pdf)$/i, '');

export default function Past({ onOpen, onConnect, flash, initialQ = '' }: { onOpen: (c: Camp, p: PastParse) => void; onConnect: () => void; flash: (t: string, warn?: boolean) => void; initialQ?: string }) {
  const [cache, setCache] = useState(readPastCache);
  const [load, setLoad] = useState<'idle' | 'loading' | 'ok' | 'err'>(hubReady() ? 'loading' : 'idle');
  const [err, setErr] = useState('');
  const [q, setQ] = useState(initialQ);
  const [f, setF] = useState<F>('all');
  const [course, setCourse] = useState('');
  const [busy, setBusy] = useState('');
  const [review, setReview] = useState<{ job: PastJob; p: PastParse } | null>(null);
  const [scan, setScan] = useState<number | null>(null);
  const [limit, setLimit] = useState(60);
  const me = hubMe();
  const connected = hubReady();

  const refresh = async () => {
    if (!hubReady()) { setLoad('idle'); return; }
    setLoad(l => (l === 'ok' ? 'ok' : 'loading'));
    try { setCache(await loadPast()); setLoad('ok'); setErr(''); } catch (e: any) { setErr(e?.message || 'โหลดไม่ได้'); setLoad('err'); }
  };
  useEffect(() => { refresh(); return onArea(['past'], refresh); }, []);
  useEffect(() => setLimit(60), [q, f, course]);

  const jobs = useMemo(() => pastJobs(cache), [cache]);
  const courses = useMemo(() => [...new Set(jobs.map(j => j.courseCode).filter(Boolean))].sort(), [jobs]);
  const toks = useMemo(() => q.trim().split(/\s+/).map(normQ).filter(Boolean), [q]);
  const list = useMemo(() => jobs.filter(j => {
    if (f === 'camp' && j.kind !== 'camp') return false;
    if (f === 'corp' && j.kind !== 'corp') return false;
    if (f === 'confirmed' && !j.confirmed) return false;
    if (f === 'open' && !j.canOpen) return false;
    if (course && j.courseCode !== course) return false;
    if (toks.length) { const h = normQ(j.search); if (!toks.every(t => h.includes(t))) return false; }
    return true;
  }), [jobs, f, course, toks]);
  const counts = useMemo(() => ({ all: jobs.length, camp: jobs.filter(j => j.kind === 'camp').length, corp: jobs.filter(j => j.kind === 'corp').length, confirmed: jobs.filter(j => j.confirmed).length, open: jobs.filter(j => j.canOpen).length } as Record<F, number>), [jobs]);
  const groups = useMemo(() => { const g: { m: string; items: PastJob[] }[] = []; for (const j of list.slice(0, limit)) { const m = monthOfJob(j); const last = g[g.length - 1]; if (last && last.m === m) last.items.push(j); else g.push({ m, items: [j] }); } return g; }, [list, limit]);

  const open = async (j: PastJob) => {
    setBusy(j.id);
    try { const p = await openPast(j); setReview({ job: j, p }); }
    catch (e: any) { flash(e?.message || 'เปิดงานนี้ไม่ได้', true); }
    finally { setBusy(''); }
  };
  const doScan = async () => {
    setScan(0);
    try { const r = await scanPast(n => setScan(n)); flash(`สแกนแล้ว ${r.n} งาน · อัปเดต ${r.changed} งาน`); await refresh(); }
    catch (e: any) { flash(e?.message || 'สแกนไม่สำเร็จ', true); }
    finally { setScan(null); }
  };

  return (
    <div className="space-y-4 pb-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-brand-ink">งานเก่า</h1>
          <p className="text-[13.5px] text-sub mt-0.5">
            {jobs.length ? <>โปรแกรมที่ทีมเคยส่งจริง {jobs.length} งาน{cache.scannedAt ? <> · สแกนโฟลเดอร์ล่าสุด {new Date(cache.scannedAt).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} น.</> : ''} · ไฟล์ต้นฉบับใน Drive ไม่ถูกแก้</> : 'โปรแกรมที่ทีมเคยส่งจริง — เปิดดูไฟล์ หรือดึงโปรแกรมเดิมมาแก้เป็นงานใหม่'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {me?.role === 'admin' && <button onClick={doScan} disabled={scan !== null || !connected} className="tap px-3 py-2 rounded-xl border border-brand-mist bg-white text-[13.5px] enabled:hover:bg-paper disabled:opacity-50">{scan !== null ? `กำลังสแกน… ${scan || ''}` : 'สแกนโฟลเดอร์ใหม่'}</button>}
          <button onClick={refresh} disabled={!connected} aria-label="โหลดรายการใหม่" className="tap p-2.5 rounded-xl border border-brand-mist bg-white enabled:hover:bg-paper disabled:opacity-40"><RefreshCw className={`w-4 h-4 ${load === 'loading' ? 'animate-spin' : ''}`} /></button>
        </div>
      </div>

      {!connected && (
        <div className="rounded-xl border border-amber-300 bg-white px-4 py-3 text-[14px] flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-start gap-2"><FolderOpen className="w-4 h-4 mt-0.5 text-amber-600 shrink-0" />{IN_CLAUDE ? 'หน้านี้บน claude.ai ดึงข้อมูลทีมไม่ได้ — เปิดเวอร์ชันเว็บด้วยลิงก์ส่วนตัว' : 'งานเก่าเป็นข้อมูลลูกค้าของทีม — เชื่อมต่อทีมด้วยลิงก์ส่วนตัวก่อน'}</span>
          {IN_CLAUDE ? <a href={LIVE_WEB + '#/past'} target="_blank" rel="noopener" className="tap px-3 py-1.5 rounded-lg bg-brand-navy text-white text-[13.5px] font-medium flex items-center gap-1.5">เปิดเวอร์ชันเว็บ<ExternalLink className="w-3.5 h-3.5" /></a>
            : <button onClick={onConnect} className="tap px-3 py-1.5 rounded-lg bg-brand-navy text-white text-[13.5px] font-medium">เชื่อมต่อทีม</button>}
        </div>
      )}
      {connected && load === 'err' && <div role="alert" className="rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-[13.5px] flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />{err}</div>}
      {connected && load === 'ok' && !jobs.length && (
        <div className="rounded-xl border border-brand-mist bg-white px-4 py-3 text-[14px]">ยังไม่มีรายการ{me?.role === 'admin' ? ' — กด "สแกนโฟลเดอร์ใหม่" ครั้งแรก (ใช้เวลาราว 1–2 นาที)' : ' — ให้แอดมินสแกนโฟลเดอร์ครั้งแรก'}</div>
      )}

      {jobs.length > 0 && (<>
        <div className="flex flex-col sm:flex-row gap-2">
          <label className="relative flex-1"><span className="sr-only">ค้นหางานเก่า</span>
            <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-sub" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหาโรงเรียน หลักสูตร เดือน ชื่อไฟล์…" className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-brand-mist bg-white text-[15px]" />
          </label>
          <select aria-label="หลักสูตร" value={course} onChange={e => setCourse(e.target.value)} className="tap px-3 py-2.5 rounded-xl border border-brand-mist bg-white text-[14px] sm:w-56">
            <option value="">ทุกหลักสูตร</option>
            {courses.map(c => <option key={c} value={c}>{courseLabel(c)}</option>)}
          </select>
        </div>
        <div role="group" aria-label="กรอง" className="flex flex-wrap gap-1.5">
          {FILTERS.map(x => <button key={x.id} onClick={() => setF(x.id)} aria-pressed={f === x.id} className={`tap px-3 py-1.5 rounded-full border text-[13px] ${f === x.id ? 'bg-brand-navy text-white border-brand-navy' : 'bg-white border-brand-mist'}`}>{x.label} <span className="opacity-70 tabular-nums">{counts[x.id]}</span></button>)}
        </div>
        <p className="text-[13px] text-sub" aria-live="polite">พบ {list.length} งาน</p>

        <div className="space-y-4">
          {groups.map(g => (
            <section key={g.m} aria-label={g.m}>
              <h2 className="text-[13px] font-semibold text-sub mb-1.5">{g.m}</h2>
              <ul className="rounded-xl border border-brand-mist bg-white divide-y divide-brand-mist">
                {g.items.map(j => (
                  <li key={j.id} className="p-3 sm:p-3.5">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-sub">
                          <span className="tabular-nums">{j.dateLabel || '—'}</span>
                          {j.courseCode && <span>{courseLabel(j.courseCode)}</span>}
                          {j.duration && <span>· {j.duration}</span>}
                          {j.kind === 'corp' && <span className="px-1.5 rounded bg-paper">องค์กร</span>}
                          {j.confirmed && <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="w-3.5 h-3.5" />ยืนยันแล้ว</span>}
                        </div>
                        <div className="text-[14.5px] font-medium text-brand-ink mt-0.5 break-words">{j.name.replace(/^\d{6}\s*/, '')}</div>
                        <div className="mt-1.5 flex flex-wrap gap-1.5 text-[12.5px]">
                          {[...(j.program ? [j.program] : []), ...j.files.filter(x => x !== j.program && (x === j.programDocx || /\.(pdf|docx?)$/i.test(x.n) && !x.n.includes('/'))).slice(0, 4)].map(x => (
                            <a key={x.id} href={driveUrl(x.id)} target="_blank" rel="noopener" className="tap inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-brand-mist hover:bg-paper max-w-full"><FileText className="w-3.5 h-3.5 shrink-0" /><span className="truncate max-w-[16rem]">{short(x.n)}</span></a>
                          ))}
                          <a href={driveUrl(j.id, true)} target="_blank" rel="noopener" className="tap inline-flex items-center gap-1 px-2 py-1 rounded-lg text-brand-navy"><FolderOpen className="w-3.5 h-3.5" />โฟลเดอร์ ({j.files.length})</a>
                        </div>
                      </div>
                      {j.canOpen ? (
                        <button onClick={() => open(j)} disabled={!!busy} className="tap shrink-0 px-3.5 py-2 rounded-xl bg-brand-navy text-white text-[13.5px] font-medium disabled:opacity-50">{busy === j.id ? 'กำลังอ่าน…' : 'เปิดมาแก้'}</button>
                      ) : <span className="shrink-0 text-[12.5px] text-sub sm:pt-2">{j.kind === 'corp' ? 'ดูไฟล์ได้อย่างเดียว' : j.bigDocx ? 'ไฟล์ Word ใหญ่เกิน 50 MB (มีภาพฝัง) — ดูใน Drive' : j.program ? 'มีแต่ PDF — ดูได้อย่างเดียว' : 'ยังไม่มีไฟล์โปรแกรม'}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {list.length > limit && <button onClick={() => setLimit(n => n + 60)} className="tap w-full py-2.5 rounded-xl border border-brand-mist bg-white text-[14px]">แสดงเพิ่ม ({list.length - limit})</button>}
        </div>
      </>)}

      {review && <Review r={review} onClose={() => setReview(null)} onUse={() => { onOpen(review.p.camp, review.p); setReview(null); }} />}
    </div>
  );
}

function Review({ r, onClose, onUse }: { r: { job: PastJob; p: PastParse }; onClose: () => void; onUse: () => void }) {
  const { p, job } = r;
  const [showWarn, setShowWarn] = useState(false);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, []);
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="pv-t" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-brand-mist px-4 py-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="pv-t" className="text-[16px] font-semibold text-brand-ink">ตรวจผลอ่านโปรแกรมเดิม</h2>
            <p className="text-[12.5px] text-sub truncate">{job.programDocx?.n}</p>
          </div>
          <button onClick={onClose} aria-label="ปิด" className="tap p-1.5 rounded-lg hover:bg-paper"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-3 text-[14px]">
          <p className="text-sub text-[13.5px]">อ่านได้ {p.stats.days} วัน · {p.stats.rows} แถวกำหนดการ · หน้าปก {p.stats.coverSecs} หัวข้อ · งบ {p.stats.budget} รายการ — ใช้โปรแกรมเดิมเป็นแม่แบบของงานใหม่ แล้วแก้โรงเรียน วันที่ จำนวน ราคา ได้ตามปกติ</p>
          <dl className="rounded-xl border border-brand-mist divide-y divide-brand-mist">
            {p.found.map(([k, v]) => <div key={k} className="grid grid-cols-[7.5rem_1fr] gap-2 px-3 py-1.5"><dt className="text-sub">{k}</dt><dd className="break-words">{v}</dd></div>)}
            {p.missing.map(k => <div key={k} className="grid grid-cols-[7.5rem_1fr] gap-2 px-3 py-1.5"><dt className="text-sub">{k.replace(/ \(.*\)$/, '')}</dt><dd className="text-amber-700">ไม่พบในไฟล์ — กรอกในขั้นถัดไป</dd></div>)}
          </dl>
          {p.warnings.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
              <button onClick={() => setShowWarn(s => !s)} aria-expanded={showWarn} className="tap font-medium">ข้อสังเกต {p.warnings.length} ข้อ {showWarn ? '▲' : '▼'}</button>
              {showWarn && <ul className="list-disc ml-5 mt-1 space-y-0.5">{p.warnings.slice(0, 30).map((w, i) => <li key={i}>{w}</li>)}</ul>}
            </div>)}
          {!p.stats.rows && <div role="alert" className="rounded-xl border border-amber-300 px-3 py-2 text-[13px]">อ่านกำหนดการจากไฟล์นี้ไม่ได้ — งานใหม่จะใช้แม่แบบของทีมแทน</div>}
        </div>
        <div className="sticky bottom-0 bg-white border-t border-brand-mist px-4 py-3 flex gap-2">
          <button onClick={onClose} className="tap flex-1 py-2.5 rounded-xl border border-brand-mist text-[14px]">ยกเลิก</button>
          <button onClick={onUse} className="tap flex-[2] py-2.5 rounded-xl bg-accent text-white font-semibold text-[14px]">สร้างงานใหม่จากโปรแกรมนี้</button>
        </div>
      </div>
    </div>
  );
}
