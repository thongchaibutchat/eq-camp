// เส้นราคาที่ต้องขออนุมัติ + สรุปสถานะการขาย (ตัวเลขสังเคราะห์)
import { newJob, computeNsr, approvalLines, approvalSteps, approvalNeed, salesSummary, normStatus, needsFollow, tierOf, staffPay, staffOT, jobToGrid, parseNsrTab, diffForTab, SELF_MIN_TOTAL } from '../../src/nsr-core';
let fail = 0; const ok = (n: string, c: boolean, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' ' + x)); if (!c) fail++; };
const j = newJob(); j.participants = 80; j.lines = [{ label: 'ค่าที่พัก', price: 1000, qty: 1 }, { label: 'ค่าอาหาร', price: 500, qty: 1 }, { label: 'ค่าวิทยากร', price: 500, qty: 1 }] as any; j.staff = []; j.vatMode = 'rate';
j.price = 3000; const c = computeNsr(j);
const L = approvalLines(c, j.participants);
const p15 = L.find(l => l.tierId === '10-15')!.below!, p10 = L.find(l => l.tierId === 'lt10')!.below!;
ok('line prices ≈ sub/(1-7%-m), rounded like the sheet', Math.abs(p15 - 2000 / 0.78) < 2 && Math.abs(p10 - 2000 / 0.83) < 2, `${p15} ${p10}`);
ok('line totals × participants', L.find(l => l.tierId === '10-15')!.belowTotal === p15 * 80);
ok('approvers from matrix', L.find(l => l.tierId === '10-15')!.approver === 'แพนด้า' && L.find(l => l.tierId === '15-20')!.approver === 'แพนด้า' && L.find(l => l.tierId === 'lt10')!.approver === 'พี่นก' && L.every(l => !l.pending));
const p20 = L.find(l => l.tierId === '15-20')!.below!;
const at = (p: number, n = 80) => { const k = { ...j, price: p, participants: n }; const c = computeNsr(k); return { a: approvalNeed(c, n), t: tierOf(c.pct!).tier.id, tier: c.tier, total: c.nsrTotal }; };
const S80 = approvalSteps(computeNsr(j), 80);
ok('steps merge same approver: p20 แพนด้า, p10 พี่นก', S80.length === 2 && S80[0].below === p20 && S80[0].approver === 'แพนด้า' && S80[1].below === p10 && S80[1].approver === 'พี่นก', JSON.stringify(S80));
ok('exactly 20% → self-approve (no need)', !at(p20).a.need && at(p20).t === 'gt20' && at(p20).tier!.approver === 'ยืนยันได้เอง', JSON.stringify(at(p20)));
ok('1 baht below 20% line → แพนด้า, tier 15-20', at(p20 - 1).a.need && at(p20 - 1).a.approver === 'แพนด้า' && at(p20 - 1).t === '15-20');
ok('15% exactly → แพนด้า (10-15 not, 15-20)', at(p15).t === '15-20' && at(p15).a.approver === 'แพนด้า');
ok('below 10% line → พี่นก, tier lt10', at(p10 - 1).a.approver === 'พี่นก' && at(p10 - 1).t === 'lt10');
ok('room = price − top line', at(3000).a.room === 3000 - p20);
// 35,000 rule: 50 คน → NSR ≥20% แต่ยอดรวมต่ำกว่า 35,000 → แจ้งแพนด้า
const small = at(p20, 50); const S50 = approvalSteps(computeNsr({ ...j, participants: 50 }), 50);
ok('35k: total step above 20% line when few participants', S50[0].key === 'total' && S50[0].below > p20 && S50[0].approver === 'แพนด้า', JSON.stringify(S50));
ok('35k: ≥20% but total < 35,000 → notify แพนด้า', small.t === 'gt20' && small.a.need && small.a.step!.key === 'total' && small.tier!.approver === 'แพนด้า' && (small.total as number) < SELF_MIN_TOTAL, JSON.stringify(small));
const okTot = at(S50[0].below, 50); ok('35k: at total line → self', !okTot.a.need && (okTot.total as number) >= SELF_MIN_TOTAL && okTot.tier!.approver === 'ยืนยันได้เอง', JSON.stringify(okTot));
// ค่าล่วงเวลา 25% ต่อคืน
const sl = { role: 'สต๊าฟ', rate: 1000, people: 2, days: 3, advance: 500, ot: 2 };
ok('OT = rate × 25% × people × nights', staffOT(sl) === 1000 && staffPay(sl) === 6000 + 1000 + 1000);
const jo = { ...newJob(), name: 'OT', participants: 80, price: 3000, staff: [{ ...sl }] } as any;
const grid = jobToGrid(jo, 'test'); const flat = JSON.stringify(grid);
ok('new tab grid has OT columns + M includes O', grid[1][13] === 'คืนล่วงเวลา' && /=I3\*25%\*J3\*N3/.test(flat) && /\+\(L3\*J3\)\+O3/.test(flat) && /=SUM\(O3:O3\)/.test(flat));
const g2 = grid.map(r => r.map(c => ({ v: typeof c === 'object' ? '' : String(c), f: typeof c === 'object' ? c.f : undefined })));
g2[2][12] = { v: '8000', f: (grid[2][12] as any).f };   // ชีตคำนวณ M แล้ว
const back = parseNsrTab('OT', g2 as any, 1, 0)!;
ok('parse reads OT nights + column', back.staff[0].ot === 2 && back.layout!.otCol === 14, JSON.stringify(back.staff[0]));
const ed = diffForTab(back, { ...back, staff: [{ ...back.staff[0], ot: 3 }] }) as any;
ok('diff edits OT cell (col N)', ed.ok && ed.edits.some((e: any) => e.c === 14 && e.v === 3));
const noOt = { ...back, layout: { ...back.layout!, otCol: 0 } };
ok('diff refuses OT change on tab without OT column', (diffForTab(noOt, { ...noOt, staff: [{ ...noOt.staff[0], ot: 3 }] }) as any).ok === false);
const st = new Map([[1, normStatus({ sheetId: 1, status: 'won', finalPax: 90, finalPrice: 3000 })!], [2, normStatus({ sheetId: 2, status: 'lost', reason: 'ราคาสูงกว่างบโรงเรียน' })!], [3, normStatus({ sheetId: 3, status: 'quoted', at: new Date(Date.now() - 20 * 864e5).toISOString() })!], [4, normStatus({ sheetId: 4, status: 'hold', followUp: '2099-01-01', price: 2000, participants: 50 })!]]);
const rows = [1, 2, 3, 4, 5].map(id => ({ sheetId: id, price: 2500, participants: 100, pct: 0.2 }));
const S = salesSummary(rows, st);
ok('summary counts', S.by.won === 1 && S.by.lost === 1 && S.by.quoted === 1 && S.by.hold === 1 && S.none === 1);
ok('won value uses final figures', S.wonValue === 90 * 3000, String(S.wonValue));
ok('open value = quoted + hold', S.openValue === 2500 * 100 + 2000 * 50, String(S.openValue));
ok('win rate of decided', S.winRate === 0.5);
ok('follow-up: old quote without date', S.follow === 1 && needsFollow(st.get(3)!) && !needsFollow(st.get(4)!));
ok('lost reasons tallied', S.reasons[0][0] === 'ราคาสูงกว่างบโรงเรียน');
ok('bad status rejected', normStatus({ sheetId: 9, status: 'maybe' }) === null && normStatus({ status: 'won' }) === null);
process.exitCode = fail ? 1 : 0;
