import test from "node:test";
import assert from "node:assert/strict";
import { weekRange, computeWeeklyReview, formatWeeklySummary } from "./weeklyReview.js";

const LINES = [
  { id: "store", label: "格仔鋪", emoji: "🏪" },
  { id: "edu", label: "教育中心", emoji: "📚" },
];
const cfg = { lines: LINES };
const t = (line, status, extra = {}) => ({ title: `${line}-${status}`, line, status, ...extra });

test("weekRange starts on Monday and ends on Sunday", () => {
  assert.deepEqual(weekRange("2026-11-25"), { start: "2026-11-23", end: "2026-11-29" }); // Wed
  assert.deepEqual(weekRange("2026-11-29"), { start: "2026-11-23", end: "2026-11-29" }); // Sun
  assert.deepEqual(weekRange("2026-11-23"), { start: "2026-11-23", end: "2026-11-29" }); // Mon
});

test("counts done/skip per line from archive days inside each week", () => {
  const state = {
    date: "2026-11-25",
    tasks: [],
    archive: [
      { date: "2026-11-24", tasks: [t("store", "done"), t("store", "skip"), t("edu", "done")] },
      { date: "2026-11-18", tasks: [t("store", "done"), t("store", "done")] },
      { date: "2026-11-10", tasks: [t("store", "done")] }, // 兩週前，唔計
    ],
  };
  const r = computeWeeklyReview(state, cfg, "2026-11-25");
  const store = r.rows.find(x => x.id === "store");
  assert.equal(store.thisWeek.done, 1);
  assert.equal(store.thisWeek.skip, 1);
  assert.equal(store.lastWeek.done, 2);
  assert.equal(r.total.thisWeek.done, 2);
  assert.equal(r.total.lastWeek.done, 2);
});

test("includes today's not-yet-archived done tasks", () => {
  const state = { date: "2026-11-25", tasks: [t("edu", "done"), t("edu", "open")], archive: [] };
  const r = computeWeeklyReview(state, cfg, "2026-11-25");
  assert.equal(r.rows.find(x => x.id === "edu").thisWeek.done, 1);
});

test("delegate received counts as done; unreceived delegate does not", () => {
  const state = {
    date: "2026-11-25",
    tasks: [t("store", "delegate", { received: true }), t("store", "delegate", { received: false })],
    archive: [],
  };
  const r = computeWeeklyReview(state, cfg, "2026-11-25");
  assert.equal(r.rows.find(x => x.id === "store").thisWeek.done, 1);
});

test("overdue = open tasks with due before today, snapshot only", () => {
  const state = {
    date: "2026-11-25",
    tasks: [
      t("store", "open", { due: "2026-11-20" }),
      t("store", "open", { due: "2026-11-30" }),
      t("store", "open"),
      t("store", "done", { due: "2026-11-01" }),
    ],
    archive: [],
  };
  const r = computeWeeklyReview(state, cfg, "2026-11-25");
  assert.equal(r.rows.find(x => x.id === "store").overdue, 1);
  assert.equal(r.total.overdue, 1);
});

test("completion rate = done / (done + skip + overdue) for this week; null when nothing", () => {
  const state = {
    date: "2026-11-25",
    tasks: [t("store", "open", { due: "2026-11-20" })],
    archive: [{ date: "2026-11-24", tasks: [t("store", "done"), t("store", "done"), t("store", "skip")] }],
  };
  const r = computeWeeklyReview(state, cfg, "2026-11-25");
  assert.equal(r.rows.find(x => x.id === "store").thisWeek.rate, 50); // 2 / (2+1+1)
  assert.equal(r.rows.find(x => x.id === "edu").thisWeek.rate, null);
});

test("lines unknown to cfg fall into 個人", () => {
  const state = { date: "2026-11-25", tasks: [], archive: [{ date: "2026-11-24", tasks: [t("selfx", "done")] }] };
  const r = computeWeeklyReview(state, cfg, "2026-11-25");
  assert.equal(r.rows.find(x => x.id === "personal").thisWeek.done, 1);
});

test("handles missing archive/tasks and does not mutate input", () => {
  const state = Object.freeze({ date: "2026-11-25" });
  const r = computeWeeklyReview(state, cfg, "2026-11-25");
  assert.equal(r.total.thisWeek.done, 0);
});

test("formatWeeklySummary produces Cantonese text with deltas", () => {
  const state = {
    date: "2026-11-25",
    tasks: [],
    archive: [
      { date: "2026-11-24", tasks: [t("store", "done"), t("store", "done"), t("store", "done")] },
      { date: "2026-11-18", tasks: [t("store", "done")] },
    ],
  };
  const r = computeWeeklyReview(state, cfg, "2026-11-25");
  const txt = formatWeeklySummary(r);
  assert.match(txt, /週檢討/);
  assert.match(txt, /11\/23/);
  assert.match(txt, /🏪 格仔鋪/);
  assert.match(txt, /完成 3/);
  assert.match(txt, /▲2/); // 3 vs 1
});
