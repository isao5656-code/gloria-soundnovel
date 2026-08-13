import type {
  BranchState,
  ClueId,
  CompanionId,
  EndingId,
  InvestigationId,
} from "./types";
import { initialFlags } from "./types";

/**
 * 分岐判定の正本。
 *
 * UI（app/page.tsx）はここを呼ぶだけにする。ここに書かれていない判定を
 * 画面側で再実装してはいけない。テストもここを直接呼ぶ。
 */

export const INVESTIGATION_IDS: InvestigationId[] = [
  "desk",
  "attic",
  "village",
  "fen",
];

export const COMPANION_IDS: CompanionId[] = ["victor", "fordham", "alone"];

/** 一周で選べる調査地点の数。 */
export const INVESTIGATION_LIMIT = 2;

/** 各調査地点で得る手掛かり。 */
export const investigationClues: Record<InvestigationId, ClueId[]> = {
  desk: ["ledger_name", "cipher_key"],
  attic: ["sailors_knot", "hudson_kit"],
  village: ["news_clip", "tide_table"],
  fen: ["red_clay", "boat_log"],
};

/** 各同行者ルートで得る手掛かり。 */
export const companionClues: Record<CompanionId, ClueId[]> = {
  victor: ["victor_testimony"],
  fordham: ["fordham_note", "hired_gig"],
  alone: ["night_watch"],
};

/**
 * 三つの補強証拠系統。
 *
 * 共通ルートで、プレイヤーは既に次を知っている。
 *   ・老トレヴァーの本名と前歴（手記）
 *   ・ハドスンが三十年前の生存者であること
 *   ・書付が「逃げろ」という警告であること
 *
 * 任意の手掛かりは、それ単独で犯行を証明するものではない。
 * ビードウズが持ち出しうる三つの反論を、それぞれ封じるための補強である。
 *
 *   系統1「過去」    反論：わたしとトレヴァー氏は縁もゆかりもない隣人だ
 *   系統2「今夜の移動」反論：わたしはハンプシャーから一歩も出ていない
 *   系統3「偽装」    反論：ハドスンは自分の足で出ていった。事件など起きていない
 */
export function trackPast(s: BranchState): boolean {
  return (
    s.clues.has("ledger_name") ||
    s.clues.has("news_clip") ||
    s.clues.has("fordham_note")
  );
}

export function trackAccess(s: BranchState): boolean {
  return (
    s.clues.has("sailors_knot") ||
    s.clues.has("red_clay") ||
    s.clues.has("hired_gig")
  );
}

export function trackStaging(s: BranchState): boolean {
  return (
    s.clues.has("hudson_kit") ||
    (s.clues.has("tide_table") && s.clues.has("boat_log")) ||
    s.flags.trustVictor ||
    s.flags.alone
  );
}

export function tracksOf(s: BranchState): {
  past: boolean;
  access: boolean;
  staging: boolean;
} {
  return { past: trackPast(s), access: trackAccess(s), staging: trackStaging(s) };
}

export function trackCount(s: BranchState): number {
  const t = tracksOf(s);
  return Number(t.past) + Number(t.access) + Number(t.staging);
}

export function hasAllTracks(s: BranchState): boolean {
  return trackCount(s) === 3;
}

/**
 * 秘密選択の解放条件。
 * 三系統が揃い、かつ暗号の規則を自力で見抜いていること。
 * 規則を見抜くには書斎の机を調べて cipher_key を得ている必要がある。
 */
export function secretAvailable(s: BranchState): boolean {
  return hasAllTracks(s) && s.clues.has("cipher_key");
}

/** 最終選択の種類。 */
export type FinalChoice =
  | "accuse_beddoes"
  | "accuse_fordham"
  | "claim_hudson_fled"
  | "stay_silent"
  | "read_last_leaf";

/**
 * 最終選択と状態から終幕を決める。ここが唯一の判定箇所である。
 */
export function resolveFinalAccusation(
  choice: FinalChoice,
  s: BranchState,
): EndingId {
  switch (choice) {
    case "accuse_beddoes":
      return hasAllTracks(s) ? "tide" : "grey";
    case "accuse_fordham":
      return "gloves";
    case "claim_hudson_fled":
      return "runaway";
    case "stay_silent":
      return "terai";
    case "read_last_leaf":
      // 秘密選択は解放条件を満たすときしか提示されない。
      // 万一状態が崩れた場合でも、条件を満たさなければ通常の告発として扱う。
      return secretAvailable(s) ? "powder" : "tide";
  }
}

/** テストと資料生成のための、状態の組み立て。 */
export function buildState(
  pair: [InvestigationId, InvestigationId],
  companion: CompanionId,
): BranchState {
  const clues = new Set<ClueId>([
    // 共通ルートで必ず得るもの
    "initials_ja",
    "hudson_arrival",
    "cipher_note",
    "trevor_stroke",
    "trevor_memoir",
    "cipher_solved",
  ]);
  for (const site of pair) {
    for (const c of investigationClues[site]) clues.add(c);
  }
  for (const c of companionClues[companion]) clues.add(c);

  return {
    clues,
    flags: {
      ...initialFlags,
      trustVictor: companion === "victor",
      withFordham: companion === "fordham",
      alone: companion === "alone",
      sawDeath: true,
      brokeCipher: clues.has("cipher_key"),
    },
    investigated: [...pair],
    companion,
  };
}

/** 調査2か所の組み合わせを全列挙する（6通り）。 */
export function allInvestigationPairs(): [InvestigationId, InvestigationId][] {
  const out: [InvestigationId, InvestigationId][] = [];
  for (let i = 0; i < INVESTIGATION_IDS.length; i++) {
    for (let j = i + 1; j < INVESTIGATION_IDS.length; j++) {
      out.push([INVESTIGATION_IDS[i], INVESTIGATION_IDS[j]]);
    }
  }
  return out;
}

/** 調査×同行者の全組み合わせを列挙する（18通り）。 */
export function allRouteCombinations(): {
  pair: [InvestigationId, InvestigationId];
  companion: CompanionId;
}[] {
  const out: {
    pair: [InvestigationId, InvestigationId];
    companion: CompanionId;
  }[] = [];
  for (const pair of allInvestigationPairs()) {
    for (const companion of COMPANION_IDS) out.push({ pair, companion });
  }
  return out;
}
