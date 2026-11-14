import React, { useMemo, useState } from 'react';
import { ArrowRight, Check, Search, Lock, Monitor, Smartphone, WifiOff, FileText, Receipt, Hotel, ClipboardList } from 'lucide-react';
import { COURSES, LIB, COURSE_PHOTOS, SUBJECTS, Subject } from '../src/eqcamp-core';
import { BRAND } from '../src/brand-data';
import { splitName } from './DataHub';
import { IS_IOS } from './platform';

/* หน้าแรก (เทมเพลตแนวเว็บคอร์สเรียน): เมนูบน → ฮีโร่ → แคตตาล็อกหลักสูตรพื้นกรมท่า (ชิปหมวด + การ์ด) → เอกสาร 4 ชิ้น → ขั้นตอน → อุปกรณ์ → ท้ายเว็บ
 * ทุกตัวเลข/ชื่อดึงจากข้อมูลจริงในระบบ (COURSES / LIB / COURSE_PHOTOS) — ไม่มีตัวเลขสมมติ */

// สีปกการ์ดตามกลุ่มวิชา (โทนหม่น อ่านตัวขาวชัด) — ใช้แทนภาพเมื่อหลักสูตรยังไม่มีภาพจริง
const TONE: Record<string, string> = { math: '#1F4E79', steam: '#1E6B5C', english: '#7A3B2E', ai: '#3B3F8F', chinese: '#8C2F39', leadership: '#8A6418' };
const famLabel = (f: string) => (SUBJECTS as any)[f]?.label || f;
const shortCode = (code: string) => code.replace(/^PL\s+/, '');
const PHOTO_TARGET = 6;

export const DOC_GUIDE = [
  { id: 'program', icon: FileText, name: 'โปรแกรมค่าย (PL)', who: 'ส่งโรงเรียน', items: ['วัตถุประสงค์ 4 ข้อ และกิจกรรมเชิงบูรณาการ', 'กำหนดการรายวัน', 'ราคาและรายละเอียดงบประมาณ', 'ภาพกิจกรรมและที่พัก'], fmt: ['Word', 'PDF'] },
  { id: 'quotation', icon: Receipt, name: 'ใบเสนอราคา', who: 'ส่งโรงเรียน', items: ['รายการ จำนวน ราคาต่อท่าน', 'ยอดรวมและเงื่อนไข', 'ช่องลงนามผู้เสนอราคา'], fmt: ['Word'] },
  { id: 'booking', icon: Hotel, name: 'หนังสือขอราคาโรงแรม', who: 'ส่งโรงแรม/ที่พัก', items: ['วันที่ จำนวนคน มื้ออาหาร', 'ห้องพักและห้องประชุม', 'ไม่แสดงราคาขายหรือต้นทุน'], fmt: ['Word'] },
  { id: 'runsheet', icon: ClipboardList, name: 'Run-down ทีมงาน', who: 'ภายในทีมเท่านั้น', internal: true, items: ['กำหนดการพร้อมช่องผู้รับผิดชอบ', 'ต้นทุน กำไร และ Margin', 'ห้ามส่งให้ลูกค้า'], fmt: ['Word'] }
] as const;

type Props = { onStartBrief: () => void; onUseCourse: (code: string) => void; onOpenCourse: (code: string) => void; installPrompt: any; onInstall: () => void };

export default function Home({ onStartBrief, onUseCourse, onOpenCourse, installPrompt, onInstall }: Props) {
  const [fam, setFam] = useState<string>('');
  const [q, setQ] = useState('');

  const stats = useMemo(() => {
    const rows = COURSES.map(c => {
      const acts = LIB.filter(a => a.courseCode === c.code);
      const photos = COURSE_PHOTOS[c.code] || [];
      return { c, nm: splitName(c.name), acts: acts.length, core: acts.filter(a => a.kind === 'core').length, photos };
    });
    const fams = Array.from(new Set(COURSES.map(c => c.family)));
    return { rows, fams, acts: rows.reduce((n, r) => n + r.acts, 0), photos: rows.reduce((n, r) => n + r.photos.length, 0) };
  }, []);

  const list = stats.rows.filter(r => (!fam || r.c.family === fam) && (!q.trim() || (r.c.name + ' ' + r.c.code).toLowerCase().includes(q.trim().toLowerCase())));
  const mat = COURSES.find(c => c.code === 'PL MAT 0107') || COURSES[0];
  const matNm = splitName(mat.name);
  const toCatalog = () => { try { document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' }); } catch { /* ignore */ } };

  return (
    <div>
      {/* ฮีโร่ */}
      <section className="bg-brand-navy text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-14 lg:pt-16 lg:pb-20 grid lg:grid-cols-12 gap-10 lg:gap-8 items-center">
          <div className="lg:col-span-7">
            <h1 className="text-[30px] sm:text-[42px] lg:text-[46px] leading-[1.2] font-semibold tracking-tight">เอกสารเสนอค่ายวิชาการ<br />ครบชุด จากบรีฟเดียว</h1>
            <p className="mt-5 text-[16px] sm:text-[17.5px] leading-relaxed text-white/75 max-w-xl">
              วางบรีฟจากลูกค้า แล้วได้โปรแกรมค่าย ใบเสนอราคา หนังสือขอราคาโรงแรม และ Run-down ทีมงาน เป็นไฟล์ Word และ PDF ตามรูปแบบเอกสารจริงของ EQ Camp
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <button onClick={onStartBrief} className="tap inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-accent hover:bg-accent-deep text-white text-[16px] font-semibold">
                เริ่มจากบรีฟลูกค้า<ArrowRight className="w-4 h-4" />
              </button>
              <button onClick={toCatalog} className="tap inline-flex items-center justify-center px-6 py-3.5 rounded-xl ring-1 ring-white/30 hover:bg-white/10 text-white text-[16px] font-medium">เลือกหลักสูตร</button>
            </div>
            <ul className="mt-8 grid sm:grid-cols-3 gap-x-6 gap-y-2 text-[14px] text-white/70">
              {['ตรงรูปแบบเอกสารจริงของทีม', 'ราคาขายกับต้นทุนแยกไฟล์เสมอ', 'ใช้ได้ทั้งคอมและมือถือ'].map(t => (
                <li key={t} className="flex items-start gap-2"><Check className="w-4 h-4 mt-1 shrink-0 text-accent" />{t}</li>
              ))}
            </ul>
          </div>

          {/* ตัวอย่างเอกสารจริง (ย่อส่วน) — สิ่งที่ระบบสร้างให้ */}
          <div className="lg:col-span-5 flex justify-center lg:justify-end" aria-hidden="true">
            <div className="relative w-[230px] sm:w-[330px] aspect-[1/1.414] mr-6 sm:mr-8 mt-6">
              <div className="absolute inset-0 translate-x-6 -translate-y-6 sm:translate-x-8 sm:-translate-y-8 bg-white/90 rounded-md shadow-paper p-4 font-doc text-brand-ink">
                <div className="text-center text-[11px] font-semibold">ใบเสนอราคา</div>
              </div>
              <div className="absolute inset-0 translate-x-3 -translate-y-3 sm:translate-x-4 sm:-translate-y-4 bg-white/95 rounded-md shadow-paper p-4 font-doc text-brand-ink">
                <div className="text-center text-[11px] font-semibold">กำหนดการ</div>
              </div>
              <div className="absolute inset-0 bg-white rounded-md shadow-paper px-5 py-4 sm:px-6 sm:py-5 font-doc text-brand-ink text-[9.5px] sm:text-[11px] leading-[1.45] overflow-hidden">
                <div className="flex items-center justify-between border-b-2 border-brand-navy pb-1.5 mb-2">
                  <img src={`data:image/png;base64,${BRAND.logoB64}`} alt="" className="h-6 sm:h-7 w-auto" />
                  <span className="text-[8px] sm:text-[9px] text-sub">{BRAND.phone.split('/')[0].trim()}</span>
                </div>
                <div className="text-right">{mat.code}/2569</div>
                <div className="text-center font-semibold text-[11.5px] sm:text-[13px] mt-1">หลักสูตร “{matNm.th}”</div>
                <div className="text-center font-semibold text-[11.5px] sm:text-[13px]">( {matNm.en} )</div>
                <div className="font-semibold mt-2">วัตถุประสงค์การเรียนรู้</div>
                <p className="indent-5">1.{mat.obj1}</p>
                <p className="indent-5 line-clamp-2">2.{mat.obj2}</p>
                <div className="mt-1.5 grid grid-cols-[4.5em_1fr]"><b>จำนวน</b><span>นักเรียน 120 คน</span><b>ระยะเวลา</b><span>3 วัน 2 คืน</span></div>
                <div className="font-semibold mt-1.5">กิจกรรมเชิงบูรณาการ</div>
                <p className="pl-5">1.กิจกรรมระดมสมองประลองปัญญา</p>
                <p className="pl-5">2.กิจกรรม “Creative Learning Station”</p>
                <p className="pl-5">3.กิจกรรมระดมสมอง ถอดบทเรียน</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* แคตตาล็อกหลักสูตร */}
      <section id="catalog" className="bg-brand-deep text-white scroll-mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 lg:py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-[26px] sm:text-[32px] font-semibold leading-tight">{COURSES.length} หลักสูตรค่าย ใน {stats.fams.length} กลุ่มวิชา</h2>
              <p className="mt-2 text-[15px] text-white/65">กิจกรรมในคลัง {stats.acts.toLocaleString()} รายการ (ทุกรายการรอทีมตรวจ) · ภาพกิจกรรมจริง {stats.photos} รูป</p>
            </div>
            <label className="relative w-full sm:w-72">
              <span className="sr-only">ค้นหาหลักสูตร</span>
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/50" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหาชื่อหรือรหัส เช่น MAT, ทะเล"
                className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white/10 ring-1 ring-white/15 placeholder:text-white/45 text-white text-[15px] focus:outline-none focus:ring-white/40" />
            </label>
          </div>

          <div role="radiogroup" aria-label="กลุ่มวิชา" className="mt-6 -mx-4 px-4 sm:mx-0 sm:px-0 flex gap-2 overflow-x-auto noscrollbar">
            {[['', 'ทั้งหมด', COURSES.length] as const, ...stats.fams.map(f => [f, famLabel(f), COURSES.filter(c => c.family === f).length] as const)].map(([id, l, n]) => (
              <button key={id || 'all'} role="radio" aria-checked={fam === id} onClick={() => setFam(id)}
                className={`tap shrink-0 px-4 py-2 rounded-full text-[14px] whitespace-nowrap ${fam === id ? 'bg-white text-brand-navy font-semibold' : 'ring-1 ring-white/25 text-white/85 hover:bg-white/10 font-medium'}`}>
                {l} <span className={fam === id ? 'text-brand-navy/60' : 'text-white/50'}>{n}</span>
              </button>
            ))}
          </div>

          {list.length === 0 ? (
            <div className="mt-8 rounded-xl ring-1 ring-white/15 p-8 text-center">
              <p className="text-[16px]">ไม่พบหลักสูตรที่ตรงกับ “{q}”</p>
              <button onClick={() => { setQ(''); setFam(''); }} className="tap mt-3 px-4 py-2 rounded-lg bg-white text-brand-navy text-[14px] font-semibold">ดูหลักสูตรทั้งหมด</button>
            </div>
          ) : (
            <ul className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {list.map(({ c, nm, acts, core, photos }) => (
                <li key={c.code} className="bg-white text-brand-ink rounded-xl overflow-hidden flex sm:flex-col">
                  <button onClick={() => onOpenCourse(c.code)} className="block text-left shrink-0 w-[108px] sm:w-full" aria-label={`ดูข้อมูลหลักสูตร ${nm.th}`}>
                    {photos.length ? (
                      <img src={`data:image/jpeg;base64,${photos[0].b64}`} alt="" loading="lazy" className="w-full h-full sm:h-auto sm:aspect-[16/10] object-cover bg-paper" />
                    ) : (
                      <div className="w-full h-full sm:h-auto sm:aspect-[16/10] p-3 sm:p-4 flex flex-col justify-end sm:justify-between text-white" style={{ background: TONE[c.family] || '#0C2A41' }}>
                        <span className="hidden sm:block text-[13px] text-white/75">{famLabel(c.family)}</span>
                        <div>
                          <div className="text-[19px] sm:text-[30px] font-semibold leading-none tracking-tight">{shortCode(c.code)}</div>
                          <div className="hidden sm:block mt-2 text-[13px] text-white/85 truncate">{nm.en || nm.th}</div>
                        </div>
                      </div>
                    )}
                  </button>
                  <div className="p-3.5 sm:p-4 flex-1 min-w-0 flex flex-col">
                    <div className="text-[13px] text-sub truncate">{c.code} · {famLabel(c.family)}</div>
                    <h3 className="mt-1 text-[16.5px] font-semibold leading-snug clamp2">{nm.th}</h3>
                    {nm.en && <p className="text-[13.5px] text-sub truncate">{nm.en}</p>}
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-[13px]">
                      <div className="rounded-lg bg-paper px-2.5 py-1.5"><dt className="text-sub">กิจกรรม</dt><dd className="font-semibold">{acts} <span className="font-normal text-sub">(หลัก {core})</span></dd></div>
                      <div className="rounded-lg bg-paper px-2.5 py-1.5"><dt className="text-sub">ภาพจริง</dt>
                        <dd className={`font-semibold ${photos.length >= PHOTO_TARGET ? '' : 'text-amber-700'}`}>{photos.length ? `${photos.length}/${PHOTO_TARGET}` : 'ยังไม่มี'}</dd></div>
                    </dl>
                    <div className="mt-auto pt-3 sm:pt-4 flex gap-2">
                      <button onClick={() => onOpenCourse(c.code)} className="tap px-3 sm:px-3.5 py-2.5 rounded-lg border border-brand-mist hover:bg-paper text-[14px] font-medium">รายละเอียด</button>
                      <button onClick={() => onUseCourse(c.code)} className="tap flex-1 px-3.5 py-2.5 rounded-lg bg-accent hover:bg-accent-deep text-white text-[14px] font-semibold">สร้างเอกสาร</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* เอกสาร 4 ชิ้น */}
      <section className="bg-paper">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 lg:py-16">
          <h2 className="text-[26px] sm:text-[32px] font-semibold leading-tight">หนึ่งงาน ได้เอกสาร 4 ชิ้น</h2>
          <p className="mt-2 text-[15.5px] text-sub max-w-2xl">กรอกข้อมูลครั้งเดียว ทุกไฟล์ใช้ชื่อโรงเรียน จำนวนคน วันที่ และกำหนดการชุดเดียวกัน ส่วนราคาและต้นทุนแยกตามผู้รับเอกสาร</p>
          <ul className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {DOC_GUIDE.map(d => (
              <li key={d.id} className="bg-white rounded-xl border border-brand-mist p-5 flex flex-col">
                <div className="flex items-center justify-between">
                  <d.icon className="w-6 h-6 text-brand-navy" />
                  <span className={`inline-flex items-center gap-1 text-[12.5px] px-2.5 py-1 rounded-full ${'internal' in d && d.internal ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-200' : 'bg-paper text-sub'}`}>
                    {'internal' in d && d.internal && <Lock className="w-3 h-3" />}{d.who}
                  </span>
                </div>
                <h3 className="mt-4 text-[17px] font-semibold">{d.name}</h3>
                <ul className="mt-3 space-y-1.5 text-[14px] text-brand-ink/85 flex-1">
                  {d.items.map(t => <li key={t} className="flex gap-2"><Check className="w-4 h-4 mt-1 shrink-0 text-brand-navy/60" />{t}</li>)}
                </ul>
                <div className="mt-4 pt-3 border-t border-brand-mist text-[13px] text-sub">ไฟล์ {d.fmt.join(' และ ')}</div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ขั้นตอน (เป็นลำดับจริง จึงมีหมายเลข) */}
      <section className="bg-white border-y border-brand-mist">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 lg:py-16 grid lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4">
            <h2 className="text-[26px] sm:text-[32px] font-semibold leading-tight">จากบรีฟถึงไฟล์ ใน 3 ขั้น</h2>
            <p className="mt-2 text-[15.5px] text-sub">ระบบเตือนข้อมูลที่ยังขาดก่อนดาวน์โหลด และไม่เดาข้อมูลที่บรีฟไม่ได้บอก</p>
            <button onClick={onStartBrief} className="tap mt-6 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-brand-navy hover:opacity-90 text-white text-[15px] font-semibold">เริ่มสร้างเอกสาร<ArrowRight className="w-4 h-4" /></button>
          </div>
          <ol className="lg:col-span-8 grid sm:grid-cols-3 gap-6">
            {[
              ['วางบรีฟ', 'ระบบอ่านรหัส PL ชื่อโรงเรียน จำนวนคน ระยะเวลา วันที่ สถานที่ และราคาจากข้อความลูกค้า'],
              ['ตรวจและปรับ', 'เลือกหลักสูตร กิจกรรมรายช่วง กำหนดการ ราคาและงบ ภาพประกอบ ดูตัวอย่างเอกสารไปพร้อมกัน'],
              ['ดาวน์โหลด', 'ได้ไฟล์ Word ทีละไฟล์หรือครบชุด 4 ไฟล์ และโปรแกรมค่ายเป็น PDF พร้อมส่ง']
            ].map(([t, d], i) => (
              <li key={t} className="border-t-2 border-brand-navy pt-4">
                <div className="text-[34px] font-semibold text-brand-navy leading-none">{i + 1}</div>
                <h3 className="mt-3 text-[17px] font-semibold">{t}</h3>
                <p className="mt-1.5 text-[14.5px] text-sub leading-relaxed">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ใช้ได้ทุกอุปกรณ์ */}
      <section className="bg-paper">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 lg:py-14">
          <h2 className="text-[22px] sm:text-[26px] font-semibold">ใช้ได้ทุกอุปกรณ์</h2>
          <ul className="mt-6 grid md:grid-cols-3 gap-4">
            {[
              { icon: Monitor, t: 'คอมพิวเตอร์', d: 'Windows และ Mac บน Chrome, Edge, Safari, Firefox' },
              { icon: Smartphone, t: 'มือถือและแท็บเล็ต', d: 'iPhone, iPad, Android — เปิดลิงก์จาก LINE หรือ Facebook ให้กด "เปิดในเบราว์เซอร์" ก่อนดาวน์โหลด' },
              { icon: WifiOff, t: 'ไม่มีเน็ตก็เปิดได้', d: 'หลังเปิดครั้งแรก เครื่องจะเก็บระบบไว้ใช้ต่อ และเพิ่มไอคอนลงหน้าจอหลักได้' }
            ].map(x => (
              <li key={x.t} className="bg-white rounded-xl border border-brand-mist p-5 flex gap-4">
                <x.icon className="w-6 h-6 shrink-0 text-brand-navy mt-0.5" />
                <div><h3 className="text-[16px] font-semibold">{x.t}</h3><p className="mt-1 text-[14px] text-sub leading-relaxed">{x.d}</p></div>
              </li>
            ))}
          </ul>
          {installPrompt ? (
            <button onClick={onInstall} className="tap mt-5 px-5 py-2.5 rounded-xl bg-brand-navy text-white text-[14.5px] font-semibold">เพิ่ม EQ Camp ลงหน้าจอหลัก</button>
          ) : IS_IOS ? (
            <p className="mt-5 text-[14px] text-sub">iPhone/iPad: เปิดใน Safari แล้วกดปุ่มแชร์ เลือก “เพิ่มไปยังหน้าจอโฮม”</p>
          ) : null}
        </div>
      </section>

      {/* ท้ายเว็บ */}
      <footer className="bg-brand-navy text-white/75">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 grid md:grid-cols-12 gap-8 text-[14px]">
          <div className="md:col-span-6 flex gap-4">
            <img src={`data:image/png;base64,${BRAND.logoB64}`} alt="EQ Camp" className="h-14 w-auto bg-white rounded-lg p-1.5" />
            <div>
              <div className="text-white text-[16px] font-semibold">{BRAND.name}</div>
              <p className="mt-1 leading-relaxed">{BRAND.address}</p>
            </div>
          </div>
          <dl className="md:col-span-6 grid grid-cols-[5em_1fr] gap-y-1.5">
            <dt className="text-white/50">โทร</dt><dd>{BRAND.phone}</dd>
            <dt className="text-white/50">เว็บไซต์</dt><dd>{BRAND.web}</dd>
            <dt className="text-white/50">อีเมล</dt><dd className="break-all">{BRAND.email}</dd>
          </dl>
        </div>
        <div className="border-t border-white/10 safe-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 text-[13px] text-white/50">เครื่องมือภายในทีมขาย EQ Camp · ข้อมูลหลักสูตรและกิจกรรมจากชุดข้อมูลขายของทีม</div>
        </div>
      </footer>
    </div>
  );
}
