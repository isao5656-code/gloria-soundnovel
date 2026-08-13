/**
 * 場面背景と人物シルエットのSVGを生成する。
 *
 *   node scripts/generate-art.mjs
 *
 * 方針：
 *  - 背景は場所が判別できる最低明度を保つ。暗さで雰囲気を作らない。
 *  - 重要な被写体は中央寄りに置く。スマホの cover 切れで主題を失わせない。
 *  - 画像に文字や証拠を焼き込まない。
 *  - 人物は透過背景。腰から下は本文ウィンドウに自然に隠れる想定で描く。
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const W = 1600;
const H = 1000;

const svg = (body, w = W, h = H) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice">\n${body}\n</svg>\n`;

const sky = (id, stops) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops
    .map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`)
    .join("")}</linearGradient>`;

const glow = (id, c, o = 0.5) =>
  `<radialGradient id="${id}"><stop offset="0" stop-color="${c}" stop-opacity="${o}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`;

/** 葦。沼の場面の主役なので、乱数ではなく決まった揺らぎで並べる。 */
function reeds(baseY, count, color, opacity, spread = W, offset = 0) {
  let out = "";
  for (let i = 0; i < count; i++) {
    const x = offset + (spread / count) * i + ((i * 37) % 23);
    const h = 120 + ((i * 53) % 150);
    const lean = ((i % 5) - 2) * 9;
    out += `<path d="M${x} ${baseY} q${lean / 2} ${-h / 2} ${lean} ${-h}" stroke="${color}" stroke-width="${2 + (i % 3)}" fill="none" opacity="${opacity}"/>`;
  }
  return out;
}

/** 窓や灯。場所を読み取れる手掛かりとして、必ず一つは明るい点を置く。 */
const lamp = (x, y, r, id) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#${id})"/>`;

const scenes = {
  // 大学の中庭。回想の枠にも使う落ち着いた場所。
  college: svg(`
<defs>
  ${sky("s", [["0", "#1b2733"], ["0.55", "#2a3644"], ["1", "#141c24"]])}
  ${glow("g", "#e6c079", 0.55)}
</defs>
<rect width="${W}" height="${H}" fill="url(#s)"/>
<rect x="0" y="620" width="${W}" height="380" fill="#171f27"/>
<g fill="#0f161d">
  <rect x="120" y="180" width="1360" height="450"/>
</g>
<g fill="#1d2732" stroke="#2b3846" stroke-width="3">
  ${[0, 1, 2, 3, 4].map((i) => `<path d="M${230 + i * 270} 630 v-230 a70 70 0 0 1 140 0 v230 z"/>`).join("")}
</g>
<g fill="#e8c987" opacity="0.5">
  <rect x="640" y="450" width="60" height="90" rx="4"/>
  <rect x="910" y="450" width="60" height="90" rx="4"/>
</g>
${lamp(670, 495, 200, "g")}
${lamp(940, 495, 170, "g")}
<rect x="0" y="618" width="${W}" height="8" fill="#212b36"/>
<g opacity="0.35" fill="#0b1116">
  <ellipse cx="800" cy="1000" rx="900" ry="230"/>
</g>
`),

  // 屋敷の外観。低い丘の上の家と葦原。
  manor: svg(`
<defs>
  ${sky("s", [["0", "#232f3c"], ["0.5", "#33414f"], ["1", "#4a5563"]])}
  ${glow("g", "#e8c987", 0.6)}
</defs>
<rect width="${W}" height="${H}" fill="url(#s)"/>
<g fill="#2b3542" opacity="0.7">
  <ellipse cx="300" cy="720" rx="520" ry="120"/>
  <ellipse cx="1350" cy="700" rx="480" ry="110"/>
</g>
<path d="M0 700 q400 -80 800 -60 q400 20 800 -20 v380 H0 z" fill="#1c242e"/>
<g fill="#141b23" stroke="#2e3a48" stroke-width="3">
  <rect x="600" y="420" width="420" height="230"/>
  <path d="M580 420 L810 300 L1040 420 z"/>
  <rect x="1020" y="500" width="120" height="150"/>
  <rect x="700" y="270" width="46" height="70"/>
  <rect x="880" y="258" width="46" height="82"/>
</g>
<g fill="#e8c987" opacity="0.65">
  <rect x="660" y="470" width="48" height="66" rx="3"/>
  <rect x="900" y="470" width="48" height="66" rx="3"/>
</g>
${lamp(686, 503, 190, "g")}
${lamp(926, 503, 150, "g")}
${reeds(760, 46, "#26303c", 0.85)}
${reeds(830, 34, "#1a2129", 0.9)}
<g opacity="0.3" fill="#080d12"><ellipse cx="800" cy="1010" rx="950" ry="220"/></g>
`),

  // 玄関広間。屋敷の中であることが一目でわかる暖炉と羽目板。
  hall: svg(`
<defs>
  ${sky("s", [["0", "#1a1611"], ["1", "#241d15"]])}
  ${glow("g", "#f0b45e", 0.75)}
</defs>
<rect width="${W}" height="${H}" fill="url(#s)"/>
<g fill="#2a2118" stroke="#3a2e21" stroke-width="3">
  ${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<rect x="${i * 200}" y="300" width="196" height="700"/>`).join("")}
</g>
<rect x="0" y="0" width="${W}" height="300" fill="#161009"/>
<g fill="#120d07" stroke="#453421" stroke-width="4">
  <rect x="620" y="470" width="360" height="330"/>
  <rect x="590" y="440" width="420" height="40"/>
</g>
<path d="M700 800 q100 -170 200 0 z" fill="#e8933a" opacity="0.85"/>
<path d="M745 800 q55 -105 110 0 z" fill="#f7d488" opacity="0.9"/>
${lamp(800, 740, 430, "g")}
<g fill="#1d1710" stroke="#3a2e21" stroke-width="3">
  <rect x="180" y="380" width="200" height="290" rx="4"/>
  <rect x="1220" y="380" width="200" height="290" rx="4"/>
</g>
<g opacity="0.4" fill="#070502"><ellipse cx="800" cy="1010" rx="920" ry="200"/></g>
`),

  // 書斎。書棚と机の灯。調査の起点。
  study: svg(`
<defs>
  ${sky("s", [["0", "#151a1c"], ["1", "#1e2427"]])}
  ${glow("g", "#f2c877", 0.8)}
</defs>
<rect width="${W}" height="${H}" fill="url(#s)"/>
<g>
  <rect x="60" y="180" width="560" height="620" fill="#191f22" stroke="#2c3438" stroke-width="4"/>
  <rect x="980" y="180" width="560" height="620" fill="#191f22" stroke="#2c3438" stroke-width="4"/>
  ${[0, 1, 2, 3]
    .map(
      (r) =>
        `<rect x="70" y="${196 + r * 152}" width="540" height="14" fill="#2f3a3f"/>` +
        `<rect x="990" y="${196 + r * 152}" width="540" height="14" fill="#2f3a3f"/>` +
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
          .map(
            (b) =>
              `<rect x="${84 + b * 44}" y="${210 + r * 152 + (b % 3) * 6}" width="${26 + (b % 4) * 5}" height="${118 - (b % 3) * 8}" fill="${["#3b3026", "#2f3a44", "#43342c", "#2a3730"][b % 4]}"/>` +
              `<rect x="${1004 + b * 44}" y="${210 + r * 152 + ((b + 1) % 3) * 6}" width="${26 + ((b + 2) % 4) * 5}" height="${118 - ((b + 1) % 3) * 8}" fill="${["#2f3a44", "#43342c", "#2a3730", "#3b3026"][b % 4]}"/>`,
          )
          .join(""),
    )
    .join("")}
</g>
<rect x="640" y="150" width="320" height="360" fill="#0d1418" stroke="#2c3438" stroke-width="5"/>
<rect x="656" y="166" width="288" height="328" fill="#2a3945" opacity="0.65"/>
<line x1="800" y1="150" x2="800" y2="510" stroke="#2c3438" stroke-width="6"/>
<rect x="560" y="700" width="480" height="30" fill="#2b2119"/>
<rect x="600" y="730" width="400" height="200" fill="#20190f"/>
<g>
  <rect x="880" y="640" width="16" height="62" fill="#3a3126"/>
  <ellipse cx="888" cy="636" rx="52" ry="26" fill="#3f5a2f" opacity="0.9"/>
  ${lamp(888, 660, 330, "g")}
</g>
<rect x="640" y="676" width="180" height="26" fill="#d8cfae" opacity="0.55"/>
<g opacity="0.42" fill="#05080a"><ellipse cx="800" cy="1010" rx="900" ry="210"/></g>
`),

  // 屋根裏。斜めの天井と梁で、他の室内と区別する。
  attic: svg(`
<defs>
  ${sky("s", [["0", "#12161a"], ["1", "#1b2126"]])}
  ${glow("g", "#8fb2cc", 0.5)}
</defs>
<rect width="${W}" height="${H}" fill="url(#s)"/>
<path d="M0 0 L800 340 L1600 0 v${H} H0 z" fill="#171d22"/>
<g stroke="#2f3941" stroke-width="16" fill="none">
  <path d="M-40 60 L820 420"/>
  <path d="M1640 60 L780 420"/>
  <path d="M60 -20 L860 500"/>
  <path d="M1540 -20 L740 500"/>
</g>
<rect x="0" y="470" width="${W}" height="30" fill="#333d45"/>
<rect x="0" y="500" width="${W}" height="500" fill="#1c2228"/>
<g>
  <rect x="690" y="250" width="220" height="200" fill="#0c1116" stroke="#3b464f" stroke-width="7"/>
  <rect x="706" y="266" width="188" height="168" fill="#5b7f9c" opacity="0.55"/>
  <line x1="800" y1="250" x2="800" y2="450" stroke="#3b464f" stroke-width="6"/>
  <line x1="690" y1="350" x2="910" y2="350" stroke="#3b464f" stroke-width="6"/>
  ${lamp(800, 360, 420, "g")}
</g>
<g fill="#232a31" stroke="#39434b" stroke-width="4">
  <rect x="1080" y="600" width="380" height="34" rx="6"/>
  <rect x="1110" y="634" width="20" height="150"/>
  <rect x="1410" y="634" width="20" height="150"/>
</g>
<g fill="#2a2018" stroke="#3d3025" stroke-width="4">
  <rect x="200" y="690" width="260" height="150" rx="8"/>
  <rect x="200" y="740" width="260" height="14"/>
</g>
<g opacity="0.4" fill="#05080b"><ellipse cx="800" cy="1010" rx="900" ry="200"/></g>
`),

  // 村。宿と郵便局。屋敷とも沼とも違う「人のいる場所」。
  village: svg(`
<defs>
  ${sky("s", [["0", "#2a333f"], ["0.6", "#3b4552"], ["1", "#525c68"]])}
  ${glow("g", "#f0c070", 0.7)}
</defs>
<rect width="${W}" height="${H}" fill="url(#s)"/>
<path d="M0 640 q300 -50 620 -30 q380 24 980 -34 v424 H0 z" fill="#242c34"/>
<g fill="#171d24" stroke="#333d47" stroke-width="4">
  <rect x="140" y="400" width="330" height="270"/>
  <path d="M120 400 L305 300 L490 400 z"/>
  <rect x="560" y="360" width="380" height="310"/>
  <path d="M535 360 L750 250 L965 360 z"/>
  <rect x="1030" y="420" width="300" height="250"/>
  <path d="M1010 420 L1180 330 L1350 420 z"/>
</g>
<g fill="#f2c274" opacity="0.7">
  <rect x="620" y="430" width="60" height="80" rx="4"/>
  <rect x="820" y="430" width="60" height="80" rx="4"/>
  <rect x="230" y="470" width="52" height="70" rx="4"/>
  <rect x="1120" y="490" width="52" height="66" rx="4"/>
</g>
${lamp(650, 470, 210, "g")}
${lamp(850, 470, 190, "g")}
${lamp(256, 505, 150, "g")}
<g fill="#2f3841">
  <rect x="740" y="560" width="26" height="110"/>
  <rect x="700" y="540" width="106" height="26" rx="6"/>
</g>
<path d="M0 700 q400 40 800 30 q400 -10 800 30 v240 H0 z" fill="#1a2027"/>
<g opacity="0.35" fill="#070b0f"><ellipse cx="800" cy="1010" rx="920" ry="200"/></g>
`),

  // 沼と舟着き場。事件の中心。水面と杭を主題に置く。
  fen: svg(`
<defs>
  ${sky("s", [["0", "#141c26"], ["0.45", "#26323f"], ["1", "#39424e"]])}
  <linearGradient id="w" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#3b4956"/><stop offset="1" stop-color="#111820"/>
  </linearGradient>
  ${glow("g", "#9fc0da", 0.4)}
</defs>
<rect width="${W}" height="${H}" fill="url(#s)"/>
<ellipse cx="880" cy="330" rx="300" ry="120" fill="#4a5a68" opacity="0.28"/>
<path d="M0 560 q260 -34 520 -18 q340 20 1080 -26 v60 H0 z" fill="#1b232c"/>
<rect x="0" y="590" width="${W}" height="410" fill="url(#w)"/>
<g stroke="#6b8296" stroke-width="3" opacity="0.3">
  ${[0, 1, 2, 3, 4, 5, 6, 7]
    .map((i) => `<path d="M${100 + i * 200} ${660 + i * 40} q140 12 300 0"/>`)
    .join("")}
</g>
${reeds(600, 40, "#202932", 0.9)}
${reeds(650, 26, "#161d24", 0.95, 700, -60)}
${reeds(650, 26, "#161d24", 0.95, 700, 980)}
<g fill="#241d16" stroke="#3a3025" stroke-width="4">
  <rect x="600" y="640" width="420" height="26" rx="4"/>
  <rect x="640" y="666" width="20" height="150"/>
  <rect x="960" y="666" width="20" height="150"/>
  <rect x="800" y="666" width="20" height="130"/>
</g>
<g fill="#1d160f" stroke="#3a3025" stroke-width="4">
  <path d="M1080 700 q120 -26 240 0 l-30 62 q-90 20 -180 0 z"/>
</g>
${lamp(880, 330, 330, "g")}
<g opacity="0.4" fill="#060a0e"><ellipse cx="800" cy="1010" rx="940" ry="210"/></g>
`),

  // 帆船。手記の回想。ここだけ水平線を高く取り、海であることを強調する。
  ship: svg(`
<defs>
  ${sky("s", [["0", "#0f151d"], ["0.55", "#1c2531"], ["1", "#2b3542"]])}
  <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#243040"/><stop offset="1" stop-color="#0d131a"/>
  </linearGradient>
  ${glow("g", "#cfd8e2", 0.35)}
</defs>
<rect width="${W}" height="${H}" fill="url(#s)"/>
${lamp(1180, 250, 340, "g")}
<circle cx="1180" cy="250" r="52" fill="#dfe6ee" opacity="0.55"/>
<rect x="0" y="620" width="${W}" height="380" fill="url(#sea)"/>
<g stroke="#465565" stroke-width="3" opacity="0.4">
  ${[0, 1, 2, 3, 4, 5]
    .map((i) => `<path d="M${-40 + i * 300} ${680 + i * 46} q160 16 340 0 t340 0"/>`)
    .join("")}
</g>
<g stroke="#0d1218" stroke-width="5" fill="#101821">
  <path d="M470 620 q330 90 660 0 l-70 96 q-260 66 -520 0 z"/>
</g>
<g stroke="#1c2733" stroke-width="9">
  <line x1="640" y1="620" x2="640" y2="150"/>
  <line x1="800" y1="620" x2="800" y2="90"/>
  <line x1="960" y1="620" x2="960" y2="170"/>
</g>
<g stroke="#1c2733" stroke-width="5">
  <line x1="560" y1="250" x2="720" y2="250"/>
  <line x1="700" y1="180" x2="900" y2="180"/>
  <line x1="880" y1="270" x2="1040" y2="270"/>
</g>
<g stroke="#22303d" stroke-width="2" opacity="0.85">
  ${[0, 1, 2, 3, 4, 5, 6, 7]
    .map((i) => `<line x1="${560 + i * 32}" y1="250" x2="640" y2="600"/>`)
    .join("")}
  ${[0, 1, 2, 3, 4, 5, 6, 7]
    .map((i) => `<line x1="${880 + i * 32}" y1="270" x2="960" y2="600"/>`)
    .join("")}
</g>
<g fill="#2c3844" opacity="0.75">
  <path d="M646 190 q90 -20 148 0 v130 q-74 18 -148 0 z"/>
  <path d="M806 130 q90 -20 148 0 v140 q-74 18 -148 0 z"/>
</g>
<g opacity="0.4" fill="#04070a"><ellipse cx="800" cy="1010" rx="940" ry="200"/></g>
`),

  // 夜明け。終幕。唯一、明るさが上へ抜ける絵にする。
  dawn: svg(`
<defs>
  ${sky("s", [["0", "#2b3a4c"], ["0.42", "#6d7482"], ["0.7", "#c99a72"], ["1", "#e8c68f"]])}
  <linearGradient id="w" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#d9b385"/><stop offset="1" stop-color="#3b3a38"/>
  </linearGradient>
  ${glow("g", "#ffdca8", 0.75)}
</defs>
<rect width="${W}" height="${H}" fill="url(#s)"/>
${lamp(800, 660, 520, "g")}
<circle cx="800" cy="662" r="64" fill="#ffe9c2" opacity="0.85"/>
<path d="M0 640 q240 -22 520 -12 q360 14 1080 -18 v40 H0 z" fill="#3d4550" opacity="0.85"/>
<rect x="0" y="668" width="${W}" height="332" fill="url(#w)"/>
<g stroke="#8c7a63" stroke-width="3" opacity="0.35">
  ${[0, 1, 2, 3, 4, 5]
    .map((i) => `<path d="M${60 + i * 260} ${730 + i * 44} q150 14 320 0"/>`)
    .join("")}
</g>
${reeds(672, 34, "#2c333c", 0.8)}
<g opacity="0.28" fill="#1a1611"><ellipse cx="800" cy="1015" rx="940" ry="180"/></g>
`),
};

/**
 * 人物シルエット。透過背景。
 * 帽子・肩幅・姿勢で区別し、色ではなく形で見分けられるようにする。
 */
const CW = 420;
const CH = 940;

function figure({ head, body, extras = "", tone = "#0b1116", rim = "#8fa6bb" }) {
  return svg(
    `
<defs>
  <linearGradient id="b" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${tone}" stop-opacity="0.98"/>
    <stop offset="1" stop-color="${tone}" stop-opacity="0.82"/>
  </linearGradient>
  <linearGradient id="r" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="${rim}" stop-opacity="0.5"/>
    <stop offset="0.18" stop-color="${rim}" stop-opacity="0"/>
  </linearGradient>
</defs>
<g fill="url(#b)">
${head}
${body}
</g>
<g fill="url(#r)" opacity="0.85">
${head}
${body}
</g>
${extras}
`,
    CW,
    CH,
  );
}

const characters = {
  // 若いホームズ。長身痩躯、帽子なし、やや前傾。
  holmes: figure({
    head: `<ellipse cx="210" cy="150" rx="56" ry="66"/><path d="M154 128 q56 -52 112 0 q-8 -46 -56 -46 q-48 0 -56 46 z"/>`,
    body: `<path d="M210 214 q-70 22 -84 92 l-22 300 q-6 60 10 334 h192 q16 -274 10 -334 l-22 -300 q-14 -70 -84 -92 z"/>
           <path d="M126 320 l-30 240 18 8 44 -232 z"/><path d="M294 320 l30 240 -18 8 -44 -232 z"/>`,
  }),
  // ヴィクター。同年代だが肩幅が広く、姿勢がまっすぐ。
  victor: figure({
    head: `<ellipse cx="210" cy="158" rx="60" ry="66"/><path d="M150 140 q60 -54 120 0 q-6 -50 -60 -50 q-54 0 -60 50 z"/>`,
    body: `<path d="M210 222 q-84 24 -100 96 l-16 290 q-4 62 12 332 h208 q16 -270 12 -332 l-16 -290 q-16 -72 -100 -96 z"/>
           <path d="M112 330 l-26 236 20 8 40 -228 z"/><path d="M308 330 l26 236 -20 8 -40 -228 z"/>`,
  }),
  // トレヴァー老人。ずんぐりした体格、広い肩、うつむき加減。
  trevor: figure({
    head: `<ellipse cx="210" cy="166" rx="62" ry="64"/><path d="M146 152 q64 -50 128 0 q-4 -58 -64 -58 q-60 0 -64 58 z"/><path d="M152 178 q-16 34 6 52 l14 -34 z"/><path d="M268 178 q16 34 -6 52 l-14 -34 z"/>`,
    body: `<path d="M210 228 q-104 28 -118 104 l-14 276 q-4 66 14 332 h236 q18 -266 14 -332 l-14 -276 q-14 -76 -118 -104 z"/>
           <path d="M96 344 l-24 226 22 8 38 -220 z"/><path d="M324 344 l24 226 -22 8 -38 -220 z"/>`,
  }),
  // ハドスン。小柄で痩せ、水夫帽。右腕を体側に固めた立ち方。
  hudson: figure({
    head: `<ellipse cx="210" cy="176" rx="50" ry="56"/><path d="M156 156 q54 -34 108 0 l10 -18 q-64 -40 -128 0 z"/><rect x="150" y="146" width="120" height="18" rx="9"/>`,
    body: `<path d="M210 230 q-62 20 -74 84 l-18 288 q-6 62 8 328 h170 q14 -266 8 -328 l-18 -288 q-12 -64 -76 -84 z"/>
           <path d="M136 324 l-22 232 18 6 36 -226 z"/><path d="M286 328 l26 196 -14 10 -40 -190 z"/>`,
    tone: "#0a0e12",
  }),
  // フォーダム医師。シルクハットと診療鞄。細身。
  fordham: figure({
    head: `<ellipse cx="210" cy="196" rx="48" ry="56"/><rect x="146" y="146" width="128" height="16" rx="7"/><rect x="164" y="60" width="92" height="90" rx="7"/>`,
    body: `<path d="M210 248 q-64 20 -76 86 l-16 268 q-6 62 8 332 h168 q14 -270 8 -332 l-16 -268 q-12 -66 -76 -86 z"/>
           <path d="M134 340 l-22 214 18 8 36 -208 z"/><path d="M286 340 l22 214 -18 8 -36 -208 z"/>`,
    extras: `<g fill="#0d1319"><rect x="292" y="548" width="96" height="72" rx="8"/><path d="M320 548 q20 -22 40 0" fill="none" stroke="#0d1319" stroke-width="8"/></g>`,
  }),
  // ビードウズ。高い襟と外套。顔を隠す立ち方。
  beddoes: figure({
    head: `<ellipse cx="210" cy="176" rx="52" ry="58"/><path d="M150 210 q60 -34 120 0 l6 46 q-66 -30 -132 0 z"/><rect x="158" y="96" width="104" height="60" rx="10"/><rect x="140" y="146" width="140" height="14" rx="7"/>`,
    body: `<path d="M210 236 q-96 26 -110 100 l-14 274 q-4 64 12 330 h224 q16 -266 12 -330 l-14 -274 q-14 -74 -110 -100 z"/>
           <path d="M104 342 l-24 226 20 8 38 -220 z"/><path d="M316 342 l24 226 -20 8 -38 -220 z"/>
           <path d="M210 300 l-42 480 h84 z" opacity="0.5"/>`,
    tone: "#080c10",
  }),
  // プレンダーガスト。長身、長い外套、堂々とした立ち姿。
  prendergast: figure({
    head: `<ellipse cx="210" cy="140" rx="54" ry="62"/><path d="M152 122 q58 -50 116 0 q-6 -54 -58 -54 q-52 0 -58 54 z"/>`,
    body: `<path d="M210 204 q-92 26 -104 104 l-10 288 q-4 60 10 336 h208 q14 -276 10 -336 l-10 -288 q-12 -78 -104 -104 z"/>
           <path d="M112 312 l-30 268 20 8 44 -260 z"/><path d="M308 312 l30 268 -20 8 -44 -260 z"/>
           <path d="M210 268 q-70 30 -76 96 l152 0 q-6 -66 -76 -96 z" opacity="0.55"/>`,
    tone: "#070a0d",
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
  `生成しました：場面 ${Object.keys(scenes).length} 枚 / 人物 ${Object.keys(characters).length} 体`,
);
