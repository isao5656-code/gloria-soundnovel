import type { AudioCue, BgmId, SeId } from "@/content/types";

/**
 * 音響エンジン。
 *
 * 外部音源を持たないため、すべて Web Audio API で合成する。
 * 合成でも作り物に聞こえないよう、次を守る。
 *
 *  1. 残響を持つ。生成したインパルス応答で畳み込み、部屋・広間・戸外を
 *     鳴らし分ける。乾いた発振音のままにしない。
 *  2. 環境音は鳴りっぱなしにする。雨や水音は一発の効果音ではなく、
 *     場面が続くあいだ流れ続ける層として扱う。
 *  3. 持続音は必ず揺らす。複数の発振器をわずかにずらし、
 *     フィルターをゆっくり動かして、単一の正弦波に聞こえないようにする。
 *  4. 出口にリミッターを置く。層が重なっても歪ませない。
 *
 * そのうえで、物語が音に負っている次の三点は仕様として守る。
 *
 *  ・無音は「何もしない」ではなく、実際に鳴らないこと
 *  ・録音と現在の音、行きと帰りの櫂は、残響と定位で聞き分けられること
 *  ・証拠を担う音を、連続BGMで覆い隠さないこと
 */

type Voice = { stop: (at?: number) => void };

/** 鳴りっぱなしにする環境音。効果音ではなく層として扱う。 */
const AMBIENT: SeId[] = ["rain", "fen_water"];

/** 場面ごとの残響。 */
type Space = "room" | "hall" | "outdoor" | "far";

const BGM_SPACE: Record<BgmId, Space> = {
  quiet_fen: "outdoor",
  unease: "room",
  memoir: "far", // 三十年前の回想。いちばん遠い残響
  confront: "hall",
  elegy: "hall",
};

const SE_SPACE: Record<SeId, Space> = {
  rain: "outdoor",
  fen_water: "outdoor",
  gull: "far",
  clock: "room",
  door: "hall",
  paper: "room",
  oar: "outdoor",
  rope: "room",
  explosion: "far",
  heartbeat: "room",
  match: "room",
};

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private limiter: WaveShaperNode | null = null;
  private dry: GainNode | null = null;
  private sends: Partial<Record<Space, GainNode>> = {};
  private bgmBus: GainNode | null = null;
  private seBus: GainNode | null = null;
  private currentBgm: { id: BgmId; voice: Voice; gain: GainNode } | null = null;
  private ambient = new Map<SeId, { voice: Voice; gain: GainNode }>();
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private noise: AudioBuffer | null = null;
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

    const ctx = new Ctor();
    this.ctx = ctx;
    if (ctx.state === "suspended") await ctx.resume();

    // 出口：音量 → リミッター → 出力
    this.limiter = ctx.createWaveShaper();
    this.limiter.curve = makeLimiterCurve();
    this.limiter.oversample = "2x";
    this.limiter.connect(ctx.destination);

    this.master = ctx.createGain();
    this.master.gain.value = this._volume;
    this.master.connect(this.limiter);

    // 乾いた音と、空間ごとの残響
    this.dry = ctx.createGain();
    this.dry.gain.value = 1;
    this.dry.connect(this.master);

    for (const space of Object.keys(IR) as Space[]) {
      const spec = IR[space];
      const send = ctx.createGain();
      send.gain.value = spec.mix;
      const conv = ctx.createConvolver();
      conv.buffer = makeImpulse(ctx, spec.seconds, spec.decay, spec.predelay);
      send.connect(conv).connect(this.master);
      this.sends[space] = send;
    }

    this.bgmBus = ctx.createGain();
    this.bgmBus.gain.value = 1;
    this.bgmBus.connect(this.dry);

    this.seBus = ctx.createGain();
    this.seBus.gain.value = 1;
    this.seBus.connect(this.dry);

    this.noise = makeNoise(ctx);
    this._enabled = true;
  }

  disable() {
    this.stopBgm(0.2);
    for (const id of [...this.ambient.keys()]) this.stopAmbient(id, 0.2);
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    this._enabled = false;
    const ctx = this.ctx;
    this.ctx = null;
    this.master = null;
    this.limiter = null;
    this.dry = null;
    this.sends = {};
    this.bgmBus = null;
    this.seBus = null;
    this.currentBgm = null;
    this.ambient.clear();
    if (ctx) void ctx.close().catch(() => {});
  }

  setVolume(v: number) {
    this._volume = Math.max(0, Math.min(1, v));
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this._volume, this.ctx.currentTime, 0.05);
    }
  }

  /** 場面に付いたキュー列を適用する。 */
  play(cues: AudioCue[] | undefined) {
    if (!this._enabled || !this.ctx) return;
    const list = cues ?? [];

    // 環境音は、その場面で指定されているものだけを鳴らし続ける。
    const wanted = new Set<SeId>();
    for (const c of list) {
      if (c.kind === "se" && AMBIENT.includes(c.asset)) wanted.add(c.asset);
    }
    for (const id of [...this.ambient.keys()]) {
      if (!wanted.has(id)) this.stopAmbient(id, 1.4);
    }

    for (const cue of list) {
      switch (cue.kind) {
        case "bgm":
          this.startBgm(cue.asset, cue.volume ?? 0.35, cue.fadeMs ?? 1600);
          break;
        case "se":
          if (AMBIENT.includes(cue.asset)) {
            this.startAmbient(cue.asset, cue.volume ?? 0.4);
          } else {
            this.playSe(cue.asset, cue.volume ?? 0.5, cue.pan ?? 0, cue.delayMs ?? 0);
          }
          break;
        case "stop":
          this.stopBgm((cue.fadeMs ?? 900) / 1000);
          break;
        case "silence":
          this.enterSilence(cue.durationMs);
          break;
      }
    }
  }

  /**
   * 完全無音。BGMも環境音も実際に止め、指定時間はマスターを絞りきる。
   * 演出上の「間」ではなく、聞こえないことを保証する。
   */
  private enterSilence(durationMs: number) {
    if (!this.ctx || !this.master) return;
    this.stopBgm(0.15);
    for (const id of [...this.ambient.keys()]) this.stopAmbient(id, 0.15);
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(0, now + 0.15);
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = setTimeout(() => {
      if (!this.ctx || !this.master) return;
      const t = this.ctx.currentTime;
      this.master.gain.setValueAtTime(0, t);
      this.master.gain.linearRampToValueAtTime(this._volume, t + 0.8);
      this.silenceTimer = null;
    }, durationMs);
  }

  // ── BGM ──────────────────────────────────

  private stopBgm(fadeSec: number) {
    if (!this.ctx || !this.currentBgm) return;
    const { voice, gain } = this.currentBgm;
    const now = this.ctx.currentTime;
    const f = Math.max(0.05, fadeSec);
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0.0001, now + f);
    voice.stop(now + f + 0.2);
    this.currentBgm = null;
  }

  private startBgm(id: BgmId, volume: number, fadeMs: number) {
    if (!this.ctx || !this.bgmBus) return;
    if (this.currentBgm?.id === id) return;
    this.stopBgm(fadeMs / 1000);

    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    gain.connect(this.bgmBus);
    const send = this.sends[BGM_SPACE[id]];
    if (send) gain.connect(send);

    const voice = this.buildBgm(id, gain);
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + fadeMs / 1000);
    this.currentBgm = { id, voice, gain };
  }

  /**
   * 持続音。
   * 一つの音程につき3本の発振器をわずかにずらして重ね、うなりを作る。
   * さらにローパスをゆっくり動かして、音色が止まって聞こえないようにする。
   */
  private buildBgm(id: BgmId, out: GainNode): Voice {
    const ctx = this.ctx!;
    const parts: { stop: (t: number) => void }[] = [];

    const pad = (freq: number, level: number, type: OscillatorType = "sine") => {
      const bus = ctx.createGain();
      bus.gain.value = level;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 520;
      lp.Q.value = 0.7;
      bus.connect(lp).connect(out);

      // フィルターをゆっくり往復させる
      const sweep = ctx.createOscillator();
      sweep.frequency.value = 0.03 + Math.random() * 0.04;
      const sweepAmt = ctx.createGain();
      sweepAmt.gain.value = 260;
      sweep.connect(sweepAmt).connect(lp.frequency);
      sweep.start();
      parts.push({ stop: (t) => sweep.stop(t) });

      for (const detune of [-7, 0, 6]) {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.value = freq;
        osc.detune.value = detune;
        const g = ctx.createGain();
        g.gain.value = 1 / 3;
        // ごく遅い音量の揺れ
        const trem = ctx.createOscillator();
        trem.frequency.value = 0.05 + Math.random() * 0.09;
        const tremAmt = ctx.createGain();
        tremAmt.gain.value = 0.12;
        trem.connect(tremAmt).connect(g.gain);
        trem.start();
        osc.connect(g).connect(bus);
        osc.start();
        parts.push({
          stop: (t) => {
            osc.stop(t);
            trem.stop(t);
          },
        });
      }
    };

    /** 遠い風。持続音の背後に空気を足す。 */
    const air = (cutoff: number, level: number) => {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = cutoff;
      const g = ctx.createGain();
      g.gain.value = level;
      const swell = ctx.createOscillator();
      swell.frequency.value = 0.06;
      const swellAmt = ctx.createGain();
      swellAmt.gain.value = level * 0.55;
      swell.connect(swellAmt).connect(g.gain);
      swell.start();
      src.connect(lp).connect(g).connect(out);
      src.start();
      parts.push({
        stop: (t) => {
          src.stop(t);
          swell.stop(t);
        },
      });
    };

    switch (id) {
      case "quiet_fen": // 沼の静けさ。低い五度
        pad(55, 0.2);
        pad(82.4, 0.09);
        air(340, 0.045);
        break;
      case "unease": // 不安。短二度をわずかに含ませて濁らせる
        pad(58.3, 0.18);
        pad(87.3, 0.08, "triangle");
        pad(61.7, 0.035);
        air(260, 0.03);
        break;
      case "memoir": // 回想。遠い波と、開いた五度
        pad(49, 0.19);
        pad(98, 0.07);
        pad(146.8, 0.03);
        air(200, 0.07);
        break;
      case "confront": // 対決。低く脈打つ
        pad(41.2, 0.24);
        pad(61.7, 0.08, "triangle");
        air(180, 0.02);
        break;
      case "elegy": // 終幕。短三和音
        pad(65.4, 0.16); // C2
        pad(98, 0.09); // G2
        pad(155.6, 0.05); // Eb3
        air(300, 0.03);
        break;
    }

    return {
      stop: (at?: number) => {
        const t = at ?? ctx.currentTime;
        for (const p of parts) {
          try {
            p.stop(t);
          } catch {
            /* すでに停止済み */
          }
        }
      },
    };
  }

  // ── 環境音（鳴りっぱなし） ────────────────

  private startAmbient(id: SeId, volume: number) {
    if (!this.ctx || !this.seBus || this.ambient.has(id)) return;
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    gain.connect(this.seBus);
    const send = this.sends[SE_SPACE[id]];
    if (send) gain.connect(send);

    const voice = id === "rain" ? this.buildRain(gain) : this.buildWater(gain);
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 2.2);
    this.ambient.set(id, { voice, gain });
  }

  private stopAmbient(id: SeId, fadeSec: number) {
    const entry = this.ambient.get(id);
    if (!entry || !this.ctx) return;
    const now = this.ctx.currentTime;
    entry.gain.gain.cancelScheduledValues(now);
    entry.gain.gain.setValueAtTime(entry.gain.gain.value, now);
    entry.gain.gain.linearRampToValueAtTime(0.0001, now + fadeSec);
    entry.voice.stop(now + fadeSec + 0.2);
    this.ambient.delete(id);
  }

  /**
   * 雨。三層に分ける。
   * 遠い一様な層、中域の粒立ち、細かい飛沫。
   * さらに帯域と音量をゆっくり動かして、雨脚の変化を作る。
   */
  private buildRain(out: GainNode): Voice {
    const ctx = this.ctx!;
    const parts: { stop: (t: number) => void }[] = [];

    const layer = (type: BiquadFilterType, freq: number, q: number, level: number) => {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      src.playbackRate.value = 0.8 + Math.random() * 0.4;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = level;
      src.connect(f).connect(g).connect(out);
      src.start();
      parts.push({ stop: (t) => src.stop(t) });
      return { f, g };
    };

    layer("lowpass", 900, 0.6, 0.28);
    const mid = layer("bandpass", 2400, 0.8, 0.5);
    layer("highpass", 6200, 0.7, 0.16);

    const gust = ctx.createOscillator();
    gust.frequency.value = 0.07;
    const gustAmt = ctx.createGain();
    gustAmt.gain.value = 900;
    gust.connect(gustAmt).connect(mid.f.frequency);
    gust.start();
    const gustLevel = ctx.createOscillator();
    gustLevel.frequency.value = 0.05;
    const gustLevelAmt = ctx.createGain();
    gustLevelAmt.gain.value = 0.2;
    gustLevel.connect(gustLevelAmt).connect(mid.g.gain);
    gustLevel.start();
    parts.push({
      stop: (t) => {
        gust.stop(t);
        gustLevel.stop(t);
      },
    });

    return {
      stop: (at?: number) => {
        const t = at ?? ctx.currentTime;
        for (const p of parts) {
          try {
            p.stop(t);
          } catch {
            /* noop */
          }
        }
      },
    };
  }

  /** 沼の水面。低くうねる水。寄せては返す。 */
  private buildWater(out: GainNode): Voice {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.playbackRate.value = 0.42;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 520;
    bp.Q.value = 1.1;
    const g = ctx.createGain();
    g.gain.value = 0.5;
    src.connect(bp).connect(g).connect(out);
    src.start();

    const lap = ctx.createOscillator();
    lap.frequency.value = 0.16;
    const lapAmt = ctx.createGain();
    lapAmt.gain.value = 0.34;
    lap.connect(lapAmt).connect(g.gain);
    lap.start();

    const move = ctx.createOscillator();
    move.frequency.value = 0.09;
    const moveAmt = ctx.createGain();
    moveAmt.gain.value = 220;
    move.connect(moveAmt).connect(bp.frequency);
    move.start();

    return {
      stop: (at?: number) => {
        const t = at ?? ctx.currentTime;
        try {
          src.stop(t);
          lap.stop(t);
          move.stop(t);
        } catch {
          /* noop */
        }
      },
    };
  }

  // ── 効果音 ────────────────────────────────

  private playSe(id: SeId, volume: number, pan: number, delayMs: number) {
    if (!this.ctx || !this.seBus) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delayMs / 1000;

    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    const out = ctx.createGain();
    out.gain.value = volume;
    out.connect(panner);
    panner.connect(this.seBus);
    const send = this.sends[SE_SPACE[id]];
    if (send) panner.connect(send);

    /** 減衰する雑音。立ち上がりを持たせて「ブツッ」と鳴らない。 */
    const noiseHit = (
      type: BiquadFilterType,
      freq: number,
      q: number,
      attack: number,
      decay: number,
      level = 1,
      rate = 1,
    ) => {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.playbackRate.value = rate;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(level, t0 + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
      src.connect(f).connect(g).connect(out);
      src.start(t0);
      src.stop(t0 + attack + decay + 0.1);
      return f;
    };

    /** 減衰する楽音。 */
    const tone = (
      freq: number,
      attack: number,
      decay: number,
      type: OscillatorType = "sine",
      level = 1,
      endFreq?: number,
      at = t0,
    ) => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, at);
      if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, at + decay);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(level, at + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
      osc.connect(g).connect(out);
      osc.start(at);
      osc.stop(at + attack + decay + 0.1);
    };

    switch (id) {
      case "gull":
        // 鴎。二声の鳴き交わし。
        tone(1250, 0.02, 0.22, "sawtooth", 0.5, 780);
        tone(1080, 0.02, 0.2, "sawtooth", 0.35, 700, t0 + 0.32);
        break;

      case "clock":
        // 柱時計。非整数倍音を含む硬い打音。
        tone(1180, 0.002, 0.055, "square", 0.5);
        tone(2670, 0.002, 0.035, "sine", 0.22);
        noiseHit("bandpass", 3200, 6, 0.001, 0.03, 0.3);
        break;

      case "door": {
        // 扉。蝶番の軋みのあと、重い閉まり。
        const f = noiseHit("bandpass", 900, 9, 0.03, 0.42, 0.35, 0.6);
        f.frequency.setValueAtTime(700, t0);
        f.frequency.linearRampToValueAtTime(1500, t0 + 0.4);
        tone(78, 0.004, 0.3, "sine", 0.8, 44, t0 + 0.42);
        noiseHit("lowpass", 260, 1, 0.002, 0.24, 0.6);
        break;
      }

      case "paper":
        // 紙。二度に分けて擦れさせる。
        noiseHit("highpass", 4200, 0.8, 0.012, 0.16, 0.5, 1.3);
        noiseHit("highpass", 5600, 0.8, 0.01, 0.13, 0.35, 1.6);
        break;

      case "oar": {
        // 櫂。水を切る音 → 櫂受けの軋み → 雫。定位はキュー側で指定する。
        const f = noiseHit("bandpass", 1400, 2.2, 0.02, 0.26, 0.6, 0.9);
        f.frequency.setValueAtTime(1900, t0);
        f.frequency.exponentialRampToValueAtTime(700, t0 + 0.26);
        tone(196, 0.006, 0.16, "triangle", 0.35, 132, t0 + 0.2);
        tone(880, 0.003, 0.07, "sine", 0.16, 660, t0 + 0.34);
        break;
      }

      case "rope": {
        // 索の軋み。周波数を細かく揺らして張力を出す。
        const osc = ctx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(300, t0);
        osc.frequency.exponentialRampToValueAtTime(184, t0 + 0.55);
        const wob = ctx.createOscillator();
        wob.frequency.value = 11;
        const wobAmt = ctx.createGain();
        wobAmt.gain.value = 16;
        wob.connect(wobAmt).connect(osc.frequency);
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 1300;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.42, t0 + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6);
        osc.connect(lp).connect(g).connect(out);
        osc.start(t0);
        wob.start(t0);
        osc.stop(t0 + 0.7);
        wob.stop(t0 + 0.7);
        break;
      }

      case "explosion": {
        // 遠い爆発。証拠を担う音。直前の無音と対比させるため、
        // 立ち上がりは鈍く、低域を長く残す。
        const f = noiseHit("lowpass", 900, 0.7, 0.06, 2.6, 0.9, 0.5);
        f.frequency.setValueAtTime(900, t0);
        f.frequency.exponentialRampToValueAtTime(90, t0 + 2.2);
        tone(58, 0.05, 2.4, "sine", 0.85, 22);
        tone(140, 0.03, 0.9, "triangle", 0.3, 40);
        break;
      }

      case "heartbeat":
        // 二拍。二つ目をわずかに弱く、低く。
        tone(64, 0.004, 0.15, "sine", 0.9, 40);
        tone(58, 0.004, 0.17, "sine", 0.62, 34, t0 + 0.33);
        break;

      case "match":
        // マッチ。擦る雑音 → 発火。
        noiseHit("highpass", 3600, 0.7, 0.006, 0.1, 0.55, 1.8);
        noiseHit("bandpass", 1200, 1.4, 0.01, 0.3, 0.4, 0.7);
        break;

      // 環境音は startAmbient が扱う。ここへは来ない。
      case "rain":
      case "fen_water":
        break;
    }
  }
}

// ── 補助 ─────────────────────────────────────

type IrSpec = { seconds: number; decay: number; predelay: number; mix: number };

/**
 * 空間ごとの残響。
 * memoir（回想）に使う far だけを長く取り、現在の場面と聞き分けられるようにする。
 */
const IR: Record<Space, IrSpec> = {
  room: { seconds: 0.9, decay: 3.4, predelay: 0.006, mix: 0.16 },
  hall: { seconds: 2.1, decay: 2.6, predelay: 0.014, mix: 0.24 },
  outdoor: { seconds: 1.3, decay: 4.2, predelay: 0.02, mix: 0.1 },
  far: { seconds: 3.6, decay: 1.9, predelay: 0.045, mix: 0.34 },
};

/** 減衰する雑音からインパルス応答を作る。 */
export function makeImpulse(
  ctx: BaseAudioContext,
  seconds: number,
  decay: number,
  predelay: number,
): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.max(1, Math.floor(rate * seconds));
  const pre = Math.floor(rate * predelay);
  const buf = ctx.createBuffer(2, len + pre, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < pre; i++) data[i] = 0;
    for (let i = 0; i < len; i++) {
      // 左右で乱数を変え、広がりを持たせる
      const t = i / len;
      data[pre + i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
    }
  }
  return buf;
}

/** ピンク寄りの雑音。一様乱数のままだとざらつきが硬い。 */
export function makeNoise(ctx: BaseAudioContext): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * 3);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.03 * white) / 1.03;
    d[i] = white * 0.72 + last * 4.2;
  }
  return buf;
}

/** やわらかいリミッター。層が重なっても歪ませない。 */
export function makeLimiterCurve(): Float32Array<ArrayBuffer> {
  const n = 2048;
  // WaveShaperNode.curve は ArrayBuffer 実体の Float32Array を要求する。
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * 1.35) * 0.92;
  }
  return curve;
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

/** 資料生成とテスト用。場面の音がどの空間で鳴るかを引く。 */
export const spaceOf = { bgm: BGM_SPACE, se: SE_SPACE, ambient: AMBIENT };
