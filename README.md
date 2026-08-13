# グローリア・スコット号 ― 三十年目の潮

ブラウザで遊べる日本語のミステリー・サウンドノベルです。

アーサー・コナン・ドイル『グローリア・スコット号』（*The "Gloria Scott"*, 1893／
著作権消滅）を原案に、若き日のシャーロック・ホームズが最初に手がけた事件として
再構成しました。分岐と六つの結末があります。

> ノーフォークの沼地。友人の父が、一枚の書付を読んで倒れた。
> 猟鳥の出荷についての、何の変哲もない業務連絡だった。
> ──道理がないということ自体が、この紙のいちばん大きな異常だった。

## ▶ 公開版

### https://isao5656-code.github.io/gloria-soundnovel/

スマートフォンでもそのまま遊べます。音は右上の「操作」→「音量」から入れてください
（ブラウザの制約で、最初のタップまで音は鳴りません）。

## 手元で動かす

```bash
npm install
npm run dev
# http://localhost:3000
```

公開版と同じ静的ファイルで確かめたいときは、書き出してから配信します。

```bash
npm run build      # out/ に静的サイトを書き出す
npm run preview    # http://localhost:3000
```

## 公開（GitHub Pages）

サーバーを必要としない完全な静的サイトなので、GitHub Pages にそのまま置けます。
`main` へマージすると `.github/workflows/pages.yml` が自動で公開します。

**初回だけ、リポジトリ側の設定が必要です。**
GitHub の `Settings` → `Pages` → `Build and deployment` → `Source` を
**`GitHub Actions`** に変更してください。ここが `Deploy from a branch` のままだと、
ワークフローは走っても公開されません。

設定後の公開先は `https://<ユーザー名>.github.io/<リポジトリ名>/` です。

プロジェクトページはサブディレクトリに置かれるため、ビルド時に
`NEXT_PUBLIC_BASE_PATH` でパスを前置します（ワークフローがリポジトリ名から自動で決めます）。
手元で公開版の状態を再現するには次のようにします。

```bash
NEXT_PUBLIC_BASE_PATH=/gloria-soundnovel npm run build
NEXT_PUBLIC_BASE_PATH=/gloria-soundnovel npm run preview
# http://localhost:3000/gloria-soundnovel/
```

素の `<img>` や CSS の `url()` には Next.js が basePath を自動で足しません。
画像を追加するときは必ず `lib/assets.ts` の `asset()` を通してください。

## 特徴

- **一周30〜45分**、全110場面、本文およそ15,000字
- **六つのエンディング**。良い結末は一本道ではなく、複数の経路から到達できる
- **調査4か所から2か所 × 同行者3ルート = 18通り**。すべての選択がどこかの判定に効く
- **実際に解ける暗号が二つ**。三語おきに読む規則と、拾いはじめる位置が一語ずれる仕掛け
- スマホ対応。折り畳み式の操作パネル、安全領域、短い縦画面への対応
- 文章履歴（読み返し専用）、手掛かり一覧、オート送り、既読スキップ、セーブ
- 音は外部素材を使わず Web Audio API で合成。無音・定位も仕様として実装
- 背景9枚・人物7体はスクリプトから生成するSVG

## 操作

| 入力 | 動作 |
|---|---|
| クリック／タップ | 全文表示、または次へ |
| Space ／ Enter | 全文表示、または次へ |
| →（右矢印） | 次へ |
| ←（左矢印） | 文章履歴を開く（読み返しのみ。巻き戻しはしない） |
| A | オート送りの切替 |
| S | 既読スキップの切替 |
| Ctrl+S ／ ⌘+S | 手動セーブ |
| Esc | 開いているパネルを閉じる |

選択肢の表示中に、Space や矢印キーで勝手に決定されることはありません。

## 構成

```
app/
  page.tsx            画面とゲームループ
  globals.css         レスポンシブ対応を含む画面設計
content/
  types.ts            物語データの型
  story.ts            シナリオ正本の組み立て
  story/*.ts          章ごとの本文
  branching.ts        分岐判定の正本（三系統・エンディング条件）
  clues.ts            手掛かり
  endings.ts          エンディング定義
lib/
  game.ts             ゲーム状態と遷移（UIから独立）
  audio.ts            Web Audio による音響エンジン
docs/
  scenario.md         全場面資料（自動生成）
  branching.md        18通りの表とエンディング条件
  timeline.md         時刻・場所・所持品の追跡
  location-map.md     舞台の物理モデル
public/
  scenes/  characters/   生成されたSVG
scripts/
  generate-art.mjs       画像生成
  generate-scenario.ts   docs/scenario.md 生成
tests/
  story-graph.test.ts    グラフ検証・アセット参照・必須の音響演出
  branching.test.ts      18通りの全列挙
  story-state.test.ts    通し実行・暗号の検証・本文と状態の一致
```

物語データ、実行ロジック、画面コードを分けてあるので、
シナリオを改稿してもUIを壊しにくくなっています。

分岐の判定は `content/branching.ts` の一か所だけで行います。
画面側で条件を再実装しないでください。

## 開発

```bash
npm run dev              開発サーバー
npm run build            静的書き出し（型検査を含む）→ out/
npm run preview          書き出した out/ を配信する
npm test                 68件のテスト
npm run lint             ESLint
npm run art              背景と人物シルエットを生成し直す
npm run docs:scenario    docs/scenario.md を生成し直す
```

`npm run art` と `npm run docs:scenario` の出力は決定的です。
CI が「生成物が最新か」を検査するので、生成スクリプトを直したときは
実行して差分をコミットしてください。

### CI

`.github/workflows/ci.yml` が、PR と `main` への push で
lint → test → build → 生成物の鮮度検査を回します。

`docs/scenario.md` は生成物です。手で編集せず、本文は `content/story/*.ts` を直してください。

### テストが守っていること

- 存在しない遷移先がない／到達不能な場面がない／終わらない循環がない
- 六つのエンディングすべてに到達できる
- 条件付き選択肢が永久に表示不能になっていない
- 18通りの証拠系統・秘密選択・告発先が、仕様表と一致する
- 作中の暗号が、書かれているとおりに実際に解ける
- 入手していない証拠を終幕で提示しない
- 選んでいない同行者の行動を地の文が断定しない

## セーブについて

進行は `localStorage`（`gloria-save-v1`、`gloria-endings-v1`）に保存します。
同じ端末・同じブラウザの中だけの記録で、**端末間の同期はしません**。

## 原案と権利について

原案はアーサー・コナン・ドイル『グローリア・スコット号』（1893年）で、
著作権は消滅しています。

本作の日本語本文、分岐構造、追加人物、結末、暗号、画像はすべて本作のために
書き下ろしたものです。既存の翻訳を転載・改変したものではありません。

原作からの主な変更点：

- 事件全体をマルチエンディングの推理ゲームとして再構成した
- ハドスンの失踪を殺人事件として扱い、証拠と告発の構造を新設した
- 暗号を日本語で成立する形に作り直した（三語おきに読む規則）
- 三十年前の爆発の真相を、秘密エンディングとして書き下ろした
- フォーダム医師を同行者ルートおよび誤答の対象として拡張した
- 読みやすさを優先し、全体を現代日本語で書いた
