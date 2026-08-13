import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { story, nodeById, START_NODE_ID, investigationEntry } from "@/content/story";
import { clues, clueById } from "@/content/clues";
import { endings } from "@/content/endings";
import {
  INVESTIGATION_IDS,
  allRouteCombinations,
  buildState,
  companionClues,
  investigationClues,
} from "@/content/branching";
import type { ClueId, StoryNode } from "@/content/types";

/**
 * グラフ検証。
 * 存在しない遷移先、到達不能な場面、終わらない循環、未到達のエンディングを検出する。
 */

/** ある場面から出うる遷移先を、状態によらずすべて列挙する。 */
function outgoing(node: StoryNode): string[] {
  const out: string[] = [];
  if (node.investigationHub) {
    for (const id of INVESTIGATION_IDS) out.push(investigationEntry[id]);
    out.push(node.investigationHub.afterHub);
  }
  for (const c of node.choices ?? []) out.push(c.next);
  if (node.nextCandidates) out.push(...node.nextCandidates);
  else if (node.next) out.push(node.next);
  return out;
}

describe("場面グラフ", () => {
  it("場面IDが重複していない", () => {
    const ids = story.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("遷移先がすべて存在する", () => {
    for (const node of story) {
      for (const target of outgoing(node)) {
        expect(nodeById[target], `${node.id} → ${target} が未定義`).toBeDefined();
      }
    }
  });

  it("nextBy を持つ場面は nextCandidates を宣言している", () => {
    for (const node of story) {
      if (node.nextBy) {
        expect(node.nextCandidates?.length, `${node.id}`).toBeGreaterThan(0);
      }
    }
  });

  it("終幕以外はすべて次を持つ", () => {
    for (const node of story) {
      if (node.ending) continue;
      const hasNext =
        Boolean(node.next) ||
        Boolean(node.nextBy) ||
        (node.choices?.length ?? 0) > 0 ||
        Boolean(node.investigationHub);
      expect(hasNext, `${node.id} が行き止まり`).toBe(true);
    }
  });

  it("開始点からすべての場面へ到達できる", () => {
    const seen = new Set<string>();
    const stack = [START_NODE_ID];
    while (stack.length) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      stack.push(...outgoing(nodeById[id]));
    }
    const unreachable = story.map((n) => n.id).filter((id) => !seen.has(id));
    expect(unreachable, `到達不能: ${unreachable.join(", ")}`).toEqual([]);
  });

  it("どの場面からも、いずれかの終幕へ到達できる（終わらない循環がない）", () => {
    // 終幕から逆向きに塗る。
    const incoming = new Map<string, string[]>();
    for (const node of story) {
      for (const t of outgoing(node)) {
        if (!incoming.has(t)) incoming.set(t, []);
        incoming.get(t)!.push(node.id);
      }
    }
    const canFinish = new Set<string>();
    const stack = story.filter((n) => n.ending).map((n) => n.id);
    while (stack.length) {
      const id = stack.pop()!;
      if (canFinish.has(id)) continue;
      canFinish.add(id);
      stack.push(...(incoming.get(id) ?? []));
    }
    const stuck = story.map((n) => n.id).filter((id) => !canFinish.has(id));
    expect(stuck, `終幕へ到達できない: ${stuck.join(", ")}`).toEqual([]);
  });

  it("六つの終幕がすべて定義され、場面として存在する", () => {
    const declared = new Set(story.filter((n) => n.ending).map((n) => n.ending));
    expect(declared.size).toBe(6);
    for (const e of endings) {
      expect(declared.has(e.id), `${e.id} の終幕場面がない`).toBe(true);
    }
  });

  it("条件付き選択肢が、どこかの経路で必ず表示可能である", () => {
    const conditional = story.flatMap((n) =>
      (n.choices ?? [])
        .filter((c) => c.condition)
        .map((c) => ({ node: n.id, choice: c })),
    );
    expect(conditional.length).toBeGreaterThan(0);
    for (const { node, choice } of conditional) {
      const showable = allRouteCombinations().some(({ pair, companion }) =>
        choice.condition!(buildState(pair, companion)),
      );
      expect(showable, `${node} の「${choice.label}」が永久に表示不能`).toBe(true);
    }
  });
});

describe("手掛かり", () => {
  it("手掛かりIDが重複していない", () => {
    const ids = clues.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("本文が参照する手掛かりはすべて定義されている", () => {
    const referenced = new Set<ClueId>();
    for (const node of story) {
      for (const c of node.addClues ?? []) referenced.add(c);
      for (const ch of node.choices ?? []) {
        for (const c of ch.addClues ?? []) referenced.add(c);
      }
    }
    for (const c of referenced) {
      expect(clueById[c], `${c} が未定義`).toBeDefined();
    }
  });

  it("定義したすべての手掛かりが、どこかで入手できる", () => {
    const obtainable = new Set<ClueId>();
    for (const node of story) {
      for (const c of node.addClues ?? []) obtainable.add(c);
      for (const ch of node.choices ?? []) {
        for (const c of ch.addClues ?? []) obtainable.add(c);
      }
    }
    const orphan = clues.map((c) => c.id).filter((id) => !obtainable.has(id));
    expect(orphan, `入手不能な手掛かり: ${orphan.join(", ")}`).toEqual([]);
  });

  it("分岐表の手掛かり割り当てが、実際の場面の付与と一致する", () => {
    // 調査地点ごとに、その入口から次の調査ハブに戻るまでに付与される手掛かりを集める。
    for (const site of INVESTIGATION_IDS) {
      const collected: ClueId[] = [];
      let id: string | undefined = investigationEntry[site];
      const guard = new Set<string>();
      while (id && id !== "c2_hub") {
        if (guard.has(id)) break;
        guard.add(id);
        const node: StoryNode = nodeById[id];
        collected.push(...(node.addClues ?? []));
        id = node.next;
      }
      expect(collected.sort(), `調査 ${site}`).toEqual(
        [...investigationClues[site]].sort(),
      );
    }
  });

  it("同行者ルートの手掛かり割り当てが、選択肢の付与と一致する", () => {
    const choiceNode = nodeById["c3_13"];
    for (const choice of choiceNode.choices ?? []) {
      const companion = choice.setCompanion!;
      expect([...(choice.addClues ?? [])].sort(), `同行者 ${companion}`).toEqual(
        [...companionClues[companion]].sort(),
      );
    }
  });
});

describe("アセット参照", () => {
  const root = resolve(__dirname, "..");

  it("参照している背景画像がすべて存在する", () => {
    const used = new Set(story.map((n) => n.scene));
    for (const s of used) {
      expect(
        existsSync(resolve(root, `public/scenes/${s}.svg`)),
        `public/scenes/${s}.svg がない`,
      ).toBe(true);
    }
  });

  it("参照している人物シルエットがすべて存在する", () => {
    const used = new Set(story.flatMap((n) => n.characters ?? []));
    for (const c of used) {
      expect(
        existsSync(resolve(root, `public/characters/${c}.svg`)),
        `public/characters/${c}.svg がない`,
      ).toBe(true);
    }
  });

  it("使われていない人物シルエットを抱えていない", () => {
    const used = new Set(story.flatMap((n) => n.characters ?? []));
    const declared = [
      "holmes",
      "victor",
      "trevor",
      "hudson",
      "fordham",
      "beddoes",
      "prendergast",
    ];
    for (const c of declared) {
      expect(used.has(c as never), `${c} がどの場面にも登場しない`).toBe(true);
    }
  });
});

describe("必須の音響演出", () => {
  it("爆発の直前に完全無音が置かれている", () => {
    const node = nodeById["c3_8"];
    const kinds = (node.audio ?? []).map((a) => a.kind);
    expect(kinds).toContain("stop");
    expect(kinds).toContain("silence");
    const silence = node.audio!.find((a) => a.kind === "silence");
    expect(silence!.kind === "silence" && silence.durationMs).toBeGreaterThanOrEqual(
      2500,
    );
    // 無音のあとに爆発が来る順序であること。
    expect(kinds.indexOf("silence")).toBeLessThan(kinds.lastIndexOf("se"));
  });

  it("単独ルートの櫂の音が、行きと帰りで定位を変えている", () => {
    const going = nodeById["route_a_2"].audio!.find((a) => a.kind === "se");
    const back = nodeById["route_a_3"].audio!.find((a) => a.kind === "se");
    const goPan = going!.kind === "se" ? going.pan : undefined;
    const backPan = back!.kind === "se" ? back.pan : undefined;
    expect(goPan).toBeDefined();
    expect(backPan).toBeDefined();
    expect(Math.sign(goPan!)).not.toBe(Math.sign(backPan!));
  });

  it("秘密終幕の解読場面が、BGMを止めてから無音を置く", () => {
    const kinds = (nodeById["secret_3"].audio ?? []).map((a) => a.kind);
    expect(kinds[0]).toBe("stop");
    expect(kinds).toContain("silence");
  });
});
