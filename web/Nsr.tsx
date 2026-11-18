import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Wand2, Search, RefreshCw, ExternalLink, Plus, Trash2, Copy, Check, AlertTriangle, Settings, Save, FilePlus, ChevronLeft, X, Phone, CalendarCheck, Scissors } from 'lucide-react';
import {
  NsrJob, NsrIndexRow, CostLine, StaffLine, Num, computeNsr, parseNsrTab, indexRow, newJob, jobToGrid, gridMeta, diffForTab, tabNameFor, applyAuto, keyOf, hintOf,
  STD_LINES, APPROVAL_MATRIX, APPROVAL_RULES, FAST_TRACK, NSR_MASTER_TAB, fmt, pctText, readNum, staffPay
} from '../src/nsr-core';
import { Conn, TabInfo, hubConn, mcpConn, connError, sheetUrl } from './nsr-sheet';
import { hubReady, onRev, onHubState, HubState } from './hub';
import { draftFromBrief, draftFromCamp, aiPrompt, applyAi, NsrDraft, DraftField } from '../src/nsr-brief';
import type { Camp } from '../src/eqcamp-core';

/* คำนวณ NSR — ตารางต้นทุน/ยอดขายของทีม (ถอดแบบจากชีต NSR) อยู่หน้าเดียวกับเครื่องมือทำหลักสูตร
 * ซ้าย: งานย้อนหลังทุกแท็บในชีต (ค้นหา/กรอง) · ขวา: ตารางคำนวณทีละขั้น พร้อมสูตร + ระดับอนุมัติ
 * แก้แล้วบันทึกกลับชีตได้ (แท็บเดิม = แก้เฉพาะช่องที่เปลี่ยน · แท็บใหม่ = โครงเดียวกับแท็บงานจริง) */

export interface NsrPrefill { camp: Camp; brief: string }
type Entry = { row: NsrIndexRow; job: NsrJob; local?: boolean };
const LS_CACHE = 'eqcamp.nsr.cache.v1', LS_LOCAL = 'eqcamp.nsr.local.v1';
const lsGet = (k: string) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const lsSet = (k: string, v: any) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
const card = 'bg-white rounded-xl border border-brand-mist';
const TONE: Record<string, string> = { ok: 'text-emerald-700 bg-emerald-50 border-emerald-200', mid: 'text-sky-800 bg-sky-50 border-sky-200', warn: 'text-amber-800 bg-amber-50 border-amber-200', bad: 'text-red-700 bg-red-50 border-red-200' };
const toneOf = (id: string) => APPROVAL_MATRIX.find(m => m.id === id)?.tone || 'mid';
const norm = (s: string) => String(s || '').toLowerCase().replace(/\s+/g, '');
const clone = (j: NsrJob): NsrJob => JSON.parse(JSON.stringify(j));
const tabUrl = (sheetId?: number) => (sheetUrl() ? sheetUrl() + (sheetId != null ? `#gid=${sheetId}` : '') : '');
const timeTh = (d: Date | null) => (d ? d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '');

export default function Nsr({ prefill, flash, onConnect, openTab }: { prefill: () => NsrPrefill | null; flash: (t: string, warn?: boolean) => void; onConnect: () => void; openTab?: string }) {
  // ── การเชื่อมชีต ──
  const [conn, setConn] = useState<Conn | null>(null);
  const [connState, setConnState] = useState<'none' | 'connecting' | 'live' | 'error'>('none');
  const [connMsg, setConnMsg] = useState('');
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [tabs, setTabs] = useState<TabInfo[]>([]);
  const [entries, setEntries] = useState<Map<string, Entry>>(() => {
    const m = new Map<string, Entry>(); const c = lsGet(LS_CACHE);
    if (c && Array.isArray(c.jobs)) for (const j of c.jobs as NsrJob[]) m.set(j.tab || j.id, { job: j, row: indexRow(j) });
    return m;
  });
  const [cacheAt] = useState<string>(() => lsGet(LS_CACHE)?.at || '');
  const [local, setLocal] = useState<NsrJob[]>(() => lsGet(LS_LOCAL) || []);
  const [loadPct, setLoadPct] = useState<{ done: number; total: number } | null>(null);
  // ── รายการ ──
  const [q, setQ] = useState('');
  const [fTier, setFTier] = useState('');
  const [hideCopy, setHideCopy] = useState(true);
  const [sort, setSort] = useState<'sheet' | 'pctDesc' | 'pctAsc' | 'name'>('sheet');
  const [limit, setLimit] = useState(60);
  // ── งานที่เปิด ──
  const [job, setJob] = useState<NsrJob | null>(null);
  const [orig, setOrig] = useState<NsrJob | null>(null);
  const [remote, setRemote] = useState<NsrJob | null>(null);   // ชีตเปลี่ยนระหว่างที่แก้อยู่
  const [busy, setBusy] = useState('');
  const [conflicts, setConflicts] = useState<{ r: number; c: number; now: string }[] | null>(null);
  const [newTab, setNewTab] = useState<string | null>(null);
  const [pane, setPane] = useState<'list' | 'calc'>('list');
  const dirty = !!job && !!orig && JSON.stringify(applyAuto(job)) !== JSON.stringify(applyAuto(orig));
  const dirtyRef = useRef(false); dirtyRef.current = dirty || (!!job && !orig);
  const jobRef = useRef<NsrJob | null>(null); jobRef.current = job;

  // ต่อชีต: Apps Script ที่ตั้งไว้ → ตัวเชื่อมบน claude.ai → ไม่มี
  const connect = async () => {
    setConnState('connecting'); setConnMsg('');
    const c: Conn | null = hubReady() ? hubConn() : await mcpConn().catch(() => null);
    if (!c) { setConn(null); setConnState('none'); return; }
    try {
      const list = await c.listTabs();
      setConn(c); setTabs(list); setConnState('live'); setLastSync(new Date()); sinceRef.current = Date.now();
      await loadTabs(c, list, true);
    } catch (e: any) { setConn(null); setConnState('error'); setConnMsg(c.kind === 'mcp' ? connError(e) : String(e?.message || e)); }
  };
  const sinceRef = useRef(0);
  // เชื่อม/เปลี่ยนการตั้งค่าศูนย์กลางทีม → ต่อใหม่
  const [hub, setHub] = useState<HubState | null>(null);
  useEffect(() => onHubState(s => setHub(prev => { if (prev && prev.status === 'off' && s.status !== 'off') setTimeout(connect, 0); return s; })), []);
  useEffect(() => { connect(); }, []);

  const putEntries = (list: { title: string; sheetId: number; index: number; grid: any }[], all?: TabInfo[]) => {
    setEntries(prev => {
      const m = new Map(prev);
      for (const t of list) { const j = parseNsrTab(t.title, t.grid, t.sheetId, t.index); if (j && t.title !== NSR_MASTER_TAB) m.set(t.title, { job: j, row: indexRow(j) }); else m.delete(t.title); }
      if (all) { const keep = new Set(all.map(t => t.title)); for (const k of [...m.keys()]) if (!keep.has(k)) m.delete(k); }
      lsSet(LS_CACHE, { at: new Date().toISOString(), jobs: [...m.values()].map(e => e.job) });
      return m;
    });
  };
  // อ่านทุกแท็บเป็นชุด ๆ (แสดงความคืบหน้า) — รายการแสดงผลจาก cache ระหว่างโหลด
  const loadTabs = async (c: Conn, list: TabInfo[], all: boolean) => {
    const titles = list.map(t => t.title).filter(t => t !== NSR_MASTER_TAB && (all || !entries.has(t)));
    if (!titles.length) return;
    setLoadPct({ done: 0, total: titles.length });
    try {
      for (let i = 0; i < titles.length; i += 40) {
        const part = await c.readTabs(titles.slice(i, i + 40));
        putEntries(part, all && i + 40 >= titles.length ? list : undefined);
        setLoadPct({ done: Math.min(titles.length, i + 40), total: titles.length });
      }
      setLastSync(new Date());
    } catch (e: any) { setConnMsg(c.kind === 'mcp' ? connError(e) : String(e?.message || e)); }
    finally { setLoadPct(null); }
  };

  // เรียลไทม์: ศูนย์กลางทีมแจ้งเลขรุ่นใหม่ (ทุก ~5 วิ) → ถามว่าแท็บไหนเปลี่ยน แล้วอ่านเฉพาะแท็บนั้น · รายชื่อแท็บตรวจทุก 30 วิ · ทั้งชีตทุก 10 นาที (กันพลาดกรณีแก้ผ่านช่องทางอื่น)
  const applyFresh = (t: { title: string; sheetId: number; index: number; grid: any }) => {
    const j = jobRef.current;
    if (!j || j.tab !== t.title) return;
    const fresh = parseNsrTab(t.title, t.grid, t.sheetId, t.index); if (!fresh) return;
    const before = JSON.stringify((origRef.current && { ...origRef.current, warnings: [] }) || null), after = JSON.stringify({ ...fresh, warnings: [] });
    if (before !== after) { if (dirtyRef.current) setRemote(fresh); else { setJob(clone(fresh)); setOrig(fresh); } }
  };
  useEffect(() => {
    if (!conn || connState !== 'live') return;
    let alive = true, busyR = false, lastList = Date.now(), lastFull = Date.now();
    const refresh = async () => {
      if (busyR || !alive) return; busyR = true;
      try {
        const since = sinceRef.current; const now = Date.now();
        let titles: string[] = [];
        if (conn.changes) {
          const ids = await conn.changes(since - 2000);
          const byId = new Map(tabsRef.current.map(t => [t.sheetId, t.title]));
          titles = ids.map(id => byId.get(id)).filter(Boolean) as string[];
          if (ids.some(id => !byId.has(id)) || now - lastList > 30000) {
            const list = await conn.listTabs(); if (!alive) return; setTabs(list); lastList = now;
            const known = new Set([...entriesRef.current.keys()]);
            titles.push(...list.filter(t => t.title !== NSR_MASTER_TAB && !known.has(t.title)).map(t => t.title));
            const m = new Map(list.map(t => [t.sheetId, t.title])); titles.push(...ids.map(id => m.get(id)).filter(Boolean) as string[]);
            putEntries([], list);
          }
        } else if (jobRef.current?.tab) titles = [jobRef.current.tab];
        titles = [...new Set(titles)].filter(t => t !== NSR_MASTER_TAB);
        if (titles.length) { const part = await conn.readTabs(titles); if (!alive) return; putEntries(part); part.forEach(applyFresh); }
        sinceRef.current = now; setLastSync(new Date());
        if (now - lastFull > 600000) { lastFull = now; await loadTabs(conn, tabsRef.current, true); }
      } catch { /* ชั่วคราว — รอบถัดไปลองใหม่ */ }
      finally { busyR = false; }
    };
    const unsub = conn.kind === 'script' ? onRev((_r, changed) => { if (changed) refresh(); else setLastSync(new Date()); }) : (() => { const id = window.setInterval(() => { if (document.visibilityState !== 'hidden') refresh(); }, 15000); return () => window.clearInterval(id); })();
    const id2 = window.setInterval(() => { if (document.visibilityState !== 'hidden' && Date.now() - lastList > 30000) refresh(); }, 30000);
    return () => { alive = false; unsub(); window.clearInterval(id2); };
  }, [conn, connState]);
  const origRef = useRef<NsrJob | null>(null); origRef.current = orig;
  const entriesRef = useRef(entries); entriesRef.current = entries;
  const tabsRef = useRef(tabs); tabsRef.current = tabs;

  // ── รายการค้นหา ──
  const all: Entry[] = useMemo(() => {
    const order = new Map(tabs.map(t => [t.title, t.index]));
    const sheetList = [...entries.values()].map(e => ({ ...e, row: { ...e.row, index: order.get(e.row.tab) ?? e.row.index } }));
    const locals = local.map(j => ({ job: j, row: indexRow(j), local: true }));
    return [...locals, ...sheetList];
  }, [entries, local, tabs]);
  const shown = useMemo(() => {
    const nq = norm(q);
    let l = all.filter(e => (!hideCopy || !e.row.copy) && (!fTier || (fTier === 'audit' ? e.row.audit > 0 : e.row.tier === fTier))
      && (!nq || norm(`${e.row.tab} ${e.row.name} ${e.row.province} ${e.row.participants ?? ''}`).includes(nq)));
    const pv = (e: Entry) => e.row.pct ?? -9;
    if (sort === 'pctDesc') l = [...l].sort((a, b) => pv(b) - pv(a));
    else if (sort === 'pctAsc') l = [...l].sort((a, b) => pv(a) - pv(b));
    else if (sort === 'name') l = [...l].sort((a, b) => (a.row.tab || a.row.name).localeCompare(b.row.tab || b.row.name, 'th'));
    else l = [...l].sort((a, b) => (a.local === b.local ? (a.row.index ?? 9999) - (b.row.index ?? 9999) : a.local ? -1 : 1));
    return l;
  }, [all, q, fTier, hideCopy, sort]);
  const counts = useMemo(() => { const c: Record<string, number> = { audit: 0 }; for (const e of all) { if (hideCopy && e.row.copy) continue; c[e.row.tier] = (c[e.row.tier] || 0) + 1; if (e.row.audit) c.audit++; } return c; }, [all, hideCopy]);

  // ── เปิด/สร้างงาน ──
  const confirmLeave = () => !dirtyRef.current || !job || window.confirm('งานที่เปิดอยู่ยังไม่ได้บันทึก — เปิดงานอื่นและทิ้งการแก้ไข?');
  const openEntry = (e: Entry) => { if (!confirmLeave()) return; setDraft(null); setJob(clone(e.job)); setOrig(e.local ? null : e.job); setRemote(null); setConflicts(null); setNewTab(null); setPane('calc'); try { window.scrollTo(0, 0); } catch { /* */ } };
  const startNew = () => {
    if (!confirmLeave()) return;
    setJob(newJob()); setOrig(null); setRemote(null); setConflicts(null); setNewTab(null); setDraft(null); setBriefOpen(false); setPane('calc');
  };
  // ── บรีฟ → ตารางคำนวณทั้งก้อน ──
  const [briefOpen, setBriefOpen] = useState(false);
  const [briefText, setBriefText] = useState('');
  const [useAi, setUseAi] = useState(true);
  const [aiOk, setAiOk] = useState(false);
  const [draft, setDraft] = useState<(NsrDraft & { ai?: { used: number; rejected: string[]; notes: string[] } | null }) | null>(null);
  useEffect(() => { const cl = (window as any).claude; if (cl && typeof cl.use === 'function') cl.use('sample').then((x: any) => setAiOk(!!x)).catch(() => {}); }, []);
  const history = () => [...entriesRef.current.values()].map(e => e.job);
  const loadDraft = (d: NsrDraft, ai?: { used: number; rejected: string[]; notes: string[] } | null) => {
    const j = d.job; (j as any).tabHint = d.tabName;
    setJob(j); setOrig(null); setRemote(null); setConflicts(null); setNewTab(null); setDraft({ ...d, ai: ai || null }); setPane('calc');
  };
  const runBrief = async (text: string) => {
    if (!text.trim()) { flash('วางบรีฟก่อน', true); return; }
    if (!confirmLeave()) return;
    let d = draftFromBrief(text, history());
    loadDraft(d); setBriefOpen(false);
    if (useAi && aiOk) {
      setBusy('ai');
      try {
        const sample = await (window as any).claude.use('sample');
        const raw = await sample.json(aiPrompt(text, d), { modelTier: 'default' });
        const r = applyAi(d, text, raw); d = r.draft;
        loadDraft(d, { used: r.used, rejected: r.rejected, notes: r.notes });
        flash(r.used ? `AI เติม/แก้ ${r.used} ช่อง (ทุกช่องมีหลักฐานจากบรีฟ)` : 'AI ตรวจแล้ว ไม่มีอะไรต้องเพิ่ม');
      } catch { flash('AI ไม่ตอบ — ใช้ผลจากตัวอ่านบรีฟ (คำนวณครบแล้ว)', true); }
      finally { setBusy(''); }
    } else flash('อ่านบรีฟและคำนวณครบแล้ว — ตรวจช่องที่ “ไม่พบ” แล้วบันทึกเป็นแท็บใหม่');
  };
  const fromCurrent = () => { const p = prefill(); if (!p || !confirmLeave()) return; loadDraft(draftFromCamp(p.camp, history(), p.brief)); flash('ดึงจากเอกสารที่ทำอยู่ + กำหนดการจริงแล้ว'); };
  const copyAsNew = () => { if (!job) return; setDraft(null); const j = clone(job); j.id = 'new:' + Date.now().toString(36); (j as any).tabHint = 'ปรับงบ ' + (job.tab || job.name); delete j.tab; delete j.sheetId; delete j.layout; delete j.sheet; j.lines = j.lines.map(l => ({ ...l, row: undefined, sheetTotal: undefined, priceFormula: undefined })); j.staff = j.staff.map(s => ({ ...s, row: undefined })); j.warnings = []; setJob(j); setOrig(null); setNewTab(null); flash('คัดลอกเป็นงานใหม่แล้ว — บันทึกเป็นแท็บใหม่ได้'); };

  // ── บันทึก ──
  const saveLocal = (j: NsrJob) => { const next = [{ ...j, updated: new Date().toISOString() }, ...local.filter(x => x.id !== j.id)].slice(0, 100); setLocal(next); lsSet(LS_LOCAL, next); };
  const saveInPlace = async (force = false) => {
    if (!conn || !job || !orig || !job.tab || job.sheetId == null) return;
    const d = diffForTab(orig, job);
    if (!d.ok) { flash(d.reason, true); return; }
    if (!d.edits.length) { flash('ยังไม่มีช่องที่เปลี่ยน'); return; }
    setBusy('save');
    try {
      const r = await conn.editCells(job.tab, job.sheetId, d.edits, force);
      if (!r.ok) { setConflicts(r.conflicts); return; }
      const [t] = await conn.readTabs([job.tab]);
      if (t) { putEntries([t]); const f = parseNsrTab(t.title, t.grid, t.sheetId, t.index); if (f) { setOrig(f); setJob(clone(f)); } }
      setConflicts(null); setRemote(null); setLastSync(new Date());
      flash(`บันทึกลงแท็บ "${job.tab}" แล้ว (${d.edits.length} ช่อง)`);
    } catch (e: any) { flash('บันทึกไม่สำเร็จ: ' + (conn.kind === 'mcp' ? connError(e) : e?.message), true); }
    finally { setBusy(''); }
  };
  const saveNewTab = async (title: string) => {
    if (!job) return;
    if (!conn) { saveLocal(job); setNewTab(null); flash('ยังไม่ได้เชื่อมชีต — เก็บไว้ในเครื่องนี้แล้ว (ส่งเข้าชีตได้เมื่อเชื่อมแล้ว)', true); return; }
    const name = title.trim(); if (!name) return;
    if (tabs.some(t => t.title.trim() === name)) { flash('มีแท็บชื่อนี้ในชีตแล้ว — ตั้งชื่ออื่น', true); return; }
    setBusy('new');
    try {
      const stamp = new Date().toLocaleString('th-TH');
      const g = jobToGrid(job, stamp); const m = gridMeta(job);
      const fmt2 = { boldRows: [1, 2, 4, m.sub, m.tot, m.price, m.profit, m.nsr, m.quote, m.staffTot], moneyCols: [3, 4, 5], pctCells: [[m.nsr, 3]] as [number, number][], staffCols: [3, m.staffTot] as [number, number] };
      const r = await conn.createTab(name, g, 1, fmt2);
      const [t] = await conn.readTabs([r.title]);
      if (t) { putEntries([t]); const f = parseNsrTab(t.title, t.grid, t.sheetId, t.index); if (f) { setOrig(f); setJob(clone(f)); } }
      setTabs(await conn.listTabs());
      const wasLocal = local.some(x => x.id === job.id); if (wasLocal) { const next = local.filter(x => x.id !== job.id); setLocal(next); lsSet(LS_LOCAL, next); }
      setNewTab(null); flash(`สร้างแท็บ "${r.title}" ในชีตแล้ว`);
    } catch (e: any) { flash('สร้างแท็บไม่สำเร็จ: ' + (conn.kind === 'mcp' ? connError(e) : e?.message), true); }
    finally { setBusy(''); }
  };

  const openedRef = useRef('');
  useEffect(() => { if (openTab && openedRef.current !== openTab) { const e = entries.get(openTab); if (e) { openedRef.current = openTab; openEntry(e); } } }, [openTab, entries]);
  const calc = useMemo(() => (job ? computeNsr(job) : null), [job]);
  const inPlace = job && orig && job.tab ? diffForTab(orig, job) : null;
  const isLocal = !!job && local.some(x => x.id === job.id);

  return (
    <div className="pb-6">
      {/* แถบสถานะ */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
        <div className="min-w-0 mr-auto">
          <h1 className="text-[22px] font-semibold leading-tight">คำนวณ NSR</h1>
          <p className="text-[14px] text-sub">ต้นทุน · ราคาขาย · กำไร และระดับอนุมัติ ตามตารางของทีม — งานย้อนหลังทุกแท็บอยู่ที่นี่</p>
        </div>
        <div className={`flex items-center gap-2 text-[13.5px] px-3 py-2 rounded-xl border ${connState === 'live' ? 'border-emerald-200 bg-emerald-50' : connState === 'error' ? 'border-amber-300 bg-amber-50' : 'border-brand-mist bg-white'}`} role="status" aria-live="polite">
          <span className={`w-2 h-2 rounded-full ${connState === 'live' ? 'bg-emerald-500' : connState === 'connecting' ? 'bg-sky-500 animate-pulse' : connState === 'error' ? 'bg-amber-500' : 'bg-gray-300'}`} />
          {connState === 'live' ? <span>เชื่อมชีตแล้ว · {conn?.kind === 'mcp' ? 'บัญชี Google ของคุณ' : 'ศูนย์กลางทีม'} · อัปเดต {timeTh(lastSync)}{loadPct ? ` · กำลังโหลด ${loadPct.done}/${loadPct.total} แท็บ` : ''}</span>
            : connState === 'connecting' ? <span>กำลังเชื่อมชีต…</span>
            : connState === 'error' ? <span>เชื่อมชีตไม่ได้: {connMsg}</span>
            : <span>ยังไม่เชื่อมชีต{cacheAt ? ` · แสดงข้อมูลล่าสุดในเครื่อง (${new Date(cacheAt).toLocaleDateString('th-TH')})` : ' · คำนวณได้ บันทึกในเครื่องนี้'}</span>}
          {connState === 'live' && <button onClick={() => conn && loadTabs(conn, tabs, true)} disabled={!!loadPct} aria-label="โหลดทุกแท็บใหม่" title="โหลดทุกแท็บใหม่" className="tap p-1 rounded-md hover:bg-white disabled:opacity-40"><RefreshCw className={`w-4 h-4 ${loadPct ? 'animate-spin' : ''}`} /></button>}
        </div>
        {connState !== 'live' && <button onClick={onConnect} className="tap px-3 py-2 rounded-xl border border-brand-mist bg-white hover:bg-paper text-[14px] font-medium flex items-center gap-1.5"><Settings className="w-4 h-4" />เชื่อมต่อทีม</button>}
        {connState === 'live' && sheetUrl() && <a href={sheetUrl()} target="_blank" rel="noopener" className="tap px-3 py-2 rounded-xl border border-brand-mist bg-white hover:bg-paper text-[14px] font-medium flex items-center gap-1.5"><ExternalLink className="w-4 h-4" />เปิดชีต</a>}
      </div>

      {/* มือถือ: สลับ รายการ / ตารางคำนวณ */}
      <div className="lg:hidden flex border-b border-brand-mist mb-3" role="tablist">
        {([['list', `งานย้อนหลัง (${all.length})`], ['calc', job ? 'ตารางคำนวณ' : 'งานใหม่']] as const).map(([id, l]) => (
          <button key={id} role="tab" aria-selected={pane === id} onClick={() => { if (id === 'calc' && !job) setBriefOpen(true); setPane(id); }}
            className={`tap px-4 py-2.5 text-[15px] border-b-2 -mb-px ${pane === id ? 'border-brand-navy font-semibold' : 'border-transparent text-sub'}`}>{l}</button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[minmax(300px,380px)_1fr] gap-4 items-start">
        {/* ── งานย้อนหลัง ── */}
        <section aria-label="งานย้อนหลัง" className={`${pane === 'list' ? '' : 'hidden'} lg:block ${card} p-3 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:flex lg:flex-col`}>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <button onClick={() => { setBriefOpen(true); setPane('calc'); if (!briefText) setBriefText(prefill()?.brief || ''); }} className="tap col-span-2 px-3 py-2.5 rounded-xl bg-brand-navy text-white text-[14px] font-semibold flex items-center justify-center gap-1.5"><Wand2 className="w-4 h-4" />คำนวณจากบรีฟ</button>
            <button onClick={startNew} className="tap px-3 py-2 rounded-xl border border-brand-mist hover:bg-paper text-[14px] font-medium flex items-center justify-center gap-1.5"><Plus className="w-4 h-4" />งานว่าง</button>
            <button onClick={fromCurrent} disabled={!prefill()} title="ใช้ข้อมูลและกำหนดการของเอกสารที่กำลังทำ" className="tap px-3 py-2 rounded-xl border border-brand-mist hover:bg-paper disabled:opacity-40 text-[14px] font-medium">จากเอกสารที่ทำอยู่</button>
          </div>
          <label className="relative block">
            <span className="sr-only">ค้นหางาน</span>
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-sub" />
            <input value={q} onChange={e => { setQ(e.target.value); setLimit(60); }} placeholder="ค้นหา: โรงเรียน หลักสูตร จังหวัด" className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-brand-mist text-[15px] focus:outline-none focus:ring-2 focus:ring-brand-navy/30" />
          </label>
          <div className="flex flex-wrap gap-1.5 mt-2" role="group" aria-label="กรองตามระดับ NSR">
            {[['', 'ทั้งหมด'], ...APPROVAL_MATRIX.map(m => [m.id, m.label.replace('NSR ', '').replace(' ถึงต่ำกว่า ', '–<')]), ['audit', 'สูตรชีตผิด']].map(([id, l]) => (
              <button key={id} onClick={() => setFTier(id)} aria-pressed={fTier === id} className={`tap px-2.5 py-1 rounded-full text-[12.5px] border ${fTier === id ? 'bg-brand-navy text-white border-brand-navy' : 'bg-white border-brand-mist text-sub hover:text-brand-ink'}`}>
                {l}{id ? ` ${counts[id] || 0}` : ''}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2 mt-2 text-[13px] text-sub">
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={hideCopy} onChange={e => setHideCopy(e.target.checked)} />ซ่อนแท็บ “Copy of”</label>
            <select value={sort} onChange={e => setSort(e.target.value as any)} aria-label="เรียงลำดับ" className="border border-brand-mist rounded-lg px-2 py-1 bg-white text-[13px]">
              <option value="sheet">ลำดับในชีต</option><option value="pctDesc">NSR สูง → ต่ำ</option><option value="pctAsc">NSR ต่ำ → สูง</option><option value="name">ชื่อแท็บ</option>
            </select>
          </div>
          <div className="text-[12.5px] text-sub mt-2">{shown.length} งาน{loadPct && !entries.size ? ' · กำลังโหลดจากชีต…' : ''}</div>
          <ul className="mt-1 -mx-1 lg:overflow-y-auto lg:flex-1 divide-y divide-brand-mist/70">
            {!all.length && <li className="px-2 py-6 text-[14px] text-sub">{connState === 'none' ? 'เชื่อมต่อทีมเพื่อดูงานย้อนหลังทุกแท็บในชีต NSR — หรือเริ่มจากบรีฟ/งานใหม่ได้เลย' : connState === 'error' ? 'อ่านชีตไม่ได้ — ดูข้อความด้านบน' : 'กำลังโหลด…'}</li>}
            {shown.slice(0, limit).map(e => {
              const on = !!job && (job.id === e.job.id || (!!job.tab && job.tab === e.row.tab));
              return (
                <li key={e.row.id}>
                  <button onClick={() => openEntry(e)} aria-current={on ? 'true' : undefined} className={`tap w-full text-left px-2 py-2.5 rounded-lg ${on ? 'bg-paper' : 'hover:bg-paper'}`}>
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-[14.5px] font-medium truncate">{e.row.tab || e.row.name || 'งานใหม่ (ยังไม่ตั้งชื่อ)'}</div>
                        <div className="text-[12.5px] text-sub truncate">{[e.local ? 'ในเครื่องนี้' : '', e.row.name !== e.row.tab ? e.row.name : '', e.row.province, e.row.participants ? `${e.row.participants} คน` : '', e.row.price ? `${fmt(e.row.price)} บ./ท่าน` : ''].filter(Boolean).join(' · ')}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`text-[13px] font-semibold px-2 py-0.5 rounded-md border ${e.row.tier ? TONE[toneOf(e.row.tier)] : 'text-sub border-brand-mist'}`}>{pctText(e.row.pct)}</div>
                        {e.row.audit > 0 && <div className="text-[11.5px] text-amber-700 mt-0.5">สูตรชีตผิด</div>}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
            {shown.length > limit && <li className="py-2 text-center"><button onClick={() => setLimit(l => l + 100)} className="tap text-[14px] text-brand-navy font-medium px-3 py-1.5 rounded-lg hover:bg-paper">แสดงเพิ่ม ({shown.length - limit})</button></li>}
          </ul>
        </section>

        {/* ── ตารางคำนวณ ── */}
        <section aria-label="ตารางคำนวณ NSR" className={`${pane === 'calc' ? '' : 'hidden'} lg:block min-w-0`}>
          {briefOpen || !job || !calc ? (
            <BriefBox text={briefText} setText={setBriefText} onRun={runBrief} aiOk={aiOk} useAi={useAi} setUseAi={setUseAi} busy={busy === 'ai'}
              hasHistory={entries.size} onClose={job ? () => setBriefOpen(false) : undefined} onBlank={startNew} />
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => setPane('list')} className="lg:hidden tap p-2 rounded-lg hover:bg-paper" aria-label="กลับไปรายการ"><ChevronLeft className="w-5 h-5" /></button>
                <div className="min-w-0 mr-auto">
                  <div className="text-[18px] font-semibold truncate">{job.tab || job.name || 'งานใหม่'}</div>
                  <div className="text-[13px] text-sub">{job.tab ? <>แท็บในชีต{dirty ? ' · มีการแก้ไขที่ยังไม่บันทึก' : ' · ตรงกับชีต'}</> : isLocal ? 'เก็บในเครื่องนี้ · ยังไม่อยู่ในชีต' : 'งานใหม่ · ยังไม่ได้บันทึก'}</div>
                </div>
                {job.tab && job.sheetId != null && tabUrl(job.sheetId) && <a href={tabUrl(job.sheetId)} target="_blank" rel="noopener" className="tap px-3 py-2 rounded-xl border border-brand-mist bg-white hover:bg-paper text-[14px] font-medium flex items-center gap-1.5"><ExternalLink className="w-4 h-4" />เปิดแท็บนี้</a>}
                {job.tab && <button onClick={copyAsNew} className="tap px-3 py-2 rounded-xl border border-brand-mist bg-white hover:bg-paper text-[14px] font-medium flex items-center gap-1.5"><Copy className="w-4 h-4" />คัดลอกเป็นงานใหม่</button>}
              </div>

              {remote && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[14px] flex flex-wrap items-center gap-2" role="alert">
                  <AlertTriangle className="w-4 h-4 text-amber-700" /><span className="flex-1 min-w-[12rem]">มีคนแก้แท็บนี้ในชีตระหว่างที่คุณแก้อยู่</span>
                  <button onClick={() => { setJob(clone(remote)); setOrig(remote); setRemote(null); }} className="tap px-3 py-1.5 rounded-lg bg-brand-navy text-white text-[13.5px] font-medium">โหลดค่าจากชีต (ทิ้งที่แก้)</button>
                  <button onClick={() => setRemote(null)} className="tap px-3 py-1.5 rounded-lg border border-amber-300 bg-white text-[13.5px]">แก้ต่อ</button>
                </div>
              )}

              {draft && calc && <DraftSummary d={draft} calc={calc} onOpenRef={t => { const e = entriesRef.current.get(t); if (e) openEntry(e); }} onClose={() => setDraft(null)} />}
              <div className="grid xl:grid-cols-[1fr_340px] gap-3 items-start">
                <div className="space-y-3 min-w-0">
                  <JobInfo job={job} set={p => setJob({ ...job, ...p })} />
                  <StaffTable job={job} calc={calc} set={staff => setJob({ ...job, staff })} />
                  <Lines job={job} calc={calc} set={lines => setJob({ ...job, lines })} />
                  <PriceVat job={job} calc={calc} set={p => setJob({ ...job, ...p })} />
                  {(calc.audit.length > 0 || job.warnings.length > 0) && (
                    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-[14px]">
                      <div className="font-semibold mb-1">ข้อสังเกตจากชีต (เว็บคำนวณจากทุกบรรทัดตามสูตรที่ถูกต้อง)</div>
                      <ul className="list-disc pl-5 space-y-1">{[...calc.audit, ...job.warnings].map((a, i) => <li key={i}>{a}</li>)}</ul>
                    </div>
                  )}
                </div>
                <div className="xl:sticky xl:top-20 space-y-3">
                  <Result calc={calc} participants={job.participants} />
                  <Approval calc={calc} />
                  {/* บันทึก */}
                  <div className={`${card} p-4 space-y-2`}>
                    <div className="text-[15px] font-semibold">บันทึก</div>
                    {job.tab && orig && (
                      <button onClick={() => saveInPlace(false)} disabled={!conn || !!busy || !inPlace || !inPlace.ok || !inPlace.edits.length}
                        className="tap w-full px-3 py-2.5 rounded-xl bg-accent enabled:hover:bg-accent-deep disabled:opacity-40 text-white text-[14px] font-semibold flex items-center justify-center gap-1.5">
                        <Save className="w-4 h-4" />{busy === 'save' ? 'กำลังบันทึก…' : `บันทึกลงแท็บเดิม${inPlace && inPlace.ok && inPlace.edits.length ? ` (${inPlace.edits.length} ช่อง)` : ''}`}
                      </button>
                    )}
                    {job.tab && inPlace && !inPlace.ok && <div className="text-[13px] text-amber-800">{inPlace.reason}</div>}
                    {job.tab && !conn && <div className="text-[13px] text-sub">เชื่อมชีตก่อนจึงบันทึกลงแท็บได้</div>}
                    {newTab == null ? (
                      <button onClick={() => setNewTab(tabNameFor({ ...job, name: (job as any).tabHint || job.tab || job.name }, tabs.map(t => t.title)))} disabled={!!busy}
                        className={`tap w-full px-3 py-2.5 rounded-xl text-[14px] font-semibold flex items-center justify-center gap-1.5 ${job.tab ? 'border border-brand-mist hover:bg-paper' : 'bg-accent hover:bg-accent-deep text-white'}`}>
                        <FilePlus className="w-4 h-4" />{conn ? 'บันทึกเป็นแท็บใหม่ในชีต' : 'บันทึกในเครื่องนี้'}
                      </button>
                    ) : (
                      <form onSubmit={e => { e.preventDefault(); saveNewTab(newTab); }} className="space-y-2">
                        <label className="block text-[13px] text-sub">ชื่อแท็บ (แบบทีม: หลักสูตร@โรงเรียน)
                          <input value={newTab} onChange={e => setNewTab(e.target.value)} autoFocus maxLength={99} className="mt-1 w-full px-3 py-2 rounded-lg border border-brand-mist text-[15px] text-brand-ink" />
                        </label>
                        <div className="flex gap-2">
                          <button type="submit" disabled={!!busy || !newTab.trim()} className="tap flex-1 px-3 py-2 rounded-lg bg-accent enabled:hover:bg-accent-deep disabled:opacity-40 text-white text-[14px] font-semibold">{busy === 'new' ? 'กำลังสร้าง…' : conn ? 'สร้างแท็บ' : 'บันทึก'}</button>
                          <button type="button" onClick={() => setNewTab(null)} className="tap px-3 py-2 rounded-lg border border-brand-mist text-[14px]">ยกเลิก</button>
                        </div>
                        {conn && <div className="text-[12.5px] text-sub">สร้างแท็บใหม่ต่อจากแท็บแม่แบบ ใส่สูตรเดียวกับชีต (รวมทุกบรรทัด) — ไม่แตะแท็บอื่น</div>}
                      </form>
                    )}
                    {isLocal && <button onClick={() => { const next = local.filter(x => x.id !== job.id); setLocal(next); lsSet(LS_LOCAL, next); setJob(null); setOrig(null); }} className="tap w-full px-3 py-2 rounded-xl text-[13.5px] text-red-700 hover:bg-red-50 flex items-center justify-center gap-1.5"><Trash2 className="w-4 h-4" />ลบงานนี้ออกจากเครื่อง</button>}
                    {!job.tab && !isLocal && conn && <button onClick={() => { saveLocal(job); flash('เก็บไว้ในเครื่องนี้แล้ว'); }} className="tap w-full px-3 py-2 rounded-xl text-[13.5px] text-sub hover:bg-paper">เก็บไว้ในเครื่องก่อน</button>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {conflicts && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="ชีตมีการแก้ไขระหว่างนี้">
          <div className="bg-white rounded-2xl p-5 w-full max-w-md shadow-lift">
            <div className="text-[16px] font-semibold">ชีตมีการแก้ไขระหว่างนี้</div>
            <p className="text-[14px] text-sub mt-1">ช่องที่คุณจะบันทึกถูกเปลี่ยนในชีตแล้ว:</p>
            <ul className="text-[13.5px] mt-2 max-h-40 overflow-auto list-disc pl-5">{conflicts.map((c, i) => <li key={i}>แถว {c.r} คอลัมน์ {String.fromCharCode(64 + c.c)} — ตอนนี้ในชีต: “{c.now || 'ว่าง'}”</li>)}</ul>
            <div className="flex flex-wrap gap-2 mt-4">
              <button onClick={async () => { setConflicts(null); if (conn && job?.tab) { const [t] = await conn.readTabs([job.tab]); const f = t && parseNsrTab(t.title, t.grid, t.sheetId, t.index); if (f) { setOrig(f); setJob(clone(f)); putEntries([t]); } } }} className="tap px-3 py-2 rounded-lg bg-brand-navy text-white text-[14px] font-medium">โหลดค่าล่าสุดจากชีต</button>
              <button onClick={() => saveInPlace(true)} className="tap px-3 py-2 rounded-lg border border-brand-mist text-[14px]">บันทึกทับ</button>
              <button onClick={() => setConflicts(null)} className="tap px-3 py-2 rounded-lg text-[14px] text-sub">ยกเลิก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ช่องตัวเลข: พิมพ์ "1,200" ได้ · ว่าง = ไม่ใส่ (คิด 0 เหมือนชีต) · พิมพ์ผิดรูป = ขอบส้ม ไม่เปลี่ยนค่า
function NumIn({ value, onChange, label, className = '', step, left }: { value: Num; onChange: (n: Num) => void; label: string; className?: string; step?: string; left?: boolean }) {
  const [s, setS] = useState(value == null ? '' : String(value));
  const [bad, setBad] = useState(false);
  const last = useRef(value);
  useEffect(() => { if (value !== last.current) { last.current = value; setS(value == null ? '' : String(Math.round(value * 100) / 100)); setBad(false); } }, [value]);
  return (
    <input aria-label={label} inputMode="decimal" value={s} data-step={step}
      onChange={e => { const t = e.target.value; setS(t); const r = readNum(t); if (r.bad) { setBad(true); return; } setBad(false); last.current = r.n; onChange(r.n); }}
      className={`w-full min-w-0 px-2 py-1.5 rounded-lg border ${left ? 'text-left px-3 py-2' : 'text-right'} tabular-nums text-[15px] text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-navy/30 ${bad ? 'border-amber-500 bg-amber-50' : 'border-brand-mist'} ${className}`} />
  );
}
const Step = ({ n, title, sub, children }: { n: number; title: string; sub?: string; children: React.ReactNode }) => (
  <div className={`${card} p-4`}>
    <div className="flex items-baseline gap-2 mb-3"><span className="text-[13px] font-semibold text-sub tabular-nums">ขั้น {n}</span><h2 className="text-[16px] font-semibold">{title}</h2>{sub && <span className="text-[13px] text-sub">{sub}</span>}</div>
    {children}
  </div>
);
const Formula = ({ children }: { children: React.ReactNode }) => <div className="text-[12.5px] text-sub tabular-nums">{children}</div>;

function JobInfo({ job, set }: { job: NsrJob; set: (p: Partial<NsrJob>) => void }) {
  return (
    <Step n={1} title="ข้อมูลงาน" sub="ช่อง B3–E3 ในชีต">
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-[13px] text-sub">ชื่องานที่จัด<input value={job.name} onChange={e => set({ name: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-lg border border-brand-mist text-[15px] text-brand-ink" /></label>
        <label className="text-[13px] text-sub">จังหวัดที่จัด<input value={job.province} onChange={e => set({ province: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-lg border border-brand-mist text-[15px] text-brand-ink" /></label>
        <label className="text-[13px] text-sub">จำนวนผู้เข้าร่วม (คน)<NumIn label="จำนวนผู้เข้าร่วม" value={job.participants} onChange={n => set({ participants: n })} className="mt-1" left /></label>
        <label className="text-[13px] text-sub">จำนวนคุณครู (คน)<NumIn label="จำนวนคุณครู" value={job.teachers} onChange={n => set({ teachers: n })} className="mt-1" left /></label>
      </div>
    </Step>
  );
}

function StaffTable({ job, calc, set }: { job: NsrJob; calc: ReturnType<typeof computeNsr>; set: (s: StaffLine[]) => void }) {
  const up = (i: number, p: Partial<StaffLine>) => set(job.staff.map((s, k) => (k === i ? { ...s, ...p } : s)));
  return (
    <Step n={2} title="ค่าตอบแทนทีมวิทยากร" sub="ตาราง H:M ในชีต">
      <div className="sm:hidden space-y-3">
        {job.staff.map((s, i) => (
          <div key={i} className="rounded-lg border border-brand-mist p-2.5">
            <div className="flex items-center gap-2"><input aria-label={`ประเภททีม แถว ${i + 1} (มือถือ)`} value={s.role} onChange={e => up(i, { role: e.target.value })} className="flex-1 min-w-0 px-2 py-1.5 rounded-lg border border-brand-mist text-[14.5px] font-medium" /><span className="tabular-nums font-semibold text-[15px]">{fmt(staffPay(s))}</span></div>
            <div className="grid grid-cols-4 gap-1.5 mt-2 text-[12px] text-sub">
              <label>บาท/วัน<NumIn label={`ค่าตอบแทนต่อวัน ${s.role} (มือถือ)`} value={s.rate} onChange={n => up(i, { rate: n })} /></label>
              <label>คน<NumIn label={`จำนวนคน ${s.role} (มือถือ)`} value={s.people} onChange={n => up(i, { people: n })} /></label>
              <label>วัน<NumIn label={`จำนวนวัน ${s.role} (มือถือ)`} value={s.days} onChange={n => up(i, { days: n })} /></label>
              <label>ล่วงหน้า/คน<NumIn label={`ค่าเดินทางล่วงหน้า ${s.role} (มือถือ)`} value={s.advance} onChange={n => up(i, { advance: n })} /></label>
            </div>
          </div>
        ))}
      </div>
      <div className="hidden sm:block overflow-x-auto -mx-1">
        <table className="w-full text-[14px] min-w-[560px]">
          <thead><tr className="text-[12.5px] text-sub text-left"><th className="font-medium px-1 pb-1">ประเภท</th><th className="font-medium px-1 pb-1 text-right">บาท/วัน</th><th className="font-medium px-1 pb-1 text-right">คน</th><th className="font-medium px-1 pb-1 text-right">วัน</th><th className="font-medium px-1 pb-1 text-right">ล่วงหน้า/คน</th><th className="font-medium px-1 pb-1 text-right">ต้องจ่าย</th></tr></thead>
          <tbody>
            {job.staff.map((s, i) => (
              <tr key={i} className="align-top">
                <td className="px-1 py-1"><input aria-label={`ประเภททีม แถว ${i + 1}`} value={s.role} onChange={e => up(i, { role: e.target.value })} className="w-full px-2 py-1.5 rounded-lg border border-brand-mist text-[14px]" /></td>
                <td className="px-1 py-1 w-24"><NumIn label={`ค่าตอบแทนต่อวัน ${s.role}`} value={s.rate} onChange={n => up(i, { rate: n })} /></td>
                <td className="px-1 py-1 w-16"><NumIn label={`จำนวนคน ${s.role}`} value={s.people} onChange={n => up(i, { people: n })} /></td>
                <td className="px-1 py-1 w-16"><NumIn label={`จำนวนวัน ${s.role}`} value={s.days} onChange={n => up(i, { days: n })} /></td>
                <td className="px-1 py-1 w-24"><NumIn label={`ค่าเดินทางล่วงหน้า ${s.role}`} value={s.advance} onChange={n => up(i, { advance: n })} /></td>
                <td className="px-1 py-1 text-right tabular-nums whitespace-nowrap pt-2.5">{fmt(staffPay(s))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Formula>ต้องจ่าย = บาท/วัน × คน × วัน + เดินทางล่วงหน้า × คน</Formula>
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-brand-mist text-[14.5px]">
        <span>รวมทีม <b className="font-semibold tabular-nums">{calc.staffPeople}</b> คน</span>
        <span>รวมค่าตอบแทน <b className="font-semibold tabular-nums">{fmt(calc.staffTotal)}</b> บาท</span>
      </div>
    </Step>
  );
}

function Lines({ job, calc, set }: { job: NsrJob; calc: ReturnType<typeof computeNsr>; set: (l: CostLine[]) => void }) {
  const [open, setOpen] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const up = (i: number, p: Partial<CostLine>) => set(job.lines.map((l, k) => (k === i ? { ...l, ...p } : l)));
  const used = new Set(job.lines.map(l => l.key || keyOf(l.label)));
  return (
    <Step n={3} title="ต้นทุนต่อผู้เข้าร่วม 1 คน" sub="ราคา × จำนวน = รวมเงิน (บาท/ท่าน)">
      <ul className="divide-y divide-brand-mist/70">
        {calc.lines.map((lc, i) => {
          const l = lc.line; const k = l.key || keyOf(l.label); const h = hintOf(k);
          return (
            <li key={i} className="py-2">
              <div className="flex items-center gap-1">
                <span className="text-[12.5px] text-sub tabular-nums w-5 shrink-0">{i + 1}</span>
                <input aria-label={`รายการ ${i + 1}`} value={l.label} onChange={e => up(i, { label: e.target.value })} className="flex-1 min-w-0 px-1.5 py-1 rounded-lg border border-transparent hover:border-brand-mist focus:border-brand-mist text-[14.5px] font-medium" />
                <button onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i} aria-label={`รายละเอียด ${l.label}`} className="tap w-8 h-8 rounded-lg hover:bg-paper text-sub text-[18px] leading-none shrink-0">{open === i ? '−' : '…'}</button>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,0.8fr)_auto_minmax(0,1fr)] gap-1.5 items-center pl-6 mt-1">
                <NumIn label={`ราคา ${l.label}`} value={l.price} onChange={n => up(i, { price: n, auto: false })} className={l.auto ? 'bg-paper' : ''} />
                <span className="text-sub" aria-hidden="true">×</span>
                <NumIn label={`จำนวน ${l.label}`} value={l.qty} onChange={n => up(i, { qty: n })} />
                <span className="text-sub" aria-hidden="true">=</span>
                <div className="text-right tabular-nums text-[15px] font-medium">{fmt(lc.total, lc.total % 1 ? 2 : 0)}</div>
              </div>
              {(lc.suggest || l.auto || l.priceFormula) && open !== i && (
                <div className="pl-6 mt-1 text-[12.5px] text-sub flex flex-wrap items-center gap-x-2">
                  {l.auto && lc.suggest ? <span>ใช้สูตร: {lc.suggest.text} = {fmt(lc.suggest.value, 2)}</span>
                    : lc.suggest ? <><span className={lc.diff ? 'text-amber-800' : ''}>สูตรแนะนำ: {lc.suggest.text} = {fmt(lc.suggest.value, 2)}</span><button onClick={() => up(i, { price: lc.suggest!.value, auto: true, qty: l.qty ?? 1 })} className="tap text-brand-navy font-medium underline underline-offset-2">ใช้สูตรนี้</button></>
                    : l.priceFormula ? <span>สูตรในชีต: {l.priceFormula}</span> : null}
                </div>
              )}
              {open === i && (
                <div className="pl-6 mt-1.5 text-[13px] text-sub space-y-1">
                  {h && <div>วิธีคิด: {h}</div>}
                  {l.priceFormula && <div>สูตรในชีต: <code className="text-brand-ink">{l.priceFormula}</code>{!l.auto ? ' — แก้ราคาแล้วบันทึกจะแทนสูตรด้วยตัวเลข' : ''}</div>}
                  {lc.suggest && <div>สูตรแนะนำ: {lc.suggest.text} = {fmt(lc.suggest.value, 2)} {l.auto ? <button onClick={() => up(i, { auto: false })} className="tap ml-1 text-brand-navy underline underline-offset-2">พิมพ์เอง</button> : <button onClick={() => up(i, { price: lc.suggest!.value, auto: true, qty: l.qty ?? 1 })} className="tap ml-1 text-brand-navy underline underline-offset-2">ใช้สูตรนี้</button>}</div>}
                  {l.row && <div>แถว {l.row} ในชีต</div>}
                  <button onClick={() => { set(job.lines.filter((_, k) => k !== i)); setOpen(null); }} className="tap text-red-700 flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" />ลบบรรทัดนี้</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {adding ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {STD_LINES.filter(s => !used.has(s.key)).map(s => <button key={s.key} onClick={() => { set([...job.lines, { label: s.label, price: null, qty: 1, key: s.key }]); setAdding(false); }} className="tap px-2.5 py-1 rounded-full border border-brand-mist text-[13px] hover:bg-paper">{s.label}</button>)}
          <button onClick={() => { set([...job.lines, { label: 'ค่าใช้จ่ายอื่นๆ', price: null, qty: 1, key: 'other' }]); setAdding(false); }} className="tap px-2.5 py-1 rounded-full border border-brand-mist text-[13px] hover:bg-paper">รายการอื่น (พิมพ์ชื่อเอง)</button>
          <button onClick={() => setAdding(false)} className="tap px-2.5 py-1 text-[13px] text-sub">ปิด</button>
        </div>
      ) : <button onClick={() => setAdding(true)} className="tap mt-2 text-[14px] text-brand-navy font-medium flex items-center gap-1"><Plus className="w-4 h-4" />เพิ่มบรรทัด</button>}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-brand-mist text-[14.5px]">
        <span>รวมต้นทุนก่อนภาษี (Subtotal) · {job.lines.length} บรรทัด</span><b className="font-semibold tabular-nums">{fmt(calc.subtotal, 2)}</b>
      </div>
    </Step>
  );
}

function PriceVat({ job, calc, set }: { job: NsrJob; calc: ReturnType<typeof computeNsr>; set: (p: Partial<NsrJob>) => void }) {
  return (
    <Step n={4} title="ราคาขายและภาษี">
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-[13px] text-sub">ราคาขาย / ท่าน (บาท)<NumIn label="ราคาขายต่อท่าน" value={job.price} onChange={n => set({ price: n })} className="mt-1 text-[17px] font-semibold" left /></label>
        <label className="text-[13px] text-sub">ภาษี
          <select value={job.vatMode} onChange={e => set({ vatMode: e.target.value as any })} className="mt-1 w-full px-3 py-2 rounded-lg border border-brand-mist bg-white text-[15px] text-brand-ink">
            <option value="rate">VAT 7% ของราคาขาย (แบบชีต)</option><option value="fixed">ตัวเลขคงที่ต่อท่าน</option><option value="none">ไม่มีภาษี</option>
          </select>
        </label>
        {job.vatMode === 'fixed' && <label className="text-[13px] text-sub">ภาษีต่อท่าน (บาท)<NumIn label="ภาษีต่อท่าน" value={job.vatFixed ?? null} onChange={n => set({ vatFixed: n })} className="mt-1" left /></label>}
      </div>
      <Formula>{job.vatMode === 'rate' ? `ภาษี = 7% × ราคาขาย ${calc.price != null ? fmt(calc.price) : '–'} = ${fmt(calc.vat, 2)}` : job.vatMode === 'fixed' ? `ภาษี = ${fmt(calc.vat, 2)} ต่อท่าน (พิมพ์เอง)` : 'ไม่คิดภาษี'}</Formula>
    </Step>
  );
}

function Result({ calc, participants }: { calc: ReturnType<typeof computeNsr>; participants: Num }) {
  const t = calc.tier; const n = participants || 0;
  const R = ({ l, f, v, strong }: { l: string; f?: string; v: string; strong?: boolean }) => (
    <div className="py-1.5">
      <div className="flex justify-between gap-3 text-[14.5px]"><span>{l}</span><span className={`tabular-nums ${strong ? 'font-semibold' : ''}`}>{v}</span></div>
      {f && <Formula>{f}</Formula>}
    </div>
  );
  return (
    <div className={`${card} p-4`} aria-live="polite">
      <div className="text-[13px] text-sub">NSR (กำไรจริง ÷ ราคาขาย)</div>
      <div className="flex items-end justify-between gap-3">
        <div className={`text-[38px] leading-none font-semibold tabular-nums mt-1 ${t ? (t.tone === 'bad' ? 'text-red-700' : t.tone === 'warn' ? 'text-amber-700' : t.tone === 'ok' ? 'text-emerald-700' : 'text-brand-navy') : 'text-sub'}`}>{pctText(calc.pct)}</div>
        {t && <span className={`text-[12.5px] px-2 py-1 rounded-md border ${TONE[t.tone]}`}>{t.label}</span>}
      </div>
      {calc.missing.length > 0 && <div className="mt-2 text-[13px] text-amber-800">ยังขาด: {calc.missing.join(' · ')}</div>}
      <div className="mt-3 divide-y divide-brand-mist/70">
        <R l="รวมต้นทุนก่อนภาษี" f={`ผลรวม ${calc.lines.length} บรรทัด`} v={fmt(calc.subtotal, 2)} />
        <R l="ภาษี" f={calc.price != null ? `7% × ${fmt(calc.price)}` : undefined} v={fmt(calc.vat, 2)} />
        <R l="ต้นทุนรวมสุทธิ / ท่าน" f={`${fmt(calc.subtotal, 2)} + ${fmt(calc.vat, 2)}`} v={fmt(calc.total, 2)} strong />
        <R l="ราคาขาย / ท่าน" v={calc.price != null ? fmt(calc.price) : '–'} />
        <R l="กำไรจริง / ท่าน" f={calc.price != null ? `${fmt(calc.price)} − ${fmt(calc.total, 2)}` : undefined} v={calc.profit != null ? fmt(calc.profit, 2) : '–'} strong />
        <R l="ยอด NSR ทั้งงาน" f={calc.profit != null && n ? `${fmt(calc.profit, 2)} × ${n} คน` : undefined} v={calc.nsrTotal != null ? fmt(calc.nsrTotal) : '–'} strong />
        <R l="ราคาในใบเสนอราคา" f={calc.price != null && n ? `${fmt(calc.price)} × ${n} คน` : undefined} v={calc.quote != null ? fmt(calc.quote) : '–'} />
        <R l="เป้ากำไร 30% / ท่าน" f={calc.gapToTarget != null ? (calc.gapToTarget >= 0 ? `เกินเป้า ${fmt(calc.gapToTarget, 2)}` : `ขาดอีก ${fmt(-calc.gapToTarget, 2)} ต่อท่าน`) : undefined} v={calc.target != null ? fmt(calc.target, 2) : '–'} />
      </div>
      <div className="mt-3 pt-3 border-t border-brand-mist">
        <div className="text-[13.5px] font-semibold mb-1">ราคาขายขั้นต่ำ / ท่าน</div>
        <div className="grid grid-cols-4 gap-1.5 text-center">
          {calc.minPrice.map(m => <div key={m.m} className="rounded-lg bg-paper py-1.5"><div className="text-[12px] text-sub">NSR {Math.round(m.m * 100)}%</div><div className="text-[14px] font-semibold tabular-nums">{m.price != null ? fmt(m.price) : '–'}</div></div>)}
        </div>
        <Formula>= รวมก่อนภาษี ÷ (1 − 7% − NSR ที่ต้องการ)</Formula>
      </div>
    </div>
  );
}

function Approval({ calc }: { calc: ReturnType<typeof computeNsr> }) {
  const t = calc.tier;
  const ICON = [Scissors, CalendarCheck, Phone];
  return (
    <div className={`${card} p-4`}>
      <div className="text-[15px] font-semibold">อนุมัติราคา</div>
      {!t ? <div className="text-[14px] text-sub mt-1">ใส่ราคาขายเพื่อดูระดับอนุมัติ</div> : (
        <>
          <div className={`mt-2 rounded-lg border px-3 py-2 text-[14px] ${TONE[t.tone]}`}>
            <div className="font-semibold">{t.label}</div>
            <div>{t.approver ? <>ผู้อนุมัติ: <b className="font-semibold">{t.approver}</b></> : 'ผู้อนุมัติ: รอยืนยันตาม Approval Matrix'}</div>
          </div>
          <div className="text-[13px] text-sub mt-2">ยังไม่เปิด Auto Approval — ทุกงานต้องให้ผู้อนุมัติยืนยันเอง</div>
          {calc.flags.length > 0 && <ul className="mt-2 text-[13px] text-amber-800 list-disc pl-5 space-y-0.5">{calc.flags.map((f, i) => <li key={i}>{f}</li>)}</ul>}
        </>
      )}
      <div className="mt-3 pt-3 border-t border-brand-mist">
        <div className="text-[13.5px] font-semibold">Fast Track 30 นาที</div>
        <ol className="mt-1.5 space-y-1.5">
          {FAST_TRACK.map((s, i) => { const I = ICON[i]; return <li key={i} className="flex gap-2 text-[13.5px]"><I className="w-4 h-4 mt-0.5 text-brand-navy shrink-0" /><span><b className="font-semibold">{i + 1}. {s.t}</b> — {s.d}</span></li>; })}
        </ol>
      </div>
      <details className="mt-3 pt-3 border-t border-brand-mist text-[13px]">
        <summary className="cursor-pointer font-medium">Approval Matrix และเงื่อนไขที่ยังรอยืนยัน</summary>
        <table className="w-full mt-2"><tbody>{APPROVAL_MATRIX.map(m => <tr key={m.id} className="border-b border-brand-mist/60"><td className="py-1">{m.label}</td><td className="py-1 text-right">{m.approver || 'รอยืนยัน'}</td></tr>)}</tbody></table>
        <ul className="mt-2 list-disc pl-5 text-sub space-y-0.5">{APPROVAL_RULES.map((r, i) => <li key={i}>{r}</li>)}</ul>
      </details>
    </div>
  );
}


// ── บรีฟ → คำนวณทั้งก้อน ──
const EX_BRIEF = 'โรงเรียนตัวอย่างวิทยา ค่าย STEM 3 วัน 2 คืน นักเรียน 80 คน ครู 6 คน พักที่ภูวิวรีสอร์ท ห้องละ 1,500 บาท พัก 4 คน รถบัส 2 คัน ราคา 3,290 บาท/ท่าน';
function BriefBox({ text, setText, onRun, aiOk, useAi, setUseAi, busy, hasHistory, onClose, onBlank }: { text: string; setText: (s: string) => void; onRun: (s: string) => void; aiOk: boolean; useAi: boolean; setUseAi: (b: boolean) => void; busy: boolean; hasHistory: number; onClose?: () => void; onBlank: () => void }) {
  return (
    <div className={`${card} p-4 sm:p-5`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-[18px] font-semibold">คำนวณ NSR จากบรีฟ</h2>
          <p className="text-[14px] text-sub mt-0.5">วางบรีฟตามที่ได้รับ ระบบเติมตารางให้ทั้งก้อน: จำนวนคน/ราคา จากบรีฟ · คืน/มื้อ จากกำหนดการจริง · ราคาต่อหน่วยและทีมวิทยากร จากงานจริงที่ใกล้ที่สุด{hasHistory ? ` (${hasHistory} งานในชีต)` : ''} · ที่เหลือตามสูตรทีม — ทุกช่องบอกที่มา</p>
        </div>
        {onClose && <button onClick={onClose} aria-label="ปิด" className="tap p-1.5 rounded-lg hover:bg-paper text-sub"><X className="w-5 h-5" /></button>}
      </div>
      <label className="block mt-3"><span className="sr-only">บรีฟ</span>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={6} placeholder={'เช่น ' + EX_BRIEF} aria-label="บรีฟสำหรับคำนวณ NSR"
          className="w-full px-3 py-2.5 rounded-xl border border-brand-mist text-[15px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-navy/30" />
      </label>
      <div className="flex flex-wrap items-center gap-2 mt-2">
        <button onClick={() => onRun(text)} disabled={busy || !text.trim()} className="tap px-4 py-2.5 rounded-xl bg-accent enabled:hover:bg-accent-deep disabled:opacity-40 text-white text-[14.5px] font-semibold flex items-center gap-1.5"><Wand2 className="w-4 h-4" />{busy ? 'AI กำลังตรวจ…' : 'อ่านบรีฟและคำนวณ'}</button>
        {aiOk && <label className="flex items-center gap-1.5 text-[13.5px]"><input type="checkbox" checked={useAi} onChange={e => setUseAi(e.target.checked)} />ให้ AI ตรวจและเติมจากบรีฟ</label>}
        {!text && <button onClick={() => setText(EX_BRIEF)} className="tap text-[13.5px] text-brand-navy underline underline-offset-2">ใส่บรีฟตัวอย่าง</button>}
        <button onClick={onBlank} className="tap ml-auto text-[13.5px] text-sub hover:text-brand-ink">หรือเริ่มตารางว่าง</button>
      </div>
      {!hasHistory && <div className="mt-3 text-[13px] text-amber-800">ยังไม่ได้เชื่อมชีต NSR — ราคาต่อหน่วยและทีมวิทยากรจะว่างไว้ให้ใส่เอง (เชื่อมต่อทีมเพื่อใช้งานจริงเป็นงานอ้างอิง)</div>}
    </div>
  );
}
const SRC_TONE: Record<string, string> = { 'บรีฟ': 'bg-brand-navy text-white', 'กำหนดการ': 'bg-sky-100 text-sky-900', 'งานอ้างอิง': 'bg-emerald-50 text-emerald-800 border border-emerald-200', 'สูตร': 'bg-paper text-brand-ink border border-brand-mist', 'AI': 'bg-violet-50 text-violet-800 border border-violet-200', 'ไม่พบ': 'bg-amber-50 text-amber-800 border border-amber-300' };
function DraftSummary({ d, calc, onOpenRef, onClose }: { d: NsrDraft & { ai?: { used: number; rejected: string[]; notes: string[] } | null }; calc: ReturnType<typeof computeNsr>; onOpenRef: (tab: string) => void; onClose: () => void }) {
  const [open, setOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 1024);
  const t = calc.tier; const p20 = calc.minPrice.find(m => m.m === 0.2)?.price;
  const miss = d.fields.filter(f => f.src === 'ไม่พบ').length;
  return (
    <div className={`${card} p-4`}>
      <div className="flex items-center gap-2">
        <button onClick={() => setOpen(o => !o)} aria-expanded={open} className="tap text-left flex-1 min-w-0">
          <div className="text-[15.5px] font-semibold">ผลอ่านบรีฟ · {d.fields.length} ช่อง{miss ? ` · ไม่พบ ${miss}` : ' · ครบ'}{d.ai ? ` · AI เติม ${d.ai.used}` : ''}</div>
          <div className="text-[13px] text-sub truncate">ชื่อแท็บที่แนะนำ: {d.tabName}{d.refs.length ? ` · อ้างอิง ${d.refs.length} งาน` : ''}</div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px]" aria-live="polite">
            <span className={`font-semibold tabular-nums ${t ? (t.tone === 'bad' ? 'text-red-700' : t.tone === 'warn' ? 'text-amber-700' : t.tone === 'ok' ? 'text-emerald-700' : 'text-brand-navy') : 'text-sub'}`}>NSR {pctText(calc.pct)}</span>
            {t && <span className={`text-[12px] px-1.5 py-0.5 rounded-md border ${TONE[t.tone]}`}>{t.label}{t.approver ? ` · ${t.approver}` : ''}</span>}
            {calc.profit != null && <span className="tabular-nums">กำไร/ท่าน {fmt(calc.profit)}</span>}
            {p20 != null && <span className="text-sub tabular-nums">ขายขั้นต่ำ NSR 20% = {fmt(p20)}</span>}
          </div>
        </button>
        <button onClick={onClose} aria-label="ซ่อนผลอ่านบรีฟ" className="tap p-1.5 rounded-lg hover:bg-paper text-sub"><X className="w-4 h-4" /></button>
      </div>
      {open && (
        <div className="mt-3 grid lg:grid-cols-2 gap-3">
          <ul className="space-y-1.5" aria-label="ที่มาของแต่ละช่อง">
            {d.fields.map((f: DraftField, i) => (
              <li key={i} className="flex items-start gap-2 text-[13.5px]">
                <span className={`shrink-0 text-[11.5px] px-1.5 py-0.5 rounded-md font-medium ${SRC_TONE[f.src]}`}>{f.src}</span>
                <span className="min-w-0"><b className="font-medium">{f.label}</b> {f.value}{f.note && <span className="text-sub"> · {f.note}</span>}</span>
              </li>
            ))}
          </ul>
          <div className="space-y-2">
            {d.refs.length > 0 && (
              <div>
                <div className="text-[13px] font-semibold mb-1">งานอ้างอิง (หลักสูตร/วัน/จำนวนคนใกล้กัน)</div>
                <ul className="space-y-1">{d.refs.map(r => (
                  <li key={r.tab}><button onClick={() => onOpenRef(r.tab)} className="tap w-full text-left text-[13px] px-2 py-1.5 rounded-lg hover:bg-paper flex justify-between gap-2"><span className="truncate">{r.tab}</span><span className="text-sub shrink-0 tabular-nums">{r.participants} คน · {r.days} วัน · NSR {pctText(r.pct)}</span></button></li>
                ))}</ul>
              </div>
            )}
            {(d.warnings.length > 0 || (d.ai && (d.ai.rejected.length || d.ai.notes.length))) && (
              <ul className="text-[13px] text-amber-800 list-disc pl-5 space-y-0.5">
                {d.warnings.map((w, i) => <li key={'w' + i}>{w}</li>)}
                {d.ai?.notes.map((w, i) => <li key={'n' + i}>AI: {w}</li>)}
                {d.ai?.rejected.map((w, i) => <li key={'r' + i}>ไม่ใช้ข้อเสนอ AI — {w}</li>)}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
