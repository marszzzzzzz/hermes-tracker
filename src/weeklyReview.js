// v20：週檢討 — 純函數（冇 React、冇 side effect），方便喺 node 度 test。
// 資料來源：state.archive（每日一組已關任務）＋ 今日 state.tasks。
// 注意：archive 只記 title/line/status，冇 created，所以上週比較只用「完成／跳過」數；
//       逾期係「而家」嘅 snapshot（open 而且 due < 今日），上週冇得追溯。

const DAY_MS = 86400000;
const PERSONAL = { id: "personal", label: "個人", emoji: "🧍" };

const toDate = iso => new Date(`${iso}T00:00:00`);
const fmt = d => d.toLocaleDateString("en-CA");
const shift = (iso, n) => { const d = toDate(iso); d.setDate(d.getDate() + n); return fmt(d); };

// 週一至週日
export function weekRange(iso) {
  const dow = toDate(iso).getDay(); // 0=Sun
  const start = shift(iso, -((dow + 6) % 7));
  return { start, end: shift(start, 6) };
}

const inRange = (iso, r) => iso >= r.start && iso <= r.end;
const isDone = k => k.status === "done" || (k.status === "delegate" && !!k.received);
const isSkip = k => k.status === "skip";
const emptyBucket = () => ({ done: 0, skip: 0 });
const addTo = (b, k) => ({ done: b.done + (isDone(k) ? 1 : 0), skip: b.skip + (isSkip(k) ? 1 : 0) });

// 完成率 = done / (done + skip + overdue)；冇任何數據就 null
function finish(b, overdue) {
  const base = b.done + b.skip + overdue;
  return { ...b, rate: base ? Math.round((100 * b.done) / base) : null };
}

export function computeWeeklyReview(state, cfg, today) {
  const cur = weekRange(today);
  const prev = { start: shift(cur.start, -7), end: shift(cur.start, -1) };
  const lines = [...cfg.lines, PERSONAL];
  const known = new Set(cfg.lines.map(l => l.id));
  const rowId = k => (known.has(k.line) ? k.line : PERSONAL.id);

  const days = [
    ...(state.archive || []),
    { date: state.date, tasks: state.tasks || [] }, // 今日未封存嘅任務
  ];

  const acc = Object.fromEntries(lines.map(l => [l.id, { thisWeek: emptyBucket(), lastWeek: emptyBucket(), overdue: 0 }]));
  for (const day of days) {
    const key = inRange(day.date, cur) ? "thisWeek" : inRange(day.date, prev) ? "lastWeek" : null;
    if (!key) continue;
    for (const k of day.tasks || []) acc[rowId(k)][key] = addTo(acc[rowId(k)][key], k);
  }
  for (const k of state.tasks || []) {
    if (k.status === "open" && k.due && k.due < today) acc[rowId(k)].overdue += 1;
  }

  const rows = lines.map(l => ({
    id: l.id, label: l.label, emoji: l.emoji,
    overdue: acc[l.id].overdue,
    thisWeek: finish(acc[l.id].thisWeek, acc[l.id].overdue),
    lastWeek: finish(acc[l.id].lastWeek, 0),
  }));

  const sum = key => rows.reduce((b, r) => ({ done: b.done + r[key].done, skip: b.skip + r[key].skip }), emptyBucket());
  const overdue = rows.reduce((a, r) => a + r.overdue, 0);
  const total = { overdue, thisWeek: finish(sum("thisWeek"), overdue), lastWeek: finish(sum("lastWeek"), 0) };

  return { range: cur, prevRange: prev, rows, total };
}

export const deltaText = (now, before) => {
  const d = now - before;
  return d === 0 ? "＝" : d > 0 ? `▲${d}` : `▼${-d}`;
};

const md = iso => { const [, m, d] = iso.split("-"); return `${Number(m)}/${Number(d)}`; };

export function formatWeeklySummary(review) {
  const { range, rows, total } = review;
  const pct = r => (r === null ? "—" : `${r}%`);
  const head = `📈 週檢討 ${md(range.start)}–${md(range.end)}`;
  const totalLine = `總計：完成 ${total.thisWeek.done}（${deltaText(total.thisWeek.done, total.lastWeek.done)} vs 上週）・跳過 ${total.thisWeek.skip}・逾期 ${total.overdue}・完成率 ${pct(total.thisWeek.rate)}`;
  const lines = rows
    .filter(r => r.thisWeek.done || r.thisWeek.skip || r.lastWeek.done || r.overdue)
    .map(r => `${r.emoji} ${r.label}：完成 ${r.thisWeek.done}（${deltaText(r.thisWeek.done, r.lastWeek.done)}）・跳過 ${r.thisWeek.skip}・逾期 ${r.overdue}・${pct(r.thisWeek.rate)}`);
  return [head, totalLine, ...lines].join("\n");
}
