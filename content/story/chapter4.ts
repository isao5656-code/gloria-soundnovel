import type { StoryNode } from "../types";
import { tracksOf } from "../branching";

/**
 * 第四章「三語おき」
 *
 * 合流点。書付の解読、ビードウズ照会、そして沼での発見。
 * 同行者ルートは c4_0 で合流するため、ここから先の遷移は一本になる。
 */
export const chapter4Nodes: StoryNode[] = [
  {
    id: "c4_0",
    chapter: "第四章",
    location: "書斎",
    speaker: "ホームズ",
    scene: "study",
    characters: ["holmes"],
    text: [
      "朝の光が入る頃、わたしは書斎の卓に戻り、あの猟場の書付をもう一度広げた。",
      "『猟期も半ば、終了まで三週。ハドスンより報せあり。全部で五十羽、白状すれば少ない。至急、追加の逃亡防止網、手配を乞う。』",
      "この文には、二つの奇妙な点がある。",
      "一つ。ハンプシャーの地主が、ノーフォークの治安判事に、猟場の網の手配を頼む理由がない。",
      "二つ。文の切れ方が、話し言葉として不自然だ。誰かが、言葉を置く場所を決めながら書いている。",
    ],
    dynamicText: (s) =>
      s.clues.has("cipher_key")
        ? [
            "そして机の書き損じには、老人自身が同じ文面に縦線を引いて数えていた紙があった。",
            "老人は規則を知っていた。だから読めた。だから倒れた。",
          ]
        : [
            "老人がこれを一読しただけで倒れたということは、老人には読み方がわかっていたということだ。",
            "つまり、二人のあいだにはあらかじめ決めた約束がある。",
          ],
    audio: [
      { kind: "bgm", asset: "unease", volume: 0.3 },
      { kind: "se", asset: "paper", volume: 0.45 },
    ],
    next: "c4_1",
  },
  {
    id: "c4_1",
    chapter: "第四章",
    location: "書斎",
    speaker: "ホームズ",
    scene: "study",
    characters: ["holmes"],
    text: [
      "隠された文を紙に混ぜる方法は、そう多くない。",
      "頭文字を拾う。裏に炙り出しを書く。あるいは──決まった間隔で語を拾う。",
      "わたしは書付の語に、端から番号を振った。全部で二十四。二十四は、二でも三でも四でも割り切れる。",
      "二語おきに読んだ。意味をなさない。四語おきに読んだ。意味をなさない。",
      "三語おきに読んだ。",
    ],
    audio: [{ kind: "silence", durationMs: 2000 }],
    next: "c4_2",
  },
  {
    id: "c4_2",
    chapter: "第四章",
    location: "書斎",
    scene: "study",
    characters: ["holmes"],
    text: [
      "一番目の語から、三つおきに拾う。一、四、七、十、十三、十六、十九、二十二。",
      "猟期 ／ 終了 ／ ハドスン ／ 全部 ／ 白状 ／ 至急 ／ 逃亡 ／ 手配",
      "「猟期終了。ハドスン全部白状。至急逃亡手配」",
      "──猟は終わりだ。ハドスンが全部しゃべった。すぐに逃げる手配をしろ。",
    ],
    addClues: ["cipher_solved"],
    setFlags: { brokeCipher: true },
    audio: [{ kind: "se", asset: "heartbeat", volume: 0.5 }],
    next: "c4_3",
  },
  {
    id: "c4_3",
    chapter: "第四章",
    location: "書斎",
    speaker: "ホームズ",
    scene: "study",
    characters: ["holmes", "victor"],
    text: [
      "「猟期」という語が最初に来るのは、偶然ではない。書いた男は、この一語に二つの意味を持たせている。表では鳥を撃つ季節のこと、裏では──三十年続いた狩りのことだ。",
      "「これは脅迫状じゃない」わたしはヴィクターに言った。「警告だ。書いた人間は、きみのお父上に逃げてほしかった」",
      "「じゃあ、誰が」",
      "「三十年前、もう一艘のボートに乗っていた男だ。ハンプシャーのビードウズ氏。手記に出てくるエヴァンズだよ」",
    ],
    audio: [{ kind: "bgm", asset: "confront", volume: 0.35 }],
    next: "c4_4",
  },
  {
    id: "c4_4",
    chapter: "第四章",
    location: "郵便局",
    scene: "village",
    characters: ["holmes"],
    text: [
      "午前中に、ハンプシャーへ電報を打った。ビードウズ氏本人あてに、トレヴァー氏死去を知らせる文面で。",
      "返事は昼過ぎに来た。差出人は執事だった。",
      "『主人ハ四日前ノ朝ヨリ不在 行先ヲ告ゲズ 現金ト旅券ヲ持チ出セリ 使用人一同困惑ノ由』",
      "四日前の朝。ハドスンがこの屋敷から消えた、その翌朝である。",
    ],
    audio: [{ kind: "se", asset: "paper", volume: 0.45 }],
    next: "c4_5",
  },
  {
    id: "c4_5",
    chapter: "第四章",
    location: "書斎",
    speaker: "ホームズ",
    scene: "study",
    characters: ["holmes"],
    text: [
      "ここまでで、順序が逆であることに気づかねばならない。",
      "ハドスンは「ハンプシャーへ行く」と言って屋敷を出た。ならば彼がビードウズ邸に着くのは、早くて翌日の夕方だ。",
      "だがビードウズは、その翌朝にはもう逃げている。ハドスンが到着するより前に。",
      "ビードウズは、ハドスンが来ることを知っていた。そして──ハドスンが来ないことも知っていた。",
    ],
    audio: [{ kind: "se", asset: "heartbeat", volume: 0.4 }],
    next: "c4_6",
  },
  {
    id: "c4_6",
    chapter: "第四章",
    location: "沼の水路",
    scene: "fen",
    characters: ["holmes", "victor"],
    text: [
      "その日の夕方、干潮に合わせて、わたしたちは平底舟を出した。",
      "水路は葦の壁に挟まれた細い溝で、櫂の先が両岸に届く場所もある。深いのは真ん中だけだ。ここに沈めたものは、海へは流れない。潮が引いても、沼へは戻らない。",
      "屋敷から三百ヤード。水路がいちばん深くなる曲がり角で、竿の先が柔らかいものに触れた。",
    ],
    audio: [
      { kind: "bgm", asset: "quiet_fen", volume: 0.25 },
      { kind: "se", asset: "fen_water", volume: 0.5 },
      { kind: "se", asset: "oar", volume: 0.35, pan: -0.3 },
    ],
    next: "c4_7",
  },
  {
    id: "c4_7",
    chapter: "第四章",
    location: "沼の水路",
    scene: "fen",
    characters: ["holmes", "victor"],
    text: [
      "引き上げるのに、二人がかりで二十分かかった。",
      "四日、水に浸かっていた。それでも、前歯が二本欠けていることと、右手が半分閉じたまま伸びないことは、はっきりわかった。",
      "ヴィクターは舟縁を掴んだまま、顔を背けた。",
      "腰に、錘がわりの鉄の格子が縛りつけられていた。庭の古い鉄柵の一部だ。",
    ],
    audio: [
      { kind: "stop", fadeMs: 500 },
      { kind: "silence", durationMs: 2600 },
    ],
    next: "c4_8",
  },
  {
    id: "c4_8",
    chapter: "第四章",
    location: "沼の水路",
    speaker: "ホームズ",
    scene: "fen",
    characters: ["holmes"],
    text: [
      "わたしは縛り目を灯にかざした。",
      "輪を二重に通し、端を折り返して差し込んである。片方を引けば一瞬でほどける。揺れる甲板の上で、片手で結ぶための結び方だ。",
      "ハドスンを沈めた男も、船に乗っていた。",
    ],
    dynamicText: (s) => {
      const t = tracksOf(s);
      const out: string[] = [];
      if (s.clues.has("sailors_knot")) {
        out.push(
          "屋根裏の寝台の脚に残っていた紐と、同じ結びだった。ハドスン自身の癖でもある。だが死んだ人間は自分の腰に錘を結ばない。",
        );
      }
      if (s.clues.has("red_clay")) {
        out.push(
          "舟着き場の板の隙間に残っていた赤い粘土を思い出す。この土地の泥ではない土が、確かにここまで来ていた。",
        );
      }
      if (t.past && t.access && t.staging) {
        out.push(
          "三つの筋が、はじめて一本に縒れた。過去。今夜の道。そして、ハドスンが自分の足で出ていったのではないという事実。",
        );
      } else {
        const lack: string[] = [];
        if (!t.past) lack.push("この男と老人を三十年前に結びつける物証");
        if (!t.access) lack.push("よそ者がこの沼まで来た痕跡");
        if (!t.staging) lack.push("ハドスンが自ら去ったのではないという証明");
        out.push(
          `だが、わたしの手にはまだ足りないものがある。──${lack.join("。そして、")}。`,
        );
      }
      return out;
    },
    audio: [{ kind: "bgm", asset: "confront", volume: 0.4, fadeMs: 1500 }],
    next: "c5_0",
  },
];
