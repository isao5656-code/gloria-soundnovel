import type { StoryNode } from "../types";
import { hasAllTracks, secretAvailable, tracksOf } from "../branching";

/**
 * 第五章「三十年目の潮」と六つの終幕。
 *
 * 最終選択の遷移先は、判定を content/branching.ts に集約するため、
 * ここでは「告発の宛先」ごとの入口場面へ分けるだけにする。
 * 系統の充足で分岐するのはビードウズ告発のみ（final_beddoes）。
 */
export const chapter5Nodes: StoryNode[] = [
  {
    id: "c5_0",
    chapter: "第五章",
    location: "舟着き場",
    scene: "fen",
    characters: ["holmes", "victor", "fordham"],
    text: [
      "日が落ちる前に、村の巡査が二人と、フォーダム医師が舟着き場に来た。",
      "遺体は戸板に載せられ、帆布がかけられた。誰も口をきかなかった。沼の水が板を叩く音だけが続いた。",
      "巡査部長がわたしのほうを向いて言った。「学生さん。あんた、何か言うことがあるって聞いたが」",
      "わたしは十九歳だった。この土地に何の縁もなく、肩書きもなく、ここまでの二日で得たものしか持っていなかった。",
    ],
    dynamicText: (s) => {
      const t = tracksOf(s);
      const have: string[] = [];
      if (t.past) have.push("三十年前の船");
      if (t.access) have.push("よそ者の通った道");
      if (t.staging) have.push("消えた男の残したもの");
      return have.length === 3
        ? [
            "手の内は三つ。三十年前の船。よそ者の通った道。消えた男の残したもの。どれ一つ欠けても、相手は言い逃れる。三つ揃っていれば、逃げ道はない。",
          ]
        : [
            `手の内にあるのは、${have.length === 0 ? "共通の事実だけ" : have.join("と")}だ。足りない穴は、こちらが黙っていても向こうが必ず突いてくる。`,
          ];
    },
    audio: [{ kind: "bgm", asset: "confront", volume: 0.4 }],
    next: "c5_1",
  },
  {
    id: "c5_1",
    chapter: "第五章",
    location: "舟着き場",
    speaker: "ホームズ",
    scene: "fen",
    characters: ["holmes"],
    text: ["何を言うか。ここで口にしたことが、この事件の結末になる。"],
    choices: [
      {
        label: "ハンプシャーのビードウズ氏の名を出す",
        next: "final_beddoes",
      },
      {
        label: "この四日間、屋敷に自由に出入りできた人物を指す",
        next: "final_fordham",
      },
      {
        label: "ハドスンを殺した者はおらず、別人の死体だと述べる",
        next: "final_runaway",
      },
      {
        label: "何も言わず、手記のことも伏せる",
        next: "final_silent",
      },
      {
        label: "──その前に、手記の最後の一葉をもう一度見る",
        next: "secret_0",
        condition: (s) => secretAvailable(s),
        note: "秘密選択。三系統＋cipher_key のときだけ表示する",
      },
    ],
  },

  // ── ビードウズ告発 ────────────────────────
  {
    id: "final_beddoes",
    chapter: "第五章",
    location: "舟着き場",
    speaker: "ホームズ",
    scene: "fen",
    characters: ["holmes"],
    text: [
      "「ハンプシャーの、ビードウズという地主を手配してください」",
      "巡査部長の眉が動いた。「ハンプシャー。ここから百五十マイルあるが」",
      "「その男は四日前の朝、現金と旅券を持って家を出ています。行き先を告げずに。そして四日前の深夜、この舟着き場から舟が一艘、名前を書かずに出ています」",
    ],
    audio: [{ kind: "se", asset: "heartbeat", volume: 0.45 }],
    next: "final_beddoes_1",
  },
  {
    id: "final_beddoes_1",
    chapter: "第五章",
    location: "舟着き場",
    speaker: "ホームズ",
    scene: "fen",
    characters: ["holmes", "victor"],
    text: [
      "「あの男は三つのことを言うでしょう」わたしは続けた。",
      "「一つ。トレヴァー氏とは縁もゆかりもない、ただの文通相手だと」",
      "「二つ。四日前はハンプシャーの自宅にいたと」",
      "「三つ。ハドスンは自分の足でこの家を出た、事件など起きていないと」",
    ],
    next: "final_beddoes_2",
  },
  {
    id: "final_beddoes_2",
    chapter: "第五章",
    location: "舟着き場",
    scene: "fen",
    characters: ["holmes"],
    text: ["わたしは、自分の手の内を並べた。"],
    dynamicText: (s) => {
      const out: string[] = [];
      const t = tracksOf(s);
      if (s.clues.has("ledger_name"))
        out.push(
          "「一つ目には、これを。一八五五年のロンドンの銀行の名簿です。ジェイムズ・アーミテージ。トレヴァー氏の本名で、肘に消し残った二文字と一致します」",
        );
      else if (s.clues.has("news_clip"))
        out.push(
          "「一つ目には、これを。三十年前の新聞です。グローリア・スコット号、爆発沈没、生存者は水夫一名──ハドスン。そこに帆布をかぶって寝ている男です」",
        );
      else if (s.clues.has("fordham_note"))
        out.push(
          "「一つ目には、これを。フォーダム先生の父上が残した診療録です。この土地に来たばかりのトレヴァー氏の掌は、鉱夫の手ではなく、索を引いた水夫の手だった」",
        );
      else
        out.push(
          "「一つ目については……手記があります。ですがこれは、故人が自分で書いた紙一枚にすぎません」",
        );

      if (s.clues.has("red_clay"))
        out.push(
          "「二つ目には、この土を。舟着き場の板の隙間から出ました。白亜層の赤い粘土で、この沼の泥ではありません」",
        );
      else if (s.clues.has("hired_gig"))
        out.push(
          "「二つ目には、フォーダム先生の証言を。四日前の深夜、県道で二頭立ての貸馬車とすれ違い、馬の脚に赤い土が跳ねていた」",
        );
      else if (s.clues.has("sailors_knot"))
        out.push(
          "「二つ目には、この結び目を。陸の人間はこの結びを使いません。四日前の夜、この杭に舟を繋いだのは船に乗ったことのある男です」",
        );
      else
        out.push(
          "「二つ目については……申し上げられることがありません。誰かがここまで来た痕跡を、わたしは掴んでいない」",
        );

      if (s.clues.has("hudson_kit"))
        out.push(
          "「三つ目には、この袋を。ハドスンの荷物です。着替えも剃刀も、四か月ぶんの金も、全部置いてある。自分の足で出た男の部屋ではありません」",
        );
      else if (s.clues.has("tide_table") && s.clues.has("boat_log"))
        out.push(
          "「三つ目には、潮見表と舟番の帳面を。水路が通れるのは午前二時前後だけです。その夜、名を書かずに出た舟が一艘あり、夜明け前に戻っている」",
        );
      else if (s.flags.trustVictor)
        out.push(
          "「三つ目には、ご子息の証言を。ハドスンは金をせびりに来たのではない。『もう一度あれをやろう』と言いに来たのです」",
        );
      else if (s.flags.alone)
        out.push(
          "「三つ目には、わたし自身が見たものを。昨夜、水路を舟が往復しました。行きは重く、帰りは軽かった。四日前の夜も同じことが起きています」",
        );
      else
        out.push(
          "「三つ目については……ハドスンが去った夜のことを、わたしは何も掴んでいません」",
        );

      if (!t.past || !t.access || !t.staging) {
        out.push("巡査部長は、しばらくわたしの顔を見ていた。");
      }
      return out;
    },
    nextBy: (s) => (hasAllTracks(s) ? "end_tide_0" : "end_grey_0"),
    nextCandidates: ["end_tide_0", "end_grey_0"],
  },

  // ── END 01 三十年目の潮 ───────────────────
  {
    id: "end_tide_0",
    chapter: "終幕",
    location: "舟着き場",
    scene: "fen",
    characters: ["holmes"],
    text: [
      "巡査部長は帽子を取って、汗をぬぐった。",
      "「学生さん。あんた、それを全部その頭に入れて歩いてたのかね」",
      "「二日ぶんです」",
      "その夜のうちに、ノーフォークからハンプシャー、そしてサウサンプトンの港へ電信が飛んだ。",
    ],
    audio: [{ kind: "bgm", asset: "elegy", volume: 0.35, fadeMs: 2000 }],
    next: "end_tide_1",
  },
  {
    id: "end_tide_1",
    chapter: "終幕",
    location: "サウサンプトン",
    scene: "dawn",
    characters: ["beddoes"],
    text: [
      "ビードウズは、翌朝の潮でリスボンへ発つ貨客船の、二等の船室で見つかった。",
      "抵抗はしなかったという。名前を確かめられたとき、彼はこう答えたそうだ。",
      "「エヴァンズだ。三十年ぶりに、その名前で呼ばれた」",
    ],
    next: "end_tide_2",
  },
  {
    id: "end_tide_2",
    chapter: "終幕",
    location: "法廷",
    speaker: "ビードウズ",
    scene: "dawn",
    characters: ["beddoes"],
    text: [
      "裁判で、彼は事実をほとんど争わなかった。",
      "「あの男は、わたしとトレヴァーに、もう一度やろうと言った。三十年前と同じことを、今度は保険をかけた船でやろうと」",
      "「トレヴァーは断った。断ったから、あの男はわたしのところへ来ると言った。……あの男が来る前に、わたしがあの沼へ行ったのです」",
      "「トレヴァーには逃げてほしかった。だからあの手紙を書いた。あの読み方は、三十年前、小舟の上で二人で決めたものです」",
    ],
    audio: [{ kind: "silence", durationMs: 2000 }],
    next: "end_tide_3",
  },
  {
    id: "end_tide_3",
    chapter: "終幕",
    location: "ドニソープ",
    scene: "dawn",
    characters: ["holmes", "victor"],
    text: [
      "判決は殺人罪。情状を認められて、絞首は免れた。",
      "ヴィクターは屋敷を売り、インドのテライで茶の栽培を始めた。年に二度、手紙が来る。事業は順調だと書いてある。父のことは、一度も書いてこない。",
      "そしてわたしは、その冬に、ロンドンの下宿を探しはじめた。",
      "人の靴の泥を読む男に、この世に居場所があるかもしれないと、はじめて思ったからだ。",
    ],
    ending: "tide",
    audio: [{ kind: "bgm", asset: "elegy", volume: 0.4 }],
  },

  // ── END 02 灰色の朝 ───────────────────────
  {
    id: "end_grey_0",
    chapter: "終幕",
    location: "舟着き場",
    speaker: "ホームズ",
    scene: "fen",
    characters: ["holmes"],
    text: [
      "「……なるほど」巡査部長は帽子をかぶり直した。「筋は通っとる。だがな、学生さん」",
      "「その筋を、ハンプシャーの治安判事の前で言ってみなさい。あんたはまだ学校の身分だ。向こうは領地持ちの紳士だ」",
      "「証拠が要るんだよ。話じゃなくて、物が」",
    ],
    dynamicText: (s) => {
      const t = tracksOf(s);
      const holes: string[] = [];
      if (!t.past)
        holes.push(
          "──ビードウズとトレヴァー老人が三十年前に同じ船にいたことを、わたしは老人の手記以外で示せなかった。故人の書いた紙は、故人の弁明にすぎないと言われれば、それまでだった。",
        );
      if (!t.access)
        holes.push(
          "──ハンプシャーの男がこの沼まで来た痕跡を、わたしは一つも掴んでいなかった。百五十マイルは、言葉だけで越えられる距離ではない。",
        );
      if (!t.staging)
        holes.push(
          "──ハドスンがあの夜、自分の足で屋敷を出たのではないことを、わたしは証明できなかった。それが崩れれば、この死は行きずりの殺しになる。",
        );
      return holes;
    },
    audio: [{ kind: "bgm", asset: "elegy", volume: 0.3, fadeMs: 2000 }],
    next: "end_grey_1",
  },
  {
    id: "end_grey_1",
    chapter: "終幕",
    location: "ドニソープ",
    scene: "dawn",
    characters: ["holmes"],
    text: [
      "捜査は一週間で細り、一か月で止まった。",
      "身元不明の水夫が沼で見つかった、という記録が残っただけだ。ビードウズの名は、どの調書にも出てこない。",
      "リスボン行きの船は、わたしが名前を出した三日後に出港した。誰も乗客名簿を確かめなかった。",
    ],
    next: "end_grey_2",
  },
  {
    id: "end_grey_2",
    chapter: "終幕",
    location: "ベイカー街 221B",
    speaker: "ホームズ",
    scene: "college",
    characters: ["holmes"],
    text: [
      "「ぼくは正しかったんだ、ワトスン。名前も、動機も、方法も、全部合っていた」",
      "「では、何が足りなかった」",
      "「足りなかったのは、正しさを他人に手渡すための形だよ」",
      "ホームズは紙束を膝に戻した。「あの朝、ぼくは十九だった。正しいだけでは何も動かないということを、あの灰色の朝に教わったんだ」",
      "「その代わり、ぼくは二度と同じ失敗をしなかった」",
    ],
    ending: "grey",
    audio: [{ kind: "bgm", asset: "elegy", volume: 0.35 }],
  },

  // ── END 04 白い手袋 ───────────────────────
  {
    id: "final_fordham",
    chapter: "第五章",
    location: "舟着き場",
    speaker: "ホームズ",
    scene: "fen",
    characters: ["holmes", "fordham"],
    text: [
      "「この四日間、屋敷に誰よりも自由に出入りしていた人がいます」",
      "わたしはフォーダム医師を見た。白い手袋が、灯の下で妙に鮮やかだった。",
      "「先生は臨終に立ち会われた。夜中の往診の口実で、いつでも県道を通れた。そして誰よりも、トレヴァー氏の身体の秘密をご存じだった」",
    ],
    audio: [{ kind: "se", asset: "heartbeat", volume: 0.45 }],
    next: "end_gloves_0",
  },
  {
    id: "end_gloves_0",
    chapter: "終幕",
    location: "舟着き場",
    speaker: "フォーダム医師",
    scene: "fen",
    characters: ["fordham"],
    text: [
      "医師は、手袋を外さなかった。ただ、ひどく疲れた顔でわたしを見た。",
      "「わたしがこの手袋をしているのはね、学生さん。二十年前に硝酸で焼いて、指の皮膚が薄いからです」",
      "「四日前の晩、わたしは牧師館で子どもの肺炎を看ておりました。牧師とその奥さんと、看護婦が一晩じゅう一緒でした」",
      "巡査部長が咳払いをした。「先生の言うとおりですよ。あの晩は村じゅうが知っとる」",
    ],
    audio: [
      { kind: "stop", fadeMs: 600 },
      { kind: "silence", durationMs: 2400 },
    ],
    next: "end_gloves_1",
  },
  {
    id: "end_gloves_1",
    chapter: "終幕",
    location: "ドニソープ",
    scene: "dawn",
    characters: ["holmes"],
    text: [
      "わたしはその夜、屋敷の書斎で一睡もしなかった。",
      "近くにいた者を疑うのは易しい。近くにいたという事実は、いつでも手元にあるからだ。だがそれは、手元にあるというだけの理由で選ばれた答えだった。",
      "ハンプシャーへの電報を打ったのは、二日後だった。返事は来なかった。執事はすでに暇を出され、屋敷は閉められていた。",
    ],
    next: "end_gloves_2",
  },
  {
    id: "end_gloves_2",
    chapter: "終幕",
    location: "ベイカー街 221B",
    speaker: "ホームズ",
    scene: "college",
    characters: ["holmes"],
    text: [
      "「フォーダム先生には、翌朝に詫びに行った。先生は怒らなかった。それがいちばん応えたな」",
      "「先生はこう言ったよ。『若い人は、いちばん近い扉から開けるものです。わたしもそうでした』」",
      "「ぼくはあの日から、いちばん近い扉を最後に開けることにしている」",
      "帆布をかけられた男の名は、ついに調書に記されなかった。",
    ],
    ending: "gloves",
    audio: [{ kind: "bgm", asset: "elegy", volume: 0.35 }],
  },

  // ── END 05 逃げた男 ───────────────────────
  {
    id: "final_runaway",
    chapter: "第五章",
    location: "舟着き場",
    speaker: "ホームズ",
    scene: "fen",
    characters: ["holmes"],
    text: [
      "「この男はハドスンではないと思います」",
      "わたしは自分の声が、思ったより自信に満ちて響くのを聞いた。",
      "「水に四日浸かった顔で、人相を決めるのは危険です。ハドスンは金を持って逃げた。追うべきはハンプシャーではなく、港でしょう」",
    ],
    audio: [{ kind: "se", asset: "heartbeat", volume: 0.4 }],
    next: "end_runaway_0",
  },
  {
    id: "end_runaway_0",
    chapter: "終幕",
    location: "ドニソープ",
    scene: "fen",
    characters: ["holmes", "victor"],
    text: [
      "捜査はハドスンの捜索として始まった。",
      "港という港に人相書きが回り、乗船名簿が調べられた。生きている男を探すために、二週間が費やされた。",
      "十一日目に、遺体の右手の骨が調べられ、腱が古い外傷で癒着していることがわかった。索を引く手だ。半分しか開かない手だ。",
      "それはハドスンだった。",
    ],
    audio: [
      { kind: "stop", fadeMs: 500 },
      { kind: "silence", durationMs: 2200 },
      { kind: "bgm", asset: "elegy", volume: 0.3, fadeMs: 2000 },
    ],
    next: "end_runaway_1",
  },
  {
    id: "end_runaway_1",
    chapter: "終幕",
    location: "サウサンプトン",
    scene: "dawn",
    text: [
      "その十一日のあいだに、リスボン行きの貨客船が二便、ボルドー行きが一便、出ていた。",
      "ビードウズという名の紳士は、どの名簿にもなかった。当然だ。三十年前に一度、名前を捨てられた男だ。二度目は易しい。",
      "彼はその後、二度と消息を絶たなかった。──こちらが探すのをやめたからだ。",
    ],
    next: "end_runaway_2",
  },
  {
    id: "end_runaway_2",
    chapter: "終幕",
    location: "ベイカー街 221B",
    speaker: "ホームズ",
    scene: "college",
    characters: ["holmes"],
    text: [
      "「間違いは、二つあった」ホームズは言った。",
      "「一つは、死体の顔で人を決めようとしたこと。もう一つは──いちばん認めたくないほうだが──あの男に逃げてほしいと、どこかで思っていたことだ」",
      "「なぜ」",
      "「息子がいたからさ。友人の父親の家から、絞首台に上がる男を出したくなかった。……そういう願いは、推理の顔をしてやってくる」",
      "「探偵にとって、それがいちばん高くつく」",
    ],
    ending: "runaway",
    audio: [{ kind: "bgm", asset: "elegy", volume: 0.35 }],
  },

  // ── END 03 テライ行きの船 ─────────────────
  {
    id: "final_silent",
    chapter: "第五章",
    location: "舟着き場",
    speaker: "ホームズ",
    scene: "fen",
    characters: ["holmes", "victor"],
    text: [
      "わたしはヴィクターを見た。",
      "父を昨日亡くし、その父の手記を今朝読んだばかりの男が、帆布のかかった戸板の前に立っている。",
      "ここで一つの名前を出せば、この家の三十年が、明日の新聞の一段になる。人が殺されるのを見ていた男の家として。",
      "「……何もありません」わたしは巡査部長に言った。「身元がわかれば、また来ます」",
    ],
    audio: [
      { kind: "stop", fadeMs: 800 },
      { kind: "silence", durationMs: 2600 },
    ],
    next: "end_terai_0",
  },
  {
    id: "end_terai_0",
    chapter: "終幕",
    location: "書斎",
    scene: "study",
    characters: ["holmes", "victor"],
    text: [
      "その夜、書斎の暖炉で、わたしたちは手記を焼いた。",
      "紙が反り返り、父の字が一行ずつ縮んで消えていくのを、ヴィクターは最後まで見ていた。最後の一葉が灰になったとき、彼ははじめて泣いた。",
      "猟場の書付だけは、わたしが貰った。",
    ],
    audio: [
      { kind: "se", asset: "match", volume: 0.5 },
      { kind: "bgm", asset: "elegy", volume: 0.3, fadeMs: 2500 },
    ],
    next: "end_terai_1",
  },
  {
    id: "end_terai_1",
    chapter: "終幕",
    location: "ドニソープ",
    scene: "dawn",
    characters: ["victor"],
    text: [
      "調書には、身元不明の水夫が沼で発見されたとだけ記された。",
      "ヴィクターは屋敷を売り、春にインドへ渡った。テライの茶園で、彼は今も成功している。",
      "別れの日、駅の柵ごしに彼は言った。「ホームズ。きみは黙っててくれた。でも、忘れちゃいないだろう」",
      "「忘れないよ」",
      "「それでいい。ぼくの代わりに、きみが覚えててくれ」",
    ],
    next: "end_terai_2",
  },
  {
    id: "end_terai_2",
    chapter: "終幕",
    location: "ベイカー街 221B",
    speaker: "ワトスン",
    scene: "college",
    characters: ["holmes"],
    text: [
      "「後悔しているのかい」",
      "ホームズは長いこと火を見ていた。",
      "「後悔はしていない。ただ、あれ以来ずっと考えている。あのとき黙ったのは、友人のためだったのか、それとも──友人を失いたくない自分のためだったのか」",
      "「その二つは、そんなに違うものかね」",
      "「違うよ、ワトスン。片方は献身で、片方は取引だ。ぼくがどちらだったのか、いまだにわからない」",
      "膝の上には、色の褪せた紙が一枚だけ残っていた。",
    ],
    ending: "terai",
    audio: [{ kind: "bgm", asset: "elegy", volume: 0.35 }],
  },

  // ── END 06 火薬庫の返事（秘密） ───────────
  {
    id: "secret_0",
    chapter: "第五章",
    location: "舟着き場",
    speaker: "ホームズ",
    scene: "fen",
    characters: ["holmes"],
    text: [
      "「少しだけ待ってください」",
      "わたしは外套の内から手記を出した。ずっと引っかかっていたことがある。",
      "最後の頁の、下三分の一。老人は書くのをやめたのではない。あそこには、はじめから別のものが貼ってあったのだ。",
      "灯にかざすと、最後の一葉の裏に、糊で留められた薄い紙が透けて見えた。",
    ],
    audio: [
      { kind: "stop", fadeMs: 600 },
      { kind: "silence", durationMs: 2000 },
    ],
    next: "secret_1",
  },
  {
    id: "secret_1",
    chapter: "第五章",
    location: "舟着き場",
    scene: "fen",
    characters: ["holmes"],
    text: [
      "剥がした紙は、海水を吸って乾いた跡があった。塩の輪が、縁に沿って白く残っている。",
      "文字は鉛筆で、ひどく震えていた。船の上で、揺れながら書いたものだ。",
      "『積荷火薬ノ件、貴信三十樽拝受。船倉底ノ通風手当ノ儀済ミタリ。出港明後日ト相成、決行ノ上ハ精算サレタシ』",
      "──積荷の受け取りと出港の連絡。それだけに見える。",
    ],
    audio: [{ kind: "se", asset: "paper", volume: 0.45 }],
    next: "secret_2",
  },
  {
    id: "secret_2",
    chapter: "第五章",
    location: "舟着き場",
    speaker: "ホームズ",
    scene: "fen",
    characters: ["holmes"],
    text: [
      "わたしは語に番号を振った。ここでも二十四。",
      "書付と同じ規則で、一番目から三つおきに拾う。一、四、七、十、十三、十六、十九、二十二。",
      "積荷 ／ 貴信 ／ 船倉 ／ 通風 ／ 儀 ／ 出港 ／ 相成 ／ 上ハ",
      "意味をなさない。──だが、間隔が違うのではない。違うのは、拾いはじめる場所だ。",
      "一つずらす。二、五、八、十一、十四、十七、二十、二十三。",
    ],
    audio: [{ kind: "se", asset: "heartbeat", volume: 0.5 }],
    next: "secret_3",
  },
  {
    id: "secret_3",
    chapter: "第五章",
    location: "舟着き場",
    scene: "ship",
    characters: ["hudson"],
    text: [
      "火薬 ／ 三十樽 ／ 底 ／ 手当 ／ 済 ／ 明後日 ／ 決行 ／ 精算",
      "灯の下で、わたしは自分の指が止まるのを見た。",
      "『火薬三十樽、底に手当済。明後日決行。精算』",
    ],
    audio: [
      { kind: "stop", fadeMs: 400 },
      { kind: "silence", durationMs: 3000 },
      { kind: "bgm", asset: "memoir", volume: 0.3, fadeMs: 2500 },
    ],
    next: "secret_4",
  },
  {
    id: "secret_4",
    chapter: "第五章",
    location: "舟着き場",
    speaker: "ホームズ",
    scene: "ship",
    characters: ["hudson", "prendergast"],
    text: [
      "船が沈む前の日に、誰かが誰かへ宛てて、火薬庫に「手当」をすることを請け合っている。そして、明後日に精算する、と。",
      "船は、その明後日に爆発した。",
      "囚人たちは船を奪った。だが火薬庫に火を入れたのは、囚人ではない。囚人には、精算する相手がいない。",
      "水夫のハドスンには、いた。",
    ],
    next: "secret_5",
  },
  {
    id: "secret_5",
    chapter: "第五章",
    location: "舟着き場",
    speaker: "ホームズ",
    scene: "ship",
    characters: ["hudson"],
    text: [
      "グローリア・スコット号は保険のかかった船だった。囚人輸送で儲け、沈めばもう一度儲かる。プレンダーガストが船を買収していたように、船を沈めたい者も、船の中に手を持っていた。",
      "ハドスンは、そのために雇われた男だ。",
      "囚人の反乱は、彼にとって天からの贈り物だった。反乱の火薬庫爆発なら、誰も保険を疑わない。彼は反乱の夜を待ち、火を入れ、そして自分だけが浮くように、あらかじめ樽に括りつける索を用意していた。",
      "──輪を二重に通し、端を折り返して差し込む結び方で。",
    ],
    audio: [{ kind: "se", asset: "rope", volume: 0.4, pan: -0.3 }],
    next: "secret_6",
  },
  {
    id: "secret_6",
    chapter: "終幕",
    location: "舟着き場",
    scene: "fen",
    characters: ["holmes", "victor"],
    text: [
      "この紙は、爆発の翌朝、小舟の上で拾われたのだ。海に浮いていた無数の紙の一枚として。",
      "アーミテージは──トレヴァー老人は、三十年前にこれを読んでいた。読んで、規則を見つけて、そして黙っていた。",
      "彼が恐れていたのは強請ではなかった。ハドスンに金を払い続けたのは、口を封じるためではない。",
      "自分が三十年前、あの九十人を殺した男を、海から引き上げて生かしてしまったことを、認めたくなかったからだ。",
    ],
    audio: [{ kind: "bgm", asset: "elegy", volume: 0.35, fadeMs: 2000 }],
    next: "secret_7",
  },
  {
    id: "secret_7",
    chapter: "終幕",
    location: "舟着き場",
    speaker: "ホームズ",
    scene: "fen",
    characters: ["holmes"],
    text: [
      "わたしは巡査部長に、ハンプシャーのビードウズの名を告げた。",
      "そして、もう一枚の紙を差し出した。「これも一緒に。──三十年前、九十一人が死んだ件の、最初の一枚です」",
      "ビードウズはサウサンプトンで捕まった。裁判で、彼は最後にこう言った。",
      "「あの紙のことは知らなかった。トレヴァーは、三十年、わたしにも黙っていたのですな」",
    ],
    next: "secret_8",
  },
  {
    id: "secret_8",
    chapter: "終幕",
    location: "ドニソープ",
    scene: "dawn",
    characters: ["holmes", "victor"],
    text: [
      "海難審判の記録は、その冬に一度だけ書き換えられた。",
      "一八五五年十一月、グローリア・スコット号。事故原因、火薬庫爆発。──のうしろに、一行が足された。『放火の疑いあり。関係者死亡につき、これ以上の追及を要せず』",
      "たった一行だ。だがその一行のために、九十一人は「行方不明」から「殺された」に変わった。",
      "三十年、誰も返事を書かなかった手紙に、ようやく返事が届いたのだ。",
    ],
    audio: [{ kind: "silence", durationMs: 2200 }],
    next: "secret_9",
  },
  {
    id: "secret_9",
    chapter: "終幕",
    location: "ベイカー街 221B",
    speaker: "ホームズ",
    scene: "college",
    characters: ["holmes"],
    text: [
      "「これがぼくの最初の事件だよ、ワトスン」",
      "ホームズは二通の紙を封筒に戻し、蝋を押し直すこともせずに、そのまま抽斗へしまった。",
      "「ぼくはこの二日で、二つのことを覚えた。一つは、人は自分の罪より、自分の見て見ぬふりのほうを深く隠すということ」",
      "「もう一つは」",
      "「規則がわかれば、三十年前の海の上からでも、こちらに話しかけてくる者がいるということだ」",
      "暖炉の火が、一度だけ大きく鳴った。",
    ],
    ending: "powder",
    audio: [{ kind: "bgm", asset: "elegy", volume: 0.4 }],
  },
];
