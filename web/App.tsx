import React, { useState, useMemo, useRef, useEffect } from 'react';
import DataHub from './DataHub';
import Home from './Home';
import Nsr from './Nsr';
import Board from './Board';
import Past from './Past';
import { readPastCache, pastJobs } from './past-data';
import { pastForSchool } from '../src/past-import';
import SmeMovePanel from './SmeMove';
import ActivityPicker from './ActivityPicker';
import VenuePicker from './VenuePicker';
import type { NsrPrefill } from './Nsr';
import { IN_APP, IS_IOS, IS_MOBILE, externalBrowserUrl, copyText, canShareFiles } from './platform';
import { makeEvent, record as recordEvent, programIdOf, loadLocal, saveLocal, dedupe, readTeam, summarize, programsCsv } from './registry';
import TeamConnect, { HubPill } from './TeamConnect';
import SearchPalette from './Search';
import { hubReady, onRev, onArea, acceptInvite, isInviteHash, setUserName, userName, deviceId, setupKeyFrom, onHubState, enqueue, hubUrl } from './hub';
import type { LogEv } from './registry';
import { loadJobs, saveJob, removeJob, newJobId, ago, loadTeamJobs, refreshTeamJobs, fetchTeamJob, pushJob, pushDelete, keepMine, onJobConflict, jobStatus, copyOf, nextCopyNo, TAB_ID, CopyInfo } from './jobs';
import type { Job, TeamJob } from './jobs';
import { Packer } from 'docx';
import {
  FileText, Sparkles, Calendar, Calculator, Image as ImageIcon, Download, Plus, Trash2,
  CheckCircle2, AlertTriangle, Lock, BookOpen, Layers, ChevronRight, Wand2, Eye,
  BarChart3, History, RefreshCw, Users, X, Check, Info, ExternalLink, Copy, Search, GripVertical, RotateCcw
} from 'lucide-react';
import {
  Camp, AddonSel, DocKind, Img, Subject, Activity, Kind, DurationMode, SUBJECTS, LIB, VENUES, DOC_TYPES, PRESETS,
  packDocx, FONT_FACE_CSS, blankCamp, fromPreset, parseBrief, parseDuration, migrateCamp, normalizeDuration, applyExtraction, buildSchedule, compose, check, isReady, subjectPool, buildDoc, fileName, money, staffText, defaultActs, defaultCourseActs, COURSES, LETTERHEADS, regionOf, Region, coursePhotoIds, hasCoursePhotos, courseDataset, courseById, docCodeFor, photoIdsFor, photoSetsFor, photoCaption, venuePhotoSetFor, venueCaption, venuePhotoCat, VENUE_PHOTO_LABEL, VenueEntry, CAT_ACTS, venueDirectory, durKeyLabel, durKeyOf, CoverSec, templatesOf, realCaption, readBrief, briefFields, cleanBrief, BriefField, BRAND, STEAM_GALLERY, letterheadFor, isSteamProgram, courseShortTh,
  showTeachers, notionActsInPlan, actStandard, notionActFor, courseLabel, dayCourseOf, scheduleActs, actInSchedule, PARTY_THEMES, isPartyRow, ADDON_COURSES, addonActivities, addonRowTitle, withAddonPrice, addonPriceNote, dayEndOf, parseHM, extendOptions
, moveRow, resetOrder
} from '../src/eqcamp-core';
import { FONT_REG_B64 } from '../src/font-data';

const KIND_ICON: Record<DocKind, React.ComponentType<{ className?: string }>> = {
  program: FileText, quotation: Calculator, booking: BookOpen, runsheet: Lock
};
const KIND_LABEL: Record<Kind, string> = { opening: 'เปิดค่าย', core: 'กิจกรรมหลัก', night: 'ภาคค่ำ', recreation: 'สันทนาการ', closing: 'ปิดค่าย' };

type VenueRec = { province: string; name: string; visit: string; note: string };
const LS_KEY = 'eqcamp.db.v1';

// ---- portable "database" persistence (localStorage + JSON export/import) ----
const u8ToB64 = (u8: Uint8Array) => { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); };
const b64ToU8 = (b: string) => { const bin = atob(b); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
const imgsOut = (imgs: Img[]) => imgs.map(i => ({ caption: i.caption, data: i.data ? u8ToB64(i.data) : undefined, ...(i.src ? { src: i.src } : {}) }));
const imgsIn = (arr: any[]): Img[] => (arr || []).map(i => ({ caption: i.caption || '', data: i.data ? b64ToU8(i.data) : undefined, ...(i.src ? { src: String(i.src) } : {}) }));
// ภาพจากไฟล์ PDF/Word ของค่ายนั้น (web/photos/<id>.jpg ที่เผยแพร่คู่กับหน้าเว็บ) — โหลดครั้งเดียวต่อภาพ
// เปิดไฟล์เดี่ยวแบบออฟไลน์ (file://) จะโหลดไม่ได้ → เอกสารยังสร้างได้ เพียงไม่มีหน้าภาพ + ขึ้นเตือนในหน้าตรวจ
export const PHOTO_BASE = 'photos/';
const photoCache = new Map<string, Promise<Uint8Array | null>>();
const fetchPhoto = (id: string): Promise<Uint8Array | null> => {
  if (!photoCache.has(id)) photoCache.set(id, fetch(PHOTO_BASE + id + '.jpg').then(r => (r.ok ? r.arrayBuffer() : Promise.reject(r.status))).then(b => new Uint8Array(b)).catch(() => { photoCache.delete(id); return null; }));
  return photoCache.get(id)!;
};
const isAuto = (imgs: Img[]) => imgs.every(im => !!im.src || !im.data); // ภาพที่ระบบดึงให้/ช่องว่าง (ไม่ใช่ภาพที่ทีมอัปโหลดเอง)
const snapshot = (camp: Camp, venues: VenueRec[], brief: string, withImages: boolean) => ({
  _app: 'EQ Camp Generator', _v: 2, savedAt: new Date().toISOString(),
  camp: { ...camp, actImgs: withImages ? imgsOut(camp.actImgs) : [], venueImgs: withImages ? imgsOut(camp.venueImgs) : [] },
  customVenues: venues, brief
});
const loadLS = (): any | null => { try { const r = localStorage.getItem(LS_KEY); return r ? JSON.parse(r) : null; } catch { return null; } };
const saveLS = (obj: any) => { try { localStorage.setItem(LS_KEY, JSON.stringify(obj)); return true; } catch { return false; } };
const rehydrate = (snap: any): { camp: Camp; venues: VenueRec[]; brief?: string } => {
  // migrate ข้อมูลรุ่นเก่า (เติม durationMode) แล้วคืนภาพกลับเป็น Uint8Array
  const camp: Camp = { ...migrateCamp(snap.camp || {}), actImgs: imgsIn(snap.camp?.actImgs), venueImgs: imgsIn(snap.camp?.venueImgs),
    extraActivities: (snap.camp?.extraActivities || []) as Activity[] };
  return { camp, venues: (snap.customVenues || []) as VenueRec[], brief: snap.brief };
};

// เวอร์ชันเว็บสาธารณะ (GitHub Pages) — ใครมีลิงก์ก็สร้าง/ดาวน์โหลดไฟล์ได้ ไม่ต้องลงชื่อเข้าใช้
export const WEB_URL = 'https://thongchaibutchat.github.io/eq-camp/';
const IN_CLAUDE = typeof window !== 'undefined' && !!(window as any).claude && typeof (window as any).claude.use === 'function';
export default function App() {
  const saved = typeof window !== 'undefined' ? loadLS() : null;
  const initial = saved ? rehydrate(saved) : null;
  const [camp, setCamp] = useState<Camp>(() => initial?.camp ?? fromPreset('pl0109'));
  const [customVenues, setCustomVenues] = useState<VenueRec[]>(() => initial?.venues ?? []);
  const [kind, setKind] = useState<DocKind>('program');
  // หน้า: home (หน้าแรก/แคตตาล็อก) · build (สร้างเอกสาร) · hub (คลังข้อมูล) — ผูกกับ #ลิงก์ ให้ปุ่มย้อนกลับ/บุ๊กมาร์กทำงานทุกเบราว์เซอร์
  type View = 'home' | 'build' | 'hub' | 'nsr' | 'board' | 'past';
  const fromHash = (): View => { const h = typeof location !== 'undefined' ? location.hash : ''; return h.startsWith('#/build') || h.startsWith('#/job/') ? 'build' : h.startsWith('#/data') ? 'hub' : h.startsWith('#/nsr') ? 'nsr' : h.startsWith('#/team') ? 'board' : h.startsWith('#/past') ? 'past' : 'home'; };
  const hashArg = (pre: string) => { try { const h = location.hash; return h.startsWith(pre) ? decodeURIComponent(h.slice(pre.length)) : ''; } catch { return ''; } };
  const [view, setViewState] = useState<View>(fromHash);
  const [hubInit, setHubInit] = useState<{ key: number; sec?: any; course?: string; q?: string }>({ key: 0 });
  const setView = (v: View, sub = '') => {
    setViewState(v); if (v === 'nsr') setNsrTab(sub); if (v === 'past') setPastQ(sub);
    const h = (v === 'build' ? '#/build' : v === 'hub' ? '#/data' : v === 'nsr' ? '#/nsr' : v === 'board' ? '#/team' : v === 'past' ? '#/past' : '#/') + (sub ? '/' + encodeURIComponent(sub) : '');
    try { if (location.hash !== h) history.pushState(null, '', h); } catch { /* sandbox */ }
    try { window.scrollTo(0, 0); } catch { /* ignore */ }
  };
  const [nsrTab, setNsrTab] = useState(() => hashArg('#/nsr/'));
  const [pastQ, setPastQ] = useState(() => hashArg('#/past/'));
  useEffect(() => { const on = () => { setViewState(fromHash()); setNsrTab(hashArg('#/nsr/')); }; window.addEventListener('popstate', on); window.addEventListener('hashchange', on); return () => { window.removeEventListener('popstate', on); window.removeEventListener('hashchange', on); }; }, []);
  // ลิงก์เชิญเข้าทีม (#/join/…) — เปิดจากแอปไหนก็เชื่อมต่อให้ทันที แล้วถามชื่อ
  const [connectOpen, setConnectOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [setupKey, setSetupKey] = useState('');
  useEffect(() => {
    const check = () => {
      const sk = setupKeyFrom(location.hash);
      if (sk) { setSetupKey(sk); setConnectOpen(true); try { history.replaceState(null, '', '#/'); } catch { /* */ } setViewState('home'); return; }
      // ลิงก์ทีม: #/join/… · #/t/<รหัส> · ?t=<รหัส> · # ที่แอปแชตแปลงเป็น %23
      let h = location.hash; try { if (/^#%2F|%23/i.test(h)) h = decodeURIComponent(h); } catch { /* */ }
      const qt = new URLSearchParams(location.search).get('t') || new URLSearchParams(location.search).get('join');
      if (!isInviteHash(h) && qt) h = qt.startsWith('eq-') ? '#/t/' + qt : '#/join/' + qt;
      if (isInviteHash(h)) { const ok = acceptInvite(h); try { history.replaceState(null, '', location.pathname + (ok ? '#/nsr' : '#/')); } catch { /* */ } setViewState(ok ? 'nsr' : 'home'); if (ok) { setConnectOpen(true); flash('เข้าร่วมทีมแล้ว — ใส่ชื่อของคุณ แล้วข้อมูลทีมจะซิงก์อัตโนมัติ'); } else flash('ลิงก์เชิญไม่ถูกต้อง', false); } };
    check(); window.addEventListener('hashchange', check); return () => window.removeEventListener('hashchange', check);
  }, []);
  // ค้นหาทั้งระบบ: ⌘K / Ctrl+K / "/"
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement; const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setSearchOpen(true); }
      else if (e.key === '/' && !typing) { e.preventDefault(); setSearchOpen(true); }
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, []);
  // ติดตั้งลงหน้าจอหลัก (Android/คอม Chrome/Edge)
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  useEffect(() => { const on = (e: any) => { e.preventDefault(); setInstallPrompt(e); }; window.addEventListener('beforeinstallprompt', on); return () => window.removeEventListener('beforeinstallprompt', on); }, []);
  const [inAppHide, setInAppHide] = useState(false);
  const [tab, setTab] = useState<'brief' | 'db' | 'header' | 'activities' | 'schedule' | 'price' | 'images' | 'stats'>('brief');
  const [brief, setBrief] = useState(initial?.brief ?? 'PL 0109/2569 โรงเรียนอำนาจเจริญ ม.1-2 จำนวน 72 คน ครู 6 คน ค่ายคณิตศาสตร์ Math Camp 3 วัน 2 คืน วันที่ 18 – 20 พฤศจิกายน 2569 ณ โรงแรมเชียงคานฮิลล์รีสอร์ท ราคาปกติ 4,590 ลดเหลือเพียง 3,290 บ./ท่าน');
  const [banner, setBanner] = useState<{ t: string; ok: boolean } | null>(null);
  // บน claude.ai: ผู้ชมที่ไม่ได้ลงชื่อเข้าใช้จะบันทึกไฟล์ไม่ได้ → ชี้ไปเวอร์ชันเว็บ
  const [dlBlocked, setDlBlocked] = useState(false);
  useEffect(() => {
    if (!IN_CLAUDE) return; let live = true;
    (window as any).claude.use('downloads').then((d: any) => { if (live && !d) setDlBlocked(true); }).catch(() => { if (live) setDlBlocked(true); });
    return () => { live = false; };
  }, []);
  const [dbSel, setDbSel] = useState<string>(() => (initial?.camp?.courseCode) || COURSES[0].code);
  const allVenues = useMemo<VenueRec[]>(() => [...VENUES, ...customVenues], [customVenues]);

  // ---- งานที่บันทึกไว้: ทุกงานบันทึกอัตโนมัติ เปิดทำต่อได้ภายหลัง ----
  const [jobId, setJobId] = useState<string>(() => (saved && saved.jobId) || newJobId());
  const [jobs, setJobs] = useState<Job[]>(() => loadJobs());
  // ค่าตั้งต้นที่ยังไม่แตะ = ไม่บันทึกเป็นงาน (เดิมเทียบกับ {} เมื่อเปิดครั้งแรก → ตัวอย่างตั้งต้นถูกบันทึกเป็นงานทุกครั้งที่มีคนเปิดเว็บใหม่)
  const baseline = useRef<string>(JSON.stringify({ ...camp, actImgs: 0, venueImgs: 0 }));
  // สำเนา: งานที่ทำสำเนาจากงานเดิม ชื่อ = "ชื่องานเดิม (สำเนา n)" (นับต่อจากสำเนาที่มีแล้ว) — เปลี่ยนโรงเรียนในสำเนา = ใช้ชื่อโรงเรียนใหม่ + บอกว่าสำเนาจากงานไหน
  const curCopy = useRef<CopyInfo | undefined>((saved && saved.copyOf) || undefined);
  const jobName = (c: Camp) => { const base = (c.school || '').trim() || 'ยังไม่ระบุโรงเรียน', cp = curCopy.current;
    return cp && base === ((cp.school || '').trim() || 'ยังไม่ระบุโรงเรียน') ? `${cp.name} (สำเนา ${cp.no})` : base; };
  const snapOf = (c: Camp) => ({ ...snapshot(c, customVenues, brief, false), ...(curCopy.current ? { copyOf: curCopy.current } : {}) });
  const jobMeta = (c: Camp) => ({ name: jobName(c), course: c.courseCode ? courseLabel(c.courseCode) : SUBJECTS[c.subject]?.label || '',
    school: c.school, dates: c.dates, duration: c.durationMode === 'half' ? 'ครึ่งวัน' : c.durationMode === 'day' ? `${c.days} วัน` : `${c.days} วัน ${c.nights} คืน` });
  // งานของทีม: ทุกการบันทึกส่งขึ้นศูนย์กลางทีม (หน่วง 2.5 วิ รวมการพิมพ์ต่อเนื่อง) · เครื่องอื่นเห็นภายใน ~5 วิ
  const [teamJobs, setTeamJobs] = useState<TeamJob[]>(() => loadTeamJobs());
  const [remoteJob, setRemoteJob] = useState<TeamJob | null>(null);
  const pushT = useRef<any>(null);
  // เสร็จสิ้น: จำเนื้องานตอนกด "เสร็จสิ้น" — แก้เนื้องานหลังจากนั้น = กลับเป็น "กำลังทำ" เอง (เปิดดู/ดาวน์โหลดไม่นับ)
  const doneKey = useRef<string>('');
  const campKey = (c: Camp) => JSON.stringify({ ...c, actImgs: 0, venueImgs: 0 });
  const storeJob = (c: Camp, fileMade = false) => {
    const sn = snapOf(c);
    const old = jobsRef.current.find(j => j.id === jobId);
    let st: Partial<Job> = {};
    if (old?.done && doneKey.current && campKey(c) !== doneKey.current) { st = { done: false, doneAt: '', doneBy: '' }; doneKey.current = ''; flash('งานนี้กลับเป็น "กำลังทำ" เพราะมีการแก้ไข — กด "เสร็จสิ้น" อีกครั้งเมื่อแก้เสร็จ'); }
    const list = saveJob({ id: jobId, ...jobMeta(c), snap: sn, fileMade, ...st } as any); setJobs(list);
    const rec = list.find(j => j.id === jobId); if (rec) lastSaved.current = rec.savedAt;
    if (rec && hubReady()) { clearTimeout(pushT.current); pushT.current = setTimeout(() => pushJob({ ...rec, by: userName() } as any), fileMade ? 0 : 2500); }
  };
  const jobIdRef = useRef(jobId); jobIdRef.current = jobId;
  const jobsRef = useRef(jobs); jobsRef.current = jobs;
  useEffect(() => {
    // งานของทีม: โหลดครั้งแรกเมื่อเชื่อมต่อ แล้วโหลดใหม่เฉพาะเมื่อ "ส่วนงาน" เปลี่ยน (ไม่โหลดทุกครั้งที่ใครบันทึกอะไรก็ได้)
    const load = async () => {
      const l = await refreshTeamJobs(); if (!l) return;
      setTeamJobs(l);
      const cur = l.find(t => t.id === jobIdRef.current), loc = jobsRef.current.find(j => j.id === jobIdRef.current);
      if (cur && !cur.deleted && cur.dev && cur.dev !== deviceId() && loc && cur.savedAt > loc.savedAt) setRemoteJob(cur);
    };
    const u1 = onRev((_r, had) => { if (!had) load(); });
    const u2 = onArea(['job'], load);
    // บันทึกไม่ผ่านเพราะมีคนบันทึกฉบับใหม่กว่า → ไม่ทับ ให้ผู้ใช้เลือก (โหลดฉบับล่าสุด / ทำต่อฉบับนี้)
    const u3 = onJobConflict((id, info) => {
      if (id !== jobIdRef.current) return;
      const loc = jobsRef.current.find(j => j.id === id);
      setRemoteJob({ id, savedAt: info.savedAt || new Date().toISOString(), by: info.by || '', name: loc?.name || '', dev: 'other' } as TeamJob);
    });
    return () => { u1(); u2(); u3(); };
  }, []);
  // เชื่อมต่อทีมครั้งแรกบนเครื่องนี้ → ส่งงานที่ทำไว้ทั้งหมด + ทะเบียนเดิมเข้าศูนย์กลาง (ครั้งเดียวต่อศูนย์กลาง)
  useEffect(() => onHubState(st => {
    if (st.status !== 'live') return;
    const flag = 'eqcamp.hub.seeded:' + hubUrl();
    try { if (localStorage.getItem(flag)) return; localStorage.setItem(flag, new Date().toISOString()); } catch { return; }
    const mine = loadJobs(); mine.forEach(j => pushJob({ ...j, by: userName() } as any));
    const evs = loadLocal(); for (let i = 0; i < evs.length; i += 300) enqueue('log.many', { events: evs.slice(i, i + 300) }, 'seed:' + i);
    if (mine.length || evs.length) flash(`ส่งข้อมูลเดิมของเครื่องนี้เข้าทีมแล้ว: งาน ${mine.length} · ทะเบียน ${evs.length} รายการ`);
  }), []);
  const openTeamJob = async (t: TeamJob) => {
    try {
      const full = await fetchTeamJob(t.id); if (!full) { flash('ไม่พบงานนี้ในทีมแล้ว', false); return; }
      const list = saveJob({ id: full.id, name: full.name, course: full.course, school: full.school, dates: full.dates, duration: full.duration, snap: full.snap, files: 0, done: !!(full.done ?? t.done), doneAt: full.doneAt || t.doneAt || '', doneBy: full.doneBy || t.doneBy || '' } as any); setJobs(list);
      const j = list.find(x => x.id === full.id); if (j) openJob(j);
      setRemoteJob(null);
    } catch (e: any) { flash('เปิดงานของทีมไม่สำเร็จ: ' + (e?.message || ''), false); }
  };
  // autosave to localStorage (captions kept, image binaries dropped to stay within quota)
  useEffect(() => { saveLS({ ...snapOf(camp), jobId }); }, [camp, customVenues, brief, jobId]);
  // บันทึกงานลงรายการ "งานของฉัน" เมื่อมีการแก้จริง (ไม่บันทึกแม่แบบตั้งต้นที่ยังไม่ได้แตะ)
  useEffect(() => {
    const key = JSON.stringify({ ...camp, actImgs: 0, venueImgs: 0 });
    if (key === baseline.current && !jobs.some(j => j.id === jobId)) return;
    const t = setTimeout(() => storeJob(camp), 700); return () => clearTimeout(t);
  }, [camp, brief, jobId]);
  // เริ่มงานใหม่ (งานเดิมบันทึกไว้แล้ว) / เปิดงานที่บันทึกไว้
  const startNewJob = (c: Camp) => { curCopy.current = undefined; setJobId(newJobId()); baseline.current = JSON.stringify({ ...c, actImgs: 0, venueImgs: 0 }); doneKey.current = ''; setFinish(null); };
  // ── เสร็จสิ้น ──
  const [finish, setFinish] = useState<null | 'confirm' | 'done'>(null);
  const curJob = jobs.find(j => j.id === jobId);
  const finishJob = () => {
    clearTimeout(pushT.current);
    const sn = snapOf(camp), now = new Date().toISOString();
    const list = saveJob({ id: jobId, ...jobMeta(camp), snap: sn, done: true, doneAt: now, doneBy: userName() } as any); setJobs(list);
    doneKey.current = campKey(camp);
    const rec = list.find(j => j.id === jobId); if (rec && hubReady()) pushJob({ ...rec, by: userName() } as any);
    setFinish('done');
  };
  const reopenJob = () => {   // ยังไม่เสร็จจริง → กลับเป็นกำลังทำ
    const list = saveJob({ id: jobId, ...jobMeta(camp), snap: snapOf(camp), done: false, doneAt: '', doneBy: '' } as any); setJobs(list);
    doneKey.current = ''; const rec = list.find(j => j.id === jobId); if (rec && hubReady()) pushJob({ ...rec, by: userName() } as any);
    setFinish(null); flash('ตั้งงานนี้เป็น "กำลังทำ" แล้ว');
  };
  const openJob = (j: Job, opts?: { msg?: string }) => {
    try {
      const { camp: c, venues, brief: b } = rehydrate(j.snap);
      clearTimeout(pushT.current);   // การบันทึกที่ค้างของงานก่อนหน้าส่งตามเดิม (ผูกกับรหัสงานเดิม ไม่ไปทับงานที่เปิดใหม่)
      curCopy.current = copyOf(j); lastSaved.current = j.savedAt;
      setJobId(j.id); baseline.current = JSON.stringify({ ...c, actImgs: 0, venueImgs: 0 }); doneKey.current = j.done ? baseline.current : '';
      setCamp(c); setCustomVenues(venues); if (b !== undefined) setBrief(b); setPhotoNonce(n => n + 1); setTab('header'); setJobsOpen(false);
      flash(opts?.msg || `เปิดงาน "${j.name}" แล้ว — แก้ตรงนี้บันทึกลงงานนี้เท่านั้น (บันทึกอัตโนมัติ)`);
    } catch (e) { flash('เปิดงานไม่สำเร็จ: ' + (e as Error).message, false); }
  };
  // ทำสำเนา = สร้างงานใหม่ (รหัสใหม่) ชื่อ "งานเดิม (สำเนา n)" แล้วเปิดสำเนาทันที — สิ่งที่แก้ต่อจากนี้ลงสำเนาเท่านั้น งานเดิมไม่เปลี่ยน
  // (เดิมไม่เปิดสำเนาให้ ผู้ใช้แก้ต่อคิดว่าอยู่ในสำเนา แต่บันทึกลงงานที่เปิดอยู่ = สำเนาก่อนหน้า/ต้นฉบับ → ทับกัน)
  const copyJob = (j: Job) => {
    if (j.id === jobId) storeJob(camp);   // บันทึกงานที่เปิดอยู่ก่อน (ถ้ากำลังแก้)
    const src = loadJobs().find(x => x.id === j.id) || j;
    const parent = copyOf(src), root = parent ? parent.root : src.id;
    const rootName = parent ? parent.name : (String(src.snap?.camp?.school || '').trim() || src.name.replace(/ \(สำเนา \d+\)$/, ''));
    const no = nextCopyNo(root, rootName, loadJobs(), teamJobs);
    const info: CopyInfo = { id: src.id, root, name: rootName, school: String(src.snap?.camp?.school || ''), no };
    const id = newJobId();
    const list = saveJob({ id, name: `${rootName} (สำเนา ${no})`, course: src.course, school: src.school, dates: src.dates, duration: src.duration, snap: { ...src.snap, copyOf: info }, files: 0, done: false, doneAt: '', doneBy: '' } as any);
    setJobs(list); const r = list.find(x => x.id === id);
    if (r) { if (hubReady()) pushJob({ ...r, by: userName() } as any); openJob(r, { msg: `ทำสำเนาแล้ว — ตอนนี้กำลังแก้ "${r.name}" (งานเดิมไม่เปลี่ยน)` }); }
  };
  const copyTeamJob = async (t: TeamJob) => {
    try { const full = await fetchTeamJob(t.id); if (!full) { flash('ไม่พบงานนี้ในทีมแล้ว', false); return; }
      copyJob({ id: full.id, name: full.name, course: full.course, school: full.school, dates: full.dates, duration: full.duration, snap: full.snap, savedAt: full.savedAt, files: 0 } as Job);
    } catch (e: any) { flash('ทำสำเนาไม่สำเร็จ: ' + (e?.message || ''), false); }
  };
  // สองแท็บเปิดงานเดียวกัน → เตือน (ไม่ให้ทับกันเงียบ ๆ)
  const lastSaved = useRef<string>('');
  const [otherTab, setOtherTab] = useState<Job | null>(null);
  useEffect(() => {
    const on = (e: StorageEvent) => {
      if (e.key !== 'eqcamp.jobs.v1') return;
      const j = loadJobs().find(x => x.id === jobIdRef.current);
      if (j && j.tab && j.tab !== TAB_ID && j.savedAt > lastSaved.current) setOtherTab(j);
    };
    window.addEventListener('storage', on); return () => window.removeEventListener('storage', on);
  }, []);
  const [jobsOpen, setJobsOpen] = useState(false);
  const deleteJob = (j: Job) => { if (!confirm(`ลบงาน "${j.name}" ออกจากรายการ${hubReady() ? 'ของทีม' : ''}? (ไฟล์ที่ดาวน์โหลดไปแล้วไม่หาย)`)) return; setJobs(removeJob(j.id)); pushDelete(j.id); setTeamJobs(t => t.map(x => x.id === j.id ? { ...x, deleted: true } : x)); if (j.id === jobId) { curCopy.current = undefined; setJobId(newJobId()); } };
  useEffect(() => { const id = hashArg('#/job/'); if (!id) return; const loc = loadJobs().find(j => j.id === id); if (loc) openJob(loc); else if (hubReady()) openTeamJob({ id } as TeamJob); try { history.replaceState(null, '', '#/build'); } catch { /* */ } }, []);
  const fileInput = useRef<HTMLInputElement>(null);
  const aiReq = useRef(0);
  const [busy, setBusy] = useState(false);
  const [editRow, setEditRow] = useState<{ day: number; i: number } | null>(null);
  // ลากย้ายช่วงในกำหนดการ (เมาส์/นิ้ว/แป้นลูกศร) — เวลาเรียงใหม่ตามความยาวเดิมของแต่ละช่วง เวลาเลิกของวันไม่เปลี่ยน
  const [drag, setDrag] = useState<{ day: number; from: number; over: number } | null>(null);
  const dragRef = useRef<{ day: number; from: number; over: number } | null>(null);
  const doMove = (day: number, from: number, to: number) => {
    if (from === to) return;
    const dayOrders = moveRow(camp, plan, day, from, to); const nc = { ...camp, dayOrders };
    const moved = plan.days.find(x => x.day === day)?.items[from];
    const np = buildSchedule(nc); const now = np.days.find(x => x.day === day)?.items.find(r => r.key && r.key === moved?.key);
    set({ dayOrders }); setEditRow(null);
    if (moved && now) flash(`ย้าย “${moved.title.slice(0, 40)}” ไปช่วง ${now.time} แล้ว · เวลาช่วงอื่นเลื่อนตาม เวลาเลิกเท่าเดิม`);
  };
  const overIndex = (day: number, y: number) => {
    const rows = Array.from(document.querySelectorAll<HTMLElement>(`[data-sched-day="${day}"] > [data-row]`));
    let at = rows.length - 1;
    for (let k = 0; k < rows.length; k++) { const b = rows[k].getBoundingClientRect(); if (y < b.top + b.height / 2) { at = k; break; } }
    return Math.max(0, at);
  };
  const gripProps = (day: number, i: number, n: number, label: string) => ({
    'aria-label': `ลากเพื่อย้าย ${label} (หรือกดลูกศรขึ้น/ลง)`, title: 'ลากขึ้นลงเพื่อย้ายช่วง',
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return; e.preventDefault(); (e.currentTarget as any).setPointerCapture?.(e.pointerId);
      const st = { day, from: i, over: i }; dragRef.current = st; setDrag(st);
    },
    onPointerMove: (e: React.PointerEvent<HTMLButtonElement>) => {
      const st = dragRef.current; if (!st) return;
      if (e.clientY < 70) window.scrollBy(0, -14); else if (e.clientY > window.innerHeight - 70) window.scrollBy(0, 14);
      const over = overIndex(day, e.clientY); if (over !== st.over) { const nx = { ...st, over }; dragRef.current = nx; setDrag(nx); }
    },
    onPointerUp: () => { const st = dragRef.current; dragRef.current = null; setDrag(null); if (st) doMove(st.day, st.from, st.over); },
    onPointerCancel: () => { dragRef.current = null; setDrag(null); },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowUp' && i > 0) { e.preventDefault(); doMove(day, i, i - 1); }
      if (e.key === 'ArrowDown' && i < n - 1) { e.preventDefault(); doMove(day, i, i + 1); }
    },
  });
  // มือถือ: เมื่อไฟล์พร้อม แสดงแผ่น "บันทึก/แชร์/เปิด" ให้ผู้ใช้แตะเอง (iOS/Android ต้องมีการแตะสด ๆ จึงแชร์/ดาวน์โหลดได้แน่นอน)
  const [saveSheet, setSaveSheet] = useState<{ files: { blob: Blob; name: string }[]; title: string } | null>(null);
  // ความคืบหน้าการสร้าง PDF (มือถือใช้เวลานานกว่า — ต้องเห็นว่ายังทำงานอยู่)
  const [progress, setProgress] = useState<{ label: string; pct: number } | null>(null);

  // ---- บันทึกสถิติการสร้างไฟล์ (db capability) — เก็บทุกครั้งที่เซฟไฟล์สำเร็จ เพื่อตรวจย้อนหลัง/ดูสถิติ ----
  const useCap = async (name: string): Promise<any> => {
    const cl = (window as any).claude;
    return cl && typeof cl.use === 'function' ? await cl.use(name).catch(() => null) : null;
  };
  // อ่านตัวตนผู้ใช้ (เก็บ id + ชื่อ snapshot สำหรับ audit) — ไม่พังถ้าไม่มี user capability
  const whoRef = useRef<{ by: string; byName: string } | null>(null);
  const whoami = async () => {
    if (whoRef.current) return whoRef.current;
    let by = '', byName = '';
    try { const u = await useCap('user'); if (u) { const me = await u.me?.(); by = (me?.id) || (await u.id?.()) || ''; byName = (me?.name) || ''; } } catch {}
    whoRef.current = { by, byName }; return whoRef.current;
  };
  const logEvent = async (action: string, c: Camp, dk?: DocKind) => {
    try { storeJob(c, true); } catch { /* เงียบ */ }
    // ทะเบียนโปรแกรม: เครื่องนี้ + ชีตทีม (ถ้าตั้งค่า) — ทำงานทุกที่ ไม่ต้องลงชื่อเข้าใช้
    try { await recordEvent(makeEvent(action, c, dk, IN_CLAUDE ? 'claude.ai' : /github\.io$/.test(location.hostname) ? 'เว็บ' : 'ไฟล์ในเครื่อง', { by: deviceId(), byName: userName() }, jobId)); } catch { /* เงียบ */ }
    try {
      const db = await useCap('db'); if (!db) return;          // เงียบ ๆ ถ้าเปิดนอก claude.ai / ไม่ได้ลงชื่อเข้าใช้
      const who = await whoami();
      await db.collection('events').add({ eid: '', programId: programIdOf(c),
        ts: new Date().toISOString(), action, docKind: dk || '',
        docCode: c.docCode || '', school: c.school || '', courseCode: c.courseCode || '', subject: c.subject || '',
        durationMode: c.durationMode || '', days: c.days || 0, nights: c.nights || 0,
        students: c.students || 0, teachers: c.teachers || 0,
        normalPrice: withAddonPrice(c).normalPrice || 0, specialPrice: withAddonPrice(c).specialPrice || 0,
        province: c.province || '', region: (c.region || '') as string,
        by: who.by, byName: who.byName
      });
    } catch {/* อย่าให้การบันทึกสถิติทำให้ดาวน์โหลดพัง */}
  };
  // ส่งออกไฟล์ข้อความ (CSV) ผ่านช่องทางเดียวกับ Word/PDF
  const saveText = async (filename: string, text: string, mime: string) => {
    const blob = new Blob(['﻿' + text], { type: mime });
    const downloads = await useCap('downloads');
    if (downloads) { try { await downloads.save({ filename, data: blob }); return; } catch (e: any) { if (e?.code === 'declined') return; } }
    anchorDownload(blob, filename);
  };

  const plan = useMemo(() => buildSchedule(camp), [camp]);
  const k = useMemo(() => compose(camp, plan), [camp, plan]);
  const checks = useMemo(() => check(camp, plan), [camp, plan]);
  // ---- ภาพจากไฟล์ของค่ายนั้น: ดึงอัตโนมัติเมื่อหลักสูตร/ระยะเวลา/แม่แบบ/ที่พักเปลี่ยน (ไม่ทับภาพที่ทีมอัปโหลดเอง) ----
  const [photoNonce, setPhotoNonce] = useState(0);
  const [briefReport, setBriefReport] = useState<{ fields: BriefField[]; by: string } | null>(null);
  const [photoState, setPhotoState] = useState<'idle' | 'loading' | 'ok' | 'partial' | 'offline'>('idle');
  const wantAct = photoIdsFor(camp).join(',');
  const venueSet = venuePhotoSetFor(camp.venue);
  const wantVen = venueSet ? venueSet.photos.join(',') : '';
  useEffect(() => {
    const ids = wantAct ? wantAct.split(',') : [];
    const cur = camp.actImgs;
    if (!isAuto(cur)) return;
    if (cur.length === ids.length && cur.every((im, i) => im.src === ids[i] && im.data)) { setPhotoState(ids.length ? 'ok' : 'idle'); return; }
    let live = true; setPhotoState(ids.length ? 'loading' : 'idle');
    Promise.all(ids.map(fetchPhoto)).then(arr => {
      if (!live) return;
      const got = ids.map((id, i) => ({ id, d: arr[i] })).filter(x => x.d);
      setCamp(c => (isAuto(c.actImgs) ? { ...c, actImgs: got.map((x, i) => ({ data: x.d!, caption: photoCaption(c, i), src: x.id })) } : c));
      setPhotoState(!ids.length ? 'idle' : got.length === ids.length ? 'ok' : got.length ? 'partial' : 'offline');
    });
    return () => { live = false; };
  }, [wantAct, photoNonce]);
  useEffect(() => {
    const ids = wantVen ? wantVen.split(',') : [];
    if (!isAuto(camp.venueImgs)) return;
    if (camp.venueImgs.length === ids.length && camp.venueImgs.every((im, i) => im.src === ids[i] && im.data)) return;
    let live = true;
    Promise.all(ids.map(fetchPhoto)).then(arr => {
      if (!live) return;
      const got = ids.map((id, i) => ({ id, d: arr[i] })).filter(x => x.d);
      setCamp(c => (isAuto(c.venueImgs) ? { ...c, venueImgs: got.map((x, i) => ({ data: x.d!, caption: venueCaption(venueSet ? venueSet.name : '', i), src: x.id })) } : c));
    });
    return () => { live = false; };
  }, [wantVen, photoNonce]);
  // ราคาเริ่มต้นจากแม่แบบ (เฉพาะเมื่อบรีฟยังไม่มีราคา) — หน้าตรวจเตือนให้ยืนยันราคาจริง
  const tplPrice = plan.tpl && plan.tpl.exact ? plan.tpl.price : undefined;
  useEffect(() => {
    if (tplPrice && !(camp.normalPrice > 0) && !(camp.specialPrice > 0)) set({ normalPrice: tplPrice.n, specialPrice: tplPrice.s });
  }, [plan.tpl ? plan.tpl.id : '']);
  const ready = isReady(checks);
  const total = camp.students * withAddonPrice(camp).specialPrice; // รวมราคากิจกรรมเสริม
  const cost = camp.students * camp.costPerPerson;
  const profit = total - cost;
  const margin = total ? (profit / total) * 100 : 0;

  const set = (patch: Partial<Camp>) => setCamp(c => ({ ...c, ...patch }));
  // หน้า NSR: เริ่มงานใหม่จากเอกสารที่กำลังทำ (ชื่องาน/จังหวัด/จำนวนคน/ราคาพิเศษ/จำนวนวัน) — ไม่ส่งต้นทุนใด ๆ
  // หน้า NSR: เริ่มจากเอกสารที่กำลังทำ (ข้อมูลค่าย + บรีฟ + กำหนดการจริง) — ไม่ส่งต้นทุนใด ๆ
  const nsrPrefill = (): NsrPrefill | null => (camp.students || (camp.school && !/\.{3}/.test(camp.school)) ? { camp: withAddonPrice(camp), brief } : null);
  const flash = (t: string, ok = true) => { setBanner({ t, ok }); window.clearTimeout((flash as any)._t); (flash as any)._t = window.setTimeout(() => setBanner(null), 4200); };

  // mode: 'new' = เริ่มจากค่าว่าง (กันข้อมูลงานเก่าปน), 'update' = แก้งานปัจจุบัน
  const applyBrief = (mode: 'new' | 'update') => {
    const dur = parseDuration(cleanBrief(brief).ar);
    const r = readBrief(brief, mode === 'new' ? blankCamp() : camp);
    if (mode === 'new') startNewJob(blankCamp());
    setCamp(r.camp);
    setBriefReport({ fields: r.fields, by: 'ระบบอ่านบรีฟ' });
    if (!dur.resolved) flash('แปลงบรีฟแล้ว แต่อ่าน "ระยะเวลา" จากบรีฟไม่ออก — โปรดเลือกระยะเวลาเองในแท็บ 2 (ยังไม่ได้เปลี่ยนจากค่าเดิม)', false);
    else if (dur.ambiguous) flash('แปลงบรีฟแล้ว ' + (dur.note || 'ระบุจำนวนวันแต่ไม่บอกจำนวนคืน โปรดยืนยันในแท็บ 2'), false);
    else flash(`แปลงบรีฟเรียบร้อย (${mode === 'new' ? 'งานใหม่' : 'อัปเดตงานปัจจุบัน'}) · ระยะเวลา: ${dur.mode === 'half' ? 'ครึ่งวัน' : dur.mode === 'day' ? `${dur.days} วัน ไป-กลับ` : `${dur.days} วัน ${dur.nights} คืน`} + เตรียมช่องภาพให้แล้ว`);
  };
  // ให้ AI (Claude) ดึงข้อมูลจากบรีฟภาษาคน — ใช้ capability sample บน artifact; fallback เป็น regex
  const aiExtract = async (mode: 'new' | 'update') => {
    if (busy) return;
    setBusy(true);
    const reqId = ++aiReq.current;
    const stale = () => reqId !== aiReq.current;
    const ctl = new AbortController();
    const timer = window.setTimeout(() => ctl.abort(), 90000);
    try {
      const cl = (window as any).claude;
      const sample = cl && typeof cl.use === 'function' ? await cl.use('sample').catch(() => null) : null;
      if (stale()) return;
      if (!sample) { applyBrief(mode); return; } // เวอร์ชันเว็บ/ไม่มีสิทธิ์ AI → อ่านบรีฟแบบปกติ (ผลเหมือนปุ่มอ่านบรีฟ)
      flash('AI กำลังอ่านบรีฟและดึงข้อมูล...');
      const courseList = COURSES.map(c => `${c.code}=${c.name}`).join('; ');
      // อ่านแบบกติกาก่อน → ส่งให้ AI ตรวจทาน/เติมส่วนที่ขาด (AI ไม่ต้องเริ่มจากศูนย์ และผลสุดท้ายไม่แย่กว่าตัวอ่านปกติ)
      const pre = readBrief(brief, mode === 'new' ? blankCamp() : camp);
      const preJson = JSON.stringify(Object.fromEntries(pre.fields.filter(f => f.ok).map(f => [f.label, f.value])));
      const clean = cleanBrief(brief).th;
      const prompt = `คุณเป็นผู้ช่วยฝ่ายขายค่ายวิชาการ อ่าน "บรีฟ" ภาษาไทยแบบอิสระด้านล่าง แล้วดึงข้อมูลเป็น JSON ออบเจ็กต์เดียวตามคีย์นี้ (เดาจากบริบทได้ ถ้าไม่พบให้ใส่ null — ห้ามแต่งข้อมูลที่ไม่มีในบรีฟ):
{"docCode":string|null,"courseCode":string|null,"subject":"math"|"steam"|"english"|"ai"|"chinese"|"leadership"|null,"school":string|null,"level":string|null,"students":number|null,"teachers":number|null,"durationMode":"half"|"day"|"overnight"|null,"days":number|null,"nights":number|null,"dates":string|null,"province":string|null,"venue":string|null,"venueVisit":string|null,"startTime":string|null,"travelHours":number|null,"normalPrice":number|null,"specialPrice":number|null}
กติกา:
- courseCode: จับคู่ธีมบรีฟกับหลักสูตรจริงนี้ให้ตรงที่สุด (ถ้าตรง) — ${courseList} — ไม่ตรงให้ null
- subject (ใช้เมื่อ courseCode เป็น null): คณิต→"math"; วิทย์/ทะเล/ธรรมชาติ/STEAM→"steam"; อังกฤษ→"english"; AI/โค้ด/หุ่นยนต์/โดรน→"ai"; จีน→"chinese"; ผู้นำ/EQ→"leadership"
- durationMode: "ครึ่งวัน"→"half"; "ไป-กลับ"/"วันเดย์"/1 วันไม่ค้างคืน→"day"; มีจำนวนคืน≥1→"overnight" (ตั้ง days/nights ให้สอดคล้อง); ถ้าบรีฟไม่บอกระยะเวลาเลย ใส่ durationMode/days/nights เป็น null
- รองรับเลขไทยและคำไทย (เช่น "สองวันหนึ่งคืน"=2วัน1คืน)
- ระบุวิชารายวัน ("วันแรก ภาษาอังกฤษ วันที่ 2 วิทยาศาสตร์ทะเล") = ค่าย mix — courseName ให้ใช้วิชาของวันแรก
- คำว่า "เสริม/พ่วง/+/add-on" ตามด้วยวิชา (อังกฤษ/จีน/คณิต) = กิจกรรมเสริม ไม่ใช่ธีมหลัก → courseName ให้ใช้ธีมหลักของค่าย
- ราคา: "ขายหัวละ/ราคาขาย/ลดเหลือ X"→specialPrice; "ปกติ X"→normalPrice (ตัวเลขล้วน ไม่มีคอมมา/บาท); ไม่พบให้ null
- students/teachers: ดึงเฉพาะตัวเลขจำนวนคน (นักเรียน/ผู้เข้าร่วม = students; ครู/ครูผู้ควบคุม/อาจารย์ = teachers); ไม่พบให้ null (ห้ามเดาเป็น 0)
- ตัวเลขไทย ๐-๙ แปลงเป็นตัวเลขอารบิกในช่องที่เป็นตัวเลข แต่ชื่อเฉพาะ (school/venue) ให้คงตัวอักษรตามบรีฟทุกตัว รวมวงเล็บและเลขไทย เช่น "โรงเรียนบดินทรเดชา (สิงห์ สิงหเสนี) ๔"
- school: เริ่มด้วยคำว่า "โรงเรียน" ตัดคำบอกเล่าท้ายออก (เช่น "ส่วนนี้คือชื่อโรงเรียน", "ต้องการติดต่อ")
- venue: ชื่อโรงแรม/สถานที่จัด ตามที่เขียน (หลัง "ณ", "จัดที่", "สถานที่", "พักที่") ไม่ต้องใส่คำว่า ณ/ที่
- province: จังหวัดของสถานที่จัดค่าย (ไม่ใช่ของโรงเรียน) — ถ้าบอกเมือง เช่น พัทยา/บางแสน → "ชลบุรี", หัวหิน → "ประจวบคีรีขันธ์", เขาใหญ่/โคราช → "นครราชสีมา"
- level: "ม.1-3" / "ป.4-6" (มัธยมต้น = ม.1-3, มัธยมปลาย = ม.4-6); ไม่บอกระดับชั้นให้ null (คำว่า "ห้องเรียนพิเศษ" ไม่ใช่ระดับชั้น)
- dates: คงรูปแบบตามบรีฟ ขึ้นต้น "วันที่" เช่น "วันที่ 14 – 16 ธ.ค. 2569"
- ข้อความในบรีฟอาจมีเครื่องหมายคำพูดครอบ ขึ้นบรรทัดกลางประโยค หรือเว้นวรรคผิด ให้อ่านตามความหมาย
- ระบบอ่านเบื้องต้นได้ดังนี้ (อาจผิด/ไม่ครบ ให้ตรวจกับบรีฟแล้วแก้): ${preJson}
ตอบเป็น JSON อย่างเดียว ไม่มีข้อความอื่น

บรีฟ (ทำความสะอาดแล้ว):
"""${clean}"""`;
      const r = await sample.json<any>(prompt, { modelTier: 'default', signal: ctl.signal });
      if (stale()) return;
      // ฐาน = ผลตัวอ่านปกติ → AI แก้/เติมเฉพาะช่องที่ให้ค่ามา (ช่องที่ AI ไม่พบ ใช้ผลตัวอ่านปกติ)
      const res = applyExtraction(pre.camp, r);
      // AI ห้ามสลับธีมหลักไปเป็นวิชาที่บรีฟระบุว่าเป็น "กิจกรรมเสริม"
      if (((pre.camp.addons || []).some(a => a.code === res.camp.courseCode) || (pre.camp.dayCourses || []).some(Boolean)) && pre.camp.courseCode) { res.camp.courseCode = pre.camp.courseCode; res.camp.subject = pre.camp.subject; res.camp.activityIds = pre.camp.activityIds; res.camp.docCode = pre.camp.docCode; }
      setCamp(res.camp);
      setBriefReport({ fields: briefFields(res.camp, Array.from(new Set([...pre.found, ...res.applied]))), by: 'AI + ระบบอ่านบรีฟ' });
      const miss = res.missing.length ? ` · ยังขาด: ${res.missing.join(', ')}` : '';
      const warn = res.warnings.length ? ' ' + res.warnings[0] : '';
      flash(`AI ดึงได้ ${res.applied.length} ช่อง (${res.applied.join(', ')})${miss}${warn} — ตรวจในแท็บ 2-5 ก่อนสร้างไฟล์`, res.warnings.length === 0);
    } catch (e: any) {
      if (stale()) return;
      const code = e?.code || '';
      if (code === 'cancelled') flash('ยกเลิก/หมดเวลาเรียก AI — ลองใหม่ หรือใช้ปุ่มแบบปกติ', false);
      else if (code === 'not_granted' || code === 'sampling_disabled') { applyBrief(mode); flash('ยังไม่ได้อนุญาตให้หน้านี้ใช้ AI — ใช้การแปลงแบบปกติแทน', false); }
      else if (code === 'rate_limited') flash('AI ถูกเรียกถี่เกินไป ลองใหม่อีกครั้งในอีกสักครู่', false);
      else if (code === 'invalid_json') { applyBrief(mode); flash('AI ตอบไม่เป็นรูปแบบที่อ่านได้ — ใช้การแปลงแบบปกติแทน', false); }
      else { applyBrief(mode); flash('เรียก AI ไม่สำเร็จ (' + (code || 'error') + ') — ใช้การแปลงแบบปกติแทน', false); }
    } finally {
      window.clearTimeout(timer);
      if (!stale()) setBusy(false);
    }
  };
  const loadPreset = (id: string) => { startNewJob(fromPreset(id)); setCamp(fromPreset(id)); flash(`โหลดแม่แบบ "${PRESETS.find(p => p.id === id)!.label}" แล้ว`); };

  const changeDuration = (mode: DurationMode, days = 1, nights = 0) => {
    const hadBudget = !!(camp.budgetItems && camp.budgetItems.length);
    // ระยะเวลาเปลี่ยน → ค่าที่พัก/มื้ออาหารในงบเปลี่ยน: คืนรายการงบเป็นอัตโนมัติ กันตัวเลขค้างผิด
    setCamp(c => normalizeDuration({ ...c, durationMode: mode, days, nights, budgetItems: undefined, templateId: undefined, rowEdits: undefined, actsOverride: undefined, dayExtends: undefined, rowAdds: undefined, dayOrders: undefined, picks: c.picks?.map(({ at, ...p }) => p) }));
    const label = mode === 'half' ? 'ครึ่งวัน' : mode === 'day' ? `${days} วัน (ไป-กลับ)` : `${days} วัน ${nights} คืน`;
    flash(`ปรับระยะเวลาเป็น ${label} — จัดกำหนดการใหม่แล้ว${hadBudget ? ' · รายการงบกลับเป็นอัตโนมัติ (แก้ได้อีกครั้งในขั้นราคา & งบ)' : ''}`);
  };
  const changeSubject = (s: Subject) => set({ subject: s, courseCode: undefined, activityIds: defaultActs(s).concat(camp.extraActivities.filter(a => a.subjects.includes(s)).map(a => a.id)), coreSlotIds: [] });
  const changeCourse = (code: string) => {
    if (!code) { set({ courseCode: undefined, activityIds: defaultActs(camp.subject), coreSlotIds: [] }); flash('กลับไปใช้คลังกิจกรรมตามวิชา (ไม่ผูกหลักสูตร)'); return; }
    const co = COURSES.find(c => c.code === code)!;
    set({ courseCode: code, subject: co.family as Subject, docCode: docCodeFor(code), activityIds: defaultCourseActs(code), coreSlotIds: [], templateId: undefined, budgetItems: undefined, rowEdits: undefined, actsOverride: undefined, dayExtends: undefined, rowAdds: undefined, dayOrders: undefined, picks: camp.picks?.map(({ at, ...p }) => p) });
    const nT = templatesOf(code).length;
    flash(nT ? `เลือก "${co.name}" (${code}) — ใช้แม่แบบโปรแกรมจริงของทีม + ภาพจากไฟล์ของค่ายนี้` : `เลือก "${co.name}" (${code}) — ยังไม่มีแม่แบบจริง ระบบจัดจากคลังกิจกรรม (รอตรวจ)`);
  };
  const toggleAct = (id: string) => set({ activityIds: camp.activityIds.includes(id) ? camp.activityIds.filter(x => x !== id) : [...camp.activityIds, id] });
  const selectedCore = camp.activityIds.filter(id => subjectPool(camp).some(a => a.id === id && a.kind === 'core')).length;
  const addCustom = (title: string, kind: Kind, desc: string) => {
    const id = 'cust-' + Date.now().toString(36);
    const a: Activity = { id, subjects: [camp.subject], kind, title: title.startsWith('กิจกรรม') ? title : `กิจกรรม “${title}”`, desc: desc || undefined };
    setCamp(c => ({ ...c, extraActivities: [...c.extraActivities, a], activityIds: [...c.activityIds, id] }));
    flash(`เพิ่มกิจกรรม "${a.title}" เข้าคลังวิชา${SUBJECTS[camp.subject].label}แล้ว`);
  };
  const removeCustom = (id: string) => setCamp(c => ({ ...c, extraActivities: c.extraActivities.filter(a => a.id !== id), activityIds: c.activityIds.filter(x => x !== id) }));

  const onImage = (group: 'actImgs' | 'venueImgs', idx: number, file?: File) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      const buf = new Uint8Array(r.result as ArrayBuffer);
      setCamp(c => { const arr = [...c[group]]; arr[idx] = { ...arr[idx], data: buf }; return { ...c, [group]: arr }; });
      flash('ฝังรูปลงไฟล์เรียบร้อย — รูปจะปรากฏในไฟล์ Word ที่ดาวน์โหลด');
    };
    r.readAsArrayBuffer(file);
  };
  const addImage = (group: 'actImgs' | 'venueImgs') => setCamp(c => ({ ...c, [group]: [...c[group], { caption: '' } as Img] }));
  const removeImage = (group: 'actImgs' | 'venueImgs', idx: number) => setCamp(c => ({ ...c, [group]: c[group].filter((_, i) => i !== idx) }));
  const captionImage = (group: 'actImgs' | 'venueImgs', idx: number, v: string) => setCamp(c => { const arr = [...c[group]]; arr[idx] = { ...arr[idx], caption: v }; return { ...c, [group]: arr }; });
  // ใช้ภาพจากไฟล์ของค่ายนี้อีกครั้ง (ล้างภาพที่อัปโหลดเอง แล้วดึงชุดของแม่แบบ)
  // เลือกที่พักจากทำเนียบ → เติมจังหวัด/ทัศนศึกษา/ผู้ติดต่อ (เฉพาะที่มีข้อมูล) · ภาพที่พักดึงให้เองตามชื่อ (ภาพที่ทีมอัปโหลดเองไม่ถูกทับ)
  const pickVenue = (e: VenueEntry) => {
    setCamp(c => ({ ...c, venue: e.name, province: e.province || c.province, venueVisit: e.visit || c.venueVisit, supplierNote: e.note || c.supplierNote }));
    setPhotoNonce(n => n + 1);
    flash(e.photos.length ? `เลือก ${e.name} แล้ว — ดึงภาพที่พัก ${e.photos.length} รูป (แยกหมวด) ให้แล้ว` : `เลือก ${e.name} แล้ว — ที่พักนี้ยังไม่มีภาพในระบบ อัปโหลดภาพทางการได้ที่ขั้น “ภาพ”`);
  };
  const reloadPhotos = () => { setCamp(c => ({ ...c, actImgs: [], venueImgs: [] })); setPhotoNonce(n => n + 1); flash('ดึงภาพจากไฟล์ของค่ายนี้ใหม่แล้ว'); };
  // เลือกกิจกรรมรายช่วง (per-slot): '' = อัตโนมัติ, อื่น ๆ = id กิจกรรมในคลัง
  const setSlot = (idx: number, id: string) => setCamp(c => {
    const arr = [...(c.coreSlotIds || [])];
    while (arr.length <= idx) arr.push('');
    arr[idx] = id;
    return { ...c, coreSlotIds: arr };
  });
  const clearSlots = () => { set({ coreSlotIds: [] }); flash('ล้างการเลือกกิจกรรมรายช่วง — กลับไปจัดอัตโนมัติ'); };
  const coreOptions = subjectPool(camp).filter(a => a.kind === 'core');

  const addVenue = (v: VenueRec) => { setCustomVenues(s => [...s, v]); set({ venue: v.name, province: v.province, venueVisit: v.visit, supplierNote: v.note }); flash(`เพิ่มสถานที่ "${v.name}" เข้าคลังแล้ว`); };

  const exportDB = () => {
    const blob = new Blob([JSON.stringify(snapshot(camp, customVenues, brief, true), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `EQCamp_งาน_${camp.docCode.replace(/[^\w-]+/g, '_')}_${(camp.school || '').replace(/\s+/g, '')}.json`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    flash('ส่งออกงาน (.json รวมภาพ) แล้ว — เปิดต่อเครื่องอื่นด้วยปุ่ม "นำเข้างาน"');
  };
  const importDB = (file?: File) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const snap = JSON.parse(String(r.result));
        if (!snap.camp) throw new Error('ไฟล์ไม่ใช่ฐานข้อมูล EQ Camp');
        const { camp: c, venues, brief: b } = rehydrate(snap);
        startNewJob(c); setCamp(c); setCustomVenues(venues); if (b) setBrief(b);
        flash('นำเข้างานเรียบร้อย — บันทึกไว้ใน "งานของฉัน" แล้ว');
      } catch (e) { flash('นำเข้าไม่สำเร็จ: ' + (e as Error).message, false); }
    };
    r.readAsText(file);
  };
  const resetDB = () => { if (!confirm('เริ่มงานใหม่จากแม่แบบ PL 0109? (งานปัจจุบันถูกบันทึกไว้ใน "งานของฉัน" แล้ว)')) return; try { localStorage.removeItem(LS_KEY); } catch {} startNewJob(fromPreset('pl0109')); setCamp(fromPreset('pl0109')); setCustomVenues([]); flash('ล้างและรีเซ็ตเป็นแม่แบบเริ่มต้นแล้ว'); };

  const toBlob = async (doc: ReturnType<typeof buildDoc>): Promise<Blob> => {
    const MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    try { return new Blob([await packDocx(doc)], { type: MIME }); } // ฝังฟอนต์ TH Sarabun New
    catch { return await Packer.toBlob(doc); }
  };
  const anchorDownload = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    let clicked = false;
    try {
      const a = document.createElement('a');
      a.href = url; a.download = name; a.rel = 'noopener';
      document.body.appendChild(a); a.click(); a.remove(); clicked = true;
    } catch { clicked = false; }
    // สำรอง: บางโฮสต์/iframe บล็อก <a download> → เปิดไฟล์ในแท็บใหม่ให้ผู้ใช้กดเซฟเอง
    if (!clicked) { try { window.open(url, '_blank'); } catch {} }
    setTimeout(() => URL.revokeObjectURL(url), 8000);
  };
  // ส่งไฟล์ให้ผู้ใช้นอก claude.ai: คอม = ดาวน์โหลดทันที · มือถือ = แผ่นบันทึก/แชร์ (แตะแล้วทำงานแน่นอนทั้ง iPhone/Android)
  const deliver = (files: { blob: Blob; name: string }[], title: string, okMsg: string) => {
    if (IS_MOBILE) { setSaveSheet({ files, title }); return; }
    files.forEach((f, i) => setTimeout(() => anchorDownload(f.blob, f.name), i * 400));
    flash(okMsg);
  };
  const download = async (dk: DocKind) => {
    setBusy(true);
    try {
      const sched = buildSchedule(camp);
      const blob = await toBlob(buildDoc(dk, camp, sched, compose(camp, sched)));
      const name = fileName(dk, camp);
      const label = DOC_TYPES.find(d => d.id === dk)!.label;
      // บน claude.ai artifact: การดาวน์โหลดตรงถูกบล็อก → ใช้ downloads capability
      const cl = (window as any).claude;
      if (cl && typeof cl.use === 'function') {
        const downloads = await cl.use('downloads').catch(() => null);
        if (downloads) {
          try { await downloads.save({ filename: name, data: blob }); logEvent('word', camp, dk); flash(`บันทึก "${label}" (.docx) เรียบร้อย`); }
          catch (e: any) {
            if (e && e.code === 'declined') flash('ยกเลิกการบันทึกไฟล์', false);
            else { anchorDownload(blob, name); logEvent('word', camp, dk); flash(`ดาวน์โหลด "${label}" (.docx) แล้ว`); }
          }
          setBusy(false); return;
        }
        // อยู่บน claude.ai แต่ยังไม่ได้สิทธิ์บันทึก → แจ้งให้ชัด (กันทีมงงว่าเซฟไม่ได้)
        anchorDownload(blob, name);
        flash(`หน้านี้บันทึกไฟล์ให้บัญชีคุณไม่ได้ — ใช้เวอร์ชันเว็บแทน: ${WEB_URL}`, false); setDlBlocked(true);
        logEvent('word', camp, dk); setBusy(false); return;
      }
      // เปิดจากไฟล์ standalone / เบราว์เซอร์ปกติ
      deliver([{ blob, name }], `${label} (Word)`, `ดาวน์โหลด "${label}" (.docx) สำเร็จ`); logEvent('word', camp, dk);
    } catch (e) { flash('เกิดข้อผิดพลาดในการสร้างไฟล์: ' + (e as Error).message, false); }
    setBusy(false);
  };
  // สร้างครบชุด 4 ไฟล์ในคลิกเดียว (ใช้ข้อมูลชุดเดียวกัน จึงตรงกันทั้งกระบวนการขาย)
  const downloadAll = async () => {
    setBusy(true);
    const sched = buildSchedule(camp); const k2 = compose(camp, sched);
    const cl = (window as any).claude;
    const downloads = cl && typeof cl.use === 'function' ? await cl.use('downloads').catch(() => null) : null;
    let done = 0; const ready: { blob: Blob; name: string }[] = [];
    try {
      for (const dk of ['program', 'quotation', 'booking', 'runsheet'] as DocKind[]) {
        const blob = await toBlob(buildDoc(dk, camp, sched, k2));
        const name = fileName(dk, camp);
        if (downloads) {
          try { await downloads.save({ filename: name, data: blob }); done++; logEvent('word', camp, dk); }
          catch (e: any) { if (e?.code === 'declined') continue; anchorDownload(blob, name); done++; logEvent('word', camp, dk); }
        } else { ready.push({ blob, name }); done++; logEvent('word', camp, dk); }
      }
      const msg = `สร้างครบชุด ${done}/4 ไฟล์แล้ว (โปรแกรม · ใบเสนอราคา · ขอราคาโรงแรม · Run-down ภายใน)`;
      if (ready.length) deliver(ready, 'ครบชุด 4 ไฟล์ (Word)', msg); else flash(msg);
    } catch (e) { flash('สร้างชุดไฟล์ผิดพลาด: ' + (e as Error).message, false); }
    setBusy(false);
  };
  // บันทึก PDF (เอกสารโปรแกรมค่าย) — สร้างไฟล์ PDF จริงในเบราว์เซอร์ (html2canvas + jsPDF)
  // แล้วเซฟผ่าน downloads capability เดียวกับ Word → ทำงานได้ในกล่อง sandbox ของ claude.ai
  // ฟอนต์/ขนาดตรงกับ Word: TH Sarabun New ฝังในหน้า (ไม่พึ่งฟอนต์เครื่อง) · เนื้อหาตัวปกติ · ตัวหนาเฉพาะหัวข้อหลัก
  // กล่องเนื้อหาแต่ละชิ้นเรนเดอร์กว้าง 760px → วางทีละ "บล็อก" ไม่ตัดกลางบรรทัด; หัวกระดาษวาดทุกหน้า
  const PDF_STYLE = `<style>${FONT_FACE_CSS}
.eqpdf{width:760px;box-sizing:border-box;padding:0 0 4px;display:flow-root;background:#fff;color:#1D1D1F;font-family:'EQSarabun',sans-serif;font-size:24.6px;line-height:1.18;font-weight:400}
.eqpdf b{font-weight:700}
.eqpdf .code{text-align:right;font-weight:700;color:#0C2A41}
.eqpdf h1{text-align:center;color:#0C2A41;font-size:30.8px;font-weight:700;margin:2px 0 0;line-height:1.22}.eqpdf .en{text-align:center;color:#155D90;font-weight:700;font-size:27.7px;margin:0}
.eqpdf h2{color:#0C2A41;font-size:26.2px;font-weight:700;margin:8px 0 2px}
.eqpdf .li{display:flex;margin:0}.eqpdf .li .n{flex:0 0 40px;padding-left:6px}.eqpdf .li .x{flex:1}
.eqpdf table.info{width:100%;border-collapse:collapse;margin:4px 0}.eqpdf table.info td{vertical-align:top;padding:0 4px}.eqpdf table.info td.k{color:#0C2A41;font-weight:700;width:200px}
.eqpdf .sh{text-align:center;font-weight:700;font-size:27.7px;line-height:1.3;color:#0F3D63}
.eqpdf .sech{text-align:center;color:#0C2A41;font-size:30.1px;font-weight:700;margin:0 0 12px}
.eqpdf .day{font-weight:700;color:#0C2A41;font-size:27.7px;margin:0 0 4px}
.eqpdf table.sched{width:100%;border-collapse:collapse}.eqpdf table.sched td{padding:2px 8px;vertical-align:top;line-height:1.22}.eqpdf table.sched td.t{width:215px;white-space:nowrap;color:#3a3a3c}
.eqpdf .sub{color:#48484a;font-size:24.65px}
.eqpdf .note{color:#48484a;margin:4px 0}
.eqpdf .price{text-align:center;border:1.5px solid #0C2A41;background:#fff;padding:11px;border-radius:6px;margin:4px 0 14px}
.eqpdf .price .lbl{color:#3a3a3c;font-size:24.6px}.eqpdf .price .old{color:#8e8e93;font-size:24.6px;position:relative;display:inline-block}.eqpdf .price .old::after{content:'';position:absolute;left:-2px;right:-2px;top:50%;border-top:1.5px solid #8e8e93}.eqpdf .price .new{color:#C4641B;font-weight:700;font-size:34.2px}
.eqpdf table.bud{width:100%;border-collapse:collapse;margin:4px 0}
.eqpdf table.bud th{background:#0C2A41;color:#fff;font-weight:700;padding:6px 10px;text-align:left;font-size:23.3px}
.eqpdf table.bud td{padding:5px 10px;vertical-align:top;border-bottom:1px solid #ECECEF}.eqpdf table.bud td.no{width:44px;text-align:center;color:#8e8e93}
.eqpdf .phead{text-align:center;font-weight:700;color:#0C2A41;font-size:30.1px;margin:0 0 12px}
.eqpdf .pgrid{display:flex;flex-wrap:wrap;gap:12px;justify-content:center}
.eqpdf .pcell{width:47%}
.eqpdf .pcell .pf{position:relative;border-radius:5px;overflow:hidden}
.eqpdf .pcell img{width:100%;aspect-ratio:var(--a,4/3);object-fit:cover;display:block}
.eqpdf .pcell .num{position:absolute;top:6px;left:6px;background:rgba(12,42,65,.82);color:#fff;font-size:17.8px;font-weight:700;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center}
.eqpdf .pcell .cap{text-align:center;font-size:19.2px;color:#6E6E73;margin-top:4px;line-height:1.2}
.eqpdf .pline{margin:0 0 4px}.eqpdf .pline .red{color:#FF0000}
.eqpdf .dl{display:flex;margin:0 0 3px}.eqpdf .dl .d{flex:0 0 52px;padding-left:6px}.eqpdf .dl .x{flex:1}

.eqpdf h1,.eqpdf .en,.eqpdf h2,.eqpdf .sh,.eqpdf .day{color:#1D1D1F}
.eqpdf h1{font-size:27.7px}.eqpdf .en{font-size:27.7px}
.eqpdf h2{font-size:24.65px;margin:6px 0 0}
.eqpdf .fl{text-indent:55px}.eqpdf .blk{padding-left:55px}
.eqpdf .kv{display:flex}.eqpdf .kv b{flex:0 0 166px}.eqpdf .kv span{flex:1}
.eqpdf .day{font-weight:400;font-size:24.65px;text-decoration:underline;margin:10px 0 2px}
.eqpdf table.sched td{padding:0}.eqpdf table.sched td.t{width:166px;color:#1D1D1F}
.eqpdf .note{color:#FF0000}
</style>`;
  const printPDF = async () => {
    const jsNS = (window as any).jspdf; const h2c = (window as any).html2canvas;
    if (!jsNS || !h2c) { flash('ตัวสร้าง PDF ยังโหลดไม่เสร็จ (ต้องออนไลน์) — รอสักครู่แล้วลองใหม่ หรือดาวน์โหลด Word แล้ว Save as PDF', false); return; }
    setBusy(true);
    // ความคืบหน้า: ให้ React วาดแถบก่อนงานหนักแต่ละบล็อก (มือถือไม่ค้างเงียบ)
    const step = async (label: string, pct: number) => { setProgress({ label, pct }); await new Promise(r => setTimeout(r, 30)); };
    try {
      await step('เตรียมเอกสาร', 3);
      const plan = buildSchedule(camp); const kk = compose(camp, plan);
      const esc = (s: any) => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' } as any)[c]);
      const ol = (arr: string[]) => arr.map((x, i) => `<div class="li"><span class="n">${i + 1}.</span><span class="x">${esc(x)}</span></div>`).join('');
      const ul = (arr: string[]) => arr.map(x => `<div class="li"><span class="n">-</span><span class="x">${esc(x)}</span></div>`).join('');
      const has = (s?: string) => !!(s && s.trim() && !s.includes('...'));
      const lh = letterheadFor(camp);
      // ความคมชัด: ตัวอักษรเรนเดอร์ 3 เท่า ≈ 330 dpi (มือถือ 2.2 เท่า กันหน่วยความจำเต็ม) + เก็บเป็น PNG (ขอบตัวอักษรไม่เบลอแบบ JPEG)
      const SCALE = IS_MOBILE ? 2.2 : 3;
      const MAX_PX = 15_000_000; // iOS Safari จำกัดพื้นที่ canvas ~16.7 ล้านพิกเซล
      // เรนเดอร์ในกรอบแยก (iframe เปล่า) ที่มีแค่ฟอนต์เอกสาร + บล็อกที่กำลังวาด — html2canvas คัดลอกทั้งเอกสารที่ element อยู่ทุกครั้ง
      // ถ้าวาดในหน้าแอปจริง จะคัดลอกทั้งเว็บ (ฟอนต์ฝัง + ภาพพรีวิว 1600 px หลายรูป) ~10 รอบ/ไฟล์ → iPhone/Android หน่วยความจำเต็ม แท็บรีโหลด/ค้าง
      const stage = document.createElement('iframe');
      stage.setAttribute('aria-hidden', 'true'); stage.tabIndex = -1;
      stage.style.cssText = 'position:fixed;left:-12000px;top:0;width:1200px;height:1600px;border:0;opacity:0;pointer-events:none;';
      document.body.appendChild(stage);
      const sd = stage.contentDocument!;
      sd.open(); sd.write(`<!doctype html><html><head><meta charset="utf-8">${PDF_STYLE}</head><body style="margin:0;background:#fff"></body></html>`); sd.close();
      try { const fs = (sd as any).fonts; await Promise.all([fs?.load?.('20px EQSarabun'), fs?.load?.('bold 20px EQSarabun')]); await fs?.ready; } catch { /* ใช้ฟอนต์สำรอง */ }
      const renderCanvas = async (inner: string) => {
        const w = sd.createElement('div'); w.className = 'eqpdf';
        w.innerHTML = inner; sd.body.appendChild(w);
        await new Promise(r => setTimeout(r, 60));
        // วัดความสูงจริงรวมส่วนที่ล้น (scrollHeight) + กว้างคงที่ ไม่ขึ้นกับขนาดจอ (มือถือ/คอม ได้ผลเท่ากัน)
        const hh = Math.ceil(w.scrollHeight);
        const sc = Math.min(SCALE, Math.sqrt(MAX_PX / (760 * Math.max(hh, 1))));
        try {
          return await h2c(w, { scale: sc, backgroundColor: '#ffffff', useCORS: true, logging: false, width: 760, height: hh, windowWidth: 1200, windowHeight: Math.max(1200, hh + 50), scrollX: 0, scrollY: 0,
            onclone: async (doc: Document) => {
              try { const f = (doc as any).fonts; await Promise.all([f.load('20px EQSarabun'), f.load('bold 20px EQSarabun')]); await f.ready; } catch { /* ignore */ }
            } });
        } finally { sd.body.removeChild(w); }
      };
      const pdf = new jsNS.jsPDF('p', 'mm', 'a4');
      const pageW = 210, pageH = 297, M = 18; // ขอบซ้าย-ขวา 1.8 ซม. (แนวราชการ)
      const contentW = pageW - 2 * M;
      // หัวกระดาษ: วาดด้วย addImage ตรง ๆ (เชื่อถือได้ ไม่พึ่ง html2canvas) → ทุกหน้ามีหัวกระดาษ + รหัสเอกสาร + เว้นระยะเท่ากัน
      const lhData = 'data:image/png;base64,' + lh.b64;
      const lhH = contentW * (lh.h / lh.w);
      const topGap = 10, bottomM = 14;
      const codeStr = String(camp.docCode || '');
      // ตัวอักษรที่ jsPDF วาดเอง (รหัสเอกสาร/เลขหน้า) ใช้ TH Sarabun New เดียวกับเนื้อหา — ไม่ใช่ Helvetica
      let docFont = 'helvetica';
      try { pdf.addFileToVFS('THSarabunNew.ttf', FONT_REG_B64); pdf.addFont('THSarabunNew.ttf', 'THSarabunNew', 'normal'); docFont = 'THSarabunNew'; } catch { /* ใช้ฟอนต์สำรอง */ }
      const drawHead = () => {
        pdf.addImage(lhData, 'PNG', M, topGap, contentW, lhH, 'eqlh', 'FAST');
        pdf.setFont(docFont, 'normal'); pdf.setFontSize(docFont === 'helvetica' ? 8 : 12); pdf.setTextColor(120);
        // รหัสเอกสาร (เช่น PL FOR 0110/2569) แสดงเฉพาะหน้าแรกเท่านั้น
        if (pdf.getNumberOfPages() === 1) pdf.text(codeStr, pageW - M, topGap + lhH + 4.5, { align: 'right' });
      };
      const contentTop = topGap + lhH + 9;
      let y = contentTop; drawHead();
      const newPage = () => { pdf.addPage(); drawHead(); y = contentTop; };
      // วางบล็อกทั้งก้อน ไม่ตัดกลางบรรทัด: ถ้าสั่งขึ้นหน้าใหม่ หรือพื้นที่ไม่พอ → ขึ้นหน้าใหม่ก่อน
      const place = async (inner: string, opts: { newpage?: boolean; gap?: number; photo?: boolean } = {}) => {
        const canvas = await renderCanvas(inner);
        const h = contentW * (canvas.height / canvas.width);
        const atTop = y <= contentTop + 0.5;
        if ((opts.newpage || y + h > pageH - bottomM) && !atTop) newPage();
        // ข้อความ = PNG (คม) · ภาพถ่าย = JPEG (ไฟล์เล็ก)
        if (opts.photo) pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', M, y, contentW, h, undefined, 'FAST');
        else pdf.addImage(canvas, 'PNG', M, y, contentW, h, undefined, 'FAST');
        canvas.width = 0; canvas.height = 0; // คืนหน่วยความจำทันที (สำคัญบน iPhone)
        y += h + (opts.gap ?? 3);
      };

      // ---- หน้าปก ----
      await step('หน้าปก', 10);
      await place(`<h1>${esc(kk.titleTh)}</h1>${kk.titleEn ? `<div class="en">${esc(kk.titleEn)}</div>` : ''}`, { gap: 5 });
      // แพตเทิร์นเอกสารจริง: วัตถุประสงค์ย่อหน้าแรกเยื้อง · ข้อมูลจำนวน/วิทยากร/ระยะเวลาแบบแท็บ · รายการบูรณาการเยื้องทั้งบล็อก "1.ข้อความ"
      const fl = (a: string[]) => a.map((x, i) => `<div class="fl">${i + 1}.${esc(x)}</div>`).join('');
      const blk = (a: string[]) => a.map((x, i) => `<div class="blk">${i + 1}.${esc(x)}</div>`).join('');
      // หน้าปกตามลำดับหัวข้อของแม่แบบ (โครงเดียวกับ Word) — ข้อมูลจำนวน/วิทยากร/ระยะเวลาอยู่บล็อกเดียวกับหัวข้อก่อนหน้า
      const bul = (x: string) => { const m = x.match(/^([-–•●])\s*(.*)$/); if (!m) return `<div class="blk">${esc(x)}</div>`; const l2 = m[1] === '•' || m[1] === '●'; return `<div class="dl" style="padding-left:${l2 ? 96 : 55}px"><span class="d">${l2 ? '•' : '-'}</span><span class="x">${esc(m[2])}</span></div>`; };
      const secHtml = (sec: CoverSec) => sec.k === 'info'
        ? (sec.rows || []).map(([lab, v]) => `<div class="kv"><b>${esc(lab)}</b><span>${v.map(esc).join('<br>')}</span></div>`).join('')
        : (sec.h ? `<h2>${esc(sec.h)}</h2>` : '') + (sec.k === 'list' ? (sec.first ? fl : blk)(sec.items || []) : sec.k === 'para' ? (sec.items || []).map(x => `<div class="fl">${esc(x)}</div>`).join('') : (sec.items || []).map(bul).join(''));
      let coverBuf = '';
      for (const sec of kk.cover as CoverSec[]) { if (sec.k === 'info') { coverBuf += secHtml(sec); continue; } if (coverBuf) await place(coverBuf); coverBuf = secHtml(sec); }
      if (coverBuf) await place(coverBuf);

      await step('กำหนดการ', 35);
      // ---- หน้ากำหนดการ: ขึ้นหน้าใหม่ · แต่ละวันเป็นบล็อก (ไม่ตัดข้ามหน้า) · ปิดด้วยหมายเหตุ ----
      await place(`<div class="sh">กำหนดการ<br>${esc(kk.nameTh)}${kk.titleEn ? '<br>' + esc(kk.titleEn) : ''}` +
        (has(camp.school) ? '<br>' + esc(camp.school) : '') + (has(camp.dates) ? '<br>' + esc(camp.dates) : '') + (has(camp.venue) ? '<br>ณ ' + esc(camp.venue) : '') + '</div>', { newpage: true, gap: 6 });
      // หมายเหตุติดท้าย "วันสุดท้าย" ในบล็อกเดียวกัน → ไม่มีวันหลุดไปอยู่หน้าโดด ๆ
      for (const [i, d] of plan.days.entries()) {
        const last = i === plan.days.length - 1;
        await step(`กำหนดการ วันที่ ${d.day}`, 35 + Math.round(25 * (i + 1) / plan.days.length));
        await place(`<div class="day">วันที่ ${d.day}</div><table class="sched">` +
          d.items.map(r => `<tr><td class="t">${esc(r.time)}</td><td>${esc(r.title)}${(r.sub || []).map(s => `<div class="sub">${esc(s)}</div>`).join('')}</td></tr>`).join('') + '</table>' +
          (last ? '<div class="note" style="margin-top:10px">หมายเหตุ : กำหนดการอาจจะเปลี่ยนแปลงตามความเหมาะสม</div>' : ''), { gap: 6 });
      }

      // ---- ราคา + รายละเอียดงบประมาณ: แบบเรียบตามเอกสารทีม (ไม่มีตาราง/กรอบ) ขึ้นหน้าใหม่เสมอ ----
      await step('ราคาและงบประมาณ', 65);
      await place(
        `<div class="pline">ราคาปกติ ${money(withAddonPrice(camp).normalPrice)} <span class="red">ลดเหลือเพียง ${money(withAddonPrice(camp).specialPrice)} บ./ท่าน</span></div>` + (addonPriceNote(camp) ? `<div class="pline">${esc(addonPriceNote(camp))}</div>` : '') +
        `<div class="pline">รายละเอียดงบประมาณมีดังนี้</div>` +
        kk.budget.map(x => `<div class="dl"><span class="d">-</span><span class="x">${esc(x)}</span></div>`).join(''),
        { newpage: true });

      // ภาพ: วาดไฟล์ภาพจริงลง PDF โดยตรง (ไม่ผ่าน html2canvas) → คมเท่าต้นฉบับ · ครอป 4:3 เท่ากันทุกใบ · กริด 2 คอลัมน์ จัดกึ่งกลาง
      const toBitmap = (u8: Uint8Array): Promise<HTMLImageElement> => new Promise((ok, bad) => {
        const url = URL.createObjectURL(new Blob([u8], { type: u8[0] === 0x89 ? 'image/png' : 'image/jpeg' }));
        const im = new Image(); im.onload = () => { URL.revokeObjectURL(url); ok(im); }; im.onerror = () => { URL.revokeObjectURL(url); bad(new Error('image')); }; im.src = url;
      });
      const crop43 = async (u8: Uint8Array): Promise<string | null> => {
        try {
          const im = await toBitmap(u8); const w = im.naturalWidth, h = im.naturalHeight; if (!w || !h) return null;
          let cw = w, ch = Math.round(w * 3 / 4); if (ch > h) { ch = h; cw = Math.round(h * 4 / 3); }
          const sx = Math.round((w - cw) / 2), sy = Math.round((h - ch) * 0.35);
          const outW = Math.min(cw, IS_MOBILE ? 1000 : 1200), outH = Math.round(outW * 3 / 4);
          const cv = document.createElement('canvas'); cv.width = outW; cv.height = outH;
          const ctx = cv.getContext('2d')!; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(im, sx, sy, cw, ch, 0, 0, outW, outH);
          const d = cv.toDataURL('image/jpeg', 0.88); cv.width = 0; cv.height = 0; return d;
        } catch { return null; }
      };
      const photoPage = async (title: string, imgs: Img[]) => {
        const list = imgs.filter(a => a.data).slice(0, 8); if (!list.length) return 0;
        await place(`<div class="phead">${esc(title)}</div>`, { newpage: true, gap: 2 });
        const gap = 4, avail = pageH - bottomM - y, rows = Math.ceil(list.length / 2);
        const capH = list.some(a => realCaption(a.caption)) ? 6 : 0;
        const ch = Math.min((contentW - gap) / 2 * 3 / 4, (avail - (rows - 1) * gap) / rows - capH), cw = ch * 4 / 3;
        const x0 = M + (contentW - (2 * cw + gap)) / 2;
        for (const [i, a] of list.entries()) {
          const d = await crop43(a.data!); if (!d) continue;
          const col = list.length === 1 ? 0.5 : i % 2, row = Math.floor(i / 2);
          const lone = i === list.length - 1 && list.length % 2 === 1;   // รูปสุดท้ายเศษ → จัดกึ่งกลาง
          const x = lone ? M + (contentW - cw) / 2 : x0 + col * (cw + gap), yy = y + row * (ch + capH + gap);
          pdf.addImage(d, 'JPEG', x, yy, cw, ch, undefined, 'MEDIUM');
          if (capH && realCaption(a.caption)) { pdf.setFont(docFont, 'normal'); pdf.setFontSize(13); pdf.setTextColor(70); pdf.text(a.caption.trim(), x + cw / 2, yy + ch + 4.2, { align: 'center' }); }
        }
        y += rows * (ch + capH + gap);
        return list.length;
      };
      let photoCount = 0;
      if (camp.actImgs.some(a => a.data)) { await step('ภาพกิจกรรม', 75); photoCount += await photoPage('ตัวอย่างภาพกิจกรรม', camp.actImgs); }
      if (camp.venueImgs.some(a => a.data)) { await step('ภาพที่พัก', 85); photoCount += await photoPage(`ตัวอย่างภาพบรรยากาศที่พัก ${camp.venue || ''}`.trim(), camp.venueImgs); }
      if (isSteamProgram(camp) && !plan.tpl) await place(`<div class="phead">ตัวอย่างภาพกิจกรรมค่าย STEAM</div><div style="text-align:center"><img style="width:92%;border:1px solid #cbd0d6;border-radius:4px" src="data:image/jpeg;base64,${STEAM_GALLERY.b64}"></div>`, { newpage: true, photo: true });

      await step('รวมไฟล์ PDF', 95);
      // เลขหน้า "X / Y" ทุกหน้า (ล่างกลาง)
      const totPages = pdf.internal.getNumberOfPages();
      for (let i = 1; i <= totPages; i++) { pdf.setPage(i); pdf.setFont(docFont, 'normal'); pdf.setFontSize(docFont === 'helvetica' ? 9 : 13); pdf.setTextColor(140); pdf.text(`${i} / ${totPages}`, pageW / 2, pageH - 7, { align: 'center' }); }
      const blob: Blob = pdf.output('blob');
      const name = fileName('program', camp).replace(/\.docx$/, '.pdf');
      const cl = (window as any).claude;
      const downloads = cl && typeof cl.use === 'function' ? await cl.use('downloads').catch(() => null) : null;
      const photoWarn = photoCount < 6 ? ` ภาพประกอบมี ${photoCount} รูป (แนะนำ 6–8) — เพิ่มภาพในแท็บ 6 ก่อนส่งลูกค้า` : '';
      if (downloads) {
        try { await downloads.save({ filename: name, data: blob }); logEvent('pdf', camp, 'program'); flash('บันทึก PDF เรียบร้อย' + photoWarn, !photoWarn); }
        catch (e: any) { if (e?.code === 'declined') flash('ยกเลิกการบันทึก PDF', false); else { anchorDownload(blob, name); logEvent('pdf', camp, 'program'); flash('ดาวน์โหลด PDF แล้ว' + photoWarn, !photoWarn); } }
      } else if (IN_CLAUDE) { anchorDownload(blob, name); logEvent('pdf', camp, 'program'); setDlBlocked(true); flash(`ถ้า PDF ไม่ดาวน์โหลด ให้ใช้เวอร์ชันเว็บ: ${WEB_URL}`, false); }
      else { logEvent('pdf', camp, 'program'); setProgress(null); deliver([{ blob, name }], `โปรแกรมค่าย (PDF ${pdf.internal.getNumberOfPages()} หน้า)`, 'ดาวน์โหลด PDF แล้ว' + photoWarn); if (photoWarn && IS_MOBILE) flash(photoWarn.trim(), false); }
    } catch (e) {
      const m = (e as Error)?.message || String(e);
      // หน่วยความจำไม่พอ (มือถือรุ่นเก่า) → บอกทางออกที่ทำได้จริง
      flash(/memory|allocation|canvas|quota/i.test(m) ? 'เครื่องนี้หน่วยความจำไม่พอสร้าง PDF — ปิดแท็บอื่นแล้วลองใหม่ หรือดาวน์โหลด Word แล้วเปิดในแอป Word/Google Docs เพื่อบันทึกเป็น PDF' : 'สร้าง PDF ไม่สำเร็จ: ' + m, false);
    }
    try { document.querySelectorAll('iframe[aria-hidden="true"][style*="-12000px"]').forEach(f => f.remove()); } catch { /* */ }
    setProgress(null); setBusy(false);
  };

  const TABS = [
    { id: 'brief', label: '1. บรีฟ / แม่แบบ', icon: Sparkles },
    { id: 'db', label: 'ฐานข้อมูลค่าย', icon: BookOpen },
    { id: 'header', label: '2. หัวเอกสาร', icon: FileText },
    { id: 'activities', label: '3. กิจกรรม', icon: Layers },
    { id: 'schedule', label: `4. กำหนดการ (${camp.days} วัน)`, icon: Calendar },
    { id: 'price', label: '5. ราคา & งบ', icon: Calculator },
    { id: 'images', label: `6. ภาพ (${camp.actImgs.length}+${camp.venueImgs.length})`, icon: ImageIcon },
    { id: 'stats', label: 'ทะเบียนโปรแกรม', icon: BarChart3 }
  ] as const;
  const STEPS = [
    { id: 'brief', label: 'บรีฟ' },
    { id: 'header', label: 'หลักสูตร & ข้อมูลค่าย' },
    { id: 'activities', label: 'กิจกรรม' },
    { id: 'schedule', label: `กำหนดการ ${camp.days} วัน` },
    { id: 'price', label: 'ราคา & งบ' },
    { id: 'images', label: `ภาพ (${camp.actImgs.length + camp.venueImgs.length})` }
  ] as const;
  const AUX = TABS.filter(t => t.id === 'db' || t.id === 'stats');
  const NAV = [{ id: 'home', label: 'หน้าแรก' }, { id: 'catalog', label: 'หลักสูตร' }, { id: 'build', label: 'สร้างเอกสาร' }, { id: 'hub', label: 'คลังข้อมูล' }, { id: 'nsr', label: 'คำนวณ NSR' }, { id: 'past', label: 'งานเก่า' }, { id: 'board', label: 'ภาพรวมทีม' }] as const;
  const navOn = (id: string) => id === view;
  const goNav = (id: string) => {
    if (id === 'catalog') { setView('home'); window.setTimeout(() => { try { document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' }); } catch { /* ignore */ } }, 60); return; }
    if (id === 'hub') setHubInit(h => ({ key: h.key + 1 }));
    setView(id as View);
  };
  const stepIdx = STEPS.findIndex(s => s.id === tab);

  return (
    <div className={`min-h-screen bg-paper text-brand-ink ${view === 'home' ? '' : 'pb-20'}`}>
      {/* เมนูบน (แนวเว็บคอร์สเรียน): โลโก้ · เมนูหลัก · ปุ่มหลัก — มือถือมีเมนูแถวที่สอง */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-brand-mist">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          <button onClick={() => setView('home')} className="tap flex items-center gap-2.5 shrink-0 rounded-lg" aria-label="EQ Camp หน้าแรก">
            <img src={`data:image/png;base64,${BRAND.logoB64}`} alt="" className="h-9 w-auto" />
            <span className="leading-tight text-left"><span className="block text-[16px] font-semibold">EQ Camp</span><span className="hidden sm:block text-[12.5px] text-sub">เอกสารขายค่ายวิชาการ</span></span>
          </button>
          <nav aria-label="เมนูหลัก" className="hidden 2xl:flex items-center gap-0.5 xl:gap-1 ml-2 xl:ml-6">
            {NAV.map(n => (
              <button key={n.id} onClick={() => goNav(n.id)} aria-current={navOn(n.id) ? 'page' : undefined}
                className={`tap whitespace-nowrap px-2.5 xl:px-3 py-2 rounded-lg text-[15px] ${navOn(n.id) ? 'text-brand-navy font-semibold bg-paper' : 'text-sub hover:text-brand-ink hover:bg-paper font-medium'}`}>{n.label}</button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2 min-w-0">
            <button onClick={() => setSearchOpen(true)} aria-label="ค้นหาทั้งระบบ (กด / หรือ Ctrl+K)" className="tap flex items-center gap-2 px-2.5 lg:px-3 py-2 rounded-xl border border-brand-mist bg-white hover:bg-paper text-[13.5px] text-sub">
              <Search className="w-4 h-4" /><span className="hidden xl:inline">ค้นหา</span><kbd className="hidden xl:inline text-[11px] border border-brand-mist rounded px-1.5">/</kbd>
            </button>
            <HubPill onClick={() => setConnectOpen(true)} />
            {view === 'build' ? (<>
              <button onClick={() => download(kind)} disabled={busy}
                className="tap px-3 sm:px-4 py-2.5 rounded-xl bg-accent enabled:hover:bg-accent-deep disabled:opacity-40 text-white text-[14px] font-semibold flex items-center gap-1.5">
                <Download className="w-4 h-4" />{busy ? 'กำลังสร้าง…' : <>ดาวน์โหลด<span className="hidden min-[1800px]:inline"> {DOC_TYPES.find(d => d.id === kind)!.label}</span></>}
              </button>
              <button onClick={downloadAll} disabled={busy} title="สร้างทั้ง 4 ไฟล์ด้วยข้อมูลชุดเดียวกัน"
                className="tap hidden sm:flex px-3 py-2.5 rounded-xl border border-brand-mist enabled:hover:bg-paper disabled:opacity-40 text-[14px] font-medium items-center gap-1.5">
                <Layers className="w-4 h-4" />ครบชุด<span className="hidden min-[1800px]:inline"> 4 ไฟล์</span>
              </button>
              <button onClick={printPDF} disabled={busy} title="บันทึกเอกสารโปรแกรมค่ายเป็น PDF"
                className="tap px-2.5 sm:px-3 py-2.5 rounded-xl border border-brand-mist enabled:hover:bg-paper disabled:opacity-40 text-[14px] font-medium flex items-center gap-1.5" aria-label="บันทึกเป็น PDF">
                <FileText className="w-4 h-4" /><span className="hidden min-[400px]:inline">PDF</span>
              </button>
            </>) : (
              <button onClick={() => setView('build')} className="tap px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-deep text-white text-[14px] font-semibold">สร้างเอกสาร</button>
            )}
          </div>
        </div>
        <nav aria-label="เมนูหลัก (มือถือ)" className="2xl:hidden border-t border-brand-mist">
          <div className="flex px-2 overflow-x-auto noscrollbar">
            {NAV.map(n => (
              <button key={n.id} onClick={() => goNav(n.id)} aria-current={navOn(n.id) ? 'page' : undefined}
                className={`tap shrink-0 px-3 py-2.5 text-[14.5px] border-b-2 -mb-px ${navOn(n.id) ? 'border-brand-navy text-brand-ink font-semibold' : 'border-transparent text-sub font-medium'}`}>{n.label}</button>
            ))}
          </div>
        </nav>
      </header>

      {/* ข้อความแจ้งผล: ลอยล่างจอ → เห็นทุกตำแหน่งที่เลื่อนอยู่ (มือถือกดปุ่มท้ายหน้าแล้วต้องเห็นผล) */}
      {banner && (
        <div role="status" aria-live="polite" className="fixed z-50 bottom-3 left-1/2 -translate-x-1/2 w-[min(640px,calc(100%-24px))] pb-[env(safe-area-inset-bottom)]">
          <div className={`pl-4 pr-2 py-2.5 rounded-xl text-[14px] flex items-center justify-between gap-3 border bg-white shadow-lift ${banner.ok ? 'border-brand-mist text-brand-ink' : 'border-amber-300 text-brand-ink'}`}>
            <span className="flex items-start gap-2 min-w-0 break-words">{banner.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />}<span className="min-w-0">{banner.t}</span></span>
            <button onClick={() => setBanner(null)} aria-label="ปิดข้อความ" className="tap text-sub hover:text-brand-ink p-1.5 rounded-md shrink-0"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {/* กำลังสร้าง PDF */}
      {progress && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="กำลังสร้าง PDF">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-lift">
            <div className="text-[16px] font-semibold">กำลังสร้าง PDF</div>
            <div className="text-[14px] text-sub mt-1" aria-live="polite">{progress.label}…</div>
            <div className="h-2 rounded-full bg-paper mt-3 overflow-hidden"><div className="h-full bg-brand-navy transition-all" style={{ width: `${progress.pct}%` }} /></div>
            <div className="text-[12.5px] text-sub mt-2">มือถืออาจใช้เวลา 10–30 วินาที อย่าปิดหน้านี้</div>
          </div>
        </div>
      )}

      {saveSheet && <SaveSheet sheet={saveSheet} onClose={() => setSaveSheet(null)} download={anchorDownload} />}
      {jobsOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-6" role="dialog" aria-modal="true" aria-label="งานทั้งหมด" onClick={e => { if (e.target === e.currentTarget) setJobsOpen(false); }}>
          <div className="bg-paper w-full sm:max-w-3xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2.5 px-1">
              <div><div className="text-[17px] font-semibold">งานทั้งหมด</div><div className="text-[12.5px] text-sub">ทุกงานที่เคยทำ — เปิดงานไหน แก้แล้วบันทึกลงงานนั้นเท่านั้น · ทำสำเนา = งานใหม่แยกต่างหาก</div></div>
              <button onClick={() => setJobsOpen(false)} className="tap px-3 py-1.5 rounded-lg border border-brand-mist bg-white text-[13.5px]">ปิด</button>
            </div>
            <JobsPanel full jobs={jobs} team={teamJobs} current={jobId} onOpen={j => openJob(j)} onOpenTeam={t => { setJobsOpen(false); openTeamJob(t); }} onCopy={j => { setJobsOpen(false); copyJob(j); }} onCopyTeam={t => { setJobsOpen(false); copyTeamJob(t); }} onDelete={deleteJob} />
          </div>
        </div>
      )}
      {finish && <FinishDialog mode={finish} camp={camp} checks={checks as any} job={curJob} busy={busy} team={hubReady()}
        onConfirm={finishJob} onClose={() => setFinish(null)} onReopen={reopenJob}
        onNew={() => { setFinish(null); startNewJob(blankCamp()); setCamp(blankCamp()); setBrief(''); setTab(STEPS[0].id); window.scrollTo(0, 0); flash('เริ่มงานใหม่แล้ว — งานที่เสร็จอยู่ใน "งานของฉัน"'); }}
        onAll={downloadAll} onPdf={printPDF}
        onFix={(id?: string) => { setFinish(null); if (id) setTab(id); }} />}
      {connectOpen && <TeamConnect setupKey={setupKey} onClose={() => { setConnectOpen(false); setSetupKey(''); }} flash={(t, w) => flash(t, !w)} />}
      {searchOpen && <SearchPalette onClose={() => setSearchOpen(false)} jobs={jobs} teamJobs={teamJobs}
        go={(a) => {
          setSearchOpen(false);
          if (a.t === 'course') { setHubInit(h => ({ key: h.key + 1, sec: 'courses', course: a.id })); setView('hub'); }
          else if (a.t === 'hub') { setHubInit(h => ({ key: h.key + 1, sec: a.sec as any, q: a.q })); setView('hub'); }
          else if (a.t === 'job') { const j = jobs.find(x => x.id === a.id); if (j) openJob(j); else { const tj = teamJobs.find(x => x.id === a.id); if (tj) openTeamJob(tj); } setTab('header'); setView('build'); }
          else if (a.t === 'nsr') setView('nsr', a.id);
          else if (a.t === 'stats') { setTab('stats'); setView('build'); }
          else if (a.t === 'useCourse') { changeCourse(a.id); setKind('program'); setTab('header'); setView('build'); }
          else if (a.t === 'past') setView('past', a.id);
          else if (a.t === 'pick') {   // ใส่กิจกรรมจากคลังลงงานที่เปิดอยู่ (ไม่ซ้ำ) → ไปขั้นกิจกรรมให้เห็นตำแหน่งที่ลง
            const a2 = CAT_ACTS.find(x => x.i === a.id);
            if (a2) { setCamp(c => (c.picks || []).some(p => p.id === a2.i) ? c : { ...c, picks: [...(c.picks || []), { id: a2.i }] }); flash(`ใส่ “${a2.n}” ลงงานนี้แล้ว — ดูตำแหน่ง/แทนช่วงได้ในขั้นกิจกรรม`); }
            setTab('activities'); setView('build');
          }
          else if (a.t === 'venue') { const e = venueDirectory(customVenues).find(x => x.name === a.id); if (e) pickVenue(e); setTab('header'); setView('build'); }
        }} />}
      {otherTab && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-3"><div className="flex flex-wrap items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5 text-[14px]">
          <AlertTriangle className="w-4 h-4 text-amber-600" /><span className="flex-1 min-w-[12rem]">งาน "{otherTab.name}" ถูกแก้จากอีกแท็บในเครื่องนี้ {ago(otherTab.savedAt)} — ถ้าแก้ทั้งสองแท็บ ฉบับที่บันทึกทีหลังจะทับ</span>
          <button onClick={() => { const j = loadJobs().find(x => x.id === otherTab.id); setOtherTab(null); if (j) openJob(j, { msg: 'โหลดฉบับล่าสุดจากอีกแท็บแล้ว' }); }} className="tap px-3 py-1.5 rounded-lg bg-brand-navy text-white text-[13.5px] font-medium">โหลดฉบับล่าสุด</button>
          <button onClick={() => { setOtherTab(null); storeJob(camp); }} className="tap px-3 py-1.5 rounded-lg border border-brand-mist text-[13.5px]">ใช้ฉบับในแท็บนี้</button>
        </div></div>
      )}
      {remoteJob && (
        <div role="status" className="fixed z-40 top-20 left-1/2 -translate-x-1/2 w-[min(560px,calc(100%-24px))] rounded-xl border border-amber-300 bg-white shadow-lift px-4 py-3 text-[14px] flex flex-wrap items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600" /><span className="flex-1 min-w-[12rem]">งานนี้ถูกแก้จากเครื่องอื่น{remoteJob.by ? ` (${remoteJob.by})` : ''} {ago(remoteJob.savedAt)}</span>
          <button onClick={() => openTeamJob(remoteJob)} className="tap px-3 py-1.5 rounded-lg bg-brand-navy text-white text-[13.5px] font-medium">โหลดฉบับล่าสุด</button>
          <button onClick={() => { const loc = jobs.find(j => j.id === remoteJob.id); if (loc) keepMine({ ...loc, by: userName() } as any, remoteJob.savedAt); setRemoteJob(null); }} className="tap px-3 py-1.5 rounded-lg border border-brand-mist text-[13.5px]">ทำต่อฉบับนี้</button>
        </div>
      )}

      {/* เปิดลิงก์จากแอป (LINE/Facebook ฯลฯ): เบราว์เซอร์ในแอปมักดาวน์โหลดไฟล์ไม่ได้ → พาไปเบราว์เซอร์จริง */}
      {IN_APP && !inAppHide && (() => {
        const ext = externalBrowserUrl();
        return (
          <div className="bg-amber-50 border-b border-amber-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2 text-[14px]">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-700" />
              <span className="flex-1 min-w-[14rem]">เปิดจาก {IN_APP} อาจดาวน์โหลดไฟล์ไม่ได้{ext ? '' : IS_IOS ? ' — กดปุ่ม ⋯ หรือ ↗ มุมจอ แล้วเลือก “เปิดใน Safari”' : ' — กดเมนู ⋮ แล้วเลือก “เปิดในเบราว์เซอร์”'}</span>
              {ext ? (
                <a href={ext} className="tap inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-navy text-white text-[13.5px] font-semibold"><ExternalLink className="w-4 h-4" />เปิดในเบราว์เซอร์</a>
              ) : (
                <button onClick={async () => flash(await copyText(location.href) ? 'คัดลอกลิงก์แล้ว — วางในเบราว์เซอร์ Safari หรือ Chrome' : 'คัดลอกไม่ได้ — กดค้างที่แถบที่อยู่เพื่อคัดลอก', true)}
                  className="tap inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 bg-white text-[13.5px] font-semibold"><Copy className="w-4 h-4" />คัดลอกลิงก์</button>
              )}
              <button onClick={() => setInAppHide(true)} aria-label="ปิดข้อความนี้" className="p-1 rounded-md text-amber-800/70 hover:text-amber-900"><X className="w-4 h-4" /></button>
            </div>
          </div>
        );
      })()}

      {view === 'home' && (
        <>
          <Home
            onStartBrief={() => { setTab('brief'); setView('build'); }}
            onUseCourse={code => { changeCourse(code); setKind('program'); setTab('header'); setView('build'); }}
            onOpenCourse={code => { setHubInit(h => ({ key: h.key + 1, sec: 'courses', course: code })); setView('hub'); }}
            installPrompt={installPrompt}
            onInstall={async () => { try { installPrompt.prompt(); await installPrompt.userChoice; } catch { /* ignore */ } setInstallPrompt(null); }} />
        </>
      )}

      {view !== 'home' && (
      <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-4">
        {dlBlocked && (
          <div className="mb-4 pl-4 pr-3 py-2.5 rounded-xl text-[14px] border border-amber-300 bg-white flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-start gap-2"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />หน้านี้บน claude.ai บันทึกไฟล์ได้เฉพาะผู้ที่ลงชื่อเข้าใช้ — ทีมงานทุกคนใช้เวอร์ชันเว็บได้ทันที ไม่ต้องลงชื่อ</span>
            <a href={WEB_URL} target="_blank" rel="noopener" className="tap px-3 py-1.5 rounded-lg bg-brand-navy text-white text-[13.5px] font-medium">เปิดเวอร์ชันเว็บ</a>
          </div>
        )}

        {view === 'past' ? (
          <Past key={pastQ} initialQ={pastQ} flash={(t, w) => flash(t, !w)} onConnect={() => setConnectOpen(true)}
            onOpen={(c, p) => { startNewJob(c); setCamp(c); setKind('program'); setTab('header'); setView('build');
              flash(`ดึงโปรแกรมเดิมมาเป็นงานใหม่แล้ว (${p.stats.days} วัน · ${p.stats.rows} แถว) — แก้โรงเรียน วันที่ จำนวน ราคา แล้วออกไฟล์ใหม่ได้เลย${p.missing.length ? ` · ยังขาด: ${p.missing.map(x => x.replace(/ \(.*\)$/, '')).join(', ')}` : ''}`); }} />
        ) : view === 'board' ? (
          <Board flash={(t, w) => flash(t, !w)} onConnect={() => setConnectOpen(true)} onBuild={() => { setTab('brief'); setView('build'); }} onOpenNsr={t => setView('nsr', t)}
            onOpenJob={id => { const j = jobs.find(x => x.id === id); if (j) openJob(j); else openTeamJob((teamJobs.find(x => x.id === id) || { id }) as TeamJob); setTab('header'); setView('build'); }} />
        ) : view === 'nsr' ? (
          <Nsr flash={(t, w) => flash(t, !w)} prefill={nsrPrefill} onConnect={() => setConnectOpen(true)} openTab={nsrTab} />
        ) : view === 'hub' ? (
          <DataHub key={hubInit.key} initialSec={hubInit.sec} initialQ={hubInit.q} venues={allVenues} currentCourse={hubInit.course || camp.courseCode} currentVenue={camp.venue}
            onUseCourse={code => { changeCourse(code); setKind('program'); setTab('header'); setView('build'); }}
            onUseVenue={v => { set({ venue: v.name, province: v.province, venueVisit: v.visit, supplierNote: v.note }); setView('build'); setTab('header'); flash(`ใช้ที่พัก "${v.name}" ในเอกสารแล้ว`); }}
            onUsePreset={id => { loadPreset(id); setTab('brief'); setView('build'); }} />
        ) : (<>
        {/* Sales workflow: 4 document types */}
        <div className="bg-white rounded-2xl border border-brand-mist p-3 mb-4 shadow-card">
          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
            <h2 className="text-[16px] font-semibold">เลือกเอกสาร</h2>
            <div className="flex items-center gap-1.5">
              
              <span className="hidden sm:inline text-[12.5px] text-sub mr-1 max-w-[22rem] truncate" aria-live="polite" data-current-job={curJob?.name || ''}>{curJob ? <>{curJob.done ? 'เสร็จแล้ว' : 'กำลังแก้'} <b className="text-brand-ink font-semibold">{curJob.name}</b> · {curJob.done ? ago(curJob.doneAt || curJob.savedAt) : `บันทึกอัตโนมัติ ${ago(curJob.savedAt)}`}</> : ''}</span>
              <button onClick={() => setJobsOpen(true)} className="tap px-2.5 py-1 rounded-lg text-[13.5px] text-brand-navy font-medium hover:bg-paper">งานทั้งหมด{jobs.length ? ` (${jobs.length}${jobs.filter(j => !j.done).length ? ` · ค้าง ${jobs.filter(j => !j.done).length}` : ''})` : ''}</button>
              <button onClick={exportDB} className="tap px-2.5 py-1 rounded-lg text-[13.5px] text-sub hover:text-brand-ink hover:bg-paper">ส่งออกงาน</button>
              <button onClick={() => fileInput.current?.click()} className="tap px-2.5 py-1 rounded-lg text-[13.5px] text-sub hover:text-brand-ink hover:bg-paper">นำเข้างาน</button>
              <button onClick={resetDB} className="tap px-2.5 py-1 rounded-lg text-[13.5px] text-sub hover:text-rose-700 hover:bg-paper">เริ่มใหม่</button>
              <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" onChange={e => { importDB(e.target.files?.[0]); e.target.value = ''; }} />
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {DOC_TYPES.map(d => {
              const Icon = KIND_ICON[d.id]; const on = kind === d.id;
              return (
                <button key={d.id} onClick={() => setKind(d.id)}
                  className={`tap text-left p-2.5 sm:p-3.5 rounded-xl border ${on ? 'bg-brand-navy text-white border-brand-navy' : 'bg-white border-brand-mist hover:border-brand/40'}`}>
                  <div className="flex items-center gap-1.5 mb-1.5"><span className={`text-[12px] font-medium ${on ? 'text-white/70' : 'text-sub'}`}>{d.stage}</span>{d.internal && <Lock className={`w-3 h-3 ml-auto ${on ? 'text-white/70' : 'text-sub'}`} />}</div>
                  <div className="text-[15px] font-semibold leading-tight">{d.label}</div>
                  <div className={`hidden sm:block text-[13px] mt-1 leading-snug ${on ? 'text-white/70' : 'text-sub'}`}>{d.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* LEFT: editor */}
          <div className="lg:col-span-5 space-y-4">
            {/* edit tabs */}
            {/* ขั้นตอนออกแบบหลักสูตร: เป็นลำดับจริง 1→6 จึงใช้ตัวเลข + สถานะผ่านแล้ว */}
            <nav aria-label="ขั้นตอนการออกแบบ" className="bg-white rounded-xl border border-brand-mist p-2">
              <ol className="flex flex-wrap gap-1">
                {STEPS.map((t, i) => {
                  const on = tab === t.id; const done = stepIdx > i;
                  return (
                    <li key={t.id} className="shrink-0">
                      <button onClick={() => setTab(t.id)} aria-current={on ? 'step' : undefined}
                        className={`tap flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-lg text-[14px] whitespace-nowrap ${on ? 'bg-brand-navy text-white font-semibold' : 'text-brand-ink hover:bg-paper font-medium'}`}>
                        <span className={`w-6 h-6 rounded-full grid place-items-center text-[12.5px] font-semibold ${on ? 'bg-white text-brand-navy' : done ? 'bg-brand-navy/10 text-brand-navy' : 'bg-paper text-sub ring-1 ring-brand-mist'}`}>{done ? <Check className="w-3.5 h-3.5" /> : i + 1}</span>
                        {t.label}
                      </button>
                    </li>
                  );
                })}
              </ol>
              <div className="flex gap-4 px-2 pt-2 mt-1.5 border-t border-brand-mist text-[13.5px]">
                {AUX.map(t => (
                  <button key={t.id} onClick={() => setTab(t.id)} className={`tap flex items-center gap-1.5 py-0.5 ${tab === t.id ? 'text-brand-ink font-semibold underline underline-offset-4' : 'text-sub hover:text-brand-ink'}`}>
                    <t.icon className="w-4 h-4" />{t.label}
                  </button>
                ))}
              </div>
            </nav>

            <div className="bg-white rounded-2xl border border-brand-mist shadow-card p-4 sm:p-5">
              {tab === 'brief' && (
                <div className="space-y-4">
                  <JobsPanel jobs={jobs} team={teamJobs} current={jobId} onOpen={j => openJob(j)} onOpenTeam={openTeamJob} onCopy={copyJob} onCopyTeam={copyTeamJob} onDelete={deleteJob} onAll={() => setJobsOpen(true)} />
                  <SectionTitle title="บรีฟจากลูกค้า" sub="วางข้อความบรีฟ ระบบเติมรหัส PL โรงเรียน จำนวนคน วิชา ระยะเวลา วันที่ สถานที่ และราคาให้" />
                  <label className="block"><span className="sr-only">ข้อความบรีฟ</span><textarea rows={5} value={brief} onChange={e => setBrief(e.target.value)} className="w-full p-3 rounded-xl border border-brand-mist text-[15px] leading-relaxed focus:outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15" /></label>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => applyBrief('new')} className="tap py-2.5 rounded-xl bg-brand-navy text-white font-semibold text-[14px] hover:opacity-90">อ่านบรีฟ · เริ่มงานใหม่</button>
                    <button onClick={() => applyBrief('update')} className="tap py-2.5 rounded-xl bg-white border border-brand-mist text-brand-ink hover:bg-paper font-medium text-[14px]">อ่านบรีฟ · แก้งานเดิม</button>
                  </div>
                  <button onClick={() => aiExtract('new')} disabled={busy} className="tap text-[13.5px] text-brand-navy underline underline-offset-4 disabled:opacity-40">{busy ? 'กำลังอ่านบรีฟ…' : 'บรีฟเขียนอิสระ อ่านไม่ครบ? ให้ Claude ช่วยอ่าน'}</button>
                  {briefReport && (
                    <div className="rounded-xl border border-brand-mist overflow-hidden" aria-live="polite">
                      <div className="flex items-center justify-between px-3.5 py-2 bg-paper text-[13.5px]">
                        <span className="font-semibold">ข้อมูลที่อ่านได้จากบรีฟ</span>
                        <span className="text-sub">{briefReport.fields.filter(f => f.ok).length}/{briefReport.fields.length} ช่อง · {briefReport.by}</span>
                      </div>
                      <dl className="divide-y divide-brand-mist text-[14px]">
                        {briefReport.fields.map(f => (
                          <div key={f.key} className="grid grid-cols-[7.5rem_1fr] gap-2 px-3.5 py-1.5">
                            <dt className="text-sub">{f.label}</dt>
                            <dd className={f.ok ? '' : 'text-amber-700'}>{f.ok ? f.value : (f.key === 'venuePhotos' ? 'ไม่มีภาพโรงแรมนี้ในไฟล์ทีม' : 'ไม่พบในบรีฟ — กรอกในขั้นถัดไป')}</dd>
                          </div>))}
                      </dl>
                    </div>)}
                  {briefReport && (() => { const seen = pastForSchool(pastJobs(readPastCache()), camp.school); return seen.length > 0 && (
                    <div className="rounded-xl border border-brand-mist bg-paper px-3.5 py-2.5 text-[13.5px]" role="note">
                      <div className="font-semibold">เคยจัดกับโรงเรียนนี้ {seen.length} งาน</div>
                      <ul className="mt-1 space-y-0.5">{seen.slice(0, 4).map(j => <li key={j.id} className="truncate">{j.dateLabel || '—'} · {j.courseCode ? courseLabel(j.courseCode) : j.name.replace(/^\d{6}\s*/, '').slice(0, 60)}{j.duration ? ` · ${j.duration}` : ''}{j.confirmed ? ' · ยืนยันแล้ว' : ''}</li>)}</ul>
                      <button onClick={() => setView('past', camp.school.replace(/^โรงเรียน/, ''))} className="tap mt-1.5 text-brand-navy font-medium underline underline-offset-4">ดูงานเก่า / เปิดโปรแกรมเดิมมาแก้</button>
                    </div>); })()}
                  <div className="pt-4 border-t border-brand-mist space-y-2">
                    <h3 className="text-[15px] font-semibold">หรือเริ่มจากงานที่เคยทำ</h3>
                    {PRESETS.map(p => (
                      <button key={p.id} onClick={() => loadPreset(p.id)} className="tap w-full text-left p-3.5 rounded-xl border border-brand-mist hover:border-brand/40 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[13.5px] font-semibold">{p.label}</div>
                          <div className="text-[13px] text-sub">{p.camp.school} · {p.camp.venue} · ลดเหลือ {money(p.camp.specialPrice!)} บ.</div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-brand shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {tab === 'db' && (() => {
                const ds = courseDataset(dbSel);
                return (
                  <div className="space-y-3">
                    <SectionTitle title="ฐานข้อมูลค่าย (14 หลักสูตรจริง)" sub="เลือกค่าย → เห็นเฉพาะข้อมูลที่ผูกกับค่ายนั้น (วัตถุประสงค์ · กิจกรรม · ภาพ) แล้วกด 'ใช้หลักสูตรนี้' เพื่อโหลดเข้าเอกสาร" />
                    <div className="flex flex-wrap gap-1.5">
                      {COURSES.map(co => {
                        const on = dbSel === co.code; const nPhoto = coursePhotoIds(co.code).length;
                        return <button key={co.code} onClick={() => setDbSel(co.code)} title={co.name} className={`px-2 py-1 rounded-lg text-[12px] font-semibold border ${on ? 'bg-brand text-white border-brand' : 'bg-slate-50 border-slate-200 text-sub'}`}>{co.code}{nPhoto ? '' : ''}</button>;
                      })}
                    </div>
                    {ds && (
                      <div className="border border-slate-200 rounded-xl p-3 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-sm font-semibold text-brand-ink">{ds.course.name}</div>
                            <div className="text-[13px] text-sub">{ds.course.code} · วิชา {SUBJECTS[ds.course.family as Subject]?.label || ds.course.family} · กิจกรรม {ds.total} · ภาพ {ds.photoCount}{ds.draftCount ? ` · รอตรวจ ${ds.draftCount}` : ''}</div>
                          </div>
                          <button onClick={() => { changeCourse(ds.course.code); setTab('header'); }} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[13px] font-semibold shrink-0">ใช้หลักสูตรนี้ →</button>
                        </div>
                        <div>
                          <div className="text-[13px] font-semibold text-sub mb-1">วัตถุประสงค์หลัก (เข้าเอกสารข้อ 1–2)</div>
                          <div className="text-[13px] text-slate-700 space-y-0.5">
                            <div>1. {ds.course.obj1 || <span className="text-amber-600">— ยังไม่มีในฐาน (ทีมเติมใน MASTER)</span>}</div>
                            <div>2. {ds.course.obj2 || <span className="text-amber-600">— ยังไม่มีในฐาน (ทีมเติมใน MASTER)</span>}</div>
                          </div>
                        </div>
                        <div>
                          <div className="text-[13px] font-semibold text-sub mb-1">กิจกรรมที่ผูกกับค่ายนี้ ({ds.total})</div>
                          {ds.total === 0 ? <div className="text-[13px] text-amber-600">ยังไม่มีกิจกรรมในฐานสำหรับหลักสูตรนี้</div> :
                            <div className="space-y-1.5">
                              {ds.actsByKind.map(g => (
                                <div key={g.kind}>
                                  <div className="text-[12px] font-semibold text-slate-400">{KIND_LABEL[g.kind]} ({g.items.length})</div>
                                  <ul className="list-disc ml-4 text-[13px] text-slate-700">
                                    {g.items.map(a => <li key={a.id}>{a.title}{a.draft && <span className="ml-1 text-[11px] font-semibold text-amber-700 bg-amber-100 px-1 rounded">รอตรวจ</span>}</li>)}
                                  </ul>
                                </div>
                              ))}
                            </div>}
                        </div>
                        <div>
                          <div className="text-[13px] font-semibold text-sub mb-1">แม่แบบโปรแกรมจริง ({ds.templates.length})</div>
                          <div className="text-[13px] text-slate-700 mb-2">{ds.templates.length ? ds.templates.map(t => durKeyLabel(t.dur) + (t.area.length ? ` (${t.area.join('/')})` : '')).join(' · ') : 'ยังไม่มี'}</div>
                          <div className="text-[13px] font-semibold text-sub mb-1">ภาพกิจกรรมจากไฟล์ของค่ายนี้ ({ds.photoCount})</div>
                          {ds.photoCount === 0 ? <div className="text-[13px] text-slate-400">ยังไม่มีภาพในไฟล์ของค่ายนี้</div> :
                            <div className="grid grid-cols-4 gap-1.5">
                              {ds.photos.slice(0, 12).map(id => <img key={id} src={`${PHOTO_BASE}t_${id}.jpg`} loading="lazy" className="w-full h-14 object-cover rounded-md border border-slate-200 bg-slate-100" alt="" />)}
                            </div>}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {tab === 'header' && (
                <div className="space-y-3">
                  <SectionTitle title="รหัส PL · วิชา · โรงเรียน · จำนวน · ระยะเวลา · สถานที่" />
                  {camp.courseCode && <div className="text-[12px] text-brand-ink bg-paper border border-brand-mist rounded-lg px-2 py-1.5">ผูกหลักสูตร <b>{camp.courseCode}</b> — กิจกรรม · ภาพ · วัตถุประสงค์ ดึงเฉพาะของค่ายนี้ · การกด "วิชา" ด้านล่างจะเลิกผูกหลักสูตร</div>}
                  <div className="grid grid-cols-2 gap-2.5">
                    <Field label="รหัสเอกสาร (มุมขวาบน)"><input value={camp.docCode} onChange={e => set({ docCode: e.target.value })} className={inp} /></Field>
                    <Field label="จำนวนวิทยากร (อัตโนมัติ)"><input value={`${staffText(camp.students)} คน`} readOnly className={inp + ' bg-slate-50 text-sub'} /></Field>
                  </div>
                  <Field label="วิชา / ประเภทค่าย (เปลี่ยนชื่อหลักสูตร + กิจกรรมเริ่มต้น)">
                    <div className="grid grid-cols-2 gap-1.5">
                      {(Object.keys(SUBJECTS) as Subject[]).map(s => (
                        <button key={s} onClick={() => changeSubject(s)} className={`py-2 rounded-lg text-[13.5px] font-semibold border ${camp.subject === s ? 'bg-brand text-white border-brand' : 'bg-slate-50 border-slate-300'}`}>{SUBJECTS[s].label}</button>
                      ))}
                    </div>
                  </Field>
                  <Field label="หลักสูตรจริงจากคลัง 14 ธีม (ดึงกิจกรรมจริงของธีมนั้น — แม่นกว่าเลือกแค่วิชา)">
                    {/* การ์ดหลักสูตร: อ่านชื่อเต็มได้ เห็นจำนวนภาพจริง เลือกด้วยคลิกเดียว */}
                    <div role="radiogroup" className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[340px] overflow-y-auto pr-1">
                      <button role="radio" aria-checked={!camp.courseCode} onClick={() => changeCourse('')}
                        className={`tap text-left p-3 rounded-xl border ${!camp.courseCode ? 'border-brand-navy ring-1 ring-brand-navy bg-white' : 'border-brand-mist bg-paper hover:border-brand/40'}`}>
                        <div className="text-[14px] font-semibold leading-snug">ไม่ผูกหลักสูตร</div>
                        <div className="text-[12.5px] text-sub mt-0.5">ใช้ชุดกิจกรรมมาตรฐานตามวิชาด้านบน</div>
                      </button>
                      {COURSES.map(co => {
                        const on = camp.courseCode === co.code; const m = co.name.replace(/^หลักสูตร/, '').match(/^(.*?)\s*\(([^)]*)\)\s*$/);
                        const nP = coursePhotoIds(co.code).length; const nT = templatesOf(co.code).length;
                        return (
                          <button key={co.code} role="radio" aria-checked={on} onClick={() => changeCourse(co.code)}
                            className={`tap text-left p-3 rounded-xl border ${on ? 'border-brand-navy ring-1 ring-brand-navy bg-white' : 'border-brand-mist bg-white hover:border-brand/40'}`}>
                            <div className="flex items-center justify-between gap-2 text-[12px] text-sub"><span className="font-medium">{co.code}</span><span>{nT ? `แม่แบบ ${nT} · ภาพ ${nP}` : 'ยังไม่มีแม่แบบ'}</span></div>
                            <div className="text-[14px] font-semibold leading-snug mt-1">{m ? m[1] : co.name}</div>
                            {m && <div className="text-[12.5px] text-sub leading-snug">{m[2]}</div>}
                          </button>
                        );
                      })}
                    </div>
                    {camp.courseCode && (plan.tpl ? <div className="text-[12px] text-sub mt-1">ใช้แม่แบบโปรแกรมจริงของทีม: <b className="text-brand-ink">{plan.tpl.source.replace('__', ' · ')}</b>{plan.tpl.exact ? '' : ` (ยังไม่มีแม่แบบ ${durKeyLabel(durKeyOf(camp))} — กำหนดการจัดอัตโนมัติ)`}</div>
                      : <div className="text-[12px] text-amber-700 mt-1">กิจกรรมจากคลังนี้สถานะ "รอตรวจ" — ทีมต้องยืนยันขั้นตอน/อุปกรณ์/เวลาก่อนจัดจริง</div>)}
                  </Field>
                  <div className="text-[13px] text-sub -mt-1">หลักสูตร: <b>{k.titleTh}</b> {k.titleEn}</div>
                  <Field label="ชื่อโรงเรียน"><input value={camp.school} onChange={e => set({ school: e.target.value })} className={inp} /></Field>
                  <div className="grid grid-cols-3 gap-2.5">
                    <Field label="ระดับชั้น"><input value={camp.level} onChange={e => set({ level: e.target.value })} className={inp} /></Field>
                    <Field label="นักเรียน (คน)"><input type="number" value={camp.students} onChange={e => set({ students: +e.target.value || 0 })} className={inp} /></Field>
                    <Field label="ครู (คน)"><input type="number" value={camp.teachers} onChange={e => set({ teachers: +e.target.value || 0 })} className={inp} /></Field>
                  </div>
                  <div>
                    <label className="inline-flex items-center gap-2 text-[14px] cursor-pointer">
                      <input type="checkbox" className="w-4 h-4 accent-[#0C2A41]" checked={showTeachers(camp)} onChange={e => set({ includeTeachers: e.target.checked })} />
                      แสดงครูผู้ดูแลในเอกสาร
                    </label>
                    <p className="text-[12.5px] text-sub mt-0.5 ml-6">{camp.durationMode === 'overnight' ? 'ค่ายพักค้าง: ปกติแสดงจำนวนครูและยอดรวม' : 'Day Camp / ครึ่งวัน: ปกติไม่แสดงครู เพราะไม่ต้องดูแลครู'}{camp.includeTeachers !== undefined && <> · <button onClick={() => set({ includeTeachers: undefined })} className="underline underline-offset-2">กลับเป็นค่าอัตโนมัติ</button></>}</p>
                  </div>
                  <Field label="ระยะเวลา (จัดกำหนดการใหม่อัตโนมัติ)">
                    {([
                      ['ไป-กลับ (Day Camp)', [
                        { m: 'half' as DurationMode, d: 1, n: 0, l: 'ครึ่งวัน' },
                        { m: 'day' as DurationMode, d: 1, n: 0, l: '1 วัน' },
                        { m: 'day' as DurationMode, d: 2, n: 0, l: '2 วัน' },
                        { m: 'day' as DurationMode, d: 3, n: 0, l: '3 วัน' }]],
                      ['พักค้าง', [
                        { m: 'overnight' as DurationMode, d: 2, n: 1, l: '2 วัน 1 คืน' },
                        { m: 'overnight' as DurationMode, d: 3, n: 2, l: '3 วัน 2 คืน' },
                        { m: 'overnight' as DurationMode, d: 4, n: 3, l: '4 วัน 3 คืน' }]]
                    ] as const).map(([grp, opts]) => (
                      <div key={grp} className="mb-2 last:mb-0">
                        <div className="text-[12.5px] text-sub mb-1">{grp}</div>
                        <div className="grid grid-cols-4 gap-1.5">
                          {opts.map(o => {
                            const on = camp.durationMode === o.m && (o.m === 'half' || camp.days === o.d);
                            return <button key={o.l} onClick={() => changeDuration(o.m, o.d, o.n)} aria-pressed={on}
                              className={`tap py-2 rounded-lg text-[13.5px] border ${on ? 'bg-brand-navy text-white border-brand-navy font-semibold' : 'bg-white border-brand-mist hover:border-brand/40'}`}>{o.l}</button>;
                          })}
                        </div>
                      </div>
                    ))}
                  </Field>
                  <div className="grid grid-cols-2 gap-2.5">
                    <Field label="เวลาออกเดินทาง (เช่น 06.30)"><input value={camp.startTime} onChange={e => set({ startTime: e.target.value })} className={inp} /></Field>
                    <Field label="ชั่วโมงเดินทาง (ชม.)"><input type="number" step="0.5" value={camp.travelHours} onChange={e => set({ travelHours: +e.target.value || 0 })} className={inp} /></Field>
                  </div>
                  <Field label="วันที่จัดค่าย"><input value={camp.dates} onChange={e => set({ dates: e.target.value })} className={inp} /></Field>
                  <Field label="สถานที่ / โรงแรม — พิมพ์ชื่อแล้วเลือก ระบบเติมจังหวัด ทัศนศึกษา ผู้ติดต่อ และภาพที่พักให้">
                    <VenuePicker value={camp.venue} custom={customVenues} photoBase={PHOTO_BASE} onType={v => set({ venue: v })} onPick={pickVenue} />
                  </Field>
                  <div className="grid grid-cols-2 gap-2.5">
                    <Field label="จังหวัด"><input value={camp.province} onChange={e => set({ province: e.target.value })} className={inp} /></Field>
                    <Field label="ผู้ติดต่อ/ซัพพลายเออร์ (ภายใน)"><input value={camp.supplierNote} onChange={e => set({ supplierNote: e.target.value })} className={inp} /></Field>
                  </div>
                  <Field label="แหล่งทัศนศึกษา (ใส่แล้วกำหนดการจะมีช่วงทัศนศึกษา / เว้นว่าง = ไม่มี)">
                    <input value={camp.venueVisit} onChange={e => set({ venueVisit: e.target.value })} className={inp} placeholder="เช่น ถนนวัฒนธรรมเชียงคาน / ภูทอก" />
                  </Field>
                  <Field label="หัวกระดาษ (ภาค) — เลือกอัตโนมัติจากจังหวัด แก้ได้">
                    <select value={camp.region || ''} onChange={e => set({ region: (e.target.value || undefined) as Region | undefined })} className={inp}>
                      <option value="">อัตโนมัติจากจังหวัด → {LETTERHEADS[regionOf(camp.province)].label}</option>
                      {(Object.keys(LETTERHEADS) as Region[]).map(r => <option key={r} value={r}>{LETTERHEADS[r].label}</option>)}
                    </select>
                    <div className="text-[12px] text-sub mt-1">หัวกระดาษ EQ Camp จะขึ้นทุกหน้า ทุกเอกสาร (แบรนด์/ติดต่อยังรอทีมยืนยันขั้นสุดท้าย)</div>
                  </Field>
                  <VenueAdd onAdd={addVenue} />
                </div>
              )}

              {tab === 'activities' && (
                <div className="space-y-3">
                  <ActivityPicker camp={camp} plan={plan} set={set} />
                  <AddonPanel camp={camp} plan={plan} set={set} />
                  <ActsEditor camp={camp} plan={plan} acts={k.acts} set={set} />
                  {!(plan.tpl && plan.tpl.exact) && (
                  <details className="bg-white border border-slate-200 rounded-xl p-3 space-y-3">
                    <summary className="cursor-pointer text-[14px] font-semibold text-sub">ตั้งค่าการจัดอัตโนมัติ (คลังสำหรับเติมช่องว่างเมื่อไม่ใช้แม่แบบ)</summary>
                  <SectionTitle title={`เลือกกิจกรรมจากคลัง ${camp.courseCode ? '· หลักสูตร ' + (courseById(camp.courseCode)?.name || camp.courseCode) : '(วิชา' + SUBJECTS[camp.subject].label + ')'}`} sub={camp.courseCode ? 'แสดงเฉพาะกิจกรรมของหลักสูตรนี้ + สันทนาการ/เปิด-ปิดกลางที่จำเป็น — ระบบเรียงลงทุกช่วงจนเต็ม ไม่เว้นว่าง' : "ระบบนำกิจกรรมที่เลือกไปเรียงลงทุกช่วงเวลาในกำหนดการจนเต็ม ไม่เว้นช่องว่าง และร้อยเป็นประโยค 'กิจกรรมเชิงบูรณาการ' อัตโนมัติ"} />
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-sub">ตารางต้องการ <b className="text-brand">{plan.coreSlots}</b> ช่องกิจกรรมหลัก · เลือกไว้ <b className="text-brand">{selectedCore}</b></span>
                    <div className="flex gap-2">
                      <button onClick={() => set({ activityIds: camp.courseCode ? defaultCourseActs(camp.courseCode) : defaultActs(camp.subject).concat(camp.extraActivities.filter(a => a.subjects.includes(camp.subject)).map(a => a.id)) })} className="font-semibold text-brand">เลือกทั้งหมด</button>
                      <button onClick={() => set({ activityIds: camp.activityIds.filter(id => !subjectPool(camp).some(a => a.id === id && a.kind === 'core')) })} className="font-semibold text-slate-400">ล้างกิจกรรมหลัก</button>
                    </div>
                  </div>
                  {(['opening', 'core', 'night', 'recreation', 'closing'] as const).map(kind => {
                    const items = subjectPool(camp).filter(a => a.kind === kind);
                    if (!items.length) return null;
                    const label = { opening: 'เปิดค่าย', core: 'กิจกรรมหลัก (ฐานการเรียนรู้)', night: 'ภาคค่ำ', recreation: 'สันทนาการ', closing: 'ปิดค่าย' }[kind];
                    return (
                      <div key={kind}>
                        <div className="text-[13px] font-semibold text-sub mb-1">{label}</div>
                        <div className="space-y-1.5">
                          {items.map(a => {
                            const on = camp.activityIds.includes(a.id);
                            const custom = a.id.startsWith('cust-');
                            return (
                              <div key={a.id} className={`p-2.5 rounded-lg border flex items-start gap-2 ${on ? 'bg-paper border-brand-mist' : 'bg-white border-slate-200'}`}>
                                <button onClick={() => toggleAct(a.id)} className="flex items-start gap-2 flex-1 text-left">
                                  <div className={`w-4 h-4 rounded mt-0.5 grid place-items-center shrink-0 ${on ? 'bg-brand' : 'border border-brand-mist'}`}>{on && <CheckCircle2 className="w-4 h-4 text-white" />}</div>
                                  <div>
                                    <div className="text-[13.5px] font-semibold leading-snug">{a.title}{custom && <span className="ml-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-1 rounded">เพิ่มเอง</span>}{a.draft && !custom && <span className="ml-1 text-[11px] font-semibold text-amber-700 bg-amber-100 px-1 rounded">รอตรวจ</span>}{(() => { const n = notionActFor(a.title); return n ? <span className="ml-1 text-[11px] font-semibold text-brand-navy bg-paper border border-brand-mist px-1 rounded">Notion · {actStandard(n).level}</span> : null; })()}</div>
                                    {a.desc && <div className="text-[12px] text-sub">{a.desc}</div>}
                                    {a.draft && !custom && <div className="text-[11px] text-amber-600">ต้องยืนยันขั้นตอน/อุปกรณ์/เวลาก่อนจัดจริง</div>}
                                  </div>
                                </button>
                                {custom && <button onClick={() => removeCustom(a.id)} className="text-rose-400 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  <CustomAdd onAdd={addCustom} />
                  </details>)}
                </div>
              )}

              {tab === 'schedule' && (
                <div className="space-y-3">
                  <DayMixPanel camp={camp} plan={plan} set={set} />
                  <PartyPanel camp={camp} plan={plan} set={set} />
                  {(plan.picks || []).length > 0 && <div className="text-[13px] text-brand-ink bg-paper border border-brand-mist rounded-lg px-3 py-2">ดึงกิจกรรมที่เลือกลงกำหนดการแล้ว {(plan.picks || []).filter(x => x.how !== 'missing').length}/{(plan.picks || []).length} รายการ (ป้าย “เลือกจากคลัง”) — เปลี่ยนตำแหน่งได้ที่ขั้น “กิจกรรม”</div>}
                  {(plan.pickWarn || []).map(w => <div key={w} className="text-[13px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{w}</div>)}
                  <SectionTitle title="กำหนดการ" sub={plan.tpl && plan.tpl.exact ? 'ตามแม่แบบโปรแกรมจริงของทีม — ชื่อโรงเรียน/ที่พัก/ปี/จำนวนคน/งบ แทนด้วยข้อมูลจากบรีฟแล้ว' : "สร้างอัตโนมัติจากกิจกรรม + ระยะเวลา · ช่อง 'กิจกรรมหลัก' เลือกจากคลังได้รายช่วง"} />
                  {camp.courseCode && (templatesOf(camp.courseCode).length > 0) && (
                    <div className="border border-brand-mist rounded-xl p-3 space-y-2 bg-white">
                      <div className="text-[13px] text-sub">แม่แบบที่ใช้</div>
                      <select value={camp.templateId === 'engine' ? 'engine' : (plan.tpl && plan.tpl.exact ? plan.tpl.id : '')} onChange={e => set({ templateId: e.target.value || undefined, rowEdits: undefined, actsOverride: undefined, budgetItems: undefined, dayOrders: undefined, picks: camp.picks?.map(({ at, ...p }) => p) })} className={inp}>
                        {plan.tpl && plan.tpl.exact
                          ? plan.tpl.options.map(o => <option key={o.id} value={o.id}>แม่แบบจริง · {o.label}</option>)
                          : <option value="">ไม่มีแม่แบบ {durKeyLabel(durKeyOf(camp))} — หน้าปกจาก {plan.tpl ? plan.tpl.source.replace('__', ' · ') : '-'}</option>}
                        <option value="engine">จัดอัตโนมัติจากคลังกิจกรรม (ไม่ใช้แม่แบบ)</option>
                      </select>
                      {plan.tpl && plan.tpl.exact && plan.tpl.locRows.length > 0 && plan.tpl.areaOK !== true && (
                        <div className="text-[12.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
                          แม่แบบนี้มีกิจกรรมนอกสถานที่ของพื้นที่ <b>{plan.tpl.area.join('/') || 'เดิม'}</b> — ตรวจว่าเหมาะกับพื้นที่ค่าย{camp.province ? ` จ.${camp.province}` : ''} ก่อนส่ง:
                          <ul className="list-disc ml-5 mt-1">{plan.tpl.locRows.map((x, i) => <li key={i}>{x}</li>)}</ul>
                        </div>)}
                    </div>)}
                  {plan.coreSlots > 0 && <div className="flex items-center justify-between text-[13px] bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                    <span className="text-sub">ช่องกิจกรรมหลักทั้งหมด <b className="text-brand">{plan.days.reduce((n, d) => n + d.items.filter(r => r.slot !== undefined).length, 0)}</b> ช่อง · เลือกเอง <b className="text-brand">{(camp.coreSlotIds || []).filter(Boolean).length}</b></span>
                    <button onClick={clearSlots} className="font-semibold text-slate-400 hover:text-sub">ล้างเป็นอัตโนมัติทั้งหมด</button>
                  </div>}
                  {plan.days.map(d => (
                    <div key={d.day} className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="bg-brand text-white text-[13.5px] font-semibold px-3 py-1.5 flex items-center justify-between gap-2"><span>วันที่ {d.day}</span>
                        <span className="flex items-center gap-3">
                          {(camp.dayOrders || []).some(o => o.day === d.day) && <button onClick={() => { set({ dayOrders: resetOrder(camp, d.day) }); flash(`วันที่ ${d.day} กลับเป็นลำดับเดิมแล้ว`); }} className="tap inline-flex items-center gap-1 font-normal text-white/90 hover:text-white underline underline-offset-2"><RotateCcw size={13} />คืนลำดับเดิม</button>}
                          <span className="font-normal text-white/80">เลิก {dayEndOf(d) || '-'} น.</span>
                        </span></div>
                      <DayTools camp={camp} plan={plan} day={d.day} set={set} />
                      <div className="divide-y divide-slate-100" data-sched-day={d.day}>
                        {d.items.map((r, i) => (
                          editRow && editRow.day === d.day && editRow.i === i
                            ? <RowEditForm key={i} day={d.day} row={r} camp={camp} set={set} onDone={() => setEditRow(null)} />
                            : <div key={r.key || i} data-row className={`group flex gap-1.5 pl-1 pr-2.5 py-1.5 text-[13px] transition-colors ${drag && drag.day === d.day ? (drag.from === i ? 'opacity-40 bg-paper' : drag.over === i ? (drag.over < drag.from ? 'shadow-[inset_0_3px_0_0_#0C2A41]' : 'shadow-[inset_0_-3px_0_0_#0C2A41]') : '') : ''}`}>
                            <button type="button" {...gripProps(d.day, i, d.items.length, `${r.time} ${r.title}`)} className="self-start shrink-0 -my-0.5 px-1 py-1.5 rounded-md text-slate-300 hover:text-brand-ink hover:bg-paper focus-visible:text-brand-ink cursor-grab active:cursor-grabbing touch-none select-none"><GripVertical size={16} /></button>
                            <span className="font-semibold text-sub w-28 shrink-0">{r.time}</span>
                            <span className="text-slate-800 flex-1 min-w-0">
                              {r.moved && <span className="inline-block mb-0.5 mr-1 px-1 rounded bg-brand-mist text-brand-navy text-[11px] font-semibold">ย้ายแล้ว</span>}
                              {r.ext && <span className="inline-block mb-0.5 mr-1 px-1 rounded bg-brand-mist text-brand-navy text-[11px] font-semibold">ช่วงที่ขยาย</span>}
                              {r.added !== undefined && <span className="inline-block mb-0.5 mr-1 px-1 rounded bg-brand-mist text-brand-navy text-[11px] font-semibold">เพิ่มเอง</span>}
                              {r.picked !== undefined && <span className="inline-block mb-0.5 mr-1 px-1 rounded bg-brand-mist text-brand-navy text-[11px] font-semibold">เลือกจากคลัง</span>}
                              {r.orig && <span className="inline-block mb-0.5 mr-1 px-1 rounded bg-amber-50 text-amber-800 text-[11px] font-semibold">{r.party && camp.partyTheme && !(camp.rowEdits || []).some(e => e.day === d.day && e.from === r.orig) ? 'ธีมปาร์ตี้' : 'แก้แล้ว'}</span>}
                              {r.slot !== undefined && <span className="inline-block mb-0.5 px-1 rounded bg-brand-mist text-brand text-[11px] font-semibold">กิจกรรมหลัก #{r.slot + 1}</span>}
                              <span className="block">{r.title}{r.sub?.map((s, j) => <span key={j} className="block text-slate-400">{s}</span>)}</span>
                              {r.slot !== undefined && (
                                <select value={(camp.coreSlotIds || [])[r.slot] || ''} onChange={e => setSlot(r.slot!, e.target.value)}
                                  className="mt-1 w-full px-1.5 py-1 rounded border border-brand-mist text-[12px] bg-white">
                                  <option value="">— อัตโนมัติ (ระบบเลือกให้) —</option>
                                  {coreOptions.map(a => (
                                    <option key={a.id} value={a.id}>{a.draft ? '' : ''}{a.title.replace(/^กิจกรรม\s*/, '').slice(0, 60)}</option>
                                  ))}
                                </select>
                              )}
                            </span>
                            <button onClick={() => setEditRow({ day: d.day, i })} aria-label={`แก้ไขแถว ${r.time} ${r.title}`} className="tap self-start shrink-0 px-2 py-1 rounded-md text-[12.5px] text-sub hover:text-brand-ink hover:bg-paper border border-transparent hover:border-brand-mist">แก้ไข</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="text-[13px] text-sub">มื้ออาหาร: เช้า {plan.meals.b} · กลางวัน {plan.meals.l} · เย็น {plan.meals.d} · ว่าง {plan.meals.s}</div>
                  {!(plan.tpl && plan.tpl.exact) && <div className="text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">กิจกรรมจากคลัง 14 หลักสูตรมีสถานะ "รอตรวจ" — ทีมต้องยืนยันขั้นตอน/อุปกรณ์/เวลาก่อนจัดจริง</div>}
                </div>
              )}

              {tab === 'price' && (
                <div className="space-y-3">
                  <SectionTitle title="ราคาเสนอขาย & ต้นทุนภายใน" />
                  <div className="grid grid-cols-3 gap-2.5">
                    <Field label="ราคาปกติ /ท่าน"><input type="number" value={camp.normalPrice} onChange={e => set({ normalPrice: +e.target.value || 0 })} className={inp} /></Field>
                    <Field label="ราคาพิเศษ /ท่าน"><input type="number" value={camp.specialPrice} onChange={e => set({ specialPrice: +e.target.value || 0 })} className={inp} /></Field>
                    <Field label="ต้นทุน /ท่าน (ภายใน)"><input type="number" value={camp.costPerPerson} onChange={e => set({ costPerPerson: +e.target.value || 0 })} className={inp} /></Field>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <Stat label="ยอดขายรวม" value={money(total)} tone="sky" />
                    <Stat label="ต้นทุนรวม" value={money(cost)} tone="slate" />
                    <Stat label={`กำไร (${margin.toFixed(1)}%)`} value={money(profit)} tone={profit < 0 ? 'rose' : margin < 20 ? 'amber' : 'emerald'} />
                  </div>
                  <BudgetEditor items={camp.budgetItems && camp.budgetItems.length ? camp.budgetItems : null} auto={k.autoBudget}
                    normal={withAddonPrice(camp).normalPrice} special={withAddonPrice(camp).specialPrice} note={addonPriceNote(camp)}
                    onChange={items => set({ budgetItems: items })} />
                  <Field label="เงื่อนไขการชำระเงิน (ในใบเสนอราคา)"><input value={camp.payTerms} onChange={e => set({ payTerms: e.target.value })} className={inp} /></Field>
                  <div className="grid grid-cols-2 gap-2.5">
                    <Field label="ยืนราคา (วัน)"><input type="number" value={camp.validDays} onChange={e => set({ validDays: +e.target.value || 0 })} className={inp} /></Field>
                    <Field label="ผู้เสนอราคา"><input value={camp.contactName} onChange={e => set({ contactName: e.target.value })} className={inp} /></Field>
                  </div>
                  <Field label="บันทึกซัพพลายเออร์ (เฉพาะเอกสารภายใน)"><input value={camp.supplierNote} onChange={e => set({ supplierNote: e.target.value })} className={inp} /></Field>
                  <SmeMovePanel camp={camp} onChange={qc => set({ quoteCustomer: qc })} />
                </div>
              )}

              {tab === 'images' && (
                <div className="space-y-4">
                  <SectionTitle title="ภาพกิจกรรม & ภาพที่พัก" sub="ภาพกิจกรรมดึงจากไฟล์ PDF/Word โปรแกรมจริงของค่ายนี้เท่านั้น (6–8 รูป) · ภาพที่พักดึงให้เมื่อชื่อที่พักตรงกับโรงแรมในไฟล์ทีม · อัปโหลดแทนได้เฉพาะภาพของทีมเอง" />
                  <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={reloadPhotos} disabled={!wantAct && !wantVen}
                      className="px-3 py-1.5 rounded-lg bg-brand hover:bg-brand-navy disabled:bg-slate-200 disabled:text-slate-400 text-white text-[13px] font-semibold flex items-center gap-1">
                      <RefreshCw className="w-3.5 h-3.5" />ใช้ภาพจากไฟล์ของค่ายนี้
                    </button>
                    <span className="text-[12.5px] text-sub">
                      {!camp.courseCode ? 'ยังไม่ได้เลือกหลักสูตร — ไม่มีไฟล์ต้นฉบับให้ดึงภาพ'
                        : photoState === 'loading' ? 'กำลังโหลดภาพ…'
                        : photoState === 'offline' ? 'โหลดภาพไม่ได้ (ออฟไลน์/เปิดไฟล์ในเครื่อง) — เปิดผ่านลิงก์เว็บเพื่อให้ภาพขึ้น'
                        : plan.tpl ? `ภาพจากไฟล์ ${plan.tpl.source.replace('__', ' · ')}` : ''}
                    </span>
                  </div>
                  <PhotoSetPicker camp={camp} onPick={id => { setCamp(c => ({ ...c, photoSet: id, actImgs: [] })); setPhotoNonce(n => n + 1); flash('เปลี่ยนชุดภาพกิจกรรมทั้งชุดแล้ว'); }} />
                  <div className="border border-brand-mist rounded-xl p-3 bg-white">
                    <div className="text-[13.5px] font-semibold mb-1.5">ที่พัก — พิมพ์ชื่อเพื่อดึงภาพที่พักแยกหมวด</div>
                    <VenuePicker value={camp.venue} custom={customVenues} photoBase={PHOTO_BASE} onType={v => set({ venue: v })} onPick={pickVenue} />
                  </div>
                  {(['actImgs', 'venueImgs'] as const).map(group => (
                    <div key={group}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="text-[13.5px] font-semibold text-slate-700">{group === 'actImgs' ? 'ภาพกิจกรรม' : `ภาพที่พัก (${camp.venue.replace('โรงแรม', '') || 'ยังไม่เลือกที่พัก'}) · ป้าย/มุมสูง → ห้องพัก → สระ → ห้องประชุม`}</div>
                        <button onClick={() => addImage(group)} className="text-[13px] font-semibold text-brand flex items-center gap-1"><Plus className="w-3.5 h-3.5" />เพิ่มช่อง</button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {camp[group].map((im, i) => (
                          <div key={i} className="border border-slate-200 rounded-xl p-2 space-y-1.5">
                            <label className="block aspect-[8/5] rounded-lg bg-paper border border-dashed border-slate-300 overflow-hidden cursor-pointer grid place-items-center text-[12px] text-slate-400">
                              {im.data ? (im.src ? <img src={`${PHOTO_BASE}t_${im.src}.jpg`} className="w-full h-full object-cover" alt="" /> : <span className="text-emerald-600 font-semibold">✓ ฝังภาพของทีมแล้ว</span>) : 'คลิกเพื่ออัปโหลดภาพของทีม'}
                              <input type="file" accept="image/*" className="hidden" onChange={e => onImage(group, i, e.target.files?.[0])} />
                            </label>
                            <input value={im.caption} onChange={e => captionImage(group, i, e.target.value)} className="w-full px-2 py-1 rounded border border-slate-200 text-[12px]" placeholder="คำบรรยาย (ไม่ใส่ก็ได้)" />
                            <div className="flex items-center justify-between">
                              <span className="text-[11.5px] text-sub">{group === 'venueImgs' && venuePhotoCat(im.src) ? VENUE_PHOTO_LABEL[venuePhotoCat(im.src)!] : im.src ? 'จากไฟล์ของค่าย' : im.data ? 'อัปโหลดเอง' : ''}</span>
                              <button onClick={() => removeImage(group, i)} className="text-[12px] text-rose-500 flex items-center gap-0.5"><Trash2 className="w-3 h-3" />ลบ</button>
                            </div>
                          </div>
                        ))}
                        {!camp[group].length && <div className="col-span-2 text-[13px] text-slate-400 py-3 text-center">{group === 'actImgs' ? 'ยังไม่มีภาพกิจกรรม' : 'ไม่มีภาพที่พักของโรงแรมนี้ในไฟล์ทีม — เอกสารจะไม่มีหน้าภาพที่พัก (อัปโหลดภาพทางการของโรงแรมได้ด้วย "เพิ่มช่อง")'}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {tab === 'stats' && <StatsPanel useCap={useCap} saveText={saveText} onConnect={() => setConnectOpen(true)} onOpenJob={id => { const j = jobs.find(x => x.id === id); if (j) openJob(j); else { const t = teamJobs.find(x => x.id === id); if (t) openTeamJob(t); } }} />}

              {stepIdx >= 0 && (
                <div className="flex items-center justify-between gap-3 mt-6 pt-4 border-t border-brand-mist">
                  <button onClick={() => setTab(STEPS[stepIdx - 1].id)} disabled={stepIdx === 0}
                    className="tap px-4 py-2.5 rounded-xl text-[14px] font-medium text-brand-ink border border-brand-mist hover:bg-paper disabled:invisible">ย้อนกลับ</button>
                  <span className={`text-[13px] text-sub ${stepIdx === STEPS.length - 1 ? 'hidden sm:inline' : ''}`}>ขั้นที่ {stepIdx + 1} จาก {STEPS.length}</span>
                  {stepIdx < STEPS.length - 1
                    ? <button onClick={() => setTab(STEPS[stepIdx + 1].id)} className="tap px-5 py-2.5 rounded-xl text-[14px] font-semibold bg-brand-navy text-white hover:opacity-90">ถัดไป: {STEPS[stepIdx + 1].label}</button>
                    : <span className="flex flex-wrap justify-end gap-2">
                        <button onClick={printPDF} disabled={busy} className="tap px-4 py-2.5 rounded-xl text-[14px] font-semibold border border-brand-mist hover:bg-paper disabled:opacity-40">PDF</button>
                        <button onClick={() => download(kind)} disabled={busy} className="tap px-4 py-2.5 rounded-xl text-[14px] font-semibold border border-brand-mist hover:bg-paper disabled:opacity-40">Word</button>
                        <button onClick={() => setFinish(curJob?.done ? 'done' : 'confirm')} className="tap inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-[14px] font-semibold bg-accent text-white hover:bg-accent-deep"><CheckCircle2 className="w-4 h-4" />{curJob?.done ? 'เสร็จแล้ว' : 'เสร็จสิ้น'}</button>
                      </span>}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: preview + checklist */}
          <div className="lg:col-span-7 space-y-4">
            {/* ตรวจก่อนส่ง: โชว์เฉพาะข้อที่ต้องแก้ ข้อที่ผ่านแล้วพับไว้ */}
            <CheckPanel checks={checks as any} ready={ready} />

            <div className="bg-white rounded-2xl border border-brand-mist shadow-card overflow-hidden">
              <div className="bg-brand-navy text-white px-4 py-2.5 text-[13.5px] font-semibold flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" />พรีวิว: {DOC_TYPES.find(d => d.id === kind)!.label}</div>
              <div className="p-5 max-h-[70vh] overflow-y-auto font-doc doc-preview"><style>{FONT_FACE_CSS + ".doc-preview{font-family:'EQSarabun','TH Sarabun New',Sarabun,sans-serif;font-size:17px;line-height:1.3;color:#111}"}</style><Preview kind={kind} camp={withAddonPrice(camp)} plan={plan} k={k} total={total} cost={cost} profit={profit} margin={margin} /></div>
            </div>
            <button onClick={() => download(kind)} disabled={busy} className="w-full py-3 rounded-xl bg-accent enabled:hover:bg-accent-deep disabled:opacity-40 text-white font-semibold shadow-lift tap flex items-center justify-center gap-2">
              <Download className="w-5 h-5" />{busy ? 'กำลังสร้างไฟล์...' : `ดาวน์โหลด ${DOC_TYPES.find(d => d.id === kind)!.label} เป็นไฟล์ Word (.docx)`}
            </button>
            <button onClick={printPDF} disabled={busy} className="w-full py-3 rounded-xl border border-brand-mist bg-white enabled:hover:bg-paper disabled:opacity-40 font-semibold tap flex items-center justify-center gap-2 -mt-1">
              <FileText className="w-5 h-5" />บันทึกโปรแกรมค่ายเป็น PDF
            </button>
            <button onClick={downloadAll} disabled={busy} className="w-full py-3 rounded-xl border border-brand-mist bg-white enabled:hover:bg-paper disabled:opacity-40 font-semibold tap flex items-center justify-center gap-2 -mt-1">
              <Layers className="w-5 h-5" />ดาวน์โหลดครบชุด 4 ไฟล์ (Word)
            </button>
            {!ready && <div className="text-[13px] text-amber-700 text-center -mt-1">ยังมีข้อมูลไม่ครบ ดาวน์โหลดเป็นฉบับร่างได้ ควรเติมให้ครบก่อนส่งลูกค้า</div>}
          </div>
        </div>
        </>)}
      </div>
      )}
    </div>
  );
}

function CustomAdd({ onAdd }: { onAdd: (title: string, kind: Kind, desc: string) => void }) {
  const [title, setTitle] = useState(''); const [desc, setDesc] = useState(''); const [kind, setKind] = useState<Kind>('core');
  const kinds: { k: Kind; l: string }[] = [{ k: 'opening', l: 'เปิด' }, { k: 'core', l: 'หลัก' }, { k: 'night', l: 'ค่ำ' }, { k: 'recreation', l: 'สันทนาการ' }, { k: 'closing', l: 'ปิด' }];
  return (
    <div className="mt-2 p-3 rounded-xl border border-brand-mist bg-paper space-y-2">
      <div className="text-[13px] font-semibold text-brand-ink flex items-center gap-1"><Plus className="w-3.5 h-3.5" />เพิ่มกิจกรรมเอง (สั่งค่าแบบไหนก็ได้)</div>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="ชื่อกิจกรรม เช่น Escape Room คณิตศาสตร์" className="w-full px-2.5 py-1.5 rounded-lg border border-brand-mist text-[13.5px]" />
      <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="คำอธิบายย่อ (ไม่บังคับ)" className="w-full px-2.5 py-1.5 rounded-lg border border-brand-mist text-[13.5px]" />
      <div className="flex items-center gap-1.5">
        <div className="flex gap-1">
          {kinds.map(x => <button key={x.k} onClick={() => setKind(x.k)} className={`px-2 py-1 rounded-lg text-[12px] font-semibold border ${kind === x.k ? 'bg-brand text-white border-brand' : 'bg-white border-slate-300'}`}>{x.l}</button>)}
        </div>
        <button disabled={!title.trim()} onClick={() => { onAdd(title.trim(), kind, desc.trim()); setTitle(''); setDesc(''); }} className="ml-auto px-3 py-1.5 rounded-lg bg-emerald-600 enabled:hover:bg-emerald-500 disabled:opacity-40 text-white text-[13px] font-semibold">เพิ่มเข้าคลัง</button>
      </div>
    </div>
  );
}

function VenueAdd({ onAdd }: { onAdd: (v: VenueRec) => void }) {
  const [name, setName] = useState(''); const [province, setProvince] = useState(''); const [visit, setVisit] = useState(''); const [note, setNote] = useState('');
  return (
    <div className="mt-1 p-3 rounded-xl border border-brand-mist bg-paper space-y-2">
      <div className="text-[13px] font-semibold text-brand-ink flex items-center gap-1"><Plus className="w-3.5 h-3.5" />เพิ่มสถานที่/โรงแรมเองเข้าคลัง</div>
      <div className="grid grid-cols-2 gap-1.5">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="ชื่อโรงแรม" className="px-2.5 py-1.5 rounded-lg border border-brand-mist text-[13.5px]" />
        <input value={province} onChange={e => setProvince(e.target.value)} placeholder="จังหวัด" className="px-2.5 py-1.5 rounded-lg border border-brand-mist text-[13.5px]" />
      </div>
      <input value={visit} onChange={e => setVisit(e.target.value)} placeholder="แหล่งทัศนศึกษาใกล้เคียง (ไม่บังคับ)" className="w-full px-2.5 py-1.5 rounded-lg border border-brand-mist text-[13.5px]" />
      <div className="flex gap-1.5">
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="ผู้ติดต่อ/เรต (ภายใน)" className="flex-1 px-2.5 py-1.5 rounded-lg border border-brand-mist text-[13.5px]" />
        <button disabled={!name.trim()} onClick={() => { onAdd({ name: name.trim(), province: province.trim(), visit: visit.trim(), note: note.trim() }); setName(''); setProvince(''); setVisit(''); setNote(''); }} className="px-3 py-1.5 rounded-lg bg-emerald-600 enabled:hover:bg-emerald-500 disabled:opacity-40 text-white text-[13px] font-semibold whitespace-nowrap">เพิ่ม + ใช้เลย</button>
      </div>
    </div>
  );
}


const inp = 'w-full px-3 py-2.5 rounded-xl border border-brand-mist bg-white text-[15px] focus:outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15';
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[13.5px] font-medium text-brand-ink mb-1.5">{label}</label>{children}</div>;
}
// รายการงบประมาณ: แก้/เพิ่ม/ลบได้ทีละบรรทัด — เอกสารจะแสดงแบบ "-  รายการ" ไม่มีตาราง (ตามแบบทีม)
function BudgetEditor({ items, auto, normal, special, note, onChange }: { items: string[] | null; auto: string[]; normal: number; special: number; note?: string; onChange: (v: string[] | undefined) => void }) {
  const list = items ?? auto;
  const edit = (next: string[]) => onChange(next);
  return (
    <section className="rounded-xl border border-brand-mist p-4 space-y-3" aria-label="รายละเอียดงบประมาณ">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[15px] font-semibold">รายละเอียดงบประมาณ</h3>
        {items && <button onClick={() => onChange(undefined)} className="tap text-[13px] text-sub hover:text-brand-ink">ใช้รายการอัตโนมัติ</button>}
      </div>
      <p className="text-[14px] leading-relaxed">ราคาปกติ {money(normal)} <span className="text-[#FF0000]">ลดเหลือเพียง {money(special)} บ./ท่าน</span>{note ? <><br />{note}</> : null}<br />รายละเอียดงบประมาณมีดังนี้</p>
      <ol className="space-y-1.5">
        {list.map((x, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="w-4 text-sub text-center" aria-hidden>-</span>
            <label className="flex-1"><span className="sr-only">รายการที่ {i + 1}</span>
              <input value={x} onChange={e => { const n = [...list]; n[i] = e.target.value; edit(n); }}
                className="w-full px-3 py-2 rounded-lg border border-brand-mist text-[14.5px] focus:outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15" /></label>
            <button onClick={() => { const n = list.filter((_, j) => j !== i); edit(n.length ? n : ['']); }} aria-label={`ลบรายการที่ ${i + 1}`} className="tap p-1.5 rounded-md text-sub hover:text-rose-700 hover:bg-paper"><X className="w-4 h-4" /></button>
          </li>
        ))}
      </ol>
      <button onClick={() => edit([...list, ''])} className="tap inline-flex items-center gap-1.5 text-[13.5px] text-brand-navy font-medium"><Plus className="w-4 h-4" />เพิ่มรายการ</button>
      {!items && <p className="text-[12.5px] text-sub">ตอนนี้ใช้รายการที่ระบบคำนวณจากที่พัก มื้ออาหาร และทีมงาน — แก้ช่องไหนก็ได้ ระบบจะจำรายการที่แก้ไว้</p>}
    </section>
  );
}
function CheckPanel({ checks, ready }: { checks: { ok: boolean; soft?: boolean; msg: string }[]; ready: boolean }) {
  const [all, setAll] = useState(false);
  const todo = checks.filter(c => !c.ok); const done = checks.length - todo.length;
  const list = all ? checks : todo;
  return (
    <section className="rounded-xl border border-brand-mist bg-white p-4" aria-label="ตรวจก่อนส่ง">
      <div className="flex items-center justify-between gap-3">
        <h2 className={`flex items-center gap-2 text-[15px] font-semibold ${ready && !todo.length ? 'text-emerald-700' : 'text-brand-ink'}`}>
          {ready && !todo.length ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4 text-amber-600" />}
          {todo.length ? `ตรวจก่อนส่ง · เหลือ ${todo.length} เรื่อง` : 'ตรวจครบแล้ว พร้อมส่ง'}
        </h2>
        <button onClick={() => setAll(v => !v)} className="tap text-[13px] text-sub hover:text-brand-ink">{all ? 'ซ่อนข้อที่ผ่าน' : `ผ่านแล้ว ${done} ข้อ`}</button>
      </div>
      {list.length > 0 && (
        <ul className="mt-2.5 grid sm:grid-cols-2 gap-x-4 gap-y-1.5">
          {list.map((c, i) => (
            <li key={i} className={`text-[13.5px] flex items-start gap-2 ${c.ok ? 'text-sub' : 'text-brand-ink'}`}>
              <span className="shrink-0 mt-[3px]">{c.ok ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : c.soft ? <Info className="w-3.5 h-3.5 text-sub" /> : <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />}</span>{c.msg}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return <div className="pb-2.5 mb-3 border-b border-brand-mist"><h2 className="text-[17px] font-semibold text-brand-ink leading-snug tracking-tight">{title}</h2>{sub && <p className="text-[13.5px] text-sub mt-1 leading-relaxed">{sub}</p>}</div>;
}
function Stat({ label, value, tone }: { label: string; value: string; tone: 'sky' | 'slate' | 'emerald' | 'amber' | 'rose' }) {
  const c = { sky: 'bg-paper text-brand-ink', slate: 'bg-slate-50 text-slate-700', emerald: 'bg-emerald-50 text-emerald-800', amber: 'bg-amber-50 text-amber-800', rose: 'bg-rose-50 text-rose-800' }[tone];
  return <div className={`rounded-xl py-2 ${c}`}><div className="text-[12px] font-semibold opacity-70">{label}</div><div className="text-sm font-semibold">{value}</div></div>;
}

// ===== สถิติ/ประวัติการสร้างไฟล์ (อ่านจาก db capability) =====
type Ev = Record<string, any> & { id: string };
const DK_LABEL: Record<string, string> = { program: 'โปรแกรมค่าย', quotation: 'ใบเสนอราคา', booking: 'ขอราคาโรงแรม', runsheet: 'Run-down' };
/* ทะเบียนโปรแกรมที่สร้างจากระบบนี้ — รวม 3 แหล่ง (เครื่องนี้ · ชีตทีม · บัญชีทีม claude.ai) ตัดซ้ำ แล้วนับ "โปรแกรม" (งานเดียวกันโหลดหลายไฟล์ = 1)
 * ส่งออก CSV (เปิดใน Excel/Sheets) · สำรอง/นำเข้า JSON (รวมข้อมูลหลายเครื่อง) · ตั้งค่าชีตทีม (Apps Script) */
function StatsPanel({ useCap, saveText, onConnect, onOpenJob }: { useCap: (n: string) => Promise<any>; saveText: (f: string, t: string, m: string) => void; onConnect: () => void; onOpenJob: (id: string) => void }) {
  const [local, setLocal] = useState<LogEv[]>(() => loadLocal());
  const [team, setTeam] = useState<{ state: 'off' | 'loading' | 'ok' | 'err'; events: LogEv[]; msg?: string }>({ state: hubReady() ? 'loading' : 'off', events: [] });
  const [cloud, setCloud] = useState<LogEv[]>([]);
  const [tick, setTick] = useState(0);
  const [q, setQ] = useState('');
  // เรียลไทม์: มีคนสร้างไฟล์ที่เครื่องอื่น → รายการขึ้นเองภายใน ~5 วิ
  useEffect(() => onArea(['log'], () => setTick(t => t + 1)), []);
  useEffect(() => {
    let alive = true; setLocal(loadLocal());
    if (hubReady()) { readTeam().then(r => { if (alive) setTeam(prev => r.ok ? { state: 'ok', events: r.events } : prev.state === 'ok' ? prev : { state: 'err', events: [], msg: r.msg }); }); }
    (async () => {      // บัญชีทีม claude.ai (ของเดิม) — เฉพาะเมื่อเปิดบน claude.ai และมีสิทธิ์
      try { const db = await useCap('db'); if (!db || !alive) return;
        const snap = await db.collection('events').orderBy('ts', 'desc').limit(2000).get();
        if (alive) setCloud(snap.docs.map((d: any) => { const x = d.data() || {}; return { ...x, eid: x.eid || 'db-' + d.id, programId: x.programId || '', course: x.course || x.courseCode || x.subject || '', source: 'claude.ai' } as LogEv; }));
      } catch { /* ไม่มีสิทธิ์ db */ }
    })();
    return () => { alive = false; };
  }, [tick]);
  const all = useMemo(() => dedupe([...team.events, ...cloud, ...local]), [team.events, cloud, local]);
  const S = useMemo(() => summarize(all), [all]);
  const shown = useMemo(() => { const t = q.trim().toLowerCase(); return t ? S.programs.filter(p => [p.school, p.docCode, p.course, p.dayThemes, p.venue, p.province].join(' ').toLowerCase().includes(t)) : S.programs; }, [S, q]);
  const stamp = new Date().toISOString().slice(0, 10);
  const exportCsv = () => saveText(`EQ_Camp_ทะเบียนโปรแกรม_${stamp}.csv`, programsCsv(shown), 'text/csv');
  const backup = () => saveText(`EQ_Camp_ทะเบียน_สำรอง_${stamp}.json`, JSON.stringify({ _app: 'EQ Camp registry', _v: 1, events: all }, null, 1), 'application/json');
  const importJson = (f: File) => { const r = new FileReader(); r.onload = () => { try { const j = JSON.parse(String(r.result)); const ev: LogEv[] = Array.isArray(j) ? j : j.events; if (!Array.isArray(ev)) throw 0; saveLocal([...ev, ...loadLocal()]); setLocal(loadLocal()); } catch { alert('ไฟล์นี้ไม่ใช่ไฟล์สำรองทะเบียนของ EQ Camp'); } }; r.readAsText(f); };
  const maxM = Math.max(1, ...S.months.map(m => S.byMonth[m]));
  const topCourse = Object.entries(S.byCourse).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const src = [team.state === 'ok' ? `ชีตทีม ${team.events.length} รายการ` : '', cloud.length ? `claude.ai ${cloud.length}` : '', `เครื่องนี้ ${local.length}`].filter(Boolean).join(' · ');
  const Num = ({ n, l }: { n: string | number; l: string }) => <div className="rounded-xl py-4 px-2 bg-white border border-brand-mist text-center"><div className="text-[28px] font-semibold text-brand-navy leading-none tabular-nums">{n}</div><div className="text-[13px] text-sub mt-1.5">{l}</div></div>;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <SectionTitle title="ทะเบียนโปรแกรมที่สร้าง" sub={`บันทึกอัตโนมัติทุกครั้งที่สร้างไฟล์ · ข้อมูลจาก ${src}`} />
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setTick(t => t + 1)} aria-label="รีเฟรช" className="tap px-2.5 py-2 rounded-lg border border-brand-mist hover:bg-paper"><RefreshCw className={`w-4 h-4 ${team.state === 'loading' ? 'animate-spin' : ''}`} /></button>
          <button onClick={exportCsv} disabled={!shown.length} className="tap px-3 py-2 rounded-lg bg-brand-navy text-white text-[13.5px] font-medium disabled:opacity-40 flex items-center gap-1.5"><Download className="w-4 h-4" />Excel (CSV)</button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Num n={S.programs.length} l="โปรแกรม" />
        <Num n={S.schools} l="โรงเรียน" />
        <Num n={S.students.toLocaleString('en-US')} l="นักเรียนรวม" />
        <Num n={S.files} l={`ไฟล์ที่สร้าง (PDF ${S.pdf})`} />
      </div>
      {S.value > 0 && <div className="text-[13px] text-sub -mt-1">มูลค่าเสนอขายรวม (นักเรียน × ราคาพิเศษ) {money(S.value)} บาท</div>}

      {team.state !== 'ok' && (
        <div className="rounded-xl border border-brand-mist bg-white p-3.5 text-[13.5px] leading-relaxed">
          <div className="font-semibold">{team.state === 'off' ? 'ตอนนี้นับเฉพาะงานที่สร้างบนเครื่องนี้' : `ข้อมูลทีม: ${team.msg || 'กำลังโหลด…'}`}</div>
          <div className="text-sub mt-0.5">เชื่อมต่อทีมครั้งเดียว ทุกเครื่องนับรวมกันและเห็นรายการใหม่แบบเรียลไทม์ — หรือใช้ปุ่มสำรอง/นำเข้าไฟล์ด้านล่าง</div>
          <button onClick={onConnect} className="tap mt-2 px-3 py-1.5 rounded-lg border border-brand-mist hover:bg-paper font-medium">เชื่อมต่อทีม</button>
        </div>
      )}

      {S.months.length > 0 && (
        <div className="rounded-xl border border-brand-mist bg-white p-3.5">
          <div className="text-[13.5px] font-semibold mb-2">โปรแกรมใหม่ต่อเดือน</div>
          <div className="flex items-end gap-1.5 h-28">
            {S.months.slice(-12).map(m => (
              <div key={m} className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0" title={`${m}: ${S.byMonth[m]} โปรแกรม`}>
                <span className="text-[12px] text-brand-navy font-semibold tabular-nums">{S.byMonth[m]}</span>
                <div className="w-full rounded-t bg-brand-navy/80" style={{ height: `${Math.round((S.byMonth[m] / maxM) * 80)}px` }} />
                <span className="text-[11px] text-sub whitespace-nowrap">{thMonth(m)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {topCourse.length > 0 && (
        <div className="rounded-xl border border-brand-mist bg-white p-3.5">
          <div className="text-[13.5px] font-semibold mb-2">โปรแกรมตามหลักสูตร</div>
          <div className="space-y-1.5">
            {topCourse.map(([co, n]) => (
              <div key={co} className="flex items-center gap-2 text-[13px]"><span className="w-36 shrink-0 truncate" title={co}>{co}</span>
                <div className="flex-1 h-2.5 rounded bg-paper overflow-hidden"><div className="h-full bg-brand-navy/70" style={{ width: `${Math.round((n / topCourse[0][1]) * 100)}%` }} /></div>
                <span className="w-8 text-right font-semibold tabular-nums">{n}</span></div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-brand-mist bg-white overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 border-b border-brand-mist">
          <div className="text-[13.5px] font-semibold">รายการโปรแกรม ({shown.length})</div>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหาโรงเรียน / รหัส / หลักสูตร / จังหวัด" aria-label="ค้นหาโปรแกรม" className="w-full sm:w-72 border border-brand-mist rounded-lg px-3 py-1.5 text-[13.5px]" />
        </div>
        <div className="max-h-[28rem] overflow-y-auto divide-y divide-brand-mist">
          {shown.slice(0, 300).map(p => (
            <div key={p.programId} className="px-3.5 py-2.5 text-[13.5px]">
              {p.jobId && <button onClick={() => onOpenJob(p.jobId!)} className="tap float-right ml-2 px-2.5 py-1 rounded-lg border border-brand-mist text-[12.5px] hover:bg-paper">เปิดงาน</button>}
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="font-semibold min-w-0">{p.school || 'ไม่ระบุโรงเรียน'}</span>
                <span className="text-[12.5px] text-sub tabular-nums">{p.last.slice(0, 10)}</span>
              </div>
              <div className="text-sub text-[13px] mt-0.5">{[p.docCode, p.course, p.dur, p.dates, p.venue].filter(Boolean).join(' · ')}</div>
              {(p.dayThemes || p.addons) && <div className="text-sub text-[12.5px]">{[p.dayThemes, p.addons && 'เสริม ' + p.addons].filter(Boolean).join(' · ')}</div>}
              <div className="text-[12.5px] mt-0.5"><span className="tabular-nums">{p.students} คน · {p.specialPrice ? money(p.specialPrice) + ' บ./ท่าน' : 'ไม่มีราคา'}</span><span className="text-sub"> · ไฟล์ {p.files}{p.pdf ? ` (PDF ${p.pdf})` : ''}{p.by.length ? ' · ' + p.by.join(', ') : ''}</span></div>
            </div>
          ))}
          {!shown.length && <div className="px-3.5 py-8 text-center text-sub text-[13.5px]">{S.programs.length ? 'ไม่พบตามคำค้น' : 'ยังไม่มีโปรแกรม — เมื่อสร้างไฟล์ Word/PDF รายการจะขึ้นที่นี่อัตโนมัติ'}</div>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <button onClick={backup} disabled={!all.length} className="tap px-3 py-1.5 rounded-lg border border-brand-mist hover:bg-paper disabled:opacity-40">สำรองทะเบียน (JSON)</button>
        <label className="tap px-3 py-1.5 rounded-lg border border-brand-mist hover:bg-paper cursor-pointer">นำเข้าจากเครื่องอื่น<input type="file" accept=".json,application/json" className="hidden" onChange={e => { const f = e.target.files && e.target.files[0]; if (f) importJson(f); e.target.value = ''; }} /></label>
        <span className="text-sub">นับ 1 โปรแกรมต่อ รหัสเอกสาร + โรงเรียน + วันที่ + หลักสูตร (โหลดซ้ำไม่นับเพิ่ม)</span>
      </div>
    </div>
  );
}
const TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const thMonth = (ym: string) => { const [y, m] = ym.split('-').map(Number); return m ? `${TH_M[m - 1]}${String((y + 543) % 100).padStart(2, '0')}` : ym; };
function Preview({ kind, camp, plan, k, total, cost, profit, margin }: any) {
  const c: Camp = camp;
  if (kind === 'program') return (
    <div>
      <div className="text-right">{c.docCode}</div>
      <div className="text-center font-bold text-[20px]">{k.titleTh}</div>
      {k.titleEn && <div className="text-center font-bold text-[20px] mb-2">{k.titleEn}</div>}
      {(k.cover as CoverSec[]).map((sec, i) => sec.k === 'info'
        ? <table key={i} className="w-full my-1"><tbody>{(sec.rows || []).map(([lab, v]) => <tr key={lab}><td className="font-bold align-top w-36">{lab}</td><td>{v.map((x, j) => <div key={j}>{x}</div>)}</td></tr>)}</tbody></table>
        : <div key={i}>{sec.h && <H>{sec.h}</H>}{sec.k === 'list' ? <OL items={sec.items || []} /> : (sec.items || []).map((x, j) => <p key={j} className={sec.k === 'para' ? 'indent-8 my-0.5' : 'pl-6 my-0'}>{x}</p>)}</div>)}
      <div className="my-3 border-t pt-2 text-center font-extrabold text-sky-900">กำหนดการ</div>
      <Sched plan={plan} />
      <div className="mt-4 pt-3 border-t">ราคาปกติ {money(c.normalPrice)} <span className="text-[#FF0000]">ลดเหลือเพียง {money(c.specialPrice)} บ./ท่าน</span>{addonPriceNote(c) && <div>{addonPriceNote(c)}</div>}</div>
      <div>รายละเอียดงบประมาณมีดังนี้</div>
      {k.budget.map((b: string, i: number) => <div key={i} className="flex"><span className="w-8 shrink-0 pl-1">-</span><span>{b}</span></div>)}
      <PreviewPhotos title="ตัวอย่างภาพกิจกรรม" imgs={c.actImgs} />
      {c.venueImgs.some(im => im.data) && <PreviewPhotos title={`ตัวอย่างภาพบรรยากาศที่พัก ${c.venue || ''}`} imgs={c.venueImgs} />}
    </div>
  );
  if (kind === 'quotation') return (
    <div>
      <div className="text-right font-bold text-sky-800">QT {c.docCode.replace(/^PL\s*/, '')}</div>
      <div className="text-center font-extrabold text-lg">ใบเสนอราคา</div><div className="text-center font-bold text-sky-600 mb-3">QUOTATION</div>
      <div className="mb-2"><b className="text-sky-800">เรียน</b> ผู้อำนวยการ{c.school}<br /><b className="text-sky-800">เรื่อง</b> เสนอราคา{k.titleTh.replace('หลักสูตร ', '')}</div>
      <table className="w-full border-collapse text-[12px] my-2"><tbody>
        <tr className="bg-brand-navy text-white"><th className="border p-1">ลำดับ</th><th className="border p-1">รายการ</th><th className="border p-1">จำนวน</th><th className="border p-1">ราคา/ท่าน</th><th className="border p-1">รวม</th></tr>
        <tr><td className="border p-1 text-center">1</td><td className="border p-1"><b>{k.titleTh}</b><br /><span className="text-[11px] text-sub">{k.dur} · {c.dates}</span></td><td className="border p-1 text-center">{c.students}</td><td className="border p-1 text-right">{money(c.specialPrice)}</td><td className="border p-1 text-right">{money(total)}</td></tr>
        <tr className="bg-sky-50 font-bold"><td className="border p-1 text-right" colSpan={4}>ยอดรวมสุทธิ</td><td className="border p-1 text-right">{money(total)}</td></tr>
      </tbody></table>
      <div className="text-emerald-700 font-bold">ประหยัด {money(c.normalPrice - c.specialPrice)} บ./ท่าน</div>
      <H>รายละเอียดที่รวมอยู่ในราคา</H>{k.budget.map((b: string, i: number) => <div key={i} className="pl-3">- {b}</div>)}
      <H>เงื่อนไข</H><OL items={[`ยืนราคาภายใน ${c.validDays} วัน`, c.payTerms, 'กำหนดการอาจเปลี่ยนแปลงตามความเหมาะสม']} />
    </div>
  );
  if (kind === 'booking') {
    const m = plan.meals;
    return (
      <div>
        <div className="text-right font-bold text-sky-800">BK {c.docCode.replace(/^PL\s*/, '')}</div>
        <div className="text-center font-extrabold text-lg mb-3">หนังสือขอใบเสนอราคาและยืนยันห้องพัก/ห้องประชุม</div>
        <div><b>เรียน</b> ฝ่ายขาย/ฝ่ายจัดเลี้ยง {c.venue}</div>
        <p className="my-2">ด้วยบริษัท อีคิวแคมป์ ขอจัด{k.titleTh.replace('หลักสูตร ', '')} ให้แก่{c.school} รายละเอียดดังนี้</p>
        <div className="pl-2 text-[12px]">วันที่เข้าพัก: {c.dates}<br />ระยะเวลา: {k.dur}<br />ผู้เข้าพัก: นักเรียน {c.students} ครู {c.teachers} วิทยากร {k.staff} คน</div>
        <H>รายการที่ขอเสนอราคา</H>
        <OL items={[c.nights > 0 ? `ห้องพัก ${c.nights} คืน` : 'ไม่ต้องการห้องพัก (ไป-กลับ)', `อาหารหลัก ${m.b + m.l + m.d} มื้อ (เช้า ${m.b} กลางวัน ${m.l} เย็น ${m.d})`, `อาหารว่าง ${m.s} มื้อ`, 'ห้องประชุมพร้อมเครื่องเสียง โปรเจกเตอร์', 'ห้องพักวิทยากร + พื้นที่เก็บอุปกรณ์']} />
        <div className="text-[11px] text-sub mt-2">ไม่แสดงราคาขาย/ต้นทุนในเอกสารฉบับนี้</div>
      </div>
    );
  }
  return (
    <div>
      <div className="text-center font-bold text-amber-700">[เอกสารภายใน EQ CAMP — ห้ามส่งลูกค้า]</div>
      <div className="text-right font-bold text-sky-800">RD {c.docCode.replace(/^PL\s*/, '')}</div>
      <div className="my-2 bg-amber-50 border-2 border-amber-400 rounded-lg p-3 text-[12px]">
        ต้นทุน {money(c.costPerPerson)} × {c.students} = {money(cost)} บาท<br />
        ราคาขาย {money(c.specialPrice)} × {c.students} = {money(total)} บาท<br />
        <b className={profit < 0 ? 'text-rose-600' : 'text-emerald-700'}>กำไรประเมิน {money(profit)} บาท (Margin {margin.toFixed(1)}%){margin < 20 ? ' ⚠ ต่ำกว่า 20%' : ''}</b>
      </div>
      <div className="text-center font-extrabold text-sky-900 mb-1">กำหนดการ (มีช่องผู้รับผิดชอบ)</div>
      <Sched plan={plan} extra />
      <H>เช็คลิสต์อุปกรณ์กิจกรรม (มาตรฐานจาก Notion)</H>
      {(() => { const acts = notionActsInPlan(plan); if (!acts.length) return <div className="text-[13px] text-gray-500">กิจกรรมในกำหนดการนี้ยังไม่มีหน้ามาตรฐานใน Notion</div>;
        return acts.map(({ a, when }) => { const st = actStandard(a); return (
          <div key={a.id} className="mt-1">
            <div><b>{a.name}</b> <span className="text-gray-500 text-[13px]">· {st.level} ({st.score}/4) · {when.join(', ')}</span></div>
            {a.perGroup.length > 0 && <div className="text-[14px]"><u>อุปกรณ์ต่อกลุ่ม</u>: {a.perGroup.map(e => e.name + (e.qty ? ' ' + e.qty : '')).join(' · ')}</div>}
            {a.shared.length > 0 && <div className="text-[14px]"><u>อุปกรณ์ส่วนกลาง</u>: {a.shared.map(e => e.name + (e.qty ? ' ' + e.qty : '')).join(' · ')}</div>}
            {!a.perGroup.length && !a.shared.length && <div className="text-[13px] text-amber-700">ยังไม่มีเช็คลิสต์อุปกรณ์ใน Notion</div>}
          </div>); }); })()}
    </div>
  );
}
const H = ({ children }: { children: React.ReactNode }) => <div className="font-bold mt-1.5">{children}</div>;
// หน้าภาพในพรีวิว = ภาพชุดเดียวกับที่ฝังลงไฟล์ (ไม่มีข้อความใต้ภาพ เว้นแต่ทีมพิมพ์เอง)
function PreviewPhotos({ title, imgs }: { title: string; imgs: Img[] }) {
  const list = imgs.filter(im => im.data).slice(0, 8);
  const urls = useMemo(() => list.map(im => (im.src ? `${PHOTO_BASE}t_${im.src}.jpg` : URL.createObjectURL(new Blob([im.data!], { type: im.data![0] === 0x89 ? 'image/png' : 'image/jpeg' })))), [list.map(im => im.src || im.data!.length).join(',')]);
  useEffect(() => () => urls.forEach(u => { if (u.startsWith('blob:')) URL.revokeObjectURL(u); }), [urls]);
  if (!list.length) return <div className="mt-4 pt-3 border-t text-center text-[14px] text-sub">ยังไม่มีภาพ — เอกสารจะไม่มีหน้าภาพ</div>;
  return (
    <div className="mt-4 pt-3 border-t">
      <div className="text-center font-bold mb-2">{title}</div>
      <div className="grid grid-cols-2 gap-2">{list.map((im, i) => (
        <figure key={i} className="m-0"><img src={urls[i]} alt="" loading="lazy" className="w-full aspect-[4/3] object-cover rounded" />{realCaption(im.caption) && <figcaption className="text-center text-[14px] text-sub">{im.caption}</figcaption>}</figure>))}</div>
    </div>
  );
}
const OL = ({ items }: { items: string[] }) => <div>{items.map((x, i) => <div key={i} className="pl-4 -indent-4 ml-4">{i + 1}. {x}</div>)}</div>;
function Sched({ plan, extra }: { plan: any; extra?: boolean }) {
  return <div className="space-y-2">{plan.days.map((d: any) => (
    <div key={d.day}>
      <div className="bg-brand text-white text-[12px] font-semibold px-2 py-1">วันที่ {d.day}</div>
      {d.items.map((r: any, i: number) => (
        <div key={i} className="flex gap-2 text-[11px] border-b border-slate-100 py-1">
          <span className="font-bold text-sub w-24 shrink-0">{r.time}</span>
          <span className="flex-1">{r.title}{r.sub?.map((s: string, j: number) => <span key={j} className="block text-slate-400">{s}</span>)}</span>
          {extra && <span className="w-20 border-l border-slate-200 text-slate-300 text-[10px] pl-1">ผู้รับผิดชอบ</span>}
        </div>
      ))}
    </div>
  ))}</div>;
}

/* แผ่นบันทึกไฟล์บนมือถือ — ปุ่มทุกปุ่มทำงานจากการแตะของผู้ใช้โดยตรง (iOS/Android บล็อกการดาวน์โหลด/แชร์ที่ไม่ได้มาจากการแตะ)
 * 1) บันทึก / ส่งต่อ = เมนูแชร์ของเครื่อง (iPhone: "บันทึกไปยังไฟล์", LINE, Mail · Android: Drive, LINE, ไฟล์)
 * 2) ดาวน์โหลด = ลงโฟลเดอร์ดาวน์โหลด  3) เปิดดู = เปิดไฟล์ในแท็บใหม่ แล้วกดแชร์/บันทึกจากตัวดูไฟล์ */
function SaveSheet({ sheet, onClose, download }: { sheet: { files: { blob: Blob; name: string }[]; title: string }; onClose: () => void; download: (b: Blob, n: string) => void }) {
  const files = useMemo(() => sheet.files.map(f => { try { return new File([f.blob], f.name, { type: f.blob.type || (f.name.endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') }); } catch { return null; } }).filter(Boolean) as File[], [sheet]);
  const canShare = files.length === sheet.files.length && canShareFiles(files);
  const [msg, setMsg] = useState('');
  const size = (b: Blob) => b.size > 1048576 ? `${(b.size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b.size / 1024))} KB`;
  const share = async () => {
    try { await (navigator as any).share({ files, title: sheet.title }); setMsg('ส่งไฟล์แล้ว'); }
    catch (e: any) { if (e?.name !== 'AbortError') setMsg('แชร์ไม่ได้ในเบราว์เซอร์นี้ — ใช้ปุ่ม "ดาวน์โหลด" หรือ "เปิดดู" แทน'); }
  };
  const open = (b: Blob) => { const u = URL.createObjectURL(b); const w = window.open(u, '_blank'); if (!w) location.href = u; setTimeout(() => URL.revokeObjectURL(u), 60000); };
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 bg-black/35 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label="บันทึกไฟล์" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-lift" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[17px] font-semibold">ไฟล์พร้อมแล้ว</div>
            <div className="text-[13.5px] text-sub mt-0.5">{sheet.title}</div>
          </div>
          <button onClick={onClose} aria-label="ปิด" className="tap p-1.5 -mr-1.5 rounded-lg text-sub"><X className="w-5 h-5" /></button>
        </div>
        <ul className="mt-3 space-y-1.5">
          {sheet.files.map(f => (
            <li key={f.name} className="flex items-center gap-2 text-[13.5px] bg-paper rounded-lg px-3 py-2">
              <FileText className="w-4 h-4 text-sub shrink-0" /><span className="min-w-0 flex-1 truncate">{f.name}</span><span className="text-sub shrink-0">{size(f.blob)}</span>
              {sheet.files.length > 1 && <button onClick={() => download(f.blob, f.name)} className="tap shrink-0 text-brand-navy underline underline-offset-2 px-1">โหลด</button>}
            </li>
          ))}
        </ul>
        <div className="mt-4 grid gap-2">
          {canShare && <button onClick={share} className="tap w-full py-3 rounded-xl bg-accent hover:bg-accent-deep text-white font-semibold">บันทึก / ส่งต่อไฟล์</button>}
          <button onClick={() => { sheet.files.forEach((f, i) => setTimeout(() => download(f.blob, f.name), i * 500)); setMsg(IS_IOS ? 'ถ้าเปิดเป็นหน้าตัวอย่าง ให้กดปุ่มแชร์ แล้วเลือก "บันทึกไปยังไฟล์"' : 'ดูไฟล์ได้ในโฟลเดอร์ "ดาวน์โหลด"'); }}
            className={`tap w-full py-3 rounded-xl font-semibold ${canShare ? 'border border-brand-mist' : 'bg-accent hover:bg-accent-deep text-white'}`}>{sheet.files.length > 1 ? `ดาวน์โหลดทั้ง ${sheet.files.length} ไฟล์` : 'ดาวน์โหลด'}</button>
          {sheet.files.length === 1 && <button onClick={() => open(sheet.files[0].blob)} className="tap w-full py-3 rounded-xl border border-brand-mist font-semibold">เปิดดูไฟล์</button>}
        </div>
        {msg && <div className="text-[13px] text-sub mt-3" role="status">{msg}</div>}
        {IN_APP && <div className="text-[13px] text-amber-800 bg-amber-50 rounded-lg px-3 py-2 mt-3">เปิดจาก {IN_APP} อาจบันทึกไฟล์ไม่ได้ — ใช้ "บันทึก / ส่งต่อไฟล์" หรือเปิดหน้านี้ในเบราว์เซอร์ (Safari/Chrome)</div>}
        {IS_IOS && canShare && <div className="text-[12.5px] text-sub mt-3">iPhone/iPad: กด "บันทึก / ส่งต่อไฟล์" → "บันทึกไปยังไฟล์" หรือเลือก LINE/Mail เพื่อส่งต่อ</div>}
      </div>
    </div>
  );
}

/* กิจกรรมเสริม (Add-on): ค่ายหลัก + อังกฤษ/จีน/คณิต — ระบบแทรกลงกำหนดการให้เอง (core: applyAddons)
 * เลือกวิชา → (ไม่บังคับ) เลือกกิจกรรม/ความยาว/ราคาเพิ่มต่อท่าน — ทุกค่าแก้ได้ เอกสารทั้ง 4 ชิ้นอัปเดตทันที */
/* ยกทั้งชุด: เลือกชุดภาพกิจกรรม 1 คลิก → แทนภาพทั้งหมดในเอกสาร (ภาพที่ทีมอัปโหลดเองจะถูกแทนด้วย) */
function PhotoSetPicker({ camp, onPick }: { camp: Camp; onPick: (id: string) => void }) {
  const sets = photoSetsFor(camp.courseCode);
  if (!sets.length) return null;
  const cur = photoIdsFor(camp).join(',');
  return (
    <div className="bg-white border border-brand-mist rounded-xl p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-[15.5px] font-semibold">ชุดภาพกิจกรรม (ยกทั้งชุด)</div>
        <div className="text-[13px] text-sub">แตะชุดเพื่อใช้ทั้งชุดในเอกสาร · ภาพครอป 4:3 เท่ากันทุกใบ</div>
      </div>
      <div className="grid gap-3 mt-3 sm:grid-cols-2" role="radiogroup" aria-label="ชุดภาพกิจกรรม">
        {sets.map(st => { const on = st.ids.slice(0, 8).join(',') === cur; return (
          <button key={st.id} role="radio" aria-checked={on} onClick={() => !on && onPick(st.id)}
            className={`tap text-left rounded-xl border p-2.5 ${on ? 'border-brand-navy ring-2 ring-brand-navy/20' : 'border-brand-mist hover:bg-paper'}`}>
            <div className="grid grid-cols-4 gap-1">
              {st.ids.slice(0, 4).map(id => <img key={id} src={`${PHOTO_BASE}t_${id}.jpg`} alt="" className="w-full aspect-[4/3] object-cover rounded" loading="lazy" />)}
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[14px] font-semibold truncate">{st.label}{st.fresh ? ' · ใหม่' : ''}</div>
                <div className="text-[12.5px] text-sub truncate">{st.source.replace('__', ' · ')} · {Math.min(8, st.ids.length)} รูป</div>
              </div>
              <span className={`text-[12.5px] font-semibold shrink-0 ${on ? 'text-brand-navy' : 'text-sub'}`}>{on ? '✓ ใช้อยู่' : 'ใช้ชุดนี้'}</span>
            </div>
          </button>); })}
      </div>
    </div>);
}
/* ชื่อค่ายรวมวิชา — โชว์ผลจริงที่จะลงเอกสาร (ชื่อไทย "…และภาษาอังกฤษ" + อังกฤษ "… & English Camp") */
function JoinedTitle({ camp, plan }: { camp: Camp; plan: ReturnType<typeof buildSchedule> }) {
  const k = compose(camp, plan) as ReturnType<typeof compose> & { joined?: string[] };
  if (!k.joined || !k.joined.length) return null;
  return (
    <div className="mt-3 text-[13.5px] bg-paper rounded-lg px-3 py-2">
      <span className="text-sub">ชื่อค่ายในเอกสาร</span>
      <div className="font-semibold text-brand-ink">{k.titleTh}</div>
      {k.titleEn && <div className="text-brand-ink">{k.titleEn}</div>}
    </div>);
}
function AddonPanel({ camp, plan, set }: { camp: Camp; plan: ReturnType<typeof buildSchedule>; set: (p: Partial<Camp>) => void }) {
  const list = camp.addons || [];
  const opts = ADDON_COURSES.filter(a => a.code !== camp.courseCode);
  const get = (code: string) => list.find(x => x.code === code);
  const upd = (code: string, patch: Partial<AddonSel> | null) => {
    const rest = list.filter(x => x.code !== code);
    set({ addons: patch === null ? rest : [...rest, { ...(get(code) || { code }), ...patch }].sort((a, b) => opts.findIndex(o => o.code === a.code) - opts.findIndex(o => o.code === b.code)) });
  };
  const planOf = (code: string) => (plan.addons || []).find(a => a.code === code);
  return (
    <div className="bg-white border border-brand-mist rounded-xl p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-[15.5px] font-semibold">กิจกรรมเสริม (Add-on)</div>
        <div className="text-[13px] text-sub">เพิ่มวิชาอื่นเข้าค่ายนี้ ระบบแทรกลงกำหนดการและเติมชื่อค่ายให้</div>
      </div>
      <JoinedTitle camp={camp} plan={plan} />
      <div className="flex flex-wrap gap-2 mt-3" role="group" aria-label="เลือกกิจกรรมเสริม">
        {opts.map(o => { const on = !!get(o.code); return (
          <button key={o.code} onClick={() => upd(o.code, on ? null : {})} aria-pressed={on}
            className={`tap px-4 py-2 rounded-xl text-[14px] border font-medium ${on ? 'bg-brand-navy text-white border-brand-navy' : 'border-brand-mist hover:bg-paper'}`}>
            {on ? '✓ ' : '+ '}{o.label}
          </button>); })}
      </div>
      {opts.filter(o => get(o.code)).map(o => {
        const sel = get(o.code)!; const pool = addonActivities(o.code); const pa = planOf(o.code);
        const ids = sel.ids && sel.ids.length ? sel.ids : [];
        const toggle = (id: string) => { const cur = ids.length ? ids : pool.filter(a => (pa?.titles || []).includes(addonRowTitle(o.code, a))).map(a => a.id); upd(o.code, { ids: cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id] }); };
        const isOn = (a: typeof pool[number]) => ids.length ? ids.includes(a.id) : (pa?.titles || []).includes(addonRowTitle(o.code, a));
        return (
          <div key={o.code} className="mt-4 border-t border-brand-mist pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[14.5px] font-semibold">{o.label} <span className="text-sub font-normal text-[13px]">· {o.code} · ลงกำหนดการ {pa?.titles.length || 0} ช่วง</span></div>
              <div className="flex flex-wrap items-center gap-2 text-[13.5px]">
                <label className="flex items-center gap-1.5">ช่วงละ
                  <select value={sel.minutes || 60} onChange={e => upd(o.code, { minutes: +e.target.value })} className="border border-brand-mist rounded-lg px-2 py-1.5 bg-white">
                    {[45, 60, 90, 120].map(m => <option key={m} value={m}>{m} นาที</option>)}
                  </select></label>
                <label className="flex items-center gap-1.5">ราคาเพิ่ม
                  <input type="number" inputMode="numeric" min={0} step={50} value={sel.price || ''} placeholder="0" onChange={e => upd(o.code, { price: Math.max(0, Number(e.target.value) || 0) })}
                    className="w-24 border border-brand-mist rounded-lg px-2 py-1.5 text-right" aria-label={`ราคาเพิ่มต่อท่าน ${o.label}`} />บ./ท่าน</label>
              </div>
            </div>
            <div className="text-[12.5px] text-sub mt-1">{ids.length ? 'เลือกเอง — 1 กิจกรรม = 1 ช่วง' : 'อัตโนมัติ — แตะกิจกรรมเพื่อเลือกเอง'} · ราคาเพิ่ม 0 = รวมในราคาเดิม{ids.length ? <> · <button className="underline" onClick={() => upd(o.code, { ids: [] })}>กลับเป็นอัตโนมัติ</button></> : null}</div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {pool.map(a => { const on = isOn(a); return (
                <button key={a.id} onClick={() => toggle(a.id)} aria-pressed={on}
                  className={`tap text-[13px] px-2.5 py-1.5 rounded-lg border text-left ${on ? 'border-brand-navy bg-paper text-brand-ink font-medium' : 'border-brand-mist text-sub hover:bg-paper'}`}>
                  {addonRowTitle(o.code, a).replace(/^กิจกรรมเสริม\S*\s*/, '')}
                </button>); })}
            </div>
          </div>
        );
      })}
      {(plan.addonWarn || []).map(w => <div key={w} className="text-[13px] text-amber-800 bg-amber-50 rounded-lg px-3 py-2 mt-3">{w}</div>)}
    </div>
  );
}

/* ธีมรายวัน (mix หลักสูตร): เลือกหลักสูตรของแต่ละวัน — วันนั้นใช้กำหนดการวันเดียวกันของหลักสูตรที่เลือก (แม่แบบจริงของทีม) */
function DayMixPanel({ camp, plan, set }: { camp: Camp; plan: ReturnType<typeof buildSchedule>; set: (p: Partial<Camp>) => void }) {
  if (!camp.courseCode) return null;
  const n = camp.durationMode === 'half' ? 1 : Math.max(1, camp.days || 1);
  if (n < 2) return null;
  const cur = Array.from({ length: n }, (_, i) => (camp.dayCourses || [])[i] || '');
  const upd = (i: number, code: string) => { const next = [...cur]; next[i] = code === camp.courseCode ? '' : code; set({ dayCourses: next.some(Boolean) ? next : undefined }); };
  const mixed = cur.some(x => x && x !== camp.courseCode);
  return (
    <div className="bg-white border border-brand-mist rounded-xl p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-[15.5px] font-semibold">ธีมรายวัน (Mix หลักสูตร)</div>
        {mixed && <button onClick={() => set({ dayCourses: undefined })} className="tap text-[13px] underline text-sub">ใช้หลักสูตรหลักทุกวัน</button>}
      </div>
      <div className="text-[13px] text-sub mt-0.5">เช่น วันที่ 1 ภาษาอังกฤษ · วันที่ 2 วิทยาศาสตร์ทางทะเล — วันที่เลือกจะใช้กำหนดการของหลักสูตรนั้น</div>
      <JoinedTitle camp={camp} plan={plan} />
      <div className="grid gap-2 mt-3 sm:grid-cols-2">
        {cur.map((x, i) => {
          const m = (plan.mix || []).find(z => z.day === i + 1);
          return (
            <label key={i} className="block">
              <span className="text-[13px] font-medium">วันที่ {i + 1}</span>
              <select value={x || camp.courseCode} onChange={e => upd(i, e.target.value)} className="mt-1 w-full border border-brand-mist rounded-lg px-3 py-2.5 bg-white text-[14.5px]">
                {COURSES.map(co => <option key={co.code} value={co.code}>{courseLabel(co.code)}{co.code === camp.courseCode ? ' (หลักสูตรหลัก)' : ''} · {co.code}</option>)}
              </select>
              {m && mixed && <span className="text-[12px] text-sub">ที่มา: {m.source.replace(/__/, ' · ')}</span>}
            </label>
          );
        })}
      </div>
    </div>
  );
}

/* กิจกรรมเชิงบูรณาการ (หน้าปก) — อัตโนมัติ = ตรงกับกำหนดการเท่านั้น · ทีมแก้เองได้ (เพิ่มจากกำหนดการ/แก้ถ้อยคำ/ลบ/เลื่อนลำดับ)
 * ทุกข้อมีป้าย "ตรงกำหนดการ" / "ไม่พบในกำหนดการ" ให้เห็นทันที */
function ActsEditor({ camp, plan, acts, set }: { camp: Camp; plan: ReturnType<typeof buildSchedule>; acts: string[]; set: (p: Partial<Camp>) => void }) {
  const own = camp.actsOverride && camp.actsOverride.length ? camp.actsOverride : null;
  const list = own ?? acts;
  const edit = (next: string[]) => set({ actsOverride: next });
  const sched = scheduleActs(plan);
  const options = sched.filter(a => !list.some(l => l === a.name));
  const [adding, setAdding] = useState('');
  const move = (i: number, d: number) => { const n = [...list]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; edit(n); };
  const bad = list.filter(x => x.trim() && !actInSchedule(x, plan)).length;
  return (
    <div className="bg-white border border-brand-mist rounded-xl p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-[15.5px] font-semibold">กิจกรรมเชิงบูรณาการ (หน้าปก)</div>
        <div className="text-[13px] text-sub">{own ? 'แก้เอง' : 'อัตโนมัติ — ดึงจากกำหนดการ'}{own && <> · <button onClick={() => set({ actsOverride: undefined })} className="tap underline">กลับเป็นอัตโนมัติ</button></>}</div>
      </div>
      <div className="text-[13px] text-sub mt-0.5">ทุกข้อต้องมีอยู่ในกำหนดการ — แก้ชื่อกิจกรรมในขั้น "กำหนดการ" แล้วหน้าปกเปลี่ยนตามเอง</div>
      <ol className="mt-3 space-y-1.5">
        {list.map((x, i) => { const ok = actInSchedule(x, plan); return (
          <li key={i} className="flex items-start gap-2">
            <span className="text-sub text-[13px] w-5 pt-2.5 text-right shrink-0">{i + 1}.</span>
            {own
              ? <input value={x} onChange={e => edit(list.map((y, j) => j === i ? e.target.value : y))} aria-label={`กิจกรรมข้อ ${i + 1}`} className="flex-1 min-w-0 border border-brand-mist rounded-lg px-3 py-2 text-[14px]" />
              : <span className="flex-1 min-w-0 text-[14px] py-2 leading-snug">{x}</span>}
            <span className={`shrink-0 mt-2 text-[11.5px] px-1.5 py-0.5 rounded-md ${ok ? 'bg-paper text-sub border border-brand-mist' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>{ok ? 'ตรงกำหนดการ' : 'ไม่พบในกำหนดการ'}</span>
            {own && <span className="shrink-0 flex">
              <button onClick={() => move(i, -1)} aria-label="เลื่อนขึ้น" className="tap px-1.5 py-2 text-sub disabled:opacity-30" disabled={i === 0}>↑</button>
              <button onClick={() => move(i, 1)} aria-label="เลื่อนลง" className="tap px-1.5 py-2 text-sub disabled:opacity-30" disabled={i === list.length - 1}>↓</button>
              <button onClick={() => edit(list.filter((_, j) => j !== i))} aria-label={`ลบข้อ ${i + 1}`} className="tap px-1.5 py-2 text-rose-600"><X className="w-4 h-4" /></button>
            </span>}
          </li>); })}
      </ol>
      {bad > 0 && <div className="text-[13px] text-amber-800 bg-amber-50 rounded-lg px-3 py-2 mt-2">{bad} ข้อไม่พบในกำหนดการ — แก้ข้อความให้ตรง หรือเพิ่มกิจกรรมนั้นในกำหนดการ</div>}
      <div className="flex flex-wrap items-center gap-2 mt-3">
        {!own && <button onClick={() => edit([...acts])} className="tap px-3.5 py-2 rounded-lg border border-brand-mist text-[13.5px] font-medium hover:bg-paper">แก้รายการเอง</button>}
        {options.length > 0 && <select value={adding} onChange={e => { const v = e.target.value; if (!v) return; edit([...list.slice(0, Math.max(0, list.length - (/AAR|After Action/.test(list[list.length - 1] || '') ? 1 : 0))), v, ...(/AAR|After Action/.test(list[list.length - 1] || '') ? [list[list.length - 1]] : [])]); setAdding(''); }}
          aria-label="เพิ่มกิจกรรมจากกำหนดการ" className="min-w-0 flex-1 sm:flex-none border border-brand-mist rounded-lg px-3 py-2 text-[13.5px] bg-white">
          <option value="">+ เพิ่มจากกำหนดการ…</option>
          {options.map((a, i) => <option key={i} value={a.name}>วันที่ {a.day} · {a.time.replace(/\s*น\.$/, '')} · {a.name.replace(/^กิจกรรม\s*/, '').slice(0, 60)}</option>)}
        </select>}
      </div>
    </div>
  );
}
/* ธีมปาร์ตี้ภาคค่ำ — เลือกจากธีมที่ทีมเคยจัดจริง หรือพิมพ์เอง · ใช้กับทุกคืน (แก้รายคืนได้ด้วยปุ่ม "แก้ไข" ที่แถว) */
function PartyPanel({ camp, plan, set }: { camp: Camp; plan: ReturnType<typeof buildSchedule>; set: (p: Partial<Camp>) => void }) {
  const cur = camp.partyTheme || '';
  const [custom, setCustom] = useState(!PARTY_THEMES.includes(cur) && !!cur);
  const rows = plan.days.flatMap(d => d.items.filter(r => r.party).map(r => ({ day: d.day, r })));
  if (!rows.length) return null;
  return (
    <div className="bg-white border border-brand-mist rounded-xl p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-[15.5px] font-semibold">ธีมปาร์ตี้ภาคค่ำ</div>
        {cur && <button onClick={() => { set({ partyTheme: undefined }); setCustom(false); }} className="tap text-[13px] underline text-sub">ใช้ธีมเดิมของแม่แบบ</button>}
      </div>
      <div className="flex flex-wrap gap-1.5 mt-3" role="group" aria-label="เลือกธีมปาร์ตี้">
        {PARTY_THEMES.map(t => (
          <button key={t} onClick={() => { set({ partyTheme: t }); setCustom(false); }} aria-pressed={cur === t}
            className={`tap px-3 py-1.5 rounded-lg text-[13.5px] border ${cur === t ? 'bg-brand-navy text-white border-brand-navy' : 'border-brand-mist hover:bg-paper'}`}>{t}</button>
        ))}
        <button onClick={() => setCustom(true)} aria-pressed={custom} className={`tap px-3 py-1.5 rounded-lg text-[13.5px] border ${custom ? 'bg-brand-navy text-white border-brand-navy' : 'border-brand-mist hover:bg-paper'}`}>พิมพ์ธีมเอง</button>
      </div>
      {custom && <input autoFocus value={cur} onChange={e => set({ partyTheme: e.target.value || undefined })} placeholder="เช่น Hawaii Night, ย้อนยุค 90s" aria-label="ธีมปาร์ตี้"
        className="mt-2 w-full border border-brand-mist rounded-lg px-3 py-2.5 text-[14.5px]" />}
      <ul className="mt-3 space-y-1 text-[13.5px]">
        {rows.map(({ day, r }, i) => <li key={i} className="flex gap-2"><span className="text-sub w-36 shrink-0">วันที่ {day} · {r.time.replace(/\s*น\.$/, '')}</span><span className="min-w-0">{r.title}</span></li>)}
      </ul>
    </div>
  );
}
/* แก้ไขแถวกำหนดการ (เวลา/ชื่อ/ลบ/คืนค่าเดิม) → camp.rowEdits อ้างวัน + ชื่อแถวเดิม */
/* งานของฉัน: ทุกงานบันทึกอัตโนมัติในเครื่องนี้ — เปิดทำต่อ / ทำสำเนา (ใช้เป็นแม่แบบงานใหม่) / ลบ */
function JobsPanel({ jobs, team, current, onOpen, onOpenTeam, onCopy, onCopyTeam, onDelete, onAll, full }: { jobs: Job[]; team: TeamJob[]; current: string; onOpen: (j: Job) => void; onOpenTeam: (t: TeamJob) => void; onCopy: (j: Job) => void; onCopyTeam?: (t: TeamJob) => void; onDelete: (j: Job) => void; onAll?: () => void; full?: boolean }) {
  // full = หน้าต่าง "งานทั้งหมด": แสดงครบทุกงาน เริ่มที่ "กำลังทำ" (งานที่ค้างไว้) · ในขั้นบรีฟแสดง 5 งานล่าสุด + ปุ่มดูทั้งหมด
  const [q, setQ] = useState(''); const [all, setAll] = useState(!!full);
  const [st, setSt] = useState<'all' | 'doing' | 'done'>(() => full && jobs.some(j => !j.done) ? 'doing' : 'all');
  const connected = hubReady();
  // รวมงานในเครื่อง + งานของทีม (งานเดียวกันแสดงครั้งเดียว — ฉบับที่ใหม่กว่า)
  type Row = { id: string; name: string; sub: string; savedAt: string; files: number; local?: Job; team?: TeamJob; done?: boolean; doneAt?: string; doneBy?: string };
  const map = new Map<string, Row>();
  for (const j of jobs) { const cp = copyOf(j); map.set(j.id, { id: j.id, name: j.name, sub: [cp && !j.name.includes(`(สำเนา ${cp.no})`) ? `สำเนาจาก ${cp.name} (สำเนา ${cp.no})` : '', j.course, j.duration, j.dates].filter(Boolean).join(' · '), savedAt: j.savedAt, files: j.files, local: j }); }
  for (const t of team) { if (t.deleted) { if (!map.get(t.id)?.local) map.delete(t.id); continue; } const r = map.get(t.id); if (r) { r.team = t; if (t.savedAt > r.savedAt) r.savedAt = t.savedAt; } else map.set(t.id, { id: t.id, name: t.name, sub: [t.course, t.duration, t.dates].filter(Boolean).join(' · '), savedAt: t.savedAt, files: t.files || 0, team: t }); }
  // สถานะ = ฉบับที่ใหม่กว่า (เครื่องนี้ / ทีม)
  for (const r of map.values()) { const src = r.team && (!r.local || r.team.savedAt > r.local.savedAt) ? r.team : r.local; r.done = !!src?.done; r.doneAt = src?.doneAt; r.doneBy = src?.doneBy; }
  const rows = [...map.values()].sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
  const nDone = rows.filter(r => r.done).length;
  if (!rows.length) return (
    <div className="rounded-xl border border-brand-mist bg-white px-3.5 py-3 text-[13.5px] text-sub">{connected ? 'งานของทีม' : 'งานของฉัน'}: ยังไม่มีงานที่บันทึกไว้ — เริ่มจากวางบรีฟด้านล่าง ระบบบันทึกให้อัตโนมัติ เปิดทำต่อได้ทุกเมื่อ</div>);
  const nq = q.trim().toLowerCase().replace(/\s+/g, '');
  const list = rows.filter(r => st === 'all' || (st === 'done') === !!r.done).filter(r => !nq || `${r.name}${r.sub}${r.local?.snap?.camp?.docCode || r.team?.docCode || ''}${r.team?.by || ''}`.toLowerCase().replace(/\s+/g, '').includes(nq));
  const shown = all || q || st !== 'all' ? list : list.slice(0, 5);
  return (
    <div className="rounded-xl border border-brand-mist bg-white overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 border-b border-brand-mist">
        <div><div className="text-[15px] font-semibold">{connected ? 'งานของทีม' : 'งานของฉัน'}</div><div className="text-[12.5px] text-sub">{connected ? 'บันทึกอัตโนมัติ · ทุกเครื่องในทีมเห็นและเปิดทำต่อได้ทันที' : 'บันทึกอัตโนมัติในเครื่องนี้ · เชื่อมต่อทีมเพื่อเปิดจากเครื่องอื่นได้'}</div></div>
        {(rows.length > 5 || full) && <input value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหาโรงเรียน/หลักสูตร/ผู้ทำ" aria-label="ค้นหางาน" className="px-2.5 py-1.5 rounded-lg border border-brand-mist text-[13.5px] w-full sm:w-52" />}
      </div>
      <div className="flex gap-1.5 px-3.5 py-2 border-b border-brand-mist text-[13px]" role="group" aria-label="กรองตามสถานะงาน">
        {([['all', `ทั้งหมด ${rows.length}`], ['doing', `กำลังทำ ${rows.length - nDone}`], ['done', `เสร็จแล้ว ${nDone}`]] as const).map(([k, t]) => (
          <button key={k} onClick={() => setSt(k)} aria-pressed={st === k} className={`tap px-3 py-1 rounded-full border ${st === k ? 'bg-brand-navy text-white border-brand-navy' : 'border-brand-mist hover:bg-paper'}`}>{t}</button>))}
      </div>
      <ul className="divide-y divide-brand-mist">
        {shown.map(r => (
          <li key={r.id} data-job={r.name} className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3.5 py-2.5 ${r.id === current ? 'bg-paper' : ''}`}>
            <div className="min-w-0 flex-1">
              <div className="text-[14.5px] font-semibold truncate">{r.done ? <span className="mr-2 align-[1px] inline-block px-1.5 rounded bg-emerald-100 text-emerald-800 text-[11.5px] font-semibold">เสร็จแล้ว</span> : <span className="mr-2 align-[1px] inline-block px-1.5 rounded bg-amber-50 text-amber-800 text-[11.5px] font-semibold">กำลังทำ</span>}{r.name}{r.id === current && <span className="ml-2 text-[12px] font-medium text-brand-navy">เปิดอยู่</span>}{!r.local && <span className="ml-2 text-[12px] font-medium text-emerald-700">จากทีม</span>}</div>
              <div className="text-[12.5px] text-sub truncate">{r.sub} · {r.done ? `เสร็จ ${ago(r.doneAt || r.savedAt)}${r.doneBy ? ` โดย ${r.doneBy}` : ''} · ` : ''}แก้ล่าสุด {ago(r.savedAt)}{r.team?.by ? ` โดย ${r.team.by}` : ''}{r.files ? ` · สร้างไฟล์แล้ว ${r.files} ครั้ง` : ''}</div>
            </div>
            <div className="flex gap-1.5 text-[13px]">
              {r.id !== current && <button onClick={() => (r.local && (!r.team || r.team.savedAt <= r.local.savedAt) ? onOpen(r.local) : onOpenTeam(r.team!))} className="tap px-3 py-1.5 rounded-lg bg-brand-navy text-white font-medium">{r.done ? 'เปิดดู / แก้' : 'เปิดทำต่อ'}</button>}
              {(r.local || (r.team && onCopyTeam)) && <button onClick={() => (r.local && (!r.team || r.team.savedAt <= r.local.savedAt) ? onCopy(r.local) : onCopyTeam!(r.team!))} aria-label={`ทำสำเนา ${r.name}`} className="tap px-3 py-1.5 rounded-lg border border-brand-mist">ทำสำเนา</button>}
              {r.local && <button onClick={() => onDelete(r.local!)} aria-label={`ลบงาน ${r.name}`} className="tap px-2.5 py-1.5 rounded-lg text-rose-600">ลบ</button>}
            </div>
          </li>))}
      </ul>
      {!full && !q && list.length > 5 && <button onClick={() => (onAll ? onAll() : setAll(!all))} className="tap w-full py-2 text-[13px] text-brand-navy border-t border-brand-mist">{all ? 'ย่อรายการ' : `ดูทั้งหมด ${list.length} งาน${rows.length - nDone ? ` (ค้าง ${rows.length - nDone})` : ''}`}</button>}
      {full && !list.length && <div className="px-3.5 py-4 text-[13.5px] text-sub">ไม่มีงานในตัวกรองนี้</div>}
    </div>);
}
/* ตัวเลือกชื่อรายการ: กิจกรรมจริงของหลักสูตรวันนั้น + รายการทั่วไป (datalist ช่วยพิมพ์ — พิมพ์เองได้) */
const COMMON_ROWS = ['รับประทานอาหารเช้า', 'รับประทานอาหารกลางวัน', 'รับประทานอาหารเย็น', 'รับประทานอาหารว่าง', 'ถอดบทเรียน AAR (After Action Review)', 'สรุปกิจกรรม และพิธีปิด', 'เดินทางกลับโดยสวัสดิภาพ', 'พักผ่อนตามอัธยาศัย'];
function ActOptions({ camp, day }: { camp: Camp; day: number }) {
  const code = dayCourseOf(camp, day - 1) || camp.courseCode || '';
  const names = useMemo(() => Array.from(new Set((code ? addonActivities(code) : []).map(a => a.title.replace(/\s*[-–]?\s*(Part|EP)\.?\s*\d+\s*$/i, '').trim()))), [code]);
  return <datalist id={`acts-d${day}`}>{[...names, ...COMMON_ROWS].map(n => <option key={n} value={n} />)}</datalist>;
}
const hmIn = (v: string) => v.replace(':', '.');            // <input type=time> "13:30" → "13.30"
const hmOut = (v?: string) => { const m = parseHM(v); return m === null ? '' : `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
/* เวลาเลิกของวัน: พิมพ์/เลือกได้อิสระ (เร็วขึ้นหรือช้าลง) ทุกแม่แบบ/ต้นฉบับ/งานเก่า · ใช้ค่าเมื่อเวลาครบ HH:MM (ไม่ปรับระหว่างพิมพ์) */
function EndTimeInput({ day, value, base, custom, onSet }: { day: number; value: string; base: string; custom: boolean; onSet: (v: string) => void }) {
  const [v, setV] = useState(hmOut(value)); useEffect(() => { setV(hmOut(value)); }, [value]);
  const tm = useRef<any>(null); useEffect(() => () => clearTimeout(tm.current), []);
  const commit = (x: string) => { clearTimeout(tm.current); const h = hmIn(x); if (parseHM(h) === null) { setV(hmOut(value)); return; } if (h === hmIn(hmOut(value))) return; onSet(h === hmIn(hmOut(base)) ? '' : h); };
  return (
    <span className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-2"><span className="text-sub">เวลาเลิก</span>
        <input type="time" step={300} value={v} onChange={e => { const x = e.target.value; setV(x); clearTimeout(tm.current); if (x) tm.current = setTimeout(() => commit(x), 900); }} onBlur={e => commit(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') commit((e.target as HTMLInputElement).value); }}
          aria-label={`เวลาเลิกวันที่ ${day}`} className="px-2 py-1.5 rounded-lg border border-brand-mist bg-white text-[13.5px] w-[7.5rem]" />
      </label>
      {custom ? <button onClick={() => onSet('')} className="tap text-[13px] text-brand-navy underline underline-offset-2">กลับเป็นตามต้นฉบับ ({base || '-'} น.)</button>
        : <span className="text-[12.5px] text-sub">ตามต้นฉบับ · เปลี่ยนได้ทั้งเร็วขึ้น/ช้าลง</span>}
    </span>);
}
/* เครื่องมือรายวัน: ขยายเวลาเลิก (ระบบเติมกิจกรรม/อาหารให้ แล้วเลื่อนพิธีปิด-เดินทางกลับไปท้าย) + เพิ่มช่วงเวลาเอง */
function DayTools({ camp, plan, day, set }: { camp: Camp; plan: ReturnType<typeof buildSchedule>; day: number; set: (p: Partial<Camp>) => void }) {
  const ext = (camp.dayExtends || []).find(x => x.day === day);
  const others = (camp.dayExtends || []).filter(x => x.day !== day);
  // เวลาเลิกตามแม่แบบ (ก่อนขยาย)
  const baseEnd = useMemo(() => { const p = buildSchedule({ ...camp, dayExtends: others.length ? others : undefined }); const d = p.days[day - 1]; return d ? dayEndOf(d) : ''; }, [camp, day]);
  const [adding, setAdding] = useState(false);
  const d = plan.days[day - 1]; const endNow = d ? dayEndOf(d) : '';
  const [st, setSt] = useState(''); const [en, setEn] = useState(''); const [ti, setTi] = useState(''); const [sub, setSub] = useState('');
  const open = () => { const e = parseHM(endNow) ?? 9 * 60; const a = Math.max(0, e - 60); setSt(hmOut(`${Math.floor(a / 60)}.${String(a % 60).padStart(2, '0')}`)); setEn(hmOut(endNow)); setTi(''); setSub(''); setAdding(true); };
  const setEnd = (v: string) => set({ dayExtends: v ? [...others, { day, end: v }] : (others.length ? others : undefined) });
  const lastRet = d && d.items.length ? d.items[d.items.length - 1] : null;
  const afterReturn = adding && lastRet && /เดินทางกลับ|เป็นต้นไป|Come back/i.test(lastRet.title) && (parseHM(hmIn(st)) ?? 0) >= (parseHM(lastRet.time) ?? 9999);
  const saveAdd = () => {
    const a = hmIn(st), b = hmIn(en); if (!ti.trim() || parseHM(a) === null) return;
    const time = parseHM(b) !== null && (parseHM(b)! > parseHM(a)!) ? `${a} – ${b} น.` : `${a} น.`;
    set({ rowAdds: [...(camp.rowAdds || []), { day, time, title: ti.trim(), sub: sub.split('\n').map(x => x.trim()).filter(Boolean) }] }); setAdding(false);
  };
  return (
    <div className="px-3 py-2 bg-paper border-b border-brand-mist text-[13.5px] space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <EndTimeInput day={day} value={ext ? ext.end : endNow} base={baseEnd} custom={!!ext} onSet={setEnd} />
        <button onClick={() => (adding ? setAdding(false) : open())} className="tap px-3 py-1.5 rounded-lg border border-brand-mist bg-white hover:bg-white/70 font-medium">{adding ? 'ปิด' : '+ เพิ่มช่วงเวลา'}</button>
        {ext && <span className="text-sub">ระบบเติมกิจกรรมของหลักสูตรให้ แล้วเลื่อนพิธีปิด/เดินทางกลับไป {ext.end} น. · แตะ "แก้ไข" ที่แถวเพื่อเปลี่ยนกิจกรรม</span>}
      </div>
      {adding && (
        <div className="bg-white border border-brand-mist rounded-lg p-2.5 space-y-2">
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-[8rem_8rem_1fr]">
            <label className="text-[12.5px] text-sub">เริ่ม<input type="time" step={300} value={st} onChange={e => setSt(e.target.value)} className="mt-0.5 w-full border border-brand-mist rounded-lg px-2 py-1.5 text-[14px] text-brand-ink" /></label>
            <label className="text-[12.5px] text-sub">ถึง<input type="time" step={300} value={en} onChange={e => setEn(e.target.value)} className="mt-0.5 w-full border border-brand-mist rounded-lg px-2 py-1.5 text-[14px] text-brand-ink" /></label>
            <label className="text-[12.5px] text-sub col-span-2 sm:col-span-1">รายการ<input value={ti} onChange={e => setTi(e.target.value)} list={`acts-d${day}`} placeholder="เลือกกิจกรรมของหลักสูตร หรือพิมพ์เอง" className="mt-0.5 w-full border border-brand-mist rounded-lg px-2.5 py-1.5 text-[14px] text-brand-ink" /></label>
          </div>
          <textarea value={sub} onChange={e => setSub(e.target.value)} rows={1} placeholder="รายละเอียด (บรรทัดละ 1 ข้อ ไม่ใส่ก็ได้)" className="w-full border border-brand-mist rounded-lg px-2.5 py-1.5 text-[13.5px]" />
          {afterReturn && <div className="text-[12.5px] text-amber-800">ช่วงนี้อยู่หลังเวลาเดินทางกลับ — ถ้าต้องการให้ค่ายจบช้าลง ใช้ "ขยายเวลาเลิกถึง" ด้านบน (ระบบเลื่อนเวลากลับให้)</div>}
          <div className="flex gap-2"><button onClick={saveAdd} disabled={!ti.trim() || !st} className="tap px-3.5 py-1.5 rounded-lg bg-brand-navy text-white font-medium disabled:opacity-40">เพิ่มลงกำหนดการ</button><button onClick={() => setAdding(false)} className="tap px-3.5 py-1.5 rounded-lg border border-brand-mist bg-white">ยกเลิก</button></div>
          <ActOptions camp={camp} day={day} />
        </div>)}
    </div>);
}
function RowEditForm({ day, row, camp, set, onDone }: { day: number; row: any; camp: Camp; set: (p: Partial<Camp>) => void; onDone: () => void }) {
  const from = row.orig ?? row.title;
  const [title, setTitle] = useState(row.title); const [time, setTime] = useState(row.time); const [sub, setSub] = useState((row.sub || []).join('\n'));
  const others = (camp.rowEdits || []).filter(e => !(e.day === day && e.from === from));
  const isAdd = row.added !== undefined;
  const save = (patch: { to?: string; time?: string; sub?: string[] } | null) => {
    if (isAdd) {   // ช่วงที่เพิ่มเอง: แก้/ลบที่รายการ rowAdds โดยตรง
      const arr = [...(camp.rowAdds || [])];
      if (patch && patch.to === '') arr.splice(row.added, 1);
      else if (patch) arr[row.added] = { day, time: patch.time || row.time, title: patch.to || row.title, sub: patch.sub };
      set({ rowAdds: arr.length ? arr : undefined }); onDone(); return;
    }
    set({ rowEdits: patch ? [...others, { day, from, ...patch }] : (others.length ? others : undefined) }); onDone();
  };
  const edited = (camp.rowEdits || []).some(e => e.day === day && e.from === from);
  return (
    <div className="px-2.5 py-2.5 bg-paper space-y-2">
      <div className="grid gap-2 sm:grid-cols-[9rem_1fr]">
        <input value={time} onChange={e => setTime(e.target.value)} aria-label="เวลา" className="border border-brand-mist rounded-lg px-2.5 py-2 text-[14px] bg-white" />
        <input autoFocus value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') save({ to: title.trim() || row.title, time: time.trim() || row.time, sub: sub.split('\n').map(x => x.trim()).filter(Boolean) }); if (e.key === 'Escape') onDone(); }} aria-label="ชื่อรายการ" list={`acts-d${day}`} className="border border-brand-mist rounded-lg px-2.5 py-2 text-[14px] bg-white" />
      </div>
      <textarea value={sub} onChange={e => setSub(e.target.value)} rows={Math.min(4, Math.max(1, sub.split('\n').length))} placeholder="รายละเอียดใต้รายการ (บรรทัดละ 1 ข้อ ไม่ใส่ก็ได้)" aria-label="รายละเอียด" className="w-full border border-brand-mist rounded-lg px-2.5 py-2 text-[13.5px] bg-white" />
      <div className="flex flex-wrap gap-2 text-[13.5px]">
        <button onClick={() => save({ to: title.trim() || row.title, time: time.trim() || row.time, sub: sub.split('\n').map(x => x.trim()).filter(Boolean) })} className="tap px-3.5 py-1.5 rounded-lg bg-brand-navy text-white font-medium">บันทึก</button>
        <button onClick={onDone} className="tap px-3.5 py-1.5 rounded-lg border border-brand-mist bg-white">ยกเลิก</button>
        {edited && !isAdd && <button onClick={() => save(null)} className="tap px-3.5 py-1.5 rounded-lg border border-brand-mist bg-white">คืนค่าเดิม</button>}
        <button onClick={() => save({ to: '' })} className="tap px-3.5 py-1.5 rounded-lg text-rose-600 ml-auto">ลบแถวนี้</button>
      </div>
      {!isAdd && <div className="text-[12px] text-sub">ต้นฉบับ: {from}</div>}
      <ActOptions camp={camp} day={day} />
    </div>
  );
}

/* เสร็จสิ้น: ยืนยัน (บอกสิ่งที่ยังขาด) → หน้าสรุป "เสร็จสิ้น" + ทางไปต่อ */
function FinishDialog({ mode, camp, checks, job, busy, team, onConfirm, onClose, onReopen, onNew, onAll, onPdf, onFix }: {
  mode: 'confirm' | 'done'; camp: Camp; checks: { ok: boolean; soft?: boolean; msg: string; tab?: string }[]; job?: Job; busy: boolean; team: boolean;
  onConfirm: () => void; onClose: () => void; onReopen: () => void; onNew: () => void; onAll: () => void; onPdf: () => void; onFix: (tab?: string) => void }) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => { first.current?.focus(); const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [mode]);
  const hard = checks.filter(c => !c.ok && !c.soft), soft = checks.filter(c => !c.ok && c.soft);
  const dur = camp.durationMode === 'half' ? 'ครึ่งวัน' : camp.durationMode === 'day' ? `${camp.days} วัน` : `${camp.days} วัน ${camp.nights} คืน`;
  const summary = [camp.courseCode ? courseLabel(camp.courseCode) : '', dur, camp.dates && !/^\s*วันที่\s*\.{2,}/.test(camp.dates) ? camp.dates : '', camp.students ? `${camp.students} คน` : ''].filter(Boolean).join(' · ');
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="finish-h" onClick={e => e.stopPropagation()} className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-lift max-h-[92vh] overflow-y-auto">
        {mode === 'confirm' ? (
          <div className="p-5 space-y-4">
            <h2 id="finish-h" className="text-[18px] font-semibold">ทำงานนี้เสร็จแล้ว?</h2>
            <p className="text-[14px] text-sub">{camp.school || 'ยังไม่ระบุโรงเรียน'}{summary ? ` · ${summary}` : ''}</p>
            {hard.length
              ? <div className="rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-3 text-[13.5px] text-amber-900">
                  <div className="font-semibold mb-1">ยังขาด {hard.length} ข้อ — ส่งลูกค้าได้แต่ควรเติมก่อน</div>
                  <ul className="list-disc ml-5 space-y-0.5">{hard.slice(0, 5).map((c, i) => <li key={i}>{c.msg}</li>)}</ul>
                  {hard.length > 5 && <div className="mt-1">และอีก {hard.length - 5} ข้อ</div>}
                </div>
              : <div className="rounded-xl border border-brand-mist bg-paper px-3.5 py-3 text-[13.5px]">ข้อมูลครบแล้ว{soft.length ? ` · มีข้อสังเกต ${soft.length} ข้อ (ไม่บังคับ)` : ''}</div>}
            <p className="text-[13px] text-sub">กด "เสร็จสิ้น" แล้วงานจะขึ้นเป็น <b className="text-brand-ink">เสร็จแล้ว</b> ใน{team ? 'งานของทีม (ทุกเครื่องเห็น)' : 'งานของฉัน'} · ถ้าแก้ต่อภายหลัง ระบบจะเปลี่ยนกลับเป็น "กำลังทำ" ให้เอง</p>
            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <button onClick={() => onFix()} className="tap px-4 py-2.5 rounded-xl text-[14px] font-medium border border-brand-mist hover:bg-paper">กลับไปแก้</button>
              <button ref={first} onClick={onConfirm} className="tap inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-[14px] font-semibold bg-accent text-white hover:bg-accent-deep"><CheckCircle2 className="w-4 h-4" />เสร็จสิ้น</button>
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-3">
              <span className="shrink-0 w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center"><Check className="w-7 h-7" strokeWidth={3} /></span>
              <div>
                <h2 id="finish-h" className="text-[22px] font-semibold leading-tight">เสร็จสิ้น</h2>
                <div className="text-[13.5px] text-sub">{job?.doneAt ? `บันทึกเป็นงานที่เสร็จแล้ว · ${ago(job.doneAt)}${job.doneBy ? ` โดย ${job.doneBy}` : ''}` : 'บันทึกเป็นงานที่เสร็จแล้ว'}</div>
              </div>
            </div>
            <div className="rounded-xl border border-brand-mist px-3.5 py-3 text-[14px]">
              <div className="font-semibold">{camp.school || 'ยังไม่ระบุโรงเรียน'}</div>
              {summary && <div className="text-sub text-[13.5px]">{summary}</div>}
              <div className="text-sub text-[13px] mt-1">{team ? 'ส่งเข้างานของทีมแล้ว — ทุกเครื่องเห็นสถานะ "เสร็จแล้ว"' : 'บันทึกในเครื่องนี้ — เชื่อมต่อทีมเพื่อให้ทีมเห็น'}{job?.files ? ` · สร้างไฟล์แล้ว ${job.files} ครั้ง` : ''}</div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button ref={first} onClick={onAll} disabled={busy} className="tap inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-[14px] font-semibold bg-accent text-white hover:bg-accent-deep disabled:opacity-40"><Layers className="w-4 h-4" />{busy ? 'กำลังสร้างไฟล์…' : 'ดาวน์โหลดครบชุด 4 ไฟล์'}</button>
              <button onClick={onPdf} disabled={busy} className="tap inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-[14px] font-semibold border border-brand-mist hover:bg-paper disabled:opacity-40"><FileText className="w-4 h-4" />บันทึกโปรแกรมเป็น PDF</button>
              <button onClick={onNew} className="tap px-4 py-2.5 rounded-xl text-[14px] font-semibold bg-brand-navy text-white hover:opacity-90">เริ่มงานใหม่</button>
              <button onClick={onClose} className="tap px-4 py-2.5 rounded-xl text-[14px] font-medium border border-brand-mist hover:bg-paper">ดูงานนี้ต่อ</button>
            </div>
            <button onClick={onReopen} className="tap w-full text-[13px] text-sub underline underline-offset-2">ยังไม่เสร็จจริง — ตั้งเป็น "กำลังทำ"</button>
          </div>
        )}
      </div>
    </div>);
}
