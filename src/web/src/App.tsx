import { Fragment, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlignJustify,
  Bell,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  EyeOff,
  Lock,
  LayoutGrid,
  Loader2,
  Radar,
  RefreshCw,
  Search,
  ShieldBan,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  FolderOpen,
  Wrench,
  X,
  Zap,
  Code,
  CheckCheck,
  Flame,
  Newspaper,
  TrendingUp,
  MapPin,
  User,
  Globe2,
  Github,
  BookOpen,
  LogOut,
} from "lucide-react";
import { CompactRow, ItemCard, ItemDetailDrawer, QuickBlockModal } from "./components/ItemView.tsx";
import { AdminGate } from "./components/AdminGate.tsx";
import { ADMIN_AUTH_EVENT } from "./lib/auth.ts";
import {
  guestAddBlock,
  guestBatch,
  guestBlocks,
  guestPatch,
  importGuestToAccount,
  selectGuestItems,
  readGuest,
  useBootstrap,
  type GuestState,
} from "./lib/session.ts";
import { AuthModal } from "./components/AuthModal.tsx";
import { WelcomeModal } from "./components/WelcomeModal.tsx";
import { RssModal } from "./components/RssModal.tsx";
import { KIND_LABEL, KIND_ORDER, OBTAIN_HINT, OBTAIN_LABEL, SOURCE_GROUPS, categoriesForPreset, categoryLabelForPreset, channelExcluded, formatInterval, groupOfSource } from "./lib/sources.ts";

// 管理区 / 次要 Tab 的大面板按需加载：首屏只发资源流真正要用的代码
const DigestPanel = lazy(async () => ({ default: (await import("./components/DigestPanel.tsx")).DigestPanel }));
const HotPanel = lazy(async () => ({ default: (await import("./components/HotPanel.tsx")).HotPanel }));
const RulesPanel = lazy(async () => ({ default: (await import("./components/RulesPanel.tsx")).RulesPanel }));
const PushPanel = lazy(async () => ({ default: (await import("./components/PushPanel.tsx")).PushPanel }));
const AiPanel = lazy(async () => ({ default: (await import("./components/AiPanel.tsx")).AiPanel }));
const OpsPanel = lazy(async () => ({ default: (await import("./components/OpsPanel.tsx")).OpsPanel }));
const SiteAdminPanel = lazy(async () => ({ default: (await import("./components/SiteAdminPanel.tsx")).SiteAdminPanel }));
const UserPushPanel = lazy(async () => ({ default: (await import("./components/UserPushPanel.tsx")).UserPushPanel }));
import type {
  BlockPreset,
  BlockRule,
  HotReport,
  HotScope,
  Item,
  PushLogItem,
  AiPayload,
  PushPayload,
  PushPreview,
  PushSettings,
  Run,
  Source,
  Stats,
  Subscription,
} from "./types.ts";

const SOURCE_LABEL: Record<string, string> = {
  "linuxdo-welfare": "LINUX DO · 福利羊毛",
  "linuxdo-resource": "LINUX DO · 资源荟萃",
  "v2ex-free": "V2EX · 免费赠送",
  "github-free-for-dev": "GitHub · free-for-dev",
  "rss-fuliba": "福利吧",
  "rss-52pojie": "吾爱破解",
  "rss-smzdm": "什么值得买",
  "zhihu-search": "知乎 · 福利搜索",
  "xhs-search": "小红书 · 福利搜索",
  "xiaoheihe-search": "小黑盒 · 福利搜索",
  "tg-channels": "Telegram 频道",
  gamerpower: "GamerPower · 免费游戏",
  "epic-free": "Epic Games · 喜加一",
  "rss-reddit-freegames": "Reddit · FreeGameFindings",
  "rss-reddit-efreebies": "Reddit · eFreebies",
  "rss-reddit-gamedeals": "Reddit · GameDeals",
  "rss-slickdeals": "Slickdeals",
  "rss-heyitsfree": "HeyItsFree",
  "rss-keylol": "其乐 Keylol",
  "openrouter-free": "OpenRouter · 新免费大模型",
  "gamerpower-loot": "GamerPower · 免费礼包与 Key",
  "rss-itch-free": "itch.io · 100% 限免游戏",
  "rss-freesteamkeys": "FreeSteamKeys · Steam 限免",
  "rss-ghxi": "果核剥壳 · 免费软件",
};

let SOURCE_NAMES: Record<string, string> = { ...SOURCE_LABEL };
const sourceName = (id: string) => SOURCE_NAMES[id] ?? SOURCE_LABEL[id] ?? id;

type Tab = "feed" | "hot" | "digest" | "me" | "rules" | "push" | "ai" | "ops";

function useApi<T>(url: string | null, scope = ""): { data: T | null; loading: boolean; error: string | null; reload: () => void; update: (updater: (current: T | null) => T | null) => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(url));
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [loadedKey, setLoadedKey] = useState("");
  const key = (url ?? "") + ":" + scope;
  const update = useCallback((updater: (current: T | null) => T | null) => {
    setData(updater);
    setLoadedKey(key);
  }, [key]);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!url) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    const ac = new AbortController();
    setLoading(true);
    fetch(url, { signal: ac.signal, cache: nonce > 0 ? "no-cache" : "default" })
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({})) as { error?: string };
          throw new Error(body.error ?? `${r.status} ${r.statusText}`);
        }
        return (await r.json()) as T;
      })
      .then((d) => {
        if (!ac.signal.aborted) { setData(d); setLoadedKey(key); setError(null); }
      })
      .catch((e: unknown) => {
        if (ac.signal.aborted) return;
        setLoadedKey(key);
        setData(null);
        setError(String(e));
      })
      .finally(() => { if (!ac.signal.aborted) setLoading(false); });
    return () => ac.abort();
  }, [url, nonce, key]);

  return { data: url && loadedKey === key ? data : null, loading: Boolean(url) && (loading || loadedKey !== key), error, reload, update };
}

function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="status" aria-live="polite" className="toast-enter fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-lg border border-ink-800 bg-ink-950 px-3.5 py-2 text-[12.5px] font-medium text-white shadow-lg">
      <Bell size={14} className="text-ink-300" />
      {message}
    </div>
  );
}

type Preset = { key: string; label: string; icon: typeof Sparkles };

const PRIMARY_CHANNELS: Preset[] = [
  { key: "verified", label: "真福利", icon: Sparkles },
  { key: "free", label: "全部白嫖", icon: Zap },
  { key: "offline", label: "实物福利", icon: MapPin },
  { key: "opensource", label: "开源项目", icon: Code },
];

/**
 * 网盘/网课频道在公开演示站停用后，用这几行占位文案示意频道长什么样。
 * 全部是虚构条目，不含任何真实资源标题或链接——真实数据在后端就被过滤掉了。
 */
const PAN_DEMO_ROWS = [
  { title: "某编程实战课程合集 · 全 42 讲", meta: "TG · 网盘资源收藏 · 网盘资源", score: "82" },
  { title: "某设计素材包 · 字体/笔刷/模板", meta: "LINUX DO · 资源荟萃 · 网盘资源", score: "76" },
  { title: "某电子书套装 · PDF/EPUB 双格式", meta: "TG · 综合资源 · 网盘资源", score: "71" },
  { title: "某办公软件工具集 · 免安装版", meta: "TG · 网盘资源收藏 · 网盘资源", score: "68" },
  { title: "某考试真题汇总 · 含答案解析", meta: "LINUX DO · 资源荟萃 · 网课教程", score: "64" },
  { title: "某视频剪辑教程 · 素材+工程文件", meta: "TG · 综合资源 · 网课教程", score: "59" },
];

const SECONDARY_VIEWS: Preset[] = [
  { key: "codes", label: "含兑换码", icon: Zap },
  { key: "urgent", label: "今日截止", icon: Bell },
  { key: "starred", label: "我的收藏", icon: Check },
  { key: "all", label: "全部收录", icon: AlignJustify },
  { key: "hidden", label: "已关闭", icon: EyeOff },
];

const PRESETS: Preset[] = [...PRIMARY_CHANNELS, ...SECONDARY_VIEWS];


// 主仓库地址：顶栏 GitHub 图标跳这里
const REPO_URL = "https://github.com/ZiChuanLan/freebie-radar";
// 移动端顶栏图标按钮统一尺寸，5 个并排也不挤
const ICON_BTN =
  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-ink-200 bg-surface text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-950";
// 公开区：任何人不登录就能看。其余全部归管理区。
const PUBLIC_TABS = new Set<Tab>(["feed", "digest"]);
const ADMIN_TABS = new Set<Tab>(["rules", "push", "ai", "ops"]);

export function App() {
  const initialTab = (): Tab => {
    if (typeof location === "undefined") return "feed";
    const h = location.hash.replace("#", "");
    return h === "hot" || h === "digest" || h === "me" || h === "rules" || h === "push" || h === "ai" || h === "ops"
      ? (h as Tab)
      : "feed";
  };

  const [tab, setTab] = useState<Tab>(initialTab);
  const [detail, setDetail] = useState<Item | null>(null);
  const [quickBlock, setQuickBlock] = useState<Item | null>(null);
  // 合并组展开：记录展开的条目 id 与其同福利的其他来源
  const [relatedOpen, setRelatedOpen] = useState<number | null>(null);
  const [relatedMap, setRelatedMap] = useState<Record<number, (Item & { sourceName?: string })[]>>({});
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const mobileNavRef = useRef<HTMLElement | null>(null);
  // 展开合并组时按需拉取其他来源报道（同一 title_key 的兄弟条目）
  useEffect(() => {
    const id = relatedOpen;
    if (!id || relatedMap[id]) return;
    let alive = true;
    fetch(`/api/items/${id}/related`, { headers: { accept: "application/json" } })
      .then((r) => { if (!r.ok) throw new Error("关联来源加载失败"); return r.json(); })
      .then((d: { items?: (Item & { sourceName?: string })[] }) => {
        if (alive && Array.isArray(d.items)) setRelatedMap((m) => ({ ...m, [id]: d.items! }));
      })
      .catch(() => {
        if (alive) { setRelatedOpen(null); setToast("关联来源加载失败，请稍后重试"); }
      });
    return () => { alive = false; };
    return () => {
      alive = false;
    };
  }, [relatedOpen, relatedMap]);
  // 服务端是否启用管理密码（决定是否拦截管理区）
  const [authChecked, setAuthChecked] = useState(false);
  const [protectedMode, setProtectedMode] = useState(false);
  const [adminEntryAllowed, setAdminEntryAllowed] = useState(true);
  const [adminAuthed, setAdminAuthed] = useState(false);
  useEffect(() => {
    fetch("/api/auth/check")
      .then((r) => r.json())
      .then((j: { protected?: boolean; isAdmin?: boolean; adminHostAllowed?: boolean }) => {
        const prot = Boolean(j.protected);
        setProtectedMode(prot);
        setAdminAuthed(Boolean(j.isAdmin));
        setAdminEntryAllowed(j.adminHostAllowed !== false);
      })
      .catch(() => undefined)
      .finally(() => setAuthChecked(true));
  }, []);
  const adminReady = authChecked && adminAuthed;

  const boot = useBootstrap();
  const bootData = boot.data;
  useEffect(() => { boot.reload(); }, [adminAuthed, boot.reload]);
  useEffect(() => {
    const expire = () => setAdminAuthed(false);
    window.addEventListener(ADMIN_AUTH_EVENT, expire);
    return () => window.removeEventListener(ADMIN_AUTH_EVENT, expire);
  }, []);
  const me = bootData?.user ?? null;
  useEffect(() => {
    const nav = mobileNavRef.current;
    if (!nav || window.matchMedia("(min-width: 1024px)").matches) return;
    const selected = nav.querySelector<HTMLElement>(`[data-tab="${tab}"]`);
    if (!selected) return;
    const bounds = nav.getBoundingClientRect(), item = selected.getBoundingClientRect();
    if (item.left < bounds.left) nav.scrollLeft -= bounds.left - item.left;
    else if (item.right > bounds.right) nav.scrollLeft += item.right - bounds.right;
  }, [tab, me?.id, adminReady]);
  const isPublicSite = bootData?.siteMode === "public";
  const [authOpen, setAuthOpen] = useState(false);
  const [authHash, setAuthHash] = useState<string | null>(null);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [rssOpen, setRssOpen] = useState(false);
  const [guest, setGuest] = useState<GuestState>(() => readGuest());

  // 公开站未登录时，个人状态全部落 localStorage；登录后用 /api/me/* 云同步
  const guestMode = isPublicSite && !me;
  const syncGuest = useCallback(() => setGuest(readGuest()), []);

  // 入站公告：按 version 记一次，站长改内容后自增版本号即可重新弹出
  useEffect(() => {
    if (!bootData?.onboarding?.enabled) return;
    const key = "radar_onboarding_seen_v" + bootData.onboarding.version;
    try {
      if (!localStorage.getItem(key)) setWelcomeOpen(true);
    } catch {
      /* 隐私模式下每次都会弹，可以接受 */
    }
  }, [bootData?.onboarding?.enabled, bootData?.onboarding?.version]);

  // OAuth 回跳带 #invite-required / #login-* 时自动开登录弹窗并显示对应错误
  useEffect(() => {
    const h = location.hash.replace("#", "");
    if (!h) return;
    if (h === "invite-required" || h.startsWith("login-") || h.startsWith("register-") || h === "invite-invalid" || h === "quota-full") {
      setAuthHash(h);
      setAuthOpen(true);
    }
  }, []);

  const closeWelcome = useCallback(() => {
    setWelcomeOpen(false);
    if (bootData?.onboarding) {
      try {
        localStorage.setItem("radar_onboarding_seen_v" + bootData.onboarding.version, "1");
      } catch {
        /* ignore */
      }
    }
  }, [bootData?.onboarding]);

  const logout = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) { setToast("退出失败，请重试"); return; }
      setTab("feed");
      setDetail(null);
      boot.reload();
    } catch { setToast("网络异常，退出未完成，请重试"); }
  }, [boot]);

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [source, setSource] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [catOpen, setCatOpen] = useState(false);
  const catRef = useRef<HTMLDivElement | null>(null);
  const [lang, setLang] = useState<"all" | "zh" | "en">("all");
  const [sort, setSort] = useState("newest");
  const [range, setRange] = useState("auto");
  const [priceCap, setPriceCap] = useState("auto");
  const [minScore, setMinScore] = useState("all");
  const [obtain, setObtain] = useState("auto");
  const [kindFilter, setKindFilter] = useState("auto");
  const [preset, setPreset] = useState("verified");
  const [viewMode, setViewMode] = useState<"compact" | "grid2" | "grid3">(() => {
    if (typeof localStorage === "undefined") return "compact";
    const saved = localStorage.getItem("radar_view_mode");
    return saved === "grid2" || saved === "grid3" || saved === "compact" ? saved : "compact";
  });
  const [showRowSummary, setShowRowSummary] = useState(() => {
    try { return localStorage.getItem("radar_row_summary") === "true"; } catch { return false; }
  });
  const toggleRowSummary = () => {
    setShowRowSummary((current) => {
      const next = !current;
      try { localStorage.setItem("radar_row_summary", String(next)); } catch { /* optional preference */ }
      return next;
    });
  };
  const updateViewMode = useCallback((m: "compact" | "grid2" | "grid3") => {
    setViewMode(m);
    try {
      localStorage.setItem("radar_view_mode", m);
    } catch {
      /* ignore */
    }
  }, []);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [showAllSources, setShowAllSources] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  /** 移动端：顶部筛选面板（含快捷视图、数据源与筛选条）展开态 */
  const [mobileFilterBar, setMobileFilterBar] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState(false);
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onSlash = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (e.target as HTMLElement | null)?.isContentEditable) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onSlash);
    return () => window.removeEventListener("keydown", onSlash);
  }, []);
  const notify = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1900);
  }, []);

  const copyCode = useCallback(
    (code: string) => {
      void navigator.clipboard?.writeText(code);
      notify("已复制兑换码 " + code);
    },
    [notify],
  );

  useEffect(() => {
    if (typeof location === "undefined") return;
    if (tab === "feed") history.replaceState(null, "", location.pathname + location.search);
    else history.replaceState(null, "", "#" + tab);
  }, [tab]);

  useEffect(() => {
    const onHash = () => {
      const h = location.hash.replace("#", "");
      setTab(h === "hot" || h === "digest" || h === "me" || h === "rules" || h === "push" || h === "ai" || h === "ops" ? (h as Tab) : "feed");
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (typeof location === "undefined") return;
    const sp = new URLSearchParams(location.search);
    const site = sp.get("login_ok");
    if (!site) return;
    sp.delete("login_ok");
    const nextSearch = sp.toString();
    history.replaceState(null, "", location.pathname + (nextSearch ? "?" + nextSearch : "") + "#ops");
    setTab("ops");
    notify(`已完成 ${site} 登录并回传公开福利（Cookie 仅留本机）`);
  }, [notify]);

  const [, bumpNames] = useState(0);
  useEffect(() => {
    fetch("/api/sources")
      .then((r) => r.json())
      .then((d: { sources: { id: string; name: string }[] }) => {
        const m: Record<string, string> = { ...SOURCE_LABEL };
        for (const s of d.sources) if (s.name) m[s.id] = s.name;
        SOURCE_NAMES = m;
        bumpNames((n) => n + 1);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!catOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (catRef.current && !catRef.current.contains(e.target as Node)) setCatOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [catOpen]);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    p.set("preset", preset);
    if (debounced) p.set("search", debounced);
    if (source) p.set("source", source);
    if (categories.length) p.set("category", categories.join(","));
    if (lang !== "all") p.set("lang", lang);
    if (sort) p.set("sort", sort);

    if (preset === "verified") {
      p.set("unexpired", "1");
      p.set("aiOnly", "1");
      if (kindFilter === "auto") p.set("kind", "freebie");
      if (obtain === "auto") p.set("obtain", "free,conditional");
      if (range === "auto") p.set("maxAgeDays", "7");
      // 网盘资源与网课教程属于长期资料型内容，单独成频道，不混进「真福利」
      const excludedCats = channelExcluded("verified");
      if (categories.length === 0 && excludedCats.length) p.set("excludeCategory", excludedCats.join(","));
    } else if (preset === "free") {
            p.set("unexpired", "1");
            p.set("hideRejected", "1");
            if (kindFilter === "auto") p.set("kind", "freebie");
            if (obtain === "auto") p.set("obtain", "free,conditional");
    } else if (preset === "offline") {
      // 实物福利独立频道：线下/门店/现场领取，不混进真福利
      p.set("unexpired", "1");
      p.set("hideRejected", "1");
      if (categories.length === 0) p.set("category", "offline");
    } else if (preset === "pan") {
      p.set("unexpired", "1");
      if (kindFilter === "auto") p.set("kind", "freebie,deal,info,opensource,news");
      if (categories.length === 0) p.set("category", "pan,course");
      p.set("hideRejected", "1");
    } else if (preset === "deal") {
      p.set("unexpired", "1");
      if (kindFilter === "auto") p.set("kind", "deal");
      p.set("hideRejected", "1");
    } else if (preset === "opensource") {
      if (kindFilter === "auto") p.set("kind", "opensource");
      p.set("hideRejected", "1");
    } else if (preset === "news") {
      if (kindFilter === "auto") p.set("kind", "news");
      p.set("hideRejected", "1");
    } else if (preset === "info") {
      if (kindFilter === "auto") p.set("kind", "info");
      p.set("hideRejected", "1");
    } else if (preset === "codes") {
      p.set("unexpired", "1");
      p.set("hasCodes", "1");
    } else if (preset === "urgent") {
      p.set("expiring", "1");
    } else if (preset === "starred") {
      p.set("starred", "1");
    } else if (preset === "hidden") {
      p.set("status", "ignored");
    }
    if (preset === "all") p.set("hideRejected", "1");

    if (kindFilter === "all") p.set("kind", "");
    else if (kindFilter !== "auto") p.set("kind", kindFilter);

    if (priceCap === "free") p.set("freeOnly", "1");
    else if (priceCap !== "auto" && priceCap !== "all") p.set("maxPrice", priceCap);

    if (obtain === "all") p.set("obtain", "");
    else if (obtain !== "auto" && obtain) p.set("obtain", obtain);
    if (minScore !== "all") p.set("minScore", minScore);
    if (unreadOnly) p.set("unread", "1");

    const DAYS: Record<string, number> = { "1d": 1, "3d": 3, "7d": 7, "30d": 30 };
    const days = DAYS[range];
    if (days) p.set("since", new Date(Date.now() - days * 86_400_000).toISOString());
    p.set("limit", "100");
    return p.toString();
  }, [debounced, source, categories, lang, sort, range, priceCap, preset, kindFilter, obtain, minScore, unreadOnly]);

  const statsQuery = useMemo(() => {
    const p = new URLSearchParams(query);
    p.delete("category");
    p.delete("sort");
    p.delete("limit");
    return p.toString();
  }, [query]);

  const switchPreset = useCallback((nextKey: string) => {
    setPreset(nextKey);
    setKindFilter("auto");
    setObtain("auto");
    setPriceCap("auto");
    setCategories((cur) => {
      const allowed = new Set(categoriesForPreset(nextKey));
      return cur.filter((c) => allowed.has(c));
    });
  }, []);

  const activeFilterCount =
    [
      source,
      categories.length > 0,
      lang !== "all",
      debounced,
      minScore !== "all",
      unreadOnly,
      kindFilter !== "auto",
      priceCap !== "auto",
      obtain !== "auto",
      range !== "auto",
      sort !== "newest",
    ].filter(Boolean).length;

  const resetFilters = useCallback(() => {
    setSource("");
    setCategories([]);
    setLang("all");
    setSearch("");
    setDebounced("");
    setMinScore("all");
    setUnreadOnly(false);
    setKindFilter("auto");
    setPriceCap("auto");
    setObtain("auto");
    setRange("auto");
    setSort("newest");
  }, []);
  const identityScope = `${me?.id ?? "guest"}:${adminReady}`;
  const stats = useApi<Stats>(statsQuery ? `/api/stats?${statsQuery}` : "/api/stats", identityScope);
  const guestIds = guestMode && (preset === "starred" || preset === "hidden")
    ? `&ids=${(preset === "starred" ? guest.starred : guest.hidden).slice(0, 100).join(",") || "0"}` : "";
  const items = useApi<{ total: number; items: Item[] }>(`/api/items?${query}${guestIds}`, identityScope);
  // 公开站登录用户读写的是自己的订阅与屏蔽词；自建站与管理区沿用全局接口
  const rulesBase = adminReady ? "/api" : isPublicSite && me ? "/api/me" : null;
  // 推送规则同样分两套：站长改全局，登录用户改自己的（同一套面板，只是接口不同）
  const pushBase = adminReady ? "/api/push" : isPublicSite && me ? "/api/me/push" : null;
  const subs = useApi<{ subscriptions: Subscription[] }>(rulesBase ? rulesBase + "/subscriptions" : null, identityScope);
  const sources = useApi<{ sources: Source[] }>("/api/sources", identityScope);
  const runs = useApi<{ runs: Run[] }>(adminReady ? "/api/runs?limit=40" : null);
  const blockRules = useApi<{ rules: BlockRule[]; totalBlocked: number; presets: BlockPreset[] }>(
    rulesBase ? rulesBase + "/block-rules" : null,
    identityScope,
  );
  const digests = useApi<{ digests: { date: string; created_at: string; pushed_at: string | null; kind: string; count: number }[] }>(
    "/api/digests",
  );
  const [hotHours, setHotHours] = useState(24);
  const [hotScope, setHotScope] = useState<HotScope>("all");
  const hot = useApi<HotReport>(tab === "hot" ? `/api/hot?hours=${hotHours}&scope=${hotScope}` : null);
  // 管理接口只在就绪后请求，避免公开区刷出一堆 401，也避免无密码模式卡住加载
  const push = useApi<PushPayload>(pushBase, identityScope);
  const ai = useApi<AiPayload>(adminReady && tab === "ai" ? "/api/ai" : null);
  const pushLogs = useApi<{ logs: PushLogItem[] }>(pushBase && tab === "push" ? pushBase + "/log?limit=40" : null, identityScope);
  const [pushPreview, setPushPreview] = useState<PushPreview | null>(null);
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const activeDate = pickedDate ?? digests.data?.digests?.[0]?.date ?? null;
  const digestDetail = useApi<{
    date: string;
    text: string;
    count: number;
    created_at: string;
    pushed_at: string | null;
    items: Item[];
  }>(activeDate && tab === "digest" ? "/api/digests/" + activeDate : null);

  const [blockedPreview, setBlockedPreview] = useState<Item[] | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailNonce, setDetailNonce] = useState(0);
  useEffect(() => {
    setDetail(null); setRelatedOpen(null); setRelatedMap({}); setPushPreview(null); setBlockedPreview(null);
  }, [identityScope]);
  const detailId = detail?.id;
  useEffect(() => {
    if (!detailId) return;
    const ac = new AbortController();
    setDetailLoading(true); setDetailError(null);
    fetch(`/api/items/${detailId}`, { signal: ac.signal }).then(async (res) => {
      if (!res.ok) throw new Error("详情加载失败，请重试");
      return await res.json() as Item;
    }).then((full) => {
      if (!ac.signal.aborted) setDetail((current) => current?.id === detailId ? { ...current, ...full } : current);
    }).catch((err: unknown) => { if (!ac.signal.aborted) setDetailError(String(err)); })
      .finally(() => { if (!ac.signal.aborted) setDetailLoading(false); });
    return () => ac.abort();
  }, [detailId, detailNonce]);

  const patch = useCallback(
    async (id: number, body: Record<string, unknown>) => {
      if (!bootData) { notify("站点配置加载中，请稍后重试"); return; }
      // 公开站未登录：只改本机 localStorage，不发请求，谁也不影响
      if (guestMode) {
        guestPatch(id, body as { starred?: boolean; read?: boolean; status?: string });
        syncGuest();
        if (detail && detail.id === id) {
          const next = readGuest();
          setDetail({
            ...detail,
            starred: next.starred.includes(id),
            read: next.read.includes(id),
          });
        }
        return;
      }
      const url = isPublicSite ? `/api/me/items/${id}` : `/api/items/${id}`;
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        notify(err.error ?? "操作失败");
        return;
      }
      items.reload();
      stats.reload();
      if (detail && detail.id === id) {
        const next = await fetch(`/api/items/${id}`).then((r) => r.json());
        setDetail((current) => current?.id === id ? next as Item : current);
      }
    },
    [items, stats, detail, guestMode, isPublicSite, syncGuest, notify, bootData],
  );

  const addRule = useCallback(
    async (pattern: string, mode: "keyword" | "regex", scope: string) => {
      // 公开站：登录用户写自己的规则，访客写本机 localStorage
      if (guestMode) {
        guestAddBlock(pattern);
        syncGuest();
        notify("已在本机屏蔽「" + pattern + "」");
        items.reload();
        return;
      }
      const ruleUrl = rulesBase + "/block-rules";
      const res = await fetch(ruleUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pattern, mode, scope }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        notify(err.error ?? "添加失败");
        throw new Error(err.error ?? "添加失败");
      }
      notify("已屏蔽「" + pattern + "」");
      blockRules.reload();
      items.reload();
      stats.reload();
      setBlockedPreview(null);
      setRelatedMap({});
    },
    [blockRules, items, stats, notify, guestMode, rulesBase, syncGuest],
  );

  const quickBlockAdd = useCallback(
    async (pattern: string, scope: string) => {
      await addRule(pattern, "keyword", scope);
    },
    [addRule],
  );

  const addSubscription = useCallback(
    async (kw: string) => {
      if (guestMode) {
        notify("登录后才能订阅关键词（访客偏好只存在本机）");
        return;
      }
      const res = await fetch(rulesBase + "/subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ keyword: kw }),
      });
      if (!res.ok) { notify(((await res.json()) as { error?: string }).error ?? "订阅失败"); throw new Error("订阅失败"); }
      subs.reload();
      items.reload();
      notify("已订阅「" + kw + "」");
    },
    [subs, items, notify, guestMode, rulesBase],
  );

  const removeSubscription = useCallback(
    async (id: number) => {
      const res = await fetch(rulesBase + "/subscriptions/" + id, { method: "DELETE" });
      if (!res.ok) { notify("删除关注词失败"); return; }
      subs.reload();
      items.reload();
    },
    [subs, items, rulesBase, notify],
  );

  const refreshAll = useCallback(() => {
    items.reload();
    stats.reload();
    sources.reload();
    runs.reload();
    blockRules.reload();
    setRelatedMap({});
  }, [items, stats, sources, runs, blockRules]);

  const markVisibleRead = useCallback(async () => {
    const page = guestMode ? selectGuestItems(items.data?.items ?? [], guest, preset, unreadOnly) : items.data?.items ?? [];
    const unreadIds = page.filter((i) => !i.read).map((i) => i.id);
    if (!unreadIds.length) return;
    if (guestMode) {
      guestBatch(unreadIds, "read");
      syncGuest();
      notify(`已在本机把 ${unreadIds.length} 条标为已读`);
      return;
    }
    const res = await fetch(isPublicSite ? "/api/me/items/batch" : "/api/items/batch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: unreadIds, action: "read" }),
    });
    if (!res.ok) { notify("标记已读失败，请重试"); return; }
    notify(`已将本页 ${unreadIds.length} 条标为已读`);
    items.reload();
    stats.reload();
  }, [items, stats, notify, guestMode, isPublicSite, syncGuest, guest, preset, unreadOnly]);

// 访客本地隐藏 / 收藏 / 已读与本地屏蔽词在客户端生效；登录用户由服务端按 user_item_states 过滤
  const visible = guestMode ? selectGuestItems(items.data?.items ?? [], guest, preset, unreadOnly) : items.data?.items ?? [];
  const currentIndex = detail ? visible.findIndex((i) => i.id === detail.id) : -1;

  const enabledSources = (sources.data?.sources ?? []).filter((s) => s.enabled || showAllSources);
  const grouped = SOURCE_GROUPS.map((g) => ({
    ...g,
    sources: enabledSources.filter((s) => groupOfSource(s) === g.key),
  })).filter((g) => g.sources.length > 0);

  // 公开区显示「资源流 / 今日热点 / 每日精选」，其余 Tab 只有进管理区后才出现
  const tabs: { key: Tab | "admin"; label: string; icon: typeof Activity; badge?: number }[] = [
    { key: "feed", label: "资源流", icon: Activity },
    { key: "hot", label: "今日热点", icon: Flame },
    { key: "digest", label: "每日精选", icon: Radar },
    ...(me ? [{ key: "me" as Tab, label: "我的", icon: User }] : []),
    ...(!adminReady && me
      ? [
          { key: "rules" as Tab, label: "我的订阅与屏蔽", icon: ShieldBan, badge: stats.data?.totals.blockRules },
          { key: "push" as Tab, label: "我的推送规则", icon: Zap, badge: push.data?.stats.queued },
        ]
      : []),
    ...(adminReady
      ? [
          { key: "rules" as Tab, label: "订阅与屏蔽", icon: ShieldBan, badge: stats.data?.totals.blockRules },
          { key: "push" as Tab, label: "推送规则", icon: Zap, badge: push.data?.stats.queued },
          { key: "ai" as Tab, label: "AI 引擎", icon: Bot },
          { key: "ops" as Tab, label: "数据源运维", icon: Wrench },
        ]
      : [{ key: "admin" as const, label: "管理区", icon: Lock }]),
  ];

  const handleTab = (key: Tab | "admin") => {
    if (key === "admin") {
      setTab("admin" as Tab);
      return;
    }
    setTab(key);
  };


  const exportUrl = "/api/export?format=md&" + query.replace(/limit=\d+/, "limit=300");


  // 说明/RSS 入口：桌面侧栏与移动端品牌行共用同一份按钮，避免复制两份标记
  const helpRssNode = (
    <>
      <button
        type="button"
        onClick={() => setWelcomeOpen(true)}
        className={ICON_BTN}
        title="站点说明与使用提示"
      >
        <BookOpen size={14} />
      </button>
      <button
        type="button"
        onClick={() => setRssOpen(true)}
        className={ICON_BTN}
        title="RSS 订阅地址"
      >
        <Globe2 size={14} />
      </button>
    </>
  );

  // 主仓库入口：GitHub 图标，移动端品牌行与桌面侧栏都用它
  const githubNode = (
    <a
      href={REPO_URL}
      target="_blank"
      rel="noreferrer"
      className={ICON_BTN}
      title="主仓库 · GitHub"
      aria-label="GitHub 主仓库"
    >
      <Github size={14} />
    </a>
  );

  // 账号态：移动端放进导航行右侧，桌面端留在侧栏第二行
  const accountNode = me ? (
    <div className="flex min-w-0 items-center gap-1">
      <button type="button" onClick={() => setTab("me")} aria-label="打开个人中心" title="个人中心与推送渠道" className="flex min-w-0 items-center gap-1 rounded hover:bg-ink-100">
      {me.avatarUrl ? (
        <img src={me.avatarUrl} alt="" className="h-6 w-6 shrink-0 rounded-full border border-ink-200" />
      ) : (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink-100 text-[10px] font-semibold text-ink-600">
          {(me.name ?? me.username).slice(0, 1).toUpperCase()}
        </span>
      )}
      <span
        className="hidden min-w-0 truncate text-[11.5px] font-medium text-ink-800 sm:inline"
        title={`${me.name ?? me.username} · ${me.linuxdoId < 0 ? "GitHub" : `LINUX DO 信任等级 ${me.trustLevel}`}`}
      >
        {me.name ?? me.username}
      </span>
      </button>
      <button
        type="button"
        onClick={() => void logout()}
        className="shrink-0 rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-900"
        title="退出登录"
      >
        <LogOut size={12} />
      </button>
    </div>
  ) : bootData?.loginEnabled ? (
    <button
      type="button"
      onClick={() => {
        setAuthHash(null);
        setAuthOpen(true);
      }}
      className="inline-flex shrink-0 items-center gap-1 rounded-md bg-ink-950 px-2 py-1 text-[11.5px] font-medium whitespace-nowrap text-white hover:bg-brand-hover"
      title="用 LINUX DO 登录"
    >
      <User size={12} /> 登录
    </button>
  ) : null;

  // 快捷视图 + 数据源树：桌面在侧栏常驻，移动端折进「筛选」面板里
  const sourcePanelNode = (
    <>
      <div className="pt-1">
        <div className="mb-1.5 flex items-center justify-between px-2">
          <span className="text-[11px] font-medium text-ink-400">快捷视图</span>
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-0.5 text-[11px] font-medium text-accent hover:underline"
              title="清除全部筛选条件"
            >
              <RotateCcw size={10} /> 清除 {activeFilterCount}
            </button>
          )}
        </div>
        <div className="space-y-0.5">
          {SECONDARY_VIEWS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => switchPreset(p.key)}
              className={
                "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12.5px] transition-colors " +
                (preset === p.key
                  ? "bg-canvas-subtle font-semibold text-ink-950"
                  : "font-medium text-ink-600 hover:bg-canvas-subtle/60 hover:text-ink-950")
              }
            >
              <p.icon size={13} className={preset === p.key ? "text-accent" : "text-ink-400"} />
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-ink-200 pt-3">
        <div className="mb-1.5 flex items-center justify-between px-2">
          <span className="text-[11px] font-medium text-ink-400">数据源</span>
          <button
            type="button"
            onClick={() => setShowAllSources((v) => !v)}
            className="text-[11px] text-ink-400 hover:text-ink-700"
          >
            {showAllSources ? "隐藏禁用" : "显示全部"}
          </button>
        </div>
        <button
          type="button"
          onClick={() => setSource("")}
          className={
            "mb-1 w-full rounded-md px-2.5 py-1 text-left text-[12px] transition-colors " +
            (source === ""
              ? "bg-canvas-subtle font-semibold text-ink-950"
              : "font-medium text-ink-600 hover:bg-canvas-subtle/60")
          }
        >
          全部来源
        </button>
        {grouped.map((g) => {
          const collapsed = collapsedGroups[g.key] ?? !g.sources.some((s) => s.id === source);
          const total = g.sources.reduce((n, s) => n + s.items, 0);
          return (
            <div key={g.key} className="mb-1">
              <button
                type="button"
                aria-expanded={!collapsed}
                onClick={() => setCollapsedGroups((m) => ({ ...m, [g.key]: !m[g.key] }))}
                className="flex w-full items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-ink-400 hover:text-ink-700"
              >
                {collapsed ? <ChevronRight size={10} /> : <ChevronDown size={10} />}
                <span className="flex-1 text-left">{g.label}</span>
                <span className="font-mono tabular-nums">{total}</span>
              </button>
              {!collapsed && (
                <div className="space-y-0.5">
                  {g.sources.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSource(s.id === source ? "" : s.id)}
                      className={
                        "flex w-full items-center justify-between rounded-md px-2.5 py-1 text-left text-[12px] transition-colors " +
                        (source === s.id
                          ? "bg-canvas-subtle font-semibold text-ink-950"
                          : "text-ink-600 hover:bg-canvas-subtle/60") +
                        (s.enabled ? "" : " opacity-45")
                      }
                      title={s.id + " · 采集周期 " + formatInterval(s.interval_sec)}
                    >
                      <span className="truncate">{s.name}</span>
                      <span className="ml-1.5 shrink-0 font-mono text-[11px] tabular-nums text-ink-400">{s.items}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );

  return (
    <div className="workspace-shell flex min-h-screen flex-col bg-surface lg:flex-row">
      {/* 左侧连续导轨（移动端为顶部收拢区） */}
      <aside className="workspace-rail w-full shrink-0 border-b border-ink-200 bg-canvas/70 px-3.5 py-3 lg:flex lg:w-[240px] lg:flex-col lg:gap-4 lg:border-r lg:border-b-0 lg:bg-canvas lg:px-3 lg:py-4">
        {/* 品牌行：说明/RSS/GitHub/导出/刷新 全部收进这一行，省掉整条第二栏 */}
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
            <h1 className="text-[14.5px] font-semibold tracking-tight text-ink-950">资源雷达</h1>
          </div>
          <span className="hidden font-mono text-[11px] tabular-nums text-ink-400 lg:inline">
            {stats.data?.totals.aiKept ?? "—"} 精选
          </span>
          <div className="flex items-center gap-1 lg:hidden">
            {helpRssNode}
            {githubNode}
            {tab === "feed" && <a href={exportUrl} className={ICON_BTN} title="按当前筛选导出 Markdown">
              <Download size={14} />
            </a>}
            <button type="button" onClick={refreshAll} className={ICON_BTN} title="刷新数据">
              <RefreshCw size={14} className={items.loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* 桌面侧栏第二行：说明/RSS + 账号；移动端这两个入口已分别并入品牌行与导航行 */}
        <div className="mt-2 hidden items-center gap-1 px-1 lg:mt-0 lg:flex">
          {helpRssNode}
          {githubNode}
          <div className="ml-auto min-w-0">{accountNode}</div>
        </div>

        {isPublicSite && (guest.hidden.length > 0 || guest.starred.length > 0 || guest.read.length > 0 || guest.blocked.length > 0) && (
          <div className="mt-2 rounded-md border border-ink-200 bg-surface-hover px-2.5 py-1.5 text-[11px] leading-relaxed text-ink-600">
            本机偏好：收藏 {guest.starred.length} · 已读 {guest.read.length} · 已关闭 {guest.hidden.length}
            {bootData?.loginEnabled && (
              <button
                type="button"
                onClick={async () => {
                  if (!me) { setAuthOpen(true); return; }
                  const r = await importGuestToAccount(guest);
                  if (r.ok) {
                    notify(`已合并 ${r.imported} 条偏好到账号`);
                    syncGuest();
                    items.reload();
                    stats.reload();
                    blockRules.reload();
                  } else {
                    notify(r.error ?? "合并失败");
                  }
                }}
                className="ml-1 font-medium text-accent hover:underline"
              >
                {me ? "合并到当前账号" : "登录后合并"}
              </button>
            )}
          </div>
        )}
        {/* 搜索框（/ 快捷键聚焦） */}
        <div className="relative mt-2.5 lg:mt-0">
          <Search size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-400" />
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                if (search) {
                  setSearch("");
                  setDebounced("");
                } else {
                  e.currentTarget.blur();
                }
              }
            }}
            placeholder="搜索福利、兑换码…"
            className="h-8 w-full rounded-md border border-ink-200 bg-surface pr-8 pl-8 text-[12.5px] text-ink-950 transition-colors outline-none placeholder:text-ink-400 focus:border-accent"
          />
          {search ? (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setDebounced("");
              }}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
              title="清空搜索"
            >
              <X size={12} />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 rounded border border-ink-200 bg-canvas px-1.5 py-0.5 font-mono text-[10.5px] text-ink-400 lg:inline">
              /
            </kbd>
          )}
        </div>

        {/* 导航：手机横向可滚 + 右侧账号，桌面纵列无边框 */}
        <div className="-mx-3.5 mt-2.5 flex items-center gap-1.5 px-3.5 pb-0.5 lg:mx-0 lg:mt-0 lg:block lg:px-0 lg:pb-0">
          <nav ref={mobileNavRef} aria-label="页面导航" className="no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto lg:block lg:flex-none lg:space-y-0.5 lg:overflow-visible">
          {tabs.slice(0, 3).map((t) => (
            <button
              key={t.key}
              type="button"
              data-tab={t.key}
              aria-label={t.label}
              aria-current={tab === t.key ? "page" : undefined}
              onClick={() => handleTab(t.key)}
              className={
                "flex shrink-0 items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors lg:w-full " +
                (tab === t.key
                  ? "bg-ink-950 text-white lg:bg-canvas-subtle lg:font-semibold lg:text-ink-950"
                  : "text-ink-600 hover:bg-canvas-subtle/70 hover:text-ink-950")
              }
            >
              <span className="flex items-center gap-2">
                <t.icon size={14} className={tab === t.key ? "lg:text-accent" : "text-ink-400"} />
                {t.label}
              </span>
              {t.key === "feed" && (stats.data?.totals.unread ?? 0) > 0 && (
                <span
                  className={
                    "hidden font-mono text-[11px] tabular-nums lg:inline " +
                    (tab === t.key ? "text-ink-600" : "text-ink-400")
                  }
                >
                  {stats.data?.totals.unread}
                </span>
              )}
            </button>
          ))}
          <div className="mx-1 h-4 w-px shrink-0 self-center bg-ink-200 lg:hidden" />
          <div className="hidden px-2.5 pt-3 pb-1 text-[11px] font-medium text-ink-400 lg:block">
            {adminReady ? "管理" : me ? "个人空间" : "管理"}
          </div>
          {tabs.slice(3).map((t) => (
            <button
              key={t.key}
              type="button"
              data-tab={t.key}
              aria-label={t.label}
              aria-current={tab === t.key ? "page" : undefined}
              onClick={() => handleTab(t.key)}
              className={
                "flex shrink-0 items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors lg:w-full " +
                (tab === t.key
                  ? "bg-ink-950 text-white lg:bg-canvas-subtle lg:font-semibold lg:text-ink-950"
                  : "text-ink-600 hover:bg-canvas-subtle/70 hover:text-ink-950")
              }
            >
              <span className="flex items-center gap-2">
                <t.icon size={14} className={tab === t.key ? "lg:text-accent" : "text-ink-400"} />
                {t.label}
              </span>
              {typeof t.badge === "number" && t.badge > 0 && (
                <span
                  className={
                    "rounded px-1.5 py-0.5 font-mono text-[11px] tabular-nums " +
                    (tab === t.key
                      ? "bg-white/20 text-white lg:bg-surface lg:text-ink-700"
                      : "bg-ink-200/80 text-ink-600")
                  }
                >
                  {t.badge}
                </span>
              )}
            </button>
          ))}
          </nav>
          {/* 移动端账号入口：贴着导航右侧，不单独占一行 */}
          <div className="shrink-0 lg:hidden">{accountNode}</div>
        </div>
        {/* 场景预设 & 数据源：桌面侧栏常驻，移动端折进主区「筛选」面板 */}
        {tab === "feed" && (
          <div className="mt-3 hidden lg:mt-0 lg:block">
            <div className="space-y-4">{sourcePanelNode}</div>
          </div>
        )}
      </aside>

      {/* 右侧纯白主工作区 */}
      <div className="flex min-w-0 flex-1 flex-col bg-surface">
        {/* 桌面 48px 顶栏 */}
        <header className="sticky top-0 z-20 hidden h-12 items-center justify-between gap-4 border-b border-ink-200 bg-surface/95 px-6 backdrop-blur-sm lg:flex">
          <div className="flex min-w-0 items-center gap-2 text-[13px]">
            <span className="text-ink-500">{adminReady && ADMIN_TABS.has(tab) ? "管理工作台" : tab === "me" || (me && (tab === "rules" || tab === "push")) ? "个人空间" : "公开内容"}</span>
            <ChevronRight size={12} className="text-ink-300" />
            <span className="font-medium text-ink-900">{tabs.find((t) => t.key === tab)?.label ?? "管理区"}</span>
          </div>

          <div className="flex shrink-0 items-center gap-3 text-[12px] text-ink-500">
            {tab === "feed" && <><span className="font-mono tabular-nums">
              24h <strong className="font-semibold text-ink-900">+{stats.data?.totals.last24h ?? "—"}</strong>
            </span>
            <span className="text-ink-300" aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              含码 <strong className="font-semibold text-ink-900">{stats.data?.totals.withCodes ?? "—"}</strong>
            </span>
            {(stats.data?.totals.aiRejected ?? 0) > 0 && (
              <>
                <span className="text-ink-300" aria-hidden="true">·</span>
                <span>已滤 {stats.data?.totals.aiRejected} 条水帖</span>
              </>
            )}
            <a
              href={exportUrl}
              className="ml-1 inline-flex h-7 items-center gap-1.5 rounded-md border border-ink-200 bg-surface px-2.5 text-[12px] font-medium text-ink-700 transition-colors hover:bg-ink-100 hover:text-ink-950"
              title="按当前筛选导出 Markdown"
            >
              <Download size={12} /> 导出
            </a>
            </>}
            <button
              type="button"
              onClick={refreshAll}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-ink-200 bg-surface text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-950"
              title="刷新数据"
            >
              <RefreshCw size={13} className={items.loading ? "animate-spin" : ""} />
            </button>
          </div>
        </header>

        {/* 主内容区 */}
        <main className={tab === "feed" ? "workspace-content min-w-0 flex-1" : "workspace-content min-w-0 flex-1 px-3.5 py-3.5 sm:px-6 sm:py-5"}>
          {/* 懒加载的面板首次进入时给一个轻量占位，避免整页闪白 */}
          <Suspense
            fallback={
              <div className="flex items-center justify-center gap-1.5 px-6 py-10 text-[12.5px] text-ink-400">
                <Loader2 size={13} className="animate-spin" /> 载入中…
              </div>
            }
          >
          {((tab as string) === "admin" || (ADMIN_TABS.has(tab) && !adminReady && !((tab === "rules" || tab === "push") && me))) && (
            <AdminGate protectedMode={protectedMode} entryAllowed={adminEntryAllowed} onAuthChange={setAdminAuthed}>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { key: "rules" as Tab, label: "订阅与屏蔽", desc: "关键词订阅、屏蔽词防火墙", icon: ShieldBan },
                  { key: "push" as Tab, label: "推送规则", desc: "推送时机、阈值、格式与免打扰", icon: Zap },
                  { key: "ai" as Tab, label: "AI 引擎", desc: "规则初筛、审核模型、提示词与补审", icon: Bot },
                  { key: "ops" as Tab, label: "数据源运维", desc: "采集开关、间隔、数据清理", icon: Wrench },
                ].map((entry) => (
                  <button
                    key={entry.key}
                    type="button"
                    onClick={() => setTab(entry.key)}
                    className="panel flex flex-col items-start gap-1.5 p-4 text-left transition-colors hover:border-ink-400"
                  >
                    <entry.icon size={16} className="text-accent" />
                    <span className="text-[13.5px] font-semibold text-ink-950">{entry.label}</span>
                    <span className="text-[12px] leading-relaxed text-ink-500">{entry.desc}</span>
                  </button>
                ))}
              </div>
            </AdminGate>
          )}

          {tab === "feed" && (
            <>
              {/* 移动端：频道胶囊 + 筛选/视图压成一行，省掉两条整行按钮 */}
              <div className="flex items-stretch border-b border-ink-100 bg-surface">
                <div className="channel-nav no-scrollbar min-w-0 flex-1" role="group" aria-label="内容频道">
                  {PRIMARY_CHANNELS.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      aria-pressed={preset === p.key}
                      onClick={() => switchPreset(p.key)}
                      className="whitespace-nowrap transition-colors"
                    >
                      <p.icon size={11} />
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="relative flex shrink-0 items-center gap-1 border-l border-ink-100 bg-surface px-2 lg:hidden">
                  {/* 左侧渐隐，避免横向滚动的频道胶囊被硬切一半 */}
                  <span className="pointer-events-none absolute inset-y-0 -left-4 w-4 bg-gradient-to-l from-surface to-transparent" aria-hidden="true" />
                  <button
                    type="button"
                    onClick={() => setMobileFilterBar((v) => !v)}
                    className={
                      "relative inline-flex h-7 w-7 items-center justify-center rounded-md border transition-colors " +
                      (mobileFilterBar
                        ? "border-ink-950 bg-ink-950 text-white"
                        : "border-ink-200 bg-surface text-ink-600")
                    }
                    title="筛选条件"
                    aria-label="筛选条件"
                    aria-expanded={mobileFilterBar}
                  >
                    <SlidersHorizontal size={14} />
                    {activeFilterCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-accent px-0.5 font-mono text-[9px] leading-none text-white">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateViewMode(viewMode === "compact" ? "grid2" : "compact")}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-ink-200 bg-surface text-ink-600 transition-colors hover:text-ink-950"
                    title={viewMode === "compact" ? "切到卡片网格" : "切到紧凑列表"}
                    aria-label="切换视图"
                  >
                    {viewMode === "compact" ? <LayoutGrid size={14} /> : <AlignJustify size={14} />}
                  </button>
                </div>
              </div>
              {/* 快捷子分类胶囊条：当前频道热门子类目一键直达，不用再进二级下拉找 */}
              {(() => {
                const countMap = new Map((stats.data?.byCategory ?? []).map((c) => [c.category ?? "other", c.n]));
                const allowed = categoriesForPreset(preset);
                const ordered = [...allowed].sort((a, b) => (countMap.get(b) ?? 0) - (countMap.get(a) ?? 0));
                // 只挂真的有内容的分类（外加已选中的，方便一键取消）；全空时退回频道默认顺序
                const withItems = ordered.filter((key) => (countMap.get(key) ?? 0) > 0 || categories.includes(key));
                const quickCats = (withItems.length ? withItems : ordered).slice(0, 10);
                return (
                  <div className="flex items-stretch border-b border-ink-100 bg-surface">
                    <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto px-3.5 py-1">
                    <button
                      type="button"
                      onClick={() => setCategories([])}
                      className={
                        "shrink-0 rounded-md px-2 py-0.5 text-[11.5px] font-medium transition-colors active:scale-[0.97] " +
                        (categories.length === 0
                          ? "bg-brand-subtle font-semibold text-accent"
                          : "text-ink-500 hover:bg-ink-100 hover:text-ink-900")
                      }
                    >
                      全部{preset === "news" ? "要闻" : preset === "info" ? "资讯" : "分类"}
                    </button>
                    {quickCats.map((key) => {
                      const n = countMap.get(key) ?? 0;
                      const active = categories.includes(key);
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() =>
                            setCategories((cur) =>
                              cur.includes(key) ? cur.filter((x) => x !== key) : [...cur, key],
                            )
                          }
                          className={
                            "inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-[11.5px] transition-colors active:scale-[0.97] " +
                            (active
                              ? "bg-ink-950 font-medium text-white"
                              : n > 0
                                ? "text-ink-600 hover:bg-ink-100 hover:text-ink-950"
                                : "text-ink-400 hover:bg-ink-100")
                          }
                        >
                          <span>{categoryLabelForPreset(key, preset)}</span>
                          {n > 0 && (
                            <span className={"font-mono text-[10.5px] tabular-nums " + (active ? "text-white/75" : "text-ink-400")}>
                              {n}
                            </span>
                          )}
                        </button>
                      );
                    })}
                    </div>
                    {/* 移动端统计并进这一行右端，不再单占一条 */}
                    <div className="relative flex shrink-0 items-center border-l border-ink-100 bg-surface px-2.5 text-[11px] whitespace-nowrap text-ink-500 sm:hidden">
                      <span className="pointer-events-none absolute inset-y-0 -left-4 w-4 bg-gradient-to-l from-surface to-transparent" aria-hidden="true" />
                      共 <strong className="ml-1 font-mono font-semibold tabular-nums text-ink-900">{items.data?.total ?? 0}</strong>
                      <span className="ml-0.5">条</span>
                      {preset === "verified" && <span className="ml-1 font-medium text-deal">· 验真</span>}
                    </div>
                  </div>
                );
              })()}

              {/* 40px 细线筛选条（根据当前频道自适应隐藏无关的价格/方式筛选） */}
              <div
                className={
                  "feed-controls border-b border-ink-200 bg-surface-hover px-3.5 py-2.5 sm:px-6 sm:py-2 " +
                  (mobileFilterBar ? "block" : "hidden sm:block")
                }
              >
                <div className="flex flex-wrap items-center gap-1">
                  {/* 分类多选浮层（展开查看全部分类） */}
                  <div className="filter-category relative" ref={catRef}>
                    <button
                      type="button"
                      onClick={() => setCatOpen((v) => !v)}
                      className={
                        "inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[12px] transition-colors " +
                        (categories.length
                          ? "border-ink-950 bg-ink-950 font-medium text-white"
                          : "border-ink-200 bg-surface text-ink-700 hover:border-ink-300")
                      }
                    >
                      <span>
                        {categories.length === 0
                          ? "分类"
                          : categories.length === 1
                            ? `分类：${categoryLabelForPreset(categories[0]!, preset)}`
                            : `分类：已选 ${categories.length} 项`}
                      </span>
                      <ChevronDown size={12} />
                    </button>
                    {catOpen && (
                      <div className="pop-enter panel absolute top-full left-0 z-40 mt-1.5 w-[260px] p-2.5 shadow-lg">
                        <div className="mb-2 flex items-center justify-between text-[11px] text-ink-500">
                          <span>{preset === "news" ? "要闻栏目（支持多选）" : preset === "info" ? "行业资讯栏目（支持多选）" : preset === "deal" ? "好价分类（支持多选）" : preset === "opensource" ? "开源方向（支持多选）" : "福利分类（支持多选）"}</span>
                          {categories.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setCategories([])}
                              className="font-medium text-accent hover:underline"
                            >
                              清空
                            </button>
                          )}
                        </div>
                        <div className="grid max-h-[240px] grid-cols-2 gap-1 overflow-auto">
                          {(() => {
                            const countMap = new Map((stats.data?.byCategory ?? []).map((c) => [c.category ?? "other", c.n]));
                            const allowed = categoriesForPreset(preset);
                            const ordered = [...allowed].sort((a, b) => (countMap.get(b) ?? 0) - (countMap.get(a) ?? 0));
                            return ordered.map((key) => {
                              const n = countMap.get(key) ?? 0;
                              const checked = categories.includes(key);
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() =>
                                    setCategories((cur) =>
                                      cur.includes(key) ? cur.filter((x) => x !== key) : [...cur, key],
                                    )
                                  }
                                  className={
                                    "flex items-center justify-between rounded border px-2 py-1 text-left text-[11.5px] transition-colors " +
                                    (checked
                                      ? "border-ink-950 bg-ink-950 font-medium text-white"
                                      : n > 0
                                        ? "border-ink-200 bg-surface text-ink-700 hover:bg-ink-100"
                                        : "border-ink-100 bg-canvas/70 text-ink-400 hover:bg-ink-100")
                                  }
                                >
                                  <span className="truncate">{categoryLabelForPreset(key, preset)}</span>
                                  <span className={"ml-1 font-mono text-[10.5px] " + (checked ? "text-white/70" : "text-ink-400")}>
                                    {n}
                                  </span>
                                </button>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 内容形态筛选 */}
                  {advancedFilters && <select
                    value={kindFilter}
                    onChange={(e) => setKindFilter(e.target.value)}
                    className="h-7 rounded-md border border-ink-200 bg-surface px-1.5 text-[11.5px] text-ink-700 outline-none focus:border-accent"
                    title="内容形态"
                  >
                    <option value="auto">形态：{preset === "verified" ? "真福利" : preset === "deal" ? "好价" : preset === "opensource" ? "开源" : preset === "news" ? "要闻" : preset === "info" ? "资讯" : "全部"}</option>
                    <option value="all">形态：全部（含其它）</option>
                    {KIND_ORDER.map((k) => (
                      <option key={k} value={k}>
                        {KIND_LABEL[k]}
                      </option>
                    ))}
                  </select>}

                  {/* 语言筛选 */}
                  <select
                    value={lang}
                    onChange={(e) => setLang(e.target.value as "all" | "zh" | "en")}
                    className="h-7 rounded-md border border-ink-200 bg-surface px-1.5 text-[11.5px] text-ink-700 outline-none focus:border-accent"
                    title="按标题语言筛选"
                  >
                    <option value="all">语言：全部</option>
                    <option value="zh">仅看中文</option>
                    <option value="en">仅看英文</option>
                  </select>

                  {preset !== "news" && preset !== "info" && preset !== "opensource" && (
                    <>
                      <select
                        value={priceCap}
                        onChange={(e) => setPriceCap(e.target.value)}
                        className="h-7 rounded-md border border-ink-200 bg-surface px-1.5 text-[11.5px] text-ink-700 outline-none focus:border-accent"
                        title="价格上限"
                      >
                        <option value="auto">
                          价格：不限
                        </option>
                        <option value="all">价格：不限</option>
                        <option value="free">仅白嫖 (0 元)</option>
                        <option value="5">≤ 5 元</option>
                        <option value="10">≤ 10 元</option>
                        <option value="30">≤ 30 元</option>
                        <option value="100">≤ 100 元</option>
                      </select>

                      {advancedFilters && <select
                        value={obtain}
                        onChange={(e) => setObtain(e.target.value)}
                        className="h-7 rounded-md border border-ink-200 bg-surface px-1.5 text-[11.5px] text-ink-700 outline-none focus:border-accent"
                        title={OBTAIN_HINT[obtain] ?? "获取方式"}
                      >
                        <option value="auto">
                          方式：{preset === "verified" ? "白嫖+条件" : "不限"}
                        </option>
                        <option value="all">方式：全部（含抽奖/试用）</option>
                        <option value="free">仅直接白嫖</option>
                        <option value="conditional">有条件领取</option>
                        <option value="lottery">抽奖/开奖</option>
                        <option value="trial">免费试用</option>
                        <option value="promo">推广/引流</option>
                      </select>}
                    </>
                  )}

                  <select
                    value={range}
                    onChange={(e) => setRange(e.target.value)}
                    className="h-7 rounded-md border border-ink-200 bg-surface px-1.5 text-[11.5px] text-ink-700 outline-none focus:border-accent"
                    title="发布时间窗口"
                  >
                    <option value="auto">
                      时间：{preset === "verified" ? "7天内" : "不限"}
                    </option>
                    <option value="all">时间：不限</option>
                    <option value="1d">24 小时内</option>
                    <option value="3d">3 天内</option>
                    <option value="7d">一周内</option>
                    <option value="30d">一个月内</option>
                  </select>

                  {advancedFilters && <select
                    value={minScore}
                    onChange={(e) => setMinScore(e.target.value)}
                    className="h-7 rounded-md border border-ink-200 bg-surface px-1.5 text-[11.5px] text-ink-700 outline-none focus:border-accent"
                    title="最低评分"
                  >
                    <option value="all">评分：不限</option>
                    <option value="50">≥ 50 分</option>
                    <option value="60">≥ 60 分</option>
                    <option value="70">≥ 70 分</option>
                  </select>}
                  <button type="button" aria-label={advancedFilters ? "收起高级筛选" : "高级筛选"} aria-expanded={advancedFilters} onClick={() => setAdvancedFilters((v) => !v)} className="inline-flex items-center gap-1 rounded-md px-2 text-[12px] font-medium text-accent hover:bg-brand-subtle">
                    <SlidersHorizontal size={12} /> {advancedFilters ? "收起高级筛选" : "高级筛选"}
                    {(kindFilter !== "auto" || obtain !== "auto" || minScore !== "all") && <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-label="高级条件已生效" />}
                  </button>

                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                    className="h-7 rounded-md border border-ink-200 bg-surface px-1.5 text-[11.5px] text-ink-700 outline-none focus:border-accent"
                    title="排序方式"
                  >
                    <option value="newest">最新</option>
                    <option value="score">高分</option>
                    <option value="oldest">最早</option>
                    <option value="expiring">快截止</option>
                    {preset !== "news" && preset !== "info" && <option value="price_asc">低价</option>}
                  </select>

                  <button
                    type="button"
                    aria-pressed={unreadOnly}
                    onClick={() => setUnreadOnly((v) => !v)}
                    className={
                      "h-7 rounded-md border px-2.5 text-[12px] font-medium transition-colors active:scale-[0.97] " +
                      (unreadOnly
                        ? "border-ink-950 bg-ink-950 text-white"
                        : "border-ink-200 bg-surface text-ink-600 hover:border-ink-300")
                    }
                  >
                    未读
                  </button>
                  {viewMode === "compact" && <button type="button" aria-pressed={showRowSummary} onClick={toggleRowSummary}
                    className={"inline-flex items-center gap-1 rounded-md border px-2.5 text-[12px] font-medium " + (showRowSummary ? "border-brand-border bg-brand-subtle text-accent" : "border-ink-200 bg-surface text-ink-600")}
                    title="展开或收起每条资源的 AI 摘要，不影响筛选结果">显示摘要</button>}

                  {visible.some((i) => !i.read) && (
                    <button
                      type="button"
                      onClick={() => void markVisibleRead()}
                      className="inline-flex h-7 items-center gap-1 rounded-md border border-ink-200 bg-surface px-2 text-[12px] font-medium text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-950 active:scale-[0.97]"
                      title="把当前列表里的未读条目一次性标为已读"
                    >
                      <CheckCheck size={12} /> 标已读
                    </button>
                  )}

                  {activeFilterCount > 0 && (
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[12px] font-medium text-accent hover:bg-brand-subtle"
                    >
                      <RotateCcw size={11} /> 重置 ({activeFilterCount})
                    </button>
                  )}

                  {/* 右端统计与视图切换 */}
                  <div className="ml-auto hidden shrink-0 items-center gap-2 sm:flex">
                    <span className="text-[12px] text-ink-500">
                      {items.loading ? (
                        <span className="inline-flex items-center gap-1">
                          <Loader2 size={11} className="animate-spin" /> 加载中…
                        </span>
                      ) : (
                        <>
                          共 <strong className="font-mono font-semibold tabular-nums text-ink-900">{items.data?.total ?? 0}</strong> 条
                        </>
                      )}
                    </span>
                    <div className="flex items-center gap-0.5 rounded-md border border-ink-200 bg-surface p-0.5">
                      {[
                        { key: "compact" as const, icon: AlignJustify, label: "紧凑列表，适合快速扫读", text: "列表" },
                        { key: "grid2" as const, icon: LayoutGrid, label: "双列图文卡片", text: "2列" },
                        { key: "grid3" as const, icon: LayoutGrid, label: "三列图文卡片", text: "3列" },
                      ].map((v) => (
                        <button
                          key={v.key}
                          type="button"
                          onClick={() => updateViewMode(v.key)}
                          className={
                            "inline-flex items-center gap-1 rounded px-2 py-1 text-[11.5px] font-medium transition-colors " +
                            (viewMode === v.key ? "bg-ink-950 text-white" : "text-ink-500 hover:text-ink-950")
                          }
                          title={v.label}
                        >
                          <v.icon size={12} />
                          <span>{v.text}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {/* 移动端：快捷视图与数据源折进这个面板，排在筛选条之后 */}
                {tab === "feed" && (
                  <div className="mt-2.5 space-y-3 border-t border-ink-200 pt-2.5 lg:hidden">{sourcePanelNode}</div>
                )}

                {activeFilterCount > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-ink-100 pt-2 text-[11.5px]">
                    <span className="text-ink-400">当前条件：</span>
                    {debounced && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearch("");
                          setDebounced("");
                        }}
                        className="rounded bg-ink-100 px-2 py-0.5 text-ink-700 hover:bg-ink-200"
                      >
                        搜索：{debounced} ×
                      </button>
                    )}
                    {source && (
                      <button
                        type="button"
                        onClick={() => setSource("")}
                        className="rounded bg-brand-subtle px-2 py-0.5 text-accent hover:bg-ink-200/70"
                      >
                        源：{sourceName(source)} ×
                      </button>
                    )}
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategories((cur) => cur.filter((x) => x !== cat))}
                        className="rounded bg-brand-subtle px-2 py-0.5 text-accent hover:bg-ink-200/70"
                      >
                        分类：{categoryLabelForPreset(cat, preset)} ×
                      </button>
                    ))}
                    {lang !== "all" && (
                      <button
                        type="button"
                        onClick={() => setLang("all")}
                        className="rounded bg-brand-subtle px-2 py-0.5 text-accent hover:bg-ink-200/70"
                      >
                        语言：{lang === "zh" ? "仅看中文" : "仅看英文"} ×
                      </button>
                    )}
                    {priceCap !== "auto" && (
                      <button
                        type="button"
                        onClick={() => setPriceCap("auto")}
                        className="rounded bg-brand-subtle px-2 py-0.5 text-accent hover:bg-ink-200/70"
                      >
                        价格：{priceCap === "all" ? "不限" : priceCap === "free" ? "仅白嫖" : `≤${priceCap}元`} ×
                      </button>
                    )}
                    {obtain !== "auto" && (
                      <button
                        type="button"
                        onClick={() => setObtain("auto")}
                        className="rounded bg-brand-subtle px-2 py-0.5 text-accent hover:bg-ink-200/70"
                      >
                        方式：{obtain === "all" ? "全部" : (OBTAIN_LABEL[obtain] ?? obtain)} ×
                      </button>
                    )}
                    {range !== "auto" && (
                      <button
                        type="button"
                        onClick={() => setRange("auto")}
                        className="rounded bg-brand-subtle px-2 py-0.5 text-accent hover:bg-ink-200/70"
                      >
                        时间：{range === "all" ? "不限" : range} ×
                      </button>
                    )}
                    {minScore !== "all" && (
                      <button
                        type="button"
                        onClick={() => setMinScore("all")}
                        className="rounded bg-brand-subtle px-2 py-0.5 text-accent hover:bg-ink-200/70"
                      >
                        评分：≥{minScore} ×
                      </button>
                    )}
                    {kindFilter !== "auto" && <button type="button" onClick={() => setKindFilter("auto")} className="rounded bg-brand-subtle px-2 py-0.5 text-accent hover:bg-ink-200/70">形态：{kindFilter === "all" ? "全部" : KIND_LABEL[kindFilter]} ×</button>}
                    {unreadOnly && (
                      <button
                        type="button"
                        onClick={() => setUnreadOnly(false)}
                        className="rounded bg-brand-subtle px-2 py-0.5 text-accent hover:bg-ink-200/70"
                      >
                        仅未读 ×
                      </button>
                    )}
                    <button type="button" onClick={resetFilters} className="ml-auto font-medium text-accent hover:underline">清除条件</button>
                  </div>
                )}
              </div>
              {activeFilterCount > 0 && !mobileFilterBar && <div className="flex items-center justify-between gap-3 border-b border-ink-100 bg-brand-subtle/40 px-3.5 py-2 text-[12px] sm:hidden">
                <button type="button" onClick={() => setMobileFilterBar(true)} className="min-w-0 truncate text-ink-700">已筛选 {activeFilterCount} 项{source ? ` · ${sourceName(source)}` : ""}{categories.length ? ` · ${categories.map((cat) => categoryLabelForPreset(cat, preset)).join("、")}` : ""} · 查看条件</button>
                <button type="button" onClick={resetFilters} className="shrink-0 font-medium text-accent">清除</button>
              </div>}


              {items.error && (
                <div role="alert" className="mx-3.5 my-3 rounded-lg border border-alert-border bg-alert-subtle p-4 text-[13px] text-alert sm:mx-6">
                  加载失败：{items.error} <button type="button" onClick={items.reload} className="ml-2 underline">重新加载</button>
                </div>
              )}
              {items.loading && !visible.length && <div role="status" aria-label="资源加载中" className="divide-y divide-ink-100">
                {Array.from({ length: 5 }, (_, index) => <div key={index} className="flex items-center gap-4 px-6 py-5">
                  <div className="h-4 w-9 rounded bg-ink-100" /><div className="flex-1 space-y-2"><div className="h-3 w-2/3 rounded bg-ink-100" /><div className="h-2.5 w-1/3 rounded bg-ink-100" /></div>
                </div>)}
              </div>}

              {viewMode === "compact" ? (
                <div key={`compact-${preset}`} className="list-enter">
                  {visible.map((item) => (
                    <Fragment key={item.id}>
                      <CompactRow
                        item={item}
                        showSummary={showRowSummary}
                        sourceName={sourceName}
                        selected={detail?.id === item.id}
                        onPatch={patch}
                        onOpen={setDetail}
                        onQuickBlock={setQuickBlock}
                        onCopyCode={copyCode}
                        expanded={relatedOpen === item.id}
                        onToggleRelated={(id) => setRelatedOpen((cur) => (cur === id ? null : id))}
                      />
                      {relatedOpen === item.id && relatedMap[item.id] ? (
                        <div className="pop-enter border-b border-ink-100 bg-surface-hover px-3.5 py-2 sm:px-6">
                          <div className="mb-1 text-[11px] font-medium text-ink-500">
                            同一事件 / 福利的其他 {relatedMap[item.id]!.length} 条来源报道
                          </div>
                          <ul className="space-y-1">
                            {relatedMap[item.id]!.map((r) => (
                              <li key={r.id} className="flex items-center gap-2 text-[12px]">
                                <span className="w-20 shrink-0 truncate text-ink-500 sm:w-28">{r.sourceName ?? r.source_id}</span>
                                <a
                                  href={r.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="truncate text-ink-700 hover:text-accent hover:underline"
                                >
                                  {r.title}
                                </a>
                                <span className="shrink-0 font-mono text-[11px] text-ink-400">
                                  {String(r.first_seen_at).slice(5, 16).replace("T", " ")}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </Fragment>
                  ))}
                </div>
              ) : (
                <div
                  key={`grid-${preset}-${viewMode}`}
                  className={
                    "list-enter " +
                    (viewMode === "grid3"
                      ? "grid grid-cols-1 gap-3.5 px-3.5 py-3 md:grid-cols-2 xl:grid-cols-3 sm:px-6 sm:py-4"
                      : "grid grid-cols-1 gap-3.5 px-3.5 py-3 md:grid-cols-2 sm:px-6 sm:py-4")
                  }
                >
                  {visible.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      sourceName={sourceName}
                      onPatch={patch}
                      onOpen={setDetail}
                      onQuickBlock={setQuickBlock}
                      onCopyCode={copyCode}
                      expanded={relatedOpen === item.id}
                      relatedItems={relatedOpen === item.id ? relatedMap[item.id] : undefined}
                      onToggleRelated={(id) => setRelatedOpen((cur) => (cur === id ? null : id))}
                    />
                  ))}
                </div>
              )}

              {!items.loading && !items.error && !visible.length && (
                preset === "pan" ? (
                  <div className="relative min-h-[520px]">
                    {/* 背景示例条目：只用来示意频道长什么样，全部是占位文案，不含任何真实资源 */}
                    <div className="pointer-events-none select-none opacity-55 blur-[0.6px]" aria-hidden="true">
                      {PAN_DEMO_ROWS.map((row, i) => (
                        <div key={i} className="flex items-start gap-3 border-b border-ink-100 px-6 py-4">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-300" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[14px] text-ink-900">{row.title}</div>
                            <div className="mt-1 text-[11.5px] text-ink-400">{row.meta}</div>
                          </div>
                          <span className="shrink-0 font-mono text-[11px] text-ink-300">{row.score}</span>
                        </div>
                      ))}
                    </div>
                    {/* 说明卡浮在示例列表之上 */}
                    <div className="absolute inset-0 flex items-start justify-center bg-gradient-to-b from-surface/35 via-surface/70 to-surface px-4 pt-10 sm:pt-16">
                      <div className="w-full max-w-xl rounded-lg border border-ink-200 bg-surface p-6 shadow-sm">
                        <div className="flex items-center gap-2 text-[15px] font-medium text-ink-900">
                          <FolderOpen size={16} className="text-ink-400" />
                          网盘/网课频道在公开演示站已停用
                        </div>
                        <p className="mt-3 text-[12.5px] leading-relaxed text-ink-500">
                          该频道聚合的是第三方网盘分享链接，公开展示存在版权风险，因此演示站不采集、不展示这类内容。背景条目为占位示意，不是真实资源。
                        </p>
                        <div className="mt-4 border-t border-ink-100 pt-4">
                          <div className="text-[12px] font-medium text-ink-700">能力说明（自部署可开启）</div>
                          <ul className="mt-2 space-y-1.5 text-[12px] leading-relaxed text-ink-500">
                            <li>· 多源采集：TG 频道、linux.do、RSS、GitHub Releases</li>
                            <li>· AI 语义分流：自动识别网盘资源、网课教程、影视剧集</li>
                            <li>· 一条消息含多个资源时自动拆分入库，标题清洗掉栏目前缀</li>
                          </ul>
                        </div>
                        <a href={REPO_URL} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-[12.5px] font-medium text-brand hover:underline">
                          查看自部署文档 →
                        </a>
                      </div>
                    </div>
                  </div>
                ) : (
                <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
                  <Radar size={28} className="text-ink-300" />
                  <div className="text-[15px] font-medium text-ink-900">{preset === "hidden" ? "还没有已关闭的内容" : preset === "starred" ? "还没有符合条件的收藏" : "当前条件下暂无内容"}</div>
                  <p className="max-w-md text-[12.5px] leading-relaxed text-ink-500">
                    {preset === "hidden" ? "列表里点“不想看”的内容会来到这里，需要时可恢复。" : preset === "starred" ? "点资源旁的星标即可收藏；已收藏但未显示时，可先清除筛选。" : `「${PRESETS.find((p) => p.key === preset)?.label ?? "当前频道"}」暂时没有匹配结果，可以清除条件或浏览全部收录。`}
                  </p>
                  <div className="flex gap-2">
                    {activeFilterCount > 0 && <button type="button" onClick={resetFilters} className="rounded-md border border-ink-200 px-4 py-2 text-[12.5px] font-medium text-ink-700 hover:bg-ink-100">清除当前条件</button>}
                    <button type="button" onClick={() => { resetFilters(); setPreset("all"); }} className="rounded-md bg-brand px-4 py-2 text-[12.5px] font-medium text-white hover:bg-brand-hover">浏览全部收录</button>
                  </div>
                </div>
                )
              )}
            </>
          )}

          {tab === "hot" && (
            <HotPanel
              report={hot.data}
              loading={hot.loading}
              error={hot.error}
              hours={hotHours}
              scope={hotScope}
              onHours={setHotHours}
              onScope={setHotScope}
              onReload={hot.reload}
              onSearchWord={(w) => {
                setSearch(w);
                switchPreset(hotScope === "news" ? "news" : hotScope === "info" ? "info" : hotScope === "deals" ? "verified" : "all");
                setTab("feed");
              }}
              onJumpCategory={(cat) => {
                const targetPreset =
                  hotScope === "news" || cat === "headline" || cat === "world"
                    ? "news"
                    : hotScope === "info" || cat === "stock" || cat === "tech" || cat === "finance"
                      ? "info"
                      : "all";
                switchPreset(targetPreset);
                setCategories([cat]);
                setTab("feed");
              }}
              onOpenItem={async (id) => {
                const found = items.data?.items?.find((it) => it.id === id);
                if (found) {
                  setDetail(found);
                  return;
                }
                try {
                  const res = await fetch("/api/items/" + id);
                  if (res.ok) {
                    const item = (await res.json()) as Item;
                    setDetail(item);
                    return;
                  }
                } catch {
                  /* 回退到资源流 */
                }
                setTab("feed");
              }}
              sourceName={sourceName}
            />
          )}

          {tab === "digest" && (
            <DigestPanel
              digests={digests.data?.digests ?? []}
              detail={digestDetail}
              pickedDate={pickedDate}
              onPickDate={setPickedDate}
              canAdmin={adminReady}
              onRunDaily={async () => {
                notify("正在生成今日精选…");
                const res = await fetch("/api/digests/run", { method: "POST" });
                const data = (await res.json().catch(() => ({}))) as { date?: string; count?: number; error?: string };
                if (!res.ok) notify(data.error ?? "生成失败");
                else notify(`已生成 ${data.count ?? 0} 条精选`);
                digests.reload();
                setPickedDate(res.ok && data.date ? data.date : null);
                digestDetail.reload();
              }}
              sourceName={sourceName}
              onPatch={patch}
              onOpen={setDetail}
              onQuickBlock={setQuickBlock}
              onCopyCode={copyCode}
              onRunWeekly={async () => {
                notify("正在汇总本周精选…");
                const res = await fetch("/api/digests/weekly", { method: "POST" });
                const data = (await res.json().catch(() => ({}))) as { date?: string; count?: number; error?: string; pushed?: boolean };
                if (!res.ok) notify(data.error ?? "生成失败");
                else notify(`周报已生成 ${data.count ?? 0} 条${data.pushed ? "，已发 Telegram" : ""}`);
                digests.reload();
                setPickedDate(res.ok && data.date ? data.date : null);
                digestDetail.reload();
              }}
            />
          )}

          {(adminReady || me) && tab === "rules" && (
            <RulesPanel
              allowRegex={adminReady}
              subscriptions={subs.data?.subscriptions ?? []}
              rules={blockRules.data?.rules ?? []}
              presets={blockRules.data?.presets ?? []}
              totalBlocked={blockRules.data?.totalBlocked ?? 0}
              sources={sources.data?.sources ?? []}
              blockedPreview={blockedPreview}
              sourceName={sourceName}
              onAddSub={addSubscription}
              onRemoveSub={removeSubscription}
              onJumpToSubscribed={(kw) => {
                setSearch(kw);
                setPreset("all");
                setTab("feed");
              }}
              onAddRule={addRule}
              onImportPresets={async () => {
                const res = await fetch(rulesBase + "/block-rules", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ presets: true }),
                });
                if (!res.ok) { notify("导入屏蔽词失败"); return; }
                blockRules.reload();
                items.reload();
                stats.reload();
                notify("已导入常见噪音屏蔽词");
              }}
              onToggleRule={async (id, enabled) => {
                const res = await fetch(rulesBase + "/block-rules/" + id, {
                  method: "PATCH",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ enabled }),
                });
                if (!res.ok) { notify("修改规则失败"); return; }
                blockRules.reload();
                items.reload();
                setBlockedPreview(null);
              }}
              onDeleteRule={async (id) => {
                const res = await fetch(rulesBase + "/block-rules/" + id, { method: "DELETE" });
                if (!res.ok) { notify("删除规则失败"); return; }
                blockRules.reload();
                items.reload();
                stats.reload();
                setBlockedPreview(null);
                notify("规则已删除，相关条目已恢复显示");
              }}
              onLoadBlockedPreview={async () => {
                const res = await fetch("/api/items?includeBlocked=1&limit=80&sort=newest");
                const data = (await res.json()) as { items: Item[] };
                setBlockedPreview(data.items);
              }}
            />
          )}

          {pushBase && tab === "push" && (
            <PushPanel
              payload={push.data}
              preview={pushPreview}
              logs={pushLogs.data?.logs ?? []}
              sources={sources.data?.sources ?? []}
              onSave={async (p: Partial<PushSettings>) => {
                const res = await fetch(pushBase ?? "/api/push", {
                  method: "PATCH",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify(p),
                });
                if (!res.ok) {
                  const error = ((await res.json().catch(() => ({}))) as { error?: string }).error ?? "保存失败";
                  notify(error);
                  throw new Error(error);
                }
                push.reload();
                setPushPreview(null);
                notify("推送规则已保存");
              }}
              onPreview={async () => {
                const res = await fetch((pushBase ?? "/api/push") + "/preview?limit=6");
                if (!res.ok) { notify("试算失败，请稍后重试"); return; }
                setPushPreview((await res.json()) as PushPreview);
              }}
              onFlush={async () => {
                const res = await fetch((pushBase ?? "/api/push") + "/flush", { method: "POST" });
                const data = (await res.json().catch(() => ({}))) as { sent?: number; queued?: number; error?: string };
                if (!res.ok) { notify(data.error ?? "发送失败"); return; }
                notify(`已发送 ${data.sent ?? 0} 条，队列剩 ${data.queued ?? 0} 条`);
                push.reload();
                pushLogs.reload();
                setPushPreview(null);
              }}
              onTest={async () => {
                const res = await fetch((pushBase ?? "/api/push") + "/test", { method: "POST" });
                const data = await res.json().catch(() => ({})) as { error?: string };
                notify(res.ok ? "测试消息已发送到当前渠道" : data.error ?? "推送未启用或缺少凭据");
                pushLogs.reload();
              }}
            />
          )}

          {adminReady && tab === "ai" && (
            <AiPanel
              data={ai.data}
              sources={sources.data?.sources ?? []}
              reload={ai.reload}
              onNotify={notify}
              sourceName={sourceName}
              onOpenItem={async (id) => {
                const found = items.data?.items?.find((it) => it.id === id);
                if (found) {
                  setDetail(found);
                  return;
                }
                try {
                  const res = await fetch("/api/items/" + id);
                  if (res.ok) {
                    const item = (await res.json()) as Item;
                    setDetail(item);
                  }
                } catch {
                  /* ignore */
                }
              }}
            />
          )}

          {me && tab === "me" && bootData && <UserPushPanel key={me.id} boot={bootData} />}
          {adminReady && tab === "ops" && <SiteAdminPanel />}
          {adminReady && tab === "ops" && (
            <OpsPanel
              onClassificationChanged={() => { refreshAll(); hot.reload(); digestDetail.reload(); }}
              sources={sources.data?.sources ?? []}
              runs={runs.data?.runs ?? []}
              sourceName={sourceName}
              onCollectSource={async (id) => {
                const isCookieSite = id === "zhihu-search" || id === "xhs-search" || id === "xiaoheihe-search";
                notify(isCookieSite ? "正在通过 VPS Cookie 采集（约 15-40 秒）…" : "正在采集…");
                const res = await fetch(`/api/sources/${id}/collect`, { method: "POST" });
                const data = (await res.json().catch(() => ({}))) as {
                  ok?: boolean;
                  error?: string;
                  summary?: { inserted: number; fetched: number; status: string };
                };
                if (!res.ok || data.ok === false || data.summary?.status === "failed") {
                  notify(data.error ?? "采集失败");
                } else {
                  notify(`完成：抓取 ${data.summary?.fetched ?? 0}，新增 ${data.summary?.inserted ?? 0}`);
                }
                refreshAll();
              }}
              onToggleSource={async (id, enabled) => {
                await fetch("/api/sources/" + id, {
                  method: "PATCH",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ enabled }),
                });
                sources.reload();
                notify(enabled ? "已启用该源" : "已禁用该源");
              }}
              onChangeInterval={async (id, sec) => {
                await fetch("/api/sources/" + id, {
                  method: "PATCH",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ interval_sec: sec }),
                });
                sources.reload();
                notify("采集周期已改为 " + formatInterval(sec));
              }}
              onAddRss={async (name, url, intervalSec, kindHint, categoryHint, fixedCategory) => {
                notify("正在添加并试采…");
                const res = await fetch("/api/sources", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ name, url, intervalSec, kindHint, categoryHint, fixedCategory }),
                });
                const data = (await res.json().catch(() => ({}))) as {
                  error?: string;
                  summary?: { fetched: number; inserted: number; status: string; error?: string };
                };
                if (!res.ok) notify(data.error ?? "添加失败");
                else if (data.summary?.status === "failed") notify("已添加，但首次采集失败：" + (data.summary.error ?? ""));
                else notify(`已添加，抓取 ${data.summary?.fetched ?? 0} 条，新增 ${data.summary?.inserted ?? 0}`);
                refreshAll();
              }}
              onUpdateSource={async (id, patch) => {
                const res = await fetch("/api/sources/" + id, {
                  method: "PATCH",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify(patch),
                });
                const data = (await res.json().catch(() => ({}))) as { error?: string; reclassified?: number };
                if (!res.ok) {
                  notify(data.error ?? "保存失败");
                  return false;
                }
                // Commit the acknowledged config locally before closing/reopening the editor.
                // A background refresh must not make immediate re-edit show the previous values.
                sources.update((current) => current ? { ...current, sources: current.sources.map((source) => source.id === id ? { ...source, ...patch } : source) } : current);
                refreshAll();
                hot.reload();
                digestDetail.reload();
                notify(data.reclassified ? `配置已更新，${data.reclassified} 条历史资源已重新归类` : "数据源配置已更新");
                return true;
              }}
              onDeleteSource={async (id) => {
                const res = await fetch("/api/sources/" + id, { method: "DELETE" });
                const data = (await res.json().catch(() => ({}))) as { error?: string };
                if (!res.ok) {
                  notify(data.error ?? "删除失败");
                  return false;
                }
                refreshAll();
                notify("已删除自定义数据源");
                return true;
              }}
              onNotify={notify}
            />
          )}
          </Suspense>
        </main>

        <footer className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-ink-200 px-3.5 py-3 text-[11.5px] text-ink-400 sm:px-6">
          <span>资源雷达 · 多源聚合 · AI 语义分流 · 所筛即所推</span>
          <span className="font-mono tabular-nums">
            {stats.data?.totals.active ?? 0} 条在库 · {stats.data?.totals.unread ?? 0} 条未读
          </span>
          <span className="w-full text-[11px] leading-relaxed text-ink-400/80">
            本站仅聚合公开渠道的资源标题与原始链接，不存储、不代理、不转存任何文件。如权利人认为内容侵权，请联系删除，本站将在收到通知后第一时间下架。
          </span>
        </footer>
      </div>

      {detail && (
        <ItemDetailDrawer
          item={detail}
          loading={detailLoading}
          error={detailError}
          onRetry={() => setDetailNonce((n) => n + 1)}
          sourceName={sourceName}
          hasPrev={currentIndex > 0}
          hasNext={currentIndex >= 0 && currentIndex < visible.length - 1}
          onPrev={() => currentIndex > 0 && setDetail(visible[currentIndex - 1] ?? null)}
          onNext={() => currentIndex >= 0 && currentIndex < visible.length - 1 && setDetail(visible[currentIndex + 1] ?? null)}
          onClose={() => setDetail(null)}
          onPatch={patch}
          onClassificationSave={adminReady ? async (id, update) => {
            const response = await fetch(`/api/admin/items/${id}/classification`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(update) });
            const result = await response.json() as { error?: string };
            if (!response.ok) throw new Error(result.error ?? "保存分类失败");
            // A fresh detail carries personal state and manual metadata without crossing user/admin scopes.
            const fullResponse = await fetch(`/api/items/${id}`);
            if (fullResponse.ok) {
              const full = await fullResponse.json() as Item;
              setDetail((current) => current?.id === id ? full : current);
            }
            refreshAll(); hot.reload(); digestDetail.reload();
          } : undefined}
          onQuickBlock={setQuickBlock}
          onCopyCode={copyCode}
        />
      )}

      {quickBlock && (
        <QuickBlockModal
          item={quickBlock}
          sourceName={sourceName}
          onClose={() => setQuickBlock(null)}
          onIgnoreOne={(id) => patch(id, { status: "ignored" })}
          onAddRule={quickBlockAdd}
        />
      )}

      <Toast message={toast} />

      {welcomeOpen && bootData && (
        <WelcomeModal
          boot={bootData}
          onClose={closeWelcome}
          onLogin={() => {
            closeWelcome();
            setAuthHash(null);
            setAuthOpen(true);
          }}
        />
      )}

      {authOpen && bootData && (
        <AuthModal
          boot={bootData}
          initialHash={authHash}
          onClose={() => setAuthOpen(false)}
          onDone={() => {
            setAuthOpen(false);
            boot.reload();
            setTimeout(() => {
              items.reload();
              stats.reload();
            }, 300);
          }}
        />
      )}

      {rssOpen && bootData && <RssModal boot={bootData} currentQuery={query} onClose={() => setRssOpen(false)} />}
    </div>
  );
}
