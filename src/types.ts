/** 全局 TS 类型定义 */

/** 用户配置（持久化到本地 store） */
export interface WorkConfig {
  /** 月薪（元） */
  monthSalary: number;
  /** 每月计薪工作日，默认 21.75 */
  payDays: number;
  /** 上班时间 HH:mm */
  startTime: string;
  /** 下班时间 HH:mm */
  endTime: string;
  /** 午休开始时间 HH:mm */
  lunchStart: string;
  /** 午休时长（分钟），午休期间不计薪 */
  lunchMinutes: number;
  /** 心愿名称，如：自助烤肉 */
  wishName: string;
  /** 心愿目标价格（元） */
  wishPrice: number;
  /** 开机自启 */
  autoStart: boolean;
  /** 鼠标穿透（开启后窗口不挡鼠标，需从托盘菜单关闭） */
  clickThrough: boolean;
  /** 窗口置顶 */
  pinned: boolean;
}

/** 工作状态 */
export type WorkStatus = "before" | "working" | "lunch" | "after";

/** 每次心跳计算出的快照数据 */
export interface SalarySnapshot {
  status: WorkStatus;
  /** 今日已赚（元） */
  earned: number;
  /** 已有效工作分钟数（已扣午休） */
  workedMin: number;
  /** 工时进度 0~1 */
  progress: number;
  /** 距离下班/上班的秒数 */
  countdownSec: number;
  /** 每秒收入（元） */
  perSec: number;
  /** 时薪（元/小时） */
  hourRate: number;
  /** 距离赚够心愿的剩余秒数 */
  wishRemainSec: number;
  /** 每日有效计薪总秒数 */
  dayValidSec: number;
}
