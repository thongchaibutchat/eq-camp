import React, { useState, useMemo, useRef, useEffect } from 'react';
import DataHub from './DataHub';
import Home from './Home';
import { IN_APP, IS_IOS, IS_MOBILE, externalBrowserUrl, copyText, canShareFiles } from './platform';
import { Packer } from 'docx';
import {
  FileText, Sparkles, Calendar, Calculator, Image as ImageIcon, Download, Plus, Trash2,
  CheckCircle2, AlertTriangle, Lock, BookOpen, Layers, ChevronRight, Wand2, Eye,
  BarChart3, History, RefreshCw, Users, X, Check, Info, ExternalLink, Copy
} from 'lucide-react';
import {
  Camp, AddonSel, DocKind, Img, Subject, Activity, Kind, DurationMode, SUBJECTS, LIB, VENUES, DOC_TYPES, PRESETS,
  packDocx, FONT_FACE_CSS, blankCamp, fromPreset, parseBrief, parseDuration, migrateCamp, normalizeDuration, applyExtraction, buildSchedule, compose, check, isReady, subjectPool, buildDoc, fileName, money, staffText, defaultActs, defaultCourseActs, COURSES, LETTERHEADS, regionOf, Region, coursePhotoIds, hasCoursePhotos, courseDataset, courseById, docCodeFor, photoIdsFor, photoCaption, venuePhotoSetFor, venueCaption, durKeyLabel, durKeyOf, CoverSec, templatesOf, realCaption, readBrief, briefFields, cleanBrief, BriefField, BRAND, STEAM_GALLERY, letterheadFor, isSteamProgram, courseShortTh,
  showTeachers, notionActsInPlan, actStandard, notionActFor, ADDON_COURSES, addonActivities, addonRowTitle, withAddonPrice, addonPriceNote
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
  type View = 'home' | 'build' | 'hub';
  const fromHash = (): View => { const h = typeof location !== 'undefined' ? location.hash : ''; return h.startsWith('#/build') ? 'build' : h.startsWith('#/data') ? 'hub' : 'home'; };
  const [view, setViewState] = useState<View>(fromHash);
  const [hubInit, setHubInit] = useState<{ key: number; sec?: 'overview' | 'courses'; course?: string }>({ key: 0 });
  const setView = (v: View) => {
    setViewState(v);
    const h = v === 'build' ? '#/build' : v === 'hub' ? '#/data' : '#/';
    try { if (location.hash !== h) history.pushState(null, '', h); } catch { /* sandbox */ }
    try { window.scrollTo(0, 0); } catch { /* ignore */ }
  };
  useEffect(() => { const on = () => setViewState(fromHash()); window.addEventListener('popstate', on); window.addEventListener('hashchange', on); return () => { window.removeEventListener('popstate', on); window.removeEventListener('hashchange', on); }; }, []);
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

  // autosave to localStorage (captions kept, image binaries dropped to stay within quota)
  useEffect(() => { saveLS(snapshot(camp, customVenues, brief, false)); }, [camp, customVenues, brief]);
  const fileInput = useRef<HTMLInputElement>(null);
  const aiReq = useRef(0);
  const [busy, setBusy] = useState(false);
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
    try {
      const db = await useCap('db'); if (!db) return;          // เงียบ ๆ ถ้าเปิดนอก claude.ai / ไม่ได้ลงชื่อเข้าใช้
      const who = await whoami();
      await db.collection('events').add({
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
  const flash = (t: string, ok = true) => { setBanner({ t, ok }); window.clearTimeout((flash as any)._t); (flash as any)._t = window.setTimeout(() => setBanner(null), 4200); };

  // mode: 'new' = เริ่มจากค่าว่าง (กันข้อมูลงานเก่าปน), 'update' = แก้งานปัจจุบัน
  const applyBrief = (mode: 'new' | 'update') => {
    const dur = parseDuration(cleanBrief(brief).ar);
    const r = readBrief(brief, mode === 'new' ? blankCamp() : camp);
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
      if ((pre.camp.addons || []).some(a => a.code === res.camp.courseCode) && pre.camp.courseCode) { res.camp.courseCode = pre.camp.courseCode; res.camp.subject = pre.camp.subject; res.camp.activityIds = pre.camp.activityIds; res.camp.docCode = pre.camp.docCode; }
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
  const loadPreset = (id: string) => { setCamp(fromPreset(id)); flash(`โหลดแม่แบบ "${PRESETS.find(p => p.id === id)!.label}" แล้ว`); };

  const changeDuration = (mode: DurationMode, days = 1, nights = 0) => {
    const hadBudget = !!(camp.budgetItems && camp.budgetItems.length);
    // ระยะเวลาเปลี่ยน → ค่าที่พัก/มื้ออาหารในงบเปลี่ยน: คืนรายการงบเป็นอัตโนมัติ กันตัวเลขค้างผิด
    setCamp(c => normalizeDuration({ ...c, durationMode: mode, days, nights, budgetItems: undefined, templateId: undefined }));
    const label = mode === 'half' ? 'ครึ่งวัน' : mode === 'day' ? `${days} วัน (ไป-กลับ)` : `${days} วัน ${nights} คืน`;
    flash(`ปรับระยะเวลาเป็น ${label} — จัดกำหนดการใหม่แล้ว${hadBudget ? ' · รายการงบกลับเป็นอัตโนมัติ (แก้ได้อีกครั้งในขั้นราคา & งบ)' : ''}`);
  };
  const changeSubject = (s: Subject) => set({ subject: s, courseCode: undefined, activityIds: defaultActs(s).concat(camp.extraActivities.filter(a => a.subjects.includes(s)).map(a => a.id)), coreSlotIds: [] });
  const changeCourse = (code: string) => {
    if (!code) { set({ courseCode: undefined, activityIds: defaultActs(camp.subject), coreSlotIds: [] }); flash('กลับไปใช้คลังกิจกรรมตามวิชา (ไม่ผูกหลักสูตร)'); return; }
    const co = COURSES.find(c => c.code === code)!;
    set({ courseCode: code, subject: co.family as Subject, docCode: docCodeFor(code), activityIds: defaultCourseActs(code), coreSlotIds: [], templateId: undefined, budgetItems: undefined });
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
    a.href = url; a.download = `EQCamp_ฐานข้อมูล_${camp.docCode.replace(/[^\w-]+/g, '_')}.json`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    flash('ส่งออกฐานข้อมูล (.json) แล้ว — ใช้สำรอง/แชร์ให้ทีม แล้วกด "นำเข้า" เพื่อเปิดต่อได้');
  };
  const importDB = (file?: File) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const snap = JSON.parse(String(r.result));
        if (!snap.camp) throw new Error('ไฟล์ไม่ใช่ฐานข้อมูล EQ Camp');
        const { camp: c, venues, brief: b } = rehydrate(snap);
        setCamp(c); setCustomVenues(venues); if (b) setBrief(b);
        flash('นำเข้าฐานข้อมูลเรียบร้อย');
      } catch (e) { flash('นำเข้าไม่สำเร็จ: ' + (e as Error).message, false); }
    };
    r.readAsText(file);
  };
  const resetDB = () => { if (!confirm('ล้างข้อมูลที่บันทึกไว้ทั้งหมด และเริ่มจากแม่แบบ PL 0109 ใหม่?')) return; try { localStorage.removeItem(LS_KEY); } catch {} setCamp(fromPreset('pl0109')); setCustomVenues([]); flash('ล้างและรีเซ็ตเป็นแม่แบบเริ่มต้นแล้ว'); };

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
      // ความคมชัด: ตัวอักษรเรนเดอร์ 2.5 เท่า (มือถือ 2 เท่า กันหน่วยความจำเต็ม) + เก็บเป็น PNG (ขอบตัวอักษรไม่เบลอแบบ JPEG)
      const SCALE = IS_MOBILE ? 2 : 2.5;
      const MAX_PX = 15_000_000; // iOS Safari จำกัดพื้นที่ canvas ~16.7 ล้านพิกเซล
      const renderCanvas = async (inner: string) => {
        const w = document.createElement('div'); w.className = 'eqpdf';
        w.style.cssText = 'position:fixed;left:-10000px;top:0;z-index:-1;';
        w.innerHTML = PDF_STYLE + inner; document.body.appendChild(w);
        try { const fs = (document as any).fonts; await Promise.all([fs?.load?.("20px EQSarabun"), fs?.load?.("bold 20px EQSarabun")]); await fs?.ready; } catch {}
        await new Promise(r => setTimeout(r, 120));
        // วัดความสูงจริงรวมส่วนที่ล้น (scrollHeight) + กว้างคงที่ ไม่ขึ้นกับขนาดจอ (มือถือ/คอม ได้ผลเท่ากัน)
        const hh = Math.ceil(w.scrollHeight);
        const sc = Math.min(SCALE, Math.sqrt(MAX_PX / (760 * Math.max(hh, 1))));
        const c = await h2c(w, { scale: sc, backgroundColor: '#ffffff', useCORS: true, logging: false, width: 760, height: Math.ceil(w.scrollHeight), windowWidth: 1200, windowHeight: Math.max(1200, Math.ceil(w.scrollHeight) + 50), scrollX: 0, scrollY: 0,
          // (สาเหตุหลักของ "ข้อความขาดท้ายบล็อก" แก้ที่ web/index.html — ดูคอมเมนต์ img[src^="data:image/gif..."]) ที่นี่แค่รอฟอนต์ในสำเนาให้ครบ
          onclone: async (doc: Document) => {
            try { const f = (doc as any).fonts; await Promise.all([f.load('20px EQSarabun'), f.load('bold 20px EQSarabun')]); await f.ready; } catch { /* ignore */ }
          } });
        document.body.removeChild(w); return c;
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

      // ---- ภาพประกอบ 6–8 รูป: กริด 2 คอลัมน์ มีกรอบ + หมายเลข + คำบรรยายใต้รูป · แต่ละชุดขึ้นหน้าใหม่ ----
      // แปลงภาพเป็น base64 ทีละก้อน (เร็วกว่าทีละไบต์มาก บนมือถือ)
      const u8b64 = (u: Uint8Array) => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, Array.from(u.subarray(i, i + 0x8000))); return btoa(s); };
      const realCap = realCaption;
      // ภาพจากไฟล์ค่าย: ไม่มีเลข/ข้อความใต้ภาพ — แสดงคำบรรยายเฉพาะที่ทีมพิมพ์เอง
      const cell = (src: string, _n: number, cap: string) => `<div class="pcell"><div class="pf">${src}</div>${cap ? `<div class="cap">${esc(cap)}</div>` : ''}</div>`;
      // >4 รูป → สัดส่วน 16/9 ให้ครบ 8 รูปพอดีหน้าเดียว; ≤4 รูป → 4/3
      const gridOf = (cells: string[]) => { const a = cells.length > 4 ? '16/9' : '4/3'; return `<div class="pgrid" style="--a:${a}">${cells.slice(0, 8).join('')}</div>`; };
      let photoCount = 0;
      const withData = camp.actImgs.filter(a => a.data);
      let actCells: string[] = [];
      if (withData.length) actCells = withData.slice(0, 8).map((a, i) => cell(`<img src="data:${a.data![0] === 0x89 ? 'image/png' : 'image/jpeg'};base64,${u8b64(a.data!)}">`, i + 1, realCap(a.caption) ? a.caption! : ''));
      if (actCells.length) { await step('ภาพกิจกรรม', 75); photoCount += actCells.length; await place(`<div class="phead">ตัวอย่างภาพกิจกรรม</div>${gridOf(actCells)}`, { newpage: true, photo: true }); }
      const venueData = camp.venueImgs.filter(a => a.data);
      if (venueData.length) {
        const vCells = venueData.slice(0, 8).map((a, i) => cell(`<img src="data:${a.data![0] === 0x89 ? 'image/png' : 'image/jpeg'};base64,${u8b64(a.data!)}">`, i + 1, realCap(a.caption) ? a.caption! : ''));
        photoCount += vCells.length; await step('ภาพที่พัก', 85);
        await place(`<div class="phead">ตัวอย่างภาพบรรยากาศที่พัก ${esc(camp.venue || '')}</div>${gridOf(vCells)}`, { newpage: true, photo: true });
      }
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
    { id: 'stats', label: 'สถิติ / ประวัติ', icon: BarChart3 }
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
  const NAV = [{ id: 'home', label: 'หน้าแรก' }, { id: 'catalog', label: 'หลักสูตร' }, { id: 'build', label: 'สร้างเอกสาร' }, { id: 'hub', label: 'คลังข้อมูล' }] as const;
  const navOn = (id: string) => id === view;
  const goNav = (id: string) => {
    if (id === 'catalog') { setView('home'); window.setTimeout(() => { try { document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' }); } catch { /* ignore */ } }, 60); return; }
    if (id === 'hub') setHubInit(h => ({ key: h.key + 1 }));
    setView(id as 'home' | 'build' | 'hub');
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
          <nav aria-label="เมนูหลัก" className="hidden lg:flex items-center gap-1 ml-6">
            {NAV.map(n => (
              <button key={n.id} onClick={() => goNav(n.id)} aria-current={navOn(n.id) ? 'page' : undefined}
                className={`tap px-3 py-2 rounded-lg text-[15px] ${navOn(n.id) ? 'text-brand-navy font-semibold bg-paper' : 'text-sub hover:text-brand-ink hover:bg-paper font-medium'}`}>{n.label}</button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {view === 'build' ? (<>
              <button onClick={() => download(kind)} disabled={busy}
                className="tap px-3.5 sm:px-4 py-2.5 rounded-xl bg-accent enabled:hover:bg-accent-deep disabled:opacity-40 text-white text-[14px] font-semibold flex items-center gap-1.5">
                <Download className="w-4 h-4" />{busy ? 'กำลังสร้าง…' : <>ดาวน์โหลด<span className="hidden lg:inline"> {DOC_TYPES.find(d => d.id === kind)!.label}</span></>}
              </button>
              <button onClick={downloadAll} disabled={busy} title="สร้างทั้ง 4 ไฟล์ด้วยข้อมูลชุดเดียวกัน"
                className="tap hidden sm:flex px-3 py-2.5 rounded-xl border border-brand-mist enabled:hover:bg-paper disabled:opacity-40 text-[14px] font-medium items-center gap-1.5">
                <Layers className="w-4 h-4" />ครบชุด<span className="hidden lg:inline"> 4 ไฟล์</span>
              </button>
              <button onClick={printPDF} disabled={busy} title="บันทึกเอกสารโปรแกรมค่ายเป็น PDF"
                className="tap px-3 py-2.5 rounded-xl border border-brand-mist enabled:hover:bg-paper disabled:opacity-40 text-[14px] font-medium flex items-center gap-1.5">
                <FileText className="w-4 h-4" />PDF
              </button>
            </>) : (
              <button onClick={() => setView('build')} className="tap px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-deep text-white text-[14px] font-semibold">สร้างเอกสาร</button>
            )}
          </div>
        </div>
        <nav aria-label="เมนูหลัก (มือถือ)" className="lg:hidden border-t border-brand-mist">
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

        {view === 'hub' ? (
          <DataHub key={hubInit.key} initialSec={hubInit.sec} venues={allVenues} currentCourse={hubInit.course || camp.courseCode} currentVenue={camp.venue}
            onUseCourse={code => { changeCourse(code); setKind('program'); setTab('header'); setView('build'); }}
            onUseVenue={v => { set({ venue: v.name, province: v.province, venueVisit: v.visit, supplierNote: v.note }); setView('build'); setTab('header'); flash(`ใช้ที่พัก "${v.name}" ในเอกสารแล้ว`); }}
            onUsePreset={id => { loadPreset(id); setTab('brief'); setView('build'); }} />
        ) : (<>
        {/* Sales workflow: 4 document types */}
        <div className="bg-white rounded-2xl border border-brand-mist p-3 mb-4 shadow-card">
          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
            <h2 className="text-[16px] font-semibold">เลือกเอกสาร</h2>
            <div className="flex items-center gap-1.5">
              
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
                  <Field label="สถานที่ / โรงแรม (เลือกจากคลังเพื่อเติมทัศนศึกษา+ผู้ติดต่อ)">
                    <input value={camp.venue} onChange={e => set({ venue: e.target.value })} className={inp} />
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {allVenues.map(v => (
                        <button key={v.name} onClick={() => set({ venue: v.name, province: v.province, venueVisit: v.visit, supplierNote: v.note })} className={`px-2 py-1 rounded-lg text-[12px] font-semibold border ${camp.venue === v.name ? 'bg-white border-brand-mist text-brand-ink' : 'bg-slate-50 border-slate-200 text-sub'}`}>{v.name.replace('โรงแรม', '')} · {v.province}</button>
                      ))}
                    </div>
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
                  <AddonPanel camp={camp} plan={plan} set={set} />
                  <SectionTitle title={`เลือกกิจกรรมจากคลัง ${camp.courseCode ? '· หลักสูตร ' + (courseById(camp.courseCode)?.name || camp.courseCode) : '(วิชา' + SUBJECTS[camp.subject].label + ')'}`} sub={camp.courseCode ? 'แสดงเฉพาะกิจกรรมของหลักสูตรนี้ + สันทนาการ/เปิด-ปิดกลางที่จำเป็น — ระบบเรียงลงทุกช่วงจนเต็ม ไม่เว้นว่าง' : "ระบบนำกิจกรรมที่เลือกไปเรียงลงทุกช่วงเวลาในกำหนดการจนเต็ม ไม่เว้นช่องว่าง และร้อยเป็นประโยค 'กิจกรรมเชิงบูรณาการ' อัตโนมัติ"} />
                  {plan.tpl && plan.tpl.exact && <div className="text-[13px] text-brand-ink bg-paper border border-brand-mist rounded-lg px-3 py-2">ค่ายนี้ใช้กิจกรรมและกำหนดการจากแม่แบบจริงของทีม ({plan.tpl.source.replace('__', ' · ')}) — รายการด้านล่างใช้เมื่อเลือก “จัดอัตโนมัติ” ในขั้นกำหนดการ</div>}
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
                </div>
              )}

              {tab === 'schedule' && (
                <div className="space-y-3">
                  <SectionTitle title="กำหนดการ" sub={plan.tpl && plan.tpl.exact ? 'ตามแม่แบบโปรแกรมจริงของทีม — ชื่อโรงเรียน/ที่พัก/ปี/จำนวนคน/งบ แทนด้วยข้อมูลจากบรีฟแล้ว' : "สร้างอัตโนมัติจากกิจกรรม + ระยะเวลา · ช่อง 'กิจกรรมหลัก' เลือกจากคลังได้รายช่วง"} />
                  {camp.courseCode && (templatesOf(camp.courseCode).length > 0) && (
                    <div className="border border-brand-mist rounded-xl p-3 space-y-2 bg-white">
                      <div className="text-[13px] text-sub">แม่แบบที่ใช้</div>
                      <select value={camp.templateId === 'engine' ? 'engine' : (plan.tpl && plan.tpl.exact ? plan.tpl.id : '')} onChange={e => set({ templateId: e.target.value || undefined, budgetItems: undefined })} className={inp}>
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
                      <div className="bg-brand text-white text-[13.5px] font-semibold px-3 py-1.5">วันที่ {d.day}</div>
                      <div className="divide-y divide-slate-100">
                        {d.items.map((r, i) => (
                          <div key={i} className="flex gap-2 px-2.5 py-1.5 text-[13px]">
                            <span className="font-semibold text-sub w-28 shrink-0">{r.time}</span>
                            <span className="text-slate-800 flex-1 min-w-0">
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
                  {(['actImgs', 'venueImgs'] as const).map(group => (
                    <div key={group}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="text-[13.5px] font-semibold text-slate-700">{group === 'actImgs' ? 'ภาพกิจกรรม' : `ภาพที่พัก (${camp.venue.replace('โรงแรม', '')})`}</div>
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
                              <span className="text-[11.5px] text-sub">{im.src ? 'จากไฟล์ของค่าย' : im.data ? 'อัปโหลดเอง' : ''}</span>
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

              {tab === 'stats' && <StatsPanel useCap={useCap} saveText={saveText} />}

              {stepIdx >= 0 && (
                <div className="flex items-center justify-between gap-3 mt-6 pt-4 border-t border-brand-mist">
                  <button onClick={() => setTab(STEPS[stepIdx - 1].id)} disabled={stepIdx === 0}
                    className="tap px-4 py-2.5 rounded-xl text-[14px] font-medium text-brand-ink border border-brand-mist hover:bg-paper disabled:invisible">ย้อนกลับ</button>
                  <span className={`text-[13px] text-sub ${stepIdx === STEPS.length - 1 ? 'hidden sm:inline' : ''}`}>ขั้นที่ {stepIdx + 1} จาก {STEPS.length}</span>
                  {stepIdx < STEPS.length - 1
                    ? <button onClick={() => setTab(STEPS[stepIdx + 1].id)} className="tap px-5 py-2.5 rounded-xl text-[14px] font-semibold bg-brand-navy text-white hover:opacity-90">ถัดไป: {STEPS[stepIdx + 1].label}</button>
                    : <span className="flex gap-2">
                        <button onClick={printPDF} disabled={busy} className="tap px-4 py-2.5 rounded-xl text-[14px] font-semibold border border-brand-mist hover:bg-paper disabled:opacity-40">PDF</button>
                        <button onClick={() => download(kind)} disabled={busy} className="tap px-4 py-2.5 rounded-xl text-[14px] font-semibold bg-accent text-white hover:bg-accent-deep disabled:opacity-40">Word</button>
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
function StatsPanel({ useCap, saveText }: { useCap: (n: string) => Promise<any>; saveText: (f: string, t: string, m: string) => void }) {
  const [state, setState] = useState<'loading' | 'ok' | 'nodb'>('loading');
  const [events, setEvents] = useState<Ev[]>([]);
  const [tick, setTick] = useState(0); // บังคับ resubscribe เมื่อกดรีเฟรช
  useEffect(() => {
    let unsub: (() => void) | null = null, alive = true;
    const timer = setTimeout(() => { if (alive && state === 'loading') setState('nodb'); }, 10000);
    (async () => {
      const db = await useCap('db');
      if (!alive) return;
      if (!db) { setState('nodb'); return; }
      try {
        unsub = db.collection('events').orderBy('ts', 'desc').limit(1000).onSnapshot(
          (snap: any) => { if (!alive) return; setEvents(snap.docs.map((d: any) => ({ id: d.id, ...(d.data() || {}) }))); setState('ok'); clearTimeout(timer); },
          () => { if (alive) setState('nodb'); }
        );
      } catch { setState('nodb'); }
    })();
    return () => { alive = false; clearTimeout(timer); if (unsub) unsub(); };
  }, [tick]);

  const agg = useMemo(() => {
    const byType: Record<string, number> = {}, byMonth: Record<string, number> = {}, byUser: Record<string, number> = {}, byCourse: Record<string, number> = {};
    let pdf = 0;
    for (const e of events) {
      const dk = e.docKind || (e.action === 'pdf' ? 'program' : 'other');
      byType[dk] = (byType[dk] || 0) + 1;
      if (e.action === 'pdf') pdf++;
      const m = (e.ts || '').slice(0, 7); if (m) byMonth[m] = (byMonth[m] || 0) + 1;
      const who = e.byName || e.by || 'ไม่ระบุ'; byUser[who] = (byUser[who] || 0) + 1;
      const co = e.courseCode || e.subject || '—'; byCourse[co] = (byCourse[co] || 0) + 1;
    }
    const months = Object.keys(byMonth).sort();
    return { total: events.length, pdf, byType, byMonth, months, byUser, byCourse };
  }, [events]);

  const exportCsv = () => {
    const cols = ['ts', 'action', 'docKind', 'docCode', 'school', 'courseCode', 'subject', 'durationMode', 'days', 'nights', 'students', 'teachers', 'normalPrice', 'specialPrice', 'province', 'region', 'byName', 'by'];
    const esc = (v: any) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const rows = [cols.join(','), ...events.map(e => cols.map(c => esc(e[c])).join(','))];
    saveText(`EQ_Camp_log_${new Date().toISOString().slice(0, 10)}.csv`, rows.join('\n'), 'text/csv');
  };

  if (state === 'loading') return <div className="py-10 text-center text-[13.5px] text-slate-400 flex items-center justify-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" />กำลังโหลดประวัติการสร้างไฟล์…</div>;
  if (state === 'nodb') return (
    <div className="space-y-3">
      <SectionTitle title="สถิติ / ประวัติการสร้างไฟล์" />
      <div className="text-[14px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3 leading-relaxed">
        ระบบบันทึกสถิติทำงานเมื่อเปิดลิงก์นี้บน <b>claude.ai</b> และ <b>ลงชื่อเข้าใช้ด้วยบัญชีทีม</b> เท่านั้น<br />
        ถ้าเปิดจากไฟล์ในเครื่อง (ดับเบิลคลิก) หรือยังไม่ได้ลงชื่อเข้าใช้ จะยังสร้างไฟล์ได้ตามปกติ แต่จะไม่บันทึกประวัติ
      </div>
      <button onClick={() => { setState('loading'); setTick(t => t + 1); }} className="px-3 py-1.5 rounded-lg bg-brand hover:bg-brand-navy text-white text-[13px] font-medium flex items-center gap-1 tap"><RefreshCw className="w-3.5 h-3.5" />ลองใหม่</button>
    </div>
  );
  const maxM = Math.max(1, ...agg.months.map(m => agg.byMonth[m]));
  const topCourse = Object.entries(agg.byCourse).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const users = Object.entries(agg.byUser).sort((a, b) => b[1] - a[1]);
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <SectionTitle title="สถิติ / ประวัติการสร้างไฟล์" sub="บันทึกอัตโนมัติทุกครั้งที่ทีมสร้างไฟล์ (เก็บบนบัญชีทีม ตรวจย้อนหลังได้)" />
        <div className="flex gap-1.5 shrink-0">
          <button onClick={() => { setState('loading'); setTick(t => t + 1); }} title="รีเฟรช" className="px-2 py-1.5 rounded-lg border border-brand-mist hover:border-brand/50 text-brand text-[13px] font-medium flex items-center gap-1 tap"><RefreshCw className="w-3.5 h-3.5" /></button>
          <button onClick={exportCsv} disabled={!events.length} className="px-2.5 py-1.5 rounded-lg bg-brand hover:bg-brand-navy disabled:opacity-40 text-white text-[13px] font-medium flex items-center gap-1 tap"><Download className="w-3.5 h-3.5" />CSV</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl py-4 bg-white border border-brand-mist"><div className="text-3xl font-semibold text-brand-navy leading-none">{agg.total}</div><div className="text-[13px] text-sub mt-1.5">ไฟล์ทั้งหมด</div></div>
        <div className="rounded-xl py-4 bg-white border border-brand-mist"><div className="text-3xl font-semibold text-brand-navy leading-none">{agg.pdf}</div><div className="text-[13px] text-sub mt-1.5">เป็น PDF</div></div>
        <div className="rounded-xl py-4 bg-white border border-brand-mist"><div className="text-3xl font-semibold text-brand-navy leading-none">{users.length}</div><div className="text-[13px] text-sub mt-1.5">ผู้ใช้งาน</div></div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(['program', 'quotation', 'booking', 'runsheet'] as const).map(dk => (
          <div key={dk} className="rounded-xl border border-brand-mist px-3 py-2 flex items-center justify-between">
            <span className="text-[13px] text-sub">{DK_LABEL[dk]}</span><span className="text-sm font-semibold text-brand">{agg.byType[dk] || 0}</span>
          </div>
        ))}
      </div>

      {agg.months.length > 0 && (
        <div>
          <div className="text-[13px] font-medium text-sub mb-1.5">ไฟล์ต่อเดือน</div>
          <div className="flex items-end gap-1.5 h-24 border-b border-brand-mist pb-0">
            {agg.months.slice(-12).map(m => (
              <div key={m} className="flex-1 flex flex-col items-center justify-end gap-1" title={`${m}: ${agg.byMonth[m]}`}>
                <span className="text-[11px] text-brand font-semibold">{agg.byMonth[m]}</span>
                <div className="w-full rounded-t bg-brand/80" style={{ height: `${Math.round((agg.byMonth[m] / maxM) * 76)}px` }} />
                <span className="text-[8px] text-slate-400 whitespace-nowrap">{m.slice(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {topCourse.length > 0 && (
        <div>
          <div className="text-[13px] font-medium text-sub mb-1.5">หลักสูตร/วิชา ที่สร้างบ่อย</div>
          <div className="space-y-1">
            {topCourse.map(([co, n]) => (
              <div key={co} className="flex items-center gap-2"><span className="text-[12px] w-20 shrink-0 text-sub truncate" title={co}>{co}</span>
                <div className="flex-1 h-3 rounded bg-brand-mist overflow-hidden"><div className="h-full bg-brand/70" style={{ width: `${Math.round((n / topCourse[0][1]) * 100)}%` }} /></div>
                <span className="text-[12px] w-6 text-right font-semibold text-brand">{n}</span></div>
            ))}
          </div>
        </div>
      )}

      {users.length > 0 && (
        <div>
          <div className="text-[13px] font-medium text-sub mb-1.5 flex items-center gap-1"><Users className="w-3.5 h-3.5" />แยกตามผู้ใช้</div>
          <div className="flex flex-wrap gap-1.5">
            {users.map(([u, n]) => <span key={u} className="px-2 py-1 rounded-lg bg-slate-50 border border-brand-mist text-[12px]"><b className="text-brand-ink">{u}</b> <span className="text-sub">· {n}</span></span>)}
          </div>
        </div>
      )}

      <div>
        <div className="text-[13px] font-medium text-sub mb-1.5 flex items-center gap-1"><History className="w-3.5 h-3.5" />ประวัติล่าสุด</div>
        <div className="border border-brand-mist rounded-xl overflow-hidden max-h-72 overflow-y-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-brand-mist/60 text-sub sticky top-0"><tr>
              <th className="text-left px-2 py-1.5 font-medium">เวลา</th><th className="text-left px-2 py-1.5 font-medium">ผู้ใช้</th>
              <th className="text-left px-2 py-1.5 font-medium">เอกสาร</th><th className="text-left px-2 py-1.5 font-medium">รหัส/โรงเรียน</th>
              <th className="text-right px-2 py-1.5 font-medium">ราคา</th>
            </tr></thead>
            <tbody>
              {events.slice(0, 80).map(e => (
                <tr key={e.id} className="border-t border-brand-mist/70">
                  <td className="px-2 py-1 text-sub whitespace-nowrap">{(e.ts || '').slice(0, 16).replace('T', ' ')}</td>
                  <td className="px-2 py-1 text-slate-700 truncate max-w-[90px]" title={e.byName || e.by}>{e.byName || e.by || '—'}</td>
                  <td className="px-2 py-1"><span className="text-brand">{DK_LABEL[e.docKind] || e.docKind || '—'}</span>{e.action === 'pdf' && <span className="ml-1 text-accent-deep font-semibold">PDF</span>}</td>
                  <td className="px-2 py-1 text-sub truncate max-w-[150px]" title={`${e.docCode} · ${e.school}`}>{e.docCode}{e.school ? ` · ${e.school}` : ''}</td>
                  <td className="px-2 py-1 text-right text-sub whitespace-nowrap">{e.specialPrice ? money(e.specialPrice) : '—'}</td>
                </tr>
              ))}
              {!events.length && <tr><td colSpan={5} className="px-2 py-6 text-center text-slate-400">ยังไม่มีประวัติ — เมื่อทีมเริ่มสร้างไฟล์ รายการจะมาแสดงที่นี่</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

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
        <div className="text-[13px] text-sub">เพิ่มวิชาอื่นเข้าค่ายนี้ ระบบแทรกลงกำหนดการให้</div>
      </div>
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
