/**
 * シナリオ資料 docs/scenario.md を、正本 content/ から生成する。
 *
 *   npm run docs:scenario
 *
 * 本文をMarkdownとTypeScriptへ二重管理すると必ず差が出るため、
 * 資料のほうを生成物として扱う。docs/scenario.md を手で編集しない。
 */
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { story, START_NODE_ID, investigationLabels } from "../content/story";
import { clues } from "../content/clues";
import { endings } from "../content/endings";
import {
  INVESTIGATION_IDS,
  allRouteCombinations,
  buildState,
  hasAllTracks,
  secretAvailable,
} from "../content/branching";
import type { StoryNode } from "../content/types";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const chapters: string[] = [];
for (const n of story) if (!chapters.includes(n.chapter)) chapters.push(n.chapter);

const totalChars = story.reduce((a, n) => a + n.text.join("").length, 0);
const withDynamic = story.filter((n) => n.dynamicText).length;

const lines: string[] = [];

lines.push("# シナリオ全文・分岐資料");
lines.push("");
lines.push(
  "**この資料は自動生成物である。** 正本は `content/story/*.ts` と " +
    "`content/branching.ts`。手で編集せず、`npm run docs:scenario` で作り直す。",
);
lines.push("");
lines.push("## 概要");
lines.push("");
lines.push("| 項目 | 値 |");
lines.push("|---|---|");
lines.push(`| 作品名 | グローリア・スコット号 ― 三十年目の潮 |`);
lines.push(`| 原案 | アーサー・コナン・ドイル『グローリア・スコット号』(1893) 著作権消滅 |`);
lines.push(`| 開始場面 | \`${START_NODE_ID}\` |`);
lines.push(`| 総場面数 | ${story.length} |`);
lines.push(`| 章 | ${chapters.length}（${chapters.join("・")}） |`);
lines.push(`| 本文の文字数 | 約 ${totalChars.toLocaleString("ja-JP")} 字（状態差し替えを除く） |`);
lines.push(`| 状態で本文が変わる場面 | ${withDynamic} |`);
lines.push(`| 手掛かり | ${clues.length} |`);
lines.push(`| エンディング | ${endings.length} |`);
lines.push(`| 調査の組み合わせ × 同行者 | ${allRouteCombinations().length} 通り |`);
lines.push("");

lines.push("## 調査地点");
lines.push("");
lines.push("| ID | 場所 | 選択肢の文言 |");
lines.push("|---|---|---|");
for (const id of INVESTIGATION_IDS) {
  lines.push(
    `| \`${id}\` | ${investigationLabels[id].name} | ${investigationLabels[id].label} |`,
  );
}
lines.push("");

lines.push("## エンディング");
lines.push("");
lines.push("| ID | 番号 | 題名 | 条件 |");
lines.push("|---|---|---|---|");
for (const e of endings) {
  lines.push(`| \`${e.id}\` | ${e.number} | ${e.title} | ${e.condition} |`);
}
lines.push("");

lines.push("## 到達可能性");
lines.push("");
const all = allRouteCombinations();
const good = all.filter(({ pair, companion }) => hasAllTracks(buildState(pair, companion)));
const secret = all.filter(({ pair, companion }) => secretAvailable(buildState(pair, companion)));
lines.push(`- 三系統が揃う組み合わせ：**${good.length} / ${all.length}**`);
lines.push(`- いずれかの系統が不足：**${all.length - good.length} / ${all.length}**`);
lines.push(`- 秘密選択が提示される：**${secret.length} / ${all.length}**`);
lines.push("");
lines.push("詳細な表は `docs/branching.md` を参照。");
lines.push("");

lines.push("## 手掛かり");
lines.push("");
lines.push("| ID | 名称 | 系統 |");
lines.push("|---|---|---|");
const trackName = { past: "系統1 過去", access: "系統2 今夜の道", staging: "系統3 偽装" };
for (const c of clues) {
  lines.push(
    `| \`${c.id}\` | ${c.title} | ${c.track ? trackName[c.track] : "共通・秘密の鍵"} |`,
  );
}
lines.push("");

lines.push("## 場面一覧");
lines.push("");

function describeExits(n: StoryNode): string {
  const out: string[] = [];
  if (n.investigationHub) {
    out.push(`調査ハブ（未調査の地点／2か所終了で \`${n.investigationHub.afterHub}\`）`);
  }
  if (n.choices?.length) {
    for (const c of n.choices) {
      const cond = c.condition ? "【条件付き】" : "";
      out.push(`選択 ${cond}「${c.label}」→ \`${c.next}\``);
    }
  }
  if (n.nextCandidates) out.push(`状態分岐 → ${n.nextCandidates.map((x) => `\`${x}\``).join(" / ")}`);
  else if (n.next) out.push(`→ \`${n.next}\``);
  if (n.ending) out.push(`**終幕 \`${n.ending}\`**`);
  return out.join("<br>");
}

for (const chapter of chapters) {
  lines.push(`### ${chapter}`);
  lines.push("");
  for (const n of story.filter((x) => x.chapter === chapter)) {
    lines.push(`#### \`${n.id}\`　${n.location}`);
    lines.push("");
    const meta: string[] = [`背景 \`${n.scene}\``];
    if (n.speaker) meta.push(`話者 ${n.speaker}`);
    if (n.characters?.length) meta.push(`登場 ${n.characters.join("・")}`);
    if (n.addClues?.length) meta.push(`手掛かり ${n.addClues.map((c) => `\`${c}\``).join("・")}`);
    if (n.setFlags) meta.push(`フラグ ${Object.keys(n.setFlags).join("・")}`);
    if (n.audio?.length)
      meta.push(
        `音 ${n.audio
          .map((a) =>
            a.kind === "silence"
              ? `無音${a.durationMs}ms`
              : a.kind === "stop"
                ? "停止"
                : `${a.kind}:${a.asset}`,
          )
          .join("・")}`,
      );
    lines.push(meta.join("　/　"));
    lines.push("");
    for (const p of n.text) lines.push("> " + p);
    if (n.dynamicText) {
      lines.push(">");
      lines.push("> *（この場面には、証拠の揃い方に応じて差し込まれる段落がある）*");
    }
    lines.push("");
    const exits = describeExits(n);
    if (exits) {
      lines.push(exits);
      lines.push("");
    }
  }
}

writeFileSync(resolve(root, "docs/scenario.md"), lines.join("\n") + "\n");
console.log(`docs/scenario.md を生成しました（${story.length} 場面）`);
