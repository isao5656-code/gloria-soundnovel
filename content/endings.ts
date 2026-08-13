import type { Ending, EndingId } from "./types";

/**
 * エンディング定義。
 *
 * 到達条件の正本は content/branching.ts の resolveFinalAccusation。
 * ここの condition は、その正本を人間向けに書き下したものである。
 */
export const endings: Ending[] = [
  {
    id: "tide",
    number: "END 01",
    title: "三十年目の潮",
    summary:
      "三つの反論をすべて封じ、沼に沈められた男の名と、沈めた男の名を、同じ夜のうちに言い当てる。",
    condition: "三系統の証拠を揃えてビードウズを名指しする",
  },
  {
    id: "grey",
    number: "END 02",
    title: "灰色の朝",
    summary:
      "指し示した先は正しかった。だが正しさは、それだけでは何も動かさない。",
    condition: "証拠系統が不足したままビードウズを名指しする",
  },
  {
    id: "terai",
    number: "END 03",
    title: "テライ行きの船",
    summary: "真相よりも、生きている友の名前のほうを選んだ夜。",
    condition: "告発せず、手記を伏せることを選ぶ",
  },
  {
    id: "gloves",
    number: "END 04",
    title: "白い手袋",
    summary: "最も近くにいた者を疑うのは、最も易しく、最も安い推理である。",
    condition: "フォーダム医師を名指しする",
  },
  {
    id: "runaway",
    number: "END 05",
    title: "逃げた男",
    summary: "追うべき方角を間違えた者は、追われるべき者に時間を贈る。",
    condition: "ハドスンが生きて逃亡したと結論する",
  },
  {
    id: "powder",
    number: "END 06",
    title: "火薬庫の返事",
    summary:
      "手記の最後の一葉を、書付と同じ規則で読む。三十年前に投げ込まれた問いに、ようやく返事が届く。",
    condition:
      "三系統を揃え、かつ暗号の規則を自力で見抜いたうえで、手記の最後の一葉を読む",
  },
];

export const endingById: Record<EndingId, Ending> = Object.fromEntries(
  endings.map((e) => [e.id, e]),
) as Record<EndingId, Ending>;

export const endingOrder: EndingId[] = endings.map((e) => e.id);
