// คลังภาพจากงานจริง — ภาพที่พัก / รถบัส / กิจกรรม ที่ฝังอยู่ในโปรแกรมที่ทีมส่งแล้ว รวมไว้ที่เดียว แยกหมวด
// ใช้ 2 ที่: หน้างานเก่า (ดู/รวมภาพ) · ขั้น "ภาพ" ของงาน (แตะ "ใส่ในงานนี้")
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Images, ChevronDown, ChevronUp, Plus, Check, Bus, BedDouble, Sparkles } from 'lucide-react';
import { buildPastMedia, onMedia, photoIndex, photoBlob, readMedia } from './past-photos';
import type { PhotoRef, PhotoIndex } from './past-photos';
import { onPastLib, readPastLib, courseName, shortDate } from './past-library';
import { placeKey } from '../src/eqcamp-core';

function usePhotoIndex(): PhotoIndex {
  const [v, setV] = useState(photoIndex);
  useEffect(() => { const a = onMedia(() => setV(photoIndex())), b = onPastLib(() => setV(photoIndex())); return () => { a(); b(); }; }, []);
  return v;
}
function Thumb({ r, onUse, used }: { r: PhotoRef; onUse?: (r: PhotoRef) => void; used?: boolean }) {
  const [url, setUrl] = useState(''); const [err, setErr] = useState(''); const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let alive = true, u = '';
    const go = () => photoBlob(r).then(b => { if (!alive) return; u = URL.createObjectURL(b); setUrl(u); }).catch(e => alive && setErr(e?.message || 'โหลดไม่ได้'));
    const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io?.disconnect(); go(); } }, { rootMargin: '200px' }) : null;
    if (io && el.current) io.observe(el.current); else go();
    return () => { alive = false; io?.disconnect(); if (u) URL.revokeObjectURL(u); };
  }, [r.fileId, r.name]);
  return (
    <figure ref={el} className="relative rounded-lg overflow-hidden bg-paper border border-brand-mist" title={`${r.job.replace(/^\d{6}\s*/, '')} · ${r.ctx}`}>
      <div className="aspect-[4/3] grid place-items-center">
        {url ? <img src={url} alt={r.ctx.split(' | ').pop() || 'ภาพจากงานจริง'} className="w-full h-full object-cover" loading="lazy" />
          : <span className="text-[11.5px] text-sub px-2 text-center">{err || 'กำลังโหลด…'}</span>}
      </div>
      <figcaption className="px-1.5 py-1 text-[11px] text-sub truncate">{shortDate(r.date)} · {r.job.replace(/^\d{6}\s*/, '').slice(0, 40)}</figcaption>
      {onUse && url && (
        <button onClick={() => onUse(r)} disabled={used} aria-label={used ? 'ใส่แล้ว' : 'ใส่ในงานนี้'}
          className={`tap absolute top-1.5 right-1.5 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[12px] font-medium shadow ${used ? 'bg-emerald-600 text-white' : 'bg-white/95 text-brand-ink hover:bg-white'}`}>
          {used ? <><Check className="w-3.5 h-3.5" />ใส่แล้ว</> : <><Plus className="w-3.5 h-3.5" />ใส่ในงานนี้</>}
        </button>)}
    </figure>
  );
}
function Group({ title, icon, items, onUse, usedKeys, defOpen = false }: { title: string; icon: React.ReactNode; items: PhotoRef[]; onUse?: (r: PhotoRef) => void; usedKeys?: Set<string>; defOpen?: boolean }) {
  const [open, setOpen] = useState(defOpen); const [n, setN] = useState(8);
  return (
    <li>
      <button onClick={() => setOpen(v => !v)} aria-expanded={open} className="tap w-full px-4 py-2.5 flex items-center justify-between text-left">
        <span className="text-[14px] inline-flex items-center gap-2">{icon}<b className="font-semibold">{title}</b> <span className="text-sub">{items.length} ภาพ</span></span>
        {open ? <ChevronUp className="w-4 h-4 text-sub" /> : <ChevronDown className="w-4 h-4 text-sub" />}
      </button>
      {open && (
        <div className="px-4 pb-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {items.slice(0, n).map(r => <Thumb key={r.fileId + r.name} r={r} onUse={onUse} used={usedKeys?.has(r.fileId + '|' + r.name)} />)}
          </div>
          {items.length > n && <button onClick={() => setN(x => x + 12)} className="tap mt-2 text-[13px] text-brand-navy underline underline-offset-2">ดูเพิ่มอีก {Math.min(12, items.length - n)} ภาพ</button>}
        </div>)}
    </li>
  );
}

export default function PastPhotos({ connected, flash, venue, course, onUse, usedKeys }: {
  connected: boolean; flash: (t: string, warn?: boolean) => void;
  /** โหมดใช้ในงาน: ที่พัก/หลักสูตรของงาน ขึ้นก่อน + ปุ่ม "ใส่ในงานนี้" */ venue?: string; course?: string;
  onUse?: (r: PhotoRef) => void; usedKeys?: Set<string>;
}) {
  const idx = usePhotoIndex();
  const libN = Object.values(readPastLib().items).filter(d => d.fileId && !d.err).length;
  const readN = Object.keys(readMedia().files).length;
  const [prog, setProg] = useState<{ done: number; total: number } | null>(null);
  const stop = useRef<AbortController | null>(null);
  const run = async () => {
    stop.current = new AbortController(); setProg({ done: 0, total: libN });
    try { await buildPastMedia({ signal: stop.current.signal, onStep: (done, total) => setProg({ done, total }) }); if (!stop.current.signal.aborted) flash('รวมภาพจากงานจริงแล้ว'); }
    catch (e: any) { flash(e?.message || 'รวมภาพไม่สำเร็จ', true); }
    finally { setProg(null); }
  };
  const vk = placeKey(venue || '');
  const venues = useMemo(() => {
    const m = (n: string) => { const k = placeKey(n); return vk.length >= 5 && k.length >= 5 && (k.includes(vk) || vk.includes(k)); };
    return [...idx.venues].sort((a, b) => Number(m(b.name)) - Number(m(a.name)));
  }, [idx, vk]);
  const courses = useMemo(() => Object.keys(idx.acts).sort((a, b) => Number(b === course) - Number(a === course) || idx.acts[b].length - idx.acts[a].length), [idx, course]);
  if (!connected) return null;
  if (!libN) return onUse ? null : (
    <div className="rounded-2xl border border-brand-mist bg-white p-4 text-[13.5px] text-sub">คลังภาพจากงานจริง: อ่านโปรแกรม (คลังกิจกรรมด้านบน) ก่อน แล้วระบบจะรวมภาพที่พัก รถบัส และกิจกรรมจากไฟล์เดียวกันให้</div>);
  const pct = prog && prog.total ? Math.round(prog.done / prog.total * 100) : 0;
  const matchVenue = venues[0] && vk.length >= 5 && (() => { const k = placeKey(venues[0].name); return k.includes(vk) || vk.includes(k); })();
  return (
    <section aria-label="คลังภาพจากงานจริง" className="rounded-2xl border border-brand-mist bg-white">
      <div className="p-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15.5px] font-semibold text-brand-ink flex items-center gap-2"><Images className="w-4 h-4 text-brand-navy" />คลังภาพจากงานจริง</h2>
          <p className="text-[13px] text-sub mt-0.5">{idx.total
            ? <>ภาพ {idx.total} ใบจาก {idx.files} โปรแกรม · ที่พัก {idx.venues.reduce((s, v) => s + v.items.length, 0)} · รถบัส {idx.bus.length} · กิจกรรม {Object.values(idx.acts).reduce((s, a) => s + a.length, 0)} — แยกหมวดตามหัวข้อในเอกสารต้นฉบับ</>
            : <>รวมภาพที่ฝังอยู่ในโปรแกรม Word ที่ทีมส่งแล้ว (ที่พัก · รถบัส · กิจกรรม) มาไว้ที่เดียว แยกหมวดให้</>}</p>
        </div>
        {prog
          ? <button onClick={() => stop.current?.abort()} className="tap px-3 py-2 rounded-xl border border-brand-mist text-[13.5px]">หยุดไว้ก่อน</button>
          : (readN < libN || !idx.total) && <button onClick={run} className="tap px-3.5 py-2 rounded-xl bg-brand-navy text-white text-[13.5px] font-medium">{readN ? `รวมภาพงานที่เหลือ (${libN - readN})` : `รวมภาพจาก ${libN} โปรแกรม`}</button>}
      </div>
      {prog && <div className="px-4 pb-3" aria-live="polite"><div className="h-2 rounded-full bg-paper overflow-hidden"><div className="h-full bg-brand-navy" style={{ width: pct + '%' }} /></div><div className="text-[12.5px] text-sub mt-1">อ่านรายการภาพแล้ว {prog.done}/{prog.total} โปรแกรม</div></div>}
      {idx.total > 0 && (
        <ul className="border-t border-brand-mist divide-y divide-brand-mist">
          {venues.slice(0, onUse ? 6 : 30).map((v, i) => <Group key={'v' + v.name} title={v.name} icon={<BedDouble className="w-4 h-4 text-sub" />} items={v.items} onUse={onUse} usedKeys={usedKeys} defOpen={!!onUse && i === 0 && !!matchVenue} />)}
          {idx.bus.length > 0 && <Group title="รถบัส / การเดินทาง" icon={<Bus className="w-4 h-4 text-sub" />} items={idx.bus} onUse={onUse} usedKeys={usedKeys} />}
          {courses.slice(0, onUse ? 3 : 20).map(c => <Group key={'c' + c} title={`ภาพกิจกรรม · ${courseName(c)}`} icon={<Sparkles className="w-4 h-4 text-sub" />} items={idx.acts[c]} onUse={onUse} usedKeys={usedKeys} defOpen={!!onUse && c === course && !matchVenue} />)}
        </ul>)}
    </section>
  );
}
