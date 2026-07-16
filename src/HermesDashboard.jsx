import { useState, useEffect, useRef, Fragment } from "react";
import { Flame, Check, SkipForward, UserRoundPlus, Plus, RotateCcw, FileText, Mail, Sparkles, Send, X, ListTodo, PieChart, Pencil } from "lucide-react";

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
const mk = (line, title, focus = false, extra = {}) => ({ id: uid(), line, title, focus, status: "open", reason: null, red: 0, assignee: null, deadline: null, received: false, due: null, score: null, ext: false, followUp: false, sm: false, remindAt: null, remindEvery: null, remindFired: false, ...extra });
const todayStr = () => new Date().toLocaleDateString("en-CA");
const addDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString("en-CA"); };
const snapToWindow = (iso, win) => { if (!win) return iso; const d = new Date(iso + "T00:00:00"); while (!win.includes(d.getDay())) d.setDate(d.getDate() + 1); return d.toLocaleDateString("en-CA"); };
const fmtMD = iso => (iso ? `${+iso.slice(5, 7)}/${+iso.slice(8, 10)}` : "");
// v13：提醒工具
const fmtDT = iso => { const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const toLocalInput = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const REPEAT_LABELS = { 1: "每1小時", 3: "每3小時", 8: "每8小時", 24: "每日" };
const priColor = p => (p === 0 ? C.red : p === 1 ? C.orange : C.blue);

// 🗺️ v14：36 個目標路線圖 — 固定目標數，唔開俾用戶自訂
const ROADMAP_GOAL = 36;

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

const freshState = cfg => ({ date: todayStr(), diamondInquiry: false, wigs: cfg.wigs.map(w => ({ ...w })), roadmap: [], emailTo: "", apiKey: "", provider: "claude", geminiKey: "", openaiKey: "", tasks: [], history: [], reviewList: [], aiRatings: [], extLog: [] });

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
  return { ...s, date: todayStr(), tasks: [...carried, ...delegOpen], history: [...s.history, { date: s.date, biz: r.bizPct, per: r.perPct, impact: r.impact }].slice(-14), reviewList: review };
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

export default function HermesDashboard() {
  const [cfg, setCfg] = useState(null);
  const [state, setState] = useState(null);
  const [tab, setTab] = useState("today"); // "today" | "dash"
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
  const [digestToast, setDigestToast] = useState(null); // { count, titles }
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
      const body = open.length
        ? open.slice(0, 8).map(k => "• " + k.title).join("\n") + (open.length > 8 ? `\n…仲有 ${open.length - 8} 個` : "")
        : "今日暫時未有任務 — 開個靚 plan ✍️";
      try { if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification(`☀️ 今日任務清單（${open.length} 個未關）`, { body }); } catch {}
      setDigestToast({ count: open.length, titles: open.slice(0, 6).map(k => k.title) });
      const n = { ...prev, digestDate: todayStr() };
      persist(n);
      return n;
    });
    check();
    const t = setInterval(check, 60000);
    return () => clearInterval(t);
  }, []);

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
  const setTask = (id, patch) => mutate(s => ({ ...s, tasks: s.tasks.map(k => (k.id === id ? { ...k, ...patch } : k)) }));

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
      const tasks = s.tasks.map(k => {
        const hit = taskItems.find(it => !matchedSet.has(it) && (it.title === k.title || k.title.includes(it.title) || it.title.includes(k.title)));
        if (!hit) return k;
        matchedSet.add(hit);
        if (hit.status === "done") return { ...k, status: "done", score: hit.score || k.score };
        if (hit.status === "skip") return { ...k, status: "skip", reason: hit.reason || k.reason };
        if (hit.status === "delegate") return { ...k, status: "delegate", assignee: hit.assignee || k.assignee, received: hit.received || k.received };
        return k;
      });
      // v14.3：用報告行頭嘅業務線 emoji（🏪🥩💎📚🧠🤖）搵返啱嘅 line，
      //        搵唔到先至落「個人」— 新任務就會出現喺正確嘅業務 section 度
      const added = taskItems.filter(it => !matchedSet.has(it)).map(it => {
        const lineMeta = (it.em && cfg.lines.find(l => l.emoji === it.em)) || { id: "personal", tier: "personal" };
        return mk(lineMeta.id, it.title, lineMeta.tier === "focus", {
          status: it.status, score: it.score ?? null, reason: it.reason ?? null, assignee: it.assignee ?? null, received: !!it.received,
        });
      });
      stats = { matched: matchedSet.size, created: added.length, total: taskItems.length };
      return { ...s, tasks: [...tasks, ...added] };
    });
    setSyncedMsgs(p => ({ ...p, [msgIdx]: stats }));
  }

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
        system: `你係任務延伸助手。用戶完成咗一個任務，你建議 3 個自然嘅下一步延伸任務。業務線：${lineDescStr()}。任務名格式：動詞＋數字＋名詞，≤10 分鐘做完，用廣東話。淨係回覆 JSON array，唔好有任何其他文字：[{"line":"<line id>","title":"..."},{"line":"...","title":"..."},{"line":"...","title":"..."}]${ratingContext()}${extLogContext(k)}`,
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
        system: `你係 WIG（Wildly Important Goal）教練。根據用戶而家嘅 WIG 進度同業務狀態，建議 3 個新嘅短期 WIG。格式：「從 X 到 Y」或者明確可量度目標，用廣東話，每個 ≤20 字。業務線：${lineDescStr()}。淨係回覆 JSON array，唔好有任何其他文字：[{"label":"..."},{"label":"..."},{"label":"..."}]${ratingContext()}`,
        messages: [{ role: "user", content: `而家 WIG：${state.wigs.map(w => `${w.done ? "✓" : "○"}P${w.pri} ${w.label}`).join("；") || "（空）"}。今日業務完成率 ${rr.bizPct}%，主攻佔比 ${rr.focusShare}%。建議 3 個新 WIG。` }],
      });
      const arr = pickJSON(raw).filter(x => x && x.label).slice(0, 3);
      setWigSugs(arr);
      if (!arr.length) setWigSugErr("AI 無俾到建議 — 可以手動 ＋ WIG");
    } catch (e) { setWigSugErr("AI 建議失敗：" + String(e.message || e).slice(0, 90)); }
    setWigSugLoading(false);
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
      `業務完成率 ${r.bizPct}%（目標 85）｜已關 ${r.closed}/${r.denom}｜主攻佔比 ${r.focusShare}%（目標 ${cfg.budget.focusPct}）｜Skip ${r.skips}/${cfg.skipCap}｜影響分 ${r.impact}｜個人 ${r.perPct}%｜跟收 ${r.fuDone}/${r.fuAll}｜逾期未收 ${r.overdue}`,
      `WIG（現行 ${state.wigs.length}/6）：${state.wigs.map(w => `P${w.pri}${w.term} ${w.label}`).join("；") || "（未有 WIG，仲有位加）"}`,
      `🗺️ 36 個目標路線圖：${(state.roadmap || []).length}/${ROADMAP_GOAL}`,
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
          "優先次序邏輯：連紅任務最緊要處理（拆細或委派）；主攻佔比未達標就建議主攻線任務；逾期未收要追；Skip 爆 cap 係警號。",
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
    const list = state.tasks.filter(k => k.line === meta.id);
    const isFocus = meta.tier === "focus";
    let pool = isPersonal ? cfg.suggestions.personal : meta.gated ? (state.diamondInquiry ? cfg.suggestions.diamond_sales : cfg.suggestions.diamond_brand) : cfg.suggestions[meta.id] || [];
    pool = (pool || []).filter(t => !list.some(k => k.title === t));
    return (
      <section className="mt-5">
        <div className="flex items-center justify-between px-1">
          <SectionHeader color={isFocus ? C.pink : C.sub}>
            {meta.emoji} {meta.label}{isFocus ? ` · 主攻 ${cfg.budget.focusPct}%` : isPersonal ? " · 另計" : ""}
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
          <button onClick={() => { const f = { ...freshState(cfg), wigs: state.wigs, roadmap: state.roadmap, emailTo: state.emailTo, apiKey: state.apiKey, provider: state.provider, geminiKey: state.geminiKey, openaiKey: state.openaiKey, aiRatings: state.aiRatings, extLog: state.extLog, digestDate: state.digestDate }; setState(f); persist(f); }} className="text-xs font-semibold" style={{ color: C.red, background: "none", border: "none" }}>重設今日</button>
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

        {cfg.lines.map(l => <div key={l.id}>{Section({ lineId: l.id })}</div>)}
        {Section({ isPersonal: true })}
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
                HERMES AI <span style={{ color: C.pink }}>v15</span> · {new Date().toLocaleDateString("zh-HK", { month: "long", day: "numeric", weekday: "short" })}
                {storageOk === true && <span style={{ color: C.green }}> · ● 已同步</span>}
                {storageOk === false && <span style={{ color: C.red }}> · ⚠︎ 儲存離線</span>}
              </p>
              <h1 className="font-bold" style={{ color: C.body, fontSize: 30, letterSpacing: "-0.6px", lineHeight: 1.15 }}>{tab === "dash" ? "儀表板" : "今日"}</h1>
            </div>
            <span className="text-xs font-semibold rounded-full px-2.5 py-1" style={{ background: C.blueSoft, color: C.blue }}>衝刺 #{cfg.sprint.num} · {fmtMD(cfg.sprint.start)}–{fmtMD(cfg.sprint.end)}</span>
          </div>
        </div>
      </div>

      <div className="mx-auto px-4" style={{ maxWidth: 480, paddingBottom: `calc(${TAB_H}px + env(safe-area-inset-bottom, 0px) + 24px)` }}>
        {tab === "today" ? TodayView() : DashView()}
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
