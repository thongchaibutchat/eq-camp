// ทดสอบโค้ด Apps Script ของศูนย์กลางทีมในสภาพแวดล้อมจำลอง (SpreadsheetApp/Properties/Lock/Content/ScriptApp)
// รัน: node scripts/qa/gas-mock-test.cjs <Code.gs>
const fs = require('fs');
const code = fs.readFileSync(process.argv[2], 'utf8');
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
        setValues: v => { v.forEach((row, i) => row.forEach((x, j) => { g[r - 1 + i][c - 1 + j] = x; })); },
        setValue: v => { g[r - 1][c - 1] = v; }, clearContent: () => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) g[r - 1 + i][c - 1 + j] = ''; },
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
const props = {}; const triggers = [];
const env = {
  SpreadsheetApp: { getActiveSpreadsheet: () => NSR, openById: id => { if (!files[id]) throw new Error('nf'); return files[id]; }, create: n => { const id = 'HUB' + (++created); files[id] = SS(id, n); return files[id]; } },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); }, getProperties: () => ({ ...props }) }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  ContentService: { createTextOutput: s => ({ s, setMimeType() { return this; } }), MimeType: { JSON: 'json' } },
  ScriptApp: { getProjectTriggers: () => triggers, deleteTrigger: t => triggers.splice(triggers.indexOf(t), 1), newTrigger: h => ({ forSpreadsheet: id => ({ onEdit: () => ({ create: () => { triggers.push({ getHandlerFunction: () => h, id }); } }) }) }) }
};
const fn = new Function(...Object.keys(env), code + '\nreturn { doPost, doGet, onEdit, setup };')(...Object.values(env));
const KEY = (code.match(/const TEAM_KEY = '([^']+)'/) || [])[1];
const call = (op, body = {}) => JSON.parse(fn.doPost({ postData: { contents: JSON.stringify({ ...body, op, key: KEY }) } }).s);
let fail = 0; const ok = (n, c, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' ' + x)); if (!c) fail++; };
ok('wrong key rejected', JSON.parse(fn.doPost({ postData: { contents: JSON.stringify({ op: 'rev', key: 'nope' }) } }).s).error === 'key');
const r0 = call('rev'); ok('rev', r0.ok && typeof r0.rev === 'string', JSON.stringify(r0));
const l = call('nsr.list'); ok('nsr.list', l.ok && l.tabs.length === 2 && /spreadsheets/.test(l.url), JSON.stringify(l).slice(0, 200));
const rd = call('nsr.read', { tabs: ['stem@ทดสอบ', 'ไม่มี'] }); ok('nsr.read', rd.tabs[0].values[1][1] === 'STEM' && rd.tabs[1].missing);
const cr = call('nsr.create', { title: 'ใหม่@ทดสอบ', index: 1, rows: [['a', 'b'], ['=1+1', 3]], fmt: { boldRows: [1], moneyCols: [3], pctCells: [[2, 3]], staffCols: [3, 8] } });
ok('nsr.create', cr.ok && NSR.getSheetByName('ใหม่@ทดสอบ') && NSR._sheets[1].getName() === 'ใหม่@ทดสอบ', JSON.stringify(cr));
ok('nsr.create duplicate refused', call('nsr.create', { title: 'ใหม่@ทดสอบ', rows: [['x']] }).error === 'exists');
ok('rev changed after write', call('rev').rev !== r0.rev);
const e1 = call('nsr.edit', { title: 'stem@ทดสอบ', edits: [{ r: 2, c: 4, v: 90, was: '80' }] }); ok('nsr.edit', e1.ok && t1._g[1][3] === 90);
const e2 = call('nsr.edit', { title: 'stem@ทดสอบ', edits: [{ r: 2, c: 4, v: 95, was: '80' }] }); ok('nsr.edit conflict', e2.error === 'conflict' && e2.conflicts[0].now === '90');
const since = Date.now() - 60000;
const ch = call('nsr.changes', { since }); ok('nsr.changes lists edited tabs', ch.ids.includes(t1.getSheetId()), JSON.stringify(ch));
fn.onEdit({ range: { getSheet: () => t1 } }); ok('onEdit bumps rev', call('rev').rev.split('.')[1] !== '0');
ok('trigger installed (standalone)', /NSR_ID = '';/.test(code) ? true : triggers.length === 1);
const lg = call('log', { ev: { eid: 'e1', ts: '2026-11-18', school: 'รร.ก', students: 80 } }); ok('log', lg.ok);
ok('log dedupe', call('log', { ev: { eid: 'e1' } }).dup === true);
const lm = call('log.many', { events: [{ eid: 'e1' }, { eid: 'e2', school: 'รร.ข' }, { eid: 'e3' }] }); ok('log.many adds new only', lm.added === 2, JSON.stringify(lm));
const ev = call('events'); ok('events', ev.events.length === 3 && ev.events.some(e => e.school === 'รร.ข'));
const big = { camp: { school: 'x'.repeat(120000) } };
const jp = call('job.put', { job: { id: 'j1', name: 'งาน 1', snap: big }, dev: 'd1', by: 'ก' }); ok('job.put big (chunked)', jp.ok);
const jg = call('job.get', { id: 'j1' }); ok('job.get roundtrip', jg.job && jg.job.snap.camp.school.length === 120000 && jg.job.by === 'ก');
call('job.put', { job: { id: 'j1', name: 'งาน 1 แก้', snap: { a: 1 } }, dev: 'd2' });
const jg2 = call('job.get', { id: 'j1' }); ok('job.put overwrite shrinks', jg2.job.name === 'งาน 1 แก้' && jg2.job.snap.a === 1);
const js = call('jobs'); ok('jobs list no snap', js.jobs.length === 1 && !js.jobs[0].snap);
call('job.del', { id: 'j1' }); ok('job.del soft', call('jobs').jobs[0].deleted === true);
ok('hub spreadsheet created once', created === 1 && files.HUB1.getSheetByName('Log') && files.HUB1.getSheetByName('Jobs'));
ok('doGet', JSON.parse(fn.doGet().s).ok);
ok('unknown op', call('zzz').error === 'op');
process.exitCode = fail ? 1 : 0;
