// จัดการทีม & ความปลอดภัย (เฉพาะแอดมิน) — ลิงก์ส่วนตัวรายคน · ปิดสิทธิ์ · ปิดลิงก์รวม · ประวัติการใช้งาน (ใคร/อีเมล/เครื่อง) · กู้คืนงานที่ถูกลบหรือบันทึกทับ
// สิทธิ์จริงตรวจที่ศูนย์กลาง (ไม่ใช่แค่ซ่อนปุ่ม) — สมาชิกเรียกคำสั่งแอดมินจะถูกปฏิเสธและบันทึกไว้
import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Copy, Check, Share2, ShieldCheck, ShieldAlert, KeyRound, UserPlus, RotateCcw, AlertTriangle } from 'lucide-react';
import { hubCall, hubUrl, setHub, HUB_URL, onArea, loadTeamConfig, saveTeamConfig } from './hub';
import type { TeamConfig } from './hub';
import { copyText } from './platform';
import { ago } from './jobs';

interface Dev { dev: string; label: string; first: string; last: string }
interface Mem { id: string; nick: string; name?: string; email?: string; role: 'admin' | 'member'; active: boolean; hasKey?: boolean; lastSeen?: string; device?: string; devices?: Dev[] }
interface AuditRow { ts: string; who: string; email: string; role: string; device: string; dev: string; action: string; target: string; detail: string }
const WEB = 'https://thongchaibutchat.github.io/eq-camp/';
const linkFor = (key: string) => { const base = /github\.io$/.test(location.hostname) || /^https?:\/\/localhost/.test(location.origin) ? location.origin + location.pathname : WEB; return `${base}#/t/${key}`; };
const th = (iso: string) => { try { return new Date(iso).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return iso; } };
const RISK = new Set(['ปฏิเสธ', 'รหัสไม่ถูกต้อง', 'ลิงก์ถูกปิดแต่ยังพยายามใช้', 'เครื่องใหม่', 'ลบงาน']);

export function ClaimAdmin({ flash, onDone }: { flash: (t: string, warn?: boolean) => void; onDone: () => void }) {
  const [open, setOpen] = useState(false); const [code, setCode] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const claim = async () => {
    setBusy(true); setErr('');
    try { const r: any = await hubCall('admin.claim', { owner: code.trim() }); setHub(hubUrl() || HUB_URL, r.key); flash(`รับสิทธิ์แอดมินแล้ว — เครื่องนี้ใช้ลิงก์ส่วนตัวของ ${r.member?.nick || 'แอดมิน'}`); onDone(); }
    catch (e: any) { const m = e?.code === 'forbidden' ? 'รหัสเจ้าของไม่ถูกต้อง' : e?.message || 'ไม่สำเร็จ'; setErr(m); flash(m, true); }
    finally { setBusy(false); }
  };
  if (!open) return <button onClick={() => setOpen(true)} className="tap text-[13px] text-sub underline">ฉันเป็นเจ้าของระบบ (รับสิทธิ์แอดมิน)</button>;
  return (
    <div className="rounded-xl border border-brand-mist bg-white p-3 flex flex-wrap items-end gap-2">
      <label className="text-[13px] text-sub flex-1 min-w-[12rem]">รหัสเจ้าของ (อยู่ในไฟล์สคริปต์ศูนย์กลาง บรรทัด OWNER_CODE)
        <input value={code} onChange={e => setCode(e.target.value)} autoComplete="off" autoCapitalize="off" className="mt-1 w-full px-3 py-2 rounded-lg border border-brand-mist text-[14px] text-brand-ink font-mono" />
      </label>
      <button onClick={claim} disabled={!code.trim() || busy} className="tap px-3.5 py-2 rounded-lg bg-brand-navy text-white text-[14px] font-medium disabled:opacity-40">รับสิทธิ์แอดมิน</button>
      {err && <p role="alert" className="w-full text-[13px] text-amber-700">{err}</p>}
    </div>
  );
}

export default function TeamAdmin({ flash }: { flash: (t: string, warn?: boolean) => void }) {
  const [tab, setTab] = useState<'members' | 'audit' | 'restore' | 'settings'>('members');
  const [cfg, setCfg] = useState<TeamConfig>({});
  const [mem, setMem] = useState<Mem[]>([]); const [legacy, setLegacy] = useState(false);
  const [rows, setRows] = useState<AuditRow[]>([]); const [trash, setTrash] = useState<{ deleted: any[]; recent: any[] }>({ deleted: [], recent: [] });
  const [loading, setLoading] = useState(false); const [err, setErr] = useState('');
  const [newLink, setNewLink] = useState<{ nick: string; link: string } | null>(null); const [copied, setCopied] = useState(false);
  const [edit, setEdit] = useState<Partial<Mem> | null>(null);
  const [fAct, setFAct] = useState<'all' | 'risk' | 'job' | 'nsr'>('all'); const [fWho, setFWho] = useState('');

  const load = async (what = tab) => {
    setLoading(true); setErr('');
    try {
      if (what === 'members') { const r: any = await hubCall('members.list'); setMem(r.members || []); setLegacy(!!r.legacy); }
      if (what === 'audit') { const r: any = await hubCall('audit', { limit: 400 }); setRows(r.rows || []); }
      if (what === 'settings') { setCfg(await loadTeamConfig()); }
      if (what === 'restore') { const r: any = await hubCall('jobs.trash'); setTrash({ deleted: r.deleted || [], recent: r.recent || [] }); }
    } catch (e: any) { setErr(e?.code === 'op' ? 'ศูนย์กลางทีมยังเป็นรุ่นเก่า — อัปเดตสคริปต์เป็นรุ่น 9 ก่อน' : e?.message || 'โหลดไม่สำเร็จ'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(tab); }, [tab]);
  useEffect(() => onArea(['job'], () => { if (tab === 'restore') load('restore'); }), [tab]);

  const act = async (op: string, body: any, okMsg: string) => {
    try { const r: any = await hubCall(op, body); flash(okMsg); return r; } catch (e: any) { flash(e?.message || 'ไม่สำเร็จ', true); return null; }
  };
  const issue = async (m: Mem) => {
    if (m.hasKey && !confirm(`ออกลิงก์ใหม่ให้ ${m.nick}? ลิงก์เดิมของ ${m.nick} จะใช้ไม่ได้ทันทีทุกเครื่อง`)) return;
    const r = await act('members.key', { id: m.id }, `ออกลิงก์ส่วนตัวของ ${m.nick} แล้ว — ส่งให้เจ้าตัวทางแชตส่วนตัว`);
    if (r?.key) { setNewLink({ nick: m.nick, link: linkFor(r.key) }); setCopied(false); load('members'); }
  };
  const save = async (m: Partial<Mem>) => { const r = await act('members.save', { member: m }, 'บันทึกสมาชิกแล้ว'); if (r) { setEdit(null); load('members'); } };
  const toggle = (m: Mem) => { if (m.active && !confirm(`ปิดสิทธิ์ ${m.nick}? ลิงก์ของ ${m.nick} จะใช้ไม่ได้ทันที (งานเดิมไม่หาย)`)) return; save({ ...m, active: !m.active }); };
  const closeLegacy = async () => {
    const noKey = mem.filter(m => m.active && !m.hasKey).map(m => m.nick);
    if (!confirm(`ปิด "ลิงก์รวม" ที่เคยส่งในกลุ่ม?\nหลังปิด ทุกคนต้องใช้ลิงก์ส่วนตัวเท่านั้น${noKey.length ? `\n\nยังไม่มีลิงก์ส่วนตัว: ${noKey.join(', ')}` : ''}`)) return;
    const r = await act('legacy.set', { on: false }, 'ปิดลิงก์รวมแล้ว — เหลือเฉพาะลิงก์ส่วนตัว'); if (r) setLegacy(false);
  };
  const shareLink = async () => { if (!newLink) return; try { if ((navigator as any).share) { await (navigator as any).share({ title: `ลิงก์ส่วนตัว EQ Camp ของ ${newLink.nick}`, text: `ลิงก์ส่วนตัวสำหรับ ${newLink.nick} เท่านั้น — ห้ามส่งต่อ`, url: newLink.link }); return; } } catch { /* ยกเลิก */ } if (await copyText(newLink.link)) setCopied(true); };
  const restore = async (id: string, at?: string, label = '') => { if (!confirm(`กู้คืน${label ? ' ' + label : 'งานนี้'}? (ฉบับปัจจุบันถูกเก็บไว้ในประวัติด้วย)`)) return; const r = await act('job.restore', { id, at }, 'กู้คืนงานแล้ว'); if (r) load('restore'); };

  const people = useMemo(() => [...new Set(rows.map(r => r.who).filter(Boolean))], [rows]);
  const shown = rows.filter(r => (!fWho || r.who === fWho) && (fAct === 'all' || (fAct === 'risk' ? RISK.has(r.action) : fAct === 'job' ? /งาน/.test(r.action) : /NSR/.test(r.action))));

  return (
    <section aria-label="จัดการทีมและความปลอดภัย" className="rounded-2xl bg-white border border-brand-mist p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[16px] font-semibold flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-brand-navy" />จัดการทีม & ความปลอดภัย<span className="text-[12.5px] font-normal text-sub">เห็นเฉพาะแอดมิน</span></h2>
        <button onClick={() => load(tab)} aria-label="โหลดใหม่" className="tap p-2 rounded-lg border border-brand-mist hover:bg-paper"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
      </div>
      <div role="tablist" className="mt-2 flex border-b border-brand-mist overflow-x-auto">
        {([['members', 'สมาชิก & ลิงก์'], ['audit', 'ประวัติการใช้งาน'], ['restore', 'กู้คืนงาน'], ['settings', 'บัญชี SME Move']] as const).map(([id, l]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`tap shrink-0 px-3 py-2 text-[14px] border-b-2 -mb-px ${tab === id ? 'border-brand-navy font-semibold' : 'border-transparent text-sub'}`}>{l}</button>
        ))}
      </div>
      {err && <div role="alert" className="mt-3 rounded-lg border border-amber-300 px-3 py-2 text-[13.5px] flex gap-2"><AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />{err}</div>}

      {tab === 'members' && (
        <div className="mt-3 space-y-3">
          <div className={`rounded-xl border px-3.5 py-3 text-[13.5px] flex flex-wrap items-center justify-between gap-2 ${legacy ? 'border-amber-300' : 'border-emerald-200'}`}>
            <span className="flex items-start gap-2">{legacy ? <ShieldAlert className="w-4 h-4 mt-0.5 text-amber-600 shrink-0" /> : <ShieldCheck className="w-4 h-4 mt-0.5 text-emerald-600 shrink-0" />}
              {legacy ? 'ลิงก์รวมเดิม (ที่เคยส่งในกลุ่ม) ยังใช้ได้ — ใครมีลิงก์นี้เข้าได้โดยไม่รู้ว่าเป็นใคร' : 'ปิดลิงก์รวมแล้ว — เข้าได้เฉพาะลิงก์ส่วนตัวของสมาชิก'}</span>
            {legacy && <button onClick={closeLegacy} className="tap px-3 py-1.5 rounded-lg bg-brand-navy text-white text-[13.5px] font-medium">ปิดลิงก์รวม</button>}
          </div>
          {newLink && (
            <div className="rounded-xl border border-brand-navy/30 bg-paper px-3.5 py-3 space-y-2">
              <div className="text-[14px] font-semibold">ลิงก์ส่วนตัวของ {newLink.nick} (แสดงครั้งเดียว)</div>
              <div className="flex gap-2"><input readOnly value={newLink.link} aria-label={`ลิงก์ส่วนตัวของ ${newLink.nick}`} onFocus={e => e.currentTarget.select()} className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-brand-mist text-[12.5px] font-mono bg-white" />
                <button onClick={shareLink} className="tap px-3 py-2 rounded-lg bg-brand-navy text-white flex items-center gap-1.5 text-[13.5px]"><Share2 className="w-4 h-4" />ส่ง</button>
                <button onClick={async () => { if (await copyText(newLink.link)) setCopied(true); }} aria-label="คัดลอกลิงก์" className="tap px-3 py-2 rounded-lg border border-brand-mist">{copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}</button></div>
              <p className="text-[12.5px] text-sub">ส่งทางแชตส่วนตัวของ {newLink.nick} เท่านั้น · ให้เปิดลิงก์บนทุกเครื่องที่ {newLink.nick} ใช้ · ลิงก์นี้ไม่ถูกเก็บในระบบ (เก็บแค่ค่าตรวจสอบ) ถ้าหายให้ออกใหม่</p>
            </div>
          )}
          <ul className="space-y-2">
            {mem.filter(m => m.id !== 'shared').map(m => (
              <li key={m.id} className={`rounded-xl border border-brand-mist px-3.5 py-3 ${m.active ? '' : 'opacity-60'}`}>
                {edit && edit.id === m.id ? (
                  <MemberForm init={edit} onCancel={() => setEdit(null)} onSave={save} />
                ) : (<>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[15px] font-semibold">{m.nick}{m.role === 'admin' && <span className="ml-2 align-middle text-[11.5px] font-medium px-2 py-0.5 rounded-full bg-brand-navy text-white">แอดมิน</span>}{!m.active && <span className="ml-2 text-[12px] text-amber-700">ปิดสิทธิ์แล้ว</span>}</div>
                      <div className="text-[13px] text-sub break-all">{[m.name, m.email || 'ยังไม่ใส่อีเมล'].filter(Boolean).join(' · ')}</div>
                      <div className="text-[12.5px] text-sub mt-0.5">{m.hasKey ? <>ลิงก์ส่วนตัว: มีแล้ว{m.lastSeen ? ` · ใช้ล่าสุด ${ago(m.lastSeen)}` : ' · ยังไม่เคยเปิด'}</> : <span className="text-amber-700">ยังไม่มีลิงก์ส่วนตัว</span>}</div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button onClick={() => issue(m)} className="tap px-2.5 py-1.5 rounded-lg border border-brand-mist hover:bg-paper text-[13px] flex items-center gap-1"><KeyRound className="w-3.5 h-3.5" />{m.hasKey ? 'ออกลิงก์ใหม่' : 'ออกลิงก์ส่วนตัว'}</button>
                      <button onClick={() => setEdit(m)} className="tap px-2.5 py-1.5 rounded-lg border border-brand-mist hover:bg-paper text-[13px]">แก้ไข</button>
                      <button onClick={() => toggle(m)} className="tap px-2.5 py-1.5 rounded-lg border border-brand-mist hover:bg-paper text-[13px]">{m.active ? 'ปิดสิทธิ์' : 'เปิดสิทธิ์'}</button>
                    </div>
                  </div>
                  {!!m.devices?.length && (
                    <ul className="mt-2 text-[12.5px] text-sub space-y-0.5">
                      {m.devices.map(d => <li key={d.dev} className="flex flex-wrap gap-x-2"><span className="text-brand-ink">{d.label || 'ไม่ทราบเครื่อง'}</span><span>เริ่มใช้ {th(d.first)}</span><span>ล่าสุด {ago(d.last)}</span></li>)}
                    </ul>
                  )}
                </>)}
              </li>
            ))}
          </ul>
          {edit && !edit.id ? <div className="rounded-xl border border-brand-mist px-3.5 py-3"><MemberForm init={edit} onCancel={() => setEdit(null)} onSave={save} /></div>
            : <button onClick={() => setEdit({ role: 'member', active: true })} className="tap px-3 py-2 rounded-lg border border-brand-mist hover:bg-paper text-[13.5px] flex items-center gap-1.5"><UserPlus className="w-4 h-4" />เพิ่มสมาชิก</button>}
          {mem.some(m => m.id === 'shared') && <p className="text-[12.5px] text-sub">มีการใช้ลิงก์รวม (ไม่ระบุตัว) จาก: {mem.find(m => m.id === 'shared')!.devices?.map(d => d.label).join(' · ') || '—'}</p>}
        </div>
      )}

      {tab === 'audit' && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-1.5 text-[13px]">
            {([['all', 'ทั้งหมด'], ['risk', 'ต้องระวัง'], ['job', 'งาน'], ['nsr', 'แก้ NSR']] as const).map(([id, l]) => (
              <button key={id} onClick={() => setFAct(id)} aria-pressed={fAct === id} className={`tap px-2.5 py-1 rounded-full border ${fAct === id ? 'bg-brand-navy text-white border-brand-navy' : 'border-brand-mist'}`}>{l}</button>
            ))}
            <select value={fWho} onChange={e => setFWho(e.target.value)} aria-label="กรองตามคน" className="tap px-2.5 py-1 rounded-full border border-brand-mist bg-white"><option value="">ทุกคน</option>{people.map(p => <option key={p}>{p}</option>)}</select>
          </div>
          {shown.length ? (
            <ul className="divide-y divide-brand-mist">
              {shown.slice(0, 200).map((r, i) => (
                <li key={i} className="py-2 text-[13.5px]">
                  <div className="flex flex-wrap gap-x-2"><b className={`font-semibold ${RISK.has(r.action) ? 'text-amber-700' : ''}`}>{r.action}</b><span>{r.target}</span></div>
                  <div className="text-[12.5px] text-sub">{th(r.ts)} · {r.who || '?'}{r.email ? ` (${r.email})` : ''}{r.device ? ` · ${r.device}` : ''}</div>
                  {r.detail && <div className="text-[12.5px] text-sub break-words line-clamp-2">{r.detail}</div>}
                </li>
              ))}
            </ul>
          ) : <p className="text-[14px] text-sub py-2">{loading ? 'กำลังโหลด…' : 'ยังไม่มีรายการ'}</p>}
        </div>
      )}

      {tab === 'settings' && (
        <div className="mt-3 space-y-3">
          <p className="text-[13.5px] text-sub">บัญชี SME Move ที่ใช้ออกใบเสนอราคาแต่ละสี — ทุกคนในทีมเห็นในหน้า "ราคา & งบ" และ AI จะตรวจว่าล็อกอินถูกบัญชีก่อนสร้าง (ไม่เก็บรหัสผ่าน)</p>
          {(['blue', 'orange'] as const).map(c => (
            <label key={c} className="block text-[13px] text-sub"><span className="inline-flex items-center gap-1.5"><span aria-hidden className={`w-2.5 h-2.5 rounded-full ${c === 'blue' ? 'bg-sky-600' : 'bg-orange-500'}`} />{c === 'blue' ? 'ใบเสนอราคาสีฟ้า (มีภาษี) — อีเมลบัญชี SME Move' : 'ใบเสนอราคาสีส้ม (ไม่มีภาษี) — อีเมลบัญชี SME Move'}</span>
              <input type="email" autoCapitalize="off" value={cfg.sme?.[c]?.email || ''} onChange={e => setCfg(x => ({ ...x, sme: { ...x.sme, [c]: { ...(x.sme?.[c] || {}), email: e.target.value } } }))} className="mt-1 w-full px-3 py-2 rounded-lg border border-brand-mist text-[14px] text-brand-ink" />
            </label>
          ))}
          <label className="block text-[13px] text-sub">ลิงก์เข้าสู่ระบบ SME Move<input value={cfg.sme?.url || 'https://app.smemove.com/'} onChange={e => setCfg(x => ({ ...x, sme: { ...x.sme, url: e.target.value } }))} className="mt-1 w-full px-3 py-2 rounded-lg border border-brand-mist text-[14px] text-brand-ink" /></label>
          <button onClick={async () => { try { setCfg(await saveTeamConfig(cfg)); flash('บันทึกบัญชี SME Move ของทีมแล้ว'); } catch (e: any) { flash(e?.message || 'บันทึกไม่สำเร็จ', true); } }} className="tap px-3.5 py-2 rounded-lg bg-brand-navy text-white text-[14px] font-medium">บันทึก</button>
        </div>
      )}

      {tab === 'restore' && (
        <div className="mt-3 space-y-3">
          <h3 className="text-[14px] font-semibold">งานที่ถูกลบ ({trash.deleted.length})</h3>
          {trash.deleted.length ? <ul className="space-y-1.5">{trash.deleted.map(j => (
            <li key={j.id} className="flex items-center justify-between gap-2 rounded-lg border border-brand-mist px-3 py-2 text-[13.5px]"><span className="min-w-0 truncate">{j.school || j.name} <span className="text-sub">· ลบ {ago(j.savedAt)}{j.by ? ` · ${j.by}` : ''}</span></span>
              <button onClick={() => restore(j.id, undefined, j.school || j.name)} className="tap shrink-0 px-2.5 py-1 rounded-lg border border-brand-mist hover:bg-paper flex items-center gap-1"><RotateCcw className="w-3.5 h-3.5" />กู้คืน</button></li>))}</ul>
            : <p className="text-[13.5px] text-sub">ไม่มีงานที่ถูกลบ</p>}
          <h3 className="text-[14px] font-semibold">ฉบับก่อนหน้า (เก็บอัตโนมัติก่อนบันทึกทับ/ลบ)</h3>
          {trash.recent.length ? <ul className="space-y-1.5">{trash.recent.map((h, i) => (
            <li key={i} className="flex items-center justify-between gap-2 rounded-lg border border-brand-mist px-3 py-2 text-[13.5px]"><span className="min-w-0"><span className="block truncate">{h.school || h.name}</span><span className="block text-[12.5px] text-sub">{h.why} · {th(h.ts)}{h.who ? ` · โดย ${h.who}` : ''}</span></span>
              <button onClick={() => restore(h.id, h.ts, `ฉบับก่อน ${th(h.ts)}`)} className="tap shrink-0 px-2.5 py-1 rounded-lg border border-brand-mist hover:bg-paper flex items-center gap-1"><RotateCcw className="w-3.5 h-3.5" />กู้ฉบับนี้</button></li>))}</ul>
            : <p className="text-[13.5px] text-sub">ยังไม่มีประวัติ</p>}
        </div>
      )}
    </section>
  );
}

function MemberForm({ init, onSave, onCancel }: { init: Partial<Mem>; onSave: (m: Partial<Mem>) => void; onCancel: () => void }) {
  const [m, setM] = useState<Partial<Mem>>(init);
  const f = (k: keyof Mem) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setM(x => ({ ...x, [k]: e.target.value }));
  const inp = 'mt-1 w-full px-3 py-2 rounded-lg border border-brand-mist text-[14px] text-brand-ink';
  return (
    <div className="grid sm:grid-cols-2 gap-2">
      <label className="text-[13px] text-sub">ชื่อเล่น<input value={m.nick || ''} onChange={f('nick')} className={inp} /></label>
      <label className="text-[13px] text-sub">ชื่อจริง<input value={m.name || ''} onChange={f('name')} className={inp} /></label>
      <label className="text-[13px] text-sub">อีเมล<input value={m.email || ''} onChange={f('email')} type="email" autoCapitalize="off" className={inp} /></label>
      <label className="text-[13px] text-sub">บทบาท<select value={m.role || 'member'} onChange={f('role')} className={inp + ' bg-white'}><option value="member">สมาชิก</option><option value="admin">แอดมิน</option></select></label>
      <div className="sm:col-span-2 flex gap-2"><button onClick={() => onSave(m)} disabled={!String(m.nick || '').trim()} className="tap px-3.5 py-2 rounded-lg bg-brand-navy text-white text-[14px] font-medium disabled:opacity-40">บันทึก</button><button onClick={onCancel} className="tap px-3.5 py-2 rounded-lg border border-brand-mist text-[14px]">ยกเลิก</button></div>
    </div>
  );
}
