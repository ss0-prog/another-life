import type { LifeSummary, Setup } from "@/lib/sim/types";

export type TimelineEntry = {
  age: number;
  event: string;
};

export type EchoStatus = {
  summary: string;
  occupation: string;
  city: string;
  living: string;
};

export type Echo = {
  status: EchoStatus;
  timeline: TimelineEntry[];
  scene: string;
};

// 保存する1回ぶんの記録: 入力(今の自分とターニングポイント)と、二つの人生の要約。
export type SavedEcho = {
  id: string;
  createdAt: string;
  setup: Setup;
  alt: LifeSummary;
  real: LifeSummary;
};
