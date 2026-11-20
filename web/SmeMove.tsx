// แผง "ส่งเข้า SME Move" — ข้อมูลใบเสนอราคาเรียงตามฟอร์มของ SME Move · แตะช่องไหนก็คัดลอกช่องนั้น · คัดลอกทั้งชุด · เปิด SME Move
import React, { useMemo, useState } from 'react';
import { Copy, Check, ExternalLink, AlertTriangle, Settings } from 'lucide-react';
import type { Camp } from '../src/eqcamp-core';
import { smeQuote, smeText, SME_URL_KEY, SME_DEFAULT, fmtMoney } from './sme-data';
import { copyText } from './platform';

const getUrl = () => { try { return localStorage.getItem(SME_URL_KEY) || SME_DEFAULT; } catch { return SME_DEFAULT; } };

export default function SmeMovePanel({ camp }: { camp: Camp }) {
  const q = useMemo(() => smeQuote(camp), [camp]);
  const [done, setDone] = useState('');
  const [url, setUrl] = useState(getUrl);
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
        <div className="flex gap-1.5">
          <button onClick={() => cp('all', smeText(q))} className="tap px-3 py-2 rounded-lg border border-brand-mist hover:bg-paper text-[13.5px] font-medium flex items-center gap-1.5">{done === 'all' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}คัดลอกทั้งชุด</button>
          <a href={url} target="_blank" rel="noopener" className="tap px-3 py-2 rounded-lg bg-brand-navy text-white text-[13.5px] font-medium flex items-center gap-1.5">เปิด SME Move<ExternalLink className="w-3.5 h-3.5" /></a>
          <button onClick={() => setEdit(e => !e)} aria-label="ตั้งลิงก์ SME Move ของบริษัท" aria-expanded={edit} className="tap p-2 rounded-lg border border-brand-mist hover:bg-paper"><Settings className="w-4 h-4" /></button>
        </div>
      </div>
      {edit && (
        <label className="mt-2 block text-[13px] text-sub">ลิงก์หน้าใบเสนอราคาใน SME Move ของบริษัท (จำไว้ในเครื่องนี้)
          <input value={url} onChange={e => { setUrl(e.target.value); try { localStorage.setItem(SME_URL_KEY, e.target.value.trim()); } catch { /* */ } }} placeholder={SME_DEFAULT}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-brand-mist text-[14px] text-brand-ink" inputMode="url" />
        </label>
      )}
      {q.problems.length > 0 && (
        <div role="alert" className="mt-3 rounded-lg border border-amber-300 px-3 py-2 text-[13.5px] flex items-start gap-2"><AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />{q.problems.join(' · ')} — แก้ในขั้นก่อนหน้าก่อนส่ง</div>
      )}
      <h4 className="mt-3 text-[13.5px] font-semibold">ลูกค้า</h4>
      <ul>{q.customer.map(f => <Row key={f.key} id={f.key} label={f.label} value={f.value} missing={f.missing} hint={f.hint} />)}</ul>
      <h4 className="mt-2 text-[13.5px] font-semibold">เอกสาร</h4>
      <ul>{q.doc.map(f => <Row key={f.key} id={f.key} label={f.label} value={f.value} missing={f.missing} hint={f.hint} />)}</ul>
      <h4 className="mt-2 text-[13.5px] font-semibold">รายการสินค้า/บริการ</h4>
      <ul>
        <Row id="name" label="ชื่อสินค้า/บริการ" value={l.name} />
        <Row id="detail" label="รายละเอียด" value={l.detail} />
        <Row id="qty" label="จำนวน" value={l.qty ? String(l.qty) : ''} hint="ยังไม่มีจำนวนนักเรียน" missing={!l.qty} />
        <Row id="unit" label="หน่วย" value={l.unit} />
        <Row id="price" label="ราคาต่อหน่วย" value={l.price ? fmtMoney(l.price) : ''} hint="ยังไม่มีราคา" missing={!l.price} />
        {l.discount > 0 && <Row id="disc" label="ส่วนลดต่อหน่วย" value={fmtMoney(l.discount)} />}
      </ul>
      <div className="mt-2 flex items-baseline justify-between rounded-lg bg-paper px-3 py-2 text-[14px]"><span>ยอดรวม (ก่อนตั้งค่าภาษีใน SME Move)</span><b className="tabular-nums font-semibold">{fmtMoney(q.total)} บาท</b></div>
      <ul className="mt-1"><Row id="notes" label="หมายเหตุ / เงื่อนไข" value={q.notes} /></ul>
      <p className="mt-2 text-[12.5px] text-sub">เลือกประเภทภาษี (รวม/ไม่รวม VAT) ใน SME Move ให้ตรงกับที่บริษัทใช้ · มีเฉพาะข้อมูลที่ลูกค้าเห็นในใบเสนอราคา</p>
    </section>
  );
}
