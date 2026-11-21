// แผง "ส่งเข้า SME Move" — ข้อมูลใบเสนอราคาเรียงตามฟอร์มของ SME Move · แตะช่องไหนก็คัดลอกช่องนั้น · คัดลอกทั้งชุด · เปิด SME Move
import React, { useEffect, useMemo, useState } from 'react';
import { Copy, Check, ExternalLink, AlertTriangle, Settings, Bot } from 'lucide-react';
import type { Camp } from '../src/eqcamp-core';
import { smeQuote, smeText, smeAgentPrompt, SME_URL_KEY, SME_DEFAULT, fmtMoney, COLOR_NAME, COLOR_DESC, accountFor } from './sme-data';
import { teamConfig, loadTeamConfig } from './hub';
import type { TeamConfig } from './hub';
import { copyText } from './platform';

const getUrl = () => { try { const u = localStorage.getItem(SME_URL_KEY); return u && u !== 'https://smemove.com/' ? u : (teamConfig().sme?.url || SME_DEFAULT); } catch { return SME_DEFAULT; } };

type QC = NonNullable<Camp['quoteCustomer']>;
export default function SmeMovePanel({ camp, onChange }: { camp: Camp; onChange: (qc: QC) => void }) {
  const qc: QC = camp.quoteCustomer || {};
  const setQ = (k: keyof QC) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => onChange({ ...qc, [k]: e.target.value || undefined } as QC);
  const inp = 'mt-1 w-full px-3 py-2 rounded-lg border border-brand-mist text-[14px] text-brand-ink bg-white';
  const q = useMemo(() => smeQuote(camp), [camp]);
  const [done, setDone] = useState('');
  const [url, setUrl] = useState(getUrl);
  const [cfg, setCfg] = useState<TeamConfig>(teamConfig);
  useEffect(() => { let on = true; loadTeamConfig().then(c => { if (on) { setCfg(c); if (!localStorage.getItem(SME_URL_KEY) && c.sme?.url) setUrl(c.sme.url); } }); return () => { on = false; }; }, []);
  const account = accountFor(q.color, cfg);
  const pick = (vat: 'include' | 'exclude' | 'none') => onChange({ ...qc, vat } as QC);
  const [edit, setEdit] = useState(false);
  const cp = async (id: string, t: string) => { if (!t) return; if (await copyText(t)) { setDone(id); window.setTimeout(() => setDone(d => (d === id ? '' : d)), 1600); } };
  const Row = ({ id, label, value, missing, hint }: { id: string; label: string; value: string; missing?: boolean; hint?: string }) => (
    <li className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2 py-1.5">
      <span className="sm:w-36 shrink-0 text-[13px] text-sub sm:pt-1.5">{label}</span>
      {value ? (
        <button onClick={() => cp(id, value)} aria-label={`คัดลอก ${label}`} className="tap flex-1 min-w-0 text-left rounded-lg border border-brand-mist px-2.5 py-1.5 hover:bg-paper flex items-start gap-2">
          <span className="flex-1 min-w-0 text-[14px] whitespace-pre-wrap break-words">{value}</span>
          {done === id ? <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> : <Copy className="w-4 h-4 text-sub shrink-0 mt-0.5" />}
        </button>
      ) : <span className={`flex-1 text-[13.5px] sm:pt-1.5 ${missing ? 'text-amber-700' : 'text-sub'}`}>{hint || 'ไม่มีข้อมูล — กรอกเอง'}</span>}
    </li>
  );
  const l = q.lines[0];
  return (
    <section aria-label="ส่งเข้า SME Move" className="rounded-xl border border-brand-mist bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-[15.5px] font-semibold">ส่งใบเสนอราคาเข้า SME Move</h3>
          <p className="text-[13px] text-sub mt-0.5">SME Move ไม่มีช่องทางนำเข้าใบเสนอราคาอัตโนมัติ — แตะช่องเพื่อคัดลอก แล้ววางในฟอร์ม ขาย → ใบเสนอราคา → สร้างใบเสนอราคา</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => cp('all', smeText(q))} className="tap whitespace-nowrap px-3 py-2 rounded-lg border border-brand-mist hover:bg-paper text-[13.5px] font-medium flex items-center gap-1.5">{done === 'all' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}คัดลอกทั้งชุด</button>
          <a href={url} target="_blank" rel="noopener" className="tap whitespace-nowrap px-3 py-2 rounded-lg bg-brand-navy text-white text-[13.5px] font-medium flex items-center gap-1.5">เปิด SME Move{q.color ? (q.color === 'blue' ? ' (สีฟ้า)' : ' (สีส้ม)') : ''}<ExternalLink className="w-3.5 h-3.5" /></a>
          <button onClick={() => setEdit(e => !e)} aria-label="ตั้งลิงก์ SME Move ของบริษัท" aria-expanded={edit} className="tap p-2 rounded-lg border border-brand-mist hover:bg-paper"><Settings className="w-4 h-4" /></button>
        </div>
      </div>
      {edit && (
        <label className="mt-2 block text-[13px] text-sub">ลิงก์หน้าใบเสนอราคาใน SME Move ของบริษัท (จำไว้ในเครื่องนี้)
          <input value={url} onChange={e => { setUrl(e.target.value); try { localStorage.setItem(SME_URL_KEY, e.target.value.trim()); } catch { /* */ } }} placeholder={SME_DEFAULT}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-brand-mist text-[14px] text-brand-ink" inputMode="url" />
        </label>
      )}
      <div className="mt-3 grid sm:grid-cols-2 gap-2">
        <label className="text-[13px] text-sub sm:col-span-2">ที่อยู่โรงเรียน (ตามที่จะออกเอกสาร)<textarea value={qc.address || ''} onChange={setQ('address')} rows={2} className={inp} /></label>
        <label className="text-[13px] text-sub">เลขประจำตัวผู้เสียภาษี<input value={qc.taxId || ''} onChange={setQ('taxId')} inputMode="numeric" className={inp} /></label>
        <label className="text-[13px] text-sub">สาขา<input value={qc.branch || ''} onChange={setQ('branch')} placeholder="สำนักงานใหญ่" className={inp} /></label>
        <label className="text-[13px] text-sub">ผู้ติดต่อ<input value={qc.contact || ''} onChange={setQ('contact')} placeholder="เช่น ครูผู้ประสานงาน" className={inp} /></label>
        <label className="text-[13px] text-sub">โทร<input value={qc.phone || ''} onChange={setQ('phone')} inputMode="tel" className={inp} /></label>
        <label className="text-[13px] text-sub">อีเมลลูกค้า<input value={qc.email || ''} onChange={setQ('email')} type="email" autoCapitalize="off" className={inp} /></label>
      </div>
      <fieldset className="mt-3">
        <legend className="text-[13.5px] font-semibold">ชนิดใบเสนอราคา</legend>
        <div className="mt-1.5 grid sm:grid-cols-2 gap-2">
          {(['blue', 'orange'] as const).map(c => {
            const on = q.color === c, em = String(cfg.sme?.[c]?.email || '');
            return (
              <button key={c} type="button" aria-pressed={on} onClick={() => pick(c === 'orange' ? 'none' : (qc.vat === 'exclude' ? 'exclude' : 'include'))}
                className={`tap text-left rounded-xl border-2 px-3.5 py-3 ${on ? (c === 'blue' ? 'border-sky-600 bg-sky-50' : 'border-orange-500 bg-orange-50') : 'border-brand-mist hover:bg-paper'}`}>
                <span className="flex items-center gap-2 text-[15px] font-semibold"><span aria-hidden className={`w-3 h-3 rounded-full ${c === 'blue' ? 'bg-sky-600' : 'bg-orange-500'}`} />{COLOR_NAME[c]}</span>
                <span className="block text-[13px] text-sub mt-0.5">{COLOR_DESC[c]} · ออกจากบัญชี SME Move {em ? <b className="font-medium text-brand-ink break-all">{em}</b> : <span className="text-amber-700">ยังไม่ได้ตั้งค่า (แอดมินตั้งที่ ภาพรวมทีม → จัดการทีม)</span>}</span>
              </button>
            );
          })}
        </div>
        {q.color === 'blue' && (
          <div role="radiogroup" aria-label="ราคาที่เสนอกับ VAT" className="mt-2 flex flex-wrap gap-1.5 text-[13.5px]">
            {([['include', 'ราคานี้รวม VAT แล้ว'], ['exclude', 'ราคานี้ยังไม่รวม VAT (บวก 7%)']] as const).map(([v, l]) => (
              <button key={v} type="button" role="radio" aria-checked={qc.vat === v} onClick={() => pick(v)} className={`tap px-3 py-1.5 rounded-full border ${qc.vat === v ? 'bg-sky-600 text-white border-sky-600' : 'border-brand-mist bg-white'}`}>{l}</button>
            ))}
          </div>
        )}
      </fieldset>
      {q.problems.length > 0 && (
        <div role="alert" className="mt-3 rounded-lg border border-amber-300 px-3 py-2 text-[13.5px] flex items-start gap-2"><AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />{q.problems.join(' · ')} — แก้ในขั้นก่อนหน้าก่อนส่ง</div>
      )}
      <h4 className="mt-3 text-[13.5px] font-semibold">ลูกค้า</h4>
      <ul>{q.customer.map(f => <Row key={f.key} id={f.key} label={f.label} value={f.value} missing={f.missing} hint={f.hint} />)}</ul>
      <h4 className="mt-2 text-[13.5px] font-semibold">เอกสาร</h4>
      <ul>{q.doc.map(f => <Row key={f.key} id={f.key} label={f.label} value={f.value} missing={f.missing} hint={f.hint} />)}</ul>
      <h4 className="mt-2 text-[13.5px] font-semibold">รายการสินค้า/บริการ</h4>
      <ul>
        <Row id="name" label="สินค้า" value={l.name} />
        <Row id="detail" label="รายละเอียดสินค้า" value={l.detail} />
        <Row id="qty" label="จำนวน" value={l.qty ? String(l.qty) : ''} hint="ยังไม่มีจำนวนนักเรียน" missing={!l.qty} />
        <Row id="price" label="ราคาต่อหน่วย" value={l.price ? fmtMoney(l.price) : ''} hint="ยังไม่มีราคา" missing={!l.price} />
        {l.discount > 0 && <Row id="disc" label="ส่วนลดต่อหน่วย" value={fmtMoney(l.discount)} />}
      </ul>
      <div className="mt-2 flex items-baseline justify-between rounded-lg bg-paper px-3 py-2 text-[14px]"><span>ยอดรวม (ก่อนตั้งค่าภาษีใน SME Move)</span><b className="tabular-nums font-semibold">{fmtMoney(q.total)} บาท</b></div>
      {q.notes && <ul className="mt-1"><Row id="notes" label="หมายเหตุเอกสาร" value={q.notes} /></ul>}
      <p className="mt-2 text-[12.5px] text-sub">ชื่อช่องตรงกับฟอร์ม SME Move · รูปแบบรายการตามใบเสนอราคาค่ายของทีม{q.vatText ? ` · ${q.vatText}` : ''}</p>
      <div className="mt-4 rounded-xl border border-brand-mist p-3 space-y-2">
        <div className="text-[14.5px] font-semibold flex items-center gap-2"><Bot className="w-4 h-4 text-brand-navy" />ให้ AI สร้างใบเสนอราคาจริงใน SME Move</div>
        <ol className="list-decimal pl-5 text-[13px] text-sub space-y-0.5">
          <li>บนคอม เปิด SME Move ใน Chrome แล้วล็อกอินเอง{account ? <> ด้วยบัญชี <b className="font-medium text-brand-ink break-all">{account}</b> ({q.color && COLOR_NAME[q.color]})</> : ''} (AI จะไม่กรอกรหัสผ่าน)</li>
          <li>กด “คัดลอกคำสั่งให้ AI” แล้ววางใน Claude ที่ควบคุม Chrome ได้ (Claude in Chrome)</li>
          <li>AI กรอกครบทุกช่อง บันทึกเป็นฉบับร่าง แล้วบอกเลขที่เอกสาร — ไม่ส่งอีเมลถึงลูกค้า</li>
          <li>ตรวจในหน้า SME Move แล้วใส่เลขที่เอกสารไว้ที่ช่องด้านล่าง</li>
        </ol>
        <div className="flex flex-wrap gap-2 items-end">
          <button onClick={() => cp('agent', smeAgentPrompt(q, url, account))} disabled={q.problems.some(p => /ชื่อโรงเรียน|จำนวนนักเรียน|ราคาพิเศษ/.test(p))} className="tap px-3 py-2 rounded-lg bg-brand-navy text-white text-[13.5px] font-medium flex items-center gap-1.5 disabled:opacity-40">{done === 'agent' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}คัดลอกคำสั่งให้ AI</button>
          <label className="text-[13px] text-sub flex-1 min-w-[10rem]">เลขที่ใบเสนอราคาใน SME Move<input value={qc.smeNo || ''} onChange={setQ('smeNo')} placeholder="เช่น QT2026110001" className={inp} /></label>
        </div>
        {q.problems.length > 0 && <p className="text-[12.5px] text-amber-700">ควรแก้ก่อนส่งให้ AI: {q.problems.join(' · ')}</p>}
      </div>
    </section>
  );
}
