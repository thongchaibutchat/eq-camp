import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
// เวอร์ชันเว็บ (GitHub Pages): เก็บไฟล์ไว้ในเครื่อง เปิดได้แม้ออฟไลน์ + เพิ่มลงหน้าจอหลักได้ — ไม่ทำงานใน claude.ai/ไฟล์ในเครื่อง
try {
  if ('serviceWorker' in navigator && location.protocol === 'https:' && /github\.io$/.test(location.hostname)) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => { /* ไม่มี SW ก็ใช้งานได้ตามปกติ */ }); });
  }
} catch { /* ignore */ }
