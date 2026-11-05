<script setup lang="ts">
/**
 * 小驴追萝卜动画 —— 驴使用用户提供的插画（已抠图），
 * 四条腿由脚本切成独立图层并生成 8 帧跑步动画（对角步态），组件内定时逐帧播放。
 * 钓竿 + 萝卜用 SVG 绘制并锚定在驴头顶。
 * progress = 0：萝卜在最前方远处；progress = 1：竿子压低，萝卜送到嘴边。
 * 动画：来回巡逻（含调头翻转）+ 奔跑颠簸 + 腿部跑步帧 + 萝卜摇摆；暂停时全部冻结。
 */
import { onUnmounted, ref, watch } from "vue";
import run0 from "../assets/frames/run_0.png";
import run1 from "../assets/frames/run_1.png";
import run2 from "../assets/frames/run_2.png";
import run3 from "../assets/frames/run_3.png";
import run4 from "../assets/frames/run_4.png";
import run5 from "../assets/frames/run_5.png";
import run6 from "../assets/frames/run_6.png";
import run7 from "../assets/frames/run_7.png";

const FRAMES = [run0, run1, run2, run3, run4, run5, run6, run7];
const FRAME_MS = 90;

const props = defineProps<{ progress: number; paused?: boolean }>();

/** 腿部跑步帧：暂停时冻结 */
const frameIdx = ref(0);
const timer = setInterval(() => {
  if (!props.paused) frameIdx.value = (frameIdx.value + 1) % FRAMES.length;
}, FRAME_MS);
watch(
  () => props.paused,
  (p) => {
    if (p) frameIdx.value = 0;
  },
);
onUnmounted(() => clearInterval(timer));

const clamp = () => Math.min(1, Math.max(0, props.progress));

/** 驴图片在本地坐标系的摆放（宽高比约 0.994，脚底贴 y=136 地面） */
const IMG_W = 129;
const IMG_H = 130;
const IMG_X = 55;
const IMG_Y = 6;
/** 钓竿固定点：驴头顶 */
const POLE_X = 150;
const POLE_Y = 26;
/** 钓竿末端：随进度从右上方压低到嘴边 */
const tipX = () => 282 - 82 * clamp();
const tipY = () => 12 + 45 * clamp();
</script>

<template>
  <svg viewBox="0 0 320 150" class="block w-full" :class="{ paused }">
    <!-- 小驴整体：缩放0.65倍并平移回地面线(y=136)；外层=来回巡逻（含调头翻转），内层=奔跑颠簸 -->
    <g transform="translate(0, 48) scale(0.65)">
      <g class="donkey-walk">
        <g class="donkey-run">
          <!-- 驴插画（8 帧跑步动画，对角步态） -->
          <image :href="FRAMES[frameIdx]" :x="IMG_X" :y="IMG_Y" :width="IMG_W" :height="IMG_H" />

          <!-- 细长钓竿：从头顶伸出，随进度压低 -->
          <path
            :d="`M ${POLE_X} ${POLE_Y} L ${tipX()} ${tipY()}`"
            stroke="#4a4438"
            stroke-width="2.5"
            stroke-linecap="round"
            fill="none"
          />
          <!-- 鱼线 -->
          <line :x1="tipX()" :y1="tipY()" :x2="tipX()" :y2="tipY() + 10" stroke="#9a927e" stroke-width="1.2" />
          <!-- 萝卜（挂在竿头摇摆） -->
          <g :transform="`translate(${tipX()}, ${tipY() + 10})`">
            <g class="carrot-swing">
              <path d="M -5.5 0 L 5.5 0 Q 5.5 9 0 16 Q -5.5 9 -5.5 0 Z" fill="#e0562b" />
              <path d="M -1.5 -1 L -4 -9 M 1 -1 L 1 -10 M 3 -1 L 6 -8" stroke="#4caf50" stroke-width="2.5" stroke-linecap="round" />
            </g>
          </g>
        </g>
      </g>
    </g>
  </svg>
</template>
