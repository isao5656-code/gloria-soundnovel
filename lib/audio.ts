import type { AudioCue, BgmId, SeId } from "@/content/types";

/**
 * 音響エンジン。
 *
 * 外部音源を持たないため、すべての音は Web Audio API で合成する。
 * 重要なのは次の三点で、これは仕様として守る。
 *
 *   1. 無音は「何もしない」ではなく、BGMと環境音を実際に止めた状態である。
 *   2. 録音と現在の音、行きと帰りの櫂などは、定位と残響で聞き分けられる。
 *   3. 証拠を担う音（爆発、索、櫂）を、連続BGMで覆い隠さない。
 */

type Voice = {
  stop: (at?: number) => void;
};

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private bgmBus: GainNode | null = null;
  private seBus: GainNode | null = null;
  private currentBgm: { id: BgmId; voice: Voice; gain: GainNode } | null = null;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private _volume = 0.7;
  private _enabled = false;

  get enabled() {
    return this._enabled;
  }

  get volume() {
    return this._volume;
  }

  /** 最初のユーザー操作の中から呼ぶ必要がある。 */
  async enable() {
    if (this._enabled) return;
    if (typeof window === "undefined") return;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;

    this.ctx = new Ctor();
    if (this.ctx.state === "suspended") await this.ctx.resume();

    this.master = this.ctx.createGain();
    this.master.gain.value = this._volume;
    this.master.connect(this.ctx.destination);

    this.bgmBus = this.ctx.createGain();
    this.bgmBus.gain.value = 1;
    this.bgmBus.connect(this.master);

    this.seBus = this.ctx.createGain();
    this.seBus.gain.value = 1;
    this.seBus.connect(this.master);

    this.noiseBuffer = this.makeNoiseBuffer();
    this._enabled = true;
  }

  disable() {
    this.stopBgm(0.2);
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    this._enabled = false;
    if (this.ctx) {
      const ctx = this.ctx;
      this.ctx = null;
      this.master = null;
      this.bgmBus = null;
      this.seBus = null;
      this.currentBgm = null;
      void ctx.close().catch(() => {});
    }
  }

  setVolume(v: number) {
    this._volume = Math.max(0, Math.min(1, v));
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this._volume, this.ctx.currentTime, 0.05);
    }
  }

  /** 場面に付いたキュー列を順に適用する。 */
  play(cues: AudioCue[] | undefined) {
    if (!cues || !this._enabled || !this.ctx) return;
    for (const cue of cues) {
      switch (cue.kind) {
        case "bgm":
          this.startBgm(cue.asset, cue.volume ?? 0.35, cue.fadeMs ?? 1200);
          break;
        case "se":
          this.playSe(
            cue.asset,
            cue.volume ?? 0.5,
            cue.pan ?? 0,
            cue.delayMs ?? 0,
          );
          break;
        case "stop":
          this.stopBgm((cue.fadeMs ?? 800) / 1000);
          break;
        case "silence":
          this.enterSilence(cue.durationMs);
          break;
      }
    }
  }

  /**
   * 完全無音。BGMも環境音も実際に止め、指定時間が過ぎるまで
   * マスターを絞りきる。演出上の「間」ではなく、聞こえないことを保証する。
   */
  private enterSilence(durationMs: number) {
    if (!this.ctx || !this.master) return;
    this.stopBgm(0.15);
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(0, now + 0.15);
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = setTimeout(() => {
      if (!this.ctx || !this.master) return;
      const t = this.ctx.currentTime;
      this.master.gain.setValueAtTime(0, t);
      this.master.gain.linearRampToValueAtTime(this._volume, t + 0.6);
      this.silenceTimer = null;
    }, durationMs);
  }

  private stopBgm(fadeSec: number) {
    if (!this.ctx || !this.currentBgm) return;
    const { voice, gain } = this.currentBgm;
    const now = this.ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0.0001, now + Math.max(0.05, fadeSec));
    voice.stop(now + Math.max(0.05, fadeSec) + 0.1);
    this.currentBgm = null;
  }

  private startBgm(id: BgmId, volume: number, fadeMs: number) {
    if (!this.ctx || !this.bgmBus) return;
    if (this.currentBgm?.id === id) return;
    this.stopBgm(fadeMs / 1000);

    const gain = this.ctx.createGain();
    gain.gain.value = 0.0001;
    gain.connect(this.bgmBus);
    const voice = this.buildBgm(id, gain);
    const now = this.ctx.currentTime;
    gain.gain.linearRampToValueAtTime(volume, now + fadeMs / 1000);
    this.currentBgm = { id, voice, gain };
  }

  // ── 音の合成 ───────────────────────────────

  private makeNoiseBuffer(): AudioBuffer {
    const ctx = this.ctx!;
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  private noiseSource(loop = true) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = loop;
    return src;
  }

  private buildBgm(id: BgmId, out: GainNode): Voice {
    const ctx = this.ctx!;
    const nodes: { stop: (t: number) => void }[] = [];

    const drone = (freq: number, gainValue: number, type: OscillatorType) => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = gainValue;
      // ごく遅い揺らぎ。機械的な持続音に聞こえないようにする。
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.05 + Math.random() * 0.06;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = gainValue * 0.35;
      lfo.connect(lfoGain).connect(g.gain);
      osc.connect(g).connect(out);
      osc.start();
      lfo.start();
      nodes.push({
        stop: (t) => {
          osc.stop(t);
          lfo.stop(t);
        },
      });
    };

    const wind = (cutoff: number, gainValue: number) => {
      const src = this.noiseSource();
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = cutoff;
      const g = ctx.createGain();
      g.gain.value = gainValue;
      src.connect(filter).connect(g).connect(out);
      src.start();
      nodes.push({ stop: (t) => src.stop(t) });
    };

    switch (id) {
      case "quiet_fen":
        drone(55, 0.16, "sine");
        drone(82.5, 0.06, "sine");
        wind(320, 0.05);
        break;
      case "unease":
        drone(58, 0.14, "sine");
        drone(87, 0.08, "triangle");
        drone(116.5, 0.035, "sine"); // わずかに濁らせる
        wind(240, 0.03);
        break;
      case "memoir":
        drone(49, 0.15, "sine");
        drone(98, 0.05, "sine");
        wind(180, 0.07); // 遠い波
        break;
      case "confront":
        drone(41, 0.2, "sine");
        drone(61.5, 0.07, "triangle");
        break;
      case "elegy":
        drone(65.4, 0.13, "sine"); // C2
        drone(98, 0.08, "sine"); // G2
        drone(155.6, 0.045, "sine"); // Eb3
        break;
    }

    return {
      stop: (at?: number) => {
        const t = at ?? ctx.currentTime;
        for (const n of nodes) {
          try {
            n.stop(t);
          } catch {
            /* すでに停止済み */
          }
        }
      },
    };
  }

  private playSe(id: SeId, volume: number, pan: number, delayMs: number) {
    if (!this.ctx || !this.seBus) return;
    const ctx = this.ctx;
    const start = ctx.currentTime + delayMs / 1000;

    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    const out = ctx.createGain();
    out.gain.value = volume;
    out.connect(panner).connect(this.seBus);

    const burst = (
      cutoff: number,
      dur: number,
      type: BiquadFilterType = "lowpass",
      q = 1,
    ) => {
      const src = this.noiseSource(false);
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = cutoff;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(1, start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      src.connect(f).connect(g).connect(out);
      src.start(start);
      src.stop(start + dur + 0.05);
    };

    const tone = (
      freq: number,
      dur: number,
      type: OscillatorType = "sine",
      endFreq?: number,
    ) => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      if (endFreq)
        osc.frequency.exponentialRampToValueAtTime(endFreq, start + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(1, start + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.connect(g).connect(out);
      osc.start(start);
      osc.stop(start + dur + 0.05);
    };

    switch (id) {
      case "rain":
        // 短い雨の層。BGMの上に重ねても証拠音を潰さない音量で。
        burst(2400, 1.8, "highpass");
        break;
      case "fen_water":
        burst(900, 1.4);
        break;
      case "gull":
        tone(1400, 0.28, "sawtooth", 700);
        break;
      case "clock":
        tone(1100, 0.09, "square");
        break;
      case "door":
        burst(320, 0.5);
        tone(90, 0.22, "sine", 55);
        break;
      case "paper":
        burst(5200, 0.32, "highpass");
        break;
      case "oar":
        // 櫂：水を切る音のあと、軋み。定位はキュー側で指定する。
        burst(1200, 0.3);
        tone(210, 0.18, "triangle", 150);
        break;
      case "rope":
        tone(320, 0.5, "sawtooth", 190);
        break;
      case "explosion":
        // 証拠を担う音。低域を長く残し、直前の無音と対比させる。
        burst(160, 2.6);
        tone(48, 2.2, "sine", 28);
        break;
      case "heartbeat":
        tone(62, 0.16, "sine", 40);
        {
          const second = ctx.createOscillator();
          second.type = "sine";
          second.frequency.setValueAtTime(58, start + 0.34);
          second.frequency.exponentialRampToValueAtTime(36, start + 0.48);
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, start + 0.34);
          g.gain.exponentialRampToValueAtTime(0.8, start + 0.35);
          g.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
          second.connect(g).connect(out);
          second.start(start + 0.34);
          second.stop(start + 0.56);
        }
        break;
      case "match":
        burst(4200, 0.22, "highpass");
        break;
    }
  }
}

/** 場面のキューから、字幕として表示する音の説明を作る（音を切っていても伝わるように）。 */
export function audioCaption(cues: AudioCue[] | undefined): string | null {
  if (!cues || cues.length === 0) return null;
  const labels: string[] = [];
  for (const cue of cues) {
    if (cue.kind === "silence") {
      labels.push(`無音（${(cue.durationMs / 1000).toFixed(1)}秒）`);
    } else if (cue.kind === "se") {
      const name = seCaptions[cue.asset];
      if (!name) continue;
      const side =
        cue.pan === undefined || Math.abs(cue.pan) < 0.15
          ? ""
          : cue.pan < 0
            ? "（左）"
            : "（右）";
      labels.push(`${name}${side}`);
    }
  }
  return labels.length ? labels.join("　") : null;
}

const seCaptions: Record<SeId, string> = {
  rain: "雨",
  fen_water: "沼の水音",
  gull: "鴎の声",
  clock: "柱時計",
  door: "扉",
  paper: "紙の音",
  oar: "櫂の音",
  rope: "索の軋み",
  explosion: "遠い爆発",
  heartbeat: "鼓動",
  match: "マッチ",
};
