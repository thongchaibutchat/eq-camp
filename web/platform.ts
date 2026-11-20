// ตรวจสภาพแวดล้อมของผู้ใช้ — ให้ใช้งานได้ทุกแพลตฟอร์ม (คอม/แท็บเล็ต/มือถือ/เบราว์เซอร์ในแอป LINE, Facebook ฯลฯ)
const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
export const IS_IOS = /iPad|iPhone|iPod/.test(ua) || (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);
export const IS_ANDROID = /Android/i.test(ua);
// เบราว์เซอร์ในแอปมักดาวน์โหลดไฟล์ไม่ได้ → แนะนำให้เปิดในเบราว์เซอร์จริง
export const IN_APP: '' | 'LINE' | 'Facebook' | 'Instagram' | 'TikTok' | 'Messenger' | 'แอปอื่น' =
  /\bLine\//i.test(ua) ? 'LINE'
  : /FBAN|FBAV|FB_IAB/i.test(ua) ? (/Messenger|FBAN\/MessengerForiOS/i.test(ua) ? 'Messenger' : 'Facebook')
  : /Instagram/i.test(ua) ? 'Instagram'
  : /musical_ly|TikTok|BytedanceWebview/i.test(ua) ? 'TikTok'
  : /; wv\)/.test(ua) ? 'แอปอื่น' : '';
// ลิงก์เปิดในเบราว์เซอร์จริง: LINE รองรับพารามิเตอร์ openExternalBrowser=1; Android ใช้ intent เปิด Chrome; iOS แอปอื่นต้องให้ผู้ใช้กดเมนู "เปิดใน Safari"
export function externalBrowserUrl(): string | null {
  if (typeof location === 'undefined') return null;
  const url = new URL(location.href);
  try { const ih = sessionStorage.getItem('eqcamp.inviteHash'); if (ih && !/^#\/(join|t)\//.test(url.hash)) url.hash = ih; } catch { /* */ }
  if (IN_APP === 'LINE') { url.searchParams.set('openExternalBrowser', '1'); return url.toString(); }
  if (IS_ANDROID && IN_APP) return `intent://${url.host}${url.pathname}${url.search}${url.hash}#Intent;scheme=${url.protocol.replace(':', '')};package=com.android.chrome;end`;
  return null;
}
export async function copyText(t: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(t); return true; } catch { /* fallback ด้านล่าง */ }
  try { const a = document.createElement('textarea'); a.value = t; a.style.position = 'fixed'; a.style.opacity = '0'; document.body.appendChild(a); a.select(); const ok = document.execCommand('copy'); a.remove(); return ok; } catch { return false; }
}
// มือถือ/แท็บเล็ต (จอสัมผัส) — ใช้แผ่น "บันทึก/แชร์ไฟล์" แทนดาวน์โหลดอัตโนมัติ
export const IS_MOBILE = IS_IOS || IS_ANDROID || (typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches && window.innerWidth < 1024);
// แชร์ไฟล์ผ่านเมนูของเครื่อง (iOS: "บันทึกไปยังไฟล์", LINE, อีเมล · Android: Drive/LINE/ไฟล์)
export const canShareFiles = (files: File[]) => { try { return !!(navigator as any).canShare && (navigator as any).canShare({ files }); } catch { return false; } };

// ── ชื่อเครื่องที่ใช้ (บันทึกในประวัติการใช้งานของทีม) ──
// iPhone: Safari ไม่บอกรุ่นตรง ๆ → เดาจากขนาดจอ (จุด CSS × ความละเอียด) — รุ่นที่จอเท่ากันจะแสดงรวมกัน
// Android Chrome: ขอรุ่นจริงจาก User-Agent Client Hints · คอม: ระบบ + เบราว์เซอร์
const IPHONES: [number, number, number, string][] = [
  [440, 956, 3, 'iPhone 16 Pro Max / 17 Pro Max'], [402, 874, 3, 'iPhone 16 Pro / 17 / 17 Pro'], [420, 912, 3, 'iPhone Air'],
  [430, 932, 3, 'iPhone 14 Pro Max / 15 Plus / 15 Pro Max / 16 Plus'], [393, 852, 3, 'iPhone 14 Pro / 15 / 15 Pro / 16'],
  [428, 926, 3, 'iPhone 12 Pro Max / 13 Pro Max / 14 Plus'], [390, 844, 3, 'iPhone 12 / 13 / 14 / 16e'], [375, 812, 3, 'iPhone X / XS / 11 Pro / 12 mini / 13 mini'],
  [414, 896, 3, 'iPhone XS Max / 11 Pro Max'], [414, 896, 2, 'iPhone XR / 11'], [414, 736, 3, 'iPhone 6–8 Plus'], [375, 667, 2, 'iPhone 6–8 / SE (รุ่น 2–3)'], [320, 568, 2, 'iPhone SE (รุ่นแรก)']
];
export function iphoneModel(w: number, h: number, dpr: number): string {
  const a = Math.min(w, h), b = Math.max(w, h);
  const hit = IPHONES.find(([x, y, d]) => x === a && y === b && d === Math.round(dpr));
  return hit ? hit[3] : 'iPhone';
}
const browserOf = (u: string) => IN_APP ? IN_APP : /EdgA?\//.test(u) ? 'Edge' : /CriOS|Chrome\//.test(u) && !/OPR\//.test(u) ? 'Chrome' : /FxiOS|Firefox\//.test(u) ? 'Firefox' : /Safari\//.test(u) ? 'Safari' : 'เบราว์เซอร์';
let devLabel = '';
export function deviceLabel(): string {
  if (devLabel) return devLabel;
  try {
    const u = ua, br = browserOf(u);
    if (/iPhone/.test(u)) { const v = (u.match(/OS (\d+)[_.](\d+)/) || []); devLabel = `${iphoneModel(screen.width, screen.height, devicePixelRatio)} · ${br}${v[1] ? ` · iOS ${v[1]}.${v[2]}` : ''}`; }
    else if (IS_IOS) devLabel = `iPad · ${br}`;
    else if (IS_ANDROID) { const v = (u.match(/Android (\d+)/) || [])[1]; devLabel = `Android${v ? ' ' + v : ''} · ${br}`; }
    else devLabel = `${/Windows/.test(u) ? 'Windows' : /Mac OS X/.test(u) ? 'Mac' : /CrOS/.test(u) ? 'Chromebook' : /Linux/.test(u) ? 'Linux' : 'คอมพิวเตอร์'} · ${br}`;
  } catch { devLabel = 'ไม่ทราบเครื่อง'; }
  // Android Chrome: รุ่นจริง (เช่น SM-S928B) ได้ทีหลังแบบไม่บล็อก
  try { const uad = (navigator as any).userAgentData; if (IS_ANDROID && uad?.getHighEntropyValues) uad.getHighEntropyValues(['model', 'platformVersion']).then((h: any) => { if (h?.model) devLabel = `Android ${String(h.platformVersion || '').split('.')[0] || ''} · ${h.model} · ${browserOf(ua)}`.replace('Android  ·', 'Android ·'); }).catch(() => { /* */ }); } catch { /* */ }
  return devLabel;
}
