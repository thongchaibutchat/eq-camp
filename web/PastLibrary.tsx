// คลังกิจกรรม/ที่พักจากงานจริง — อ่านโปรแกรมทุกงานในโฟลเดอร์ปี → สรุปกิจกรรมที่ใช้จริง (นับงาน) + ที่ยังไม่อยู่ในคลังเว็บ + ที่พักที่ใช้บ่อย
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Database, Download, ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import { buildPastLibrary, libRunning, onPastLib, pastIndex, readPastLib, pastActsCsv, courseName, shortDate, templateCoverage, DUR_LABEL } from './past-library';
import type { PastIndex } from './past-library';

export function usePastIndex(): PastIndex {
  const [v, setV] = useState(() => pastIndex(readPastLib()));
  useEffect(() => onPastLib(() => setV(pastIndex(readPastLib()))), []);
  return v;
}

const download = (name: string, data: Blob) => { const u = URL.createObjectURL(data); const a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); };
export default function PastLibrary({ total, connected, flash }: { total: number; connected: boolean; flash: (t: string, warn?: boolean) => void }) {
  const idx = usePastIndex();
  const [prog, setProg] = useState<{ done: number; total: number; last?: string } | null>(libRunning() ? { done: 0, total } : null);
  const [open, setOpen] = useState<string>('');
  const [tab, setTab] = useState<'new' | 'all' | 'venue' | 'tpl'>('new');
  const stop = useRef<AbortController | null>(null);
  const read = Object.keys(readPastLib().items).length;

  const run = async (force = false) => {
    stop.current = new AbortController();
    setProg({ done: 0, total });
    try {
      await buildPastLibrary({ force, signal: stop.current.signal, onStep: (done, t, last) => setProg({ done, total: t, last }) });
      if (!stop.current.signal.aborted) flash('อ่านโปรแกรมจริงครบแล้ว — กิจกรรมจากงานจริงขึ้นในหน้าเลือกกิจกรรมแล้ว');
    } catch (e: any) { flash(e?.message || 'อ่านไม่สำเร็จ', true); }
    finally { setProg(null); }
  };
  const courses = useMemo(() => Object.keys(idx.byCourse).sort((a, b) => (idx.newByCourse[b]?.length || 0) - (idx.newByCourse[a]?.length || 0)), [idx]);
  const newTotal = Object.values(idx.newByCourse).reduce((s, a) => s + a.length, 0);
  const actTotal = idx.acts.filter(a => !a.summary).length;
  const pct = prog && prog.total ? Math.round(prog.done / prog.total * 100) : 0;
  const cov = useMemo(() => templateCoverage(), [idx]);
  const gaps = cov.filter(r => r.real > 0 && !r.tpl);

  return (
    <section aria-label="คลังกิจกรรมจากงานจริง" className="rounded-2xl border border-brand-mist bg-white">
      <div className="p-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[16px] font-semibold text-brand-ink flex items-center gap-2"><Database className="w-4 h-4 text-brand-navy" />คลังกิจกรรมจากงานจริง</h2>
          <p className="text-[13.5px] text-sub mt-0.5">
            {idx.programs
              ? <>อ่านโปรแกรมแล้ว <b className="text-brand-ink">{idx.programs}</b> จาก {total} งาน · กิจกรรมที่ใช้จริง <b className="text-brand-ink">{actTotal}</b> รายการ · ยังไม่อยู่ในคลังเว็บ <b className="text-brand-ink">{newTotal}</b>{idx.at ? ` · อัปเดต ${new Date(idx.at).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}</>
              : <>อ่านกำหนดการจากโปรแกรม Word ทุกงาน ({total} งาน) แล้วรวมกิจกรรมที่ทีมใช้จริง นับว่าแต่ละตัวใช้กี่งาน และหาตัวที่ยังไม่อยู่ในคลังของเว็บ</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {prog
            ? <button onClick={() => stop.current?.abort()} className="tap px-3 py-2 rounded-xl border border-brand-mist text-[13.5px]">หยุดไว้ก่อน</button>
            : <button onClick={() => run(false)} disabled={!connected || !total} className="tap px-3.5 py-2 rounded-xl bg-brand-navy text-white text-[13.5px] font-medium disabled:opacity-40">{read ? (read < total ? 'อ่านงานที่เหลือ / ที่แก้ใหม่' : 'อัปเดตจากงานที่แก้ใหม่') : `อ่านทุกงาน (${total})`}</button>}
          {idx.programs > 0 && !prog && <button onClick={() => download(`กิจกรรมจากงานจริง-${new Date().toISOString().slice(0, 10)}.csv`, new Blob([pastActsCsv(idx)], { type: 'text/csv;charset=utf-8' }))} className="tap px-3 py-2 rounded-xl border border-brand-mist text-[13.5px] inline-flex items-center gap-1.5"><Download className="w-4 h-4" />ส่งออกให้ทีมตรวจ</button>}
        </div>
      </div>
      {prog && (
        <div className="px-4 pb-4" aria-live="polite">
          <div className="h-2 rounded-full bg-paper overflow-hidden"><div className="h-full bg-brand-navy transition-[width]" style={{ width: pct + '%' }} /></div>
          <div className="text-[12.5px] text-sub mt-1.5 truncate">อ่านแล้ว {prog.done}/{prog.total} งาน{prog.last ? ` · ${prog.last.replace(/^\d{6}\s*/, '')}` : ''} — ปิดหน้านี้ได้ เปิดใหม่แล้วกดอ่านต่อจากที่ค้าง</div>
        </div>
      )}
      {idx.programs > 0 && (
        <div className="border-t border-brand-mist">
          <div role="tablist" aria-label="มุมมอง" className="flex gap-4 px-4 overflow-x-auto whitespace-nowrap border-b border-brand-mist text-[13.5px]">
            {([['new', `ยังไม่อยู่ในคลังเว็บ (${newTotal})`], ['all', `ใช้บ่อยที่สุด`], ['venue', `ที่พักที่ใช้จริง (${idx.venues.length})`], ['tpl', `แม่แบบที่ควรเพิ่ม (${gaps.length})`]] as const).map(([id, label]) => (
              <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`tap py-2.5 -mb-px border-b-2 ${tab === id ? 'border-brand-navy text-brand-ink font-semibold' : 'border-transparent text-sub'}`}>{label}</button>
            ))}
          </div>
          {tab === 'new' && (
            <ul className="divide-y divide-brand-mist">
              {courses.filter(c => idx.newByCourse[c]?.length).map(c => {
                const items = idx.newByCourse[c]; const on = open === c;
                return (
                  <li key={c || 'none'}>
                    <button onClick={() => setOpen(on ? '' : c)} aria-expanded={on} className="tap w-full px-4 py-2.5 flex items-center justify-between text-left">
                      <span className="text-[14px]"><b className="font-semibold">{courseName(c)}</b> <span className="text-sub">· กิจกรรมใหม่ {items.length} · ใช้จริงทั้งหมด {idx.byCourse[c].filter(a => !a.summary).length}</span></span>
                      {on ? <ChevronUp className="w-4 h-4 text-sub" /> : <ChevronDown className="w-4 h-4 text-sub" />}
                    </button>
                    {on && (
                      <ul className="px-4 pb-3 space-y-1">
                        {items.map(a => (
                          <li key={a.k} className="text-[13.5px] flex flex-wrap gap-x-2">
                            <span className="text-brand-ink">{a.n}</span>
                            <span className="text-sub text-[12.5px]">ใช้ {a.progs} งาน · ล่าสุด {shortDate(a.last)}{a.min ? ` · ${a.min} นาที` : ''}</span>
                          </li>))}
                      </ul>)}
                  </li>);
              })}
              {!newTotal && <li className="px-4 py-3 text-[13.5px] text-sub">ทุกกิจกรรมที่ใช้จริงอยู่ในคลังเว็บแล้ว</li>}
            </ul>
          )}
          {tab === 'all' && (
            <ol className="divide-y divide-brand-mist">
              {idx.acts.filter(a => !a.summary).slice(0, 40).map(a => (
                <li key={a.c + a.k} className="px-4 py-2 text-[13.5px] flex flex-wrap justify-between gap-x-3">
                  <span className="min-w-0"><span className="text-brand-ink">{a.n}</span> <span className="text-sub text-[12.5px]">{courseName(a.c)}</span></span>
                  <span className="text-sub text-[12.5px] tabular-nums">{a.progs} งาน · ล่าสุด {shortDate(a.last)}{a.cat ? '' : ' · ยังไม่อยู่ในคลังเว็บ'}</span>
                </li>))}
            </ol>
          )}
          {tab === 'tpl' && (
            <div className="p-4">
              <p className="text-[13px] text-sub mb-2">หลักสูตร × ระยะเวลาที่ขายจริง เทียบกับแม่แบบของทีม — แถวที่ "ยังไม่มีแม่แบบ" ตอนนี้ระบบจัดกำหนดการให้อัตโนมัติ ถ้าขายบ่อย ควรตั้งโปรแกรมจริงที่ดีที่สุดเป็นแม่แบบ (ในขั้นกำหนดการกด "ใช้เป็นแม่แบบ" ได้ทันที)</p>
              <div className="overflow-x-auto"><table className="w-full text-[13px]">
                <thead><tr className="text-left text-sub border-b border-brand-mist"><th className="py-1.5 pr-2 font-medium">หลักสูตร</th><th className="py-1.5 pr-2 font-medium">ระยะเวลา</th><th className="py-1.5 pr-2 font-medium text-right">ขายจริง</th><th className="py-1.5 pr-2 font-medium">ล่าสุด</th><th className="py-1.5 font-medium">แม่แบบทีม</th></tr></thead>
                <tbody>{cov.filter(r => r.real > 0).map(r => (
                  <tr key={r.course + r.dk} className="border-b border-brand-mist/60">
                    <td className="py-1.5 pr-2">{courseName(r.course)}</td><td className="py-1.5 pr-2">{DUR_LABEL[r.dk] || r.dk}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{r.real}</td><td className="py-1.5 pr-2 whitespace-nowrap">{shortDate(r.last)}</td>
                    <td className="py-1.5">{r.tpl ? `มี ${r.tpl} แบบ` : <span className="text-amber-800">ยังไม่มีแม่แบบ</span>}</td>
                  </tr>))}</tbody>
              </table></div>
            </div>
          )}
          {tab === 'venue' && (
            <ul className="divide-y divide-brand-mist">
              {idx.venues.slice(0, 40).map(v => (
                <li key={v.name} className="px-4 py-2 text-[13.5px] flex flex-wrap justify-between gap-x-3">
                  <span className="min-w-0 inline-flex items-start gap-1.5"><MapPin className="w-3.5 h-3.5 mt-1 text-sub shrink-0" /><span><span className="text-brand-ink">{v.name}</span>{v.province && <span className="text-sub text-[12.5px]"> · {v.province}</span>}{!v.known && <span className="ml-1.5 text-[11.5px] px-1.5 rounded bg-paper text-sub">ยังไม่อยู่ในทำเนียบ</span>}</span></span>
                  <span className="text-sub text-[12.5px] tabular-nums">{v.progs} งาน · ล่าสุด {shortDate(v.last)}</span>
                </li>))}
              {!idx.venues.length && <li className="px-4 py-3 text-[13.5px] text-sub">ยังไม่พบชื่อที่พักในโปรแกรมที่อ่าน</li>}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
