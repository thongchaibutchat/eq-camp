// Tailwind คอมไพล์ตอน build (ไม่ใช้ CDN runtime) → หน้าเว็บโหลดเร็ว ทำงานออฟไลน์/เครือข่ายโรงเรียนที่บล็อก CDN ได้
module.exports = {
  content: ['./web/**/*.{tsx,ts,html}'],
  theme: { extend: {
    colors: {
      brand: { ink: '#1D1D1F', navy: '#0C2A41', deep: '#081E2F', DEFAULT: '#0C2A41', sky: '#0C2A41', mist: '#E5E5EA', line: '#1E3A52' },
      sub: '#6E6E73',
      accent: { DEFAULT: '#C4641B', deep: '#A5530F', soft: '#F5EEE6' },
      paper: '#F5F5F7'
    },
    fontFamily: {
      sans: ['IBM Plex Sans Thai', 'Noto Sans Thai', 'Leelawadee UI', 'Thonburi', 'system-ui', 'sans-serif'],
      doc: ['Sarabun', 'TH Sarabun New', 'sans-serif'],
      display: ['IBM Plex Sans Thai', 'Noto Sans Thai', 'system-ui', 'sans-serif']
    },
    boxShadow: { card: '0 1px 2px rgba(0,0,0,.04)', lift: '0 2px 10px rgba(0,0,0,.07)', paper: '0 18px 40px -12px rgba(0,0,0,.45)' },
    borderRadius: { xl: '12px', '2xl': '12px' }
  } }
};
