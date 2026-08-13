/**
 * 『グローリア・スコット号 ― 三十年目の潮』
 * 物語データの型定義。
 *
 * 場面ID・手掛かりID・エンディングIDは、遷移／セーブ／既読／音／背景／テストの
 * 共通キーである。本文だけを改稿するときはIDを変更しない。
 */

/** 背景画像のカテゴリ。public/scenes/<id>.svg に対応する。 */
export type SceneId =
  | "college"
  | "manor"
  | "hall"
  | "study"
  | "attic"
  | "village"
  | "fen"
  | "ship"
  | "dawn";

/** 人物シルエット。public/characters/<id>.svg に対応する。 */
export type CharacterId =
  | "holmes"
  | "victor"
  | "trevor"
  | "hudson"
  | "fordham"
  | "beddoes"
  | "prendergast";

/** 音響キュー。無音も明示的な指定として扱う。 */
export type AudioCue =
  | { kind: "bgm"; asset: BgmId; volume?: number; fadeMs?: number }
  | { kind: "se"; asset: SeId; volume?: number; pan?: number; delayMs?: number }
  | { kind: "silence"; durationMs: number }
  | { kind: "stop"; fadeMs?: number };

export type BgmId =
  | "quiet_fen" // 沼の静けさ。低いドローンと風
  | "unease" // 不安。軋む弦の持続音
  | "memoir" // 手記の回想。遠い波と帆の軋み
  | "confront" // 対決。脈打つ低音
  | "elegy"; // 終幕。減衰する和音

export type SeId =
  | "rain" // 雨
  | "fen_water" // 沼の水面
  | "gull" // 鴎
  | "clock" // 柱時計
  | "door" // 扉
  | "paper" // 紙をめくる
  | "oar" // 櫂の音
  | "rope" // 軋む索
  | "explosion" // 遠い爆発
  | "heartbeat" // 鼓動
  | "match"; // マッチを擦る

/** 選択肢。 */
export type Choice = {
  /** 表示文。報酬そのものを先に明かさない。 */
  label: string;
  /** 遷移先の場面ID。 */
  next: string;
  /**
   * 表示条件。省略時は常に表示。
   * 条件付き選択が永久に表示不能にならないことをテストで検査する。
   */
  condition?: (state: BranchState) => boolean;
  /** 選択によって得る手掛かり。 */
  addClues?: ClueId[];
  /** 選択によって変わる状態。 */
  setFlags?: Partial<Flags>;
  /** 調査済みとして記録する地点。 */
  markInvestigated?: InvestigationId;
  /** 同行者ルートの確定。 */
  setCompanion?: CompanionId;
  /** 補足（画面には出さない。資料生成とテスト用）。 */
  note?: string;
};

/** 一場面。 */
export type StoryNode = {
  id: string;
  chapter: string;
  location: string;
  speaker?: string;
  /** 本文。1要素が1段落。 */
  text: string[];
  /**
   * 状態に応じて本文の末尾へ差し込む段落。
   * text の代わりではなく追加であり、text だけでも場面は成立する。
   * 揃った証拠系統や選んだ同行者に本文を一致させるために使う。
   */
  dynamicText?: (state: BranchState) => string[];
  scene: SceneId;
  /** 表示する人物シルエット。話者一人が原則、対決場面などで複数指定。 */
  characters?: CharacterId[];
  next?: string;
  /**
   * 状態によって遷移先が変わる場合に使う。next より優先される。
   * プレイヤーの選択ではなく、既に選んだ結果の帰結だけをここで分ける。
   * 返した遷移先が存在することはグラフ検証で確かめる。
   */
  nextBy?: (state: BranchState) => string;
  /** nextBy が返しうる遷移先の全列挙。グラフ検証用。 */
  nextCandidates?: string[];
  choices?: Choice[];
  addClues?: ClueId[];
  setFlags?: Partial<Flags>;
  audio?: AudioCue[];
  /** このIDが設定されていれば終幕場面。 */
  ending?: EndingId;
  /**
   * 調査ハブ。到達時に、未調査の地点を選択肢として動的に生成する。
   * 2か所を調べ終えたら afterHub へ進む。
   */
  investigationHub?: { afterHub: string };
};

/** 調査地点。4か所のうち2か所を選ぶ。 */
export type InvestigationId = "desk" | "attic" | "village" | "fen";

/** 同行者ルート。 */
export type CompanionId = "victor" | "fordham" | "alone";

/** 手掛かりID。 */
export type ClueId =
  // 共通ルートで必ず得るもの
  | "initials_ja"
  | "hudson_arrival"
  | "cipher_note"
  | "trevor_stroke"
  | "trevor_memoir"
  | "cipher_solved"
  // 調査：書斎の机
  | "ledger_name"
  | "cipher_key"
  // 調査：屋根裏のハドスンの部屋
  | "sailors_knot"
  | "hudson_kit"
  // 調査：村の宿と郵便局
  | "news_clip"
  | "tide_table"
  // 調査：沼と舟着き場
  | "red_clay"
  | "boat_log"
  // 同行者ルート
  | "victor_testimony"
  | "fordham_note"
  | "hired_gig"
  | "night_watch";

/** 内部フラグ。 */
export type Flags = {
  /** ヴィクターに全てを打ち明けた。 */
  trustVictor: boolean;
  /** フォーダム医師と組んだ。 */
  withFordham: boolean;
  /** 一人で動いた。 */
  alone: boolean;
  /** 老トレヴァーの臨終に立ち会った。 */
  sawDeath: boolean;
  /** 暗号の規則を自力で見抜いた。 */
  brokeCipher: boolean;
};

export const initialFlags: Flags = {
  trustVictor: false,
  withFordham: false,
  alone: false,
  sawDeath: false,
  brokeCipher: false,
};

/** 分岐判定に必要な最小の状態。UIから独立させ、テストから直接呼べるようにする。 */
export type BranchState = {
  clues: Set<ClueId>;
  flags: Flags;
  investigated: InvestigationId[];
  companion: CompanionId | null;
};

export type EndingId =
  | "tide" // END 01 三十年目の潮
  | "grey" // END 02 灰色の朝
  | "terai" // END 03 テライ行きの船
  | "gloves" // END 04 白い手袋
  | "runaway" // END 05 逃げた男
  | "powder"; // END 06 火薬庫の返事

export type Ending = {
  id: EndingId;
  /** 一覧に出す通し番号表記。 */
  number: string;
  title: string;
  /** エンディング一覧に出す短い説明。未解放時は伏せる。 */
  summary: string;
  /** 到達条件の説明（解放後に表示）。 */
  condition: string;
};

export type Clue = {
  id: ClueId;
  title: string;
  text: string;
  /** どの証拠系統に属するか。null は共通ルートの前提事実または秘密の鍵。 */
  track: "past" | "access" | "staging" | null;
};
