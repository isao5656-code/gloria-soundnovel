"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getNode } from "@/content/story";
import { clueById, clues as allClues } from "@/content/clues";
import { endings } from "@/content/endings";
import { secretAvailable, tracksOf } from "@/content/branching";
import type { Choice, EndingId } from "@/content/types";
import {
  advance,
  branchStateOf,
  chooseOption,
  loadSave,
  loadUnlockedEndings,
  newGame,
  renderText,
  unlockEnding,
  visibleChoices,
  writeSave,
  type GameState,
} from "@/lib/game";
import { AudioEngine, audioCaption } from "@/lib/audio";
import { characterImage, sceneImage } from "@/lib/assets";

type Screen = "title" | "game" | "endingList";
type Panel = "none" | "clues" | "history" | "help" | "saved";

const TYPE_MS = 28;
const TYPE_MS_FAST = 6;
const AUTO_HOLD_MS = 1500;

/** 雨を降らせる場面。暗さではなく天候で場面の意味を変える。 */
const RAIN_SCENES = new Set(["fen", "village", "manor"]);

export default function Page() {
  const [screen, setScreen] = useState<Screen>("title");
  const [state, setState] = useState<GameState | null>(null);
  const [hasSave, setHasSave] = useState(false);
  const [unlocked, setUnlocked] = useState<EndingId[]>([]);

  const [revealed, setRevealed] = useState(0);
  const [panel, setPanel] = useState<Panel>("none");
  const [toolsOpen, setToolsOpen] = useState(false);
  const [auto, setAuto] = useState(false);
  const [skip, setSkip] = useState(false);
  const [soundOn, setSoundOn] = useState(false);

  const engineRef = useRef<AudioEngine | null>(null);
  const proseRef = useRef<HTMLDivElement | null>(null);

  if (engineRef.current === null && typeof window !== "undefined") {
    engineRef.current = new AudioEngine();
  }

  // 初期読み込み：セーブの有無と解放済みエンディング。
  useEffect(() => {
    setHasSave(loadSave() !== null);
    setUnlocked(loadUnlockedEndings());
  }, []);

  const node = state ? getNode(state.nodeId) : null;
  const paragraphs = useMemo(
    () => (node && state ? renderText(node, state) : []),
    [node, state],
  );
  const fullText = useMemo(() => paragraphs.join("\n"), [paragraphs]);
  const choices = useMemo(
    () => (state ? visibleChoices(state) : []),
    [state],
  );
  const isEnding = Boolean(node?.ending);
  const typingDone = revealed >= fullText.length;
  const choicesPending = typingDone && choices.length > 0;

  // ── タイプライター ─────────────────────────
  useEffect(() => {
    if (!state || screen !== "game") return;
    if (revealed >= fullText.length) return;
    const alreadyRead = state.seen.includes(state.nodeId);
    const step = skip && alreadyRead ? TYPE_MS_FAST : TYPE_MS;
    const timer = setTimeout(() => {
      setRevealed((r) => Math.min(fullText.length, r + (step === TYPE_MS_FAST ? 6 : 1)));
    }, step);
    return () => clearTimeout(timer);
  }, [revealed, fullText, skip, state, screen]);

  // 本文が伸びたら追従スクロールする。上端で行が切れていたら印を付ける。
  useEffect(() => {
    const el = proseRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    el.dataset.scrolled = el.scrollTop > 1 ? "true" : "false";
  }, [revealed]);

  // ── 場面ごとの音 ───────────────────────────
  useEffect(() => {
    if (!node || screen !== "game") return;
    if (soundOn) engineRef.current?.play(node.audio);
  }, [node, soundOn, screen]);

  // ── 進行 ───────────────────────────────────
  const goNext = useCallback(() => {
    setState((s) => {
      if (!s) return s;
      const next = advance(s);
      if (!next) return s;
      setRevealed(0);
      writeSave(next); // 自動保存は場面遷移時
      return next;
    });
  }, []);

  const pick = useCallback((choice: Choice) => {
    setState((s) => {
      if (!s) return s;
      const next = chooseOption(s, choice);
      setRevealed(0);
      writeSave(next);
      return next;
    });
  }, []);

  /** 画面タップ・Space・Enter・右矢印の共通動作。選択肢は決して自動決定しない。 */
  const proceed = useCallback(() => {
    if (panel !== "none") return;
    if (!typingDone) {
      setRevealed(fullText.length);
      return;
    }
    if (choices.length > 0) return; // 選択待ちでは進めない
    if (isEnding) return;
    goNext();
  }, [panel, typingDone, fullText.length, choices.length, isEnding, goNext]);

  // オート送り
  useEffect(() => {
    if (!auto || screen !== "game" || panel !== "none") return;
    if (!typingDone || choicesPending || isEnding) return;
    const t = setTimeout(goNext, AUTO_HOLD_MS);
    return () => clearTimeout(t);
  }, [auto, typingDone, choicesPending, isEnding, panel, screen, goNext]);

  // 終幕に到達したら記録する。
  useEffect(() => {
    if (node?.ending) setUnlocked(unlockEnding(node.ending));
  }, [node?.ending]);

  // ── 音量 ───────────────────────────────────
  const toggleSound = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;
    if (soundOn) {
      engine.disable();
      setSoundOn(false);
    } else {
      await engine.enable();
      setSoundOn(engine.enabled);
      if (engine.enabled && node) engine.play(node.audio);
    }
  }, [soundOn, node]);

  // ── セーブ ─────────────────────────────────
  const manualSave = useCallback(() => {
    if (!state) return;
    if (writeSave(state)) {
      setHasSave(true);
      setPanel("saved");
    }
  }, [state]);

  // ── キーボード ─────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (panel !== "none") {
          e.preventDefault();
          setPanel("none");
        } else if (toolsOpen) {
          e.preventDefault();
          setToolsOpen(false);
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (screen === "game") manualSave();
        return;
      }

      if (screen !== "game" || panel !== "none") return;

      switch (e.key) {
        case " ":
        case "Enter":
        case "ArrowRight":
          e.preventDefault();
          proceed();
          break;
        case "ArrowLeft":
          // 読み返しだけ。状態は巻き戻さず、選択もやり直せない。
          e.preventDefault();
          setPanel("history");
          break;
        case "a":
        case "A":
          e.preventDefault();
          setAuto((v) => !v);
          break;
        case "s":
        case "S":
          e.preventDefault();
          setSkip((v) => !v);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, panel, toolsOpen, proceed, manualSave]);

  // ── 画面 ───────────────────────────────────

  const startNew = () => {
    const s = newGame();
    setState(s);
    setRevealed(0);
    setScreen("game");
    writeSave(s);
    setHasSave(true);
  };

  const continueGame = () => {
    const s = loadSave();
    if (!s) return;
    setState(s);
    setRevealed(0);
    setScreen("game");
  };

  const toTitle = () => {
    setPanel("none");
    setToolsOpen(false);
    setScreen("title");
    setHasSave(loadSave() !== null);
    setUnlocked(loadUnlockedEndings());
  };

  if (screen === "title") {
    return (
      <TitleScreen
        hasSave={hasSave}
        onNew={startNew}
        onContinue={continueGame}
        onEndings={() => setScreen("endingList")}
      />
    );
  }

  if (screen === "endingList") {
    return <EndingList unlocked={unlocked} onBack={toTitle} />;
  }

  if (!state || !node) return null;

  const branch = branchStateOf(state);
  const tracks = tracksOf(branch);
  const shown = fullText.slice(0, revealed).split("\n");
  const caption = audioCaption(node.audio);

  return (
    <main className="stage">
      <div
        className={`scene-layer is-active focus-${node.scene}`}
        style={{ backgroundImage: `url(${sceneImage(node.scene)})` }}
        role="img"
        aria-label={`場面：${node.location}`}
      />
      <div
        className={`atmosphere${RAIN_SCENES.has(node.scene) ? " is-rain" : ""}`}
      />

      {node.characters && node.characters.length > 0 && (
        <div className="cast" data-count={node.characters.length}>
          {node.characters.map((c) => (
            <img key={c} src={characterImage(c)} alt="" aria-hidden="true" />
          ))}
        </div>
      )}

      <div className="header">
        <span className="chapter">{node.chapter}</span>
        <span className="location">{node.location}</span>
      </div>

      <ToolPanel
        open={toolsOpen}
        onToggle={() => setToolsOpen((v) => !v)}
        soundOn={soundOn}
        onSound={toggleSound}
        auto={auto}
        onAuto={() => setAuto((v) => !v)}
        skip={skip}
        onSkip={() => setSkip((v) => !v)}
        onHistory={() => setPanel("history")}
        onClues={() => setPanel("clues")}
        onSave={manualSave}
        onHelp={() => setPanel("help")}
      />

      {/* 本文。選択肢が出ているあいだも読めるようにする。 */}
      <section
        className="textbox"
        onClick={choicesPending ? undefined : proceed}
        style={choicesPending ? { opacity: 0.28, pointerEvents: "none" } : undefined}
        aria-live="polite"
      >
        {node.speaker && <div className="speaker">{node.speaker}</div>}
        <div className="prose" ref={proseRef}>
          {shown.map((p, i) => (
            <p key={i}>
              {p}
              {i === shown.length - 1 && !typingDone && (
                <span className="caret">▍</span>
              )}
            </p>
          ))}
        </div>
        {caption && <div className="audio-caption">♪ {caption}</div>}
      </section>

      {choicesPending && (
        <div className="choices" role="group" aria-label="選択肢">
          {choices.map((c, i) => {
            const secret = c.next === "secret_0";
            return (
              <button
                key={`${c.next}-${i}`}
                className={`choice${secret ? " is-secret" : ""}`}
                onClick={() => pick(c)}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      )}

      {typingDone && !choicesPending && !isEnding && (
        <div className="hint">Space / → で次へ　←で読み返し</div>
      )}

      {isEnding && typingDone && node.ending && (
        <EndingCard endingId={node.ending} onTitle={toTitle} />
      )}

      {panel === "clues" && (
        <CluePanel
          have={state.clues}
          tracks={tracks}
          secret={secretAvailable(branch)}
          onClose={() => setPanel("none")}
        />
      )}
      {panel === "history" && (
        <HistoryPanel log={state.log} onClose={() => setPanel("none")} />
      )}
      {panel === "help" && <HelpPanel onClose={() => setPanel("none")} />}
      {panel === "saved" && (
        <SavedDialog onContinue={() => setPanel("none")} onTitle={toTitle} />
      )}
    </main>
  );
}

// ── タイトル ─────────────────────────────────

function TitleScreen({
  hasSave,
  onNew,
  onContinue,
  onEndings,
}: {
  hasSave: boolean;
  onNew: () => void;
  onContinue: () => void;
  onEndings: () => void;
}) {
  return (
    <main className="stage">
      <div
        className="scene-layer is-active focus-fen"
        style={{ backgroundImage: `url(${sceneImage("fen")})` }}
      />
      <div className="atmosphere is-rain" />
      <div className="title-screen">
        <div>
          <h1>グローリア・スコット号</h1>
          <p className="subtitle">― 三十年目の潮 ―</p>
        </div>
        <nav className="title-menu">
          <button className="menu-btn" onClick={onNew}>
            はじめから
          </button>
          <button className="menu-btn" onClick={onContinue} disabled={!hasSave}>
            {hasSave ? "つづきから" : "つづきから（記録なし）"}
          </button>
          <button className="menu-btn" onClick={onEndings}>
            エンディング一覧
          </button>
        </nav>
        <p className="credit">
          アーサー・コナン・ドイル『グローリア・スコット号』（1893年・著作権消滅）を
          原案としたサウンドノベルです。本文・分岐・結末はすべて本作のために
          書き下ろしたもので、既存の翻訳を転載したものではありません。
        </p>
      </div>
    </main>
  );
}

// ── エンディング一覧 ─────────────────────────

function EndingList({
  unlocked,
  onBack,
}: {
  unlocked: EndingId[];
  onBack: () => void;
}) {
  return (
    <main className="stage">
      <div
        className="scene-layer is-active focus-dawn"
        style={{ backgroundImage: `url(${sceneImage("dawn")})` }}
      />
      <div className="atmosphere" />
      <div className="overlay" style={{ background: "rgba(3,6,9,0.86)" }}>
        <div className="modal">
          <header>
            <h2>
              エンディング　{unlocked.length} / {endings.length}
            </h2>
            <button className="close-btn" onClick={onBack}>
              戻る
            </button>
          </header>
          <div className="body">
            {endings.map((e) => {
              const open = unlocked.includes(e.id);
              return (
                <div
                  key={e.id}
                  className={`ending-row${open ? "" : " is-locked"}`}
                >
                  <span className="no">{e.number}</span>
                  <div>
                    <p className="name">{open ? e.title : "？？？"}</p>
                    <p className="detail">
                      {open ? e.summary : "まだ到達していません。"}
                    </p>
                    {open && <p className="cond">到達条件：{e.condition}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}

// ── 操作パネル ───────────────────────────────

function ToolPanel({
  open,
  onToggle,
  soundOn,
  onSound,
  auto,
  onAuto,
  skip,
  onSkip,
  onHistory,
  onClues,
  onSave,
  onHelp,
}: {
  open: boolean;
  onToggle: () => void;
  soundOn: boolean;
  onSound: () => void;
  auto: boolean;
  onAuto: () => void;
  skip: boolean;
  onSkip: () => void;
  onHistory: () => void;
  onClues: () => void;
  onSave: () => void;
  onHelp: () => void;
}) {
  return (
    <div className="tools">
      {open && (
        <div className="tool-row">
          <button
            className={`tool-btn${soundOn ? " is-on" : ""}`}
            onClick={onSound}
            aria-label={soundOn ? "音量を切る" : "音量を入れる"}
            aria-pressed={soundOn}
          >
            <span className="glyph" aria-hidden="true">
              {soundOn ? "◉" : "◌"}
            </span>
            音量
          </button>
          <button
            className={`tool-btn${auto ? " is-on" : ""}`}
            onClick={onAuto}
            aria-label="オート送り"
            aria-pressed={auto}
          >
            <span className="glyph" aria-hidden="true">
              ▶
            </span>
            オート
          </button>
          <button
            className={`tool-btn${skip ? " is-on" : ""}`}
            onClick={onSkip}
            aria-label="既読スキップ"
            aria-pressed={skip}
          >
            <span className="glyph" aria-hidden="true">
              ▶▶
            </span>
            スキップ
          </button>
          <button className="tool-btn" onClick={onHistory} aria-label="文章履歴">
            <span className="glyph" aria-hidden="true">
              ☰
            </span>
            履歴
          </button>
          <button className="tool-btn" onClick={onClues} aria-label="手掛かり一覧">
            <span className="glyph" aria-hidden="true">
              ✦
            </span>
            手掛かり
          </button>
          <button className="tool-btn" onClick={onSave} aria-label="セーブ">
            <span className="glyph" aria-hidden="true">
              ▣
            </span>
            セーブ
          </button>
          <button className="tool-btn" onClick={onHelp} aria-label="操作説明">
            <span className="glyph" aria-hidden="true">
              ?
            </span>
            操作
          </button>
        </div>
      )}
      <button
        className={`tool-btn${open ? " is-on" : ""}`}
        onClick={onToggle}
        aria-label={open ? "操作パネルを閉じる" : "操作パネルを開く"}
        aria-expanded={open}
      >
        <span className="glyph" aria-hidden="true">
          •••
        </span>
        操作
      </button>
    </div>
  );
}

// ── モーダル群 ───────────────────────────────

function CluePanel({
  have,
  tracks,
  secret,
  onClose,
}: {
  have: string[];
  tracks: { past: boolean; access: boolean; staging: boolean };
  secret: boolean;
  onClose: () => void;
}) {
  const held = allClues.filter((c) => have.includes(c.id));
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>手掛かり　{held.length} 件</h2>
          <button className="close-btn" onClick={onClose}>
            閉じる
          </button>
        </header>
        <div className="body">
          <div className="track-summary">
            <span className={`track-chip${tracks.past ? " is-on" : ""}`}>
              系統1　過去
            </span>
            <span className={`track-chip${tracks.access ? " is-on" : ""}`}>
              系統2　今夜の道
            </span>
            <span className={`track-chip${tracks.staging ? " is-on" : ""}`}>
              系統3　偽装
            </span>
            {secret && <span className="track-chip is-on">暗号の規則</span>}
          </div>
          {held.length === 0 && (
            <p style={{ color: "var(--ink-dim)" }}>まだ何も掴んでいない。</p>
          )}
          {held.map((c) => (
            <div key={c.id} className="clue-item">
              <h3>{clueById[c.id].title}</h3>
              <p>{clueById[c.id].text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HistoryPanel({
  log,
  onClose,
}: {
  log: GameState["log"];
  onClose: () => void;
}) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>文章履歴</h2>
          <button className="close-btn" onClick={onClose}>
            閉じる
          </button>
        </header>
        <div className="body" ref={bodyRef}>
          <p className="history-note">
            読み返しのみです。ここから物語を巻き戻したり、選び直したりはできません。
          </p>
          {log.map((entry, i) => (
            <div key={`${entry.nodeId}-${i}`} className="history-entry">
              <div className="meta">
                {entry.chapter}　{entry.location}
                {entry.speaker ? `　／　${entry.speaker}` : ""}
              </div>
              {entry.paragraphs.map((p, j) => (
                <p key={j}>{p}</p>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HelpPanel({ onClose }: { onClose: () => void }) {
  const rows: [string, string][] = [
    ["画面をタップ／クリック", "全文表示、または次へ"],
    ["Space ／ Enter", "全文表示、または次へ"],
    ["→（右矢印）", "次へ"],
    ["←（左矢印）", "文章履歴を開く（読み返しのみ）"],
    ["A", "オート送りの切替"],
    ["S", "既読スキップの切替"],
    ["Ctrl+S ／ ⌘+S", "手動セーブ"],
    ["Esc", "開いているパネルを閉じる"],
  ];
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>操作説明</h2>
          <button className="close-btn" onClick={onClose}>
            閉じる
          </button>
        </header>
        <div className="body">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {rows.map(([k, v]) => (
                <tr key={k}>
                  <th
                    style={{
                      textAlign: "left",
                      fontWeight: "normal",
                      color: "var(--accent)",
                      padding: "7px 12px 7px 0",
                      whiteSpace: "nowrap",
                      verticalAlign: "top",
                    }}
                  >
                    {k}
                  </th>
                  <td style={{ padding: "7px 0", color: "var(--ink-dim)" }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ marginTop: 18, color: "var(--ink-dim)", fontSize: "0.86rem" }}>
            選択肢が出ているあいだは、Space や矢印キーで勝手に選ばれることはありません。
            必ず選択肢そのものを押してください。
          </p>
          <p style={{ color: "var(--ink-dim)", fontSize: "0.86rem" }}>
            記録はこのブラウザの中にだけ保存されます。端末やブラウザをまたいだ同期は行いません。
          </p>
        </div>
      </div>
    </div>
  );
}

function SavedDialog({
  onContinue,
  onTitle,
}: {
  onContinue: () => void;
  onTitle: () => void;
}) {
  return (
    <div className="overlay">
      <div className="modal" style={{ maxWidth: 420 }}>
        <header>
          <h2>記録しました</h2>
        </header>
        <div className="body">
          <div className="title-menu" style={{ width: "100%" }}>
            <button className="menu-btn" onClick={onContinue}>
              ゲームを続ける
            </button>
            <button className="menu-btn" onClick={onTitle}>
              タイトルへ戻る
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EndingCard({
  endingId,
  onTitle,
}: {
  endingId: EndingId;
  onTitle: () => void;
}) {
  const e = endings.find((x) => x.id === endingId)!;
  return (
    <div className="ending-card">
      <span className="no">{e.number}</span>
      <h2>{e.title}</h2>
      <button className="menu-btn" onClick={onTitle} style={{ minWidth: 240 }}>
        タイトルへ戻る
      </button>
    </div>
  );
}
