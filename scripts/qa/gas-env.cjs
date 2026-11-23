// จำลองสภาพแวดล้อม Apps Script (SpreadsheetApp/Properties/Lock/Cache/Content/ScriptApp/Utilities) แล้วรันโค้ดศูนย์กลางจริง
// ใช้ทั้งทดสอบหน่วย (gas-mock-test.cjs) และเป็นศูนย์กลางของการทดสอบบนเว็บ (e2e-security.cjs)
const crypto = require('crypto');
function makeHub(code, opt = {}) {
let sid = 100;
function Sheet(ss, name) {
  const g = []; const id = sid++;
  const ensure = (r, c) => { while (g.length < r) g.push([]); for (const row of g) while (row.length < c) row.push(''); };
  const sh = {
    _g: g, getName: () => name, getSheetId: () => id, getIndex: () => ss._sheets.indexOf(sh) + 1,
    getLastRow: () => { for (let i = g.length - 1; i >= 0; i--) if (g[i].some(v => v !== '' && v != null)) return i + 1; return 0; },
    getLastColumn: () => Math.max(0, ...g.map(r => { for (let j = r.length - 1; j >= 0; j--) if (r[j] !== '' && r[j] != null) return j + 1; return 0; })),
    appendRow: row => { const n = sh.getLastRow(); ensure(n + 1, row.length); g[n] = row.slice(); while (g[n].length < Math.max(...g.map(r => r.length))) g[n].push(''); },
    getRange: (r, c, nr = 1, nc = 1) => { ensure(r + nr - 1, c + nc - 1); const sub = () => g.slice(r - 1, r - 1 + nr).map(row => row.slice(c - 1, c - 1 + nc));
      return { getValues: sub, getDisplayValues: () => sub().map(row => row.map(v => String(v))), getFormulas: () => sub().map(row => row.map(v => (typeof v === 'string' && v.startsWith('=') ? v : ''))),
        getValue: () => g[r - 1][c - 1], getDisplayValue: () => String(g[r - 1][c - 1]),
        setValues: v => { v.forEach((row, i) => row.forEach((x, j) => { g[r - 1 + i][c - 1 + j] = typeof x === 'string' && x[0] === "'" ? x.slice(1) : x; })); },
        setValue: v => { g[r - 1][c - 1] = typeof v === 'string' && v[0] === "'" ? v.slice(1) : v; sh._text = sh._text || {}; if (typeof v === 'string' && v[0] === "'") sh._text[r + ':' + c] = 1; }, clearContent: () => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) g[r - 1 + i][c - 1 + j] = ''; },
        setNumberFormat() {}, setFontWeight() {} }; },
    getDataRange: () => sh.getRange(1, 1, Math.max(1, sh.getLastRow()), Math.max(1, sh.getLastColumn())),
    setFrozenRows() {}, setColumnWidth() {}
  };
  return sh;
}
function SS(id, name) { const ss = { _sheets: [], getId: () => id, getName: () => name, getUrl: () => 'https://docs.google.com/spreadsheets/d/' + id + '/edit',
  getSheets: () => ss._sheets, getSheetByName: n => ss._sheets.find(s => s.getName() === n) || null,
  insertSheet: (n, idx) => { const s = Sheet(ss, n); ss._sheets.splice(idx == null ? ss._sheets.length : idx, 0, s); return s; }, deleteSheet: s => { ss._sheets = ss._sheets.filter(x => x !== s); } };
  ss._sheets.push(Sheet(ss, 'Sheet1')); return ss; }
const NSR = SS('NSRID', 'NSR'); NSR._sheets[0] = Sheet(NSR, 'ตารางคำนวนต้นทุนยอดขาย NSR');
const t1 = NSR.insertSheet('stem@ทดสอบ'); t1.getRange(1, 1, 3, 5).setValues([['x', 'ชื่องานที่จัด', '', '', ''], ['รายละเอียดงาน', 'STEM', 'โคราช', 80, 6], ['', '', '', '', '']]);
const files = { NSRID: NSR }; let created = 0;
const NID = (code.match(/const NSR_ID = '([^']*)'/) || [])[1]; if (NID) files[NID] = NSR;
const props = {}; const triggers = []; const cache = {}; let lockFree = true, opens = 0;
const env = {
  SpreadsheetApp: { getActiveSpreadsheet: () => { opens++; return NSR; }, openById: id => { if (!files[id]) throw new Error('nf'); if (files[id] === NSR) opens++; return files[id]; }, create: n => { const id = 'HUB' + (++created); files[id] = SS(id, n); return files[id]; } },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); }, getProperties: () => ({ ...props }) }) },
  LockService: { getScriptLock: () => ({ waitLock() { if (!lockFree) throw new Error('Lock timeout: another process was holding the lock for too long.'); }, tryLock() { return lockFree; }, releaseLock() {} }) },
  ContentService: { createTextOutput: s => ({ s, setMimeType() { return this; } }), MimeType: { JSON: 'json' } },
  CacheService: { getScriptCache: () => ({ getAll: ks => { const o = {}; for (const k of ks) if (k in cache) o[k] = cache[k]; return o; }, putAll: (o) => { Object.assign(cache, o); }, get: k => cache[k] ?? null, put: (k, v) => { cache[k] = v; } }) },
  ScriptApp: { getProjectTriggers: () => triggers, deleteTrigger: t => triggers.splice(triggers.indexOf(t), 1), newTrigger: h => ({ forSpreadsheet: id => ({ onEdit: () => ({ create: () => { triggers.push({ getHandlerFunction: () => h, id }); } }) }), timeBased: () => ({ everyHours: n => ({ create: () => { triggers.push({ getHandlerFunction: () => h, every: n }); } }) }) }) }
};
  const _gc = env.CacheService.getScriptCache;
  env.CacheService = { getScriptCache: () => ({ ..._gc(), removeAll: ks => ks.forEach(k => { delete cache[k]; }), remove: k => { delete cache[k]; } }) };
  let pReads = 0; const _ps = env.PropertiesService.getScriptProperties;
  env.PropertiesService = { getScriptProperties: () => { const o = _ps(); return { getProperty: k => { pReads++; return o.getProperty(k); }, setProperty: o.setProperty, getProperties: () => { pReads++; return o.getProperties(); } }; } };
  env.Utilities = {
    DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
    computeDigest: (alg, str) => [...crypto.createHash('sha256').update(String(str), 'utf8').digest()].map(b => (b > 127 ? b - 256 : b)),
    getUuid: () => crypto.randomUUID()
  };
  // Drive (คลังงานเก่า): opt.drive = { folders: { id: { name, updated, created, folders: [id], files: [id] } }, files: { id: { name, mime, size, updated, entries: [{ name, data }] } } }
  const D = opt.drive || { folders: {}, files: {} }; let driveReads = 0;
  const iter = (kind, parent, list, pos = 0) => ({ hasNext: () => pos < list.length, next: () => { driveReads++; const id = list[pos++]; return kind === 'f' ? fileObj(id) : folderObj(id); }, getContinuationToken: () => JSON.stringify([kind, parent, pos]) });
  const folderObj = id => { const f = D.folders[id]; if (!f) throw new Error('No item with the given ID could be found'); return { getId: () => id, getName: () => f.name, getLastUpdated: () => new Date(f.updated || '2026-10-08T00:00:00Z'), getDateCreated: () => new Date(f.created || f.updated || '2026-10-01T00:00:00Z'),
    getFiles: () => iter('f', id, f.files || []), getFolders: () => iter('d', id, f.folders || []) }; };
  const fileObj = id => { const f = D.files[id]; if (!f) throw new Error('No item with the given ID could be found'); return { getId: () => id, getName: () => f.name, getMimeType: () => f.mime, getSize: () => f.size || 25000, getLastUpdated: () => new Date(f.updated || '2026-10-08T00:00:00Z'),
    getBlob: () => ({ setContentType() { return this; }, _entries: f.entries || [] }) }; };
  env.DriveApp = { getFolderById: folderObj, getFileById: id => { driveReads++; return fileObj(id); },
    continueFolderIterator: tok => { const [k, parent, pos] = JSON.parse(tok); return iter(k, parent, D.folders[parent].folders || [], pos); } };
  env.Utilities.unzip = blob => (blob._entries || []).map(e => ({ getName: () => e.name, getDataAsString: () => e.data }));
  // นาฬิกาเร่ง (ทดสอบสแกนต่อจากจุดเดิม): opt.fastClock = มิลลิวินาทีที่เดินต่อการเรียก Date.now หนึ่งครั้ง
  if (opt.fastClock) { let t = Date.parse('2026-11-23T00:00:00Z'); env.Date = class extends Date { static now() { return (t += opt.fastClock); } }; }
  const fn = new Function(...Object.keys(env), code + '\nreturn { doPost, doGet, onEdit, setup, warmCache, pastDaily: typeof pastDaily === "function" ? pastDaily : null };')(...Object.values(env));
  const handle = req => JSON.parse(fn.doPost({ postData: { contents: JSON.stringify(req) } }).s);
  return { fn, handle, env, props, cache, files, triggers, NSR, t1, lock: { set free(v) { lockFree = v; }, get free() { return lockFree; } }, opens: () => opens, created: () => created, pReads: () => pReads, driveReads: () => driveReads, drive: D };
}
module.exports = { makeHub };
