import type { StoryNode } from "./types";
import { prologueNodes } from "./story/prologue";
import { chapter2Nodes } from "./story/chapter2";
import { chapter3Nodes } from "./story/chapter3";
import { chapter4Nodes } from "./story/chapter4";
import { chapter5Nodes } from "./story/chapter5";

/**
 * シナリオ正本。
 *
 * 場面IDは遷移・セーブ・既読・音・背景・テストの共通キーである。
 * 本文だけを改稿するときはIDを変えない。
 */
export const story: StoryNode[] = [
  ...prologueNodes,
  ...chapter2Nodes,
  ...chapter3Nodes,
  ...chapter4Nodes,
  ...chapter5Nodes,
];

export const START_NODE_ID = "p0";

export const nodeById: Record<string, StoryNode> = Object.fromEntries(
  story.map((n) => [n.id, n]),
);

export function getNode(id: string): StoryNode {
  const node = nodeById[id];
  if (!node) throw new Error(`未定義の場面ID: ${id}`);
  return node;
}

/** 調査地点の入口場面。調査ハブが選択肢を生成するのに使う。 */
export const investigationEntry = {
  desk: "inv_desk_0",
  attic: "inv_attic_0",
  village: "inv_village_0",
  fen: "inv_fen_0",
} as const;

/** 調査地点の表示名と、選択肢に出す誘い文句。報酬そのものは先に言わない。 */
export const investigationLabels = {
  desk: {
    name: "書斎の書き物机",
    label: "鍵のかかった机だけが、この部屋で片付きすぎている",
  },
  attic: {
    name: "屋根裏のハドスンの部屋",
    label: "四日前まで人が住んでいた部屋を、まだ誰も片付けていない",
  },
  village: {
    name: "村の宿と郵便局",
    label: "雨の中を村まで歩き、三十年前を覚えている者を探す",
  },
  fen: {
    name: "沼と舟着き場",
    label: "屋敷から人目につかず出られる道は、裏の水辺しかない",
  },
} as const;
