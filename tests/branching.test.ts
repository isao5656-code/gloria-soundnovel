import { describe, expect, it } from "vitest";
import {
  COMPANION_IDS,
  INVESTIGATION_IDS,
  allRouteCombinations,
  buildState,
  hasAllTracks,
  resolveFinalAccusation,
  secretAvailable,
  tracksOf,
  type FinalChoice,
} from "@/content/branching";
import type { CompanionId, EndingId, InvestigationId } from "@/content/types";

/**
 * 分岐全列挙。
 * 調査4か所から2か所（6通り）× 同行者3ルート ＝ 18通りを機械的に検査する。
 *
 * 期待値は docs/branching.md の表と同じものを、ここへ独立に書き下ろしている。
 * 実装を書き換えたときに、表と実装のどちらが動いたのかがわかるようにするため。
 */

type Expected = {
  pair: [InvestigationId, InvestigationId];
  companion: CompanionId;
  past: boolean;
  access: boolean;
  staging: boolean;
  secret: boolean;
  beddoes: EndingId;
};

const P = true;
const _ = false;

const EXPECTED: Expected[] = [
  // desk + attic
  { pair: ["desk", "attic"], companion: "victor",  past: P, access: P, staging: P, secret: P, beddoes: "tide" },
  { pair: ["desk", "attic"], companion: "fordham", past: P, access: P, staging: P, secret: P, beddoes: "tide" },
  { pair: ["desk", "attic"], companion: "alone",   past: P, access: P, staging: P, secret: P, beddoes: "tide" },
  // desk + village
  { pair: ["desk", "village"], companion: "victor",  past: P, access: _, staging: P, secret: _, beddoes: "grey" },
  { pair: ["desk", "village"], companion: "fordham", past: P, access: P, staging: _, secret: _, beddoes: "grey" },
  { pair: ["desk", "village"], companion: "alone",   past: P, access: _, staging: P, secret: _, beddoes: "grey" },
  // desk + fen
  { pair: ["desk", "fen"], companion: "victor",  past: P, access: P, staging: P, secret: P, beddoes: "tide" },
  { pair: ["desk", "fen"], companion: "fordham", past: P, access: P, staging: _, secret: _, beddoes: "grey" },
  { pair: ["desk", "fen"], companion: "alone",   past: P, access: P, staging: P, secret: P, beddoes: "tide" },
  // attic + village
  { pair: ["attic", "village"], companion: "victor",  past: P, access: P, staging: P, secret: _, beddoes: "tide" },
  { pair: ["attic", "village"], companion: "fordham", past: P, access: P, staging: P, secret: _, beddoes: "tide" },
  { pair: ["attic", "village"], companion: "alone",   past: P, access: P, staging: P, secret: _, beddoes: "tide" },
  // attic + fen
  { pair: ["attic", "fen"], companion: "victor",  past: _, access: P, staging: P, secret: _, beddoes: "grey" },
  { pair: ["attic", "fen"], companion: "fordham", past: P, access: P, staging: P, secret: _, beddoes: "tide" },
  { pair: ["attic", "fen"], companion: "alone",   past: _, access: P, staging: P, secret: _, beddoes: "grey" },
  // village + fen
  { pair: ["village", "fen"], companion: "victor",  past: P, access: P, staging: P, secret: _, beddoes: "tide" },
  { pair: ["village", "fen"], companion: "fordham", past: P, access: P, staging: P, secret: _, beddoes: "tide" },
  { pair: ["village", "fen"], companion: "alone",   past: P, access: P, staging: P, secret: _, beddoes: "tide" },
];

const key = (p: [InvestigationId, InvestigationId], c: CompanionId) =>
  `${p[0]}+${p[1]}／${c}`;

describe("分岐の全列挙", () => {
  it("組み合わせはちょうど18通り", () => {
    const combos = allRouteCombinations();
    expect(combos.length).toBe(18);
    expect(new Set(combos.map((c) => key(c.pair, c.companion))).size).toBe(18);
    expect(EXPECTED.length).toBe(18);
  });

  it.each(EXPECTED)(
    "$pair.0+$pair.1／$companion が仕様どおりの証拠系統・秘密選択・告発先になる",
    (exp) => {
      const s = buildState(exp.pair, exp.companion);
      const t = tracksOf(s);
      const label = key(exp.pair, exp.companion);

      expect(t.past, `${label} 系統1（過去）`).toBe(exp.past);
      expect(t.access, `${label} 系統2（今夜の道）`).toBe(exp.access);
      expect(t.staging, `${label} 系統3（偽装）`).toBe(exp.staging);
      expect(secretAvailable(s), `${label} 秘密選択`).toBe(exp.secret);
      expect(
        resolveFinalAccusation("accuse_beddoes", s),
        `${label} ビードウズ告発`,
      ).toBe(exp.beddoes);
    },
  );

  it("三系統が揃うのは12通り、いずれか不足が6通り", () => {
    const combos = allRouteCombinations().map(({ pair, companion }) =>
      hasAllTracks(buildState(pair, companion)),
    );
    expect(combos.filter(Boolean).length).toBe(12);
    expect(combos.filter((x) => !x).length).toBe(6);
  });

  it("良い結末が一本道になっていない（複数の調査組み合わせでEND 01へ到達できる）", () => {
    const pairs = new Set(
      allRouteCombinations()
        .filter(({ pair, companion }) => hasAllTracks(buildState(pair, companion)))
        .map(({ pair }) => pair.join("+")),
    );
    expect(pairs.size).toBeGreaterThanOrEqual(4);
  });
});

describe("すべての大きな選択が、少なくとも一つの判定へ寄与する", () => {
  it.each(INVESTIGATION_IDS)("調査 %s を含めるかどうかで結果が変わる組み合わせがある", (site) => {
    // その地点を別の地点に差し替えたとき、判定が変わる例が存在すること。
    const changed = allRouteCombinations().some(({ pair, companion }) => {
      if (!pair.includes(site)) return false;
      const other = pair.find((p) => p !== site)!;
      const base = buildState(pair, companion);
      return INVESTIGATION_IDS.filter((x) => x !== site && x !== other).some((alt) => {
        const swapped = buildState([other, alt], companion);
        const a = tracksOf(base);
        const b = tracksOf(swapped);
        return (
          a.past !== b.past ||
          a.access !== b.access ||
          a.staging !== b.staging ||
          secretAvailable(base) !== secretAvailable(swapped)
        );
      });
    });
    expect(changed, `調査 ${site} がどの判定にも寄与していない`).toBe(true);
  });

  it.each(COMPANION_IDS)("同行者 %s を選ぶかどうかで結果が変わる組み合わせがある", (companion) => {
    const changed = allRouteCombinations().some(({ pair }) => {
      const base = tracksOf(buildState(pair, companion));
      return COMPANION_IDS.filter((c) => c !== companion).some((alt) => {
        const other = tracksOf(buildState(pair, alt));
        return (
          base.past !== other.past ||
          base.access !== other.access ||
          base.staging !== other.staging
        );
      });
    });
    expect(changed, `同行者 ${companion} がどの判定にも寄与していない`).toBe(true);
  });
});

describe("最終選択と終幕の対応", () => {
  const cases: [FinalChoice, EndingId][] = [
    ["accuse_fordham", "gloves"],
    ["claim_hudson_fled", "runaway"],
    ["stay_silent", "terai"],
  ];

  it.each(cases)("%s は、証拠の量にかかわらず常に %s へ行く", (choice, expected) => {
    for (const { pair, companion } of allRouteCombinations()) {
      expect(resolveFinalAccusation(choice, buildState(pair, companion))).toBe(
        expected,
      );
    }
  });

  it("ビードウズ告発は、三系統が揃うときだけEND 01へ行く", () => {
    for (const { pair, companion } of allRouteCombinations()) {
      const s = buildState(pair, companion);
      const got = resolveFinalAccusation("accuse_beddoes", s);
      expect(got).toBe(hasAllTracks(s) ? "tide" : "grey");
    }
  });

  it("秘密終幕は、解放条件を満たす経路からのみ到達できる", () => {
    const reachable = allRouteCombinations().filter(({ pair, companion }) =>
      secretAvailable(buildState(pair, companion)),
    );
    expect(reachable.length).toBe(5);
    // 秘密選択が出る経路では、必ず三系統が揃っている。
    for (const { pair, companion } of reachable) {
      expect(hasAllTracks(buildState(pair, companion))).toBe(true);
    }
    for (const { pair, companion } of reachable) {
      expect(
        resolveFinalAccusation("read_last_leaf", buildState(pair, companion)),
      ).toBe("powder");
    }
  });

  it("六つの終幕すべてが、18通りのいずれかから到達できる", () => {
    const reached = new Set<EndingId>();
    const allChoices: FinalChoice[] = [
      "accuse_beddoes",
      "accuse_fordham",
      "claim_hudson_fled",
      "stay_silent",
      "read_last_leaf",
    ];
    for (const { pair, companion } of allRouteCombinations()) {
      const s = buildState(pair, companion);
      for (const c of allChoices) {
        if (c === "read_last_leaf" && !secretAvailable(s)) continue;
        reached.add(resolveFinalAccusation(c, s));
      }
    }
    expect([...reached].sort()).toEqual(
      ["grey", "gloves", "powder", "runaway", "terai", "tide"].sort(),
    );
  });
});
