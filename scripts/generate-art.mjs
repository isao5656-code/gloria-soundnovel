/**
 * 場面背景と人物シルエットのSVGを生成する。
 *
 *   npm run art
 *
 * 設計方針
 *
 *  1. キャンバスは 1200x1080（比率1.11）。
 *     以前の 1600x1000（比率1.6）は、縦長のスマホで cover したとき
 *     横幅の3割弱しか見えなかった。正方形へ近づけることで、
 *     スマホで約5割、横長画面で高さの約7割が見えるようになる。
 *
 *  2. 主題は安全枠 x 300-900 / y 200-880 の中に置く。
 *     この範囲はどの画面比でも切れない。
 *
 *  3. ベタ塗りの平坦さを避ける。
 *     ・遠景ほど明度を上げ、ぼかして空気遠近を作る
 *     ・木目・雲・さざなみは feTurbulence で質感を与える
 *     ・全面に極薄の粒状ノイズを重ね、のっぺりした面をなくす
 *     ・光源には減衰する輝きと、当たった面のリムライトを必ず付ける
 *
 *  4. 場所が判別できる最低明度を守る。暗さで雰囲気を作らない。
 *  5. 画像に文字や証拠を焼き込まない。
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const W = 1200;
const H = 1080;

// ── 共通の道具 ─────────────────────────────

const svg = (defs, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice">
<defs>
${sharedDefs}
${defs}
</defs>
${body}
${grain}
</svg>
`;

const vGrad = (id, stops) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops
    .map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`)
    .join("")}</linearGradient>`;

const rGrad = (id, stops) =>
  `<radialGradient id="${id}">${stops
    .map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`)
    .join("")}</radialGradient>`;

/** どの場面でも使う定義。 */
const sharedDefs = `
<filter id="soft6" x="-25%" y="-25%" width="150%" height="150%">
  <feGaussianBlur stdDeviation="6"/>
</filter>
<filter id="far" x="-20%" y="-20%" width="140%" height="140%">
  <feGaussianBlur stdDeviation="4"/>
</filter>
<filter id="bloom" x="-70%" y="-70%" width="240%" height="240%">
  <feGaussianBlur stdDeviation="22" result="b"/>
  <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
<filter id="grainf" x="0" y="0" width="100%" height="100%">
  <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="7" stitchTiles="stitch"/>
  <feColorMatrix type="saturate" values="0"/>
</filter>
<filter id="cloud" x="-10%" y="-10%" width="120%" height="120%">
  <feTurbulence type="fractalNoise" baseFrequency="0.006 0.013" numOctaves="4" seed="3"/>
  <feColorMatrix type="saturate" values="0"/>
  <feComponentTransfer><feFuncA type="linear" slope="0.5" intercept="-0.09"/></feComponentTransfer>
</filter>
<filter id="ripplef" x="-5%" y="-5%" width="110%" height="110%">
  <feTurbulence type="fractalNoise" baseFrequency="0.004 0.055" numOctaves="3" seed="11"/>
  <feColorMatrix type="saturate" values="0"/>
  <feComponentTransfer><feFuncA type="linear" slope="0.45" intercept="-0.07"/></feComponentTransfer>
</filter>
<filter id="woodf" x="0" y="0" width="100%" height="100%">
  <feTurbulence type="fractalNoise" baseFrequency="0.55 0.014" numOctaves="3" seed="5"/>
  <feColorMatrix type="saturate" values="0"/>
  <feComponentTransfer><feFuncA type="linear" slope="0.32" intercept="-0.05"/></feComponentTransfer>
</filter>`;

/** ベタ塗りの平坦さを消す、ごく薄い粒状ノイズ。最後に重ねる。 */
const grain = `<rect width="${W}" height="${H}" filter="url(#grainf)" opacity="0.05" style="mix-blend-mode:overlay"/>`;

const clouds = (y, h, color, opacity) =>
  `<rect x="0" y="${y}" width="${W}" height="${h}" fill="${color}" filter="url(#cloud)" opacity="${opacity}"/>`;

const ripples = (y, h, color, opacity) =>
  `<rect x="0" y="${y}" width="${W}" height="${h}" fill="${color}" filter="url(#ripplef)" opacity="${opacity}"/>`;

const wood = (x, y, w, h, color, opacity) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}" filter="url(#woodf)" opacity="${opacity}"/>`;

const light = (x, y, r, id) => `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#${id})"/>`;

const pool = (cx, cy, rx, ry, id, opacity = 1) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#${id})" opacity="${opacity}"/>`;

/** 葦。層ごとに色と太さを変えて奥行きを作る。 */
function reedBank(baseY, { count, height, color, opacity, blur, spread = W, offset = 0, seed = 0 }) {
  let out = "";
  for (let i = 0; i < count; i++) {
    const n = i + seed;
    const x = offset + (spread / count) * i + ((n * 37) % 19);
    const h = height * (0.62 + (((n * 53) % 100) / 100) * 0.72);
    const lean = (((n * 29) % 9) - 4) * 5;
    const w = 1.6 + ((n * 17) % 3) * 0.9;
    out += `<path d="M${x} ${baseY} q${lean / 2} ${-h / 2} ${lean} ${-h}" stroke="${color}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;
    out += `<ellipse cx="${x + lean}" cy="${baseY - h}" rx="${(w * 1.3).toFixed(1)}" ry="${(h * 0.045).toFixed(1)}" fill="${color}"/>`;
  }
  return `<g opacity="${opacity}"${blur ? ` filter="url(#${blur})"` : ""}>${out}</g>`;
}

/** 明かりの点いた窓。硝子の格子と、こぼれる光。 */
function litWindow(x, y, w, h, glowId, warm = "#f2cd8a") {
  const bar = Math.max(2, w * 0.05);
  return `<g>
  ${light(x + w / 2, y + h / 2, Math.max(w, h) * 2.5, glowId)}
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${warm}" filter="url(#bloom)" opacity="0.9"/>
  <line x1="${x + w / 2}" y1="${y}" x2="${x + w / 2}" y2="${y + h}" stroke="#0d1013" stroke-width="${bar}"/>
  <line x1="${x}" y1="${y + h * 0.42}" x2="${x + w}" y2="${y + h * 0.42}" stroke="#0d1013" stroke-width="${bar}"/>
</g>`;
}

const range = (n) => Array.from({ length: n }, (_, i) => i);

// ── 場面 ───────────────────────────────────

const scenes = {};

/* 1. 大学の中庭 ─ 回廊、灯のともる窓、濡れた敷石 */
scenes.college = svg(
  `${vGrad("sky", [["0", "#141d29"], ["0.55", "#1e2b3a"], ["1", "#2b3948"]])}
   ${vGrad("stone", [["0", "#232c36"], ["1", "#161d25"]])}
   ${vGrad("ground", [["0", "#1b232c"], ["1", "#0d1319"]])}
   ${rGrad("warm", [["0", "#f0c479", 0.55], ["0.45", "#c99a4e", 0.2], ["1", "#c99a4e", 0]])}
   ${rGrad("floorlight", [["0", "#e8bf7d", 0.3], ["1", "#e8bf7d", 0]])}`,
  `<rect width="${W}" height="${H}" fill="url(#sky)"/>
${clouds(0, 460, "#6a8098", 0.16)}
<g filter="url(#far)" opacity="0.5">
  <rect x="60" y="250" width="1080" height="420" fill="#2a3644"/>
  <path d="M40 250 L600 150 L1160 250 z" fill="#2f3c4b"/>
</g>
<rect x="90" y="300" width="1020" height="470" fill="url(#stone)"/>
<g fill="#0e141b">
  ${range(4).map((i) => `<path d="M${205 + i * 230} 770 v-250 a86 86 0 0 1 172 0 v250 z"/>`).join("")}
</g>
<g fill="none" stroke="#39485a" stroke-width="4">
  ${range(4).map((i) => `<path d="M${205 + i * 230} 770 v-250 a86 86 0 0 1 172 0 v250"/>`).join("")}
</g>
<g fill="#4a5b6e" opacity="0.5">
  ${range(5).map((i) => `<rect x="${196 + i * 230}" y="480" width="5" height="290"/>`).join("")}
</g>
${litWindow(455, 470, 78, 132, "warm")}
${litWindow(685, 470, 78, 132, "warm")}
<rect x="90" y="294" width="1020" height="12" fill="#3c4a5b"/>
<rect x="0" y="770" width="${W}" height="310" fill="url(#ground)"/>
${pool(494, 836, 140, 46, "floorlight")}
${pool(724, 836, 120, 40, "floorlight")}
<g stroke="#26313d" stroke-width="2" opacity="0.45">
  ${range(5).map((i) => `<line x1="0" y1="${800 + i * 58}" x2="${W}" y2="${800 + i * 58}"/>`).join("")}
  ${range(7).map((i) => `<line x1="${i * 180}" y1="770" x2="${i * 180 - 60}" y2="1080"/>`).join("")}
</g>
${ripples(770, 310, "#7d94ad", 0.1)}`,
);

/* 2. 屋敷の外観 ─ 低い丘、嵐の空、葦原 */
scenes.manor = svg(
  `${vGrad("sky", [["0", "#1a2634"], ["0.42", "#2e3f52"], ["0.78", "#48596c"], ["1", "#5a6a7c"]])}
   ${vGrad("hill", [["0", "#233040"], ["1", "#131b24"]])}
   ${vGrad("wall", [["0", "#1d2732"], ["1", "#111820"]])}
   ${rGrad("warm", [["0", "#f0c479", 0.6], ["0.45", "#c99a4e", 0.22], ["1", "#c99a4e", 0]])}
   ${rGrad("moon", [["0", "#c3d4e4", 0.34], ["1", "#c3d4e4", 0]])}`,
  `<rect width="${W}" height="${H}" fill="url(#sky)"/>
${light(890, 205, 300, "moon")}
${clouds(0, 560, "#8ea3ba", 0.2)}
<g filter="url(#far)" opacity="0.45" fill="#2c3a4a">
  <ellipse cx="150" cy="640" rx="230" ry="70"/>
  <ellipse cx="1060" cy="620" rx="210" ry="62"/>
  <ellipse cx="600" cy="655" rx="280" ry="52"/>
</g>
<path d="M0 640 q300 -60 620 -44 q320 16 580 -30 v514 H0 z" fill="url(#hill)"/>
<g>
  <rect x="392" y="392" width="416" height="268" fill="url(#wall)"/>
  <path d="M368 392 L600 258 L832 392 z" fill="#161e27"/>
  <path d="M368 392 L600 258 L600 392 z" fill="#1c2530"/>
  <rect x="806" y="472" width="118" height="188" fill="#151c25"/>
  <path d="M792 472 L865 418 L938 472 z" fill="#131a22"/>
  <rect x="466" y="236" width="44" height="86" fill="#141b23"/>
  <rect x="690" y="222" width="44" height="100" fill="#141b23"/>
  <rect x="460" y="228" width="56" height="14" fill="#1e2833"/>
  <rect x="684" y="214" width="56" height="14" fill="#1e2833"/>
  <path d="M368 392 L600 258 L605 263 L377 397 z" fill="#3d4d5e" opacity="0.75"/>
  <rect x="392" y="392" width="416" height="5" fill="#39485a" opacity="0.55"/>
</g>
${litWindow(452, 452, 66, 96, "warm")}
${litWindow(672, 452, 66, 96, "warm")}
${litWindow(836, 522, 52, 74, "warm")}
<rect x="566" y="556" width="68" height="104" rx="4" fill="#0f151c"/>
<rect x="566" y="556" width="68" height="104" rx="4" fill="none" stroke="#3a4a5c" stroke-width="3"/>
${reedBank(716, { count: 44, height: 150, color: "#3a4757", opacity: 0.5, blur: "far", seed: 3 })}
${reedBank(806, { count: 38, height: 200, color: "#232e3b", opacity: 0.85, seed: 11 })}
${reedBank(1030, { count: 26, height: 300, color: "#0f151c", opacity: 0.95, seed: 23 })}
${clouds(600, 480, "#39485a", 0.12)}`,
);

/* 3. 玄関広間 ─ 羽目板、暖炉、火明かり */
scenes.hall = svg(
  `${vGrad("air", [["0", "#1b150f"], ["0.5", "#2a2018"], ["1", "#1a130d"]])}
   ${vGrad("panel", [["0", "#33261a"], ["1", "#20180f"]])}
   ${vGrad("floor", [["0", "#241a11"], ["1", "#120c07"]])}
   ${rGrad("fire", [["0", "#ffcf86", 0.8], ["0.3", "#e8933a", 0.36], ["0.68", "#a55f22", 0.1], ["1", "#a55f22", 0]])}
   ${rGrad("firepool", [["0", "#f0ab54", 0.32], ["1", "#f0ab54", 0]])}`,
  `<rect width="${W}" height="${H}" fill="url(#air)"/>
<rect x="0" y="0" width="${W}" height="128" fill="#150f0a"/>
<g fill="#241a11">
  ${range(5).map((i) => `<rect x="${-40 + i * 280}" y="0" width="54" height="128"/>`).join("")}
</g>
<rect x="0" y="120" width="${W}" height="14" fill="#3a2b1c"/>
<rect x="0" y="134" width="${W}" height="646" fill="url(#panel)"/>
${wood(0, 134, W, 646, "#6b4f31", 0.5)}
<g stroke="#171009" stroke-width="4">
  ${range(7).map((i) => `<line x1="${(i + 1) * 150}" y1="134" x2="${(i + 1) * 150}" y2="780"/>`).join("")}
</g>
<g stroke="#48331f" stroke-width="2" opacity="0.65">
  ${range(7).map((i) => `<line x1="${(i + 1) * 150 + 3}" y1="134" x2="${(i + 1) * 150 + 3}" y2="780"/>`).join("")}
</g>
<rect x="0" y="356" width="${W}" height="16" fill="#3d2c1b"/>
<rect x="0" y="372" width="${W}" height="5" fill="#5a4227" opacity="0.55"/>
<g>
  <rect x="430" y="292" width="340" height="330" fill="#0d0805"/>
  <rect x="452" y="312" width="296" height="292" fill="#0a0603"/>
  <rect x="404" y="262" width="392" height="42" rx="4" fill="#3d2c1b"/>
  <rect x="404" y="262" width="392" height="7" fill="#664a2c"/>
  <rect x="430" y="292" width="340" height="330" fill="none" stroke="#4a3520" stroke-width="7"/>
</g>
${light(600, 552, 300, "fire")}
<path d="M508 604 q92 -156 184 0 z" fill="#e8933a" opacity="0.9"/>
<path d="M540 604 q60 -112 120 0 z" fill="#f8cf82" opacity="0.92"/>
<path d="M572 604 q28 -62 56 0 z" fill="#fdeec4" opacity="0.9"/>
<g fill="#1d1109" stroke="#3a2413" stroke-width="3">
  <rect x="500" y="592" width="200" height="20" rx="9"/>
  <rect x="524" y="572" width="150" height="18" rx="8" transform="rotate(-5 599 581)"/>
</g>
<rect x="0" y="780" width="${W}" height="300" fill="url(#floor)"/>
${wood(0, 780, W, 300, "#6b4f31", 0.35)}
<g stroke="#150e08" stroke-width="3" opacity="0.75">
  ${range(5).map((i) => `<line x1="0" y1="${800 + i * 62}" x2="${W}" y2="${800 + i * 62}"/>`).join("")}
</g>
${pool(600, 832, 330, 76, "firepool")}
<g fill="#160f08" stroke="#4a3520" stroke-width="5">
  <rect x="128" y="286" width="176" height="234" rx="3"/>
  <rect x="896" y="286" width="176" height="234" rx="3"/>
</g>`,
);

/* 4. 書斎 ─ 書棚、机、緑の笠のランプ */
scenes.study = svg(
  `${vGrad("air", [["0", "#12171b"], ["1", "#1c2429"]])}
   ${vGrad("shelf", [["0", "#1d252b"], ["1", "#141a1f"]])}
   ${vGrad("night", [["0", "#2c3d4c"], ["1", "#1a2530"]])}
   ${vGrad("desk", [["0", "#33251a"], ["1", "#1b1209"]])}
   ${rGrad("lamp", [["0", "#ffe0a0", 0.7], ["0.32", "#e8b45e", 0.3], ["1", "#e8b45e", 0]])}
   ${rGrad("deskpool", [["0", "#f0c47d", 0.38], ["1", "#f0c47d", 0]])}`,
  `<rect width="${W}" height="${H}" fill="url(#air)"/>
${[40, 900]
  .map(
    (sx, si) => `<g>
  <rect x="${sx}" y="120" width="260" height="700" fill="url(#shelf)" stroke="#2e383f" stroke-width="5"/>
  ${range(5)
    .map(
      (r) => `<rect x="${sx + 8}" y="${140 + r * 136}" width="244" height="11" fill="#3a464e"/>` +
        range(8)
          .map((b) => {
            const n = b + r * 3 + si * 5;
            const bw = 20 + ((n * 13) % 4) * 6;
            const bh = 96 - ((n * 7) % 3) * 9;
            const col = ["#4a3a2c", "#2f3d48", "#4b352d", "#2b3a33", "#3c3247"][n % 5];
            const by = 151 + r * 136 + (96 - bh);
            return `<rect x="${sx + 14 + b * 30}" y="${by}" width="${bw}" height="${bh}" fill="${col}"/>` +
              `<rect x="${sx + 14 + b * 30}" y="${by}" width="2" height="${bh}" fill="#6b5a46" opacity="0.45"/>`;
          })
          .join(""),
    )
    .join("")}
</g>`,
  )
  .join("")}
<g>
  <rect x="420" y="120" width="360" height="392" fill="#0c1216" stroke="#2e383f" stroke-width="7"/>
  <rect x="438" y="138" width="324" height="356" fill="url(#night)" opacity="0.8"/>
  <line x1="600" y1="120" x2="600" y2="512" stroke="#2e383f" stroke-width="8"/>
  <line x1="420" y1="316" x2="780" y2="316" stroke="#2e383f" stroke-width="8"/>
  <g stroke="#9fb8cc" stroke-width="1.6" opacity="0.28">
    ${range(9).map((i) => `<line x1="${450 + i * 36}" y1="140" x2="${438 + i * 36}" y2="492"/>`).join("")}
  </g>
</g>
<rect x="300" y="700" width="600" height="34" rx="5" fill="#3d2c1b"/>
<rect x="300" y="700" width="600" height="7" fill="#6b4f31" opacity="0.65"/>
<rect x="332" y="734" width="536" height="260" fill="url(#desk)"/>
${wood(332, 734, 536, 260, "#6b4f31", 0.45)}
<g fill="none" stroke="#1a1209" stroke-width="4">
  <rect x="360" y="762" width="222" height="86"/>
  <rect x="618" y="762" width="222" height="86"/>
</g>
<g fill="#7a6242"><circle cx="471" cy="805" r="8"/><circle cx="729" cy="805" r="8"/></g>
<g>
  ${light(742, 656, 330, "lamp")}
  <rect x="734" y="614" width="16" height="76" fill="#3f3527"/>
  <path d="M676 614 q66 -46 132 0 q-14 22 -66 22 q-52 0 -66 -22 z" fill="#2f4a2c"/>
  <path d="M676 614 q66 -46 132 0 q-6 8 -12 12 q-54 -34 -108 0 q-6 -4 -12 -12 z" fill="#4a6b42" opacity="0.75"/>
  <ellipse cx="742" cy="620" rx="58" ry="9" fill="#ffe6b0" opacity="0.7" filter="url(#soft6)"/>
</g>
${pool(706, 706, 250, 26, "deskpool")}
<g>
  <rect x="424" y="676" width="196" height="30" rx="2" fill="#d8cfae" opacity="0.68" transform="rotate(-2 522 691)"/>
  <rect x="452" y="666" width="150" height="26" rx="2" fill="#e6dcbb" opacity="0.55" transform="rotate(3 527 679)"/>
</g>
<rect x="0" y="994" width="${W}" height="86" fill="#0b1014"/>`,
);

/* 5. 屋根裏 ─ 垂木、天窓、鉄の寝台 */
scenes.attic = svg(
  `${vGrad("air", [["0", "#0f1418"], ["1", "#1a2127"]])}
   ${vGrad("roof", [["0", "#161d23"], ["1", "#222b32"]])}
   ${vGrad("night", [["0", "#3d566b"], ["1", "#22323f"]])}
   ${vGrad("floor", [["0", "#1e262c"], ["1", "#0e1317"]])}
   ${rGrad("cold", [["0", "#a8c6de", 0.36], ["0.4", "#7695b0", 0.14], ["1", "#7695b0", 0]])}
   ${rGrad("floorpool", [["0", "#8fb0c9", 0.2], ["1", "#8fb0c9", 0]])}`,
  `<rect width="${W}" height="${H}" fill="url(#air)"/>
<path d="M0 0 L600 360 L1200 0 v760 H0 z" fill="url(#roof)"/>
<g stroke="#0e1418" stroke-width="22" fill="none" stroke-linecap="round">
  <path d="M-30 40 L610 400"/><path d="M1230 40 L590 400"/>
  <path d="M90 -30 L640 480"/><path d="M1110 -30 L560 480"/>
  <path d="M250 -60 L680 560"/><path d="M950 -60 L520 560"/>
</g>
<g stroke="#3a464f" stroke-width="4" fill="none" opacity="0.65">
  <path d="M-30 30 L610 390"/><path d="M1230 30 L590 390"/>
  <path d="M90 -40 L640 470"/><path d="M1110 -40 L560 470"/>
</g>
<rect x="0" y="516" width="${W}" height="26" fill="#2b353d"/>
<rect x="0" y="516" width="${W}" height="6" fill="#48555f"/>
<g>
  ${light(600, 300, 380, "cold")}
  <rect x="486" y="196" width="228" height="216" fill="#0a0f13" stroke="#3f4b55" stroke-width="9"/>
  <rect x="502" y="212" width="196" height="184" fill="url(#night)" opacity="0.9"/>
  <line x1="600" y1="196" x2="600" y2="412" stroke="#3f4b55" stroke-width="7"/>
  <line x1="486" y1="304" x2="714" y2="304" stroke="#3f4b55" stroke-width="7"/>
  <g stroke="#c3daea" stroke-width="1.6" opacity="0.32">
    ${range(6).map((i) => `<line x1="${510 + i * 32}" y1="214" x2="${498 + i * 32}" y2="394"/>`).join("")}
  </g>
</g>
<rect x="0" y="760" width="${W}" height="320" fill="url(#floor)"/>
${wood(0, 760, W, 320, "#5a6a76", 0.26)}
<g stroke="#0c1114" stroke-width="3" opacity="0.7">
  ${range(5).map((i) => `<line x1="0" y1="${782 + i * 66}" x2="${W}" y2="${782 + i * 66}"/>`).join("")}
</g>
${pool(600, 830, 240, 54, "floorpool")}
<g stroke="#3d4952" stroke-width="7" fill="none">
  <rect x="700" y="612" width="410" height="30" rx="8" fill="#222a31"/>
  <line x1="716" y1="642" x2="716" y2="800"/>
  <line x1="1094" y1="642" x2="1094" y2="800"/>
  <path d="M700 612 v-92 M1110 612 v-92"/>
  <path d="M700 520 q205 -34 410 0"/>
  ${range(5).map((i) => `<line x1="${756 + i * 82}" y1="526" x2="${756 + i * 82}" y2="612"/>`).join("")}
</g>
<g>
  <path d="M170 802 q64 -140 128 0 q10 62 -64 62 q-74 0 -64 -62 z" fill="#2b3138"/>
  <path d="M170 802 q64 -140 128 0 q-6 8 -14 10 q-50 -104 -100 0 q-8 -2 -14 -10 z" fill="#3e4750" opacity="0.75"/>
  <path d="M206 700 q28 -18 56 0" stroke="#4c5762" stroke-width="6" fill="none"/>
</g>`,
);

/* 6. 村 ─ 宿と郵便局、街灯、濡れた道 */
scenes.village = svg(
  `${vGrad("sky", [["0", "#202b39"], ["0.5", "#33445a"], ["1", "#4d5f74"]])}
   ${vGrad("wall", [["0", "#1c242e"], ["1", "#10161d"]])}
   ${vGrad("road", [["0", "#232b34"], ["1", "#12181e"]])}
   ${rGrad("warm", [["0", "#f2cd8a", 0.58], ["0.4", "#c99a4e", 0.2], ["1", "#c99a4e", 0]])}
   ${rGrad("street", [["0", "#ffdda0", 0.5], ["0.3", "#d9a75c", 0.2], ["1", "#d9a75c", 0]])}
   ${rGrad("roadpool", [["0", "#e8bf7d", 0.22], ["1", "#e8bf7d", 0]])}`,
  `<rect width="${W}" height="${H}" fill="url(#sky)"/>
${clouds(0, 520, "#8ea3ba", 0.2)}
<g filter="url(#far)" opacity="0.4" fill="#2a3644">
  <rect x="0" y="470" width="300" height="200"/>
  <rect x="980" y="452" width="260" height="220"/>
</g>
<g>
  <rect x="88" y="392" width="300" height="290" fill="url(#wall)"/>
  <path d="M64 392 L238 282 L412 392 z" fill="#161d25"/>
  <path d="M64 392 L238 282 L243 287 L75 397 z" fill="#3a4859" opacity="0.65"/>
  <rect x="452" y="330" width="330" height="352" fill="url(#wall)"/>
  <path d="M424 330 L617 210 L810 330 z" fill="#131a21"/>
  <path d="M424 330 L617 210 L622 215 L435 335 z" fill="#3f4e60" opacity="0.65"/>
  <rect x="838" y="418" width="272" height="264" fill="url(#wall)"/>
  <path d="M816 418 L974 330 L1132 418 z" fill="#161d25"/>
</g>
${litWindow(494, 384, 62, 84, "warm")}
${litWindow(676, 384, 62, 84, "warm")}
${litWindow(546, 522, 62, 84, "warm")}
${litWindow(140, 456, 56, 74, "warm")}
${litWindow(884, 496, 54, 70, "warm")}
<rect x="586" y="474" width="62" height="8" fill="#3d4a58"/>
<rect x="600" y="482" width="34" height="46" rx="3" fill="#2a3540" stroke="#4b5a6a" stroke-width="3"/>
<g>
  ${light(310, 556, 250, "street")}
  <rect x="302" y="576" width="12" height="200" fill="#2c3540"/>
  <path d="M282 576 h56 l-10 -34 h-36 z" fill="#39434f"/>
  <rect x="290" y="536" width="40" height="42" rx="4" fill="#ffdda0" opacity="0.88" filter="url(#bloom)"/>
</g>
<path d="M0 676 q300 26 620 20 q320 -6 580 26 v358 H0 z" fill="url(#road)"/>
${pool(310, 806, 200, 58, "roadpool")}
${pool(617, 764, 260, 44, "roadpool", 0.7)}
<g stroke="#0e1318" stroke-width="2" opacity="0.45">
  ${range(5).map((i) => `<path d="M${-100 + i * 330} 1080 q140 -220 ${240 - i * 20} -400"/>`).join("")}
</g>
${ripples(676, 404, "#93aac0", 0.09)}`,
);

/* 7. 沼と舟着き場 ─ 桟橋、葦、月の照り返し */
scenes.fen = svg(
  `${vGrad("sky", [["0", "#131b26"], ["0.42", "#243141"], ["1", "#3b4a5c"]])}
   ${vGrad("sea", [["0", "#3d4c5d"], ["0.35", "#26313d"], ["1", "#0e1318"]])}
   ${vGrad("plank", [["0", "#3a2a1b"], ["1", "#231809"]])}
   ${rGrad("moon", [["0", "#cfe0ee", 0.46], ["0.35", "#9db6cc", 0.14], ["1", "#9db6cc", 0]])}
   ${rGrad("moonpool", [["0", "#bcd2e4", 0.24], ["1", "#bcd2e4", 0]])}`,
  `<rect width="${W}" height="${H}" fill="url(#sky)"/>
${light(600, 196, 340, "moon")}
<circle cx="600" cy="196" r="32" fill="#e4eef7" opacity="0.42" filter="url(#soft6)"/>
<circle cx="600" cy="196" r="23" fill="#f2f7fc" opacity="0.66"/>
${clouds(0, 440, "#8fa8c0", 0.2)}
<g filter="url(#far)" opacity="0.55">
  <path d="M0 400 q220 -26 460 -14 q300 14 740 -22 v56 H0 z" fill="#1d2732"/>
  ${reedBank(406, { count: 40, height: 90, color: "#28333f", opacity: 0.8, seed: 5 })}
</g>
<rect x="0" y="418" width="${W}" height="662" fill="url(#sea)"/>
${ripples(418, 662, "#8fadc6", 0.18)}
${pool(600, 520, 120, 92, "moonpool")}
<g stroke="#7e9ab4" stroke-width="2" opacity="0.2">
  ${range(7).map((i) => `<path d="M${-60 + i * 190} ${470 + i * 66} q150 12 320 0 t320 0"/>`).join("")}
</g>
<g>
  <rect x="286" y="486" width="628" height="32" rx="4" fill="url(#plank)"/>
  <rect x="286" y="486" width="628" height="8" fill="#5c4327" opacity="0.85"/>
  ${wood(286, 486, 628, 32, "#7d5c37", 0.45)}
  <g stroke="#1a1207" stroke-width="3" opacity="0.65">
    ${range(7).map((i) => `<line x1="${286 + (i + 1) * 78}" y1="486" x2="${286 + (i + 1) * 78}" y2="518"/>`).join("")}
  </g>
  <g fill="#2a1e12">
    <rect x="330" y="518" width="28" height="300"/>
    <rect x="586" y="518" width="28" height="272"/>
    <rect x="852" y="518" width="28" height="312"/>
  </g>
  <g fill="#4a361f" opacity="0.65">
    <rect x="330" y="518" width="6" height="300"/>
    <rect x="586" y="518" width="6" height="272"/>
    <rect x="852" y="518" width="6" height="312"/>
  </g>
</g>
<g>
  <path d="M902 580 q116 -24 232 0 l-26 62 q-90 20 -180 0 z" fill="#1d1509"/>
  <path d="M902 580 q116 -24 232 0 l-4 10 q-112 -20 -224 0 z" fill="#4a361f" opacity="0.75"/>
  <path d="M930 590 q88 -14 176 0" stroke="#0d0904" stroke-width="6" fill="none"/>
</g>
<path d="M878 534 q30 40 30 56" stroke="#4a4438" stroke-width="4" fill="none"/>
${reedBank(620, { count: 32, height: 250, color: "#1b232c", opacity: 0.9, spread: 400, offset: -60, seed: 7 })}
${reedBank(640, { count: 28, height: 270, color: "#161d24", opacity: 0.92, spread: 400, offset: 860, seed: 17 })}
${reedBank(1000, { count: 30, height: 360, color: "#0a0e12", opacity: 0.95, seed: 29 })}`,
);

/* 8. 帆船 ─ 回想。マスト、索具、夜の海 */
scenes.ship = svg(
  `${vGrad("sky", [["0", "#0c1219"], ["0.45", "#1a2431"], ["1", "#2c3849"]])}
   ${vGrad("sea", [["0", "#26323f"], ["0.4", "#161f29"], ["1", "#080c11"]])}
   ${vGrad("hull", [["0", "#161f29"], ["1", "#0a0e13"]])}
   ${vGrad("sail", [["0", "#3b4854"], ["1", "#242e38"]])}
   ${rGrad("moon", [["0", "#dbe6f0", 0.42], ["0.35", "#9db6cc", 0.13], ["1", "#9db6cc", 0]])}
   ${rGrad("wake", [["0", "#c3d6e6", 0.18], ["1", "#c3d6e6", 0]])}`,
  `<rect width="${W}" height="${H}" fill="url(#sky)"/>
${light(910, 210, 380, "moon")}
<circle cx="910" cy="210" r="40" fill="#eef4fa" opacity="0.55" filter="url(#soft6)"/>
<circle cx="910" cy="210" r="30" fill="#f6fafd" opacity="0.72"/>
${clouds(0, 560, "#7d95ae", 0.18)}
<g stroke="#1d2833" stroke-width="2.2" opacity="0.85">
  ${range(9).map((i) => `<line x1="${348 + i * 26}" y1="300" x2="428" y2="700"/>`).join("")}
  ${range(9).map((i) => `<line x1="${700 + i * 26}" y1="266" x2="782" y2="700"/>`).join("")}
  <path d="M428 176 q180 60 354 -30" fill="none"/>
  <path d="M428 240 q180 66 354 -24" fill="none"/>
</g>
<g opacity="0.8">
  <path d="M336 300 q92 -26 184 0 v168 q-92 22 -184 0 z" fill="url(#sail)"/>
  <path d="M688 266 q92 -26 184 0 v182 q-92 22 -184 0 z" fill="url(#sail)"/>
  <g stroke="#4d5c6a" stroke-width="2" opacity="0.55">
    ${range(3).map((i) => `<line x1="${376 + i * 48}" y1="292" x2="${376 + i * 48}" y2="474"/>`).join("")}
    ${range(3).map((i) => `<line x1="${728 + i * 48}" y1="258" x2="${728 + i * 48}" y2="454"/>`).join("")}
  </g>
</g>
<g stroke="#101820" stroke-width="13" stroke-linecap="round">
  <line x1="428" y1="700" x2="428" y2="146"/>
  <line x1="782" y1="700" x2="782" y2="104"/>
</g>
<g stroke="#2c3a47" stroke-width="4">
  <line x1="428" y1="700" x2="428" y2="146"/>
  <line x1="782" y1="700" x2="782" y2="104"/>
</g>
<g stroke="#131c25" stroke-width="9" stroke-linecap="round">
  <line x1="330" y1="292" x2="530" y2="292"/>
  <line x1="682" y1="258" x2="882" y2="258"/>
</g>
<g>
  <path d="M232 700 q368 92 736 0 l-78 122 q-290 74 -580 0 z" fill="url(#hull)"/>
  <path d="M232 700 q368 92 736 0 l-8 14 q-360 88 -720 0 z" fill="#33414f" opacity="0.7"/>
  <g fill="#e8c88a" opacity="0.45">
    ${range(5).map((i) => `<rect x="${396 + i * 82}" y="744" width="26" height="20" rx="3"/>`).join("")}
  </g>
</g>
<rect x="0" y="800" width="${W}" height="280" fill="url(#sea)"/>
${ripples(760, 320, "#7f9ab2", 0.14)}
${pool(600, 858, 400, 44, "wake")}
<g stroke="#3d4d5d" stroke-width="2.4" opacity="0.3">
  ${range(6).map((i) => `<path d="M${-80 + i * 240} ${858 + i * 40} q140 14 300 0 t300 0"/>`).join("")}
</g>`,
);

/* 9. 夜明け ─ 終幕。低い太陽、水、葦 */
scenes.dawn = svg(
  `${vGrad("sky", [["0", "#2c3c50"], ["0.34", "#6b6f7c"], ["0.6", "#c2906a"], ["0.78", "#e8b27c"], ["1", "#f0c68e"]])}
   ${vGrad("sea", [["0", "#e0b183"], ["0.3", "#9c8570"], ["1", "#3a3a3a"]])}
   ${rGrad("sun", [["0", "#fff0cf", 0.8], ["0.28", "#ffcf90", 0.36], ["0.62", "#e8a25e", 0.12], ["1", "#e8a25e", 0]])}
   ${rGrad("sunpool", [["0", "#ffd9a2", 0.38], ["1", "#ffd9a2", 0]])}`,
  `<rect width="${W}" height="${H}" fill="url(#sky)"/>
${clouds(0, 620, "#8c7f86", 0.22)}
<g opacity="0.42">
  <ellipse cx="380" cy="392" rx="330" ry="20" fill="#f0c08e"/>
  <ellipse cx="820" cy="336" rx="260" ry="15" fill="#e8b27c"/>
  <ellipse cx="600" cy="452" rx="420" ry="17" fill="#f5d0a2"/>
</g>
${light(600, 636, 430, "sun")}
<circle cx="600" cy="636" r="62" fill="#fff3d8" opacity="0.9"/>
<g filter="url(#far)" opacity="0.75">
  <path d="M0 636 q260 -22 540 -12 q300 12 660 -20 v40 H0 z" fill="#4a4a4c"/>
</g>
<rect x="0" y="660" width="${W}" height="420" fill="url(#sea)"/>
${ripples(660, 420, "#ffd9a2", 0.16)}
${pool(600, 782, 120, 130, "sunpool")}
<g stroke="#8a7a6a" stroke-width="2.4" opacity="0.28">
  ${range(6).map((i) => `<path d="M${-60 + i * 220} ${702 + i * 60} q150 14 320 0 t320 0"/>`).join("")}
</g>
${reedBank(668, { count: 34, height: 130, color: "#3f3f42", opacity: 0.5, blur: "far", seed: 3 })}
${reedBank(1030, { count: 24, height: 300, color: "#1c1c1e", opacity: 0.9, seed: 13 })}`,
);

// ── 人物シルエット ─────────────────────────

const CW = 460;
const CH = 1000;

/**
 * 人物。透過背景。
 * 肩の傾き、外套の広がり、帽子の形で見分けられるようにする。
 * 左肩にリムライトを入れて、暗い背景から輪郭を浮かせる。
 */
function figure({ body, extras = "", tone = "#0b1116", rim = "#93aec4", rimOpacity = 0.5 }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CW} ${CH}" width="${CW}" height="${CH}">
<defs>
  <linearGradient id="b" x1="0.2" y1="0" x2="0.7" y2="1">
    <stop offset="0" stop-color="${tone}" stop-opacity="0.99"/>
    <stop offset="1" stop-color="${tone}" stop-opacity="0.86"/>
  </linearGradient>
  <linearGradient id="r" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="${rim}" stop-opacity="${rimOpacity}"/>
    <stop offset="0.13" stop-color="${rim}" stop-opacity="${(rimOpacity * 0.32).toFixed(3)}"/>
    <stop offset="0.3" stop-color="${rim}" stop-opacity="0"/>
  </linearGradient>
  <clipPath id="c">${body}</clipPath>
</defs>
<g fill="url(#b)">${body}</g>
<g clip-path="url(#c)"><rect width="${CW}" height="${CH}" fill="url(#r)"/></g>
${extras}
</svg>
`;
}

/**
 * 頭・首・肩・胴・腕をつないだ輪郭。
 * 肩から裾へ緩やかに広がる外套の形にして、団子状の輪郭を避ける。
 */
function torso({
  cx = 230,
  headCy = 168,
  headRx = 54,
  headRy = 64,
  shoulderY = 262,
  shoulderW = 96,
  hemW = 118,
  slope = 16,
  armW = 30,
}) {
  const neckTop = headCy + headRy - 10;
  return `
<ellipse cx="${cx}" cy="${headCy}" rx="${headRx}" ry="${headRy}"/>
<path d="M${cx - 24} ${neckTop}
  C${cx - 40} ${neckTop + 14} ${cx - shoulderW + 10} ${shoulderY - slope} ${cx - shoulderW} ${shoulderY}
  C${cx - shoulderW - 6} ${shoulderY + 240} ${cx - hemW + 4} ${740} ${cx - hemW} ${1000}
  H${cx + hemW}
  C${cx + hemW - 4} ${740} ${cx + shoulderW + 6} ${shoulderY + 240} ${cx + shoulderW} ${shoulderY}
  C${cx + shoulderW - 10} ${shoulderY - slope} ${cx + 40} ${neckTop + 14} ${cx + 24} ${neckTop} z"/>
<path d="M${cx - shoulderW + 6} ${shoulderY + 30}
  q${-armW * 0.7} 190 ${-armW * 0.2} 372 l${armW} 6
  q${-armW * 0.3} -190 ${armW * 0.55} -370 z"/>
<path d="M${cx + shoulderW - 6} ${shoulderY + 30}
  q${armW * 0.7} 190 ${armW * 0.2} 372 l${-armW} 6
  q${armW * 0.3} -190 ${-armW * 0.55} -370 z"/>`;
}

const characters = {
  // 若いホームズ。長身痩躯、帽子なし、肩は狭くやや前傾。
  holmes: figure({
    body:
      torso({ headCy: 158, headRx: 51, headRy: 62, shoulderW: 86, hemW: 106, slope: 10 }) +
      `<path d="M179 134 q51 -50 102 0 q-6 -48 -51 -48 q-45 0 -51 48 z"/>`,
  }),
  // ヴィクター。同年代だが肩幅が広く、姿勢がまっすぐ。
  victor: figure({
    body:
      torso({ headCy: 166, headRx: 55, headRy: 62, shoulderW: 100, hemW: 118, slope: 6 }) +
      `<path d="M175 144 q55 -52 110 0 q-4 -52 -55 -52 q-51 0 -55 52 z"/>`,
    tone: "#0c1218",
  }),
  // トレヴァー老人。ずんぐりした体格、広い肩、うつむき加減、頬髯。
  trevor: figure({
    body:
      torso({ headCy: 178, headRx: 57, headRy: 60, shoulderW: 112, hemW: 132, slope: 24 }) +
      `<path d="M173 162 q57 -48 114 0 q-2 -56 -57 -56 q-55 0 -57 56 z"/>
       <path d="M178 192 q-17 34 4 52 l15 -34 z"/><path d="M282 192 q17 34 -4 52 l-15 -34 z"/>`,
    tone: "#0a0f14",
  }),
  // ハドスン。小柄で痩せ、水夫帽、右腕を体側に固めた立ち方。
  hudson: figure({
    body:
      torso({ headCy: 192, headRx: 47, headRy: 54, shoulderW: 80, hemW: 98, slope: 18, armW: 22 }) +
      `<path d="M184 172 q46 -30 92 0 l8 -16 q-54 -36 -108 0 z"/>
       <rect x="178" y="162" width="104" height="17" rx="8"/>`,
    tone: "#080c10",
    rimOpacity: 0.4,
  }),
  // フォーダム医師。シルクハットと診療鞄。細身。
  fordham: figure({
    body:
      torso({ headCy: 214, headRx: 45, headRy: 53, shoulderW: 84, hemW: 104, slope: 8 }) +
      `<rect x="172" y="162" width="116" height="15" rx="7"/>
       <rect x="189" y="78" width="82" height="86" rx="6"/>`,
    extras: `<g fill="#0d1319"><rect x="318" y="600" width="96" height="74" rx="9"/><path d="M346 600 q22 -24 42 0" fill="none" stroke="#0d1319" stroke-width="9"/></g>`,
  }),
  // ビードウズ。高い襟の外套で顔を隠す立ち方。
  beddoes: figure({
    body:
      torso({ headCy: 192, headRx: 49, headRy: 56, shoulderW: 104, hemW: 126, slope: 14 }) +
      `<path d="M174 226 q56 -32 112 0 l6 46 q-62 -30 -124 0 z"/>
       <rect x="181" y="114" width="98" height="56" rx="10"/>
       <rect x="166" y="160" width="128" height="14" rx="7"/>`,
    tone: "#070b0f",
    rimOpacity: 0.42,
  }),
  // プレンダーガスト。長身、裾の長い外套、堂々とした立ち姿。
  prendergast: figure({
    body:
      torso({ headCy: 150, headRx: 52, headRy: 60, shoulderW: 106, hemW: 130, slope: 4 }) +
      `<path d="M178 130 q52 -48 104 0 q-6 -52 -52 -52 q-46 0 -52 52 z"/>
       <path d="M230 292 q-66 28 -72 92 l144 0 q-6 -64 -72 -92 z"/>`,
    tone: "#06090c",
  }),
};

mkdirSync(resolve(root, "public/scenes"), { recursive: true });
mkdirSync(resolve(root, "public/characters"), { recursive: true });

for (const [name, content] of Object.entries(scenes)) {
  writeFileSync(resolve(root, `public/scenes/${name}.svg`), content);
}
for (const [name, content] of Object.entries(characters)) {
  writeFileSync(resolve(root, `public/characters/${name}.svg`), content);
}

console.log(
  `生成しました：場面 ${Object.keys(scenes).length} 枚（${W}x${H}） / 人物 ${Object.keys(characters).length} 体（${CW}x${CH}）`,
);
