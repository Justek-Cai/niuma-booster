/**
 * 牛马鼓励器 —— 核心业务逻辑
 *
 * 设计要点（保证计时不漂移、金额不出错）：
 * 1. 所有金额/进度均由「虚拟当前时间 + 配置」每次全量推导，绝不累加计数，
 *    因此休眠唤醒、卡顿掉帧都不会产生误差累积。
 * 2. 暂停 = 冻结虚拟时钟；恢复 = 把暂停时长从真实时钟里扣除后继续，逻辑闭环。
 * 3. 跨天（0点）自动把「今天」的收入快照沉淀进 records，并按满勤兜底估算，
 *    本月累计 = 本月历史记录之和 + 今日实时金额。
 */
import { computed, reactive, ref } from "vue";
import { load, type Store } from "@tauri-apps/plugin-store";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import {
  enable as autoEnable,
  disable as autoDisable,
  isEnabled as autoIsEnabled,
} from "@tauri-apps/plugin-autostart";
import type { SalarySnapshot, WorkConfig, WorkStatus } from "../types";

/** 默认配置 */
export const DEFAULT_CONFIG: WorkConfig = {
  monthSalary: 10000,
  payDays: 21.75,
  startTime: "09:00",
  endTime: "18:00",
  lunchStart: "12:00",
  lunchMinutes: 60,
  wishName: "自助烤肉",
  wishPrice: 150,
  autoStart: false,
  clickThrough: false,
  pinned: true,
};

const WEEK = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

/** "HH:mm" -> 当天分钟数 */
function toMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** 日期 -> "YYYY-MM-DD" */
function dateKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 秒 -> "X小时X分X秒" */
export function fmtHMS(sec: number): string {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h}小时${m}分${s}秒`;
}

/** 秒 -> "X小时X分"（用于心愿提示） */
export function fmtHM(sec: number): string {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}小时${m}分` : `${m}分钟`;
}

export function useNiuma() {
  const config = reactive<WorkConfig>({ ...DEFAULT_CONFIG });
  /** 每日收入快照：key = "YYYY-MM-DD"，value = 当日最终估算收入 */
  const records = ref<Record<string, number>>({});
  /** 虚拟当前时间（暂停时冻结） */
  const now = ref(new Date());
  const paused = ref(false);
  /** 专注模式：隐藏倒计时文字 */
  const focusMode = ref(false);
  const showSettings = ref(false);

  let store: Store | null = null;
  let pausedTotalMs = 0; // 累计暂停毫秒数
  let frozenAt = 0; // 暂停时刻的虚拟时间戳
  let curKey = dateKey(new Date()); // 今天的日期 key
  let lastSaveAt = 0;

  const win = getCurrentWindow();

  /** 核心：由虚拟当前时间全量推导所有数据 */
  function compute(d: Date): SalarySnapshot {
    const ws = toMin(config.startTime);
    const we = toMin(config.endTime);
    const ls = toMin(config.lunchStart);
    const le = ls + Math.max(0, config.lunchMinutes);

    // 每日有效计薪总秒数 = (下班 - 上班 - 午休) * 60
    const dayValidSec = Math.max(60, (we - ws - config.lunchMinutes) * 60);
    const dailySalary = config.monthSalary / (config.payDays || 21.75); // 日薪
    const perSec = dailySalary / dayValidSec; // 每秒收入
    const hourRate = perSec * 3600; // 时薪

    const nowMin = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;

    // 已有效工作分钟 = [上班, min(当前,下班)) 区间长度 - 午休重叠部分
    const effEnd = Math.min(nowMin, we);
    let workedMin = Math.max(0, effEnd - ws);
    const lunchOverlap = Math.max(0, Math.min(effEnd, le) - Math.max(ws, ls));
    workedMin -= Math.min(lunchOverlap, config.lunchMinutes);
    workedMin = Math.max(0, workedMin);

    const earned = workedMin * 60 * perSec; // 今日已赚
    const progress = Math.min(1, (workedMin * 60) / dayValidSec); // 工时进度

    // 状态判定
    let status: WorkStatus;
    if (nowMin < ws) status = "before";
    else if (nowMin >= we) status = "after";
    else if (nowMin >= ls && nowMin < le) status = "lunch";
    else status = "working";

    // 倒计时（下班 / 上班）
    let countdownSec = 0;
    if (status === "before") countdownSec = Math.max(0, (ws - nowMin) * 60);
    else if (status !== "after") countdownSec = Math.max(0, (we - nowMin) * 60);

    // 距离心愿的剩余时长 = max(0, 目标价 - 已赚) / 时薪
    const wishRemainSec =
      hourRate > 0 && config.wishPrice > earned
        ? ((config.wishPrice - earned) / hourRate) * 3600
        : 0;

    return {
      status,
      earned,
      workedMin,
      progress,
      countdownSec,
      perSec,
      hourRate,
      wishRemainSec,
      dayValidSec,
    };
  }

  const snap = computed(() => compute(now.value));

  /** 按当前配置估算全天收入（跨天兜底用） */
  function fullDayEarn(): number {
    const ws = toMin(config.startTime);
    const we = toMin(config.endTime);
    const dayValidSec = Math.max(60, (we - ws - config.lunchMinutes) * 60);
    return (config.monthSalary / (config.payDays || 21.75) / dayValidSec) * dayValidSec;
  }

  /** 跨天处理：0点重置今日数据，昨日收入沉淀进 records */
  function handleDayRollover() {
    const key = dateKey(now.value);
    if (key === curKey) return;
    // 昨天收尾：取实时快照与满勤估算的较大值兜底
    const prev = records.value[curKey] ?? 0;
    const full = fullDayEarn();
    if (full > prev) records.value[curKey] = Number(full.toFixed(4));
    curKey = key;
    void saveAll();
  }

  /** 250ms 心跳：更新虚拟时钟 + 落盘快照（金额全量推导，不怕掉帧） */
  function tick() {
    now.value = new Date(paused.value ? frozenAt : Date.now() - pausedTotalMs);
    handleDayRollover();
    const s = compute(now.value);
    if (s.earned > 0) records.value[curKey] = Number(s.earned.toFixed(4));
    const t = Date.now();
    if (t - lastSaveAt > 5000) {
      lastSaveAt = t;
      void saveAll();
    }
  }

  /** 持久化：配置 + 每日收入记录 */
  async function saveAll(): Promise<void> {
    if (!store) return;
    await store.set("config", { ...config });
    await store.set("records", records.value);
    await store.save();
  }

  // ===== 交互动作 =====

  /** 暂停计薪：冻结虚拟时钟 */
  function pause() {
    frozenAt = Date.now() - pausedTotalMs;
    paused.value = true;
    void saveAll();
  }

  /** 恢复计薪：把暂停时长计入补偿 */
  function resume() {
    pausedTotalMs = Date.now() - frozenAt;
    paused.value = false;
  }

  function togglePause() {
    paused.value ? resume() : pause();
  }

  /** 置顶开关 */
  async function togglePin() {
    config.pinned = !config.pinned;
    await win.setAlwaysOnTop(config.pinned);
    void saveAll();
  }

  /** 鼠标穿透开关（开启后需从托盘菜单关闭） */
  async function setClickThrough(v: boolean) {
    config.clickThrough = v;
    await win.setIgnoreCursorEvents(v);
    void saveAll();
  }

  /** 开机自启开关 */
  async function setAutoStart(v: boolean) {
    try {
      if (v) await autoEnable();
      else await autoDisable();
      config.autoStart = v;
    } catch (e) {
      console.error("autostart failed", e);
    }
  }

  /** 保存设置面板表单 */
  async function saveConfig(cfg: WorkConfig) {
    const needAuto = cfg.autoStart !== config.autoStart;
    Object.assign(config, cfg);
    if (needAuto) await setAutoStart(cfg.autoStart);
    await win.setAlwaysOnTop(config.pinned);
    await win.setIgnoreCursorEvents(config.clickThrough);
    void saveAll();
    showSettings.value = false;
  }

  /** 初始化：加载持久化数据、同步自启状态、注册事件与心跳 */
  async function init() {
    store = await load("niuma-data.json", { autoSave: true });

    const savedCfg = await store.get<Partial<WorkConfig>>("config");
    if (savedCfg) Object.assign(config, savedCfg);
    const rec = await store.get<Record<string, number>>("records");
    if (rec) records.value = rec;

    // 同步系统里真实的开机自启状态
    try {
      config.autoStart = await autoIsEnabled();
    } catch {
      /* ignore */
    }

    // 应用窗口状态
    await win.setAlwaysOnTop(config.pinned);
    if (config.clickThrough) await win.setIgnoreCursorEvents(true);

    curKey = dateKey(new Date());

    // 托盘"打开设置"事件
    await listen("open-settings", () => {
      showSettings.value = true;
    });
    // 托盘"取消鼠标穿透"后同步状态
    await listen<boolean>("click-through-changed", (e) => {
      config.clickThrough = e.payload;
      void saveAll();
    });

    setInterval(tick, 250);
  }

  // ===== 派生展示数据 =====

  const dateLine = computed(() => {
    const d = now.value;
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${WEEK[d.getDay()]} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  });

  /** 本月累计 = 本月历史记录之和 + 今日实时 */
  const monthTotal = computed(() => {
    const prefix = curKey.slice(0, 7);
    let sum = 0;
    for (const [k, v] of Object.entries(records.value)) {
      if (k.startsWith(prefix) && k !== curKey) sum += v;
    }
    return sum + snap.value.earned;
  });

  /** 本月已过工作日数（有收入记录的天数） */
  const workdays = computed(() => {
    const prefix = curKey.slice(0, 7);
    let n = 0;
    for (const [k, v] of Object.entries(records.value)) {
      if (!k.startsWith(prefix) || v <= 0.01) continue;
      if (k !== curKey) n++;
    }
    if (snap.value.earned > 0.01) n++;
    return n;
  });

  return {
    // 状态
    config,
    records,
    now,
    paused,
    focusMode,
    showSettings,
    snap,
    dateLine,
    monthTotal,
    workdays,
    // 动作
    init,
    togglePause,
    togglePin,
    setClickThrough,
    setAutoStart,
    saveConfig,
  };
}
