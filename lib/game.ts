import {
  INVESTIGATION_LIMIT,
  INVESTIGATION_IDS,
  type FinalChoice,
} from "@/content/branching";
import {
  getNode,
  investigationEntry,
  investigationLabels,
  START_NODE_ID,
} from "@/content/story";
import type {
  BranchState,
  Choice,
  ClueId,
  CompanionId,
  EndingId,
  Flags,
  InvestigationId,
  StoryNode,
} from "@/content/types";
import { initialFlags } from "@/content/types";

/**
 * ゲーム状態と遷移。UIから独立させ、テストから直接動かせるようにする。
 * 分岐の判定そのものは content/branching.ts が正本で、ここでは呼ぶだけにする。
 */

export type LogEntry = {
  nodeId: string;
  chapter: string;
  location: string;
  speaker?: string;
  paragraphs: string[];
};

export type GameState = {
  nodeId: string;
  clues: ClueId[];
  flags: Flags;
  investigated: InvestigationId[];
  companion: CompanionId | null;
  log: LogEntry[];
  seen: string[];
  /** この周回で到達した終幕。 */
  ending: EndingId | null;
};

export const SAVE_VERSION = 1 as const;
export const SAVE_KEY = "gloria-save-v1";
export const ENDINGS_KEY = "gloria-endings-v1";

export type SaveData = {
  version: typeof SAVE_VERSION;
  savedAt: string;
  state: GameState;
};

export function branchStateOf(state: GameState): BranchState {
  return {
    clues: new Set(state.clues),
    flags: state.flags,
    investigated: state.investigated,
    companion: state.companion,
  };
}

export function newGame(): GameState {
  const state: GameState = {
    nodeId: START_NODE_ID,
    clues: [],
    flags: { ...initialFlags },
    investigated: [],
    companion: null,
    log: [],
    seen: [],
    ending: null,
  };
  return enterNode(state, START_NODE_ID);
}

/** 場面の本文を、状態に応じて組み立てる。 */
export function renderText(node: StoryNode, state: GameState): string[] {
  const extra = node.dynamicText?.(branchStateOf(state)) ?? [];
  return [...node.text, ...extra];
}

/**
 * 調査ハブが提示する選択肢を組み立てる。
 * 未調査の地点だけを出し、2か所を終えたら選択肢は空になる。
 */
export function hubChoices(state: GameState): Choice[] {
  if (state.investigated.length >= INVESTIGATION_LIMIT) return [];
  return INVESTIGATION_IDS.filter(
    (id) => !state.investigated.includes(id),
  ).map((id) => ({
    label: investigationLabels[id].label,
    next: investigationEntry[id],
    markInvestigated: id,
  }));
}

/** 現在の場面で提示すべき選択肢（表示条件で絞ったもの）。 */
export function visibleChoices(state: GameState): Choice[] {
  const node = getNode(state.nodeId);
  const base = node.investigationHub ? hubChoices(state) : (node.choices ?? []);
  const bs = branchStateOf(state);
  return base.filter((c) => (c.condition ? c.condition(bs) : true));
}

/**
 * 場面へ入る。ハブで調査を終えていれば、その場で次の章へ送る。
 * 副作用（手掛かり、フラグ、ログ、既読）はここで一度だけ適用する。
 */
export function enterNode(state: GameState, nodeId: string): GameState {
  const node = getNode(nodeId);

  // 調査ハブ：2か所を終えていれば通過させる。
  if (
    node.investigationHub &&
    state.investigated.length >= INVESTIGATION_LIMIT
  ) {
    return enterNode(state, node.investigationHub.afterHub);
  }

  const clues = mergeClues(state.clues, node.addClues);
  const flags = { ...state.flags, ...(node.setFlags ?? {}) };
  const next: GameState = {
    ...state,
    nodeId,
    clues,
    flags,
    seen: state.seen.includes(nodeId) ? state.seen : [...state.seen, nodeId],
    ending: node.ending ?? null,
  };

  const paragraphs = renderText(node, next);
  // ハブ本文はログに残さない。同じ一行が繰り返し積もるのを避ける。
  const log = node.investigationHub
    ? next.log
    : [
        ...next.log,
        {
          nodeId,
          chapter: node.chapter,
          location: node.location,
          speaker: node.speaker,
          paragraphs,
        },
      ];

  return { ...next, log };
}

/** 選択肢を選ぶ。 */
export function chooseOption(state: GameState, choice: Choice): GameState {
  let s: GameState = {
    ...state,
    clues: mergeClues(state.clues, choice.addClues),
    flags: { ...state.flags, ...(choice.setFlags ?? {}) },
  };
  if (choice.markInvestigated && !s.investigated.includes(choice.markInvestigated)) {
    s = { ...s, investigated: [...s.investigated, choice.markInvestigated] };
  }
  if (choice.setCompanion) {
    s = { ...s, companion: choice.setCompanion };
  }
  return enterNode(s, choice.next);
}

/** 選択肢のない場面から次へ進む。進めない（終幕）なら null。 */
export function advance(state: GameState): GameState | null {
  const node = getNode(state.nodeId);
  if (node.ending) return null;
  if (visibleChoices(state).length > 0) return null;
  const target = node.nextBy
    ? node.nextBy(branchStateOf(state))
    : node.next;
  if (!target) return null;
  return enterNode(state, target);
}

function mergeClues(current: ClueId[], add: ClueId[] | undefined): ClueId[] {
  if (!add || add.length === 0) return current;
  const out = [...current];
  for (const c of add) if (!out.includes(c)) out.push(c);
  return out;
}

/** 最終選択の宛先を、場面IDから逆引きする（資料生成とテスト用）。 */
export const finalChoiceByNode: Record<string, FinalChoice> = {
  final_beddoes: "accuse_beddoes",
  final_fordham: "accuse_fordham",
  final_runaway: "claim_hudson_fled",
  final_silent: "stay_silent",
  secret_0: "read_last_leaf",
};

// ── 保存 ─────────────────────────────────────

export function loadSave(): GameState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    if (data.version !== SAVE_VERSION) return null;
    // 場面IDが失われたセーブは読み込まない（改稿でIDを削った場合の保険）。
    getNode(data.state.nodeId);
    return {
      ...data.state,
      flags: { ...initialFlags, ...data.state.flags },
    };
  } catch {
    return null;
  }
}

export function writeSave(state: GameState): boolean {
  if (typeof window === "undefined") return false;
  try {
    const data: SaveData = {
      version: SAVE_VERSION,
      savedAt: new Date().toISOString(),
      state,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadUnlockedEndings(): EndingId[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ENDINGS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? (list as EndingId[]) : [];
  } catch {
    return [];
  }
}

export function unlockEnding(id: EndingId): EndingId[] {
  const current = loadUnlockedEndings();
  if (current.includes(id)) return current;
  const next = [...current, id];
  try {
    window.localStorage.setItem(ENDINGS_KEY, JSON.stringify(next));
  } catch {
    /* 保存できなくても進行は妨げない */
  }
  return next;
}
