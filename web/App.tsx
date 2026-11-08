import React, { useState, useMemo, useRef, useEffect } from 'react';
import DataHub from './DataHub';
import { Packer } from 'docx';
import {
  FileText, Sparkles, Calendar, Calculator, Image as ImageIcon, Download, Plus, Trash2,
  CheckCircle2, AlertTriangle, Lock, BookOpen, Layers, ChevronRight, Wand2, Eye,
  BarChart3, History, RefreshCw, Users
} from 'lucide-react';
import {
  Camp, DocKind, Img, Subject, Activity, Kind, DurationMode, SUBJECTS, LIB, VENUES, DOC_TYPES, PRESETS,
  packDocx, FONT_FACE_CSS, blankCamp, fromPreset, parseBrief, parseDuration, migrateCamp, normalizeDuration, applyExtraction, buildSchedule, compose, check, isReady, subjectPool, buildDoc, fileName, money, staffText, defaultActs, defaultCourseActs, COURSES, LETTERHEADS, regionOf, Region, coursePhotos, hasCoursePhotos, courseDataset, courseById, COURSE_PHOTOS, docCodeFor, BRAND, STEAM_GALLERY, letterheadFor, isSteamProgram, courseShortTh
} from '../src/eqcamp-core';

const KIND_ICON: Record<DocKind, React.ComponentType<{ className?: string }>> = {
  program: FileText, quotation: Calculator, booking: BookOpen, runsheet: Lock
};
const KIND_LABEL: Record<Kind, string> = { opening: 'เปิดค่าย', core: 'กิจกรรมหลัก', night: 'ภาคค่ำ', recreation: 'สันทนาการ', closing: 'ปิดค่าย' };

type VenueRec = { province: string; name: string; visit: string; note: string };
const LS_KEY = 'eqcamp.db.v1';

// ---- portable "database" persistence (localStorage + JSON export/import) ----
const u8ToB64 = (u8: Uint8Array) => { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); };
const b64ToU8 = (b: string) => { const bin = atob(b); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
const imgsOut = (imgs: Img[]) => imgs.map(i => ({ caption: i.caption, data: i.data ? u8ToB64(i.data) : undefined }));
const imgsIn = (arr: any[]): Img[] => (arr || []).map(i => ({ caption: i.caption || '', data: i.data ? b64ToU8(i.data) : undefined }));
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

export default function App() {
  const saved = typeof window !== 'undefined' ? loadLS() : null;
  const initial = saved ? rehydrate(saved) : null;
  const [camp, setCamp] = useState<Camp>(() => initial?.camp ?? fromPreset('pl0109'));
  const [customVenues, setCustomVenues] = useState<VenueRec[]>(() => initial?.venues ?? []);
  const [kind, setKind] = useState<DocKind>('program');
  const [view, setView] = useState<'build' | 'hub'>('build');
  const [tab, setTab] = useState<'brief' | 'db' | 'header' | 'activities' | 'schedule' | 'price' | 'images' | 'stats'>('brief');
  const [brief, setBrief] = useState(initial?.brief ?? 'PL 0109/2569 โรงเรียนอำนาจเจริญ ม.1-2 จำนวน 72 คน ครู 6 คน ค่ายคณิตศาสตร์ Math Camp 3 วัน 2 คืน วันที่ 18 – 20 พฤศจิกายน 2569 ณ โรงแรมเชียงคานฮิลล์รีสอร์ท ราคาปกติ 4,590 ลดเหลือเพียง 3,290 บ./ท่าน');
  const [banner, setBanner] = useState<{ t: string; ok: boolean } | null>(null);
  const [dbSel, setDbSel] = useState<string>(() => (initial?.camp?.courseCode) || COURSES[0].code);
  const allVenues = useMemo<VenueRec[]>(() => [...VENUES, ...customVenues], [customVenues]);

  // autosave to localStorage (captions kept, image binaries dropped to stay within quota)
  useEffect(() => { saveLS(snapshot(camp, customVenues, brief, false)); }, [camp, customVenues, brief]);
  const fileInput = useRef<HTMLInputElement>(null);
  const aiReq = useRef(0);
  const [busy, setBusy] = useState(false);

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
        normalPrice: c.normalPrice || 0, specialPrice: c.specialPrice || 0,
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
  const ready = isReady(checks);
  const total = camp.students * camp.specialPrice;
  const cost = camp.students * camp.costPerPerson;
  const profit = total - cost;
  const margin = total ? (profit / total) * 100 : 0;

  const set = (patch: Partial<Camp>) => setCamp(c => ({ ...c, ...patch }));
  const flash = (t: string, ok = true) => { setBanner({ t, ok }); window.clearTimeout((flash as any)._t); (flash as any)._t = window.setTimeout(() => setBanner(null), 4200); };

  // mode: 'new' = เริ่มจากค่าว่าง (กันข้อมูลงานเก่าปน), 'update' = แก้งานปัจจุบัน
  const applyBrief = (mode: 'new' | 'update') => {
    const dur = parseDuration(brief);
    setCamp(c => {
      const base = mode === 'new' ? blankCamp() : c;
      const next = parseBrief(brief, base);
      if (!next.actImgs.length && !next.venueImgs.length) { const f = autoImages(next); next.actImgs = f.act; next.venueImgs = f.ven; }
      return next;
    });
    if (!dur.resolved) flash('แปลงบรีฟแล้ว ⚠ แต่อ่าน "ระยะเวลา" จากบรีฟไม่ออก — โปรดเลือกระยะเวลาเองในแท็บ 2 (ยังไม่ได้เปลี่ยนจากค่าเดิม)', false);
    else if (dur.ambiguous) flash('แปลงบรีฟแล้ว ⚠ ' + (dur.note || 'ระบุจำนวนวันแต่ไม่บอกจำนวนคืน โปรดยืนยันในแท็บ 2'), false);
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
      if (!sample) { applyBrief(mode); flash('หน้านี้ยังเรียก AI ไม่ได้ — ใช้การแปลงบรีฟแบบปกติแทน (เปิดบนลิงก์ claude.ai เพื่อใช้ AI ช่วยดึง)', false); return; }
      flash('🤖 AI กำลังอ่านบรีฟและดึงข้อมูล...');
      const courseList = COURSES.map(c => `${c.code}=${c.name}`).join('; ');
      const prompt = `คุณเป็นผู้ช่วยฝ่ายขายค่ายวิชาการ อ่าน "บรีฟ" ภาษาไทยแบบอิสระด้านล่าง แล้วดึงข้อมูลเป็น JSON ออบเจ็กต์เดียวตามคีย์นี้ (เดาจากบริบทได้ ถ้าไม่พบให้ใส่ null — ห้ามแต่งข้อมูลที่ไม่มีในบรีฟ):
{"docCode":string|null,"courseCode":string|null,"subject":"math"|"steam"|"english"|"ai"|"chinese"|"leadership"|null,"school":string|null,"level":string|null,"students":number|null,"teachers":number|null,"durationMode":"half"|"day"|"overnight"|null,"days":number|null,"nights":number|null,"dates":string|null,"province":string|null,"venue":string|null,"venueVisit":string|null,"startTime":string|null,"travelHours":number|null,"normalPrice":number|null,"specialPrice":number|null}
กติกา:
- courseCode: จับคู่ธีมบรีฟกับหลักสูตรจริงนี้ให้ตรงที่สุด (ถ้าตรง) — ${courseList} — ไม่ตรงให้ null
- subject (ใช้เมื่อ courseCode เป็น null): คณิต→"math"; วิทย์/ทะเล/ธรรมชาติ/STEAM→"steam"; อังกฤษ→"english"; AI/โค้ด/หุ่นยนต์/โดรน→"ai"; จีน→"chinese"; ผู้นำ/EQ→"leadership"
- durationMode: "ครึ่งวัน"→"half"; "ไป-กลับ"/"วันเดย์"/1 วันไม่ค้างคืน→"day"; มีจำนวนคืน≥1→"overnight" (ตั้ง days/nights ให้สอดคล้อง); ถ้าบรีฟไม่บอกระยะเวลาเลย ใส่ durationMode/days/nights เป็น null
- รองรับเลขไทยและคำไทย (เช่น "สองวันหนึ่งคืน"=2วัน1คืน)
- ราคา: "ขายหัวละ/ราคาขาย/ลดเหลือ X"→specialPrice; "ปกติ X"→normalPrice (ตัวเลขล้วน ไม่มีคอมมา/บาท); ไม่พบให้ null
- students/teachers: ดึงเฉพาะตัวเลขจำนวนคน; ไม่พบให้ null (ห้ามเดาเป็น 0)
ตอบเป็น JSON อย่างเดียว ไม่มีข้อความอื่น

บรีฟ:
"""${brief}"""`;
      const r = await sample.json<any>(prompt, { modelTier: 'default', signal: ctl.signal });
      if (stale()) return;
      const res = applyExtraction(mode === 'new' ? blankCamp() : camp, r);
      const f = autoImages(res.camp); res.camp.actImgs = f.act; res.camp.venueImgs = f.ven;
      setCamp(res.camp);
      const miss = res.missing.length ? ` · ยังขาด: ${res.missing.join(', ')}` : '';
      const warn = res.warnings.length ? ' ⚠ ' + res.warnings[0] : '';
      flash(`🤖 AI ดึงได้ ${res.applied.length} ช่อง (${res.applied.join(', ')})${miss}${warn} — ตรวจในแท็บ 2-5 ก่อนสร้างไฟล์`, res.warnings.length === 0);
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
    setCamp(c => normalizeDuration({ ...c, durationMode: mode, days, nights }));
    const label = mode === 'half' ? 'ครึ่งวัน' : mode === 'day' ? `${days} วัน (ไป-กลับ)` : `${days} วัน ${nights} คืน`;
    flash(`ปรับระยะเวลาเป็น ${label} — ระบบจัดกำหนดการใหม่อัตโนมัติ`);
  };
  const changeSubject = (s: Subject) => set({ subject: s, courseCode: undefined, activityIds: defaultActs(s).concat(camp.extraActivities.filter(a => a.subjects.includes(s)).map(a => a.id)), coreSlotIds: [] });
  const changeCourse = (code: string) => {
    if (!code) { set({ courseCode: undefined, activityIds: defaultActs(camp.subject), coreSlotIds: [] }); flash('กลับไปใช้คลังกิจกรรมตามวิชา (ไม่ผูกหลักสูตร)'); return; }
    const co = COURSES.find(c => c.code === code)!;
    const photos = coursePhotos(code, 8);
    set({ courseCode: code, subject: co.family as Subject, docCode: docCodeFor(code), activityIds: defaultCourseActs(code), coreSlotIds: [], ...(photos.length ? { actImgs: photos } : {}) });
    flash(`เลือกหลักสูตร "${co.name}" (รหัส ${code}) — ดึงกิจกรรมจริง ${defaultCourseActs(code).length} รายการ${photos.length ? ` + ภาพจริง ${photos.length} รูป` : ''} (สถานะรอตรวจ ทีมยืนยันก่อนจัดจริง)`);
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
  const addImage = (group: 'actImgs' | 'venueImgs') => setCamp(c => ({ ...c, [group]: [...c[group], { caption: 'คำบรรยายภาพ...' } as Img] }));
  const removeImage = (group: 'actImgs' | 'venueImgs', idx: number) => setCamp(c => ({ ...c, [group]: c[group].filter((_, i) => i !== idx) }));
  const captionImage = (group: 'actImgs' | 'venueImgs', idx: number, v: string) => setCamp(c => { const arr = [...c[group]]; arr[idx] = { ...arr[idx], caption: v }; return { ...c, [group]: arr }; });
  const autoFillImages = () => { const f = autoImages(camp); set({ actImgs: f.act, venueImgs: f.ven }); flash('เติมช่องภาพ + คำบรรยายตามบรีฟแล้ว — กด "ค้นรูป" แต่ละช่องเพื่อหาภาพจริงมาอัปโหลด'); };
  // ดึงภาพกิจกรรมจริงของหลักสูตรจากคลังทีม (ฝังลงไฟล์ทันที) — เฉพาะหลักสูตรที่มีภาพแล้ว
  const pullCoursePhotos = () => {
    const photos = coursePhotos(camp.courseCode, 8);
    if (!photos.length) { flash('หลักสูตรนี้ยังไม่มีภาพจริงในคลังทีม (ยังขาด: ธรณีวิทยา, นิติวิทยาศาสตร์, Pre-genius) — อัปโหลดเองหรือให้ทีมเพิ่มใน Drive', false); return; }
    set({ actImgs: photos });
    flash(`ดึงภาพจริง ${photos.length} รูปจากคลังทีมมาฝังแล้ว ⚠ สถานะลิขสิทธิ์เผยแพร่ยังรอทีมรับรองก่อนส่งลูกค้า`);
  };
  // เลือกกิจกรรมรายช่วง (per-slot): '' = อัตโนมัติ, อื่น ๆ = id กิจกรรมในคลัง
  const setSlot = (idx: number, id: string) => setCamp(c => {
    const arr = [...(c.coreSlotIds || [])];
    while (arr.length <= idx) arr.push('');
    arr[idx] = id;
    return { ...c, coreSlotIds: arr };
  });
  const clearSlots = () => { set({ coreSlotIds: [] }); flash('ล้างการเลือกกิจกรรมรายช่วง — กลับไปจัดอัตโนมัติ'); };
  const coreOptions = subjectPool(camp).filter(a => a.kind === 'core');
  // เปิดค้นหารูปจริงตามคำบรรยาย/บรีฟ (ผู้ใช้เลือกรูปที่มีสิทธิ์ใช้ → อัปโหลด → ฝังลงไฟล์)
  const searchImage = (query: string) => { const q = encodeURIComponent(query.replace(/[“”"]/g, '').trim()); window.open(`https://www.google.com/search?tbm=isch&q=${q}`, '_blank', 'noopener'); };

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
        flash('ถ้าไฟล์ไม่เริ่มดาวน์โหลด ให้ลงชื่อเข้าใช้ claude.ai แล้วกด “อนุญาต” ตอนระบบขอบันทึกไฟล์', false);
        logEvent('word', camp, dk); setBusy(false); return;
      }
      // เปิดจากไฟล์ standalone / เบราว์เซอร์ปกติ
      anchorDownload(blob, name);
      flash(`ดาวน์โหลด "${label}" (.docx) สำเร็จ`);
    } catch (e) { flash('เกิดข้อผิดพลาดในการสร้างไฟล์: ' + (e as Error).message, false); }
    setBusy(false);
  };
  // สร้างครบชุด 4 ไฟล์ในคลิกเดียว (ใช้ข้อมูลชุดเดียวกัน จึงตรงกันทั้งกระบวนการขาย)
  const downloadAll = async () => {
    setBusy(true);
    const sched = buildSchedule(camp); const k2 = compose(camp, sched);
    const cl = (window as any).claude;
    const downloads = cl && typeof cl.use === 'function' ? await cl.use('downloads').catch(() => null) : null;
    let done = 0;
    try {
      for (const dk of ['program', 'quotation', 'booking', 'runsheet'] as DocKind[]) {
        const blob = await toBlob(buildDoc(dk, camp, sched, k2));
        const name = fileName(dk, camp);
        if (downloads) {
          try { await downloads.save({ filename: name, data: blob }); done++; logEvent('word', camp, dk); }
          catch (e: any) { if (e?.code === 'declined') continue; anchorDownload(blob, name); done++; logEvent('word', camp, dk); }
        } else { anchorDownload(blob, name); done++; logEvent('word', camp, dk); await new Promise(r => setTimeout(r, 400)); }
      }
      flash(`สร้างครบชุด ${done}/4 ไฟล์แล้ว (โปรแกรม · ใบเสนอราคา · ขอราคาโรงแรม · Run-down ภายใน)`);
    } catch (e) { flash('สร้างชุดไฟล์ผิดพลาด: ' + (e as Error).message, false); }
    setBusy(false);
  };
  // บันทึก PDF (เอกสารโปรแกรมค่าย) — สร้างไฟล์ PDF จริงในเบราว์เซอร์ (html2canvas + jsPDF)
  // แล้วเซฟผ่าน downloads capability เดียวกับ Word → ทำงานได้ในกล่อง sandbox ของ claude.ai
  // ฟอนต์/ขนาดตรงกับ Word: TH Sarabun New ฝังในหน้า (ไม่พึ่งฟอนต์เครื่อง) · เนื้อหาตัวปกติ · ตัวหนาเฉพาะหัวข้อหลัก
  // กล่องเนื้อหาแต่ละชิ้นเรนเดอร์กว้าง 760px → วางทีละ "บล็อก" ไม่ตัดกลางบรรทัด; หัวกระดาษวาดทุกหน้า
  const PDF_STYLE = `<style>${FONT_FACE_CSS}
.eqpdf{width:760px;box-sizing:border-box;padding:0 0 4px;display:flow-root;background:#fff;color:#1D1D1F;font-family:'EQSarabun',sans-serif;font-size:18px;line-height:1.3;font-weight:400}
.eqpdf b{font-weight:700}
.eqpdf .code{text-align:right;font-weight:700;color:#0C2A41}
.eqpdf h1{text-align:center;color:#0C2A41;font-size:25px;font-weight:700;margin:2px 0 0;line-height:1.22}.eqpdf .en{text-align:center;color:#155D90;font-weight:700;font-size:21px;margin:0}
.eqpdf h2{color:#0C2A41;font-size:20px;font-weight:700;margin:10px 0 4px}
.eqpdf .li{display:flex;margin:0 0 4px 0}.eqpdf .li .n{flex:0 0 30px;padding-left:6px}.eqpdf .li .x{flex:1}
.eqpdf table.info{width:100%;border-collapse:collapse;margin:4px 0}.eqpdf table.info td{vertical-align:top;padding:3px 4px}.eqpdf table.info td.k{color:#0C2A41;font-weight:700;width:150px}
.eqpdf .sh{text-align:center;font-weight:700;line-height:1.3}
.eqpdf .sech{text-align:center;color:#0C2A41;font-size:22px;font-weight:700;margin:0 0 12px}
.eqpdf .day{font-weight:700;color:#0C2A41;font-size:19px;margin:0 0 4px;letter-spacing:.3px}
.eqpdf table.sched{width:100%;border-collapse:collapse}.eqpdf table.sched td{padding:4px 8px;vertical-align:top;line-height:1.35}.eqpdf table.sched td.t{width:168px;white-space:nowrap;color:#3a3a3c}
.eqpdf .sub{color:#48484a}
.eqpdf .note{color:#48484a;margin:4px 0}
.eqpdf .price{text-align:center;border:1.5px solid #0C2A41;background:#fff;padding:11px;border-radius:6px;margin:4px 0 14px}
.eqpdf .price .lbl{color:#3a3a3c;font-size:18px}.eqpdf .price .old{color:#8e8e93;font-size:18px;position:relative;display:inline-block}.eqpdf .price .old::after{content:'';position:absolute;left:-2px;right:-2px;top:50%;border-top:1.5px solid #8e8e93}.eqpdf .price .new{color:#C4641B;font-weight:700;font-size:25px}
.eqpdf table.bud{width:100%;border-collapse:collapse;margin:4px 0}
.eqpdf table.bud th{background:#0C2A41;color:#fff;font-weight:700;padding:6px 10px;text-align:left;font-size:17px}
.eqpdf table.bud td{padding:5px 10px;vertical-align:top;border-bottom:1px solid #ECECEF}.eqpdf table.bud td.no{width:44px;text-align:center;color:#8e8e93}
.eqpdf .phead{text-align:center;font-weight:700;color:#0C2A41;font-size:22px;margin:0 0 12px}
.eqpdf .pgrid{display:flex;flex-wrap:wrap;gap:12px;justify-content:center}
.eqpdf .pcell{width:47%}
.eqpdf .pcell .pf{position:relative;border-radius:5px;overflow:hidden}
.eqpdf .pcell img{width:100%;aspect-ratio:var(--a,4/3);object-fit:cover;display:block}
.eqpdf .pcell .num{position:absolute;top:6px;left:6px;background:rgba(12,42,65,.82);color:#fff;font-size:13px;font-weight:700;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center}
.eqpdf .pcell .cap{text-align:center;font-size:14px;color:#6E6E73;margin-top:4px;line-height:1.2}</style>`;
  const printPDF = async () => {
    const jsNS = (window as any).jspdf; const h2c = (window as any).html2canvas;
    if (!jsNS || !h2c) { flash('ตัวสร้าง PDF ยังโหลดไม่เสร็จ (ต้องออนไลน์) — รอสักครู่แล้วลองใหม่ หรือดาวน์โหลด Word แล้ว Save as PDF', false); return; }
    setBusy(true);
    try {
      const plan = buildSchedule(camp); const kk = compose(camp, plan);
      const esc = (s: any) => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' } as any)[c]);
      const ol = (arr: string[]) => arr.map((x, i) => `<div class="li"><span class="n">${i + 1}.</span><span class="x">${esc(x)}</span></div>`).join('');
      const ul = (arr: string[]) => arr.map(x => `<div class="li"><span class="n">-</span><span class="x">${esc(x)}</span></div>`).join('');
      const has = (s?: string) => !!(s && s.trim() && !s.includes('...'));
      const lh = letterheadFor(camp);
      const renderCanvas = async (inner: string) => {
        const w = document.createElement('div'); w.className = 'eqpdf';
        w.style.cssText = 'position:fixed;left:-10000px;top:0;z-index:-1;';
        w.innerHTML = PDF_STYLE + inner; document.body.appendChild(w);
        try { const fs = (document as any).fonts; await Promise.all([fs?.load?.("20px EQSarabun"), fs?.load?.("bold 20px EQSarabun")]); await fs?.ready; } catch {}
        await new Promise(r => setTimeout(r, 120));
        // วัดความสูงจริงรวมส่วนที่ล้น (scrollHeight) + กว้างคงที่ ไม่ขึ้นกับขนาดจอ (มือถือ/คอม ได้ผลเท่ากัน)
        const c = await h2c(w, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false, width: 760, height: Math.ceil(w.scrollHeight), windowWidth: 1200, windowHeight: Math.max(1200, Math.ceil(w.scrollHeight) + 50), scrollX: 0, scrollY: 0,
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
      const drawHead = () => {
        pdf.addImage(lhData, 'PNG', M, topGap, contentW, lhH, 'eqlh', 'FAST');
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(120);
        pdf.text(codeStr, pageW - M, topGap + lhH + 4.5, { align: 'right' });
      };
      const contentTop = topGap + lhH + 9;
      let y = contentTop; drawHead();
      const newPage = () => { pdf.addPage(); drawHead(); y = contentTop; };
      // วางบล็อกทั้งก้อน ไม่ตัดกลางบรรทัด: ถ้าสั่งขึ้นหน้าใหม่ หรือพื้นที่ไม่พอ → ขึ้นหน้าใหม่ก่อน
      const place = async (inner: string, opts: { newpage?: boolean; gap?: number } = {}) => {
        const canvas = await renderCanvas(inner);
        const h = contentW * (canvas.height / canvas.width);
        const atTop = y <= contentTop + 0.5;
        if ((opts.newpage || y + h > pageH - bottomM) && !atTop) newPage();
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', M, y, contentW, h);
        y += h + (opts.gap ?? 3);
      };

      // ---- หน้าปก ----
      await place(`<h1>${esc(kk.titleTh)}</h1><div class="en">${esc(kk.titleEn)}</div>`, { gap: 5 });
      await place(`<h2>วัตถุประสงค์การเรียนรู้</h2>${ol(kk.objectives)}` +
        `<table class="info"><tr><td class="k">จำนวน</td><td>${esc(kk.p1)}<br>${esc(kk.p2)}</td></tr><tr><td class="k">วิทยากร</td><td>${esc(kk.staff)} คน</td></tr><tr><td class="k">ระยะเวลาอบรม</td><td>${esc(kk.dur)}</td></tr></table>`);
      await place(`<h2>กิจกรรมเชิงบูรณาการ</h2>${ol(kk.acts)}`);
      await place(`<h2>บูรณาการการเรียน (integration instruction)</h2>${ol(kk.integ)}`);

      // ---- หน้ากำหนดการ: ขึ้นหน้าใหม่ · แต่ละวันเป็นบล็อก (ไม่ตัดข้ามหน้า) · ปิดด้วยหมายเหตุ ----
      await place(`<div class="sh">กำหนดการ<br>${esc(kk.nameTh)}<br>${esc(kk.titleEn)}` +
        (has(camp.school) ? '<br>' + esc(camp.school) : '') + (has(camp.dates) ? '<br>' + esc(camp.dates) : '') + (has(camp.venue) ? '<br>ณ ' + esc(camp.venue) : '') + '</div>', { newpage: true, gap: 6 });
      for (const d of plan.days) {
        await place(`<div class="day">วันที่ ${d.day}</div><table class="sched">` +
          d.items.map(r => `<tr><td class="t">${esc(r.time)}</td><td>${esc(r.title)}${(r.sub || []).map(s => `<div class="sub">${esc(s)}</div>`).join('')}</td></tr>`).join('') + '</table>', { gap: 6 });
      }
      await place(`<div class="note">หมายเหตุ : กำหนดการอาจจะเปลี่ยนแปลงตามความเหมาะสม</div>`);

      // ---- ราคา + รายละเอียดงบประมาณ (ตาราง) + ลงนาม : ขึ้นหน้าใหม่เสมอ ----
      const budRows = kk.budget.map((x, i) => `<tr><td class="no">${i + 1}</td><td>${esc(x)}</td></tr>`).join('');
      await place(
        `<div class="sech">ราคาและรายละเอียดงบประมาณ</div>` +
        `<div class="price"><span class="lbl">ราคาปกติ </span><span class="old">${money(camp.normalPrice)} บ./ท่าน</span><span class="lbl">&nbsp;&nbsp; ลดเหลือเพียง </span><span class="new">${money(camp.specialPrice)} บ./ท่าน</span></div>` +
        `<table class="bud"><thead><tr><th style="width:44px">ลำดับ</th><th>รายการ</th></tr></thead><tbody>${budRows}</tbody></table>` +
        `<div class="note">หมายเหตุ : ราคาข้างต้นรวมตามรายการที่ระบุ และอาจปรับเปลี่ยนตามความเหมาะสมของกิจกรรม</div>`,
        { newpage: true });

      // ---- ภาพประกอบ 6–8 รูป: กริด 2 คอลัมน์ มีกรอบ + หมายเลข + คำบรรยายใต้รูป · แต่ละชุดขึ้นหน้าใหม่ ----
      const u8b64 = (u: Uint8Array) => { let s = ''; for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); };
      const realCap = (c?: string) => !!(c && c.trim() && !/\.\.\./.test(c));
      const cell = (src: string, n: number, cap: string) => `<div class="pcell"><div class="pf"><span class="num">${n}</span>${src}</div><div class="cap">${esc(cap)}</div></div>`;
      // >4 รูป → สัดส่วน 16/9 ให้ครบ 8 รูปพอดีหน้าเดียว; ≤4 รูป → 4/3
      const gridOf = (cells: string[]) => { const a = cells.length > 4 ? '16/9' : '4/3'; return `<div class="pgrid" style="--a:${a}">${cells.slice(0, 8).join('')}</div>`; };
      let photoCount = 0;
      const withData = camp.actImgs.filter(a => a.data);
      let actCells: string[] = [];
      if (withData.length) actCells = withData.slice(0, 8).map((a, i) => cell(`<img src="data:${a.data![0] === 0x89 ? 'image/png' : 'image/jpeg'};base64,${u8b64(a.data!)}">`, i + 1, realCap(a.caption) ? a.caption! : `ภาพกิจกรรมที่ ${i + 1}`));
      else if (hasCoursePhotos(camp.courseCode)) actCells = COURSE_PHOTOS[camp.courseCode].slice(0, 8).map((p: any, i: number) => cell(`<img src="data:image/jpeg;base64,${p.b64}">`, i + 1, `ภาพกิจกรรมที่ ${i + 1}`));
      if (actCells.length) { photoCount += actCells.length; await place(`<div class="phead">ตัวอย่างภาพกิจกรรม</div>${gridOf(actCells)}`, { newpage: true }); }
      const venueData = camp.venueImgs.filter(a => a.data);
      if (venueData.length) {
        const vCells = venueData.slice(0, 8).map((a, i) => cell(`<img src="data:${a.data![0] === 0x89 ? 'image/png' : 'image/jpeg'};base64,${u8b64(a.data!)}">`, i + 1, realCap(a.caption) ? a.caption! : `ภาพบรรยากาศที่พักที่ ${i + 1}`));
        photoCount += vCells.length;
        await place(`<div class="phead">ตัวอย่างภาพบรรยากาศที่พัก ${esc(camp.venue || '')}</div>${gridOf(vCells)}`, { newpage: true });
      }
      if (isSteamProgram(camp)) await place(`<div class="phead">ตัวอย่างภาพกิจกรรมค่าย STEAM</div><div style="text-align:center"><img style="width:92%;border:1px solid #cbd0d6;border-radius:4px" src="data:image/jpeg;base64,${STEAM_GALLERY.b64}"></div>`, { newpage: true });

      // เลขหน้า "X / Y" ทุกหน้า (ล่างกลาง)
      const totPages = pdf.internal.getNumberOfPages();
      for (let i = 1; i <= totPages; i++) { pdf.setPage(i); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(140); pdf.text(`${i} / ${totPages}`, pageW / 2, pageH - 7, { align: 'center' }); }
      const blob: Blob = pdf.output('blob');
      const name = fileName('program', camp).replace(/\.docx$/, '.pdf');
      const cl = (window as any).claude;
      const downloads = cl && typeof cl.use === 'function' ? await cl.use('downloads').catch(() => null) : null;
      const photoWarn = photoCount < 6 ? ` ⚠ ภาพประกอบมี ${photoCount} รูป (แนะนำ 6–8) — เพิ่มภาพในแท็บ 6 ก่อนส่งลูกค้า` : '';
      if (downloads) {
        try { await downloads.save({ filename: name, data: blob }); logEvent('pdf', camp, 'program'); flash('บันทึก PDF เรียบร้อย' + photoWarn, !photoWarn); }
        catch (e: any) { if (e?.code === 'declined') flash('ยกเลิกการบันทึก PDF', false); else { anchorDownload(blob, name); logEvent('pdf', camp, 'program'); flash('ดาวน์โหลด PDF แล้ว' + photoWarn, !photoWarn); } }
      } else { anchorDownload(blob, name); logEvent('pdf', camp, 'program'); flash('ดาวน์โหลด PDF แล้ว' + photoWarn, !photoWarn); }
    } catch (e) { flash('สร้าง PDF ไม่สำเร็จ: ' + (e as Error).message, false); }
    setBusy(false);
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
  const stepIdx = STEPS.findIndex(s => s.id === tab);

  return (
    <div className="min-h-screen bg-paper text-brand-ink pb-20">
      {/* Header */}
      <header className="sticky top-0 z-30 brandbar text-white shadow-lift">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/10 ring-1 ring-white/25 grid place-items-center font-display font-semibold text-[15px] text-sky-50 tracking-tight">EQ</div>
            <div>
              <h1 className="font-display font-semibold text-[15px] sm:text-lg leading-tight tracking-tight">ระบบสร้างเอกสารค่ายวิชาการ <span className="text-sky-200/90 font-normal">EQ Camp</span></h1>
              <p className="text-[13px] text-sky-100/70">บรีฟ → ระบุรายละเอียดทีละขั้น → ได้ไฟล์ Word/PDF มาตรฐาน (PL xxxx/2569) พร้อมเสนอใน 30 นาที</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => download(kind)} disabled={busy}
              className="tap px-4 py-2 rounded-xl bg-accent enabled:hover:bg-accent-deep disabled:opacity-40 text-white text-[13.5px] font-semibold shadow-lift flex items-center gap-1.5">
              <Download className="w-4 h-4" />{busy ? 'กำลังสร้าง…' : `ดาวน์โหลด ${DOC_TYPES.find(d => d.id === kind)!.label}`}
            </button>
            <button onClick={downloadAll} disabled={busy} title="สร้างทั้ง 4 ไฟล์ด้วยข้อมูลชุดเดียวกัน"
              className="tap px-3 py-2 rounded-xl bg-white/10 ring-1 ring-white/25 enabled:hover:bg-white/20 disabled:opacity-40 text-white text-[13.5px] font-medium flex items-center gap-1.5">
              <Layers className="w-4 h-4" />ครบชุด 4 ไฟล์
            </button>
            <button onClick={printPDF} disabled={busy} title="บันทึกเอกสารโปรแกรมค่ายเป็น PDF"
              className="tap px-3 py-2 rounded-xl bg-white/10 ring-1 ring-white/25 enabled:hover:bg-white/20 disabled:opacity-40 text-white text-[13.5px] font-medium flex items-center gap-1.5">
              <FileText className="w-4 h-4" />บันทึก PDF
            </button>
          </div>
        </div>
      </header>

      {/* สลับโหมด: สร้างเอกสาร ↔ คลังข้อมูลขาย (ข้อมูลทั้งหมดอยู่เว็บเดียว) */}
      <div className="bg-white border-b border-brand-mist">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 flex gap-6" role="tablist" aria-label="โหมด">
          {([['build', 'สร้างเอกสาร'], ['hub', 'คลังข้อมูลขาย']] as const).map(([id, l]) => (
            <button key={id} role="tab" aria-selected={view === id} onClick={() => setView(id)}
              className={`tap py-3 text-[15px] border-b-2 -mb-px ${view === id ? 'border-brand-navy text-brand-ink font-semibold' : 'border-transparent text-sub hover:text-brand-ink font-medium'}`}>{l}</button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-4">
        {banner && (
          <div className={`mb-4 px-4 py-2.5 rounded-xl text-[13.5px] font-semibold flex items-center justify-between border ${banner.ok ? 'bg-emerald-50 border-emerald-300 text-emerald-950' : 'bg-rose-50 border-rose-300 text-rose-950'}`}>
            <span className="flex items-center gap-1.5">{banner.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}{banner.t}</span>
            <button onClick={() => setBanner(null)} className="text-sub hover:text-slate-900 font-bold px-2">✕</button>
          </div>
        )}

        {view === 'hub' ? (
          <DataHub venues={allVenues} currentCourse={camp.courseCode} currentVenue={camp.venue}
            onUseCourse={code => { changeCourse(code); setKind('program'); setTab('header'); setView('build'); }}
            onUseVenue={v => { set({ venue: v.name, province: v.province, venueVisit: v.visit, supplierNote: v.note }); setView('build'); setTab('header'); flash(`ใช้ที่พัก "${v.name}" ในเอกสารแล้ว`); }}
            onUsePreset={id => { loadPreset(id); setTab('brief'); setView('build'); }} />
        ) : (<>
        {/* Sales workflow: 4 document types */}
        <div className="bg-white rounded-2xl border border-brand-mist p-3 mb-4 shadow-card">
          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
            <div className="text-[13.5px] font-bold text-sub flex items-center gap-1.5"><Wand2 className="w-3.5 h-3.5" />เลือกเอกสารตามขั้นตอนการขาย — ทุกฉบับดึงข้อมูลชุดเดียวกัน จึงตรงกันทั้งกระบวนการ</div>
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] text-slate-400 mr-1">ฐานข้อมูลกลาง:</span>
              <button onClick={exportDB} className="px-2.5 py-1 rounded-lg bg-paper hover:bg-slate-200 border border-brand-mist text-[13px] font-bold text-slate-700">ส่งออก JSON</button>
              <button onClick={() => fileInput.current?.click()} className="px-2.5 py-1 rounded-lg bg-paper hover:bg-slate-200 border border-brand-mist text-[13px] font-bold text-slate-700">นำเข้า</button>
              <button onClick={resetDB} className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-[13px] font-bold text-rose-600">รีเซ็ต</button>
              <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" onChange={e => { importDB(e.target.files?.[0]); e.target.value = ''; }} />
            </div>
          </div>
          <div className="text-[12px] text-emerald-700 mb-2">💾 บันทึกอัตโนมัติในเครื่องนี้ · ส่งออก JSON เพื่อสำรอง/แชร์ให้ทีม (รวมกิจกรรม+สถานที่ที่เพิ่มเอง)</div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {DOC_TYPES.map(d => {
              const Icon = KIND_ICON[d.id]; const on = kind === d.id;
              return (
                <button key={d.id} onClick={() => setKind(d.id)}
                  className={`tap text-left p-3.5 rounded-xl border ${on ? 'bg-brand-navy text-white border-brand-navy' : 'bg-white border-brand-mist hover:border-brand/40'}`}>
                  <div className="flex items-center gap-1.5 mb-1.5"><span className={`text-[12px] font-medium ${on ? 'text-white/70' : 'text-sub'}`}>{d.stage}</span>{d.internal && <Lock className={`w-3 h-3 ml-auto ${on ? 'text-white/70' : 'text-sub'}`} />}</div>
                  <div className="text-[15px] font-semibold leading-tight">{d.label}</div>
                  <div className={`text-[13px] mt-1 leading-snug ${on ? 'text-white/70' : 'text-sub'}`}>{d.desc}</div>
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
                        <span className={`w-6 h-6 rounded-full grid place-items-center text-[12.5px] font-semibold ${on ? 'bg-white text-brand-navy' : done ? 'bg-emerald-600 text-white' : 'bg-paper text-sub ring-1 ring-brand-mist'}`}>{done ? '✓' : i + 1}</span>
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
                  <SectionTitle title="1. สร้างจากบรีฟออนไลน์ หรือเลือกแม่แบบไฟล์จริง" sub="วางข้อความบรีฟ ระบบจะดึง รหัส PL / โรงเรียน / จำนวนคน / วิชา / วัน-คืน / วันที่ / สถานที่ / ราคา เข้าแบบฟอร์มให้อัตโนมัติ" />
                  <textarea rows={5} value={brief} onChange={e => setBrief(e.target.value)} className="w-full p-3 rounded-xl border border-brand-mist text-[13.5px]" />
                  <button onClick={() => aiExtract('new')} disabled={busy} className="w-full py-2.5 rounded-xl bg-white border border-brand-mist hover:border-brand text-brand font-semibold text-[13.5px] flex items-center justify-center gap-1.5 tap">🤖 {busy ? 'AI กำลังดึงข้อมูล...' : 'ให้ AI ดึงข้อมูลจากบรีฟ (แม่นกับภาษาคน)'}</button>
                  <p className="text-[12px] text-brand/80 -mt-1">AI อ่านบรีฟอิสระได้ดีกว่า เช่น “วิทยาศาสตร์ทางทะเล...เด็ก 100 คน...โรงแรมกาสะรอง พัทยา...ขายหัวละ 3290” — ใช้ได้เมื่อเปิดบนลิงก์ claude.ai (ครั้งแรกจะขออนุญาต)</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => applyBrief('new')} className="py-2.5 rounded-xl bg-brand hover:bg-brand-navy text-white font-bold text-[13.5px] shadow flex items-center justify-center gap-1.5"><Sparkles className="w-4 h-4" />สร้างใหม่ (แบบปกติ)</button>
                    <button onClick={() => applyBrief('update')} className="py-2.5 rounded-xl bg-white border border-brand text-brand hover:bg-brand-mist/50 font-bold text-[13.5px] shadow-card flex items-center justify-center gap-1.5">อัปเดตงานปัจจุบัน</button>
                  </div>
                  <p className="text-[12px] text-sub -mt-1">ปุ่มแบบปกติใช้ตัวจับคำ (ไม่ต้องต่อ AI): “สร้างใหม่” ล้างค่าเก่าก่อน · “อัปเดต” เก็บค่าที่บรีฟไม่ได้กล่าวถึง</p>
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <div className="text-[13.5px] font-bold text-slate-700">หรือเลือกแม่แบบไฟล์มาตรฐาน:</div>
                    {PRESETS.map(p => (
                      <button key={p.id} onClick={() => loadPreset(p.id)} className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-sky-500 hover:bg-brand-mist/50/40 flex items-center justify-between">
                        <div>
                          <div className="text-[13.5px] font-extrabold">{p.label}</div>
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
                        const on = dbSel === co.code; const nPhoto = COURSE_PHOTOS[co.code]?.length || 0;
                        return <button key={co.code} onClick={() => setDbSel(co.code)} title={co.name} className={`px-2 py-1 rounded-lg text-[12px] font-bold border ${on ? 'bg-brand text-white border-brand' : 'bg-slate-50 border-slate-200 text-sub'}`}>{co.code}{nPhoto ? ' 📷' : ''}</button>;
                      })}
                    </div>
                    {ds && (
                      <div className="border border-slate-200 rounded-xl p-3 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-sm font-extrabold text-sky-900">{ds.course.name}</div>
                            <div className="text-[13px] text-sub">{ds.course.code} · วิชา {SUBJECTS[ds.course.family as Subject]?.label || ds.course.family} · กิจกรรม {ds.total} · ภาพ {ds.photoCount}{ds.draftCount ? ` · รอตรวจ ${ds.draftCount}` : ''}</div>
                          </div>
                          <button onClick={() => { changeCourse(ds.course.code); setTab('header'); }} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[13px] font-bold shrink-0">ใช้หลักสูตรนี้ →</button>
                        </div>
                        <div>
                          <div className="text-[13px] font-bold text-sub mb-1">วัตถุประสงค์หลัก (เข้าเอกสารข้อ 1–2)</div>
                          <div className="text-[13px] text-slate-700 space-y-0.5">
                            <div>1. {ds.course.obj1 || <span className="text-amber-600">— ยังไม่มีในฐาน (ทีมเติมใน MASTER)</span>}</div>
                            <div>2. {ds.course.obj2 || <span className="text-amber-600">— ยังไม่มีในฐาน (ทีมเติมใน MASTER)</span>}</div>
                          </div>
                        </div>
                        <div>
                          <div className="text-[13px] font-bold text-sub mb-1">กิจกรรมที่ผูกกับค่ายนี้ ({ds.total})</div>
                          {ds.total === 0 ? <div className="text-[13px] text-amber-600">ยังไม่มีกิจกรรมในฐานสำหรับหลักสูตรนี้</div> :
                            <div className="space-y-1.5">
                              {ds.actsByKind.map(g => (
                                <div key={g.kind}>
                                  <div className="text-[12px] font-bold text-slate-400">{KIND_LABEL[g.kind]} ({g.items.length})</div>
                                  <ul className="list-disc ml-4 text-[13px] text-slate-700">
                                    {g.items.map(a => <li key={a.id}>{a.title}{a.draft && <span className="ml-1 text-[11px] font-bold text-amber-700 bg-amber-100 px-1 rounded">รอตรวจ</span>}</li>)}
                                  </ul>
                                </div>
                              ))}
                            </div>}
                        </div>
                        <div>
                          <div className="text-[13px] font-bold text-sub mb-1">ภาพกิจกรรมจริง ({ds.photoCount})</div>
                          {ds.photoCount === 0 ? <div className="text-[13px] text-slate-400">ยังไม่มีภาพในคลังสำหรับหลักสูตรนี้ — อัปโหลดเองในแท็บ 6 หรือให้ทีมเพิ่มใน Drive</div> :
                            <>
                              <div className="grid grid-cols-4 gap-1.5">
                                {ds.photos.slice(0, 8).map((p, i) => <img key={i} src={`data:image/jpeg;base64,${p.b64}`} className="w-full h-14 object-cover rounded-md border border-slate-200" alt="" />)}
                              </div>
                              <div className="text-[11px] text-amber-600 mt-1">⚠ รอทีมรับรองสิทธิ์เผยแพร่ก่อนส่งลูกค้า</div>
                            </>}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {tab === 'header' && (
                <div className="space-y-3">
                  <SectionTitle title="2. รหัส PL · วิชา · โรงเรียน · จำนวน · ระยะเวลา · สถานที่" />
                  {camp.courseCode && <div className="text-[12px] text-sky-800 bg-sky-50 border border-sky-200 rounded-lg px-2 py-1.5">🔗 ผูกหลักสูตร <b>{camp.courseCode}</b> — กิจกรรม · ภาพ · วัตถุประสงค์ ดึงเฉพาะของค่ายนี้ · การกด "วิชา" ด้านล่างจะเลิกผูกหลักสูตร</div>}
                  <div className="grid grid-cols-2 gap-2.5">
                    <Field label="รหัสเอกสาร (มุมขวาบน)"><input value={camp.docCode} onChange={e => set({ docCode: e.target.value })} className={inp} /></Field>
                    <Field label="จำนวนวิทยากร (อัตโนมัติ)"><input value={`${staffText(camp.students)} คน`} readOnly className={inp + ' bg-slate-50 text-sub'} /></Field>
                  </div>
                  <Field label="วิชา / ประเภทค่าย (เปลี่ยนชื่อหลักสูตร + กิจกรรมเริ่มต้น)">
                    <div className="grid grid-cols-2 gap-1.5">
                      {(Object.keys(SUBJECTS) as Subject[]).map(s => (
                        <button key={s} onClick={() => changeSubject(s)} className={`py-2 rounded-lg text-[13.5px] font-bold border ${camp.subject === s ? 'bg-brand text-white border-brand' : 'bg-slate-50 border-slate-300'}`}>{SUBJECTS[s].label}</button>
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
                        const nP = coursePhotos(co.code, 8).length;
                        return (
                          <button key={co.code} role="radio" aria-checked={on} onClick={() => changeCourse(co.code)}
                            className={`tap text-left p-3 rounded-xl border ${on ? 'border-brand-navy ring-1 ring-brand-navy bg-white' : 'border-brand-mist bg-white hover:border-brand/40'}`}>
                            <div className="flex items-center justify-between gap-2 text-[12px] text-sub"><span className="font-medium">{co.code}</span><span>{nP ? `ภาพจริง ${nP}` : 'ยังไม่มีภาพ'}</span></div>
                            <div className="text-[14px] font-semibold leading-snug mt-1">{m ? m[1] : co.name}</div>
                            {m && <div className="text-[12.5px] text-sub leading-snug">{m[2]}</div>}
                          </button>
                        );
                      })}
                    </div>
                    {camp.courseCode && <div className="text-[12px] text-amber-700 mt-1">กิจกรรมจากคลังนี้สถานะ "รอตรวจ" — ทีมต้องยืนยันขั้นตอน/อุปกรณ์/เวลาก่อนจัดจริง</div>}
                  </Field>
                  <div className="text-[13px] text-sub -mt-1">หลักสูตร: <b>{k.titleTh}</b> {k.titleEn}</div>
                  <Field label="ชื่อโรงเรียน"><input value={camp.school} onChange={e => set({ school: e.target.value })} className={inp} /></Field>
                  <div className="grid grid-cols-3 gap-2.5">
                    <Field label="ระดับชั้น"><input value={camp.level} onChange={e => set({ level: e.target.value })} className={inp} /></Field>
                    <Field label="นักเรียน (คน)"><input type="number" value={camp.students} onChange={e => set({ students: +e.target.value || 0 })} className={inp} /></Field>
                    <Field label="ครู (คน)"><input type="number" value={camp.teachers} onChange={e => set({ teachers: +e.target.value || 0 })} className={inp} /></Field>
                  </div>
                  <Field label="ระยะเวลา (จัดกำหนดการใหม่อัตโนมัติ)">
                    <div className="grid grid-cols-5 gap-1.5">
                      {([
                        { m: 'half' as DurationMode, d: 1, n: 0, l: 'ครึ่งวัน' },
                        { m: 'day' as DurationMode, d: 1, n: 0, l: '1 วัน\nไป-กลับ' },
                        { m: 'overnight' as DurationMode, d: 2, n: 1, l: '2ว1ค' },
                        { m: 'overnight' as DurationMode, d: 3, n: 2, l: '3ว2ค' },
                        { m: 'overnight' as DurationMode, d: 4, n: 3, l: '4ว3ค' }
                      ]).map(o => {
                        const on = camp.durationMode === o.m && (o.m !== 'overnight' || camp.days === o.d);
                        return <button key={o.l} onClick={() => changeDuration(o.m, o.d, o.n)} className={`py-2 rounded-lg text-[13px] font-bold border whitespace-pre-line leading-tight ${on ? 'bg-brand text-white border-brand' : 'bg-slate-50 border-slate-300'}`}>{o.l}</button>;
                      })}
                    </div>
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
                        <button key={v.name} onClick={() => set({ venue: v.name, province: v.province, venueVisit: v.visit, supplierNote: v.note })} className={`px-2 py-1 rounded-lg text-[12px] font-semibold border ${camp.venue === v.name ? 'bg-sky-100 border-sky-400 text-sky-800' : 'bg-slate-50 border-slate-200 text-sub'}`}>{v.name.replace('โรงแรม', '')} · {v.province}</button>
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
                  <SectionTitle title={`3. เลือกกิจกรรมจากคลัง ${camp.courseCode ? '· หลักสูตร ' + (courseById(camp.courseCode)?.name || camp.courseCode) : '(วิชา' + SUBJECTS[camp.subject].label + ')'}`} sub={camp.courseCode ? 'แสดงเฉพาะกิจกรรมของหลักสูตรนี้ + สันทนาการ/เปิด-ปิดกลางที่จำเป็น — ระบบเรียงลงทุกช่วงจนเต็ม ไม่เว้นว่าง' : "ระบบนำกิจกรรมที่เลือกไปเรียงลงทุกช่วงเวลาในกำหนดการจนเต็ม ไม่เว้นช่องว่าง และร้อยเป็นประโยค 'กิจกรรมเชิงบูรณาการ' อัตโนมัติ"} />
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-sub">ตารางต้องการ <b className="text-brand">{plan.coreSlots}</b> ช่องกิจกรรมหลัก · เลือกไว้ <b className="text-brand">{selectedCore}</b></span>
                    <div className="flex gap-2">
                      <button onClick={() => set({ activityIds: camp.courseCode ? defaultCourseActs(camp.courseCode) : defaultActs(camp.subject).concat(camp.extraActivities.filter(a => a.subjects.includes(camp.subject)).map(a => a.id)) })} className="font-bold text-brand">เลือกทั้งหมด</button>
                      <button onClick={() => set({ activityIds: camp.activityIds.filter(id => !subjectPool(camp).some(a => a.id === id && a.kind === 'core')) })} className="font-bold text-slate-400">ล้างกิจกรรมหลัก</button>
                    </div>
                  </div>
                  {(['opening', 'core', 'night', 'recreation', 'closing'] as const).map(kind => {
                    const items = subjectPool(camp).filter(a => a.kind === kind);
                    if (!items.length) return null;
                    const label = { opening: 'เปิดค่าย', core: 'กิจกรรมหลัก (ฐานการเรียนรู้)', night: 'ภาคค่ำ', recreation: 'สันทนาการ', closing: 'ปิดค่าย' }[kind];
                    return (
                      <div key={kind}>
                        <div className="text-[13px] font-bold text-sub mb-1">{label}</div>
                        <div className="space-y-1.5">
                          {items.map(a => {
                            const on = camp.activityIds.includes(a.id);
                            const custom = a.id.startsWith('cust-');
                            return (
                              <div key={a.id} className={`p-2.5 rounded-lg border flex items-start gap-2 ${on ? 'bg-sky-50 border-sky-400' : 'bg-white border-slate-200'}`}>
                                <button onClick={() => toggleAct(a.id)} className="flex items-start gap-2 flex-1 text-left">
                                  <div className={`w-4 h-4 rounded mt-0.5 grid place-items-center shrink-0 ${on ? 'bg-brand' : 'border border-brand-mist'}`}>{on && <CheckCircle2 className="w-4 h-4 text-white" />}</div>
                                  <div>
                                    <div className="text-[13.5px] font-bold leading-snug">{a.title}{custom && <span className="ml-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-1 rounded">เพิ่มเอง</span>}{a.draft && !custom && <span className="ml-1 text-[11px] font-bold text-amber-700 bg-amber-100 px-1 rounded">รอตรวจ</span>}</div>
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
                  <SectionTitle title="4. กำหนดการ (สร้างอัตโนมัติจากกิจกรรม + ระยะเวลา)" sub="ช่อง 'กิจกรรมหลัก' เลือกกิจกรรมจากฐานได้รายช่วง (เมนูด้านล่างหัวข้อ) — เลือก 'อัตโนมัติ' ให้ระบบจัดเอง" />
                  <div className="flex items-center justify-between text-[13px] bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                    <span className="text-sub">ช่องกิจกรรมหลักทั้งหมด <b className="text-brand">{plan.days.reduce((n, d) => n + d.items.filter(r => r.slot !== undefined).length, 0)}</b> ช่อง · เลือกเอง <b className="text-brand">{(camp.coreSlotIds || []).filter(Boolean).length}</b></span>
                    <button onClick={clearSlots} className="font-bold text-slate-400 hover:text-sub">ล้างเป็นอัตโนมัติทั้งหมด</button>
                  </div>
                  {plan.days.map(d => (
                    <div key={d.day} className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="bg-brand text-white text-[13.5px] font-semibold px-3 py-1.5">วันที่ {d.day}</div>
                      <div className="divide-y divide-slate-100">
                        {d.items.map((r, i) => (
                          <div key={i} className="flex gap-2 px-2.5 py-1.5 text-[13px]">
                            <span className="font-bold text-sub w-28 shrink-0">{r.time}</span>
                            <span className="text-slate-800 flex-1 min-w-0">
                              {r.slot !== undefined && <span className="inline-block mb-0.5 px-1 rounded bg-brand-mist text-brand text-[11px] font-bold">กิจกรรมหลัก #{r.slot + 1}</span>}
                              <span className="block">{r.title}{r.sub?.map((s, j) => <span key={j} className="block text-slate-400">{s}</span>)}</span>
                              {r.slot !== undefined && (
                                <select value={(camp.coreSlotIds || [])[r.slot] || ''} onChange={e => setSlot(r.slot!, e.target.value)}
                                  className="mt-1 w-full px-1.5 py-1 rounded border border-brand-mist text-[12px] bg-white">
                                  <option value="">— อัตโนมัติ (ระบบเลือกให้) —</option>
                                  {coreOptions.map(a => (
                                    <option key={a.id} value={a.id}>{a.draft ? '⚠ ' : ''}{a.title.replace(/^กิจกรรม\s*/, '').slice(0, 60)}</option>
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
                  <div className="text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">⚠ กิจกรรมที่มีเครื่องหมาย ⚠ มาจากคลัง 14 หลักสูตร สถานะ "รอตรวจ" — ทีมต้องยืนยันขั้นตอน/อุปกรณ์/เวลาก่อนจัดจริง</div>
                </div>
              )}

              {tab === 'price' && (
                <div className="space-y-3">
                  <SectionTitle title="5. ราคาเสนอขาย & ต้นทุนภายใน" />
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
                  <SectionTitle title="6. ภาพกิจกรรม & ภาพที่พัก (ดึงภาพจริงตามบรีฟ)" sub="กด 'เติมช่องภาพตามบรีฟ' เพื่อสร้างช่อง+คำบรรยายจากกิจกรรม/สถานที่ → กด 'ค้นรูป' แต่ละช่องเพื่อเปิดค้นหาภาพจริง → เลือกรูปที่มีสิทธิ์ใช้แล้วอัปโหลด รูปจะฝังลงไฟล์ Word ทันที" />
                  <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={pullCoursePhotos} disabled={!hasCoursePhotos(camp.courseCode)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-[13px] font-bold flex items-center gap-1">
                      <ImageIcon className="w-3.5 h-3.5" />ดึงภาพจริงของหลักสูตร{hasCoursePhotos(camp.courseCode) ? ` (${(COURSES.find(c=>c.code===camp.courseCode)?.name)||camp.courseCode})` : ''}
                    </button>
                    <button onClick={autoFillImages} className="px-3 py-1.5 rounded-lg bg-brand hover:bg-brand-navy text-white text-[13px] font-bold flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" />เติมช่องภาพตามบรีฟ</button>
                  </div>
                  <div className="text-[12px] text-sub">{hasCoursePhotos(camp.courseCode) ? 'หลักสูตรนี้มีภาพกิจกรรมจริงของทีมในคลัง — กดปุ่มเขียวเพื่อฝังลงไฟล์ทันที' : 'หลักสูตรที่เลือกยังไม่มีภาพจริงในคลังทีม (ยังขาด: ธรณีวิทยา, นิติวิทยาศาสตร์, Pre-genius) — ใช้ "เติมช่องภาพตามบรีฟ" แล้วอัปโหลดภาพที่มีสิทธิ์เอง'}</div>
                  <div className="text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">⚠ ภาพจากคลังทีมยังรอทีมรับรองสิทธิ์เผยแพร่ก่อนส่งลูกค้า · ภาพที่พักให้ใช้สื่อทางการของโรงแรม เพื่อความถูกต้องของลิขสิทธิ์ในเอกสารขาย</div>
                  {(['actImgs', 'venueImgs'] as const).map(group => (
                    <div key={group}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="text-[13.5px] font-bold text-slate-700">{group === 'actImgs' ? 'ภาพกิจกรรม' : `ภาพที่พัก (${camp.venue.replace('โรงแรม', '')})`}</div>
                        <button onClick={() => addImage(group)} className="text-[13px] font-bold text-brand flex items-center gap-1"><Plus className="w-3.5 h-3.5" />เพิ่มช่อง</button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {camp[group].map((im, i) => (
                          <div key={i} className="border border-slate-200 rounded-xl p-2 space-y-1.5">
                            <label className="block aspect-[8/5] rounded-lg bg-paper border border-dashed border-slate-300 overflow-hidden cursor-pointer grid place-items-center text-[12px] text-slate-400">
                              {im.data ? <span className="text-emerald-600 font-bold">✓ ฝังรูปแล้ว</span> : 'คลิกเพื่ออัปโหลด'}
                              <input type="file" accept="image/*" className="hidden" onChange={e => onImage(group, i, e.target.files?.[0])} />
                            </label>
                            <input value={im.caption} onChange={e => captionImage(group, i, e.target.value)} className="w-full px-2 py-1 rounded border border-slate-200 text-[12px]" placeholder="คำบรรยาย (ใช้เป็นคำค้นรูปด้วย)" />
                            <div className="flex items-center justify-between">
                              <button onClick={() => searchImage(im.caption || camp.venue)} className="text-[12px] font-bold text-brand flex items-center gap-0.5"><ImageIcon className="w-3 h-3" />ค้นรูป</button>
                              <button onClick={() => removeImage(group, i)} className="text-[12px] text-rose-500 flex items-center gap-0.5"><Trash2 className="w-3 h-3" />ลบ</button>
                            </div>
                          </div>
                        ))}
                        {!camp[group].length && <div className="col-span-2 text-[13px] text-slate-400 py-3 text-center">ยังไม่มีช่องภาพ — กด "เติมช่องภาพตามบรีฟ" ด้านบน หรือ "เพิ่มช่อง"</div>}
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
                  <span className="text-[13px] text-sub">ขั้นที่ {stepIdx + 1} จาก {STEPS.length}</span>
                  {stepIdx < STEPS.length - 1
                    ? <button onClick={() => setTab(STEPS[stepIdx + 1].id)} className="tap px-5 py-2.5 rounded-xl text-[14px] font-semibold bg-brand-navy text-white hover:opacity-90">ถัดไป: {STEPS[stepIdx + 1].label}</button>
                    : <button onClick={() => download(kind)} disabled={busy} className="tap px-5 py-2.5 rounded-xl text-[14px] font-semibold bg-accent text-white hover:bg-accent-deep disabled:opacity-40">ดาวน์โหลดไฟล์</button>}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: preview + checklist */}
          <div className="lg:col-span-7 space-y-4">
            <div className="rounded-xl border border-brand-mist bg-white p-4 shadow-card">
              <div className={`flex items-center gap-1.5 text-[15px] font-semibold mb-2.5 ${ready ? 'text-emerald-700' : 'text-accent-deep'}`}>{ready ? <><CheckCircle2 className="w-4 h-4" />พร้อมสร้างไฟล์ — ตรวจครบทุกข้อ</> : <><AlertTriangle className="w-4 h-4" />ตรวจก่อนส่ง</>}</div>
              <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1">
                {checks.map((c, i) => (
                  <div key={i} className={`text-[13px] flex items-start gap-1.5 ${c.ok ? 'text-sub' : (c as any).soft ? 'text-sky-800' : 'text-amber-800 font-semibold'}`}>
                    <span className="shrink-0 mt-0.5">{c.ok ? '✓' : (c as any).soft ? 'ℹ' : '⚠'}</span>{c.msg}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-brand-mist shadow-card overflow-hidden">
              <div className="bg-brand-navy text-white px-4 py-2.5 text-[13.5px] font-semibold flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" />พรีวิว: {DOC_TYPES.find(d => d.id === kind)!.label}</div>
              <div className="p-5 max-h-[70vh] overflow-y-auto font-doc"><Preview kind={kind} camp={camp} plan={plan} k={k} total={total} cost={cost} profit={profit} margin={margin} /></div>
            </div>
            <button onClick={() => download(kind)} disabled={busy} className="w-full py-3 rounded-xl bg-accent enabled:hover:bg-accent-deep disabled:opacity-40 text-white font-semibold shadow-lift tap flex items-center justify-center gap-2">
              <Download className="w-5 h-5" />{busy ? 'กำลังสร้างไฟล์...' : `ดาวน์โหลด ${DOC_TYPES.find(d => d.id === kind)!.label} เป็นไฟล์ Word (.docx)`}
            </button>
            {!ready && <div className="text-[13px] text-amber-700 text-center -mt-1">ℹ ยังมีข้อมูลไม่ครบบางข้อ (ดูแถบ "ตรวจก่อนส่ง" ด้านบน) — ดาวน์โหลดเป็นฉบับร่างได้ แต่ควรเติมให้ครบก่อนส่งลูกค้า</div>}
          </div>
        </div>
        </>)}
      </div>
    </div>
  );
}

function CustomAdd({ onAdd }: { onAdd: (title: string, kind: Kind, desc: string) => void }) {
  const [title, setTitle] = useState(''); const [desc, setDesc] = useState(''); const [kind, setKind] = useState<Kind>('core');
  const kinds: { k: Kind; l: string }[] = [{ k: 'opening', l: 'เปิด' }, { k: 'core', l: 'หลัก' }, { k: 'night', l: 'ค่ำ' }, { k: 'recreation', l: 'สันทนาการ' }, { k: 'closing', l: 'ปิด' }];
  return (
    <div className="mt-2 p-3 rounded-xl border-2 border-dashed border-sky-300 bg-sky-50/40 space-y-2">
      <div className="text-[13px] font-bold text-sky-800 flex items-center gap-1"><Plus className="w-3.5 h-3.5" />เพิ่มกิจกรรมเอง (สั่งค่าแบบไหนก็ได้)</div>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="ชื่อกิจกรรม เช่น Escape Room คณิตศาสตร์" className="w-full px-2.5 py-1.5 rounded-lg border border-brand-mist text-[13.5px]" />
      <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="คำอธิบายย่อ (ไม่บังคับ)" className="w-full px-2.5 py-1.5 rounded-lg border border-brand-mist text-[13.5px]" />
      <div className="flex items-center gap-1.5">
        <div className="flex gap-1">
          {kinds.map(x => <button key={x.k} onClick={() => setKind(x.k)} className={`px-2 py-1 rounded-lg text-[12px] font-bold border ${kind === x.k ? 'bg-brand text-white border-brand' : 'bg-white border-slate-300'}`}>{x.l}</button>)}
        </div>
        <button disabled={!title.trim()} onClick={() => { onAdd(title.trim(), kind, desc.trim()); setTitle(''); setDesc(''); }} className="ml-auto px-3 py-1.5 rounded-lg bg-emerald-600 enabled:hover:bg-emerald-500 disabled:opacity-40 text-white text-[13px] font-bold">เพิ่มเข้าคลัง</button>
      </div>
    </div>
  );
}

function VenueAdd({ onAdd }: { onAdd: (v: VenueRec) => void }) {
  const [name, setName] = useState(''); const [province, setProvince] = useState(''); const [visit, setVisit] = useState(''); const [note, setNote] = useState('');
  return (
    <div className="mt-1 p-3 rounded-xl border-2 border-dashed border-sky-300 bg-sky-50/40 space-y-2">
      <div className="text-[13px] font-bold text-sky-800 flex items-center gap-1"><Plus className="w-3.5 h-3.5" />เพิ่มสถานที่/โรงแรมเองเข้าคลัง</div>
      <div className="grid grid-cols-2 gap-1.5">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="ชื่อโรงแรม" className="px-2.5 py-1.5 rounded-lg border border-brand-mist text-[13.5px]" />
        <input value={province} onChange={e => setProvince(e.target.value)} placeholder="จังหวัด" className="px-2.5 py-1.5 rounded-lg border border-brand-mist text-[13.5px]" />
      </div>
      <input value={visit} onChange={e => setVisit(e.target.value)} placeholder="แหล่งทัศนศึกษาใกล้เคียง (ไม่บังคับ)" className="w-full px-2.5 py-1.5 rounded-lg border border-brand-mist text-[13.5px]" />
      <div className="flex gap-1.5">
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="ผู้ติดต่อ/เรต (ภายใน)" className="flex-1 px-2.5 py-1.5 rounded-lg border border-brand-mist text-[13.5px]" />
        <button disabled={!name.trim()} onClick={() => { onAdd({ name: name.trim(), province: province.trim(), visit: visit.trim(), note: note.trim() }); setName(''); setProvince(''); setVisit(''); setNote(''); }} className="px-3 py-1.5 rounded-lg bg-emerald-600 enabled:hover:bg-emerald-500 disabled:opacity-40 text-white text-[13px] font-bold whitespace-nowrap">เพิ่ม + ใช้เลย</button>
      </div>
    </div>
  );
}

// สร้างช่องภาพ + คำบรรยายจากบรีฟ (วิชา/กิจกรรมที่เลือก/สถานที่) เพื่อจัดวางตามบรีฟ
function autoImages(c: Camp): { act: Img[]; ven: Img[] } {
  // ถ้าหลักสูตรมีภาพจริงของทีมในคลัง → ฝังภาพจริงให้เลย (ไม่งั้นสร้างช่อง+คำบรรยายตามกิจกรรม)
  const photos = coursePhotos(c.courseCode, 8);
  if (photos.length) {
    const ven: Img[] = [
      { caption: `บรรยากาศที่พัก ${c.venue}${c.province ? ' จังหวัด' + c.province : ''}` } as Img,
      { caption: c.venueVisit ? `แหล่งทัศนศึกษา ${c.venueVisit}` : `ห้องประชุมสัมมนา ${c.venue}` } as Img
    ];
    return { act: photos, ven };
  }
  const acts = subjectPool(c).filter(a => c.activityIds.includes(a.id) && a.kind === 'core').slice(0, 4);
  const act: Img[] = (acts.length ? acts : [{ title: `กิจกรรมค่าย${SUBJECTS[c.subject].label}` } as any]).map(a =>
    ({ caption: `บรรยากาศ${(a.title || '').replace(/^กิจกรรม\s*/, '')}`.slice(0, 80) } as Img));
  while (act.length < 2) act.push({ caption: `บรรยากาศกิจกรรมค่าย${SUBJECTS[c.subject].label}` } as Img);
  const ven: Img[] = [
    { caption: `บรรยากาศที่พัก ${c.venue}${c.province ? ' จังหวัด' + c.province : ''}` } as Img,
    { caption: c.venueVisit ? `แหล่งทัศนศึกษา ${c.venueVisit}` : `ห้องประชุมสัมมนา ${c.venue}` } as Img
  ];
  return { act, ven };
}

const inp = 'w-full px-3 py-2.5 rounded-xl border border-brand-mist bg-white text-[15px] focus:outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15';
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[13.5px] font-medium text-brand-ink mb-1.5">{label}</label>{children}</div>;
}
function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return <div className="pb-2.5 mb-3 border-b border-brand-mist"><h2 className="text-[17px] font-semibold text-brand-ink leading-snug tracking-tight">{title}</h2>{sub && <p className="text-[13.5px] text-sub mt-1 leading-relaxed">{sub}</p>}</div>;
}
function Stat({ label, value, tone }: { label: string; value: string; tone: 'sky' | 'slate' | 'emerald' | 'amber' | 'rose' }) {
  const c = { sky: 'bg-sky-50 text-sky-800', slate: 'bg-slate-50 text-slate-700', emerald: 'bg-emerald-50 text-emerald-800', amber: 'bg-amber-50 text-amber-800', rose: 'bg-rose-50 text-rose-800' }[tone];
  return <div className={`rounded-xl py-2 ${c}`}><div className="text-[12px] font-semibold opacity-70">{label}</div><div className="text-sm font-extrabold">{value}</div></div>;
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
    <div className="text-[13px] leading-relaxed">
      <div className="text-right font-bold text-sky-800">{c.docCode}</div>
      <div className="text-center font-extrabold text-lg text-sky-900">{k.titleTh}</div>
      <div className="text-center font-bold text-sky-600 mb-3">{k.titleEn}</div>
      <H>วัตถุประสงค์การเรียนรู้</H><OL items={k.objectives} />
      <table className="w-full my-2 text-[12px]"><tbody>
        <tr><td className="font-bold text-sky-800 align-top w-24 py-0.5">จำนวน</td><td>{k.p1}<br />{k.p2}</td></tr>
        <tr><td className="font-bold text-sky-800 py-0.5">วิทยากร</td><td>{k.staff} คน</td></tr>
        <tr><td className="font-bold text-sky-800 py-0.5">ระยะเวลา</td><td>{k.dur}</td></tr>
      </tbody></table>
      <H>กิจกรรมเชิงบูรณาการ</H><OL items={k.acts} />
      <H>บูรณาการการเรียน (integration instruction)</H><OL items={k.integ} />
      <div className="my-3 border-t pt-2 text-center font-extrabold text-sky-900">กำหนดการ</div>
      <Sched plan={plan} />
      <div className="my-3 text-center bg-sky-50 border-2 border-sky-300 rounded-lg py-2 font-bold text-sky-900">ราคาปกติ <span className="line-through text-rose-600">{money(c.normalPrice)}</span> ลดเหลือเพียง <span className="text-emerald-700 text-base">{money(c.specialPrice)} บ./ท่าน</span></div>
      <H>รายละเอียดงบประมาณ</H>{k.budget.map((b: string, i: number) => <div key={i} className="pl-3">- {b}</div>)}
    </div>
  );
  if (kind === 'quotation') return (
    <div className="text-[13px] leading-relaxed">
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
      <div className="text-[13px] leading-relaxed">
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
    <div className="text-[13px] leading-relaxed">
      <div className="text-center font-bold text-amber-700">[เอกสารภายใน EQ CAMP — ห้ามส่งลูกค้า]</div>
      <div className="text-right font-bold text-sky-800">RD {c.docCode.replace(/^PL\s*/, '')}</div>
      <div className="my-2 bg-amber-50 border-2 border-amber-400 rounded-lg p-3 text-[12px]">
        ต้นทุน {money(c.costPerPerson)} × {c.students} = {money(cost)} บาท<br />
        ราคาขาย {money(c.specialPrice)} × {c.students} = {money(total)} บาท<br />
        <b className={profit < 0 ? 'text-rose-600' : 'text-emerald-700'}>กำไรประเมิน {money(profit)} บาท (Margin {margin.toFixed(1)}%){margin < 20 ? ' ⚠ ต่ำกว่า 20%' : ''}</b>
      </div>
      <div className="text-center font-extrabold text-sky-900 mb-1">กำหนดการ (มีช่องผู้รับผิดชอบ)</div>
      <Sched plan={plan} extra />
    </div>
  );
}
const H = ({ children }: { children: React.ReactNode }) => <div className="font-bold text-sky-800 mt-2 mb-0.5">{children}</div>;
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
