import React, { useMemo, useState } from 'react';
import { Search, ExternalLink, FolderOpen, ArrowRight, MapPin, Phone, Image as ImageIcon, BookOpen, Building2, Tag, Layers } from 'lucide-react';
import { COURSES, LIB, COURSE_PHOTOS, PRESETS, SUBJECTS, BRANCHES, SALES_KIT, driveFolder, money, Kind, Subject } from '../src/eqcamp-core';

/* คลังข้อมูลขาย — ข้อมูลทั้งหมดที่เครื่องมือใช้ อยู่หน้าเดียว เปิดดู ค้นหา แล้วกดใช้สร้างเอกสารต่อได้ทันที
 * แหล่งแก้ไขจริง = ชุดข้อมูลขายใน Drive (SALES_KIT) — หน้านี้แสดงเวอร์ชันที่ฝังอยู่ในเครื่องมือตอนนี้ */

type VenueRec = { province: string; name: string; visit: string; note: string };
const KIND_TH: Record<Kind, string> = { opening: 'เปิด/สันทนาการ', core: 'กิจกรรมหลัก', night: 'ภาคค่ำ', recreation: 'สันทนาการ', closing: 'ปิด/สรุป' };
const SECTIONS = [
  { id: 'overview', label: 'ภาพรวม' },
  { id: 'courses', label: 'หลักสูตร' },
  { id: 'activities', label: 'กิจกรรม' },
  { id: 'venues', label: 'ที่พัก' },
  { id: 'prices', label: 'ราคา & แม่แบบ' },
  { id: 'company', label: 'บริษัท-สาขา' }
] as const;
type Sec = typeof SECTIONS[number]['id'];

const splitName = (n: string) => { const m = n.replace(/^หลักสูตร/, '').match(/^(.*?)\s*\(([^)]*)\)\s*$/); return m ? { th: m[1], en: m[2] } : { th: n, en: '' }; };
const card = 'bg-white rounded-xl border border-brand-mist';

export default function DataHub({ venues, currentCourse, currentVenue, onUseCourse, onUseVenue, onUsePreset }: {
  venues: VenueRec[]; currentCourse?: string; currentVenue?: string;
  onUseCourse: (code: string) => void; onUseVenue: (v: VenueRec) => void; onUsePreset: (id: string) => void;
}) {
  const [sec, setSec] = useState<Sec>('overview');
  const [open, setOpen] = useState<string | null>(currentCourse || null);
  const [q, setQ] = useState('');
  const [fCourse, setFCourse] = useState('');
  const [fKind, setFKind] = useState<'' | Kind>('');

  const courseActs = useMemo(() => Object.fromEntries(COURSES.map(c => [c.code, LIB.filter(a => a.courseCode === c.code)])), []);
  const totalActs = LIB.filter(a => a.courseCode).length;
  const photoTotal = COURSES.reduce((n, c) => n + (COURSE_PHOTOS[c.code]?.length || 0), 0);
  const coursesFull = COURSES.filter(c => (COURSE_PHOTOS[c.code]?.length || 0) >= 6).length;

  const actRows = useMemo(() => {
    const k = q.trim().toLowerCase();
    return LIB.filter(a => a.courseCode && (!fCourse || a.courseCode === fCourse) && (!fKind || a.kind === fKind) && (!k || a.title.toLowerCase().includes(k) || a.courseCode!.toLowerCase().includes(k)));
  }, [q, fCourse, fKind]);

  const go = (s: Sec) => { setSec(s); try { window.scrollTo({ top: 0 }); } catch { /* ignore */ } };

  return (
    <div className="space-y-4">
      {/* หัวคลัง + ทางไปแก้ไข */}
      <div className={`${card} p-4 sm:p-5 flex flex-wrap items-start justify-between gap-3`}>
        <div className="min-w-0">
          <h2 className="text-[19px] font-semibold leading-snug">คลังข้อมูลขาย EQ Camp</h2>
          <p className="text-[14px] text-sub mt-0.5">ข้อมูลทุกอย่างที่ใช้ทำเอกสาร อยู่ในหน้านี้ — เลือกแล้วกด "ใช้" ระบบจะพาไปสร้างโปรแกรมต่อทันที</p>
        </div>
        <a href={SALES_KIT.folder} target="_blank" rel="noopener noreferrer"
          className="tap shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-brand-mist text-[14px] font-medium hover:bg-paper">
          <FolderOpen className="w-4 h-4" />แก้ไขข้อมูลใน Drive
        </a>
      </div>

      {/* เมนูหมวด */}
      <nav aria-label="หมวดข้อมูล" className={`${card} p-1.5 flex flex-wrap gap-1`}>
        {SECTIONS.map(s => (
          <button key={s.id} onClick={() => go(s.id)} aria-current={sec === s.id ? 'page' : undefined}
            className={`tap px-3.5 py-2 rounded-lg text-[14px] ${sec === s.id ? 'bg-brand-navy text-white font-semibold' : 'text-brand-ink hover:bg-paper font-medium'}`}>{s.label}</button>
        ))}
      </nav>

      {sec === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { n: COURSES.length, l: 'หลักสูตร', s: 'รหัส PL จริงตามทะเบียน', go: 'courses' as Sec },
              { n: totalActs, l: 'กิจกรรม', s: 'ทั้งหมดสถานะ "รอตรวจ"', go: 'activities' as Sec },
              { n: venues.length, l: 'ที่พัก', s: 'ภาพโรงแรมยังไม่มี (0/8)', go: 'venues' as Sec },
              { n: photoTotal, l: 'ภาพกิจกรรมจริง', s: `ครบ 6 รูปขึ้นไป ${coursesFull}/${COURSES.length} หลักสูตร`, go: 'courses' as Sec }
            ].map(t => (
              <button key={t.l} onClick={() => go(t.go)} className={`${card} tap text-left p-4 hover:border-brand/40`}>
                <div className="text-[28px] font-semibold text-brand-navy leading-none">{t.n}</div>
                <div className="text-[14.5px] font-medium mt-2">{t.l}</div>
                <div className="text-[12.5px] text-sub mt-0.5">{t.s}</div>
              </button>
            ))}
          </div>

          <div className={`${card} p-4 sm:p-5`}>
            <h3 className="text-[16px] font-semibold">ความพร้อมรายหลักสูตร</h3>
            <p className="text-[13px] text-sub mt-0.5 mb-3">ภาพในเอกสารควรมี 6–8 รูป · ช่องที่ยังไม่ครบ ทีมเติมในโฟลเดอร์ Drive ของหลักสูตรนั้น</p>
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-[13.5px] min-w-[560px]">
                <thead><tr className="text-left text-sub border-b border-brand-mist">
                  <th className="py-2 px-1 font-medium">หลักสูตร</th><th className="py-2 px-1 font-medium">กิจกรรม</th><th className="py-2 px-1 font-medium">ภาพจริง</th><th className="py-2 px-1 font-medium">อนุมัติแล้ว</th><th className="py-2 px-1"></th>
                </tr></thead>
                <tbody>
                  {COURSES.slice().sort((a, b) => a.code.slice(-4).localeCompare(b.code.slice(-4))).map(c => {
                    const nP = COURSE_PHOTOS[c.code]?.length || 0; const nm = splitName(c.name);
                    return (
                      <tr key={c.code} className="border-b border-brand-mist/70 last:border-0">
                        <td className="py-2 px-1"><div className="font-medium">{nm.th}</div><div className="text-[12px] text-sub">{c.code}</div></td>
                        <td className="py-2 px-1">{courseActs[c.code].length}</td>
                        <td className="py-2 px-1"><span className={nP >= 6 ? 'text-emerald-700 font-medium' : nP ? 'text-amber-700 font-medium' : 'text-rose-700 font-medium'}>{nP}/8</span></td>
                        <td className="py-2 px-1 text-sub">0/{courseActs[c.code].length}</td>
                        <td className="py-2 px-1 text-right"><button onClick={() => { setOpen(c.code); go('courses'); }} className="tap text-[13px] text-brand-navy underline underline-offset-2">ดูข้อมูล</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className={`${card} p-4 sm:p-5`}>
            <h3 className="text-[16px] font-semibold">แก้ไขข้อมูล</h3>
            <p className="text-[13px] text-sub mt-0.5 mb-3">ทีมแก้ในชีตเหล่านี้ แล้วแจ้ง Claude ว่า "อัปเดตข้อมูล" — หน้านี้และเอกสารทุกฉบับจะเปลี่ยนตาม (ต้นทุน/กำไรอยู่ในโฟลเดอร์ภายในแยกต่างหาก ไม่ลิงก์จากเว็บนี้)</p>
            <div className="flex flex-wrap gap-2">
              {SALES_KIT.sheets.map(s => (
                <a key={s.label} href={s.url} target="_blank" rel="noopener noreferrer" className="tap inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-paper border border-brand-mist text-[13.5px] hover:border-brand/40">
                  {s.label}<ExternalLink className="w-3.5 h-3.5 text-sub" />
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {sec === 'courses' && (
        <div className="space-y-2.5">
          {COURSES.slice().sort((a, b) => a.code.slice(-4).localeCompare(b.code.slice(-4))).map(c => {
            const nm = splitName(c.name); const acts = courseActs[c.code]; const photos = COURSE_PHOTOS[c.code] || [];
            const isOpen = open === c.code; const isCur = currentCourse === c.code;
            return (
              <section key={c.code} className={`${card} ${isCur ? 'ring-1 ring-brand-navy border-brand-navy' : ''}`}>
                <button onClick={() => setOpen(isOpen ? null : c.code)} aria-expanded={isOpen} className="tap w-full text-left p-4 flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 text-[12.5px] text-sub">
                      <span className="font-medium">{c.code}</span><span>{SUBJECTS[c.family as Subject]?.label || c.family}</span>
                      {isCur && <span className="text-brand-navy font-semibold">กำลังใช้ในเอกสาร</span>}
                    </div>
                    <div className="text-[16px] font-semibold leading-snug mt-0.5">{nm.th}</div>
                    {nm.en && <div className="text-[13.5px] text-sub">{nm.en}</div>}
                  </div>
                  <div className="text-right text-[12.5px] text-sub shrink-0 leading-relaxed">กิจกรรม {acts.length}<br />ภาพ {photos.length}/8</div>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 space-y-4 border-t border-brand-mist pt-4">
                    <div>
                      <h4 className="text-[13.5px] font-semibold text-sub mb-1">วัตถุประสงค์ (ข้อ 1–2 ในเอกสาร)</h4>
                      <ol className="text-[14px] space-y-1 list-decimal ml-5"><li>{c.obj1}</li><li>{c.obj2}</li></ol>
                    </div>
                    <div>
                      <h4 className="text-[13.5px] font-semibold text-sub mb-1">กิจกรรม {acts.length} รายการ <span className="font-normal text-amber-700">· รอตรวจ ทีมยืนยันก่อนจัดจริง</span></h4>
                      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
                        {(['opening', 'core', 'night', 'closing'] as Kind[]).map(k => {
                          const items = acts.filter(a => a.kind === k); if (!items.length) return null;
                          return <div key={k}><div className="text-[12.5px] font-medium text-sub">{KIND_TH[k]} ({items.length})</div>
                            <ul className="text-[13.5px] mt-0.5 space-y-0.5">{items.map(a => <li key={a.id} className="leading-snug">{a.title}</li>)}</ul></div>;
                        })}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-[13.5px] font-semibold text-sub mb-1.5">ภาพกิจกรรมจริง {photos.length}/8 {photos.length < 6 && <span className="font-normal text-amber-700">· ต้องเติมอีก {6 - photos.length} รูปขึ้นไป</span>}</h4>
                      {photos.length ? (
                        <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                          {photos.map((p: any, i: number) => <img key={i} src={`data:image/jpeg;base64,${p.b64}`} alt={`ภาพกิจกรรม ${nm.th} ที่ ${i + 1}`} className="w-full aspect-[4/3] object-cover rounded-md bg-paper" loading="lazy" />)}
                        </div>
                      ) : <p className="text-[13.5px] text-sub">ยังไม่มีภาพ — ใส่ภาพในโฟลเดอร์ Drive ของหลักสูตรนี้</p>}
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button onClick={() => onUseCourse(c.code)} className="tap inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand-navy text-white text-[14px] font-semibold hover:opacity-90">
                        ใช้หลักสูตรนี้สร้างโปรแกรม<ArrowRight className="w-4 h-4" />
                      </button>
                      {SALES_KIT.courseFolders[c.code] && <a href={driveFolder(SALES_KIT.courseFolders[c.code])} target="_blank" rel="noopener noreferrer" className="tap inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-brand-mist text-[14px] hover:bg-paper"><ImageIcon className="w-4 h-4" />โฟลเดอร์ภาพ</a>}
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {sec === 'activities' && (
        <div className={`${card} p-4 sm:p-5 space-y-3`}>
          <div className="flex flex-wrap gap-2">
            <label className="relative flex-1 min-w-[200px]">
              <span className="sr-only">ค้นหากิจกรรม</span>
              <Search className="w-4 h-4 text-sub absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นชื่อกิจกรรม เช่น Rocket, ปะการัง, Leadership"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-brand-mist text-[15px] focus:outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15" />
            </label>
            <select value={fCourse} onChange={e => setFCourse(e.target.value)} aria-label="กรองตามหลักสูตร" className="w-full sm:w-auto sm:max-w-[280px] min-w-0 px-3 py-2.5 rounded-xl border border-brand-mist text-[14px] bg-white">
              <option value="">ทุกหลักสูตร</option>
              {COURSES.map(c => <option key={c.code} value={c.code}>{c.code} · {splitName(c.name).th}</option>)}
            </select>
            <select value={fKind} onChange={e => setFKind(e.target.value as any)} aria-label="กรองตามช่วง" className="w-full sm:w-auto px-3 py-2.5 rounded-xl border border-brand-mist text-[14px] bg-white">
              <option value="">ทุกช่วง</option>
              {(['opening', 'core', 'night', 'closing'] as Kind[]).map(k => <option key={k} value={k}>{KIND_TH[k]}</option>)}
            </select>
          </div>
          <div className="text-[13px] text-sub">พบ {actRows.length} จาก {totalActs} รายการ · สถานะทั้งหมด "รอตรวจ" (ยังไม่มีขั้นตอน/อุปกรณ์/เวลา — ทีมเติมในชีตกิจกรรม)</div>
          <div className="overflow-x-auto -mx-1 max-h-[60vh] overflow-y-auto">
            <table className="w-full text-[13.5px] min-w-[560px]">
              <thead className="sticky top-0 bg-white"><tr className="text-left text-sub border-b border-brand-mist">
                <th className="py-2 px-1 font-medium">กิจกรรม</th><th className="py-2 px-1 font-medium">ช่วง</th><th className="py-2 px-1 font-medium">หลักสูตร</th><th className="py-2 px-1"></th>
              </tr></thead>
              <tbody>
                {actRows.map(a => (
                  <tr key={a.id} className="border-b border-brand-mist/70 last:border-0">
                    <td className="py-2 px-1 leading-snug">{a.title}</td>
                    <td className="py-2 px-1 text-sub whitespace-nowrap">{KIND_TH[a.kind]}</td>
                    <td className="py-2 px-1 text-sub whitespace-nowrap">{a.courseCode}</td>
                    <td className="py-2 px-1 text-right whitespace-nowrap"><button onClick={() => { setOpen(a.courseCode!); go('courses'); }} className="tap text-[13px] text-brand-navy underline underline-offset-2">ดูหลักสูตร</button></td>
                  </tr>
                ))}
                {!actRows.length && <tr><td colSpan={4} className="py-6 text-center text-sub">ไม่พบกิจกรรมที่ตรงกับคำค้น — ลองคำที่สั้นลง หรือเลือก "ทุกหลักสูตร"</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {sec === 'venues' && (
        <div className="grid sm:grid-cols-2 gap-3">
          {venues.map(v => {
            const isCur = currentVenue === v.name; const folder = driveFolder(SALES_KIT.venueFolders[v.name]);
            return (
              <section key={v.name} className={`${card} p-4 flex flex-col ${isCur ? 'ring-1 ring-brand-navy border-brand-navy' : ''}`}>
                <div className="flex items-center gap-1.5 text-[12.5px] text-sub"><MapPin className="w-3.5 h-3.5" />{v.province}{isCur && <span className="ml-1 text-brand-navy font-semibold">กำลังใช้ในเอกสาร</span>}</div>
                <h3 className="text-[16px] font-semibold leading-snug mt-0.5">{v.name}</h3>
                <dl className="text-[13.5px] mt-2 space-y-1.5 flex-1">
                  <div><dt className="text-sub text-[12.5px]">ศึกษาดูงานใกล้เคียง</dt><dd>{v.visit || '—'}</dd></div>
                  <div><dt className="text-sub text-[12.5px]">ผู้ติดต่อ / จุดเด่น</dt><dd className="flex items-start gap-1.5"><Phone className="w-3.5 h-3.5 mt-1 text-sub shrink-0" />{v.note || '—'}</dd></div>
                  <div><dt className="text-sub text-[12.5px]">ภาพบรรยากาศ</dt><dd className="text-amber-700">0/8 — ป้าย/มุมสูง 2 · ห้องพัก 2 · สระ 2 · ห้องประชุม 2</dd></div>
                </dl>
                <div className="flex flex-wrap gap-2 mt-3">
                  <button onClick={() => onUseVenue(v)} className="tap inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-navy text-white text-[14px] font-semibold hover:opacity-90">ใช้ที่พักนี้<ArrowRight className="w-4 h-4" /></button>
                  {folder && <a href={folder} target="_blank" rel="noopener noreferrer" className="tap inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-brand-mist text-[14px] hover:bg-paper"><ImageIcon className="w-4 h-4" />โฟลเดอร์ภาพ</a>}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {sec === 'prices' && (
        <div className="space-y-3">
          <div className={`${card} p-4 sm:p-5`}>
            <h3 className="text-[16px] font-semibold">แม่แบบงานจริง</h3>
            <p className="text-[13px] text-sub mt-0.5 mb-3">โหลดแล้วได้เอกสารครบทั้งชุดทันที แก้เฉพาะโรงเรียน/วันที่/จำนวน · ราคาเป็นตัวอย่างจากงานเดิม รอทีมยืนยันตารางราคากลางในชีตราคาขาย</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {PRESETS.map(p => (
                <div key={p.id} className="rounded-xl border border-brand-mist p-4 flex flex-col">
                  <div className="text-[12.5px] text-sub">{p.camp.days} วัน {p.camp.nights} คืน · {p.camp.students} คน · {p.camp.venue}</div>
                  <div className="text-[15px] font-semibold leading-snug mt-0.5">{p.label}</div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-[13.5px] text-sub line-through">{money(p.camp.normalPrice || 0)}</span>
                    <span className="text-[20px] font-semibold text-accent">{money(p.camp.specialPrice || 0)}</span>
                    <span className="text-[13px] text-sub">บาท/คน</span>
                  </div>
                  <button onClick={() => onUsePreset(p.id)} className="tap mt-3 self-start inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-navy text-white text-[14px] font-semibold hover:opacity-90">โหลดแม่แบบนี้<ArrowRight className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>
          <div className={`${card} p-4 sm:p-5 text-[14px]`}>
            <h3 className="text-[16px] font-semibold mb-1">ตารางราคากลาง</h3>
            <p className="text-sub">ยังไม่มีราคากลางที่ทีมยืนยัน (ครึ่งวัน · 1 วัน · 2 วัน 1 คืน · 3 วัน 2 คืน · 4 วัน 3 คืน) — เติมในชีต <a className="text-brand-navy underline underline-offset-2" href={SALES_KIT.sheets.find(s => s.label === 'ราคาขาย')!.url} target="_blank" rel="noopener noreferrer">ราคาขาย</a> แล้วระบบจะแสดงที่นี่</p>
          </div>
        </div>
      )}

      {sec === 'company' && (
        <div className="grid sm:grid-cols-2 gap-3">
          {BRANCHES.map(b => (
            <section key={b.region} className={`${card} p-4`}>
              <div className="flex items-center gap-1.5 text-[12.5px] text-sub"><Building2 className="w-3.5 h-3.5" />อีคิวแคมป์ (EQ CAMP)</div>
              <h3 className="text-[16px] font-semibold mt-0.5">{b.region}</h3>
              <p className={`text-[14px] mt-1.5 ${b.address ? '' : 'text-amber-700'}`}>{b.address || b.note}</p>
              {b.phone && <p className="text-[14px] mt-1 flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-sub" />{b.phone}</p>}
              {b.address && b.note && <p className="text-[12.5px] text-sub mt-1">{b.note}</p>}
            </section>
          ))}
          <section className={`${card} p-4 sm:col-span-2 text-[14px]`}>
            <span className="text-sub">เว็บไซต์</span> www.eqgroup.co.th · <span className="text-sub">อีเมล</span> info.eqgroup@gmail.com · หัวกระดาษเอกสารเลือกที่อยู่ตามภาคของจังหวัดที่จัดค่ายอัตโนมัติ
          </section>
        </div>
      )}
    </div>
  );
}
