// ที่พัก/สถานที่จัดงาน: พิมพ์ชื่อ (ไทย/อังกฤษ/ชื่อเล่น/จังหวัด) → เลือก → เติมจังหวัด แหล่งทัศนศึกษา ผู้ติดต่อ + ภาพที่พักแยกหมวดให้เอง
import React, { useMemo, useRef, useState } from 'react';
import { Search, MapPin } from 'lucide-react';
import { venueDirectory, findVenues, VENUE_PHOTO_LABEL, VENUE_PHOTO_ORDER, VENUE_PHOTO_TARGET } from '../src/eqcamp-core';
import type { VenueEntry } from '../src/eqcamp-core';

type Custom = { name: string; province: string; visit: string; note: string };
const SHORT: Record<string, string> = { ext: 'ป้าย/มุมสูง', room: 'ห้องพัก', fac: 'สระ/สิ่งอำนวยฯ', meet: 'ห้องประชุม' };

export function photoSummary(e: VenueEntry): string {
  if (!e.photos.length) return 'ยังไม่มีภาพในระบบ';
  return VENUE_PHOTO_ORDER.map(c => [c, e.photos.filter(p => p.c === c).length] as const).filter(([, n]) => n).map(([c, n]) => `${SHORT[c]} ${n}`).join(' · ');
}

export default function VenuePicker({ value, custom, photoBase, onPick, onType, compact }: {
  value: string; custom: Custom[]; photoBase: string; onPick: (e: VenueEntry) => void; onType: (v: string) => void; compact?: boolean;
}) {
  const dir = useMemo(() => venueDirectory(custom), [custom]);
  const [open, setOpen] = useState(false); const [browse, setBrowse] = useState(false); const [hi, setHi] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const matches = (value.trim() ? findVenues(value, dir) : dir).slice(0, 8);
  const cur = dir.find(e => e.name === value);
  const pick = (e: VenueEntry) => { onPick(e); setOpen(false); setBrowse(false); };
  const byProv = useMemo(() => { const m = new Map<string, VenueEntry[]>(); for (const e of dir) { const k = e.province || 'ไม่ระบุจังหวัด'; if (!m.has(k)) m.set(k, []); m.get(k)!.push(e); } return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'th')); }, [dir]);

  return (
    <div ref={box} className="relative" onBlur={e => { if (!box.current?.contains(e.relatedTarget as Node)) setOpen(false); }}>
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={value} onChange={e => { onType(e.target.value); setOpen(true); setHi(0); }} onFocus={() => setOpen(true)}
          onKeyDown={e => {
            if (!open || !matches.length) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(matches.length - 1, h + 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(0, h - 1)); }
            else if (e.key === 'Enter') { e.preventDefault(); pick(matches[hi]); }
            else if (e.key === 'Escape') setOpen(false);
          }}
          role="combobox" aria-expanded={open} aria-controls="venue-list" aria-label="ที่พัก / สถานที่จัดงาน"
          placeholder="พิมพ์ชื่อที่พัก จังหวัด หรือพื้นที่ เช่น กาสะลอง, โคราช, พัทยา"
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-brand-mist bg-white text-[15px] focus:outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15" />
      </div>
      {open && matches.length > 0 && (
        <ul id="venue-list" role="listbox" className="absolute z-20 left-0 right-0 mt-1 max-h-[22rem] overflow-y-auto bg-white border border-brand-mist rounded-xl shadow-lg">
          {matches.map((e, i) => (
            <li key={e.name} role="option" aria-selected={i === hi}>
              <button type="button" onMouseDown={ev => ev.preventDefault()} onClick={() => pick(e)} onMouseEnter={() => setHi(i)}
                className={`w-full text-left px-3 py-2 flex gap-2.5 items-center ${i === hi ? 'bg-paper' : ''}`}>
                <span className="flex -space-x-2 shrink-0 w-[4.5rem]">
                  {e.photos.slice(0, 3).map(p => <img key={p.id} src={`${photoBase}t_${p.id}.jpg`} alt="" className="w-8 h-8 rounded-md object-cover border-2 border-white" />)}
                  {!e.photos.length && <span className="w-8 h-8 rounded-md bg-slate-100 grid place-items-center text-slate-400"><MapPin size={14} /></span>}
                </span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-semibold truncate">{e.name}</span>
                  <span className="block text-[12px] text-sub truncate">{[e.province, e.area && e.area !== e.province ? e.area : ''].filter(Boolean).join(' · ') || 'ไม่ระบุจังหวัด'} · {photoSummary(e)}{e.visit ? ' · มีแหล่งทัศนศึกษา' : ''}</span>
                </span>
              </button>
            </li>))}
        </ul>
      )}

      {cur && !compact && (
        <div className="mt-2 border border-brand-mist rounded-xl bg-white p-2.5" data-venue-cats>
          <div className="text-[13px] text-sub mb-1.5">ภาพที่พักแยกหมวด (มาตรฐานทีม หมวดละ {VENUE_PHOTO_TARGET} รูป) — ดึงลงเอกสารให้เองตามลำดับนี้</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {VENUE_PHOTO_ORDER.map(c => { const ps = cur.photos.filter(p => p.c === c); const lack = Math.max(0, VENUE_PHOTO_TARGET - ps.length); return (
              <div key={c} className="min-w-0">
                <div className="text-[12.5px] font-semibold">{VENUE_PHOTO_LABEL[c]} <span className={lack ? 'text-amber-700 font-normal' : 'text-sub font-normal'}>{ps.length}{lack ? ` · ขาด ${lack}` : ''}</span></div>
                <div className="flex gap-1 mt-1">{ps.slice(0, 3).map(p => <img key={p.id} src={`${photoBase}t_${p.id}.jpg`} alt={p.s} title={p.s} className="w-12 h-9 rounded object-cover" />)}
                  {!ps.length && <span className="h-9 px-2 rounded bg-slate-50 border border-dashed border-slate-200 text-[11.5px] text-slate-400 grid place-items-center">ไม่มีภาพ</span>}</div>
              </div>); })}
          </div>
          {!cur.photos.length && <div className="text-[12.5px] text-sub mt-1.5">ที่พักนี้ยังไม่มีภาพในระบบ — อัปโหลดภาพทางการของโรงแรมได้ที่ขั้น “ภาพ”</div>}
        </div>
      )}

      {!compact && (
        <div className="mt-1.5">
          <button type="button" onClick={() => setBrowse(b => !b)} className="tap text-[13px] text-brand-navy underline">{browse ? 'ซ่อนทำเนียบที่พัก' : `ดูทำเนียบที่พักทั้งหมด (${dir.length} แห่ง · มีภาพ ${dir.filter(e => e.photos.length).length})`}</button>
          {browse && (
            <div className="mt-2 space-y-2" aria-label="ทำเนียบที่พัก">
              {byProv.map(([prov, list]) => (
                <div key={prov}>
                  <div className="text-[12.5px] font-semibold text-sub">{prov} · {list.length}</div>
                  <div className="flex flex-wrap gap-1.5 mt-1">{list.map(e => (
                    <button key={e.name} type="button" onClick={() => pick(e)} className={`tap px-2 py-1 rounded-lg text-[12.5px] border ${value === e.name ? 'bg-brand-navy text-white border-brand-navy' : 'border-brand-mist hover:bg-paper'}`}>
                      {e.name.replace(/^โรงแรม/, '')}{e.photos.length ? <span className={value === e.name ? 'text-white/75' : 'text-sub'}> · ภาพ {e.photos.length}</span> : null}
                    </button>))}</div>
                </div>))}
            </div>)}
        </div>
      )}
    </div>
  );
}
