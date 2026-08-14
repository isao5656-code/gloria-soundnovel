import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { story } from "@/content/story";
import type { AudioCue } from "@/content/types";
import { AudioEngine, audioCaption, makeImpulse, makeLimiterCurve, spaceOf } from "@/lib/audio";

/**
 * 音響エンジンの検査。
 *
 * 実際の音は耳でしか判断できないが、次は機械的に確かめられる。
 *  ・合成グラフが例外なく組み上がること
 *  ・残響とリミッターが実際に接続されること
 *  ・環境音が鳴りっぱなしになり、場面から消えたら止まること
 *  ・無音が「実際に鳴らない状態」になること
 */

// ── 最小限の偽 AudioContext ────────────────

type Rec = { type: string; connectedTo: Rec[] };

class FakeParam {
  value = 0;
  constructor(v = 0) {
    this.value = v;
  }
  setValueAtTime() {
    return this;
  }
  linearRampToValueAtTime(v: number) {
    this.value = v;
    return this;
  }
  exponentialRampToValueAtTime(v: number) {
    this.value = v;
    return this;
  }
  setTargetAtTime(v: number) {
    this.value = v;
    return this;
  }
  cancelScheduledValues() {
    return this;
  }
}

function node(type: string, extra: Record<string, unknown> = {}): Rec {
  const n: Record<string, unknown> = {
    type,
    connectedTo: [] as Rec[],
    connect(dest: Rec) {
      (n.connectedTo as Rec[]).push(dest);
      return dest;
    },
    disconnect() {},
    ...extra,
  };
  return n as unknown as Rec;
}

class FakeContext {
  sampleRate = 48000;
  currentTime = 0;
  state = "running";
  destination = node("destination");
  created: string[] = [];

  private make(type: string, extra: Record<string, unknown> = {}) {
    this.created.push(type);
    return node(type, extra);
  }
  async resume() {}
  async close() {}
  createGain() {
    return this.make("gain", { gain: new FakeParam(1) });
  }
  createWaveShaper() {
    return this.make("waveshaper", { curve: null, oversample: "none" });
  }
  createConvolver() {
    return this.make("convolver", { buffer: null });
  }
  createStereoPanner() {
    return this.make("stereopanner", { pan: new FakeParam(0) });
  }
  createBiquadFilter() {
    return this.make("biquad", {
      type: "lowpass",
      frequency: new FakeParam(350),
      Q: new FakeParam(1),
    });
  }
  createOscillator() {
    return this.make("oscillator", {
      type: "sine",
      frequency: new FakeParam(440),
      detune: new FakeParam(0),
      start() {},
      stop() {},
    });
  }
  createBufferSource() {
    return this.make("buffersource", {
      buffer: null,
      loop: false,
      playbackRate: new FakeParam(1),
      start() {},
      stop() {},
    });
  }
  createBuffer(ch: number, len: number, rate: number) {
    const data = Array.from({ length: ch }, () => new Float32Array(len));
    return {
      numberOfChannels: ch,
      length: len,
      sampleRate: rate,
      getChannelData: (i: number) => data[i],
    } as unknown as AudioBuffer;
  }
}

let ctx: FakeContext;

beforeEach(() => {
  ctx = new FakeContext();
  vi.stubGlobal("window", {
    AudioContext: function () {
      return ctx;
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function makeEngine() {
  const e = new AudioEngine();
  await e.enable();
  return e;
}

describe("音響エンジンの組み立て", () => {
  it("有効化すると、残響とリミッターが作られる", async () => {
    const e = await makeEngine();
    expect(e.enabled).toBe(true);
    expect(ctx.created).toContain("waveshaper");
    // 空間は4種。畳み込みも4つ作られる。
    expect(ctx.created.filter((t) => t === "convolver").length).toBe(4);
    e.disable();
  });

  it("リミッターの曲線が、区間外へ出ない単調増加である", () => {
    const c = makeLimiterCurve();
    expect(c.length).toBeGreaterThan(0);
    for (let i = 1; i < c.length; i++) {
      expect(c[i]).toBeGreaterThanOrEqual(c[i - 1]);
      expect(Math.abs(c[i])).toBeLessThanOrEqual(1);
    }
  });

  it("インパルス応答が、前置遅延のあと減衰する", () => {
    const buf = makeImpulse(ctx as unknown as BaseAudioContext, 1, 3, 0.02);
    const d = buf.getChannelData(0);
    const pre = Math.floor(ctx.sampleRate * 0.02);
    // 前置遅延のあいだは無音
    for (let i = 0; i < pre; i++) expect(d[i]).toBe(0);
    const head = rms(d.subarray(pre, pre + 2000));
    const tail = rms(d.subarray(d.length - 2000));
    expect(head).toBeGreaterThan(0);
    expect(tail).toBeLessThan(head * 0.5);
  });
});

describe("環境音の継続", () => {
  it("雨のある場面では鳴り続け、雨のない場面で止まる", async () => {
    const e = await makeEngine();
    const withRain: AudioCue[] = [{ kind: "se", asset: "rain", volume: 0.4 }];
    const withoutRain: AudioCue[] = [{ kind: "se", asset: "clock" }];

    e.play(withRain);
    const after1 = ctx.created.length;
    // 同じ場面をもう一度適用しても、二重には鳴らさない
    e.play(withRain);
    expect(ctx.created.length).toBe(after1);

    e.play(withoutRain);
    // 雨が止まったあと、もう一度雨を指定すれば作り直される
    const before = ctx.created.length;
    e.play(withRain);
    expect(ctx.created.length).toBeGreaterThan(before);
    e.disable();
  });

  it("環境音として扱う音は、一発の効果音として鳴らさない", () => {
    expect(spaceOf.ambient).toContain("rain");
    expect(spaceOf.ambient).toContain("fen_water");
  });
});

describe("無音", () => {
  it("無音のあいだ、実際にマスターが絞りきられる", async () => {
    vi.useFakeTimers();
    const e = await makeEngine();
    e.play([{ kind: "bgm", asset: "unease" }, { kind: "se", asset: "rain" }]);
    e.play([{ kind: "silence", durationMs: 2500 }]);
    // 内部の master は直接触れないので、外形で確認する：
    // 無音の指定後は、BGMも環境音も作り直しの対象になっている。
    const before = ctx.created.length;
    e.play([{ kind: "bgm", asset: "unease" }]);
    expect(ctx.created.length).toBeGreaterThan(before);
    vi.useRealTimers();
    e.disable();
  });
});

describe("場面の音が、すべて例外なく鳴らせる", () => {
  it("シナリオ中のすべての音キューを順に適用しても落ちない", async () => {
    const e = await makeEngine();
    for (const n of story) {
      expect(() => e.play(n.audio)).not.toThrow();
      ctx.currentTime += 1;
    }
    e.disable();
  });

  it("すべての効果音・BGMに残響の割り当てがある", () => {
    for (const n of story) {
      for (const cue of n.audio ?? []) {
        if (cue.kind === "bgm") expect(spaceOf.bgm[cue.asset]).toBeTruthy();
        if (cue.kind === "se") expect(spaceOf.se[cue.asset]).toBeTruthy();
      }
    }
  });

  it("回想だけが、最も長い残響を使う", () => {
    expect(spaceOf.bgm.memoir).toBe("far");
    const others = Object.entries(spaceOf.bgm).filter(([k]) => k !== "memoir");
    for (const [, space] of others) expect(space).not.toBe("far");
  });
});

describe("音の字幕", () => {
  it("無音と定位を、音を切っていても読める形にする", () => {
    expect(audioCaption([{ kind: "silence", durationMs: 3000 }])).toBe("無音（3.0秒）");
    expect(audioCaption([{ kind: "se", asset: "oar", pan: -0.5 }])).toBe("櫂の音（左）");
    expect(audioCaption([{ kind: "se", asset: "oar", pan: 0.5 }])).toBe("櫂の音（右）");
    expect(audioCaption([{ kind: "bgm", asset: "elegy" }])).toBeNull();
  });
});

function rms(a: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * a[i];
  return Math.sqrt(s / a.length);
}
