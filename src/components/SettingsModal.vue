<script setup lang="ts">
/**
 * 设置面板：所有配置项表单，保存到本地持久化存储
 */
import { reactive } from "vue";
import type { WorkConfig } from "../types";

const props = defineProps<{ config: WorkConfig }>();
const emit = defineEmits<{
  (e: "close"): void;
  (e: "save", cfg: WorkConfig): void;
}>();

// 深拷贝一份做本地编辑，取消不影响原配置
const form = reactive<WorkConfig>(JSON.parse(JSON.stringify(props.config)));

function submit() {
  form.monthSalary = Number(form.monthSalary) || 0;
  form.payDays = Number(form.payDays) || 21.75;
  form.lunchMinutes = Math.max(0, Number(form.lunchMinutes) || 0);
  form.wishPrice = Number(form.wishPrice) || 0;
  emit("save", { ...form });
}
</script>

<template>
  <div class="absolute inset-0 z-50 flex items-center justify-center bg-black/40 p-3" @mousedown.self="emit('close')">
    <div class="no-scrollbar max-h-full w-full overflow-y-auto rounded-xl bg-white p-4 shadow-xl">
      <div class="mb-3 flex items-center justify-between">
        <span class="text-base font-bold text-gray-800">设置</span>
        <button class="text-sm text-gray-400 hover:text-gray-600" @click="emit('close')">✕</button>
      </div>

      <div class="space-y-3 text-sm text-gray-700">
        <div class="grid grid-cols-2 gap-3">
          <label class="block">
            <span class="text-xs text-gray-500">月薪（元）</span>
            <input v-model.number="form.monthSalary" type="number" min="0" class="input" />
          </label>
          <label class="block">
            <span class="text-xs text-gray-500">每月计薪工作日</span>
            <input v-model.number="form.payDays" type="number" min="1" step="0.01" class="input" />
          </label>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <label class="block">
            <span class="text-xs text-gray-500">上班时间</span>
            <input v-model="form.startTime" type="time" class="input" />
          </label>
          <label class="block">
            <span class="text-xs text-gray-500">下班时间</span>
            <input v-model="form.endTime" type="time" class="input" />
          </label>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <label class="block">
            <span class="text-xs text-gray-500">午休开始</span>
            <input v-model="form.lunchStart" type="time" class="input" />
          </label>
          <label class="block">
            <span class="text-xs text-gray-500">午休时长（分钟）</span>
            <input v-model.number="form.lunchMinutes" type="number" min="0" class="input" />
          </label>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <label class="block">
            <span class="text-xs text-gray-500">心愿名称</span>
            <input v-model="form.wishName" type="text" placeholder="如：自助烤肉" class="input" />
          </label>
          <label class="block">
            <span class="text-xs text-gray-500">心愿目标价格（元）</span>
            <input v-model.number="form.wishPrice" type="number" min="0" class="input" />
          </label>
        </div>

        <!-- 开关组 -->
        <label class="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
          <span>开机自动启动</span>
          <input v-model="form.autoStart" type="checkbox" class="h-4 w-4 accent-blue-600" />
        </label>
        <label class="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
          <span>
            鼠标穿透
            <span class="block text-[11px] text-gray-400">开启后窗口不挡点击，需从托盘菜单关闭</span>
          </span>
          <input v-model="form.clickThrough" type="checkbox" class="h-4 w-4 accent-blue-600" />
        </label>
        <label class="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
          <span>窗口置顶</span>
          <input v-model="form.pinned" type="checkbox" class="h-4 w-4 accent-blue-600" />
        </label>
      </div>

      <button
        class="mt-4 w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700"
        @click="submit"
      >
        保存
      </button>
    </div>
  </div>
</template>

<style scoped>
.input {
  @apply mt-1 w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-blue-500;
}
</style>
