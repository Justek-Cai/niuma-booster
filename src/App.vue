<script setup lang="ts">
/**
 * 牛马鼓励器 —— 主界面（严格复刻截图布局）
 * 标题栏 → 日期 → 状态大字 → 小驴追萝卜卡片 → 今日已赚 → 心愿提示
 * → 专注按钮 → 今日工时进度 → 本月累计
 */
import { computed, onMounted } from "vue";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useNiuma, fmtHMS, fmtHM } from "./composables/useNiuma";
import DonkeySvg from "./components/DonkeySvg.vue";
import SettingsModal from "./components/SettingsModal.vue";

const appWindow = getCurrentWindow();
/** 最小化到任务栏 */
function minimizeWindow() {
  void appWindow.minimize();
}
/** 关闭 = 隐藏到托盘（真正退出走托盘右键菜单） */
function closeWindow() {
  void appWindow.hide();
}

const {
  config,
  paused,
  focusMode,
  showSettings,
  snap,
  dateLine,
  monthTotal,
  workdays,
  init,
  togglePause,
  togglePin,
  saveConfig,
} = useNiuma();

onMounted(() => {
  void init();
});

/** 状态大字 */
const statusText = computed(
  () =>
    ({
      before: "还没上班",
      working: "上班中",
      lunch: "午休中",
      after: "下班啦",
    })[snap.value.status],
);

const statusColor = computed(
  () =>
    ({
      before: "text-gray-500",
      working: "text-blue-600",
      lunch: "text-amber-500",
      after: "text-emerald-600",
    })[snap.value.status],
);

/** 小驴卡片文案 */
const donkeyLabel = computed(() => {
  if (paused.value) return "累了，歇一会儿";
  if (snap.value.progress >= 1) return "追上啦，萝卜到嘴！";
  return "就差一点点";
});

/** 心愿提示 */
const wishText = computed(() => {
  if (!config.wishName || config.wishPrice <= 0) return "";
  if (snap.value.earned >= config.wishPrice) {
    return `已经赚够「${config.wishName}」啦，犒劳一下自己！`;
  }
  return `再工作${fmtHM(snap.value.wishRemainSec)}，就赚够「${config.wishName}」`;
});

const workedH = computed(() => snap.value.workedMin / 60);
const dayValidH = computed(() => snap.value.dayValidSec / 3600);
const progressPct = computed(() => snap.value.progress * 100);
</script>

<template>
  <!-- 根容器：透明窗口内的白色圆角卡片，任意区域可拖动窗口 -->
  <div
    data-tauri-drag-region
    class="flex h-screen w-screen select-none flex-col overflow-hidden rounded-2xl bg-[#fdfdfb] text-[#2b2b2b] shadow-2xl ring-1 ring-black/10"
  >
    <!-- 1. 标题栏 -->
    <header data-tauri-drag-region class="flex items-center gap-2 px-4 pb-1 pt-3">
      <div
        data-tauri-drag-region
        class="flex h-7 w-7 items-center justify-center rounded-md bg-[#3d5afe] text-sm font-bold text-white"
      >
        牛
      </div>
      <span data-tauri-drag-region class="text-base font-bold">牛马鼓励器</span>
      <div class="ml-auto flex items-center gap-2">
        <button
          class="rounded-md border px-2.5 py-0.5 text-xs transition-colors"
          :class="config.pinned ? 'border-blue-500 bg-blue-600 text-white' : 'border-gray-200 bg-white text-gray-600'"
          @click="togglePin"
        >
          置顶
        </button>
        <button
          class="rounded-md border border-gray-200 bg-white px-2.5 py-0.5 text-xs text-gray-600 hover:bg-gray-50"
          @click="showSettings = true"
        >
          设置
        </button>
        <!-- 最小化 -->
        <button
          class="flex h-6 w-6 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 hover:bg-gray-100"
          title="最小化"
          @click="minimizeWindow"
        >
          —
        </button>
        <!-- 关闭（隐藏到托盘） -->
        <button
          class="flex h-6 w-6 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 hover:bg-red-50 hover:text-red-500"
          title="隐藏到托盘"
          @click="closeWindow"
        >
          ✕
        </button>
      </div>
    </header>

    <main class="no-scrollbar flex-1 space-y-2.5 overflow-y-auto px-4 pb-3">
      <!-- 日期时间 -->
      <div data-tauri-drag-region class="text-xs text-gray-400">{{ dateLine }}</div>

      <!-- 2. 主状态大字 + 倒计时（专注模式下隐藏倒计时） -->
      <section data-tauri-drag-region>
        <div class="text-3xl font-black leading-tight" :class="statusColor">{{ statusText }}</div>
        <div v-if="!focusMode" class="mt-0.5 text-sm text-gray-500">
          <template v-if="snap.status === 'after'">今天辛苦啦，早点休息</template>
          <template v-else-if="snap.status === 'before'">距离上班还有 {{ fmtHMS(snap.countdownSec) }}</template>
          <template v-else-if="snap.status === 'lunch'">午休不计薪 · 距离下班还有 {{ fmtHMS(snap.countdownSec) }}</template>
          <template v-else>距离下班还有 {{ fmtHMS(snap.countdownSec) }}</template>
        </div>
      </section>

      <!-- 3. 小驴追萝卜动画卡片 -->
      <section class="rounded-xl bg-[#fdf3d7] p-3">
        <div class="flex items-center justify-between text-xs text-[#8a7a4d]">
          <span>小驴追萝卜 · {{ donkeyLabel }}</span>
          <button
            class="rounded border border-[#d8c48a] bg-white/70 px-2.5 py-0.5 text-xs text-[#8a7a4d] hover:bg-white"
            @click="togglePause"
          >
            {{ paused ? "恢复" : "暂停" }}
          </button>
        </div>
        <DonkeySvg :progress="snap.progress" :paused="paused" class="mt-1" />
      </section>

      <!-- 4. 今日已赚 -->
      <section data-tauri-drag-region class="text-center">
        <div class="text-xs text-gray-400">今日已赚 · 估算</div>
        <div class="text-4xl font-extrabold tracking-wide text-[#e8541e]">
          ¥{{ snap.earned.toFixed(4) }}
        </div>
        <!-- 5. 心愿提示 -->
        <div v-if="wishText" class="mt-1 text-xs text-gray-500">{{ wishText }}</div>
      </section>

      <!-- 6. 专注模式按钮 -->
      <button
        class="w-full rounded-lg bg-[#1f2430] py-2 text-sm font-medium text-white hover:bg-[#2a3040]"
        @click="focusMode = !focusMode"
      >
        {{ focusMode ? "显示倒计时 · 回来搬砖" : "隐藏倒计时 · 专注一会儿" }}
      </button>

      <!-- 7. 今日工时进度 -->
      <section data-tauri-drag-region>
        <div class="flex items-center justify-between text-sm">
          <span class="font-semibold">今日工时进度</span>
          <span class="text-gray-500">{{ progressPct.toFixed(1) }}%</span>
        </div>
        <div class="mt-0.5 text-xs text-gray-400">
          已工作 {{ workedH.toFixed(2) }} / {{ dayValidH.toFixed(2) }} 小时
        </div>
        <div class="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100">
          <div
            class="h-full rounded-full bg-[#3d5afe] transition-all duration-500"
            :style="{ width: progressPct + '%' }"
          ></div>
        </div>
      </section>

      <!-- 8. 本月累计 -->
      <section data-tauri-drag-region class="flex items-end justify-between">
        <span class="text-sm font-semibold">本月累计</span>
        <div class="text-right">
          <div class="text-2xl font-extrabold text-[#e8541e]">¥{{ monthTotal.toFixed(2) }}</div>
          <div class="text-[11px] text-gray-400">已过 {{ workdays }} 个工作日，按配置自动累计</div>
        </div>
      </section>
    </main>

    <!-- 设置面板 -->
    <SettingsModal
      v-if="showSettings"
      :config="config"
      @close="showSettings = false"
      @save="saveConfig"
    />
  </div>
</template>
