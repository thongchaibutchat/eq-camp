import React, { useEffect, useState } from 'react';
import { X, Copy, Check, Share2, Link2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { hubReady, hubUrl, hubKey, setHub, clearHub, userName, setUserName, hubAppsScript, newHubKey, URL_RX, onHubState, HubState, acceptInvite, teamLink, flush, IN_CLAUDE, LIVE_WEB, HUB_URL } from './hub';
import { copyText } from './platform';

/* เชื่อมต่อทีม — ตั้งค่าครั้งเดียว ใช้ได้ทุกส่วน (คำนวณ NSR · ทะเบียนโปรแกรม · งานของทีม · ค้นหา)
 * สมาชิก: เปิด "ลิงก์เชิญ" จากเครื่อง/แอปไหนก็ได้ (LINE/มือถือ/คอม) → ใส่ชื่อ → เสร็จ
 * เจ้าของชีต: ติดตั้ง Apps Script ครั้งแรก แล้วส่งลิงก์เชิญให้ทีม */
export const WEB_BASE = 'https://thongchaibutchat.github.io/eq-camp/';

export function useHubState(): HubState { const [s, set] = useState<HubState>({ status: 'off', pending: 0 }); useEffect(() => onHubState(set), []); return s; }

export function HubPill({ onClick }: { onClick: () => void }) {
  const s = useHubState();
  const [, tick] = useState(0);
  useEffect(() => { const id = setInterval(() => tick(t => t + 1), 5000); return () => clearInterval(id); }, []);
  const ago = s.lastOk ? Math.max(0, Math.round((Date.now() - s.lastOk) / 1000)) : null;
  const dot = s.status === 'live' ? 'bg-emerald-500' : s.status === 'connecting' ? 'bg-sky-500 animate-pulse' : s.status === 'off' ? 'bg-gray-300' : 'bg-amber-500';
  if (IN_CLAUDE) return (   // บน claude.ai เชื่อมทีมไม่ได้ (ระบบบล็อก) → พาไปเวอร์ชันเว็บแบบสด
    <a href={LIVE_WEB + '#/nsr'} target="_blank" rel="noopener" title="claude.ai ไม่อนุญาตให้หน้านี้ดึงข้อมูลจากชีต — ข้อมูลทีมแบบสดอยู่ที่เวอร์ชันเว็บ"
      className="tap flex items-center gap-1.5 px-2.5 py-2 rounded-xl border border-brand-mist bg-white hover:bg-paper text-[13px] font-medium whitespace-nowrap">
      <span className="w-2 h-2 rounded-full bg-emerald-500" /><span className="hidden sm:inline">เปิดแบบเรียลไทม์</span><span className="sm:hidden">สด</span>
    </a>);
  const label = s.status === 'live' ? (ago != null && ago < 35 ? 'ทีม · สด' : `ทีม · ${ago}s`) : s.status === 'connecting' ? 'กำลังเชื่อม…' : s.status === 'off' ? 'เชื่อมต่อทีม' : s.status === 'offline' ? 'ออฟไลน์' : 'ทีม · มีปัญหา';
  return (
    <button onClick={onClick} title={s.msg || (s.status === 'live' ? 'ข้อมูลทีมซิงก์อยู่ (ตรวจทุก 5 วินาที)' : 'ตั้งค่าเชื่อมต่อทีม')}
      className="tap flex items-center gap-1.5 px-2.5 py-2 rounded-xl border border-brand-mist bg-white hover:bg-paper text-[13px] font-medium whitespace-nowrap" aria-label={`สถานะทีม: ${label}${s.pending ? ` รอส่ง ${s.pending}` : ''}`}>
      <span className={`w-2 h-2 rounded-full ${dot}`} />
      <span className="hidden sm:inline">{label}</span>
      {s.pending > 0 && <span className="text-[11.5px] px-1.5 rounded-md bg-amber-100 text-amber-800 tabular-nums">รอส่ง {s.pending}</span>}
    </button>
  );
}

export default function TeamConnect({ onClose, flash, setupKey }: { onClose: () => void; flash: (t: string, warn?: boolean) => void; setupKey?: string }) {
  const s = useHubState();
  const [mode, setMode] = useState<'join' | 'owner'>(setupKey ? 'owner' : 'join');
  const [name, setName] = useState(userName());
  const [link, setLink] = useState('');
  const [url, setUrl] = useState(hubUrl());
  const installed = !!HUB_URL && !setupKey;   // ติดตั้งศูนย์กลางแล้ว → ทีมเข้าร่วมด้วยลิงก์เชิญเท่านั้น (กันสุ่มรหัสใหม่ที่ไม่ตรงกับสคริปต์)
  const [key, setKey] = useState(setupKey || hubKey() || (installed ? '' : newHubKey()));
  const [copied, setCopied] = useState('');
  const code = hubAppsScript(key);
  const badKey = s.code === 'key';
  const connected = hubReady() && !badKey;
  const base = /github\.io$/.test(location.hostname) || /^https?:\/\/localhost/.test(location.origin) ? location.origin + location.pathname : WEB_BASE;
  const invite = connected ? teamLink(base) : '';
  const cp = async (t: string, what: string) => { if (await copyText(t)) { setCopied(what); setTimeout(() => setCopied(''), 2000); } };
  const share = async () => { try { if ((navigator as any).share) { await (navigator as any).share({ title: 'เข้าร่วมทีม EQ Camp', text: 'เปิดลิงก์นี้เพื่อเชื่อมต่อทีม EQ Camp (ห้ามส่งต่อนอกทีม)', url: invite }); return; } } catch { return; } cp(invite, 'invite'); };
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, []);
  const joinFromLink = () => {
    const t = link.trim();
    if (acceptInvite(t)) { if (name.trim()) setUserName(name); setLink(''); flash('เข้าร่วมทีมแล้ว — ข้อมูลทีมซิงก์อัตโนมัติ'); return; }
    flash(/github\.io|eq-camp/.test(t) && !/#|%23/.test(t)
      ? 'ลิงก์นี้เป็นลิงก์เว็บธรรมดา ไม่มีรหัสทีม — ขอ "ลิงก์ทีม" จากกลุ่ม (ลงท้ายด้วย #/t/eq-…)'
      : 'อ่านรหัสทีมจากข้อความนี้ไม่ได้ — คัดลอกลิงก์ทีมทั้งบรรทัดมาวางใหม่ หรือพิมพ์รหัสทีม (eq-…)', true);
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-label="เชื่อมต่อทีม" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white w-full sm:max-w-xl rounded-t-2xl sm:rounded-2xl shadow-lift max-h-[92vh] overflow-y-auto pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-start justify-between gap-2 p-5 pb-3 sticky top-0 bg-white border-b border-brand-mist">
          <div>
            <div className="text-[18px] font-semibold">เชื่อมต่อทีม</div>
            <div className="text-[13.5px] text-sub">ใช้ข้อมูลชุดเดียวกันทุกเครื่องแบบเรียลไทม์: ชีต NSR · งานของทีม · ทะเบียนโปรแกรม</div>
          </div>
          <button onClick={onClose} aria-label="ปิด" className="tap p-1.5 rounded-lg hover:bg-paper text-sub"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4 text-[14px]">
          {badKey && <div className="rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-3"><div className="flex items-center gap-2 font-semibold"><AlertTriangle className="w-4 h-4 text-amber-700" />รหัสทีมในเครื่องนี้ไม่ตรงกับศูนย์กลาง</div><div className="text-[13px] mt-1">วางลิงก์เชิญล่าสุดจากกลุ่มทีมด้านล่าง (หรือแตะลิงก์เชิญ) — ระบบจะแทนค่าที่ผิดให้เอง</div></div>}
          {connected && (
            <div className={`rounded-xl border px-3.5 py-3 ${s.status === 'live' ? 'border-emerald-200 bg-emerald-50' : 'border-amber-300 bg-amber-50'}`}>
              <div className="flex items-center gap-2 font-semibold">{s.status === 'live' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-amber-700" />}{s.status === 'live' ? 'เชื่อมต่อแล้ว · ซิงก์ทุก 5 วินาที' : s.status === 'connecting' ? 'กำลังเชื่อมต่อ…' : s.msg || 'เชื่อมต่อไม่ได้'}</div>
              {s.pending > 0 && <div className="text-[13px] mt-1">รอส่งขึ้นทีม {s.pending} รายการ <button onClick={() => flush()} className="underline ml-1">ส่งตอนนี้</button></div>}
            </div>
          )}
          <label className="block text-[13px] text-sub">ชื่อของคุณ (แสดงในงานของทีม/ทะเบียน)
            <input value={name} onChange={e => setName(e.target.value)} onBlur={() => setUserName(name)} placeholder="เช่น พริ้มเพรา" maxLength={40} className="mt-1 w-full px-3 py-2.5 rounded-lg border border-brand-mist text-[15px] text-brand-ink" />
          </label>

          {connected ? (
            <div className="space-y-2">
              <div className="font-semibold">ลิงก์เชิญเข้าทีม</div>
              <p className="text-[13px] text-sub">ส่งให้คนในทีมทาง LINE/อีเมล — เปิดจากมือถือหรือแอปไหนก็เชื่อมต่อทันที (ลิงก์นี้เปิดดูต้นทุนได้ ส่งเฉพาะคนในทีม)</p>
              <div className="flex gap-2">
                <input readOnly value={invite} aria-label="ลิงก์เชิญ" onFocus={e => e.currentTarget.select()} className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-brand-mist text-[12.5px] font-mono bg-paper" />
                <button onClick={share} className="tap px-3 py-2 rounded-lg bg-brand-navy text-white font-medium flex items-center gap-1.5"><Share2 className="w-4 h-4" />ส่ง</button>
                <button onClick={() => cp(invite, 'invite')} className="tap px-3 py-2 rounded-lg border border-brand-mist flex items-center gap-1.5">{copied === 'invite' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}</button>
              </div>
              <button onClick={() => { if (confirm('เลิกเชื่อมต่อทีมบนเครื่องนี้? (ข้อมูลในชีตไม่หาย)')) { clearHub(); flash('เลิกเชื่อมต่อทีมบนเครื่องนี้แล้ว'); } }} className="tap text-[13px] text-red-700">เลิกเชื่อมต่อบนเครื่องนี้</button>
            </div>
          ) : (
            <>
              <div className="flex border-b border-brand-mist" role="tablist">
                {([['join', 'ฉันได้ลิงก์เชิญ'], ['owner', 'ติดตั้งครั้งแรก (เจ้าของชีต)']] as const).filter(([id]) => id === 'join' || !installed).map(([id, l]) => (
                  <button key={id} role="tab" aria-selected={mode === id} onClick={() => setMode(id)} className={`tap px-3 py-2 text-[14px] border-b-2 -mb-px ${mode === id ? 'border-brand-navy font-semibold' : 'border-transparent text-sub'}`}>{l}</button>
                ))}
              </div>
              {mode === 'join' ? (
                <div className="space-y-2">
                  <p className="text-[13.5px] text-sub">แตะลิงก์ทีมที่ได้รับ (ระบบเชื่อมให้เอง) หรือวางลิงก์ทีม / รหัสทีม (eq-…) ที่นี่</p>
                  <div className="flex gap-2">
                    <input value={link} onChange={e => setLink(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && link.trim()) joinFromLink(); }} placeholder="ลิงก์ทีม หรือ eq-…" aria-label="วางลิงก์ทีมหรือรหัสทีม" autoCapitalize="off" autoCorrect="off" spellCheck={false} className="flex-1 min-w-0 px-3 py-2.5 rounded-lg border border-brand-mist text-[14px]" />
                    <button onClick={joinFromLink} disabled={!link.trim()} className="tap px-4 py-2 rounded-lg bg-accent enabled:hover:bg-accent-deep disabled:opacity-40 text-white font-semibold flex items-center gap-1.5"><Link2 className="w-4 h-4" />เข้าร่วม</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <ol className="list-decimal pl-5 space-y-1.5">
                    <li>เปิดชีต NSR ของทีม → ส่วนขยาย → Apps Script</li>
                    <li>ลบโค้ดเดิม วางโค้ดนี้ทั้งหมด → บันทึก <button onClick={() => cp(code, 'code')} className="tap ml-1 px-2.5 py-1 rounded-lg bg-brand-navy text-white text-[13px] font-medium inline-flex items-center gap-1">{copied === 'code' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}{copied === 'code' ? 'คัดลอกแล้ว' : 'คัดลอกโค้ด'}</button></li>
                    <li>ทำให้ใช้งานได้ → การทำให้ใช้งานได้รายการใหม่ → “เว็บแอป” · เรียกใช้ในฐานะ “ฉัน” · ผู้มีสิทธิ์ “ทุกคน” → อนุญาตสิทธิ์ → คัดลอก URL</li>
                    <li>วาง URL ด้านล่าง → เชื่อมต่อ → ส่ง “ลิงก์เชิญ” ให้ทีม</li>
                  </ol>
                  <label className="block text-[13px] text-sub">ที่อยู่ Web app<input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://script.google.com/macros/s/…/exec" className="mt-1 w-full px-3 py-2 rounded-lg border border-brand-mist text-[13.5px] font-mono text-brand-ink" /></label>
                  <label className="block text-[13px] text-sub">รหัสทีม (อยู่ในโค้ดแล้ว — ต้องตรงกัน)<input value={key} onChange={e => { setKey(e.target.value); setCopied(''); }} className="mt-1 w-full px-3 py-2 rounded-lg border border-brand-mist text-[13.5px] font-mono text-brand-ink" /></label>
                  {url && !URL_RX.test(url.trim()) && <div className="text-[12.5px] text-amber-800">ที่อยู่ต้องขึ้นต้น https://script.google.com/macros/s/ และลงท้าย /exec</div>}
                  <button onClick={() => { setUserName(name); setHub(url, key); flash('กำลังเชื่อมต่อทีม…'); }} disabled={!URL_RX.test(url.trim()) || !key.trim()} className="tap px-4 py-2.5 rounded-lg bg-accent enabled:hover:bg-accent-deep disabled:opacity-40 text-white font-semibold">เชื่อมต่อ</button>
                  <p className="text-[12.5px] text-sub">ทุกคำสั่งต้องมีรหัสทีม · รหัสไม่อยู่ในเว็บ · ทะเบียน/งานของทีมเก็บในสเปรดชีตใหม่ “EQ Camp — ข้อมูลกลางทีม” ในไดรฟ์ของคุณ · แนะนำให้ปิดการแชร์ “ทุกคนที่มีลิงก์” ของชีต NSR (สคริปต์ยังทำงานได้)</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
