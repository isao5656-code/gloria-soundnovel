/**
 * 静的書き出し（`output: "export"`）で公開する。
 *
 * このゲームはすべてブラウザ側で動くため、サーバーは要らない。
 * `npm run build` は `out/` に完全な静的サイトを吐く。
 *
 * GitHub Pages のプロジェクトページは `https://<user>.github.io/<repo>/` に
 * 置かれるので、`/<repo>` を basePath として前置する必要がある。
 * ワークフローが `NEXT_PUBLIC_BASE_PATH` を渡す。ローカルでは空のまま。
 *
 * 注意：素の <img src="/..."> は Next が basePath を自動で足さない。
 * 画像は必ず `lib/assets.ts` の `asset()` を通すこと。
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
