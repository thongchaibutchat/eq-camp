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
  if (IN_APP === 'LINE') { url.searchParams.set('openExternalBrowser', '1'); return url.toString(); }
  if (IS_ANDROID && IN_APP) return `intent://${url.host}${url.pathname}${url.search}${url.hash}#Intent;scheme=${url.protocol.replace(':', '')};package=com.android.chrome;end`;
  return null;
}
export async function copyText(t: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(t); return true; } catch { /* fallback ด้านล่าง */ }
  try { const a = document.createElement('textarea'); a.value = t; a.style.position = 'fixed'; a.style.opacity = '0'; document.body.appendChild(a); a.select(); const ok = document.execCommand('copy'); a.remove(); return ok; } catch { return false; }
}
