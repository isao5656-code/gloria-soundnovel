import { describe, expect, it } from "vitest";
import { getNode, nodeById } from "@/content/story";
import { clueById } from "@/content/clues";
import {
  allRouteCombinations,
  buildState,
  resolveFinalAccusation,
  secretAvailable,
  type FinalChoice,
} from "@/content/branching";
import {
  advance,
  branchStateOf,
  chooseOption,
  finalChoiceByNode,
  newGame,
  renderText,
  visibleChoices,
  type GameState,
} from "@/lib/game";
import type { ClueId, CompanionId, EndingId, InvestigationId } from "@/content/types";

/**
 * 物語状態テスト。
 * 入手していない証拠を提示していないか、選んでいない告発を断定していないか、
 * そして作中の暗号が実際に解けるかを検査する。
 */

// ── 暗号の検証 ───────────────────────────────

/** 猟場の書付。二十四の語に分けたもの。 */
const LETTER_WORDS = [
  "猟期", "も", "半ば",
  "終了", "まで", "三週",
  "ハドスン", "より", "報せあり",
  "全部", "で", "五十羽",
  "白状", "すれば", "少ない",
  "至急", "追加", "の",
  "逃亡", "防止", "網",
  "手配", "を", "乞う",
];

/** 手記の最後の一葉。同じく二十四の語。 */
const LEAF_WORDS = [
  "積荷", "火薬", "ノ件",
  "貴信", "三十樽", "拝受",
  "船倉", "底", "ノ",
  "通風", "手当", "ノ",
  "儀", "済", "ミタリ",
  "出港", "明後日", "ト",
  "相成", "決行", "ノ",
  "上ハ", "精算", "サレタシ",
];

/** 一語目を offset とし、そこから三語おきに拾う。 */
function everyThird(words: string[], offset: number): string[] {
  const out: string[] = [];
  for (let i = offset; i < words.length; i += 3) out.push(words[i]);
  return out;
}

const stripPunctuation = (s: string) =>
  s.replace(/[『』、。\u3000\s]/g, "");

describe("猟場の書付の暗号", () => {
  it("語を連結すると、本文に出てくる書付と一致する", () => {
    const joined = LETTER_WORDS.join("");
    for (const id of ["c2_5", "c4_0"]) {
      const inText = getNode(id).text.find((p) => p.includes("猟期も半ば"));
      expect(inText, `${id} に書付の全文がない`).toBeDefined();
      expect(stripPunctuation(inText!)).toBe(joined);
    }
  });

  it("三語おきに拾うと、作中で示される八語になる", () => {
    expect(everyThird(LETTER_WORDS, 0)).toEqual([
      "猟期", "終了", "ハドスン", "全部", "白状", "至急", "逃亡", "手配",
    ]);
  });

  it("解読場面の語列が、実際の抽出結果と一致する", () => {
    const line = getNode("c4_2").text.find((p) => p.includes("／"));
    expect(line).toBeDefined();
    expect(line!.split("／").map((s) => s.trim())).toEqual(
      everyThird(LETTER_WORDS, 0),
    );
  });

  it("解読結果が手掛かりの記述と一致する", () => {
    const message = everyThird(LETTER_WORDS, 0).join("");
    expect(stripPunctuation(clueById.cipher_solved.text)).toContain(message);
  });
});

describe("手記の最後の一葉の暗号", () => {
  it("語を連結すると、本文に出てくる一葉と一致する", () => {
    const inText = getNode("secret_1").text.find((p) => p.includes("積荷火薬"));
    expect(inText).toBeDefined();
    expect(stripPunctuation(inText!)).toBe(LEAF_WORDS.join(""));
  });

  it("書付と同じ位置から拾うと意味をなさず、一つずらすと通る", () => {
    // 失敗する試行が、作中の記述と一致すること。
    const failed = getNode("secret_2").text.find((p) => p.includes("／"));
    expect(failed!.split("／").map((s) => s.trim())).toEqual(
      everyThird(LEAF_WORDS, 0),
    );

    // 一つずらした結果が、作中の記述と一致すること。
    const solved = getNode("secret_3").text.find((p) => p.includes("／"));
    expect(solved!.split("／").map((s) => s.trim())).toEqual(
      everyThird(LEAF_WORDS, 1),
    );
    expect(everyThird(LEAF_WORDS, 1)).toEqual([
      "火薬", "三十樽", "底", "手当", "済", "明後日", "決行", "精算",
    ]);
  });

  it("解読結果が、示される平文と一致する", () => {
    const plain = getNode("secret_3").text.find((p) => p.startsWith("『"));
    expect(stripPunctuation(plain!).replace(/に/g, "")).toBe(
      everyThird(LEAF_WORDS, 1).join(""),
    );
  });
});

// ── 通し実行 ─────────────────────────────────

type Plan = {
  pair: [InvestigationId, InvestigationId];
  companion: CompanionId;
  finalNode: string;
};

/** 計画どおりに最後まで進める。 */
function playthrough(plan: Plan): GameState {
  let state = newGame();
  let guard = 0;

  while (guard++ < 400) {
    const node = getNode(state.nodeId);
    if (node.ending) return state;

    const choices = visibleChoices(state);
    if (choices.length === 0) {
      const next = advance(state);
      if (!next) throw new Error(`進めない場面: ${state.nodeId}`);
      state = next;
      continue;
    }

    // 調査ハブ
    const site = plan.pair.find((s) =>
      choices.some((c) => c.markInvestigated === s),
    );
    const hubPick =
      site && !state.investigated.includes(site)
        ? choices.find((c) => c.markInvestigated === site)
        : undefined;

    const pick =
      hubPick ??
      choices.find((c) => c.setCompanion === plan.companion) ??
      choices.find((c) => c.next === plan.finalNode);

    if (!pick) {
      throw new Error(
        `${state.nodeId} で選ぶべき選択肢がない（計画: ${plan.finalNode}）`,
      );
    }
    state = chooseOption(state, pick);
  }
  throw new Error("周回が終わらない");
}

const finalNodes = Object.keys(finalChoiceByNode);

describe("通し実行", () => {
  const plans: Plan[] = allRouteCombinations().flatMap(({ pair, companion }) =>
    finalNodes
      .filter((n) => {
        if (n !== "secret_0") return true;
        return secretAvailable(buildState(pair, companion));
      })
      .map((finalNode) => ({ pair, companion, finalNode })),
  );

  it("18通り × 最終選択のすべてが、最後まで到達する", () => {
    expect(plans.length).toBe(18 * 4 + 5); // 通常4種 + 秘密が出る5経路
    for (const plan of plans) {
      const end = playthrough(plan);
      expect(end.ending, `${plan.pair}/${plan.companion}/${plan.finalNode}`)
        .not.toBeNull();
    }
  });

  it("到達した終幕が、分岐判定の正本と一致する", () => {
    for (const plan of plans) {
      const end = playthrough(plan);
      const expected: EndingId = resolveFinalAccusation(
        finalChoiceByNode[plan.finalNode] as FinalChoice,
        buildState(plan.pair, plan.companion),
      );
      expect(
        end.ending,
        `${plan.pair.join("+")}／${plan.companion}／${plan.finalNode}`,
      ).toBe(expected);
    }
  });

  it("周回の終わりに、選んだ調査地点だけが記録されている", () => {
    for (const plan of plans.slice(0, 18)) {
      const end = playthrough(plan);
      expect([...end.investigated].sort()).toEqual([...plan.pair].sort());
      expect(end.companion).toBe(plan.companion);
    }
  });

  it("入手した手掛かりが、分岐表の想定と一致する", () => {
    for (const { pair, companion } of allRouteCombinations()) {
      const end = playthrough({ pair, companion, finalNode: "final_silent" });
      const expected = buildState(pair, companion).clues;
      // 通し実行では終幕直前までの手掛かりを比較する（終幕自体は付与しない）。
      for (const c of expected) {
        expect(end.clues, `${pair.join("+")}／${companion} に ${c} がない`).toContain(c);
      }
      for (const c of end.clues) {
        expect(expected.has(c), `${pair.join("+")}／${companion} に余分な ${c}`).toBe(
          true,
        );
      }
    }
  });
});

describe("入手していない証拠を提示しない", () => {
  /** 差し替え本文の中で言及されうる手掛かりと、その特徴語。 */
  const mentions: [ClueId, string][] = [
    ["ledger_name", "銀行の名簿"],
    ["news_clip", "三十年前の新聞"],
    ["fordham_note", "診療録"],
    ["red_clay", "赤い粘土"],
    ["hired_gig", "貸馬車"],
    ["sailors_knot", "この結び目"],
    ["hudson_kit", "ハドスンの荷物"],
  ];

  it("告発場面の本文が、持っていない証拠に言及しない", () => {
    for (const { pair, companion } of allRouteCombinations()) {
      const state = playthrough({ pair, companion, finalNode: "final_beddoes" });
      // 告発直前の状態を作り直して、差し替え本文を評価する。
      const at = replayTo(pair, companion, "final_beddoes_2");
      const text = renderText(nodeById["final_beddoes_2"], at).join("");
      for (const [clue, phrase] of mentions) {
        if (text.includes(phrase)) {
          expect(
            at.clues.includes(clue),
            `${pair.join("+")}／${companion}：未入手の ${clue} に言及している`,
          ).toBe(true);
        }
      }
      expect(state.ending).toBeTruthy();
    }
  });

  it("証拠不足の終幕が、実際に欠けている系統だけを理由に挙げる", () => {
    for (const { pair, companion } of allRouteCombinations()) {
      const at = replayTo(pair, companion, "final_beddoes_2");
      const t = branchStateOf(at);
      const text = renderText(nodeById["end_grey_0"], at).join("");
      const { past, access, staging } = {
        past: t.clues.has("ledger_name") || t.clues.has("news_clip") || t.clues.has("fordham_note"),
        access:
          t.clues.has("sailors_knot") || t.clues.has("red_clay") || t.clues.has("hired_gig"),
        staging:
          t.clues.has("hudson_kit") ||
          (t.clues.has("tide_table") && t.clues.has("boat_log")) ||
          t.flags.trustVictor ||
          t.flags.alone,
      };
      if (past) expect(text).not.toContain("同じ船にいたことを");
      if (access) expect(text).not.toContain("この沼まで来た痕跡");
      if (staging) expect(text).not.toContain("自分の足で屋敷を出たのではないこと");
    }
  });
});

describe("選んでいない行動を断定しない", () => {
  it("同行者を選ばなかったルートの終幕本文が、その同行者との行動を語らない", () => {
    const markers: [CompanionId, string[]][] = [
      ["victor", ["ご子息の証言"]],
      ["fordham", ["フォーダム先生の証言"]],
      ["alone", ["わたし自身が見たものを"]],
    ];
    for (const { pair, companion } of allRouteCombinations()) {
      const at = replayTo(pair, companion, "final_beddoes_2");
      const text = renderText(nodeById["final_beddoes_2"], at).join("");
      for (const [who, phrases] of markers) {
        if (who === companion) continue;
        for (const p of phrases) {
          expect(
            text.includes(p),
            `${pair.join("+")}／${companion} が ${who} の行動を語っている`,
          ).toBe(false);
        }
      }
    }
  });

  it("それぞれの告発の終幕が、他の人物を犯人として断定しない", () => {
    const forbidden: [string, string[]][] = [
      // フォーダム告発の結末で、ビードウズを捕らえたことにしない。
      ["end_gloves_2", ["サウサンプトンで捕まった", "判決は殺人罪"]],
      // ハドスン生存説の結末で、ビードウズを捕らえたことにしない。
      ["end_runaway_2", ["サウサンプトンで捕まった", "判決は殺人罪"]],
      // 沈黙の結末で、誰かを告発したことにしない。
      ["end_terai_2", ["告発", "逮捕", "判決"]],
    ];
    for (const [nodeId, phrases] of forbidden) {
      const text = nodeById[nodeId].text.join("");
      for (const p of phrases) {
        expect(text.includes(p), `${nodeId} が「${p}」と述べている`).toBe(false);
      }
    }
  });
});

/** 指定の場面に入った直後の状態を作る。 */
function replayTo(
  pair: [InvestigationId, InvestigationId],
  companion: CompanionId,
  target: string,
): GameState {
  let state = newGame();
  let guard = 0;
  while (guard++ < 400) {
    if (state.nodeId === target) return state;
    const node = getNode(state.nodeId);
    if (node.ending) throw new Error(`${target} に達する前に終幕`);

    const choices = visibleChoices(state);
    if (choices.length === 0) {
      const next = advance(state);
      if (!next) throw new Error(`進めない場面: ${state.nodeId}`);
      state = next;
      continue;
    }
    const site = pair.find((s) => choices.some((c) => c.markInvestigated === s));
    const pick =
      (site && !state.investigated.includes(site)
        ? choices.find((c) => c.markInvestigated === site)
        : undefined) ??
      choices.find((c) => c.setCompanion === companion) ??
      choices.find((c) => c.next === "final_beddoes");
    if (!pick) throw new Error(`${state.nodeId} で選べない`);
    state = chooseOption(state, pick);
  }
  throw new Error(`${target} に到達しない`);
}
