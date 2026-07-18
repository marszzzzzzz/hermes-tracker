import { useState, useEffect, useRef, Fragment } from "react";
import { Flame, Check, SkipForward, UserRoundPlus, Plus, RotateCcw, FileText, Mail, Sparkles, Send, X, ListTodo, PieChart, Pencil, CalendarDays, Trash2, ChevronLeft, ChevronRight, Archive, ArrowUpCircle, ChartNoAxesGantt } from "lucide-react";

// v19.1：甘特圖易讀性 — ➖／➕ 縮放（60%–200%，格闊／行高／bar 高跟住縮放），
//        任務名欄加闊＋兩行顯示（唔再一行截斷），chart 用負 margin 谷闊到盡屏幕。
// v19：📊 甘特圖 tab — 日／週／月／兩個月 四段時間軸：
//      日 view 用鐘頭軸（07–23，有 ⏰ 提醒嘅任務標喺嗰個鐘）；
//      週／月／兩月用日軸 — 任務 bar 由 created／連紅起點畫到 due／死線／今日
//      （🔵進行中 🔴連紅 🟠委派 🟢完成），🔁 週期任務逐個到期日標格，
//      ✅ 封存完成一行彙總（每日數量），🎯 WIG 由今日推去 term 期限
//      （短=衝刺尾／中=+45日／長=+90日）。task 由 v19 起記 created 日期。
// v18：📦 封存 tab ＋ 🗓️ WIG 計劃表 ＋ 任務 filter —
//      新第四個 tab「封存」：過咗嗰日，已關任務（✅／⏭️／📤已收貨）rollover 時
//      自動封存入嚟（每日一組，留 60 日），有 🔍 搜尋，唔再留喺 task list。
//      🗓️ WIG 計劃表：WIG board 得 6 位，未輪到嘅目標喺度排隊 —
//      手動加或者 🌱 AI 建議（label＋期＋P），撳 P／期即場改，⬆️ 一撳推上 board。
//      今日 tab 加咗 filter（全部／🔴／✅／⏭️／📤），filter 開咗冇 match 嘅線收起。
// v17.1：修正月曆 tab 打字打一個字就失焦 — Card／Chip／SectionHeader／StatusBtn
//        本來定義喺 component 入面，每次 render 都係新 identity，React 成個
//        subtree remount，input 即刻失焦。而家搬晒上 module 層（v11 同款 bug，
//        今次連根拔起）。
// v17：📅 月曆 tab ＋ 🔁 週期任務 —
//      新第三個 tab「月曆」：月份格仔顯示每日嘅 ⏰提醒／📤委派死線／
//      🔁週期任務／🎯WIG 完成日；撳一日睇明細。今日嘅任務可以喺月曆度
//      直接改名（✏️）同刪除（🗑️ — 全 app 第一次有得刪任務）。
//      週期任務：任何一日都可以加「單次／每週（逢週X）／每月（X 號）」，
//      到期嗰日自動加落 task list（每月 31 號喺短月自動貼月尾；
//      單次落單後自動剷走）。「所有週期任務」清單一眼睇晒＋管理。
// v16：🎪 今日主場（多業務老闆日日要答嘅問題：今日主力做邊瓣？）—
//      今日 tab 揀 1–2 條業務線做主場：section 排上最前＋header 標 🎪，
//      AI（對話／🌱延伸／WIG 建議）全部圍住主場轉。
//      冷落建議：邊條業務線連續 3 日冇完成過任務（lastDone 記錄，mark done
//      同收工報告 sync 都會更新），app 就建議佢做今日主場 —「就係佢」一撳即set。
//      ☀️ 10am digest 都會提埋（未揀主場先出）。主場係當日限定，過日自動清。
// v15：☀️ 每朝 10:00 自動推送今日任務清單 —
//      瀏覽器通知（最多 8 條未關任務）＋app 內 digest 卡片（唔使通知權限都見到）。
//      網頁限制：tab／PWA 開住先推到；10 點後先開 app 就即刻補推。
//      digestDate 記低今日推咗未（一日一次，過日自動重置，重設今日唔會重推）。
//      🔔 提醒清單下面加咗說明＋「開通知」掣（權限未俾先出）。
// v14.4：🌱 延伸 ×3 會學你手打嘅延伸任務 —
//        「✍️ 其他」自己打嘅延伸任務會記入 extLog（原任務→你打嘅延伸，
//        最近 50 條，過日／重設今日都保留），每次撳 🌱 延伸都會餵埋俾 AI
//        （同線例子行先），叫佢向你親手寫嘅方向同風格睇齊，一路用一路準。
// v14.3：收工報告 sync 新增嘅任務而家會放返入啱嘅業務線 —
//        解構任務行嗰陣保留返狀態 emoji 後面嘅業務線 emoji（🏪🥩💎📚🧠🤖），
//        用佢對返 cfg.lines 搵 line id（主攻線埋 focus flag），
//        搵唔到先至落「個人」。AI 收工報告格式指引都補返呢個要求。
// v14.2：修正 v14.1 之後發現嘅兩個問題 —
//      1) 之前套用收工報告 sync 唔理有冇實際 match 到都照樣顯示「✓ 已更新」，
//         用戶冇辦法分辨其實乜都冇做到 — 而家老實顯示 matched/created/total 數。
//      2) sync 之前淨係識更新「已經喺 task list 度」嘅任務 —— 如果係淨係口頭
//         同 AI 講、未撳過＋加落 task list 嘅任務，match 唔到就即刻捨棄，
//         乜都唔會發生。而家 match 唔到嘅任務會照抄報告入面嘅狀態自動加做
//         新任務，唔使自己手動先加一次先再 sync。
// v14.1：修正 v14 兩個 bug —
//      1) AI 輸入格由 <input>（單行）換做 <textarea>（可自動長高），
//         貼收工報告呢類多行文字入去唔會再俾瀏覽器剝晒個 \n，
//         令 parseReportSync 讀到返晒逐行內容（之前得返一坨嘢，match 唔到）。
//      2) WIG 已經改成「打勾即封存去路線圖」，s.wigs 入面已經冇可能有
//         done:true 嘅紀錄 —— 舊嘅收工報告 WIG 逐條 sync（✓/○ match）
//         永遠都唔會觸發，係 dead code，成個攞走；報告淨係顯示現行 WIG
//         ＋路線圖總數已經夠。
// v14：🗺️ 36 個目標路線圖 — WIG 打勾完成即刻封存出 WIG board，存入路線圖
//      （連 6 格上限即時騰返個位），路線圖顯示 X/36 進度＋完成日期，
//      6 秒內可 ↩️ 復原。舊資料入面已經 done 嘅 WIG 開機自動搬一次。
//      ✨ AI 助手偵測「收工報告」格式（user 貼入嚟或者 AI 覆述都得）—
//      一認到就喺條 message 底下彈「套用去 task list」掣，
//      一撳就將 ✅/⏭️/📤/🔴 逐條 match 返做任務狀態更新。
// v13：任務可以設 ⏰ 提醒（日期時間＋一次／每1小時／每3小時／每8小時／每日）；
//      儀表板新增「🔔 提醒清單」— 齊晒所有提醒 + 每個 PIC 委派任務嘅死線；
//      到鐘會轉紅＋（app 開住時）彈瀏覽器通知；重複提醒自動排下一輪。
// v12：🌱 延伸建議可以俾 1–5 ★ 評分 — 評分會記低（最近 100 次），
//      以後 AI 出建議會參考你嘅口味（高分嗰類多啲、低分嗰類避開）；
//      WIG 追蹤板可編輯（✏️ 改名、撳 P 轉優先級、撳期切換、🗑️ 刪除）；
//      WIG 板加「🌱 AI 建議」— AI 睇住你而家啲 WIG 同業務狀態建議新 WIG。
// v11：任務名可以編輯（撳任務名 → 改 → ✓）；🌱 延伸 ×2 升做 ×3；
//      延伸建議度加「✍️ 其他」自己打任務；修正打字期間 input 失焦嘅 bug
//      （內部 component 每次 render 重新建立導致 remount — 改用直接函數呼叫）。
// v10.4：雙環境儲存 — artifact 有 window.storage 就用佢；
// 獨立網頁（Vite/GitHub Pages/Wix 自己 host）自動 fallback 去 localStorage，
// 咁同一份 file 喺 artifact 內外都行到，儲存兩邊都通。
if (typeof window !== "undefined" && !window.storage) {
  window.storage = {
    async get(k) { const v = localStorage.getItem("ws:" + k); if (v === null) throw new Error("key not found"); return { key: k, value: v }; },
    async set(k, v) { localStorage.setItem("ws:" + k, v); return { key: k, value: v }; },
    async delete(k) { localStorage.removeItem("ws:" + k); return { key: k, deleted: true }; },
    async list(prefix = "") { return { keys: Object.keys(localStorage).filter(x => x.startsWith("ws:" + prefix)).map(x => x.slice(3)) }; },
  };
}

// ═══════════════════════════════════════════════════════════════
// Hermes AI · Daily Work Tracker v10 — APPLE STYLE + DASHBOARD + 多 AI PROVIDER
// v10 新增：⚙️ AI 設定可揀 Claude / Gemini 2.5 Flash-Lite / OpenAI（gpt-4o-mini），
//          各自入 key，✨助手／✂️拆細／🌱延伸 全部跟你揀嘅 provider 行。
// v9 修復：
//  1. AI 對話／✂️拆細／🌱延伸 全部改行同一條 callClaude() 通道 —
//     claude.ai artifact 入面 keyless 直用；本地測試喺儀表板「AI 設定」
//     入一次 Anthropic API key（淨係存喺你自己部機 localStorage）。
//  2. ✂️拆細／🌱延伸 唔再靠唔存在嘅 /api/extend /api/split 後端。
//  3. 收工報告包齊所有任務：✅完成（連⭐）/⏭️Skip/📤委派/🔴未關 + WIG。
// 資料 keys 不變（hermes-state-v6）— 舊數據無縫沿用。
// ═══════════════════════════════════════════════════════════════
const DEFAULT_CONFIG = {
  sprint: { num: 7, start: "2026-07-10", end: "2026-07-19" },
  reviewDay: 6, // 週六檢討
  budget: { focusPct: 60, focusHrs: 4, restPct: 40, restHrs: 2 },
  lines: [
    { id: "selfdev", label: "Self Development", emoji: "🧠", tier: "focus" },
    { id: "aidev", label: "AI Agent Development", emoji: "🤖", tier: "focus" },
    { id: "store", label: "格仔鋪", emoji: "🏪", tier: "biz" },
    { id: "food", label: "凍肉批發", emoji: "🥩", tier: "biz" },
    { id: "diamond", label: "LAD Diamond", emoji: "💎", tier: "biz", gated: true },
    { id: "edu", label: "教育中心", emoji: "📚", tier: "biz" },
  ],
  staff: [
    { id: "admin", label: "行政助理", note: "🏪+📚 staff 管理", window: null },
    { id: "sm", label: "社媒專員", note: "Mon–Wed 返工", window: [1, 2, 3] },
    { id: "pa", label: "私人助理", note: "🧠+🤖 支援", window: null },
  ],
  skipReasons: ["長線・今日唔啱時機", "等第三方"],
  skipCap: 2,
  smPublishDays: [1, 2, 3, 4, 5],
  wigs: [
    { id: "w1", label: "起好 Excel workbook", term: "短", pri: 0, done: false },
    { id: "w2", label: "08:30 推送自動化", term: "短", pri: 1, done: false },
    { id: "w3", label: "Dashboard 連用 3 日", term: "短", pri: 1, done: false },
    { id: "w4", label: "行到第一次週六檢討", term: "短", pri: 2, done: false },
    { id: "w5", label: "🏪 簽第 3 份寄賣合約", term: "短", pri: 1, done: false },
  ],
  suggestions: {
    selfdev: ["讀 10 分鐘行業材料寫 3 點 takeaway", "覆盤 1 個今週決策（5 分鐘筆記）"],
    aidev: ["寫 1 條新 prompt 入 prompt 庫", "測試 1 個 agent 自動化步驟", "更新 Excel「Tasks」1 個欄位"],
    store: ["message 2 個潛在寄賣者", "覆 1 個租格查詢"],
    food: ["跟進 1 張逾 3 日報價單", "打 1 個 Tier-2 客戶電話"],
    diamond_sales: ["1h 內報 1 個 WhatsApp inquiry 價", "跟進 1 個舊 inquiry"],
    diamond_brand: ["出 1 條 lab-grown 知識帖草稿", "影 3 張新貨相入 brand 素材庫"],
    edu: ["回覆 1 個家長查詢（<4h）", "更新招生看板 Hot / Warm / Cold"],
    personal: ["確認 1 個私人預約", "記 5 分鐘今日開支"],
  },
};

// ── iOS 系統色 ──
const C = {
  bg: "#F2F2F7", card: "#FFFFFF", body: "#1C1C1E", sub: "#8E8E93",
  line: "rgba(60,60,67,0.12)",
  blue: "#007AFF", blueSoft: "#EAF2FF",
  red: "#FF3B30", redSoft: "#FFECEB",
  pink: "#FF2D55",
  green: "#34C759", greenSoft: "#E9F9EE",
  orange: "#FF9500", orangeSoft: "#FFF3E0",
};
const FONT = '-apple-system,BlinkMacSystemFont,"SF Pro Text","SF Pro Display","PingFang HK","Helvetica Neue",system-ui,sans-serif';
const SHADOW = "0 1px 3px rgba(0,0,0,0.06)";
const BLUR = { background: "rgba(242,242,247,0.82)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" };

const uid = () => Math.random().toString(36).slice(2, 9);
const mk = (line, title, focus = false, extra = {}) => ({ id: uid(), line, title, focus, status: "open", reason: null, red: 0, assignee: null, deadline: null, received: false, due: null, score: null, ext: false, followUp: false, sm: false, remindAt: null, remindEvery: null, remindFired: false, created: todayStr(), ...extra });
const todayStr = () => new Date().toLocaleDateString("en-CA");
const addDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString("en-CA"); };
// 📊 v19：任意日期 ±n 日（甘特圖計 bar 用）
const shiftDate = (iso, n) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return d.toLocaleDateString("en-CA"); };
const snapToWindow = (iso, win) => { if (!win) return iso; const d = new Date(iso + "T00:00:00"); while (!win.includes(d.getDay())) d.setDate(d.getDate() + 1); return d.toLocaleDateString("en-CA"); };
const fmtMD = iso => (iso ? `${+iso.slice(5, 7)}/${+iso.slice(8, 10)}` : "");
// v13：提醒工具
const fmtDT = iso => { const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const toLocalInput = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const REPEAT_LABELS = { 1: "每1小時", 3: "每3小時", 8: "每8小時", 24: "每日" };
const priColor = p => (p === 0 ? C.red : p === 1 ? C.orange : C.blue);

// 🗺️ v14：36 個目標路線圖 — 固定目標數，唔開俾用戶自訂
const ROADMAP_GOAL = 36;
// 🎪 v16：業務線連續幾多日冇完成任務就建議做今日主場
const NEGLECT_DAYS = 3;
// 🔁 v17：週期任務 — routine 喺某日係咪到期
//        weekly=逢星期幾（on: 0–6）；monthly=每月幾號（on: 1–31，短月自動貼月尾）；
//        once=指定日期（on: "YYYY-MM-DD"）
const DOW_LABELS = ["日", "一", "二", "三", "四", "五", "六"];
const routineDueOn = (r, dateStr) => {
  const d = new Date(dateStr + "T00:00:00");
  if (r.freq === "once") return r.on === dateStr;
  if (r.freq === "weekly") return d.getDay() === r.on;
  const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return d.getDate() === Math.min(r.on, dim);
};
const routineFreqLabel = r => (r.freq === "once" ? `單次 ${fmtMD(r.on)}` : r.freq === "weekly" ? `逢週${DOW_LABELS[r.on]}` : `每月 ${r.on} 號`);

// ✂️ v14：解構收工報告文字用嘅 emoji 前綴
const stripLeadEmoji = (s, times = 1) => {
  let out = (s || "").trim();
  for (let i = 0; i < times; i++) {
    const m = out.match(/^\p{Extended_Pictographic}️?\s*/u);
    if (m) out = out.slice(m[0].length).trim(); else break;
  }
  return out;
};
const looksLikeReport = text => typeof text === "string" && /收工報告/.test(text) && /WIG/.test(text);
// ✂️ v14.3：抽走行頭嘅業務線 emoji 但保留返佢 — applyReportSync 靠佢
//           將新任務放返入啱嘅業務線 section（唔再一律掉入「個人」）
const takeLeadEmoji = s => {
  const t = (s || "").trim();
  const m = t.match(/^\p{Extended_Pictographic}️?\s*/u);
  return m ? { em: m[0].trim(), rest: t.slice(m[0].length).trim() } : { em: null, rest: t };
};
// 將一份收工報告文字解構做 [{kind:"task", ...}]，俾 applyReportSync 逐條 match 返落 state
// v14.1：WIG 一打勾就即刻封存去路線圖（moveWigToRoadmap），s.wigs 入面已經
//        冇可能有 done:true 嘅紀錄，所以報告都唔會再出 WIG ✓ 行 — WIG sync 呢段拎走。
function parseReportSync(text) {
  const lines = (text || "").split("\n").map(l => l.trim()).filter(Boolean);
  let section = null;
  const items = [];
  for (const line of lines) {
    if (/──/.test(line) && /今日任務/.test(line)) { section = "tasks"; continue; }
    if (/──/.test(line) && /WIG/.test(line)) { section = null; continue; }
    if (section === "tasks") {
      if (line.startsWith("✅")) {
        const { em, rest } = takeLeadEmoji(line.slice(1));
        const m = rest.match(/^(.*?)(?:（([⭐]+)）)?$/);
        items.push({ kind: "task", status: "done", em, title: (m ? m[1] : rest).trim(), score: m && m[2] ? m[2].length : null });
      } else if (line.startsWith("⏭")) {
        const { em, rest } = takeLeadEmoji(line.replace(/^⏭️?/, ""));
        const m = rest.match(/^(.*?)（(.+?)）$/);
        items.push({ kind: "task", status: "skip", em, title: (m ? m[1] : rest).trim(), reason: m ? m[2] : null });
      } else if (line.startsWith("📤")) {
        const { em, rest } = takeLeadEmoji(line.slice(2));
        const m = rest.match(/^(.*?)\s*→\s*(\S+)・死線\s*([\d/]+)(・已收貨\s*✓)?/);
        if (m) items.push({ kind: "task", status: "delegate", em, title: m[1].trim(), assignee: m[2], received: !!m[4] });
      } else if (line.startsWith("🔴")) {
        const { em, rest } = takeLeadEmoji(line.slice(2));
        const m = rest.match(/^(.*?)(?:（連紅.*?）)?$/);
        items.push({ kind: "task", status: "open", em, title: (m ? m[1] : rest).trim() });
      }
    }
  }
  return items;
}

const freshState = cfg => ({ date: todayStr(), diamondInquiry: false, wigs: cfg.wigs.map(w => ({ ...w })), roadmap: [], emailTo: "", apiKey: "", provider: "claude", geminiKey: "", openaiKey: "", tasks: [], history: [], reviewList: [], aiRatings: [], extLog: [], theme: null, lastDone: {}, routines: [], archive: [], wigPlan: [] });

function rates(s, cfg) {
  const biz = s.tasks.filter(k => k.line !== "personal" && k.status !== "delegate");
  const done = biz.filter(k => k.status === "done").length;
  const skips = biz.filter(k => k.status === "skip").length;
  const bizPct = biz.length ? Math.round((100 * (done + Math.min(skips, cfg.skipCap))) / biz.length) : 0;
  const focusIds = cfg.lines.filter(l => l.tier === "focus").map(l => l.id);
  const focusShare = biz.length ? Math.round((100 * biz.filter(k => focusIds.includes(k.line)).length) / biz.length) : 0;
  const per = s.tasks.filter(k => k.line === "personal");
  const perPct = per.length ? Math.round((100 * per.filter(k => k.status === "done").length) / per.length) : 0;
  const deleg = s.tasks.filter(k => k.status === "delegate");
  const received = deleg.filter(k => k.received).length;
  const fu = s.tasks.filter(k => k.followUp);
  const fuDone = fu.filter(k => k.status === "done").length;
  const impact = s.tasks.filter(k => k.status === "done").reduce((a, k) => a + (k.score || 1), 0);
  const overdue = deleg.filter(k => !k.received && k.deadline && k.deadline < todayStr()).length;
  return { bizPct, perPct, done, skips, denom: biz.length, closed: biz.filter(k => k.status !== "open").length, deleg: deleg.length, received, fuAll: fu.length, fuDone, impact, focusShare, overdue };
}
function rollover(s, cfg) {
  const r = rates(s, cfg);
  const carried = s.tasks.filter(k => k.status === "open").map(k => ({ ...k, red: k.red + 1 }));
  const delegOpen = s.tasks.filter(k => k.status === "delegate" && !k.received);
  const review = [...new Set([...s.reviewList, ...carried.filter(k => k.red >= 2).map(k => k.title)])];
  // 📦 v18：過咗嗰日，已關嘅任務（✅done／⏭️skip／📤已收貨）唔再消失 —
  //         封存入 archive（每日一組，留最近 60 日），封存 tab 有得睇返
  const closed = s.tasks.filter(k => k.status === "done" || k.status === "skip" || (k.status === "delegate" && k.received));
  const archive = closed.length
    ? [...(s.archive || []), { date: s.date, tasks: closed.map(k => ({ title: k.title, line: k.line, status: k.status, score: k.score || null, reason: k.reason || null, assignee: k.assignee || null })) }].slice(-60)
    : (s.archive || []);
  return { ...s, date: todayStr(), tasks: [...carried, ...delegOpen], history: [...s.history, { date: s.date, biz: r.bizPct, per: r.perPct, impact: r.impact }].slice(-14), reviewList: review, archive };
}

// ── Activity Rings（Apple Fitness 風格）──
// ── ★ 1–5 評分（v12：AI 建議評分）──
function Stars({ value, onRate }) {
  return (
    <span style={{ whiteSpace: "nowrap", lineHeight: 1 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} onClick={e => { e.stopPropagation(); onRate(n); }}
          style={{ cursor: "pointer", fontSize: 15, color: n <= (value || 0) ? "#FF9500" : "rgba(60,60,67,0.25)", padding: "2px 1.5px", WebkitTapHighlightColor: "transparent" }}>★</span>
      ))}
    </span>
  );
}

function Rings({ rows }) {
  const size = 156, cx = size / 2, cy = size / 2, sw = 13;
  const radii = [64, 47, 30];
  return (
    <svg width={size} height={size} role="img" aria-label="今日三環進度">
      {rows.map((row, i) => {
        const r = radii[i], circ = 2 * Math.PI * r;
        const pct = Math.max(0, Math.min(100, row.pct));
        return (
          <g key={row.label}>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={row.color} strokeOpacity={0.14} strokeWidth={sw} />
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={row.color} strokeWidth={sw}
              strokeLinecap="round" strokeDasharray={`${(pct / 100) * circ} ${circ}`}
              transform={`rotate(-90 ${cx} ${cy})`} />
          </g>
        );
      })}
    </svg>
  );
}

// v17.1：呢四個細 component 一定要放喺 module 層 —
// 之前定義咗喺 HermesDashboard 入面，每次 render 都新造一個 function identity，
// React 當佢係「另一個 component」→ 成個 <Card>/<Chip> subtree unmount 再 mount，
// 入面嘅 input 打一個字就失焦（v11 隻 bug 換咗個殼再現：月曆 tab 打字打唔到）。
const StatusBtn = ({ onClick, bg, fg, children, label }) => (
  <button onClick={onClick} aria-label={label} className="flex items-center justify-center" style={{ width: 40, height: 40, borderRadius: 13, background: bg, color: fg, border: "none", flexShrink: 0, WebkitTapHighlightColor: "transparent" }}>{children}</button>
);
const Chip = ({ bg, fg, children, onClick }) => (
  <button onClick={onClick} className="text-xs font-semibold" style={{ background: bg, color: fg, border: "none", borderRadius: 999, padding: "7px 12px", WebkitTapHighlightColor: "transparent" }}>{children}</button>
);
const Card = ({ children, style: st }) => (
  <div style={{ background: C.card, borderRadius: 16, boxShadow: SHADOW, ...st }}>{children}</div>
);
const SectionHeader = ({ children, color }) => (
  <p className="text-xs font-semibold uppercase px-1" style={{ color: color || C.sub, letterSpacing: "0.06em" }}>{children}</p>
);

export default function HermesDashboard() {
  const [cfg, setCfg] = useState(null);
  const [state, setState] = useState(null);
  const [tab, setTab] = useState("today"); // "today" | "dash" | "cal"
  // 📅 v17：月曆 tab
  const [calYM, setCalYM] = useState(todayStr().slice(0, 7)); // 顯示緊邊個月 "YYYY-MM"
  const [calSel, setCalSel] = useState(todayStr()); // 揀咗邊一日
  const [calDraft, setCalDraft] = useState("");
  const [calLine, setCalLine] = useState("personal");
  const [calFreq, setCalFreq] = useState("once"); // "once" | "weekly" | "monthly"
  const [calEditId, setCalEditId] = useState(null);
  const [calEditDraft, setCalEditDraft] = useState("");
  // 📦 v18：任務清單 filter ＋ 封存 tab ＋ WIG 計劃表
  const [taskFilter, setTaskFilter] = useState("all"); // all | open | done | skip | delegate
  const [boxSearch, setBoxSearch] = useState("");
  const [planDraft, setPlanDraft] = useState("");
  const [planSugs, setPlanSugs] = useState([]);
  const [planSugLoading, setPlanSugLoading] = useState(false);
  const [planSugErr, setPlanSugErr] = useState("");
  // 📊 v19：甘特圖 tab 嘅時間範圍
  const [ganttRange, setGanttRange] = useState("week"); // day | week | month | two
  const [ganttZoom, setGanttZoom] = useState(1); // v19.1：0.6–2.0 倍
  const [skipFor, setSkipFor] = useState(null);
  const [delegFor, setDelegFor] = useState(null);
  const [adding, setAdding] = useState(null);
  const [draft, setDraft] = useState("");
  const [report, setReport] = useState(null);
  const [mailStatus, setMailStatus] = useState(null);
  const [mailDetail, setMailDetail] = useState("");
  const [extFor, setExtFor] = useState(null);
  const [extLoading, setExtLoading] = useState(false);
  const [extSugs, setExtSugs] = useState([]);
  const [extErr, setExtErr] = useState("");
  const [extCustom, setExtCustom] = useState(""); // v11：延伸「✍️ 其他」自己打
  const [editingId, setEditingId] = useState(null); // v11：編輯緊邊個任務
  const [editDraft, setEditDraft] = useState("");
  const [splitFor, setSplitFor] = useState(null);
  const [splitErr, setSplitErr] = useState(null); // { id, msg }
  const [wigAdding, setWigAdding] = useState(false);
  const [wigDraft, setWigDraft] = useState("");
  const [wigTerm, setWigTerm] = useState("短");
  const [wigPri, setWigPri] = useState(1);
  const [wigEditId, setWigEditId] = useState(null); // v12：編輯緊邊個 WIG
  const [wigEditDraft, setWigEditDraft] = useState("");
  const [wigSugs, setWigSugs] = useState([]); // v12：WIG 板 AI 建議
  const [wigSugLoading, setWigSugLoading] = useState(false);
  const [wigSugErr, setWigSugErr] = useState("");
  const [remindFor, setRemindFor] = useState(null); // v13：設緊提醒嘅任務 id
  const [remindDraft, setRemindDraft] = useState("");
  const [remindRepeat, setRemindRepeat] = useState(null); // null=一次 | 1 | 3 | 8 | 24
  // 🗺️ v14：WIG 封存去路線圖之後嘅 ↩️ 復原 toast
  const [archivedToast, setArchivedToast] = useState(null); // { wig }
  const archivedTimer = useRef(null);
  // ☀️ v15：朝早 10 點任務清單 digest 嘅 app 內卡片
  const [digestToast, setDigestToast] = useState(null); // { count, titles, themeLine }
  const cfgRef = useRef(null); // v16：digest effect（空 deps）攞唔到最新 cfg — 用 ref 橋接
  // ✨ AI 助手
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMsgs, setAiMsgs] = useState([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSugs, setAiSugs] = useState([]);
  const [syncedMsgs, setSyncedMsgs] = useState({}); // v14：邊條 message 已經套用咗收工報告 sync
  const [storageOk, setStorageOk] = useState(null); // v10.1：storage 自我檢測（null=檢緊 true=通 false=斷）
  const [pingStatus, setPingStatus] = useState(null); // v10.2：AI 連線測試 null | "testing" | {ok, msg}
  const aiEndRef = useRef(null);
  const aiInputRef = useRef(null); // v14.1：textarea 自動長高用

  useEffect(() => { if (aiOpen) aiEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [aiMsgs, aiLoading, aiOpen]);
  useEffect(() => { cfgRef.current = cfg; }, [cfg]); // v16
  // v14.1：input 換成 textarea 之後，隨內容自動長高（上限 120px，之後先滾動）
  useEffect(() => {
    const el = aiInputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [aiInput]);

  // v13：提醒鬧鐘 — 每 30 秒檢查一次；app 開住先會彈通知（網頁限制）
  useEffect(() => {
    const t = setInterval(() => {
      setState(prev => {
        if (!prev) return prev;
        const now = Date.now();
        let changed = false;
        const tasks = prev.tasks.map(k => {
          if (!k.remindAt || k.remindFired || k.status === "done") return k;
          const at = new Date(k.remindAt).getTime();
          if (at > now) return k;
          changed = true;
          try { if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification("⏰ Hermes 提醒", { body: k.title }); } catch {}
          if (k.remindEvery) {
            let next = at;
            while (next <= now) next += k.remindEvery * 3600000;
            return { ...k, remindAt: new Date(next).toISOString() };
          }
          return { ...k, remindFired: true };
        });
        if (!changed) return prev;
        const n = { ...prev, tasks };
        persist(n);
        return n;
      });
    }, 30000);
    return () => clearInterval(t);
  }, []);

  // ☀️ v15：每朝 10 點自動推送今日任務清單 — 瀏覽器通知＋app 內卡片。
  //         網頁限制：app（tab／PWA）開住先推到；10 點後先開 app 就即刻補推，
  //         一日一次（digestDate 記低今日推咗未）。
  useEffect(() => {
    const check = () => setState(prev => {
      if (!prev) return prev;
      if (new Date().getHours() < 10) return prev;
      if (prev.digestDate === todayStr()) return prev;
      const open = prev.tasks.filter(k => k.status === "open");
      // 🎪 v16：digest 順便建議今日主場 — 有業務線 NEGLECT_DAYS 日冇完成任務、
      //         而今日又未揀主場，就喺通知＋卡片提一提（cfgRef：effect 開機時 cfg 仲係 null）
      let themeLine = "";
      const themeOn = prev.theme && prev.theme.date === todayStr() && prev.theme.lines.length;
      if (!themeOn && cfgRef.current) {
        let best = null;
        cfgRef.current.lines.filter(l => l.tier === "biz").forEach(l => {
          const d = (prev.lastDone || {})[l.id];
          if (!d) return;
          const n = Math.round((new Date(todayStr()) - new Date(d)) / 86400000);
          if (n >= NEGLECT_DAYS && (!best || n > best.n)) best = { l, n };
        });
        if (best) themeLine = `\n🎪 建議今日主場：${best.l.emoji} ${best.l.label}（${best.n} 日未郁）`;
      }
      const body = (open.length
        ? open.slice(0, 8).map(k => "• " + k.title).join("\n") + (open.length > 8 ? `\n…仲有 ${open.length - 8} 個` : "")
        : "今日暫時未有任務 — 開個靚 plan ✍️") + themeLine;
      try { if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification(`☀️ 今日任務清單（${open.length} 個未關）`, { body }); } catch {}
      setDigestToast({ count: open.length, titles: open.slice(0, 6).map(k => k.title), themeLine: themeLine.trim() || null });
      const n = { ...prev, digestDate: todayStr() };
      persist(n);
      return n;
    });
    check();
    const t = setInterval(check, 60000);
    return () => clearInterval(t);
  }, []);

  // 🔁 v17：週期任務自動落單 — 每分鐘檢查（開 app 嗰下都查一次），
  //         routine 今日到期而未落過（lastDate !== 今日）就自動加落 task list；
  //         「單次」routine 落單之後自動剷走
  useEffect(() => {
    const spawn = () => setState(prev => {
      if (!prev || !cfgRef.current) return prev;
      const today = todayStr();
      const rs = prev.routines || [];
      const due = rs.filter(r => routineDueOn(r, today) && r.lastDate !== today);
      if (!due.length) return prev;
      const newTasks = due.map(r => {
        const lineMeta = cfgRef.current.lines.find(l => l.id === r.line);
        return mk(r.line, r.title, lineMeta?.tier === "focus", { ext: true });
      });
      const routines = rs
        .filter(r => !(r.freq === "once" && due.includes(r)))
        .map(r => (due.includes(r) ? { ...r, lastDate: today } : r));
      const n = { ...prev, tasks: [...prev.tasks, ...newTasks], routines };
      persist(n);
      return n;
    });
    spawn();
    const t = setInterval(spawn, 60000);
    return () => clearInterval(t);
  }, [cfg]);

  useEffect(() => {
    (async () => {
      let c = DEFAULT_CONFIG;
      try {
        const rc = await window.storage.get("hermes-config");
        if (rc && rc.value) c = { ...DEFAULT_CONFIG, ...JSON.parse(rc.value) };
        else await window.storage.set("hermes-config", JSON.stringify(DEFAULT_CONFIG));
      } catch { try { await window.storage.set("hermes-config", JSON.stringify(DEFAULT_CONFIG)); } catch {} }
      let s = null;
      try {
        const r = await window.storage.get("hermes-state-v6");
        if (r && r.value) s = { ...freshState(c), ...JSON.parse(r.value) };
      } catch {}
      if (!s) {
        try {
          const old = await window.storage.get("hermes-state");
          if (old && old.value) {
            const o = JSON.parse(old.value);
            s = freshState(c);
            s.emailTo = o.emailTo || "";
            s.diamondInquiry = !!o.diamondInquiry;
            s.history = o.history || [];
            s.reviewList = o.fridayList || [];
            s.tasks = (o.tasks || []).map(k => ({ ...mk("aidev", ""), ...k, line: k.line === "sys" ? "aidev" : k.line }));
            if (Array.isArray(o.sysWig)) s.wigs = s.wigs.map((w, i) => (i < 4 ? { ...w, done: !!o.sysWig[i] } : w));
            if (typeof o.storeWig === "number" && o.storeWig >= 3) s.wigs = s.wigs.map(w => (w.id === "w5" ? { ...w, done: true } : w));
          }
        } catch {}
      }
      if (!s) s = freshState(c);
      if (s.date !== todayStr()) s = rollover(s, c);
      // v14 migration：舊資料入面已經 done 嘅 WIG，開機自動搬去 36 目標路線圖
      if ((s.wigs || []).some(w => w.done)) {
        const donePart = s.wigs.filter(w => w.done).map(w => ({ id: w.id, label: w.label, term: w.term, pri: w.pri, doneDate: s.date }));
        s = { ...s, wigs: s.wigs.filter(w => !w.done), roadmap: [...(s.roadmap || []), ...donePart] };
      }
      setCfg(c); setState(s); persist(s);
      // v10.1：實測 storage 寫入＋讀返，肉眼確認持久化通唔通
      try {
        const probe = "p" + Date.now();
        await window.storage.set("hermes-probe", probe);
        const back = await window.storage.get("hermes-probe");
        setStorageOk(!!(back && back.value === probe));
      } catch { setStorageOk(false); }
    })();
  }, []);

  // v10.1 fix：debounce 寫入 — 之前每粒 keystroke 寫一次 storage，撞 rate limit 後全部 silently fail
  const persistTimer = useRef(null);
  const pendingState = useRef(null);
  async function flushPersist() {
    if (persistTimer.current) { clearTimeout(persistTimer.current); persistTimer.current = null; }
    if (!pendingState.current) return;
    const snap = pendingState.current; pendingState.current = null;
    try { await window.storage.set("hermes-state-v6", JSON.stringify(snap)); } catch (e) { console.error("storage set fail", e); }
  }
  function persist(s) {
    pendingState.current = s;
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(flushPersist, 600);
  }
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === "hidden") flushPersist(); };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, []);
  function mutate(fn) { setState(prev => { const n = fn(prev); persist(n); return n; }); }
  // v16：mark done 嗰陣順手記低 lastDone[line]=今日 — 🎪 今日主場建議靠佢計「幾多日未郁」
  const setTask = (id, patch) => mutate(s => {
    const tasks = s.tasks.map(k => (k.id === id ? { ...k, ...patch } : k));
    let lastDone = s.lastDone || {};
    if (patch.status === "done") {
      const t = s.tasks.find(k => k.id === id);
      if (t) lastDone = { ...lastDone, [t.line]: todayStr() };
    }
    return { ...s, tasks, lastDone };
  });

  // 🗺️ v14：WIG 打完勾即刻封存出 board，存入 36 目標路線圖（連 6 格上限即時騰位）
  function moveWigToRoadmap(w) {
    mutate(s => ({ ...s, wigs: s.wigs.filter(x => x.id !== w.id), roadmap: [...(s.roadmap || []), { id: w.id, label: w.label, term: w.term, pri: w.pri, doneDate: todayStr() }] }));
    setArchivedToast({ wig: w });
    if (archivedTimer.current) clearTimeout(archivedTimer.current);
    archivedTimer.current = setTimeout(() => setArchivedToast(null), 6000);
  }
  function undoArchive() {
    if (!archivedToast) return;
    const w = archivedToast.wig;
    mutate(s => ({ ...s, roadmap: (s.roadmap || []).filter(x => x.id !== w.id), wigs: [...s.wigs, { ...w, done: false }] }));
    if (archivedTimer.current) clearTimeout(archivedTimer.current);
    setArchivedToast(null);
  }

  // ✨ v14.1：將收工報告解構結果套用返落 task list（✅/⏭️/📤 逐條 match title）。
  //           WIG 一打勾就即刻封存去路線圖，s.wigs 唔會再有 done 嘅紀錄，
  //           所以呢度攞走咗 v14 果段（永遠都唔會觸發嘅）WIG sync。
  // v14.2：修正兩個問題 —
  //        1) 之前唔理有冇 match 到都照樣顯示「✓ 已更新」，用戶冇辦法知道其實乜都冇做到；
  //           而家改成記低實際 matched/created/total 數，喺 UI 誠實顯示返。
  //        2) 之前淨係識更新「已經喺 task list 入面」嘅任務 —— 如果係同 AI
  //           口講、未撳過＋加落 task list 嘅任務，match 唔到就即刻捨棄，
  //           乜都唔會發生。而家 match 唔到嘅任務會照抄 AI 報告入面嘅狀態
  //           自動加做新任務，唔使自己手動先加一次先再 sync。
  function applyReportSync(items, msgIdx) {
    let stats = { matched: 0, created: 0, total: 0 };
    mutate(s => {
      const taskItems = items.filter(it => it.kind === "task" && it.title);
      const matchedSet = new Set();
      const doneLines = new Set(); // v16：sync 完成嘅 line 記入 lastDone
      const tasks = s.tasks.map(k => {
        const hit = taskItems.find(it => !matchedSet.has(it) && (it.title === k.title || k.title.includes(it.title) || it.title.includes(k.title)));
        if (!hit) return k;
        matchedSet.add(hit);
        if (hit.status === "done") { doneLines.add(k.line); return { ...k, status: "done", score: hit.score || k.score }; }
        if (hit.status === "skip") return { ...k, status: "skip", reason: hit.reason || k.reason };
        if (hit.status === "delegate") return { ...k, status: "delegate", assignee: hit.assignee || k.assignee, received: hit.received || k.received };
        return k;
      });
      // v14.3：用報告行頭嘅業務線 emoji（🏪🥩💎📚🧠🤖）搵返啱嘅 line，
      //        搵唔到先至落「個人」— 新任務就會出現喺正確嘅業務 section 度
      const added = taskItems.filter(it => !matchedSet.has(it)).map(it => {
        const lineMeta = (it.em && cfg.lines.find(l => l.emoji === it.em)) || { id: "personal", tier: "personal" };
        if (it.status === "done") doneLines.add(lineMeta.id);
        return mk(lineMeta.id, it.title, lineMeta.tier === "focus", {
          status: it.status, score: it.score ?? null, reason: it.reason ?? null, assignee: it.assignee ?? null, received: !!it.received,
        });
      });
      stats = { matched: matchedSet.size, created: added.length, total: taskItems.length };
      const lastDone = { ...(s.lastDone || {}) };
      doneLines.forEach(l => { lastDone[l] = todayStr(); });
      return { ...s, tasks: [...tasks, ...added], lastDone };
    });
    setSyncedMsgs(p => ({ ...p, [msgIdx]: stats }));
  }

  // ═══ 🎪 v16：今日主場 — 每日揀 1–2 條業務線做今日主力 ═══
  // theme 淨係當日有效（date !== 今日就當冇揀）；建議邏輯：連續 NEGLECT_DAYS 日
  // 冇完成過任務嘅業務線，建議做今日主場（冇 lastDone 紀錄嘅唔當冷落，免得一開始紅晒）
  const themeLines = state?.theme && state.theme.date === todayStr() ? state.theme.lines : [];
  function toggleThemeLine(id) {
    mutate(s => {
      const cur = s.theme && s.theme.date === todayStr() ? [...s.theme.lines] : [];
      const i = cur.indexOf(id);
      if (i >= 0) cur.splice(i, 1); else { cur.push(id); while (cur.length > 2) cur.shift(); }
      return { ...s, theme: cur.length ? { lines: cur, date: todayStr() } : null };
    });
  }
  function neglectDaysOf(id) {
    const d = (state.lastDone || {})[id];
    if (!d) return null;
    return Math.round((new Date(todayStr()) - new Date(d)) / 86400000);
  }
  function themeSuggestion() {
    let best = null;
    cfg.lines.filter(l => l.tier === "biz" && !themeLines.includes(l.id)).forEach(l => {
      const n = neglectDaysOf(l.id);
      if (n !== null && n >= NEGLECT_DAYS && (!best || n > best.n)) best = { line: l, n };
    });
    return best;
  }
  const themeDescStr = () => themeLines.length
    ? themeLines.map(id => { const l = cfg.lines.find(x => x.id === id); return l ? `${l.emoji} ${l.label}` : id; }).join("＋")
    : "";

  function delegate(k, staff, iso) {
    const dl = snapToWindow(iso, staff.window);
    mutate(s => ({
      ...s,
      tasks: [
        ...s.tasks.map(x => (x.id === k.id ? { ...x, status: "delegate", assignee: staff.label, deadline: dl } : x)),
        ...(k.followUp ? [] : [mk(k.line, `跟 ${staff.label} 收：${k.title}`, k.focus, { due: dl, followUp: true })]),
      ],
    }));
    setDelegFor(null);
  }

  // ═══ AI 統一通道 — Claude / Gemini / OpenAI 三選一 ═══
  // claude.ai artifact：揀 Claude + 留空 key 直接用。
  // 本地／自己 host：儀表板「⚙️ AI 設定」揀 provider + 入 key（淨係存 localStorage）。
  const PROVIDERS = {
    claude: { label: "Claude", model: "claude-opus-4-8" },
    gemini: { label: "Gemini", model: "gemini-flash-lite-latest" },
    openai: { label: "OpenAI", model: "gpt-4o-mini" },
  };
  // Gemini 模型會過期落架 — 由新至舊逐個試，試到得嗰個記住喺 state.geminiModel
  const GEMINI_MODELS = ["gemini-flash-lite-latest", "gemini-flash-latest", "gemini-2.5-flash-lite", "gemini-2.5-flash"];
  // API key 只可以係 ASCII — 過濾全形／隱藏字符，防止 fetch header 爆
  // "String contains non ISO-8859-1 code point" 錯誤
  const cleanKey = k => (k || "").replace(/[^\x21-\x7E]/g, "");
  const provider = state?.provider || "claude";
  const hasKey = provider === "claude" ? !!(state?.apiKey || "").trim() : provider === "gemini" ? !!(state?.geminiKey || "").trim() : !!(state?.openaiKey || "").trim();

  async function callAI({ system, messages, maxTokens = 2000 }) {
    // ── Gemini（自動揀可用嘅 flash-lite 模型，落架自動 fallback）──
    if (provider === "gemini") {
      const key = cleanKey(state.geminiKey);
      if (!key) throw new Error("Gemini 要 API key — 去儀表板「⚙️ AI 設定」入（aistudio.google.com/apikey 免費攞）");
      const tryList = [...new Set([...(state.geminiModel ? [state.geminiModel] : []), ...GEMINI_MODELS])];
      let lastErr = "";
      for (const model of tryList) {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: system }] },
            contents: messages.map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
            generationConfig: { maxOutputTokens: maxTokens },
          }),
        });
        const data = await res.json();
        if (data.error) {
          lastErr = data.error.message || "API error";
          // 模型落架／唔存在 → 試下一個；其他錯誤（key 無效、quota 爆）即刻報
          if (/not found|no longer available|not supported|deprecated/i.test(lastErr)) continue;
          throw new Error("Gemini：" + lastErr.slice(0, 100));
        }
        const out = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("");
        if (!out) throw new Error("Gemini 無回覆內容（可能觸發安全過濾）— 試多次");
        if (state.geminiModel !== model) mutate(s => ({ ...s, geminiModel: model }));
        return out;
      }
      throw new Error("Gemini：試晒所有模型都唔得（" + lastErr.slice(0, 80) + "）");
    }
    // ── OpenAI ──
    if (provider === "openai") {
      const key = cleanKey(state.openaiKey);
      if (!key) throw new Error("OpenAI 要 API key — 去儀表板「⚙️ AI 設定」入（platform.openai.com/api-keys）");
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: PROVIDERS.openai.model, max_tokens: maxTokens,
          messages: [{ role: "system", content: system }, ...messages.map(m => ({ role: m.role, content: m.content }))],
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error("OpenAI：" + (data.error.message || "API error").slice(0, 100));
      return data.choices?.[0]?.message?.content || "";
    }
    // ── Claude（預設；artifact keyless）──
    const key = cleanKey(state.apiKey);
    const headers = { "Content-Type": "application/json" };
    if (key) {
      headers["x-api-key"] = key;
      headers["anthropic-version"] = "2023-06-01";
      headers["anthropic-dangerous-direct-browser-access"] = "true";
    }
    let res;
    // v10.3：keyless 用最保守形態 — system 摺入第一個 user message，同官方最簡例子一模一樣
    const foldedMsgs = (!key && system)
      ? messages.map((m, i) => (i === 0 && m.role === "user" ? { ...m, content: `【系統指示】${system}\n\n【用戶輸入】${m.content}` } : m))
      : messages;
    try {
      res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers,
        body: JSON.stringify(
          key
            ? { // 有 key（本地／自己 host）：照舊行 Opus + adaptive thinking
                model: PROVIDERS.claude.model, max_tokens: maxTokens,
                thinking: { type: "adaptive" }, output_config: { effort: "low" },
                system, messages,
              }
            : { model: "claude-sonnet-4-6", max_tokens: 1000, messages: foldedMsgs }
        ),
      });
    } catch (e) {
      // v10.2：唔再食咗原始錯誤 — 顯示出嚟先診斷到係 CORS／沙盒定網絡問題
      throw new Error((key ? "網絡錯誤" : "keyless 通道連唔上") + "：" + String(e).slice(0, 90) + (key ? "" : "｜快救：轉 Gemini（aistudio.google.com/apikey 免費 key）"));
    }
    const data = await res.json();
    if (data.error) {
      if (res.status === 401) throw new Error(key ? "Claude API key 無效（401）— 檢查「⚙️ AI 設定」" : "本地環境要 key，或者轉用 Gemini／OpenAI — 去「⚙️ AI 設定」");
      throw new Error("Claude：" + (data.error.message || "API error").slice(0, 100));
    }
    return (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
  }
  const pickJSON = (raw, fallback = "[]") => { const m = raw.match(/\[[\s\S]*\]/); return JSON.parse(m ? m[0] : fallback); };
  // v10.3：深度診斷 — keyless Claude 逐個變量試，搵出 bridge 唔食邊樣
  async function pingAI() {
    setPingStatus("testing");
    const key = cleanKey(state.apiKey);
    if (provider !== "claude" || key) {
      try {
        const out = await callAI({ maxTokens: 20, system: "淨係回覆一個字：通", messages: [{ role: "user", content: "ping" }] });
        setPingStatus({ ok: true, msg: `通（回覆：${(out || "").trim().slice(0, 30)}）` });
      } catch (e) { setPingStatus({ ok: false, msg: String(e.message || e).slice(0, 180) }); }
      return;
    }
    const lines = [];
    const tryVariant = async (label, body) => {
      try {
        const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const d = await r.json();
        if (d.error) { lines.push(`✗ ${label}：API — ${(d.error.message || "error").slice(0, 60)}`); return false; }
        const t = (d.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
        lines.push(`✓ ${label}：通（${t.slice(0, 15)}）`); return true;
      } catch (e) { lines.push(`✗ ${label}：${String(e).slice(0, 60)}`); return false; }
    };
    const okA = await tryVariant("A 最簡", { model: "claude-sonnet-4-6", max_tokens: 1000, messages: [{ role: "user", content: "淨係回覆一個字：通" }] });
    const okB = await tryVariant("B 加 system", { model: "claude-sonnet-4-6", max_tokens: 1000, system: "淨係回覆一個字：通", messages: [{ role: "user", content: "ping" }] });
    let verdict = "";
    if (okA && !okB) verdict = "\n→ 元兇係 system 參數；app 已改用摺入式，✨✂️🌱 應該用得";
    else if (okA && okB) verdict = "\n→ 通道正常，✨✂️🌱 應該用得";
    else verdict = "\n→ keyless 通道喺呢部機斷咗 — 建議 ⚙️ 轉 Gemini（aistudio.google.com/apikey 免費）";
    setPingStatus({ ok: okA, msg: lines.join("\n") + verdict });
  }
  const lineDescStr = () => cfg.lines.map(l => `${l.id}=${l.emoji}${l.label}（${l.tier === "focus" ? "主攻" : "次要"}）`).join("、") + "、personal=🧍個人";

  // v13：第一次設提醒時問攞通知權限
  function ensureNotifPerm() { try { if (typeof Notification !== "undefined" && Notification.permission === "default") Notification.requestPermission(); } catch {} }

  // ═══ v12：AI 建議評分 — 記低你嘅口味，餵返俾 AI ═══
  function logRating(kind, title, score) {
    mutate(s => ({ ...s, aiRatings: [...(s.aiRatings || []).filter(r => !(r.kind === kind && r.title === title)), { kind, title, score, date: todayStr() }].slice(-100) }));
  }
  function ratingContext() {
    const rs = state.aiRatings || [];
    if (!rs.length) return "";
    const avg = (rs.reduce((a, r) => a + r.score, 0) / rs.length).toFixed(1);
    const hi = rs.filter(r => r.score >= 4).slice(-3).map(r => `「${r.title}」`);
    const lo = rs.filter(r => r.score <= 2).slice(-3).map(r => `「${r.title}」`);
    return `\n\n用戶對你過往建議嘅評分：平均 ${avg}/5（共 ${rs.length} 次）。${hi.length ? `高分例子（多啲呢類）：${hi.join("、")}。` : ""}${lo.length ? `低分例子（避開呢類）：${lo.join("、")}。` : ""}`;
  }

  // ✍️ v14.4：用戶自己手打嘅延伸任務 — 除咗加落 task list，
  //           仲記入 extLog（最近 50 條），fetchExtensions 每次餵返俾 AI，
  //           等佢一路學你手打延伸嘅風格一路優化建議
  function addCustomExtension(k) {
    const t = extCustom.trim();
    if (!t) return;
    mutate(s => ({ ...s, tasks: [...s.tasks, mk(k.line, t, k.focus, { ext: true })], extLog: [...(s.extLog || []), { title: t, line: k.line, src: k.title, date: todayStr() }].slice(-50) }));
    setExtCustom("");
  }
  function extLogContext(k) {
    const log = state.extLog || [];
    if (!log.length) return "";
    const same = log.filter(e => e.line === k.line).slice(-5);
    const other = log.filter(e => e.line !== k.line).slice(-3);
    const fmt = e => `「${e.src}」→「${e.title}」`;
    return `\n\n用戶過往自己手打嘅延伸任務（格式：原任務→佢打嘅延伸）— 呢啲係佢親手寫，最能代表佢想要嘅方向同風格，建議要向呢啲睇齊${same.length ? `。同線（${k.line}）例子：${same.map(fmt).join("、")}` : ""}${other.length ? `。其他線例子：${other.map(fmt).join("、")}` : ""}。`;
  }

  // 🌱 延伸 ×2 — 直接問 Claude（v9：唔再靠 /api/extend 後端）
  async function fetchExtensions(k) {
    setExtFor(k.id); setExtLoading(true); setExtSugs([]); setExtErr("");
    try {
      const raw = await callAI({
        maxTokens: 1000,
        system: `你係任務延伸助手。用戶完成咗一個任務，你建議 3 個自然嘅下一步延伸任務。業務線：${lineDescStr()}。${themeLines.length ? `🎪 今日主場係 ${themeDescStr()} — 3 個建議入面至少 1 個要出主場線。` : ""}任務名格式：動詞＋數字＋名詞，≤10 分鐘做完，用廣東話。淨係回覆 JSON array，唔好有任何其他文字：[{"line":"<line id>","title":"..."},{"line":"...","title":"..."},{"line":"...","title":"..."}]${ratingContext()}${extLogContext(k)}`,
        messages: [{ role: "user", content: `完成咗：「${k.title}」（業務線：${k.line}）。建議 3 個延伸任務。` }],
      });
      const arr = pickJSON(raw);
      setExtSugs((Array.isArray(arr) ? arr : []).filter(x => x && x.title).slice(0, 3));
      if (!arr.length) setExtErr("AI 無俾到建議 — 可以手動加");
    } catch (e) { setExtErr("AI 延伸失敗：" + String(e.message || e).slice(0, 90)); }
    setExtLoading(false);
  }

  // 🌱 v12：WIG 板 AI 建議 — 睇住而家啲 WIG 同業務狀態，建議新 WIG
  async function fetchWigSugs() {
    setWigSugLoading(true); setWigSugs([]); setWigSugErr("");
    try {
      const rr = rates(state, cfg);
      const raw = await callAI({
        maxTokens: 800,
        system: `你係 WIG（Wildly Important Goal）教練。根據用戶而家嘅 WIG 進度同業務狀態，建議 3 個新嘅短期 WIG。格式：「從 X 到 Y」或者明確可量度目標，用廣東話，每個 ≤20 字。業務線：${lineDescStr()}。${themeLines.length ? `🎪 今日主場係 ${themeDescStr()} — 建議優先圍繞主場線。` : ""}淨係回覆 JSON array，唔好有任何其他文字：[{"label":"..."},{"label":"..."},{"label":"..."}]${ratingContext()}`,
        messages: [{ role: "user", content: `而家 WIG：${state.wigs.map(w => `${w.done ? "✓" : "○"}P${w.pri} ${w.label}`).join("；") || "（空）"}。今日業務完成率 ${rr.bizPct}%，主攻佔比 ${rr.focusShare}%。建議 3 個新 WIG。` }],
      });
      const arr = pickJSON(raw).filter(x => x && x.label).slice(0, 3);
      setWigSugs(arr);
      if (!arr.length) setWigSugErr("AI 無俾到建議 — 可以手動 ＋ WIG");
    } catch (e) { setWigSugErr("AI 建議失敗：" + String(e.message || e).slice(0, 90)); }
    setWigSugLoading(false);
  }

  // 🗓️ v18：WIG 計劃表 AI 建議 — 睇住現行 WIG／路線圖／計劃表，建議未來 WIG 候補
  async function fetchPlanSugs() {
    setPlanSugLoading(true); setPlanSugs([]); setPlanSugErr("");
    try {
      const raw = await callAI({
        maxTokens: 800,
        system: `你係 WIG（Wildly Important Goal）長線規劃教練。用戶有個「WIG 計劃表」擺未來想做嘅 WIG 候補（現行 WIG board 得 6 個位，滿咗就排隊）。根據佢嘅業務狀態建議 3 個計劃 WIG。格式：「從 X 到 Y」或者明確可量度目標，用廣東話，每個 ≤20 字。term 揀 短／中／長（短=今個衝刺、中=今季、長=今年）。pri 揀 0／1／2（0 最高）。業務線：${lineDescStr()}。淨係回覆 JSON array，唔好有任何其他文字：[{"label":"...","term":"短","pri":1},...]${ratingContext()}`,
        messages: [{ role: "user", content: `現行 WIG：${state.wigs.map(w => `P${w.pri}（${w.term}期）${w.label}`).join("；") || "（空）"}。計劃表已有：${(state.wigPlan || []).map(p => p.label).join("；") || "（空）"}。🗺️ 路線圖已完成 ${(state.roadmap || []).length}/${ROADMAP_GOAL}。建議 3 個新嘅計劃 WIG（唔好同上面重複）。` }],
      });
      const arr = pickJSON(raw).filter(x => x && x.label).slice(0, 3);
      setPlanSugs(arr);
      if (!arr.length) setPlanSugErr("AI 無俾到建議 — 可以手動加");
    } catch (e) { setPlanSugErr("AI 建議失敗：" + String(e.message || e).slice(0, 90)); }
    setPlanSugLoading(false);
  }

  // ✂️ 拆細 ×2 — 直接問 Claude（v9：唔再靠 /api/split 後端）
  async function splitTask(k) {
    setSplitFor(k.id); setSplitErr(null);
    try {
      const raw = await callAI({
        maxTokens: 800,
        system: `你係任務拆解助手。一個任務連續幾日做唔完，將佢拆做 2 個更細、即刻做得起嘅子任務。任務名格式：動詞＋數字＋名詞，每個 ≤10 分鐘做完，用廣東話。淨係回覆 JSON array，唔好有任何其他文字：[{"title":"..."},{"title":"..."}]`,
        messages: [{ role: "user", content: `拆呢個任務：「${k.title}」（已連紅 ${k.red} 日）` }],
      });
      const arr = pickJSON(raw).filter(x => x && x.title).slice(0, 2);
      if (arr.length) {
        mutate(s => ({ ...s, tasks: [...s.tasks.filter(x => x.id !== k.id), ...arr.map(a => mk(k.line, a.title, k.focus, { red: k.red, ext: true }))] }));
      } else {
        setSplitErr({ id: k.id, msg: "AI 無俾到拆法 — 試多次或手動改" });
      }
    } catch (e) { setSplitErr({ id: k.id, msg: "拆細失敗：" + String(e.message || e).slice(0, 90) }); }
    setSplitFor(null);
  }

  // ═══ ✨ AI 助手 ═══
  function aiContext() {
    const r = rates(state, cfg);
    const fmt = k => {
      const line = cfg.lines.find(l => l.id === k.line);
      const em = line ? line.emoji : "🧍";
      const tags = [k.red > 0 ? `連紅${k.red}日` : "", k.status === "skip" ? `skip:${k.reason}` : "", k.status === "delegate" ? `委派俾${k.assignee}` : "", k.followUp ? "跟收" : ""].filter(Boolean).join("，");
      return `${em} [${k.status}] ${k.title}${tags ? `（${tags}）` : ""}`;
    };
    return [
      `日期：${state.date}｜衝刺 #${cfg.sprint.num}（${cfg.sprint.start} 至 ${cfg.sprint.end}）`,
      `🎪 今日主場：${themeDescStr() || "（未揀）"}${(() => { const g = themeSuggestion(); return g ? `｜建議主場：${g.line.emoji}${g.line.label}（${g.n} 日未有完成任務）` : ""; })()}`,
      `業務完成率 ${r.bizPct}%（目標 85）｜已關 ${r.closed}/${r.denom}｜主攻佔比 ${r.focusShare}%（目標 ${cfg.budget.focusPct}）｜Skip ${r.skips}/${cfg.skipCap}｜影響分 ${r.impact}｜個人 ${r.perPct}%｜跟收 ${r.fuDone}/${r.fuAll}｜逾期未收 ${r.overdue}`,
      `WIG（現行 ${state.wigs.length}/6）：${state.wigs.map(w => `P${w.pri}${w.term} ${w.label}`).join("；") || "（未有 WIG，仲有位加）"}`,
      `🗺️ 36 個目標路線圖：${(state.roadmap || []).length}/${ROADMAP_GOAL}`,
      `🗓️ WIG 計劃表（候補）：${(state.wigPlan || []).map(p => `P${p.pri}（${p.term}期）${p.label}`).join("；") || "（空）"}`,
      `今日任務：${state.tasks.length ? state.tasks.map(fmt).join("\n") : "（未有任務）"}`,
      `近期完成率：${state.history.slice(-7).map(h => `${h.date.slice(5)}=${h.biz}%`).join(", ") || "（無記錄）"}`,
      `週六檢討清單：${state.reviewList.join("；") || "（空）"}`,
      `💎 LAD Diamond 今日${state.diamondInquiry ? "有" : "無"} inquiry（無 inquiry 做 brand，有先開 sales）`,
    ].join("\n");
  }

  async function askAI(text) {
    if (!text.trim() || aiLoading) return;
    const hist = [...aiMsgs, { role: "user", content: text.trim() }];
    setAiMsgs(hist); setAiInput(""); setAiLoading(true); setAiSugs([]);
    try {
      const raw = await callAI({
        maxTokens: 2000,
        system: [
          "你係 Hermes，Mars 嘅每日工作追蹤器 AI 助手。用廣東話（香港口語）回覆，語氣直接、務實、似個醒目嘅 chief of staff。",
          "規則：回覆要短（3–6 句內），先講結論。你唔可以自己加任務 — Mars 係 approval gate，你只可以建議。",
          `業務線：${lineDescStr()}。任務名格式：動詞＋數字＋名詞，≤10 分鐘做完。`,
          "如果你想建議具體任務，喺回覆最尾加一段 <tasks>[{\"line\":\"store\",\"title\":\"message 2 個潛在寄賣者\"}]</tasks>（JSON array，最多 3 個，line 用上面 id）。冇具體任務建議就唔好加呢段。",
          "優先次序邏輯：連紅任務最緊要處理（拆細或委派）；主攻佔比未達標就建議主攻線任務；逾期未收要追；Skip 爆 cap 係警號。如果有 🎪 今日主場，建議任務優先出主場嗰（幾）條線；如果 dashboard 顯示有建議主場（有業務線幾日冇完成任務），提一提 Mars 好唔好今日主力做返嗰邊。",
          "如果 Mars 叫你出正式收工報告，必須逐字跟返呢個格式（唔好改動 emoji／分隔線／順序），因為 app 會偵測呢個格式俾佢一撳套用返落 task list：\n『📋 Hermes 收工報告 · <日期>』換行『業務完成率 X%（✅N ⏭️N 📤N）｜主攻佔比 X%（目標 X）』，然後空行、『── 今日任務（N）──』、逐條 ✅/⏭️/📤/🔴，每條任務行個狀態 emoji 後面必須跟埋業務線 emoji（🏪🥩💎📚🧠🤖，個人就🧍）再到任務名，app 靠佢將任務放返入啱嘅業務線；最後空行、『── WIG 現行 X/6 ──』逐條 P<pri>（<期>期）<label>。",
          "以下係 Mars 今日嘅 dashboard 即時狀態：\n\n" + aiContext(),
        ].join("\n\n"),
        messages: hist.slice(-12),
      });
      const m = raw.match(/<tasks>([\s\S]*?)<\/tasks>/);
      let clean = raw, sugs = [];
      if (m) {
        try { sugs = JSON.parse(m[1]); } catch {}
        clean = raw.replace(m[0], "").trim();
      }
      setAiMsgs([...hist, { role: "assistant", content: clean || "（無回覆內容）" }]);
      setAiSugs((Array.isArray(sugs) ? sugs : []).filter(x => x && x.title).slice(0, 3));
    } catch (e) {
      setAiMsgs([...hist, { role: "assistant", content: "⚠️ " + String(e.message || e).slice(0, 140) }]);
    }
    setAiLoading(false);
  }

  function addAiSug(sg, i) {
    const meta = cfg.lines.find(l => l.id === sg.line) || { id: "personal", tier: "personal" };
    mutate(s => ({ ...s, tasks: [...s.tasks, mk(meta.id || "personal", sg.title, meta.tier === "focus", { ext: true })] }));
    setAiSugs(p => p.filter((_, j) => j !== i));
  }

  // 收工報告 — v9：包齊所有任務狀態 + WIG
  function buildReport(s) {
    const r = rates(s, cfg);
    const em = k => (cfg.lines.find(l => l.id === k.line) || { emoji: "🧍" }).emoji;
    const done = s.tasks.filter(k => k.status === "done").map(k => `✅ ${em(k)} ${k.title}${k.score ? `（${"⭐".repeat(k.score)}）` : ""}`);
    const skips = s.tasks.filter(k => k.status === "skip").map(k => `⏭️ ${em(k)} ${k.title}（${k.reason}）`);
    const deleg = s.tasks.filter(k => k.status === "delegate").map(k => `📤 ${em(k)} ${k.title} → ${k.assignee}・死線 ${fmtMD(k.deadline)}${k.received ? "・已收貨 ✓" : "・未收"}`);
    const open = s.tasks.filter(k => k.status === "open").map(k => `🔴 ${em(k)} ${k.title}${k.red > 0 ? `（連紅 ${k.red} 日）` : ""}`);
    const staffLine = cfg.staff.map(st => { const d = s.tasks.filter(k => k.status === "delegate" && k.assignee === st.label); return `${st.label} ${d.filter(k => k.received).length}/${d.length}`; }).join(" · ");
    const wigLines = s.wigs.map(w => `P${w.pri}（${w.term}期）${w.label}`);
    return [
      `📋 Hermes 收工報告 · ${s.date}`,
      `業務完成率 ${r.bizPct}%（✅${r.done} ⏭️${r.skips} 📤${r.deleg}）｜主攻佔比 ${r.focusShare}%（目標 ${cfg.budget.focusPct}）`,
      `⭐ 影響分 ${r.impact}｜🧍 個人 ${r.perPct}%｜跟收 ${r.fuDone}/${r.fuAll}`,
      `團隊：${staffLine}${r.overdue ? `｜⚠️ 逾期未收 ${r.overdue}` : ""}`,
      ``,
      `── 今日任務（${s.tasks.length}）──`,
      ...(done.length ? done : []),
      ...(skips.length ? skips : []),
      ...(deleg.length ? deleg : []),
      ...(open.length ? open : []),
      ...(s.tasks.length === 0 ? ["（今日無任務）"] : []),
      open.length ? `⚠️ ${open.length} 個未關 — 聽日自動連紅` : `全部任務有結論 ✅`,
      ``,
      `── WIG 現行 ${s.wigs.length}/6 ──`,
      ...wigLines,
      ``,
      `🗺️ 36 個目標路線圖 ${(s.roadmap || []).length}/${ROADMAP_GOAL}`,
    ].join("\n");
  }

  async function emailReport() {
    if (!state.emailTo || !/@/.test(state.emailTo)) { setMailStatus("noaddr"); return; }
    const rep = report || buildReport(state);
    setMailStatus("sending");
    try {
      // EXPERIMENTAL：手機上 Gmail 連接可能失敗 — 下面 Mail App 掣係正路
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6", max_tokens: 1000,
          messages: [{ role: "user", content: `請用 Gmail 工具開一封草稿電郵（create draft）。收件人：${state.emailTo}。標題："Hermes 日結 · ${state.date}"。內文原文照用：\n\n${rep}\n\n開好之後淨係答「已開草稿」。` }],
          mcp_servers: [{ type: "url", url: "https://gmailmcp.googleapis.com/mcp/v1", name: "gmail" }],
        }),
      });
      const data = await res.json();
      if (data.error) { setMailDetail((data.error.message || "API error").slice(0, 120)); setMailStatus("err"); return; }
      const usedTool = (data.content || []).some(b => b.type === "mcp_tool_result" || b.type === "mcp_tool_use");
      if (usedTool) setMailStatus("ok");
      else { setMailDetail(((data.content || []).filter(b => b.type === "text").map(b => b.text).join(" ") || "Gmail 工具無被呼叫").slice(0, 120)); setMailStatus("err"); }
    } catch (e) { setMailDetail(String(e).slice(0, 120)); setMailStatus("err"); }
  }

  if (!state || !cfg) return <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", color: C.body, fontFamily: FONT, fontSize: 22 }}>⏳ 初始化中…</div>;

  const r = rates(state, cfg);
  const wd = new Date().getDay();
  const smPrepDay = wd >= 1 && wd <= 3;
  const smPublishDay = cfg.smPublishDays.includes(wd);
  const dayCount = Math.max(2, Math.round((new Date(cfg.sprint.end + "T00:00:00") - new Date(cfg.sprint.start + "T00:00:00")) / 86400000) + 1);
  const days = Array.from({ length: dayCount }, (_, i) => { const d = new Date(cfg.sprint.start + "T00:00:00"); d.setDate(d.getDate() + i); return d; });
  const now = new Date(todayStr() + "T00:00:00");

  const ringRows = [
    { label: "業務完成", pct: r.bizPct, note: `${r.bizPct}%／目標 85`, color: C.pink },
    { label: "主攻佔比", pct: cfg.budget.focusPct ? (r.focusShare / cfg.budget.focusPct) * 100 : 0, note: `${r.focusShare}%／目標 ${cfg.budget.focusPct}`, color: C.blue },
    { label: "個人完成", pct: r.perPct, note: `${r.perPct}%`, color: C.green },
  ];

  function TaskRow({ k }) {
    const closed = k.status !== "open";
    const overdue = k.due && k.status === "open" && k.due < todayStr();
    const flagged = (k.red > 0 || overdue) && !closed;
    const dSel = delegFor && delegFor.id === k.id ? delegFor : null;
    return (
      <div className="px-3 py-2.5" style={{ background: C.card, borderRadius: 14, boxShadow: SHADOW, borderLeft: flagged ? `3px solid ${C.red}` : "3px solid transparent" }}>
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            {editingId === k.id ? (
              <div className="flex gap-1.5 items-center">
                <input autoFocus value={editDraft} onChange={e => setEditDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && editDraft.trim()) { setTask(k.id, { title: editDraft.trim() }); setEditingId(null); }
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="flex-1 min-w-0 px-2 py-1.5 text-sm"
                  style={{ border: `1.5px solid ${C.blue}`, borderRadius: 10, background: C.bg, color: C.body, outline: "none", fontSize: 16 }} />
                <Chip bg={C.blue} fg="#fff" onClick={() => { if (editDraft.trim()) setTask(k.id, { title: editDraft.trim() }); setEditingId(null); }}>✓</Chip>
                <Chip bg={C.bg} fg={C.sub} onClick={() => setEditingId(null)}>✕</Chip>
              </div>
            ) : (
              <div className="text-sm leading-snug" onClick={() => { setEditingId(k.id); setEditDraft(k.title); }} style={{ color: closed && k.status !== "delegate" ? C.sub : C.body, textDecoration: k.status === "done" ? "line-through" : "none", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
                {k.focus && <Flame size={13} style={{ display: "inline", color: C.pink, verticalAlign: "-2px", marginRight: 3 }} />}{k.title}
                <Pencil size={11} style={{ display: "inline", marginLeft: 5, color: C.sub, verticalAlign: "-1px", opacity: 0.5 }} />
              </div>
            )}
            <div className="flex flex-wrap gap-1.5 mt-1">
              {k.red > 0 && !closed && <span className="text-xs font-semibold rounded-full px-2 py-0.5" style={{ background: C.redSoft, color: C.red }}>🔴 連紅 {k.red} 日{k.red >= 2 ? " · 週六檢討" : ""}</span>}
              {k.due && k.status === "open" && <span className="text-xs rounded-full px-2 py-0.5" style={{ background: overdue ? C.redSoft : C.blueSoft, color: overdue ? C.red : C.blue }}>⏰ {fmtMD(k.due)}{overdue ? " 逾期" : ""}</span>}
              {k.ext && <span className="text-xs rounded-full px-2 py-0.5" style={{ background: C.greenSoft, color: C.green }}>🌱</span>}
              {k.sm && !smPublishDay && <span className="text-xs rounded-full px-2 py-0.5" style={{ background: C.blueSoft, color: C.blue }}>發布窗 Mon–Fri</span>}
              {k.status === "skip" && <span className="text-xs rounded-full px-2 py-0.5" style={{ background: C.orangeSoft, color: C.orange }}>⏭️ {k.reason}</span>}
              {k.status === "delegate" && <span className="text-xs rounded-full px-2 py-0.5" style={{ background: C.blueSoft, color: C.blue }}>📤 {k.assignee} · 死線 {fmtMD(k.deadline)}{k.received ? " · 已收貨 ✓" : ""}</span>}
              {/* v13：提醒標籤／入口 */}
              {k.remindAt && (
                <span onClick={e => { e.stopPropagation(); setRemindFor(remindFor === k.id ? null : k.id); setRemindDraft(toLocalInput(new Date(k.remindAt))); setRemindRepeat(k.remindEvery ?? null); }}
                  className="text-xs rounded-full px-2 py-0.5 font-semibold"
                  style={{ background: (k.remindFired || new Date(k.remindAt) <= new Date()) ? C.redSoft : C.greenSoft, color: (k.remindFired || new Date(k.remindAt) <= new Date()) ? C.red : C.green, cursor: "pointer" }}>
                  {(k.remindFired || new Date(k.remindAt) <= new Date()) ? "🔔 到鐘" : "⏰"} {fmtDT(k.remindAt)}{k.remindEvery ? `・${REPEAT_LABELS[k.remindEvery]}` : ""}
                </span>
              )}
              {!closed && !k.remindAt && (
                <span onClick={e => { e.stopPropagation(); setRemindFor(remindFor === k.id ? null : k.id); setRemindDraft(toLocalInput(new Date(Date.now() + 3600000))); setRemindRepeat(null); }}
                  className="text-xs rounded-full px-2 py-0.5" style={{ background: C.bg, color: C.sub, cursor: "pointer" }}>⏰ 提醒</span>
              )}
            </div>
          </div>
          {!closed ? (
            <div className="flex gap-1.5">
              <StatusBtn label="Done" bg={C.greenSoft} fg={C.green} onClick={() => setTask(k.id, { status: "done" })}><Check size={20} strokeWidth={3} /></StatusBtn>
              <StatusBtn label="Skip" bg={C.orangeSoft} fg={C.orange} onClick={() => { setSkipFor(skipFor === k.id ? null : k.id); setDelegFor(null); }}><SkipForward size={18} /></StatusBtn>
              <StatusBtn label="Delegate" bg={C.blueSoft} fg={C.blue} onClick={() => { setDelegFor(dSel ? null : { id: k.id }); setSkipFor(null); }}><UserRoundPlus size={18} /></StatusBtn>
            </div>
          ) : k.status === "delegate" && !k.received ? (
            <Chip bg={C.greenSoft} fg={C.green} onClick={() => setTask(k.id, { received: true })}>✓ 收貨</Chip>
          ) : (
            <StatusBtn label="還原" bg={C.bg} fg={C.sub} onClick={() => setTask(k.id, { status: "open", reason: null, assignee: null, deadline: null, received: false })}><RotateCcw size={16} /></StatusBtn>
          )}
        </div>

        {k.red > 0 && !closed && (
          <div className="flex gap-1.5 mt-2 items-center flex-wrap">
            <Chip bg={C.redSoft} fg={C.red} onClick={() => splitTask(k)}>{splitFor === k.id ? "拆緊…" : "✂️ 拆細 ×2"}</Chip>
            <span className="text-xs" style={{ color: C.sub }}>做極唔完 → AI 拆做 2 個更細任務</span>
            {splitErr && splitErr.id === k.id && <span className="text-xs" style={{ color: C.red }}>{splitErr.msg}</span>}
          </div>
        )}

        {/* v13：提醒設定面板 */}
        {remindFor === k.id && !closed && (
          <div className="flex gap-1.5 mt-2 items-center flex-wrap">
            <input type="datetime-local" value={remindDraft} onChange={e => setRemindDraft(e.target.value)}
              className="px-2 py-1.5 text-sm" style={{ border: "none", borderRadius: 10, background: C.bg, color: C.body, outline: "none", fontSize: 16 }} />
            {[[null, "一次"], [1, "每1小時"], [3, "每3小時"], [8, "每8小時"], [24, "每日"]].map(([v, l]) => (
              <Chip key={l} bg={remindRepeat === v ? C.blue : C.bg} fg={remindRepeat === v ? "#fff" : C.sub} onClick={() => setRemindRepeat(v)}>{l}</Chip>
            ))}
            <Chip bg={C.green} fg="#fff" onClick={() => { if (!remindDraft) return; setTask(k.id, { remindAt: new Date(remindDraft).toISOString(), remindEvery: remindRepeat, remindFired: false }); ensureNotifPerm(); setRemindFor(null); }}>設定</Chip>
            {k.remindAt && <Chip bg={C.redSoft} fg={C.red} onClick={() => { setTask(k.id, { remindAt: null, remindEvery: null, remindFired: false }); setRemindFor(null); }}>清除</Chip>}
            <Chip bg={C.bg} fg={C.sub} onClick={() => setRemindFor(null)}>✕</Chip>
          </div>
        )}

        {skipFor === k.id && !closed && (
          <div className="flex gap-1.5 mt-2 items-center flex-wrap">
            <span className="text-xs" style={{ color: C.sub }}>原因：</span>
            {cfg.skipReasons.map(re => <Chip key={re} bg={C.orangeSoft} fg={C.orange} onClick={() => { setTask(k.id, { status: "skip", reason: re }); setSkipFor(null); }}>{re}</Chip>)}
            <Chip bg={C.blueSoft} fg={C.blue} onClick={() => { setSkipFor(null); setDelegFor({ id: k.id }); }}>👤 應委 PIC ▸</Chip>
          </div>
        )}

        {dSel && !closed && !dSel.staffId && (
          <div className="flex gap-1.5 mt-2 items-center flex-wrap">
            <span className="text-xs" style={{ color: C.sub }}>PIC：</span>
            {cfg.staff.map(st => <Chip key={st.id} bg={C.blueSoft} fg={C.blue} onClick={() => setDelegFor({ id: k.id, staffId: st.id })}>{st.label}</Chip>)}
          </div>
        )}
        {dSel && !closed && dSel.staffId && (
          <div className="flex gap-1.5 mt-2 items-center flex-wrap">
            <span className="text-xs" style={{ color: C.sub }}>死線：</span>
            {[{ l: "今日", n: 0 }, { l: "聽日", n: 1 }, { l: "+3日", n: 3 }].map(o => (
              <Chip key={o.l} bg={C.blue} fg="#fff" onClick={() => delegate(k, cfg.staff.find(s2 => s2.id === dSel.staffId), addDays(o.n))}>{o.l}</Chip>
            ))}
            <span className="text-xs" style={{ color: C.sub }}>（{cfg.staff.find(s2 => s2.id === dSel.staffId).label}{cfg.staff.find(s2 => s2.id === dSel.staffId).window ? " — 自動跳去佢返工日" : ""}）</span>
          </div>
        )}

        {k.status === "done" && (
          <div className="flex gap-1.5 mt-2 items-center flex-wrap">
            {!k.score ? (<><span className="text-xs" style={{ color: C.sub }}>影響：</span>{[1, 2, 3].map(n => <Chip key={n} bg={C.greenSoft} fg={C.green} onClick={() => setTask(k.id, { score: n })}>{"⭐".repeat(n)}</Chip>)}</>) : (
              <span className="text-xs rounded-full px-2 py-1 font-semibold" style={{ background: C.greenSoft, color: C.green }}>{"⭐".repeat(k.score)}</span>
            )}
            <Chip bg={C.blueSoft} fg={C.blue} onClick={() => (extFor === k.id ? setExtFor(null) : fetchExtensions(k))}>🌱 延伸 ×3</Chip>
          </div>
        )}
        {extFor === k.id && k.status === "done" && (
          <div className="mt-2 flex flex-col gap-1.5">
            {extLoading && <p className="text-xs" style={{ color: C.sub }}>AI 諗緊 3 個延伸方向…</p>}
            {extErr && <p className="text-xs" style={{ color: C.red }}>{extErr}</p>}
            {extSugs.map((sg, i) => {
              const m = cfg.lines.find(l => l.id === sg.line) || cfg.lines.find(l => l.id === k.line) || cfg.lines[0];
              return (
                <div key={i} className="px-2.5 py-2" style={{ background: C.blueSoft, borderRadius: 12 }}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs flex-1" style={{ color: C.body }}>{m.emoji} {sg.title}</span>
                    <Chip bg={C.blue} fg="#fff" onClick={() => { mutate(s => ({ ...s, tasks: [...s.tasks, mk(m.id, sg.title, m.tier === "focus", { ext: true })] })); setExtSugs(p => p.filter((_, j) => j !== i)); }}>＋加入</Chip>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-xs" style={{ color: C.sub }}>呢個建議好唔好：</span>
                    <Stars value={sg.score} onRate={n => { setExtSugs(p => p.map((x, j) => (j === i ? { ...x, score: n } : x))); logRating("ext", sg.title, n); }} />
                  </div>
                </div>
              );
            })}
            {/* v11：✍️ 其他 — 自己打延伸任務 */}
            {!extLoading && (
              <div className="flex items-center gap-2 px-2.5 py-1.5" style={{ background: C.bg, borderRadius: 12 }}>
                <span className="text-xs" style={{ color: C.sub }}>✍️</span>
                <input value={extCustom} onChange={e => setExtCustom(e.target.value)} placeholder="其他 — 自己打延伸任務…"
                  onKeyDown={e => { if (e.key === "Enter") addCustomExtension(k); }}
                  className="flex-1 min-w-0 text-sm py-1" style={{ border: "none", background: "transparent", outline: "none", color: C.body, fontSize: 16 }} />
                <Chip bg={C.blue} fg="#fff" onClick={() => addCustomExtension(k)}>＋加入</Chip>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  function Section({ lineId, isPersonal }) {
    const meta = isPersonal ? { id: "personal", label: "個人", emoji: "🧍", tier: "personal" } : cfg.lines.find(l => l.id === lineId);
    // 📦 v18：跟 taskFilter 過濾；filter 開咗而條線冇 match 就成個 section 收起
    const list = state.tasks.filter(k => k.line === meta.id && (taskFilter === "all" || k.status === taskFilter));
    if (taskFilter !== "all" && list.length === 0) return null;
    const isFocus = meta.tier === "focus";
    const isTheme = themeLines.includes(meta.id); // 🎪 v16
    let pool = isPersonal ? cfg.suggestions.personal : meta.gated ? (state.diamondInquiry ? cfg.suggestions.diamond_sales : cfg.suggestions.diamond_brand) : cfg.suggestions[meta.id] || [];
    pool = (pool || []).filter(t => !list.some(k => k.title === t));
    return (
      <section className="mt-5">
        <div className="flex items-center justify-between px-1">
          <SectionHeader color={isTheme || isFocus ? C.pink : C.sub}>
            {isTheme ? "🎪 " : ""}{meta.emoji} {meta.label}{isTheme ? " · 今日主場" : isFocus ? ` · 主攻 ${cfg.budget.focusPct}%` : isPersonal ? " · 另計" : ""}
          </SectionHeader>
          <div className="flex gap-1.5 items-center">
            {meta.gated && (
              <button onClick={() => mutate(s => ({ ...s, diamondInquiry: !s.diamondInquiry }))} className="text-xs font-semibold"
                style={{ background: state.diamondInquiry ? C.blue : C.card, color: state.diamondInquiry ? "#fff" : C.sub, border: "none", borderRadius: 999, padding: "7px 12px", boxShadow: SHADOW }}>
                {state.diamondInquiry ? "有 inquiry ✓ 開 sales" : "無 inquiry → 做 brand"}
              </button>
            )}
            <button onClick={() => { setAdding(adding === meta.id ? null : meta.id); setDraft(""); }} aria-label="加任務"
              className="rounded-full flex items-center justify-center" style={{ width: 30, height: 30, border: "none", color: C.blue, background: C.card, boxShadow: SHADOW }}><Plus size={16} /></button>
          </div>
        </div>
        <div className="flex flex-col gap-2 mt-2">
          {list.map(k => <div key={k.id}>{TaskRow({ k })}</div>)}
          {list.length === 0 && <p className="text-xs px-1" style={{ color: C.sub }}>今日未有任務 — 由下面建議揀，或者 ＋ 自己加。</p>}
        </div>
        {pool.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2 items-center">
            <span className="text-xs" style={{ color: C.sub }}>📥</span>
            {pool.map(t => (
              <Chip key={t} bg={C.card} fg={C.blue} onClick={() => mutate(s => ({ ...s, tasks: [...s.tasks, mk(meta.id, t, isFocus, { sm: /caption|post|帖|clip|IG|相/.test(t) })] }))}>＋ {t}</Chip>
            ))}
          </div>
        )}
        {adding === meta.id && (
          <>
            <div className="flex gap-1.5 mt-2">
              <input value={draft} onChange={e => setDraft(e.target.value)} placeholder="動詞 + 數字 + 名詞（≤10 分鐘）"
                className="flex-1 px-3 py-2" style={{ border: "none", borderRadius: 12, background: C.card, color: C.body, outline: "none", fontSize: 16, boxShadow: SHADOW }} />
              <button onClick={() => { if (!draft.trim()) return; mutate(s => ({ ...s, tasks: [...s.tasks, mk(meta.id, draft.trim(), isFocus)] })); setAdding(null); }}
                className="text-sm font-semibold" style={{ background: C.blue, color: "#fff", border: "none", borderRadius: 12, padding: "0 16px" }}>加</button>
            </div>
            {draft && !/\d/.test(draft) && <p className="text-xs mt-1 px-1" style={{ color: C.orange }}>提示：任務名要有數字（例：message 2 個寄賣者）</p>}
          </>
        )}
      </section>
    );
  }

  // ═══ 儀表板 tab ═══
  function DashView() {
    return (
      <>
        {/* Activity Rings */}
        <Card style={{ padding: 16, marginTop: 16 }}>
          <div className="flex items-center gap-4">
            <Rings rows={ringRows} />
            <div className="flex-1 flex flex-col gap-3">
              {ringRows.map(row => (
                <div key={row.label}>
                  <div className="flex items-center gap-1.5">
                    <span style={{ width: 9, height: 9, borderRadius: 5, background: row.color, display: "inline-block" }} />
                    <span className="text-xs" style={{ color: C.sub }}>{row.label}</span>
                  </div>
                  <p className="text-base font-bold" style={{ color: C.body, letterSpacing: "-0.3px" }}>{row.note}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* 統計格 */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          {[
            { l: "已關／應關", v: `${r.closed}/${r.denom}` },
            { l: "影響分 ⭐", v: r.impact },
            { l: "Skip", v: `${r.skips}/${cfg.skipCap}`, warn: r.skips > cfg.skipCap },
            { l: "委派收貨", v: `${r.received}/${r.deleg}` },
            { l: "跟收", v: `${r.fuDone}/${r.fuAll}` },
            { l: "逾期未收", v: r.overdue, warn: r.overdue > 0 },
          ].map(t => (
            <Card key={t.l} style={{ padding: "10px 12px" }}>
              <p className="text-xs" style={{ color: C.sub }}>{t.l}</p>
              <p className="text-xl font-bold" style={{ color: t.warn ? C.red : C.body, letterSpacing: "-0.4px" }}>{t.v}</p>
            </Card>
          ))}
        </div>

        {/* 🔔 提醒清單（v13）— 所有提醒 + PIC 委派死線 */}
        {(() => {
          const rem = state.tasks.filter(k => k.remindAt && k.status !== "done").sort((a, b) => a.remindAt.localeCompare(b.remindAt));
          const pic = state.tasks.filter(k => k.status === "delegate" && !k.received && k.deadline).sort((a, b) => a.deadline.localeCompare(b.deadline));
          return (
            <>
              <div className="mt-5 px-1"><SectionHeader>🔔 提醒清單 · {rem.length + pic.length}</SectionHeader></div>
              <Card style={{ marginTop: 8, overflow: "hidden" }}>
                {rem.length === 0 && pic.length === 0 && (
                  <p className="text-xs px-3 py-3" style={{ color: C.sub }}>未有提醒 — 喺「今日」任務標籤度撳「⏰ 提醒」設定；委派任務嘅死線會自動出現喺度。</p>
                )}
                {rem.map((k, i) => {
                  const dued = k.remindFired || new Date(k.remindAt) <= new Date();
                  return (
                    <div key={k.id} className="flex items-center gap-2 px-3 py-2.5" style={{ borderTop: i > 0 ? `1px solid ${C.line}` : "none" }}>
                      <span style={{ fontSize: 15, flexShrink: 0 }}>{dued ? "🔔" : "⏰"}</span>
                      <span className="flex-1 text-sm min-w-0" style={{ color: C.body, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k.title}</span>
                      <span className="text-xs font-semibold" style={{ color: dued ? C.red : C.blue, whiteSpace: "nowrap", flexShrink: 0 }}>{dued ? "到鐘 · " : ""}{fmtDT(k.remindAt)}{k.remindEvery ? `・${REPEAT_LABELS[k.remindEvery]}` : ""}</span>
                    </div>
                  );
                })}
                {pic.map((k, i) => {
                  const od = k.deadline < todayStr();
                  return (
                    <div key={k.id} className="flex items-center gap-2 px-3 py-2.5" style={{ borderTop: (i > 0 || rem.length > 0) ? `1px solid ${C.line}` : "none" }}>
                      <span style={{ fontSize: 15, flexShrink: 0 }}>📤</span>
                      <span className="flex-1 text-sm min-w-0" style={{ color: C.body, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k.title} <span style={{ color: C.sub }}>（{k.assignee}）</span></span>
                      <span className="text-xs font-semibold" style={{ color: od ? C.red : C.orange, whiteSpace: "nowrap", flexShrink: 0 }}>{od ? "逾期 · " : "死線 "}{fmtMD(k.deadline)}</span>
                    </div>
                  );
                })}
              </Card>
              {(rem.length > 0 || pic.length > 0) && <p className="text-xs mt-1.5 px-1" style={{ color: C.sub }}>📎 網頁限制：彈通知只喺 app 開住時先響；到鐘會喺呢度＋任務標籤轉紅，重複提醒會自動排下一輪。</p>}
              {/* ☀️ v15：朝早 10 點任務清單 digest 說明＋開通知掣 */}
              <div className="flex items-center gap-2 mt-1.5 px-1 flex-wrap">
                <p className="text-xs" style={{ color: C.sub }}>☀️ 每朝 10:00 自動推送今日任務清單（10 點後開 app 會即刻補推，一日一次）。</p>
                {typeof Notification !== "undefined" && Notification.permission === "default" && (
                  <Chip bg={C.blue} fg="#fff" onClick={ensureNotifPerm}>開通知</Chip>
                )}
              </div>
            </>
          );
        })()}

        {/* 14 日趨勢 */}
        {state.history.length > 0 && (
          <Card style={{ padding: 16, marginTop: 12 }}>
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-semibold" style={{ color: C.body }}>近 {state.history.length} 日業務完成率</p>
              <p className="text-xs" style={{ color: C.sub }}>- - 目標 85</p>
            </div>
            <div style={{ position: "relative", height: 76, marginTop: 10 }}>
              <div style={{ position: "absolute", left: 0, right: 0, bottom: "85%", borderTop: `1.5px dashed ${C.sub}`, opacity: 0.55 }} />
              <div className="flex items-end" style={{ height: "100%", gap: 2 }}>
                {state.history.map((h, i) => (
                  <div key={i} title={`${h.date}：${h.biz}%`} className="flex-1"
                    style={{ height: `${Math.max(5, h.biz)}%`, background: C.blue, borderRadius: "4px 4px 0 0", minWidth: 6 }} />
                ))}
              </div>
            </div>
          </Card>
        )}

        {/* WIG 追蹤板 */}
        <div className="flex items-center justify-between mt-5 px-1">
          <SectionHeader>🎯 WIG 追蹤板 · {state.wigs.length}/6</SectionHeader>
          <div className="flex gap-2 items-center">
            <button onClick={fetchWigSugs} className="text-xs font-semibold" style={{ color: C.green, background: "none", border: "none" }}>{wigSugLoading ? "諗緊…" : "🌱 AI 建議"}</button>
            {state.wigs.length < 6 && <button onClick={() => setWigAdding(!wigAdding)} className="text-xs font-semibold" style={{ color: C.blue, background: "none", border: "none" }}>＋ WIG</button>}
          </div>
        </div>
        <Card style={{ marginTop: 8, overflow: "hidden" }}>
          <div style={{ height: 4, background: C.bg }}>
            <div style={{ height: 4, width: `${state.wigs.length ? (100 * state.wigs.filter(w => w.done).length) / state.wigs.length : 0}%`, background: C.green, transition: "width .3s" }} />
          </div>
          {state.wigs.map((w, i) => wigEditId === w.id ? (
            /* v12：WIG 編輯模式 — 改名／撳 P 轉優先級／撳期切換／🗑️ 刪除 */
            <div key={w.id} className="flex items-center gap-1.5 px-3 py-2 flex-wrap" style={{ borderTop: i > 0 ? `1px solid ${C.line}` : "none" }}>
              <input autoFocus value={wigEditDraft} onChange={e => setWigEditDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && wigEditDraft.trim()) { mutate(s => ({ ...s, wigs: s.wigs.map(x => (x.id === w.id ? { ...x, label: wigEditDraft.trim() } : x)) })); setWigEditId(null); }
                  if (e.key === "Escape") setWigEditId(null);
                }}
                className="flex-1 min-w-0 px-2 py-1.5 text-sm"
                style={{ border: `1.5px solid ${C.blue}`, borderRadius: 10, background: C.bg, color: C.body, outline: "none", fontSize: 16, minWidth: 140 }} />
              <Chip bg={priColor(w.pri)} fg="#fff" onClick={() => mutate(s => ({ ...s, wigs: s.wigs.map(x => (x.id === w.id ? { ...x, pri: (x.pri + 1) % 5 } : x)) }))}>P{w.pri}</Chip>
              <Chip bg={C.bg} fg={C.sub} onClick={() => mutate(s => ({ ...s, wigs: s.wigs.map(x => (x.id === w.id ? { ...x, term: x.term === "短" ? "長" : "短" } : x)) }))}>{w.term}期</Chip>
              <Chip bg={C.redSoft} fg={C.red} onClick={() => { mutate(s => ({ ...s, wigs: s.wigs.filter(x => x.id !== w.id) })); setWigEditId(null); }}>🗑️</Chip>
              <Chip bg={C.blue} fg="#fff" onClick={() => { if (wigEditDraft.trim()) mutate(s => ({ ...s, wigs: s.wigs.map(x => (x.id === w.id ? { ...x, label: wigEditDraft.trim() } : x)) })); setWigEditId(null); }}>✓</Chip>
            </div>
          ) : (
            <button key={w.id} onClick={() => moveWigToRoadmap(w)}
              className="w-full flex items-center gap-2.5 text-left px-3"
              style={{ minHeight: 46, background: "none", border: "none", borderTop: i > 0 ? `1px solid ${C.line}` : "none", WebkitTapHighlightColor: "transparent" }}>
              <span className="flex items-center justify-center" style={{ width: 24, height: 24, borderRadius: 12, background: "transparent", border: `1.5px solid ${C.sub}`, color: "#fff", flexShrink: 0 }} />
              <span className="flex-1 text-sm" style={{ color: C.body }}>{w.label}</span>
              <span className="text-xs font-bold rounded-full px-1.5" style={{ background: priColor(w.pri), color: "#fff", fontSize: 10, padding: "2px 7px" }}>P{w.pri}</span>
              <span className="text-xs rounded-full" style={{ background: C.bg, color: C.sub, fontSize: 10, padding: "2px 7px" }}>{w.term}期</span>
              <span onClick={e => { e.stopPropagation(); setWigEditId(w.id); setWigEditDraft(w.label); }} style={{ padding: 5, color: C.sub, opacity: 0.6 }}><Pencil size={13} /></span>
            </button>
          ))}
          {state.wigs.length === 0 && <p className="text-xs px-3 py-3" style={{ color: C.sub }}>未有 WIG — 撳 ＋ WIG 加一個（最多 6 個）。</p>}
        </Card>
        <p className="text-xs mt-1.5 px-1" style={{ color: C.sub }}>撳一個 WIG＝完成 → 即刻存入下面 🗺️ 36 個目標路線圖，同時騰返個 WIG 位。</p>
        {/* v12：WIG AI 建議（連 ★ 評分）*/}
        {(wigSugLoading || wigSugErr || wigSugs.length > 0) && (
          <div className="flex flex-col gap-1.5 mt-2">
            {wigSugLoading && <p className="text-xs px-1" style={{ color: C.sub }}>AI 諗緊 3 個新 WIG…</p>}
            {wigSugErr && <p className="text-xs px-1" style={{ color: C.red }}>{wigSugErr}</p>}
            {wigSugs.map((sg, i) => (
              <div key={i} className="px-2.5 py-2" style={{ background: C.greenSoft, borderRadius: 12 }}>
                <div className="flex items-center gap-2">
                  <span className="text-xs flex-1" style={{ color: C.body }}>🎯 {sg.label}</span>
                  {state.wigs.length < 6 ? (
                    <Chip bg={C.green} fg="#fff" onClick={() => { mutate(s => ({ ...s, wigs: [...s.wigs, { id: uid(), label: sg.label, term: "短", pri: 1, done: false }] })); setWigSugs(p => p.filter((_, j) => j !== i)); }}>＋加入</Chip>
                  ) : (
                    <span className="text-xs" style={{ color: C.sub }}>WIG 已滿 6</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-xs" style={{ color: C.sub }}>呢個建議好唔好：</span>
                  <Stars value={sg.score} onRate={n => { setWigSugs(p => p.map((x, j) => (j === i ? { ...x, score: n } : x))); logRating("wig", sg.label, n); }} />
                </div>
              </div>
            ))}
          </div>
        )}
        {wigAdding && (
          <div className="flex gap-1.5 mt-2 items-center flex-wrap">
            <input value={wigDraft} onChange={e => setWigDraft(e.target.value)} placeholder="新 WIG（從 X 到 Y，何時前）"
              className="flex-1 px-3 py-2" style={{ border: "none", borderRadius: 12, background: C.card, outline: "none", color: C.body, fontSize: 16, boxShadow: SHADOW }} />
            <Chip bg={C.bg} fg={C.sub} onClick={() => setWigTerm(wigTerm === "短" ? "長" : "短")}>{wigTerm}期</Chip>
            <Chip bg={priColor(wigPri)} fg="#fff" onClick={() => setWigPri((wigPri + 1) % 5)}>P{wigPri}</Chip>
            <Chip bg={C.blue} fg="#fff" onClick={() => { if (!wigDraft.trim() || state.wigs.length >= 6) return; mutate(s => ({ ...s, wigs: [...s.wigs, { id: uid(), label: wigDraft.trim(), term: wigTerm, pri: wigPri, done: false }] })); setWigDraft(""); setWigAdding(false); }}>加</Chip>
          </div>
        )}

        {/* 🗺️ v14：36 個目標路線圖 — WIG 完成後封存落嚟 */}
        <div className="flex items-center justify-between mt-5 px-1">
          <SectionHeader color={C.green}>🗺️ 36 個目標路線圖 · {(state.roadmap || []).length}/{ROADMAP_GOAL}</SectionHeader>
        </div>
        <Card style={{ marginTop: 8, overflow: "hidden" }}>
          <div style={{ height: 4, background: C.bg }}>
            <div style={{ height: 4, width: `${Math.min(100, (100 * (state.roadmap || []).length) / ROADMAP_GOAL)}%`, background: C.green, transition: "width .3s" }} />
          </div>
          {(state.roadmap || []).length === 0 ? (
            <p className="text-xs px-3 py-3" style={{ color: C.sub }}>未有 WIG 完成入路線圖 — 上面 WIG 板打勾一個就會封存落嚟。</p>
          ) : (
            <div style={{ maxHeight: 220, overflowY: "auto" }}>
              {[...(state.roadmap || [])].reverse().map((w, i) => (
                <div key={w.id} className="flex items-center gap-2.5 px-3" style={{ minHeight: 42, borderTop: i > 0 ? `1px solid ${C.line}` : "none" }}>
                  <span className="flex items-center justify-center" style={{ width: 20, height: 20, borderRadius: 10, background: C.green, color: "#fff", flexShrink: 0 }}><Check size={12} strokeWidth={3.5} /></span>
                  <span className="flex-1 text-sm" style={{ color: C.sub, textDecoration: "line-through" }}>{w.label}</span>
                  <span className="text-xs rounded-full" style={{ background: C.bg, color: C.sub, fontSize: 10, padding: "2px 7px" }}>{w.term}期・P{w.pri}</span>
                  <span className="text-xs" style={{ color: C.sub }}>{fmtMD(w.doneDate)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* 週六檢討 */}
        {(wd === cfg.reviewDay || state.reviewList.length > 0) && (
          <Card style={{ padding: 14, marginTop: 12, background: C.orangeSoft }}>
            <p className="text-xs font-bold" style={{ color: C.orange }}>📋 週六檢討{wd === cfg.reviewDay ? "（今日）" : "議程"}</p>
            <p className="text-xs mt-1" style={{ color: C.body }}>跟收率 {r.fuDone}/{r.fuAll} ・ 逾期未收 {r.overdue} ・ 團隊收貨 {r.received}/{r.deleg}</p>
            {state.reviewList.map((f, i) => <p key={i} className="text-xs mt-1" style={{ color: C.body }}>• 連紅：{f}</p>)}
          </Card>
        )}

        {/* 收工報告 */}
        <button onClick={() => setReport(report ? null : buildReport(state))}
          className="mt-5 w-full text-sm font-semibold flex items-center justify-center gap-2"
          style={{ background: C.blue, color: "#fff", border: "none", borderRadius: 14, padding: "13px 0", WebkitTapHighlightColor: "transparent" }}>
          <FileText size={16} /> 生成收工報告
        </button>
        {report && (
          <Card style={{ padding: 12, marginTop: 8 }}>
            <textarea readOnly value={report} rows={14} onClick={e => e.target.select()} className="w-full text-xs p-2"
              style={{ border: "none", borderRadius: 10, color: C.body, background: C.bg, fontFamily: "inherit", outline: "none" }} />
            <div className="flex gap-1.5 mt-2">
              <input value={state.emailTo} onChange={e => mutate(s => ({ ...s, emailTo: e.target.value }))} placeholder="你嘅 email（記住咗）"
                className="flex-1 px-3 py-2" style={{ border: "none", borderRadius: 12, background: C.bg, color: C.body, outline: "none", fontSize: 16 }} />
              <button onClick={emailReport} disabled={mailStatus === "sending"} className="text-sm font-semibold flex items-center gap-1.5"
                style={{ background: mailStatus === "sending" ? C.sub : C.green, color: "#fff", border: "none", borderRadius: 12, padding: "0 14px" }}><Mail size={15} /> {mailStatus === "sending" ? "開緊…" : "Gmail 草稿"}</button>
            </div>
            <a href={`mailto:${state.emailTo}?subject=${encodeURIComponent("Hermes 日結 · " + state.date)}&body=${encodeURIComponent(report)}`}
              className="mt-1.5 w-full text-sm font-semibold flex items-center justify-center gap-1.5"
              style={{ background: C.body, color: "#fff", textDecoration: "none", borderRadius: 12, padding: "11px 0" }}>
              <Mail size={15} /> 用 Mail App 出（正路）
            </a>
            {mailStatus === "ok" && <p className="text-xs mt-1.5 font-semibold" style={{ color: C.green }}>✓ 已喺你 Gmail 開咗草稿 — 入 Gmail 撳 send</p>}
            {mailStatus === "err" && <p className="text-xs mt-1.5 font-semibold" style={{ color: C.red }}>Gmail 連接失敗{mailDetail ? `（${mailDetail}）` : ""} — 用 Mail App 掣</p>}
            {mailStatus === "noaddr" && <p className="text-xs mt-1.5 font-semibold" style={{ color: C.orange }}>先入返 email 地址</p>}
            <p className="text-xs mt-1.5" style={{ color: C.sub }}>純文字：㩒一下全選 → 複製 → 貼落 Claude / WhatsApp / Telegram。</p>
          </Card>
        )}

        {/* ⚙️ AI 設定 — provider 三選一 */}
        <div className="mt-5 px-1"><SectionHeader>⚙️ AI 設定</SectionHeader></div>
        <Card style={{ padding: 14, marginTop: 8 }}>
          <div className="flex gap-1" style={{ background: C.bg, borderRadius: 10, padding: 3 }}>
            {Object.entries(PROVIDERS).map(([id, p]) => (
              <button key={id} onClick={() => mutate(s => ({ ...s, provider: id }))}
                className="flex-1 text-xs font-semibold py-1.5"
                style={{ background: provider === id ? C.card : "transparent", color: provider === id ? C.body : C.sub, border: "none", borderRadius: 8, boxShadow: provider === id ? SHADOW : "none", WebkitTapHighlightColor: "transparent" }}>
                {p.label}
              </button>
            ))}
          </div>
          <p className="text-xs mt-2" style={{ color: C.sub, lineHeight: 1.5 }}>
            {provider === "claude" && <>喺 claude.ai artifact 入面：留空 key 直接用（行 <b>claude-sonnet-4-6</b>）。本地入 Anthropic key 就行 <b>claude-opus-4-8</b>（console.anthropic.com/settings/keys）。</>}
            {provider === "gemini" && <>自動用最新 <b>flash-lite</b> 模型（舊版落架會自動換新）。免費 key：aistudio.google.com/apikey。</>}
            {provider === "openai" && <>模型 <b>gpt-4o-mini</b>。Key：platform.openai.com/api-keys。</>}
            {" "}Key 淨係存喺你部機 localStorage，唔會上傳去第三方。
          </p>
          {provider === "claude" && (
            <input type="password" value={state.apiKey || ""} onChange={e => mutate(s => ({ ...s, apiKey: e.target.value.replace(/[^\x21-\x7E]/g, "") }))}
              placeholder="sk-ant-…（artifact 環境留空）" autoComplete="off"
              className="w-full px-3 py-2 mt-2" style={{ border: "none", borderRadius: 12, background: C.bg, color: C.body, outline: "none", fontSize: 16 }} />
          )}
          {provider === "gemini" && (
            <input type="password" value={state.geminiKey || ""} onChange={e => mutate(s => ({ ...s, geminiKey: e.target.value.replace(/[^\x21-\x7E]/g, ""), geminiModel: null }))}
              placeholder="AIza…" autoComplete="off"
              className="w-full px-3 py-2 mt-2" style={{ border: "none", borderRadius: 12, background: C.bg, color: C.body, outline: "none", fontSize: 16 }} />
          )}
          {provider === "openai" && (
            <input type="password" value={state.openaiKey || ""} onChange={e => mutate(s => ({ ...s, openaiKey: e.target.value.replace(/[^\x21-\x7E]/g, "") }))}
              placeholder="sk-…" autoComplete="off"
              className="w-full px-3 py-2 mt-2" style={{ border: "none", borderRadius: 12, background: C.bg, color: C.body, outline: "none", fontSize: 16 }} />
          )}
          {hasKey && <p className="text-xs mt-1.5 font-semibold" style={{ color: C.green }}>✓ 已設定 — ✨ 助手、✂️ 拆細、🌱 延伸而家行 {PROVIDERS[provider].label}（{provider === "gemini" ? (state.geminiModel || "flash-lite 自動偵測") : PROVIDERS[provider].model}）</p>}
          {!hasKey && provider === "claude" && <p className="text-xs mt-1.5" style={{ color: C.sub }}>未入 key — claude.ai artifact 入面照用得；本地會提示你入 key 或轉 provider。</p>}
          {/* v10.2：一鍵連線測試 */}
          <div className="flex items-start gap-2 mt-2 flex-wrap">
            <Chip bg={C.blueSoft} fg={C.blue} onClick={pingAI}>{pingStatus === "testing" ? "測緊…" : "🔌 測試 AI 連線"}</Chip>
            {pingStatus && pingStatus !== "testing" && (
              <span className="text-xs" style={{ color: pingStatus.ok ? C.green : C.red, lineHeight: 1.6, flex: 1, minWidth: 180, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                {pingStatus.msg}
              </span>
            )}
          </div>
        </Card>

        <div className="mt-4 flex items-center justify-end">
          <button onClick={() => { const f = { ...freshState(cfg), wigs: state.wigs, roadmap: state.roadmap, emailTo: state.emailTo, apiKey: state.apiKey, provider: state.provider, geminiKey: state.geminiKey, openaiKey: state.openaiKey, aiRatings: state.aiRatings, extLog: state.extLog, digestDate: state.digestDate, lastDone: state.lastDone, routines: state.routines, archive: state.archive, wigPlan: state.wigPlan }; setState(f); persist(f); }} className="text-xs font-semibold" style={{ color: C.red, background: "none", border: "none" }}>重設今日</button>
        </div>
        <p className="text-xs mt-2 px-1" style={{ color: C.sub, lineHeight: 1.5 }}>規則：任務唔會自動塞入 — 由 📥 建議揀或自己加（你就係 approval gate）。完成率 = (✅+⏭️上限{cfg.skipCap})÷非委派業務任務；主攻佔比目標 {cfg.budget.focusPct}%。委派 = 揀 PIC + 死線 + 自動「跟收」任務。連紅任務可 ✂️ 拆細；連紅 2 日入週六檢討。</p>
      </>
    );
  }

  // ═══ 今日 tab ═══
  function TodayView() {
    return (
      <>
        <div className="flex gap-1 mt-4">
          {days.map((d, i) => { const past = d < now, today = d.getTime() === now.getTime(); return <div key={i} className="flex-1" style={{ height: 6, borderRadius: 3, background: today ? C.pink : past ? C.blue : "rgba(120,120,128,0.16)" }} />; })}
        </div>
        <p className="text-xs mt-1.5 px-1" style={{ color: C.sub }}>主攻 {cfg.budget.focusPct}% ≈ {cfg.budget.focusHrs}h（🧠+🤖）｜次要 {cfg.budget.restPct}% ≈ {cfg.budget.restHrs}h（四業務）｜{smPublishDay ? "今日係發布日" : "今日非發布日"}</p>

        {smPrepDay && <div className="mt-3 px-3 py-2.5 text-xs font-semibold" style={{ background: C.orangeSoft, color: C.orange, borderRadius: 12 }}>📸 備稿日（Mon–Wed）：今日 queue 要備夠出到週五 — 備稿數 ≥ 剩餘發布日數</div>}

        {/* 迷你記分板 — 撳一下去儀表板 */}
        <button onClick={() => setTab("dash")} className="w-full mt-3 flex items-center gap-3 text-left px-4 py-3"
          style={{ background: C.card, border: "none", borderRadius: 16, boxShadow: SHADOW, WebkitTapHighlightColor: "transparent" }}>
          <span className="text-3xl font-bold" style={{ color: r.bizPct >= 85 ? C.green : C.body, letterSpacing: "-1px" }}>{r.bizPct}<span className="text-base">%</span></span>
          <span className="flex-1 text-xs" style={{ color: C.sub }}>業務完成率 · 目標 85<br />已關 {r.closed}/{r.denom} ・ 主攻 {r.focusShare}% ・ ⭐{r.impact}</span>
          <span className="text-xs font-semibold" style={{ color: C.blue }}>儀表板 ›</span>
        </button>

        {/* 📦 v18：任務清單 filter */}
        <div className="flex flex-wrap gap-1.5 mt-4 px-1">
          {[["all", "全部"], ["open", "🔴 未關"], ["done", "✅ 完成"], ["skip", "⏭️ Skip"], ["delegate", "📤 委派"]].map(([f, lab]) => (
            <Chip key={f} bg={taskFilter === f ? C.body : C.card} fg={taskFilter === f ? "#fff" : C.sub} onClick={() => setTaskFilter(f)}>{lab}</Chip>
          ))}
        </div>

        {/* 🎪 v16：今日主場 picker — 揀 1–2 條業務線做今日主力，section 會排上最前 */}
        {(() => {
          const sug = themeSuggestion();
          return (
            <div className="mt-4">
              <div className="px-1"><SectionHeader color={C.pink}>🎪 今日主場{themeLines.length ? ` · ${themeDescStr()}` : ""}</SectionHeader></div>
              <div className="flex flex-wrap gap-1.5 mt-2 px-1">
                {cfg.lines.filter(l => l.tier === "biz").map(l => {
                  const on = themeLines.includes(l.id);
                  return <Chip key={l.id} bg={on ? C.pink : C.card} fg={on ? "#fff" : C.body} onClick={() => toggleThemeLine(l.id)}>{l.emoji} {l.label}{on ? " ✓" : ""}</Chip>;
                })}
              </div>
              {sug && (
                <div className="flex items-center gap-2 mt-2 px-1 flex-wrap">
                  <span className="text-xs" style={{ color: C.orange }}>🎪 建議今日主場：{sug.line.emoji} {sug.line.label}（{sug.n} 日未有完成任務）</span>
                  <Chip bg={C.orange} fg="#fff" onClick={() => toggleThemeLine(sug.line.id)}>就係佢</Chip>
                </div>
              )}
              {!themeLines.length && !sug && <p className="text-xs mt-1.5 px-1" style={{ color: C.sub }}>揀 1–2 條業務線做今日主力 — 個 section 排上最前，AI 建議都會圍住佢轉。</p>}
            </div>
          );
        })()}

        {[...cfg.lines].sort((a, b) => (themeLines.includes(b.id) ? 1 : 0) - (themeLines.includes(a.id) ? 1 : 0)).map(l => <div key={l.id}>{Section({ lineId: l.id })}</div>)}
        {Section({ isPersonal: true })}
      </>
    );
  }

  // ═══ 📅 v17：月曆 view — 睇提醒／死線／週期任務／WIG 完成日，可編輯任務＋set 週期任務 ═══
  function CalView() {
    const [y, m] = calYM.split("-").map(Number);
    const dim = new Date(y, m, 0).getDate();
    const startDow = new Date(y, m - 1, 1).getDay();
    const ds = d => `${calYM}-${String(d).padStart(2, "0")}`;
    const today = todayStr();
    const routines = state.routines || [];
    const emOf = id => (cfg.lines.find(l => l.id === id) || { emoji: "🧍" }).emoji;
    const stEm = k => (k.status === "done" ? "✅" : k.status === "skip" ? "⏭️" : k.status === "delegate" ? "📤" : "🔴");
    const dayMarks = dateStr => {
      const marks = [];
      if (routines.some(r => routineDueOn(r, dateStr))) marks.push("🔁");
      if (state.tasks.some(k => k.remindAt && k.remindAt.slice(0, 10) === dateStr && k.status !== "done")) marks.push("⏰");
      if (state.tasks.some(k => k.status === "delegate" && !k.received && k.deadline === dateStr)) marks.push("📤");
      if ((state.roadmap || []).some(w => w.doneDate === dateStr)) marks.push("🎯");
      return marks.slice(0, 3);
    };
    const shiftM = n => { const d = new Date(y, m - 1 + n, 1); setCalYM(d.toLocaleDateString("en-CA").slice(0, 7)); };
    const selRoutines = routines.filter(r => routineDueOn(r, calSel));
    const selReminds = state.tasks.filter(k => k.remindAt && k.remindAt.slice(0, 10) === calSel && k.status !== "done");
    const selDeadlines = state.tasks.filter(k => k.status === "delegate" && !k.received && k.deadline === calSel);
    const selRoadmap = (state.roadmap || []).filter(w => w.doneDate === calSel);
    const selIsToday = calSel === today;
    const selDow = new Date(calSel + "T00:00:00").getDay();
    const selDom = +calSel.slice(8, 10);
    const addCal = () => {
      const t = calDraft.trim();
      if (!t) return;
      const lineMeta = cfg.lines.find(l => l.id === calLine) || { tier: "personal" };
      if (calFreq === "once" && selIsToday) {
        mutate(s => ({ ...s, tasks: [...s.tasks, mk(calLine, t, lineMeta.tier === "focus")] }));
      } else {
        const r = { id: uid(), title: t, line: calLine, freq: calFreq, on: calFreq === "once" ? calSel : calFreq === "weekly" ? selDow : selDom, lastDate: null };
        mutate(s => ({ ...s, routines: [...(s.routines || []), r] }));
      }
      setCalDraft("");
    };
    const taskRowCal = (k, i, extra) => (
      <div key={k.id} className="flex items-center gap-2 px-3 py-2.5" style={{ borderTop: i > 0 ? `1px solid ${C.line}` : "none" }}>
        {calEditId === k.id ? (
          <>
            <input autoFocus value={calEditDraft} onChange={e => setCalEditDraft(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && calEditDraft.trim()) { setTask(k.id, { title: calEditDraft.trim() }); setCalEditId(null); } if (e.key === "Escape") setCalEditId(null); }}
              className="flex-1 min-w-0 text-sm py-1" style={{ border: "none", background: C.bg, borderRadius: 8, outline: "none", color: C.body, fontSize: 16, padding: "4px 8px" }} />
            <Chip bg={C.blue} fg="#fff" onClick={() => { if (calEditDraft.trim()) setTask(k.id, { title: calEditDraft.trim() }); setCalEditId(null); }}>✓</Chip>
          </>
        ) : (
          <>
            <span style={{ fontSize: 14, flexShrink: 0 }}>{stEm(k)}</span>
            <span onClick={() => { setCalEditId(k.id); setCalEditDraft(k.title); }} className="flex-1 text-sm min-w-0" style={{ color: k.status === "done" ? C.sub : C.body, textDecoration: k.status === "done" ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{emOf(k.line)} {k.title}</span>
            {extra}
            <span onClick={() => { setCalEditId(k.id); setCalEditDraft(k.title); }} style={{ padding: 4, color: C.sub, opacity: 0.6 }}><Pencil size={13} /></span>
            <span onClick={() => mutate(s => ({ ...s, tasks: s.tasks.filter(x => x.id !== k.id) }))} style={{ padding: 4, color: C.red, opacity: 0.7 }}><Trash2 size={14} /></span>
          </>
        )}
      </div>
    );
    return (
      <>
        {/* 月份導航 + 格仔 */}
        <Card style={{ marginTop: 12, padding: "12px 10px" }}>
          <div className="flex items-center justify-between px-1">
            <button onClick={() => shiftM(-1)} aria-label="上個月" style={{ background: "none", border: "none", color: C.blue, padding: 6 }}><ChevronLeft size={20} /></button>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold" style={{ color: C.body }}>{y} 年 {m} 月</span>
              {(calYM !== today.slice(0, 7) || calSel !== today) && <Chip bg={C.blueSoft} fg={C.blue} onClick={() => { setCalYM(today.slice(0, 7)); setCalSel(today); }}>返今日</Chip>}
            </div>
            <button onClick={() => shiftM(1)} aria-label="下個月" style={{ background: "none", border: "none", color: C.blue, padding: 6 }}><ChevronRight size={20} /></button>
          </div>
          <div className="mt-2" style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
            {DOW_LABELS.map(l => <div key={l} className="text-xs text-center font-semibold py-1" style={{ color: C.sub }}>{l}</div>)}
            {Array.from({ length: startDow }).map((_, i) => <div key={"b" + i} />)}
            {Array.from({ length: dim }).map((_, i) => {
              const dateStr = ds(i + 1);
              const sel = dateStr === calSel;
              const isToday = dateStr === today;
              const marks = dayMarks(dateStr);
              return (
                <button key={dateStr} onClick={() => setCalSel(dateStr)}
                  className="flex flex-col items-center"
                  style={{ background: sel ? C.blue : "transparent", border: isToday && !sel ? `1.5px solid ${C.blue}` : "none", borderRadius: 10, padding: "4px 0 3px", minHeight: 44, WebkitTapHighlightColor: "transparent", cursor: "pointer" }}>
                  <span className="text-sm" style={{ color: sel ? "#fff" : isToday ? C.blue : C.body, fontWeight: sel || isToday ? 700 : 400 }}>{i + 1}</span>
                  <span style={{ fontSize: 8, lineHeight: "10px", letterSpacing: "-1px" }}>{marks.join("")}</span>
                </button>
              );
            })}
          </div>
        </Card>

        {/* 選中日 detail */}
        <div className="mt-4 px-1"><SectionHeader>📅 {fmtMD(calSel)}（週{DOW_LABELS[selDow]}）{selIsToday ? " · 今日" : ""}</SectionHeader></div>
        <Card style={{ marginTop: 8, overflow: "hidden" }}>
          {selIsToday && state.tasks.map((k, i) => taskRowCal(k, i))}
          {selReminds.filter(k => !selIsToday).map((k, i) => taskRowCal(k, (selIsToday ? state.tasks.length : 0) + i, <span className="text-xs" style={{ color: C.blue, flexShrink: 0 }}>⏰ {fmtDT(k.remindAt)}</span>))}
          {selDeadlines.filter(k => !selIsToday).map((k, i) => taskRowCal(k, 1 + i, <span className="text-xs" style={{ color: C.orange, flexShrink: 0 }}>📤 死線</span>))}
          {selRoutines.map((r, i) => (
            <div key={r.id} className="flex items-center gap-2 px-3 py-2.5" style={{ borderTop: (i > 0 || (selIsToday && state.tasks.length > 0)) ? `1px solid ${C.line}` : "none" }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>🔁</span>
              <span className="flex-1 text-sm min-w-0" style={{ color: C.body, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{emOf(r.line)} {r.title}</span>
              <span className="text-xs rounded-full px-2 py-0.5" style={{ background: C.blueSoft, color: C.blue, flexShrink: 0 }}>{routineFreqLabel(r)}</span>
              <span onClick={() => mutate(s => ({ ...s, routines: (s.routines || []).filter(x => x.id !== r.id) }))} style={{ padding: 4, color: C.red, opacity: 0.7 }}><Trash2 size={14} /></span>
            </div>
          ))}
          {selRoadmap.map((w, i) => (
            <div key={w.id} className="flex items-center gap-2 px-3 py-2.5" style={{ borderTop: `1px solid ${C.line}` }}>
              <span className="flex items-center justify-center" style={{ width: 18, height: 18, borderRadius: 9, background: C.green, color: "#fff", flexShrink: 0 }}><Check size={11} strokeWidth={3.5} /></span>
              <span className="flex-1 text-sm" style={{ color: C.sub }}>🎯 完成 WIG：{w.label}</span>
            </div>
          ))}
          {!selIsToday && selReminds.length === 0 && selDeadlines.length === 0 && selRoutines.length === 0 && selRoadmap.length === 0 && (
            <p className="text-xs px-3 py-3" style={{ color: C.sub }}>呢日暫時乜都未有 — 下面加返個任務或者週期任務。</p>
          )}
          {selIsToday && state.tasks.length === 0 && selRoutines.length === 0 && selRoadmap.length === 0 && (
            <p className="text-xs px-3 py-3" style={{ color: C.sub }}>今日未有任務。</p>
          )}
        </Card>

        {/* 加任務／週期任務落呢日 */}
        <Card style={{ marginTop: 10, padding: 12 }}>
          <p className="text-xs font-bold" style={{ color: C.body }}>＋ 加落 {fmtMD(calSel)}</p>
          <input value={calDraft} onChange={e => setCalDraft(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addCal(); }}
            placeholder="任務名（動詞＋數字＋名詞）…" className="w-full mt-2 px-3 py-2 text-sm"
            style={{ border: "none", borderRadius: 10, background: C.bg, color: C.body, outline: "none", fontSize: 16 }} />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {[...cfg.lines, { id: "personal", label: "個人", emoji: "🧍" }].map(l => (
              <Chip key={l.id} bg={calLine === l.id ? C.blue : C.bg} fg={calLine === l.id ? "#fff" : C.sub} onClick={() => setCalLine(l.id)}>{l.emoji}</Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {[["once", selIsToday ? "淨係今日" : `單次（${fmtMD(calSel)}）`], ["weekly", `每週 · 逢週${DOW_LABELS[selDow]}`], ["monthly", `每月 · ${selDom} 號`]].map(([f, lab]) => (
              <Chip key={f} bg={calFreq === f ? C.green : C.bg} fg={calFreq === f ? "#fff" : C.sub} onClick={() => setCalFreq(f)}>{f === "once" ? "" : "🔁 "}{lab}</Chip>
            ))}
          </div>
          <div className="flex justify-end mt-2"><Chip bg={C.blue} fg="#fff" onClick={addCal}>＋ 加入</Chip></div>
          <p className="text-xs mt-2" style={{ color: C.sub }}>🔁 週期任務會喺到期嗰日自動加落 task list；「單次」揀未來日子都會等到嗰日先出現。</p>
        </Card>

        {/* 所有週期任務 */}
        {routines.length > 0 && (
          <>
            <div className="mt-4 px-1"><SectionHeader>🔁 所有週期任務 · {routines.length}</SectionHeader></div>
            <Card style={{ marginTop: 8, overflow: "hidden" }}>
              {routines.map((r, i) => (
                <div key={r.id} className="flex items-center gap-2 px-3 py-2.5" style={{ borderTop: i > 0 ? `1px solid ${C.line}` : "none" }}>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>🔁</span>
                  <span className="flex-1 text-sm min-w-0" style={{ color: C.body, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{emOf(r.line)} {r.title}</span>
                  <span className="text-xs rounded-full px-2 py-0.5" style={{ background: C.blueSoft, color: C.blue, flexShrink: 0 }}>{routineFreqLabel(r)}</span>
                  <span onClick={() => mutate(s => ({ ...s, routines: (s.routines || []).filter(x => x.id !== r.id) }))} style={{ padding: 4, color: C.red, opacity: 0.7 }}><Trash2 size={14} /></span>
                </div>
              ))}
            </Card>
          </>
        )}
      </>
    );
  }

  // ═══ 📊 v19：甘特圖 tab — 日／週／月／兩個月 時間軸 ═══
  // 日 view：鐘頭軸（07–23），任務有 ⏰ 提醒就標喺嗰個鐘，冇就成日一條淺 bar。
  // 週／月／兩月 view：日軸 — 任務 bar 由 created（或連紅起點）去到 due／死線／今日；
  // 🔁 週期任務逐個到期日標格；✅ 封存完成任務一行彙總（每日一格顯示數量）；
  // 🎯 WIG 由今日推去 term 期限（短=衝刺尾、中=+45日、長=+90日）。
  function GanttView() {
    const today = todayStr();
    const emOf = id => (cfg.lines.find(l => l.id === id) || { emoji: "🧍" }).emoji;
    const isDay = ganttRange === "day";
    const HOURS = Array.from({ length: 17 }, (_, i) => i + 7);
    const startOffset = ganttRange === "week" ? -1 : ganttRange === "month" ? -7 : -14;
    const nDays = ganttRange === "week" ? 7 : ganttRange === "month" ? 30 : 60;
    const cols = isDay ? HOURS : Array.from({ length: nDays }, (_, i) => shiftDate(today, startOffset + i));
    // v19.1：底闊 × zoom（0.6–2 倍）— 撳 ➖／➕ 縮放
    const baseW = isDay ? 30 : ganttRange === "week" ? 48 : ganttRange === "month" ? 30 : 24;
    const colW = Math.round(baseW * ganttZoom);
    const N = cols.length;
    const LBL_W = Math.round(148 * Math.min(ganttZoom, 1.2)); // 名欄跟住放大少少
    const ROW_H = Math.round(38 * Math.min(ganttZoom, 1.3));
    const BAR_H = Math.round(20 * Math.min(ganttZoom, 1.3));
    const idx = d => cols.indexOf(d);
    const rows = [];
    if (isDay) {
      state.tasks.forEach(k => {
        const done = k.status === "done" || k.status === "skip";
        let from = 0, to = N - 1, soft = true;
        if (k.remindAt && k.remindAt.slice(0, 10) === today) {
          const i = HOURS.indexOf(Math.min(23, Math.max(7, new Date(k.remindAt).getHours())));
          if (i >= 0) { from = i; to = Math.min(N - 1, i + 1); soft = false; }
        }
        const color = done ? C.green : k.red > 0 ? C.red : k.status === "delegate" ? C.orange : C.blue;
        rows.push({ label: `${emOf(k.line)} ${k.title}`, segs: [{ from, to, color, soft: soft && !done }] });
      });
    } else {
      const first = cols[0], last = cols[N - 1];
      state.tasks.forEach(k => {
        const done = k.status === "done" || k.status === "skip";
        const rawS = done ? today : (k.created || shiftDate(today, -(k.red || 0)));
        const rawE = done ? today : (k.due || k.deadline || today);
        const lo = rawS < rawE ? rawS : rawE, hi = rawS < rawE ? rawE : rawS;
        if (hi < first || lo > last) return;
        const from = idx(lo < first ? first : lo), to = idx(hi > last ? last : hi);
        const color = done ? C.green : k.red > 0 ? C.red : k.status === "delegate" ? C.orange : C.blue;
        rows.push({ label: `${emOf(k.line)} ${k.title}`, segs: [{ from, to, color }] });
      });
      const archSegs = (state.archive || []).filter(d => idx(d.date) >= 0).map(d => ({ from: idx(d.date), to: idx(d.date), color: C.green, txt: String(d.tasks.length) }));
      if (archSegs.length) rows.push({ label: "✅ 已完成（封存）", segs: archSegs });
      (state.routines || []).forEach(r => {
        const segs = cols.map((d, i) => (routineDueOn(r, d) ? { from: i, to: i, color: C.blue, soft: true, txt: "🔁" } : null)).filter(Boolean);
        if (segs.length) rows.push({ label: `🔁 ${emOf(r.line)} ${r.title}`, segs });
      });
      state.wigs.forEach(w => {
        const hor = w.term === "短" ? (cfg.sprint.end > today ? cfg.sprint.end : shiftDate(today, 7)) : w.term === "中" ? shiftDate(today, 45) : shiftDate(today, 90);
        rows.push({ label: `🎯 P${w.pri} ${w.label}`, segs: [{ from: idx(today), to: idx(hor > last ? last : hor), color: C.green, soft: true }] });
      });
    }
    const nowHourIdx = isDay ? HOURS.indexOf(new Date().getHours()) : -1;
    const todayIdx = isDay ? -1 : idx(today);
    const hilite = isDay ? nowHourIdx : todayIdx;
    const timeline = (segs, rowKey) => (
      <div style={{ position: "relative", width: N * colW, height: ROW_H, flexShrink: 0, background: `repeating-linear-gradient(90deg, transparent 0, transparent ${colW - 1}px, ${C.line} ${colW - 1}px, ${C.line} ${colW}px)` }}>
        {hilite >= 0 && <div style={{ position: "absolute", left: hilite * colW, width: colW, top: 0, bottom: 0, background: C.blueSoft, opacity: 0.5 }} />}
        {segs.map((sg, j) => (
          <div key={rowKey + "-" + j} style={{ position: "absolute", left: sg.from * colW + 1, width: (sg.to - sg.from + 1) * colW - 2, top: Math.round((ROW_H - BAR_H) / 2), height: BAR_H, borderRadius: BAR_H / 2, background: sg.soft ? sg.color + "2E" : sg.color, border: sg.soft ? `1px solid ${sg.color}` : "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(10 * Math.min(ganttZoom, 1.3)), fontWeight: 700, color: sg.soft ? sg.color : "#fff", overflow: "hidden" }}>{sg.txt || ""}</div>
        ))}
      </div>
    );
    return (
      <>
        <div className="flex flex-wrap items-center gap-1.5 mt-4 px-1">
          {[["day", "日"], ["week", "週"], ["month", "月"], ["two", "兩個月"]].map(([g, lab]) => (
            <Chip key={g} bg={ganttRange === g ? C.body : C.card} fg={ganttRange === g ? "#fff" : C.sub} onClick={() => setGanttRange(g)}>{lab}</Chip>
          ))}
          {/* v19.1：🔍 縮放 */}
          <span className="flex items-center gap-1" style={{ marginLeft: "auto" }}>
            <Chip bg={C.card} fg={ganttZoom <= 0.6 ? C.line : C.body} onClick={() => setGanttZoom(z => Math.max(0.6, Math.round((z - 0.2) * 10) / 10))}>➖</Chip>
            <span className="text-xs font-semibold" style={{ color: C.sub, minWidth: 34, textAlign: "center" }}>{Math.round(ganttZoom * 100)}%</span>
            <Chip bg={C.card} fg={ganttZoom >= 2 ? C.line : C.body} onClick={() => setGanttZoom(z => Math.min(2, Math.round((z + 0.2) * 10) / 10))}>➕</Chip>
          </span>
        </div>
        {/* v19.1：負 margin 谷闊個 chart，用盡屏幕 */}
        <Card style={{ marginTop: 10, overflow: "hidden", marginLeft: -12, marginRight: -12 }}>
          {rows.length === 0 ? (
            <p className="text-xs px-3 py-4" style={{ color: C.sub }}>呢個範圍暫時冇嘢畫 — 加任務／提醒／週期任務先。</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <div style={{ width: LBL_W + N * colW }}>
                {/* 時間軸 header */}
                <div className="flex" style={{ borderBottom: `1px solid ${C.line}` }}>
                  <div style={{ position: "sticky", left: 0, width: LBL_W, minWidth: LBL_W, background: C.card, zIndex: 2 }} />
                  <div style={{ position: "relative", width: N * colW, height: 30, flexShrink: 0 }}>
                    {cols.map((c, i) => {
                      const d = isDay ? null : new Date(c + "T00:00:00");
                      const isH = i === hilite;
                      return (
                        <div key={i} style={{ position: "absolute", left: i * colW, width: colW, top: 0, bottom: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: isH ? C.blueSoft : "transparent" }}>
                          <span style={{ fontSize: 9, fontWeight: isH ? 800 : 600, color: isH ? C.blue : C.sub, lineHeight: 1.2 }}>{isDay ? c : d.getDate()}</span>
                          <span style={{ fontSize: 8, color: isH ? C.blue : C.sub, lineHeight: 1.1 }}>{isDay ? "時" : (d.getDate() === 1 || i === 0 ? `${d.getMonth() + 1}月` : DOW_LABELS[d.getDay()])}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {rows.map((row, ri) => (
                  <div key={ri} className="flex items-center" style={{ borderTop: ri > 0 ? `1px solid ${C.line}` : "none" }}>
                    {/* v19.1：名欄兩行顯示，唔再一行截斷 */}
                    <div className="px-2" style={{ position: "sticky", left: 0, width: LBL_W, minWidth: LBL_W, background: C.card, zIndex: 2, alignSelf: "stretch", display: "flex", alignItems: "center", borderRight: `1px solid ${C.line}` }}>
                      <span style={{ fontSize: 11, lineHeight: 1.3, color: C.body, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", wordBreak: "break-all" }}>{row.label}</span>
                    </div>
                    {timeline(row.segs, ri)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
        <p className="text-xs mt-1.5 px-1" style={{ color: C.sub, lineHeight: 1.6 }}>
          🔵 進行中　🔴 連紅　🟠 委派　🟢 完成／WIG（淺色框=時段估算）　🔁 週期任務到期日　✅ 行=封存完成數。
          {isDay ? "　日 view：有 ⏰ 提醒嘅任務標喺嗰個鐘。" : "　bar 由任務開始日去到 due／死線（冇就今日）。"}
        </p>
      </>
    );
  }

  // ═══ 📦 v18：封存 tab — 完成任務封存箱 ＋ 🗓️ WIG 計劃表（連 AI）═══
  function BoxView() {
    const emOf = id => (cfg.lines.find(l => l.id === id) || { emoji: "🧍" }).emoji;
    const stEm = st => (st === "done" ? "✅" : st === "skip" ? "⏭️" : "📤");
    const q = boxSearch.trim().toLowerCase();
    const days = [...(state.archive || [])].reverse()
      .map(d => ({ ...d, tasks: q ? d.tasks.filter(t => t.title.toLowerCase().includes(q)) : d.tasks }))
      .filter(d => d.tasks.length);
    const total = (state.archive || []).reduce((a, d) => a + d.tasks.length, 0);
    const plan = state.wigPlan || [];
    const wigFull = state.wigs.length >= 6;
    const TERMS = ["短", "中", "長"];
    const cyclePlan = (id, key) => mutate(s => ({
      ...s, wigPlan: (s.wigPlan || []).map(p => p.id !== id ? p : key === "term"
        ? { ...p, term: TERMS[(TERMS.indexOf(p.term) + 1) % 3] }
        : { ...p, pri: (p.pri + 1) % 3 }),
    }));
    const addPlan = (label, term = "中", pri = 1) => {
      const t = (label || "").trim();
      if (!t) return;
      mutate(s => ({ ...s, wigPlan: [...(s.wigPlan || []), { id: uid(), label: t, term: TERMS.includes(term) ? term : "中", pri: [0, 1, 2].includes(pri) ? pri : 1 }] }));
    };
    const promote = p => {
      if (wigFull) return;
      mutate(s => s.wigs.length >= 6 ? s : { ...s, wigs: [...s.wigs, { id: p.id, label: p.label, term: p.term, pri: p.pri, done: false }], wigPlan: (s.wigPlan || []).filter(x => x.id !== p.id) });
    };
    return (
      <>
        {/* 🗓️ WIG 計劃表 */}
        <div className="flex items-center justify-between mt-4 px-1">
          <SectionHeader color={C.pink}>🗓️ WIG 計劃表 · {plan.length}</SectionHeader>
          <button onClick={fetchPlanSugs} className="text-xs font-semibold" style={{ color: C.green, background: "none", border: "none" }}>{planSugLoading ? "諗緊…" : "🌱 AI 建議"}</button>
        </div>
        <Card style={{ marginTop: 8, overflow: "hidden" }}>
          {plan.length === 0 && <p className="text-xs px-3 py-3" style={{ color: C.sub }}>WIG board 得 6 個位 — 未輪到嘅目標擺呢度排隊，位一空就 ⬆️ 推上去。</p>}
          {plan.map((p, i) => (
            <div key={p.id} className="flex items-center gap-2 px-3 py-2.5" style={{ borderTop: i > 0 ? `1px solid ${C.line}` : "none" }}>
              <span className="flex-1 text-sm min-w-0" style={{ color: C.body, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.label}</span>
              <span onClick={() => cyclePlan(p.id, "pri")} className="text-xs font-bold rounded-full" style={{ background: priColor(p.pri), color: "#fff", fontSize: 10, padding: "2px 7px", cursor: "pointer", flexShrink: 0 }}>P{p.pri}</span>
              <span onClick={() => cyclePlan(p.id, "term")} className="text-xs rounded-full" style={{ background: C.bg, color: C.sub, fontSize: 10, padding: "2px 7px", cursor: "pointer", flexShrink: 0 }}>{p.term}期</span>
              <span onClick={() => promote(p)} style={{ padding: 4, color: wigFull ? C.sub : C.green, opacity: wigFull ? 0.35 : 0.9, flexShrink: 0 }} title={wigFull ? "WIG board 滿咗" : "推上 WIG board"}><ArrowUpCircle size={17} /></span>
              <span onClick={() => mutate(s => ({ ...s, wigPlan: (s.wigPlan || []).filter(x => x.id !== p.id) }))} style={{ padding: 4, color: C.red, opacity: 0.7, flexShrink: 0 }}><Trash2 size={14} /></span>
            </div>
          ))}
          <div className="flex items-center gap-2 px-3 py-2" style={{ borderTop: plan.length ? `1px solid ${C.line}` : "none" }}>
            <span className="text-xs" style={{ color: C.sub }}>✍️</span>
            <input value={planDraft} onChange={e => setPlanDraft(e.target.value)} placeholder="加個計劃 WIG（從 X 到 Y）…"
              onKeyDown={e => { if (e.key === "Enter") { addPlan(planDraft); setPlanDraft(""); } }}
              className="flex-1 min-w-0 text-sm py-1" style={{ border: "none", background: "transparent", outline: "none", color: C.body, fontSize: 16 }} />
            <Chip bg={C.blue} fg="#fff" onClick={() => { addPlan(planDraft); setPlanDraft(""); }}>＋</Chip>
          </div>
        </Card>
        <p className="text-xs mt-1.5 px-1" style={{ color: C.sub }}>撳 P 轉優先級、撳期切換 短／中／長；⬆️ 推上 WIG board（{state.wigs.length}/6）。</p>
        {(planSugLoading || planSugErr || planSugs.length > 0) && (
          <div className="flex flex-col gap-1.5 mt-2">
            {planSugErr && <p className="text-xs px-1" style={{ color: C.red }}>{planSugErr}</p>}
            {planSugs.map((sg, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2" style={{ background: C.greenSoft, borderRadius: 12 }}>
                <span className="text-xs flex-1" style={{ color: C.body }}>🌱 {sg.label}<span style={{ color: C.sub }}>（{sg.term || "中"}期・P{sg.pri ?? 1}）</span></span>
                <Chip bg={C.green} fg="#fff" onClick={() => { addPlan(sg.label, sg.term, sg.pri ?? 1); setPlanSugs(p => p.filter((_, j) => j !== i)); }}>＋ 入表</Chip>
              </div>
            ))}
          </div>
        )}

        {/* 📦 完成任務封存箱 */}
        <div className="flex items-center justify-between mt-5 px-1">
          <SectionHeader>📦 完成任務封存 · {total}</SectionHeader>
        </div>
        <Card style={{ marginTop: 8, padding: "8px 12px" }}>
          <input value={boxSearch} onChange={e => setBoxSearch(e.target.value)} placeholder="🔍 搵返以前做過嘅任務…"
            className="w-full text-sm py-1" style={{ border: "none", background: "transparent", outline: "none", color: C.body, fontSize: 16 }} />
        </Card>
        {days.length === 0 && (
          <Card style={{ marginTop: 8, padding: 14 }}>
            <p className="text-xs" style={{ color: C.sub }}>{q ? "搵唔到 — 試下第二個關鍵字。" : "仲未有封存 — 今日做完嘅任務，過咗今日就會自動入嚟呢度。"}</p>
          </Card>
        )}
        {days.map(d => (
          <div key={d.date}>
            <div className="mt-4 px-1"><SectionHeader>{fmtMD(d.date)}（週{DOW_LABELS[new Date(d.date + "T00:00:00").getDay()]}）· {d.tasks.length}</SectionHeader></div>
            <Card style={{ marginTop: 6, overflow: "hidden" }}>
              {d.tasks.map((t, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2.5" style={{ borderTop: i > 0 ? `1px solid ${C.line}` : "none" }}>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>{stEm(t.status)}</span>
                  <span className="flex-1 text-sm min-w-0" style={{ color: C.body }}>{emOf(t.line)} {t.title}</span>
                  {t.score ? <span className="text-xs" style={{ color: "#FF9500", flexShrink: 0 }}>{"⭐".repeat(t.score)}</span> : null}
                  {t.status === "skip" && t.reason ? <span className="text-xs" style={{ color: C.sub, flexShrink: 0 }}>（{t.reason}）</span> : null}
                  {t.status === "delegate" && t.assignee ? <span className="text-xs" style={{ color: C.blue, flexShrink: 0 }}>📤 {t.assignee}</span> : null}
                </div>
              ))}
            </Card>
          </div>
        ))}
      </>
    );
  }

  const TAB_H = 58;
  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: FONT, WebkitFontSmoothing: "antialiased" }}>

      {/* 毛玻璃大標題 header */}
      <div style={{ position: "sticky", top: 0, zIndex: 40, ...BLUR, borderBottom: `1px solid ${C.line}` }}>
        <div className="mx-auto px-4 pt-3 pb-2" style={{ maxWidth: 480 }}>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold" style={{ color: C.sub, letterSpacing: "0.04em" }}>
                HERMES AI <span style={{ color: C.pink }}>v19.1</span> · {new Date().toLocaleDateString("zh-HK", { month: "long", day: "numeric", weekday: "short" })}
                {storageOk === true && <span style={{ color: C.green }}> · ● 已同步</span>}
                {storageOk === false && <span style={{ color: C.red }}> · ⚠︎ 儲存離線</span>}
              </p>
              <h1 className="font-bold" style={{ color: C.body, fontSize: 30, letterSpacing: "-0.6px", lineHeight: 1.15 }}>{tab === "dash" ? "儀表板" : tab === "cal" ? "月曆" : tab === "gantt" ? "甘特圖" : tab === "box" ? "封存庫" : "今日"}</h1>
            </div>
            <span className="text-xs font-semibold rounded-full px-2.5 py-1" style={{ background: C.blueSoft, color: C.blue }}>衝刺 #{cfg.sprint.num} · {fmtMD(cfg.sprint.start)}–{fmtMD(cfg.sprint.end)}</span>
          </div>
        </div>
      </div>

      <div className="mx-auto px-4" style={{ maxWidth: 480, paddingBottom: `calc(${TAB_H}px + env(safe-area-inset-bottom, 0px) + 24px)` }}>
        {tab === "today" ? TodayView() : tab === "cal" ? CalView() : tab === "gantt" ? GanttView() : tab === "box" ? BoxView() : DashView()}
      </div>

      {/* ✨ AI 助手面板 */}
      {aiOpen && (
        <div style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: `calc(${TAB_H}px + env(safe-area-inset-bottom, 0px) + 76px)`, width: "min(448px, calc(100vw - 24px))", maxHeight: "58vh", background: C.card, borderRadius: 22, boxShadow: "0 16px 48px rgba(0,0,0,0.22)", display: "flex", flexDirection: "column", zIndex: 60, fontFamily: FONT }}>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
            <div className="flex items-center gap-2">
              <Sparkles size={16} style={{ color: C.pink }} />
              <p className="text-sm font-semibold" style={{ color: C.body }}>Hermes AI 助手</p>
            </div>
            <button onClick={() => setAiOpen(false)} aria-label="閂" className="rounded-full flex items-center justify-center" style={{ width: 28, height: 28, color: C.sub, background: C.bg, border: "none" }}><X size={14} /></button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2" style={{ minHeight: 120 }}>
            {aiMsgs.length === 0 && (
              <p className="text-xs px-1" style={{ color: C.sub }}>我睇緊你今日嘅 dashboard — 完成率、連紅、WIG 全部知。問我點開始、點排優先，或者叫我建議任務。{!hasKey && "（本地測試：去儀表板「⚙️ AI 設定」揀 Claude／Gemini／OpenAI 入 key）"}</p>
            )}
            {aiMsgs.map((m, i) => (
              <Fragment key={i}>
                <div className="px-3 py-2 text-sm" style={{
                  background: m.role === "user" ? C.blue : C.bg,
                  color: m.role === "user" ? "#fff" : C.body,
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "85%", whiteSpace: "pre-wrap", lineHeight: 1.45,
                  borderRadius: 18,
                  borderBottomRightRadius: m.role === "user" ? 6 : 18,
                  borderBottomLeftRadius: m.role === "user" ? 18 : 6,
                }}>{m.content}</div>
                {/* v14.1：呢條 message 似足收工報告格式 — 問要唔要套用返落 task list */}
                {looksLikeReport(m.content) && (
                  syncedMsgs[i] ? (
                    <p className="text-xs px-1" style={{ color: syncedMsgs[i].total === 0 ? C.orange : C.green, alignSelf: m.role === "user" ? "flex-end" : "flex-start" }}>
                      {syncedMsgs[i].total === 0
                        ? "⚠️ 冇讀到任何任務行 — 格式可能同範本對唔上（睇下 emoji／分隔線／「── 今日任務 ──」有冇跟足）"
                        : `✓ 已更新 ${syncedMsgs[i].matched} 個現有任務${syncedMsgs[i].created ? `，新增 ${syncedMsgs[i].created} 個` : ""}`}
                    </p>
                  ) : (
                    <div className="flex items-center gap-2 px-1 flex-wrap" style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start" }}>
                      <span className="text-xs" style={{ color: C.sub }}>偵測到收工報告 —</span>
                      <Chip bg={C.blue} fg="#fff" onClick={() => applyReportSync(parseReportSync(m.content), i)}>要唔要更新晒 task list？</Chip>
                    </div>
                  )
                )}
              </Fragment>
            ))}
            {aiLoading && <p className="text-xs px-1" style={{ color: C.sub }}>✨ 諗緊…</p>}
            {aiSugs.length > 0 && !aiLoading && (
              <div className="flex flex-col gap-1.5 mt-1">
                {aiSugs.map((sg, i) => {
                  const m = cfg.lines.find(l => l.id === sg.line);
                  return (
                    <div key={i} className="flex items-center gap-2 px-2.5 py-2" style={{ background: C.blueSoft, borderRadius: 12 }}>
                      <span className="text-xs flex-1" style={{ color: C.body }}>{m ? m.emoji : "🧍"} {sg.title}</span>
                      <Chip bg={C.blue} fg="#fff" onClick={() => addAiSug(sg, i)}>＋加入</Chip>
                    </div>
                  );
                })}
              </div>
            )}
            <div ref={aiEndRef} />
          </div>

          {aiMsgs.length === 0 && (
            <div className="flex flex-wrap gap-1.5 px-3 pb-2">
              {["今日點開始最好？", "邊樣最值得先做？", "幫我覆盤今日"].map(q => (
                <Chip key={q} bg={C.bg} fg={C.blue} onClick={() => askAI(q)}>{q}</Chip>
              ))}
            </div>
          )}

          <div className="flex gap-1.5 px-3 pb-3 items-end">
            {/* v14.1：由 <input>（單行）換做 <textarea> — 貼收工報告呢類多行文字入嚟先唔會俾瀏覽器剝晒 \n */}
            <textarea ref={aiInputRef} value={aiInput} onChange={e => setAiInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); askAI(aiInput); } }}
              placeholder="問 Hermes…（Enter 送出，Shift+Enter 換行）" rows={1} className="flex-1 px-3 py-2 text-sm"
              style={{ border: "none", borderRadius: 18, background: C.bg, color: C.body, outline: "none", fontSize: 16, resize: "none", lineHeight: 1.4, maxHeight: 120, overflowY: "auto", fontFamily: "inherit" }} />
            <button onClick={() => askAI(aiInput)} disabled={aiLoading} aria-label="送出"
              className="rounded-full flex items-center justify-center" style={{ width: 40, height: 40, background: aiLoading ? C.sub : C.blue, color: "#fff", border: "none", flexShrink: 0 }}>
              <Send size={16} />
            </button>
          </div>
        </div>
      )}

      {/* 🗺️ v14：WIG 封存去路線圖之後嘅 ↩️ 復原 toast */}
      {archivedToast && (
        <div style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: `calc(${TAB_H}px + env(safe-area-inset-bottom, 0px) + 14px)`, background: C.body, color: "#fff", borderRadius: 14, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.28)", zIndex: 62, fontFamily: FONT, maxWidth: "min(420px, calc(100vw - 32px))" }}>
          <span className="text-sm" style={{ flex: 1 }}>✓ 「{archivedToast.wig.label}」已存入 36 目標路線圖</span>
          <button onClick={undoArchive} className="text-sm font-semibold" style={{ color: C.pink, background: "none", border: "none", flexShrink: 0, WebkitTapHighlightColor: "transparent" }}>復原</button>
        </div>
      )}

      {/* ☀️ v15：朝早 10 點任務清單 digest 卡片 */}
      {digestToast && (
        <div style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: `calc(${TAB_H}px + env(safe-area-inset-bottom, 0px) + 14px)`, background: C.card, color: C.body, borderRadius: 16, padding: "14px 16px", boxShadow: "0 8px 24px rgba(0,0,0,0.28)", zIndex: 63, fontFamily: FONT, width: "min(420px, calc(100vw - 32px))" }}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold">☀️ 早晨！今日任務清單（{digestToast.count} 個未關）</p>
            <button onClick={() => setDigestToast(null)} aria-label="關閉" style={{ background: "none", border: "none", color: C.sub, padding: 4, WebkitTapHighlightColor: "transparent" }}><X size={16} /></button>
          </div>
          {digestToast.count === 0 ? (
            <p className="text-xs mt-1.5" style={{ color: C.sub }}>今日暫時未有任務 — 開個靚 plan ✍️</p>
          ) : (
            <div className="mt-1.5">
              {digestToast.titles.map((t, i) => <p key={i} className="text-xs" style={{ color: C.body, lineHeight: 1.7 }}>• {t}</p>)}
              {digestToast.count > digestToast.titles.length && <p className="text-xs" style={{ color: C.sub }}>…仲有 {digestToast.count - digestToast.titles.length} 個</p>}
            </div>
          )}
          {digestToast.themeLine && <p className="text-xs mt-1.5 font-semibold" style={{ color: C.orange }}>{digestToast.themeLine}</p>}
        </div>
      )}

      {/* ✨ AI 浮動掣 */}
      <button onClick={() => setAiOpen(!aiOpen)} aria-label="AI 助手"
        style={{ position: "fixed", right: "max(16px, calc(50% - 224px))", bottom: `calc(${TAB_H}px + env(safe-area-inset-bottom, 0px) + 14px)`, width: 52, height: 52, borderRadius: 26, background: aiOpen ? C.sub : C.pink, color: "#fff", border: "none", boxShadow: "0 6px 18px rgba(255,45,85,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 61, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
        {aiOpen ? <X size={22} /> : <Sparkles size={22} />}
      </button>

      {/* 底部 Tab Bar（iOS 風格）*/}
      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 55, ...BLUR, borderTop: `1px solid ${C.line}`, paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="mx-auto flex" style={{ maxWidth: 480, height: TAB_H }}>
          {[
            { id: "today", label: "今日", Icon: ListTodo },
            { id: "cal", label: "月曆", Icon: CalendarDays },
            { id: "gantt", label: "甘特", Icon: ChartNoAxesGantt },
            { id: "box", label: "封存", Icon: Archive },
            { id: "dash", label: "儀表板", Icon: PieChart },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex-1 flex flex-col items-center justify-center gap-0.5"
              style={{ background: "none", border: "none", color: tab === t.id ? C.blue : C.sub, WebkitTapHighlightColor: "transparent" }}>
              <t.Icon size={23} strokeWidth={tab === t.id ? 2.4 : 2} />
              <span style={{ fontSize: 10, fontWeight: 600 }}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
